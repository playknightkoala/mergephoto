// Post-export tonal adjustment. Used to compensate for the P3→sRGB darkening
// that affects iPhone photos exported through canvas + JPEG. Implemented via
// `ctx.filter`, which is supported in all modern browsers.

export const ADJUSTMENT_DEFAULTS = {
  brightness: 100,
  contrast: 100,
  saturation: 100
};

export function isAdjustmentNoop(adj) {
  return (
    (adj?.brightness ?? 100) === 100 &&
    (adj?.contrast ?? 100) === 100 &&
    (adj?.saturation ?? 100) === 100
  );
}

export async function applyImageAdjustments(dataUrl, adj) {
  if (!adj || isAdjustmentNoop(adj)) return dataUrl;

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.95);
}
