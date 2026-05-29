import { useCallback, useMemo, useState } from 'react';
import UploadZone from './UploadZone.jsx';
import IdPhotoCropModal from './IdPhotoCropModal.jsx';
import IdPhotoSheet from './IdPhotoSheet.jsx';
import { ID_PHOTO_SPECS, getSpec } from '../lib/idPhotoSpecs.js';
import { computeLayout, perSourceCounts } from '../lib/idPhotoLayout.js';
import { composeSheetDataUrl } from '../lib/composeSheet.js';
import { triggerDownload } from '../lib/download.js';

let _id = 0;
const nextId = () => `id-${Date.now()}-${++_id}`;

export default function IdPhotoStudio() {
  const [specId, setSpecId] = useState('tw-2in');
  // cropped photos placed on the sheet: { id, name, dataURL }
  const [sources, setSources] = useState([]);
  // files awaiting crop: { src, name }
  const [pendingQueue, setPendingQueue] = useState([]);
  const [showCutLines, setShowCutLines] = useState(true);
  const [exporting, setExporting] = useState(false);

  const spec = getSpec(specId);
  const layout = useMemo(() => computeLayout(spec), [spec]);
  const counts = useMemo(
    () => (layout ? perSourceCounts(sources.length, layout.count) : []),
    [sources.length, layout]
  );

  const handleSpecChange = useCallback(
    (id) => {
      if (id === specId) return;
      if (
        sources.length > 0 &&
        !confirm('切換尺寸會清除已加入的相片（裁切比例不同），確定要切換嗎？')
      ) {
        return;
      }
      setSpecId(id);
      setSources([]);
    },
    [specId, sources.length]
  );

  const handleFilesSelected = useCallback((files) => {
    const list = Array.isArray(files) ? files : [files];
    Promise.all(
      list.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ src: e.target.result, name: file.name });
            reader.readAsDataURL(file);
          })
      )
    ).then((entries) => setPendingQueue((prev) => [...prev, ...entries]));
  }, []);

  const handleCropConfirm = useCallback(({ dataURL, name }) => {
    setSources((prev) => [...prev, { id: nextId(), name: name || 'photo', dataURL }]);
    setPendingQueue((prev) => prev.slice(1));
  }, []);

  const handleRemoveSource = useCallback((id) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleExport = useCallback(
    async (format) => {
      if (!layout || sources.length === 0) return;
      setExporting(true);
      try {
        const url = await composeSheetDataUrl(sources, layout, { showCutLines }, format);
        const date = new Date().toISOString().slice(0, 10);
        triggerDownload(url, `idphoto-${spec.id}-${date}.${format}`);
      } finally {
        setExporting(false);
      }
    },
    [layout, sources, showCutLines, spec]
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>證件照製作</h1>
          <div className="subtitle">台灣規格 · 4×6 相紙 (1800×1200px) 自動排版</div>
        </header>

        <div className="spec-picker">
          {ID_PHOTO_SPECS.map((s) => (
            <button
              key={s.id}
              className={`spec-option ${s.id === specId ? 'active' : ''}`}
              onClick={() => handleSpecChange(s.id)}
            >
              <div className="spec-option-title">
                {s.label} <span className="spec-option-size">{s.sizeLabel}</span>
              </div>
              <div className="spec-option-uses">{s.uses}</div>
              {s.faceGuide && <span className="spec-option-badge">含臉部參考線</span>}
            </button>
          ))}
        </div>

        <UploadZone onFileSelected={handleFilesSelected} />

        <div className="work-list">
          {sources.length === 0 ? (
            <div className="work-list-empty">
              尚未加入相片
              <br />
              上傳後會依 {spec.label} 比例裁切
            </div>
          ) : (
            <>
              <div className="work-list-toolbar">
                <span className="work-list-count">
                  {sources.length} 種相片
                </span>
                <button
                  className="work-list-download-all"
                  onClick={() => setSources([])}
                >
                  清除全部
                </button>
              </div>
              <div className="work-list-grid">
                {sources.map((s, i) => (
                  <div key={s.id} className="work-item" title={s.name}>
                    <img src={s.dataURL} alt={s.name} />
                    <span className="id-source-count">×{counts[i] ?? 0}</span>
                    <button
                      className="delete-btn"
                      onClick={() => handleRemoveSource(s.id)}
                      title="移除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>

      <main className="main">
        <div className="toolbar">
          <div className="group" style={{ color: '#374151', fontSize: 13 }}>
            {layout ? (
              <>
                本張 4×6 可放 <strong>{layout.count}</strong> 張 · 目前{' '}
                <strong>{sources.length}</strong> 種相片
                {sources.length > 0 && (
                  <span style={{ color: '#6b7280' }}>
                    {' '}（{counts.join(' + ')}）
                  </span>
                )}
              </>
            ) : (
              '無法排版此尺寸'
            )}
          </div>
          <div className="divider" />
          <label className="group" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCutLines}
              onChange={(e) => setShowCutLines(e.target.checked)}
            />
            裁切線
          </label>
          <div style={{ flex: 1 }} />
          <div className="group">
            <button
              className="btn btn-success"
              onClick={() => handleExport('jpg')}
              disabled={sources.length === 0 || exporting}
            >
              匯出 JPG
            </button>
            <button
              className="btn"
              onClick={() => handleExport('png')}
              disabled={sources.length === 0 || exporting}
            >
              匯出 PNG
            </button>
          </div>
        </div>

        <div className="id-sheet-area">
          <IdPhotoSheet sources={sources} layout={layout} showCutLines={showCutLines} />
        </div>
      </main>

      {pendingQueue.length > 0 && (
        <IdPhotoCropModal
          key={pendingQueue[0].src.slice(0, 64)}
          src={pendingQueue[0].src}
          name={pendingQueue[0].name}
          spec={spec}
          queueIndex={0}
          queueTotal={pendingQueue.length}
          onConfirm={handleCropConfirm}
          onDiscardOne={() => setPendingQueue((prev) => prev.slice(1))}
          onCancelAll={() => setPendingQueue([])}
        />
      )}
    </div>
  );
}
