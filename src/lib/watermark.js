// Render a tiled, rotated text watermark across the entire image and return
// a new JPEG data URL. The transform-then-tile-unrotated trick keeps the
// math simple: rotate the canvas around the centre, draw an oversized grid
// of axis-aligned text in the rotated frame, and the inverse rotation back
// to image space produces evenly-spaced rotated text covering all corners.

export const WATERMARK_DEFAULTS = {
  text: '僅供OOO使用',
  fontSize: 36,
  spacing: 160,
  opacity: 0.3,
  rotation: -28,
  color: '#888888'
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// scale is for preview rendering: pass < 1 to render against a downscaled
// canvas while keeping the watermark visually proportional.
export async function applyWatermark(srcDataUrl, config, scale = 1) {
  const img = await loadImage(srcDataUrl);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const text = config.text || '';
  if (!text.trim()) {
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  const fontSize = Math.max(8, config.fontSize * scale);
  const spacing = Math.max(20, config.spacing * scale);
  const opacity = Math.max(0, Math.min(1, config.opacity));
  const rotation = config.rotation || 0;
  const color = config.color || '#888888';

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.font = `${fontSize}px -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Spacing is the visible *gap* between text instances, not the period.
  // Step = text bounding box + user-specified gap, so long text never
  // overlaps regardless of font size.
  const textWidth = ctx.measureText(text).width;
  const stepX = Math.max(20, textWidth + spacing);
  const stepY = Math.max(20, fontSize + spacing);

  // grid extent — rotated rectangle still needs to cover the diagonal
  const diag = Math.sqrt(w * w + h * h);
  const half = diag / 2;
  for (let y = -half; y <= half; y += stepY) {
    for (let x = -half; x <= half; x += stepX) {
      ctx.fillText(text, x, y);
    }
  }

  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.92);
}
