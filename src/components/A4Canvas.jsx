import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Transformer, Line } from 'react-konva';
import CanvasImage from './CanvasImage.jsx';
import LayerPanel from './LayerPanel.jsx';
import { getCanvasDimensions } from '../lib/canvasDimensions.js';
import { computeSnap, computeResizeSnap } from '../lib/snapping.js';

export default function A4Canvas({
  index,
  canvas,
  workItems,
  isSelected,
  onSelect,
  onDelete,
  onToggleOrientation,
  onDropOnCanvas,
  onUpdateItem,
  onRemoveItem,
  onReorderItem,
  registerStage
}) {
  const dims = getCanvasDimensions(canvas.orientation);
  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const transformerRef = useRef(null);
  // map of itemId -> Konva node, populated by CanvasImage children
  const shapeRefs = useRef({});
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [guides, setGuides] = useState([]);
  const [shiftHeld, setShiftHeld] = useState(false);

  // Hold Shift while dragging a corner anchor → proportional resize.
  // Track on window so the user can press/release Shift mid-transform.
  useEffect(() => {
    const onDown = (e) => { if (e.key === 'Shift') setShiftHeld(true); };
    const onUp = (e) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Snap-to-align while dragging: compare the active item's bbox edges
  // and centers against canvas edges/center and every other item.
  const handleItemDragMove = useCallback(
    (itemId) => {
      const node = shapeRefs.current[itemId];
      if (!node) return;
      const box = node.getClientRect({ skipShadow: true, skipStroke: true });
      const others = Object.entries(shapeRefs.current)
        .filter(([id, n]) => id !== itemId && n)
        .map(([, n]) => n.getClientRect({ skipShadow: true, skipStroke: true }));
      const result = computeSnap(box, others, dims.width, dims.height);
      if (result.dx || result.dy) {
        node.x(node.x() + result.dx);
        node.y(node.y() + result.dy);
      }
      setGuides(result.guides);
    },
    [dims.width, dims.height]
  );

  const handleItemDragEnd = useCallback(() => {
    setGuides([]);
  }, []);

  // Snap during resize. Konva's boundBoxFunc lets us tweak the proposed
  // newBox before it is applied, so this is where we anchor sizes / edges.
  const handleBoundBox = useCallback(
    (oldBox, newBox) => {
      if (newBox.width < 10 || newBox.height < 10) return oldBox;

      const tr = transformerRef.current;
      const anchor =
        (tr && (typeof tr.getActiveAnchor === 'function'
          ? tr.getActiveAnchor()
          : tr._movingAnchorName)) || '';
      if (!anchor || anchor === 'rotater') {
        setGuides([]);
        return newBox;
      }
      if (!selectedItemId) return newBox;

      const otherSizes = canvas.items
        .filter((it) => it.id !== selectedItemId)
        .map((it) => {
          const wi = workItems.find((w) => w.id === it.workItemId);
          if (!wi) return null;
          return { width: wi.width * it.scaleX, height: wi.height * it.scaleY };
        })
        .filter(Boolean);

      const otherBoxes = Object.entries(shapeRefs.current)
        .filter(([id, n]) => id !== selectedItemId && n)
        .map(([, n]) => n.getClientRect({ skipShadow: true, skipStroke: true }));

      const result = computeResizeSnap({
        newBox,
        oldBox,
        anchor,
        otherSizes,
        otherBoxes,
        canvasWidth: dims.width,
        canvasHeight: dims.height,
        rotation: newBox.rotation || 0,
        keepRatio: shiftHeld
      });
      setGuides(result.guides);
      return result.box;
    },
    [shiftHeld, selectedItemId, canvas.items, workItems, dims.width, dims.height]
  );

  // register stage with parent for export
  useEffect(() => {
    registerStage(canvas.id, stageRef.current);
    return () => registerStage(canvas.id, null);
  }, [canvas.id, registerStage]);

  // children call this to publish/clear their Konva node
  const registerShape = useCallback((itemId, node) => {
    if (node) {
      shapeRefs.current[itemId] = node;
    } else {
      delete shapeRefs.current[itemId];
    }
  }, []);

  // Re-attach the single Transformer whenever selection or items change.
  // Look up the target node via the ref map first, with a Konva scenegraph
  // search as fallback in case the ref-callback registration somehow missed.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    let node = null;
    if (selectedItemId) {
      node =
        shapeRefs.current[selectedItemId] ||
        stageRef.current?.findOne((n) => n.name && n.name() === selectedItemId);
    }
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedItemId, canvas.items]);

  // Auto-select the newly-added item: nicer UX (immediately editable).
  const prevItemCount = useRef(canvas.items.length);
  useEffect(() => {
    const count = canvas.items.length;
    if (count > prevItemCount.current && count > 0) {
      setSelectedItemId(canvas.items[count - 1].id);
    }
    prevItemCount.current = count;
  }, [canvas.items]);

  // Stage mousedown: only marks this canvas as the active one. Selection of
  // individual photos is now driven exclusively by the LayerPanel — clicking
  // an image on the canvas does nothing, and clicking the empty area also
  // does nothing (use the panel to deselect by clicking another row, or use
  // Delete to remove the selected one).
  const handleStageMouseDown = () => {
    onSelect();
  };

  // delete selected item via keyboard
  useEffect(() => {
    if (!isSelected || !selectedItemId) return;
    const handler = (e) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        onRemoveItem(selectedItemId);
        setSelectedItemId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSelected, selectedItemId, onRemoveItem]);

  // ---- HTML5 drop from sidebar ----
  const handleDragOver = useCallback((e) => {
    if (e.dataTransfer.types.includes('application/x-workitem-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!wrapRef.current?.contains(e.relatedTarget)) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const wid = e.dataTransfer.getData('application/x-workitem-id');
      if (!wid) return;
      const rect = wrapRef.current.getBoundingClientRect();
      onDropOnCanvas(wid, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      onSelect();
    },
    [onDropOnCanvas, onSelect]
  );

  const handlePanelRemove = useCallback(
    (itemId) => {
      onRemoveItem(itemId);
      if (itemId === selectedItemId) setSelectedItemId(null);
    },
    [onRemoveItem, selectedItemId]
  );

  return (
    <div className={`canvas-card ${isSelected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="canvas-card-header">
        <div>
          畫布 #{index + 1} · {canvas.orientation === 'portrait' ? '直式' : '橫式'} A4
          {' · '}
          {canvas.items.length} 張照片
        </div>
        <div className="actions">
          <button onClick={(e) => { e.stopPropagation(); onToggleOrientation(); }}>
            切換方向
          </button>
          <button
            className="delete"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('確定要刪除這張畫布嗎？')) onDelete();
            }}
          >
            刪除畫布
          </button>
        </div>
      </div>

      <div className="canvas-card-body">
        <div
          ref={wrapRef}
          className={`canvas-stage-wrap ${dragOver ? 'drop-target' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ width: dims.width, height: dims.height }}
        >
          <Stage
            ref={stageRef}
            width={dims.width}
            height={dims.height}
            onMouseDown={handleStageMouseDown}
            onTouchStart={handleStageMouseDown}
          >
            <Layer>
              <Rect
                x={0}
                y={0}
                width={dims.width}
                height={dims.height}
                fill="white"
                listening={false}
              />
              {canvas.items.map((item) => {
                const wi = workItems.find((w) => w.id === item.workItemId);
                if (!wi) return null;
                return (
                  <CanvasImage
                    key={item.id}
                    item={item}
                    workItem={wi}
                    isSelected={item.id === selectedItemId}
                    registerShape={registerShape}
                    onChange={(patch) => onUpdateItem(item.id, patch)}
                    onDragMove={handleItemDragMove}
                    onDragEnd={handleItemDragEnd}
                  />
                );
              })}
              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio={shiftHeld}
                enabledAnchors={[
                  'top-left',
                  'top-right',
                  'bottom-left',
                  'bottom-right',
                  'middle-left',
                  'middle-right',
                  'top-center',
                  'bottom-center'
                ]}
                boundBoxFunc={handleBoundBox}
                onTransformEnd={() => setGuides([])}
              />
              {guides.map((g, i) => (
                <Line
                  key={`guide-${i}`}
                  points={
                    g.orientation === 'V'
                      ? [g.position, 0, g.position, dims.height]
                      : [0, g.position, dims.width, g.position]
                  }
                  stroke="#ff3b30"
                  strokeWidth={1}
                  dash={[4, 6]}
                  listening={false}
                />
              ))}
            </Layer>
          </Stage>
        </div>

        <LayerPanel
          items={canvas.items}
          workItems={workItems}
          selectedItemId={selectedItemId}
          onSelect={setSelectedItemId}
          onRemove={handlePanelRemove}
          onReorder={onReorderItem}
        />
      </div>
    </div>
  );
}
