import { useState } from 'react';
import { ADJUSTMENT_DEFAULTS } from '../lib/imageAdjustments.js';

const PRESETS = [
  { label: '不調整', values: { brightness: 100, contrast: 100, saturation: 100 } },
  { label: 'iPhone 補亮 (建議)', values: { brightness: 112, contrast: 105, saturation: 105 } },
  { label: '更亮', values: { brightness: 125, contrast: 108, saturation: 108 } }
];

export default function ExportSettingsModal({ value, onChange, onClose }) {
  const [draft, setDraft] = useState(value);

  const update = (key, v) =>
    setDraft((d) => ({ ...d, [key]: Number(v) }));

  const applyPreset = (preset) => setDraft(preset);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">輸出影像調整</div>
        <div className="modal-body" style={{ alignItems: 'stretch' }}>
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
            iPhone Display P3 照片轉成 PDF 後常會偏暗，這裡可在匯出時補償。
            修改後立刻在下次匯出時生效。
          </p>

          <div className="aspect-row" style={{ marginTop: 12 }}>
            <span style={{ color: '#6b7280' }}>快速套用：</span>
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => applyPreset(p.values)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="watermark-controls" style={{ marginTop: 16 }}>
            <label className="watermark-control">
              <span>亮度</span>
              <input
                type="range"
                min="50"
                max="200"
                value={draft.brightness}
                onChange={(e) => update('brightness', e.target.value)}
              />
              <em>{draft.brightness}%</em>
            </label>
            <label className="watermark-control">
              <span>對比</span>
              <input
                type="range"
                min="50"
                max="200"
                value={draft.contrast}
                onChange={(e) => update('contrast', e.target.value)}
              />
              <em>{draft.contrast}%</em>
            </label>
            <label className="watermark-control">
              <span>飽和</span>
              <input
                type="range"
                min="50"
                max="200"
                value={draft.saturation}
                onChange={(e) => update('saturation', e.target.value)}
              />
              <em>{draft.saturation}%</em>
            </label>
          </div>

          <button
            className="btn"
            type="button"
            onClick={() => setDraft(ADJUSTMENT_DEFAULTS)}
            style={{ marginTop: 12, alignSelf: 'flex-start' }}
          >
            還原預設
          </button>
        </div>
        <div className="modal-footer">
          <div className="actions" />
          <div className="actions">
            <button className="btn" onClick={onClose}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                onChange(draft);
                onClose();
              }}
            >
              儲存設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
