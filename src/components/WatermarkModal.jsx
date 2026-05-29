import { useEffect, useRef, useState, useMemo } from 'react';
import { applyWatermark, WATERMARK_DEFAULTS } from '../lib/watermark.js';

// Preview is rendered at a downscaled resolution so slider drags stay snappy
// even on big phone photos. The watermark params (font size, spacing) are
// scaled along with the image so the preview is visually faithful.
const PREVIEW_MAX_DIM = 720;

export default function WatermarkModal({
  workItem,
  totalWorkItems,
  onApply,
  onApplyToAll,
  onRemove,
  onCancel
}) {
  const [config, setConfig] = useState(
    workItem.watermark || WATERMARK_DEFAULTS
  );
  const [previewSrc, setPreviewSrc] = useState(null);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);

  const sourceForPreview = workItem.originalSrc || workItem.src;

  // figure out preview scale once per work item
  const previewScale = useMemo(() => {
    const longest = Math.max(workItem.width, workItem.height);
    return longest > PREVIEW_MAX_DIM ? PREVIEW_MAX_DIM / longest : 1;
  }, [workItem.width, workItem.height]);

  // re-render preview whenever config changes (debounced)
  useEffect(() => {
    let cancelled = false;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyWatermark(sourceForPreview, config, previewScale)
        .then((url) => {
          if (!cancelled) setPreviewSrc(url);
        })
        .catch(() => {});
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
  }, [config, sourceForPreview, previewScale]);

  const update = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

  const handleApply = async () => {
    setBusy(true);
    try {
      const fullSrc = await applyWatermark(sourceForPreview, config, 1);
      onApply({ src: fullSrc, watermark: config, originalSrc: sourceForPreview });
    } finally {
      setBusy(false);
    }
  };

  const handleApplyToAll = async () => {
    setBusy(true);
    try {
      const fullSrc = await applyWatermark(sourceForPreview, config, 1);
      await onApplyToAll({
        src: fullSrc,
        watermark: config,
        originalSrc: sourceForPreview
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal watermark-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">浮水印設定</div>

        <div className="modal-body watermark-body">
          <div className="watermark-preview">
            {previewSrc ? (
              <img src={previewSrc} alt="預覽" />
            ) : (
              <div className="watermark-preview-loading">載入中…</div>
            )}
          </div>

          <div className="watermark-controls">
            <label className="watermark-control">
              <span>文字</span>
              <input
                type="text"
                value={config.text}
                onChange={(e) => update({ text: e.target.value })}
                placeholder="輸入浮水印文字"
              />
            </label>

            <label className="watermark-control">
              <span>字級</span>
              <input
                type="range"
                min="12"
                max="300"
                value={config.fontSize}
                onChange={(e) => update({ fontSize: Number(e.target.value) })}
              />
              <em>{config.fontSize}px</em>
            </label>

            <label className="watermark-control">
              <span>間距</span>
              <input
                type="range"
                min="40"
                max="500"
                value={config.spacing}
                onChange={(e) => update({ spacing: Number(e.target.value) })}
              />
              <em>{config.spacing}px</em>
            </label>

            <label className="watermark-control">
              <span>透明度</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(config.opacity * 100)}
                onChange={(e) =>
                  update({ opacity: Number(e.target.value) / 100 })
                }
              />
              <em>{Math.round(config.opacity * 100)}%</em>
            </label>

            <label className="watermark-control">
              <span>旋轉</span>
              <input
                type="range"
                min="-90"
                max="90"
                value={config.rotation}
                onChange={(e) => update({ rotation: Number(e.target.value) })}
              />
              <em>{config.rotation}°</em>
            </label>

            <label className="watermark-control">
              <span>顏色</span>
              <input
                type="color"
                value={config.color}
                onChange={(e) => update({ color: e.target.value })}
              />
              <em className="watermark-color-hex">{config.color}</em>
            </label>

            <button
              className="btn"
              type="button"
              onClick={() => setConfig(WATERMARK_DEFAULTS)}
            >
              還原預設
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <div className="actions">
            {workItem.watermark && (
              <button className="btn btn-danger" onClick={onRemove}>
                移除浮水印
              </button>
            )}
          </div>
          <div className="actions">
            <button className="btn" onClick={onCancel} disabled={busy}>
              取消
            </button>
            {totalWorkItems > 1 && (
              <button
                className="btn"
                onClick={handleApplyToAll}
                disabled={busy}
                title={`使用此設定一次套用到全部 ${totalWorkItems} 張素材`}
              >
                {busy ? '處理中…' : `套用到全部 ${totalWorkItems} 張`}
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={busy}
            >
              {busy ? '處理中…' : '只套用此張'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
