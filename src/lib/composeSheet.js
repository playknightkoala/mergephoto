import { cmToPx, assignCells } from './idPhotoLayout.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Render the full-resolution (300 DPI) 4×6 sheet onto an offscreen canvas.
//   sources: [{ id, dataURL }]   (all cropped to the spec's aspect ratio)
//   layout:  result of computeLayout()
// Each photo's aspect already matches its cell, so a rotated layout just draws
// the image turned 90° — no cropping or distortion. Returns an HTMLCanvasElement.
export async function composeSheet(sources, layout, { showCutLines = true } = {}) {
  const sheetW = cmToPx(layout.sheetWcm);
  const sheetH = cmToPx(layout.sheetHcm);
  const cellW = cmToPx(layout.cellWcm);
  const cellH = cmToPx(layout.cellHcm);
  const gapPx = cmToPx(0.1);

  const canvas = document.createElement('canvas');
  canvas.width = sheetW;
  canvas.height = sheetH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheetW, sheetH);

  if (sources.length === 0) return canvas;

  const images = await Promise.all(sources.map((s) => loadImage(s.dataURL)));
  const cells = assignCells(sources.length, layout.count);

  // Centre the grid on the sheet.
  const gridW = layout.cols * cellW + (layout.cols - 1) * gapPx;
  const gridH = layout.rows * cellH + (layout.rows - 1) * gapPx;
  const offsetX = Math.round((sheetW - gridW) / 2);
  const offsetY = Math.round((sheetH - gridH) / 2);

  for (let i = 0; i < layout.count; i++) {
    const srcIdx = cells[i];
    if (srcIdx == null) continue;
    const img = images[srcIdx];
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    const x = offsetX + col * (cellW + gapPx);
    const y = offsetY + row * (cellH + gapPx);

    if (layout.rotated) {
      // Photo is upright (portrait); cell is landscape. Turn it 90°.
      ctx.save();
      ctx.translate(x + cellW / 2, y + cellH / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -cellH / 2, -cellW / 2, cellH, cellW);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, cellW, cellH);
    }

    if (showCutLines) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(1, cmToPx(0.01));
      ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
    }
  }

  return canvas;
}

// Compose then export. format: 'jpg' | 'png'. Returns a data URL.
export async function composeSheetDataUrl(sources, layout, opts, format) {
  const canvas = await composeSheet(sources, layout, opts);
  return format === 'png'
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', 0.95);
}
