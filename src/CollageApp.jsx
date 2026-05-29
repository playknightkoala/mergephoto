import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UploadZone from './components/UploadZone.jsx';
import CropModal from './components/CropModal.jsx';
import WatermarkModal from './components/WatermarkModal.jsx';
import ExportSettingsModal from './components/ExportSettingsModal.jsx';
import { applyWatermark } from './lib/watermark.js';
import { ADJUSTMENT_DEFAULTS, isAdjustmentNoop } from './lib/imageAdjustments.js';
import WorkList from './components/WorkList.jsx';
import CanvasBoard from './components/CanvasBoard.jsx';
import { exportCanvasesToPdf } from './lib/exportPdf.js';
import { getCanvasDimensions } from './lib/canvasDimensions.js';
import { useUndoableState } from './lib/useUndoableState.js';

let _id = 0;
const nextId = (prefix) => `${prefix}-${Date.now()}-${++_id}`;

export default function CollageApp() {
  // Combined undoable state.
  //   workItems: cropped photos in the staging library
  //     each: { id, name, src (dataURL), width, height }
  //   canvases: list of A4 canvases
  //     each: { id, orientation: 'portrait'|'landscape', items: [...] }
  //     canvas item: { id, workItemId, x, y, scaleX, scaleY, rotation }
  const {
    state: { workItems, canvases },
    setState: setUndoable,
    undo,
    redo,
    canUndo,
    canRedo
  } = useUndoableState({ workItems: [], canvases: [] });

  // Wrappers that preserve the previous useState API so the bulk of the code
  // doesn't have to change. Each call pushes one history entry.
  const setWorkItems = useCallback(
    (updater) => {
      setUndoable((prev) => ({
        ...prev,
        workItems:
          typeof updater === 'function' ? updater(prev.workItems) : updater
      }));
    },
    [setUndoable]
  );
  const setCanvases = useCallback(
    (updater) => {
      setUndoable((prev) => ({
        ...prev,
        canvases:
          typeof updater === 'function' ? updater(prev.canvases) : updater
      }));
    },
    [setUndoable]
  );

  const [selectedCanvasId, setSelectedCanvasId] = useState(null);

  // queue of files waiting to be cropped — front of array is current file
  // each: { src, name }
  const [pendingQueue, setPendingQueue] = useState([]);

  // workItemId currently being edited in the watermark modal (or null)
  const [watermarkTargetId, setWatermarkTargetId] = useState(null);

  // Tonal adjustments applied during PDF export. Default to iPhone-friendly
  // brightness/contrast boost since the most common input is iPhone P3 photos
  // that come out dim through the canvas-to-JPEG pipeline.
  const [exportAdjustments, setExportAdjustments] = useState({
    brightness: 112,
    contrast: 105,
    saturation: 105
  });
  const [showExportSettings, setShowExportSettings] = useState(false);

  // refs to konva stage instances per canvas, used for export
  const stageRefs = useRef({});

  const registerStage = useCallback((canvasId, stage) => {
    if (stage) stageRefs.current[canvasId] = stage;
    else delete stageRefs.current[canvasId];
  }, []);

  // ---------- Upload handlers ----------
  const handleFilesSelected = useCallback((files) => {
    const list = Array.isArray(files) ? files : [files];
    Promise.all(
      list.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) =>
              resolve({ src: e.target.result, name: file.name });
            reader.readAsDataURL(file);
          })
      )
    ).then((entries) => {
      setPendingQueue((prev) => [...prev, ...entries]);
    });
  }, []);

  // add a finished work-item to the library
  const pushWorkItem = useCallback(({ src, width, height, name }) => {
    setWorkItems((prev) => [
      ...prev,
      { id: nextId('work'), name: name || 'photo', src, width, height }
    ]);
  }, []);

  // import the current pending image without cropping
  const importWithoutCrop = useCallback(
    (entry) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          pushWorkItem({
            src: c.toDataURL('image/jpeg', 0.92),
            width: c.width,
            height: c.height,
            name: entry.name
          });
          resolve();
        };
        img.onerror = () => resolve();
        img.src = entry.src;
      }),
    [pushWorkItem]
  );

  const handleCropConfirm = useCallback(
    ({ src, width, height, name }) => {
      pushWorkItem({ src, width, height, name });
      setPendingQueue((prev) => prev.slice(1));
    },
    [pushWorkItem]
  );

  // skip cropping this one entry but still import as-is, advance queue
  const handleSkipCropOne = useCallback(async () => {
    setPendingQueue((prev) => {
      const [head, ...rest] = prev;
      if (head) importWithoutCrop(head);
      return rest;
    });
  }, [importWithoutCrop]);

  // throw away current entry, advance queue
  const handleDiscardOne = useCallback(() => {
    setPendingQueue((prev) => prev.slice(1));
  }, []);

  // import all remaining entries without cropping, close modal
  const handleSkipAllRemaining = useCallback(async () => {
    setPendingQueue((prev) => {
      prev.forEach((entry) => importWithoutCrop(entry));
      return [];
    });
  }, [importWithoutCrop]);

  // discard everything in the queue
  const handleCancelAll = useCallback(() => setPendingQueue([]), []);

  // ---------- Watermark ----------
  const handleApplyWatermark = useCallback(
    ({ src, watermark, originalSrc }) => {
      setWorkItems((prev) =>
        prev.map((w) =>
          w.id === watermarkTargetId
            ? { ...w, src, watermark, originalSrc }
            : w
        )
      );
      setWatermarkTargetId(null);
    },
    [watermarkTargetId]
  );

  // Apply the same watermark settings to every work item. The current
  // target uses the freshly-rendered src from the modal; everything else
  // is re-rendered on the fly from its original.
  const handleApplyWatermarkToAll = useCallback(
    async ({ src, watermark, originalSrc }) => {
      const targetId = watermarkTargetId;
      const others = workItems.filter((w) => w.id !== targetId);

      const renders = await Promise.all(
        others.map(async (w) => {
          const orig = w.originalSrc || w.src;
          const newSrc = await applyWatermark(orig, watermark, 1);
          return { id: w.id, src: newSrc, watermark, originalSrc: orig };
        })
      );

      const byId = new Map(renders.map((r) => [r.id, r]));
      setWorkItems((prev) =>
        prev.map((w) => {
          if (w.id === targetId) {
            return { ...w, src, watermark, originalSrc };
          }
          const r = byId.get(w.id);
          return r ? { ...w, src: r.src, watermark: r.watermark, originalSrc: r.originalSrc } : w;
        })
      );
      setWatermarkTargetId(null);
    },
    [watermarkTargetId, workItems]
  );

  const handleRemoveWatermark = useCallback(() => {
    setWorkItems((prev) =>
      prev.map((w) => {
        if (w.id !== watermarkTargetId) return w;
        const { watermark, originalSrc, ...rest } = w;
        return { ...rest, src: originalSrc || w.src };
      })
    );
    setWatermarkTargetId(null);
  }, [watermarkTargetId]);

  const handleDeleteWorkItem = useCallback(
    (workItemId) => {
      setUndoable((prev) => ({
        workItems: prev.workItems.filter((w) => w.id !== workItemId),
        canvases: prev.canvases.map((c) => ({
          ...c,
          items: c.items.filter((it) => it.workItemId !== workItemId)
        }))
      }));
    },
    [setUndoable]
  );

  // ---------- Canvas operations ----------
  const addCanvas = useCallback((orientation = 'portrait') => {
    const id = nextId('canvas');
    setCanvases((prev) => [
      ...prev,
      { id, orientation, items: [] }
    ]);
    setSelectedCanvasId(id);
  }, []);

  const deleteCanvas = useCallback((canvasId) => {
    setCanvases((prev) => prev.filter((c) => c.id !== canvasId));
    setSelectedCanvasId((prev) => (prev === canvasId ? null : prev));
    delete stageRefs.current[canvasId];
  }, []);

  const toggleOrientation = useCallback((canvasId) => {
    setCanvases((prev) =>
      prev.map((c) =>
        c.id === canvasId
          ? {
              ...c,
              orientation: c.orientation === 'portrait' ? 'landscape' : 'portrait'
            }
          : c
      )
    );
  }, []);

  // Compute a placement (position/scale) for a new image so it fits the canvas.
  // Stagger position by item count so subsequent photos don't fully stack on
  // top of earlier ones at the canvas centre.
  const buildInitialPlacement = useCallback(
    (canvas, workItem) => {
      const dims = getCanvasDimensions(canvas.orientation);
      const maxW = dims.width * 0.4;
      const maxH = dims.height * 0.4;
      const scale = Math.min(maxW / workItem.width, maxH / workItem.height, 1);
      const w = workItem.width * scale;
      const h = workItem.height * scale;
      const stagger = (canvas.items.length % 8) * 28;
      return {
        x: (dims.width - w) / 2 + stagger,
        y: (dims.height - h) / 2 + stagger,
        scaleX: scale,
        scaleY: scale,
        rotation: 0
      };
    },
    []
  );

  const addItemToCanvas = useCallback(
    (canvasId, workItemId, dropPos = null) => {
      setCanvases((prev) =>
        prev.map((c) => {
          if (c.id !== canvasId) return c;
          const wi = workItems.find((w) => w.id === workItemId);
          if (!wi) return c;
          const placement = buildInitialPlacement(c, wi);
          if (dropPos) {
            placement.x = dropPos.x - (wi.width * placement.scaleX) / 2;
            placement.y = dropPos.y - (wi.height * placement.scaleY) / 2;
          }
          return {
            ...c,
            items: [
              ...c.items,
              {
                id: nextId('item'),
                workItemId,
                ...placement
              }
            ]
          };
        })
      );
    },
    [workItems, buildInitialPlacement]
  );

  const updateCanvasItem = useCallback((canvasId, itemId, patch) => {
    setCanvases((prev) =>
      prev.map((c) =>
        c.id === canvasId
          ? {
              ...c,
              items: c.items.map((it) =>
                it.id === itemId ? { ...it, ...patch } : it
              )
            }
          : c
      )
    );
  }, []);

  const removeCanvasItem = useCallback((canvasId, itemId) => {
    setCanvases((prev) =>
      prev.map((c) =>
        c.id === canvasId
          ? { ...c, items: c.items.filter((it) => it.id !== itemId) }
          : c
      )
    );
  }, []);

  const reorderCanvasItem = useCallback((canvasId, itemId, direction) => {
    setCanvases((prev) =>
      prev.map((c) => {
        if (c.id !== canvasId) return c;
        const idx = c.items.findIndex((it) => it.id === itemId);
        if (idx < 0) return c;
        const newItems = [...c.items];
        const [target] = newItems.splice(idx, 1);
        let newIdx;
        switch (direction) {
          case 'top':
            newIdx = newItems.length;
            break;
          case 'bottom':
            newIdx = 0;
            break;
          case 'up':
            newIdx = Math.min(newItems.length, idx + 1);
            break;
          case 'down':
            newIdx = Math.max(0, idx - 1);
            break;
          default:
            newIdx = idx;
        }
        newItems.splice(newIdx, 0, target);
        return { ...c, items: newItems };
      })
    );
  }, []);

  // ---------- "Click to add" — adds to selected canvas ----------
  const handleAddWorkItemToSelected = useCallback(
    (workItemId) => {
      if (!selectedCanvasId) {
        alert('請先建立或選擇一張 A4 畫布');
        return;
      }
      addItemToCanvas(selectedCanvasId, workItemId);
    },
    [selectedCanvasId, addItemToCanvas]
  );

  // ---------- Export ----------
  const handleExport = useCallback(async () => {
    if (canvases.length === 0) return;
    await exportCanvasesToPdf(canvases, stageRefs.current, exportAdjustments);
  }, [canvases, exportAdjustments]);

  const totalItems = useMemo(
    () => canvases.reduce((sum, c) => sum + c.items.length, 0),
    [canvases]
  );

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo. Skip when typing
  // in inputs (let the browser handle its native undo for text) or when a
  // modal is open (avoid surprising the user mid-flow).
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }
      if (pendingQueue.length > 0 || watermarkTargetId || showExportSettings) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, pendingQueue.length, watermarkTargetId, showExportSettings]);

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>合併相片</h1>
          <div className="subtitle">A4 列印拼貼工具</div>
        </header>

        <UploadZone onFileSelected={handleFilesSelected} />

        <WorkList
          items={workItems}
          onDelete={handleDeleteWorkItem}
          onAddToCanvas={handleAddWorkItemToSelected}
          onEditWatermark={setWatermarkTargetId}
          hasSelectedCanvas={!!selectedCanvasId}
        />
      </aside>

      <main className="main">
        <div className="toolbar">
          <div className="group">
            <button className="btn btn-primary" onClick={() => addCanvas('portrait')}>
              + 新增畫布 (直式)
            </button>
            <button className="btn" onClick={() => addCanvas('landscape')}>
              + 新增畫布 (橫式)
            </button>
          </div>
          <div className="divider" />
          <div className="group">
            <button
              className="btn"
              onClick={undo}
              disabled={!canUndo}
              title="復原 (Ctrl/Cmd+Z)"
            >
              ↶ 上一步
            </button>
            <button
              className="btn"
              onClick={redo}
              disabled={!canRedo}
              title="重做 (Ctrl/Cmd+Shift+Z)"
            >
              ↷ 下一步
            </button>
          </div>
          <div className="divider" />
          <div className="group">
            <button
              className="btn btn-success"
              onClick={handleExport}
              disabled={canvases.length === 0 || totalItems === 0}
              title={
                canvases.length === 0
                  ? '請先新增畫布'
                  : totalItems === 0
                  ? '畫布上還沒有照片'
                  : '匯出為 PDF'
              }
            >
              匯出 PDF ({canvases.length} 頁)
            </button>
            <button
              className="btn"
              onClick={() => setShowExportSettings(true)}
              title="調整匯出時的亮度 / 對比 / 飽和度"
            >
              ⚙ 輸出設定
              {!isAdjustmentNoop(exportAdjustments) && (
                <span style={{ marginLeft: 4, fontSize: 11, color: '#059669' }}>●</span>
              )}
            </button>
          </div>
          <div style={{ flex: 1 }} />
          <div className="group" style={{ color: '#6b7280', fontSize: 13 }}>
            素材 {workItems.length} / 畫布 {canvases.length} / 已放置 {totalItems}
          </div>
        </div>

        <CanvasBoard
          canvases={canvases}
          workItems={workItems}
          selectedCanvasId={selectedCanvasId}
          onSelectCanvas={setSelectedCanvasId}
          onDeleteCanvas={deleteCanvas}
          onToggleOrientation={toggleOrientation}
          onDropOnCanvas={addItemToCanvas}
          onUpdateItem={updateCanvasItem}
          onRemoveItem={removeCanvasItem}
          onReorderItem={reorderCanvasItem}
          registerStage={registerStage}
        />
      </main>

      {showExportSettings && (
        <ExportSettingsModal
          value={exportAdjustments}
          onChange={setExportAdjustments}
          onClose={() => setShowExportSettings(false)}
        />
      )}

      {watermarkTargetId &&
        (() => {
          const target = workItems.find((w) => w.id === watermarkTargetId);
          if (!target) return null;
          return (
            <WatermarkModal
              workItem={target}
              totalWorkItems={workItems.length}
              onApply={handleApplyWatermark}
              onApplyToAll={handleApplyWatermarkToAll}
              onRemove={handleRemoveWatermark}
              onCancel={() => setWatermarkTargetId(null)}
            />
          );
        })()}

      {pendingQueue.length > 0 && (
        <CropModal
          key={pendingQueue[0].src.slice(0, 64)}
          src={pendingQueue[0].src}
          name={pendingQueue[0].name}
          queueIndex={0}
          queueTotal={pendingQueue.length}
          onConfirm={handleCropConfirm}
          onSkipCropOne={handleSkipCropOne}
          onDiscardOne={handleDiscardOne}
          onSkipAllRemaining={handleSkipAllRemaining}
          onCancelAll={handleCancelAll}
        />
      )}
    </div>
  );
}

