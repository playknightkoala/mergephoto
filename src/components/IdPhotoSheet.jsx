import { useEffect, useState } from 'react';
import { composeSheet } from '../lib/composeSheet.js';

// Live preview of the 4×6 sheet. The sheet is composed at full 300-DPI
// resolution on an offscreen canvas (see composeSheet) and shown scaled to
// fit — the same canvas is what export saves, so what you see is what prints.
export default function IdPhotoSheet({ sources, layout, showCutLines }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!layout || sources.length === 0) {
      setDataUrl(null);
      return;
    }
    composeSheet(sources, layout, { showCutLines }).then((canvas) => {
      if (!cancelled) setDataUrl(canvas.toDataURL('image/jpeg', 0.9));
    });
    return () => {
      cancelled = true;
    };
  }, [sources, layout, showCutLines]);

  if (!dataUrl) {
    return (
      <div className="id-sheet-empty">
        從左側選好尺寸並上傳照片
        <br />
        系統會自動把照片排滿一張 4×6 (1800×1200px) 相紙
      </div>
    );
  }

  const portrait = layout.sheetHcm >= layout.sheetWcm;
  return (
    <div className="id-sheet-wrap">
      <img
        className="id-sheet-img"
        src={dataUrl}
        alt="4x6 證件照排版預覽"
        style={portrait ? { height: '100%' } : { width: '100%' }}
      />
    </div>
  );
}
