// A4 in points (1pt = 1/72 inch). 595.28 x 841.89 — rounded to whole pixels
// for the on-screen Konva stage so we don't get sub-pixel placement.
export function getCanvasDimensions(orientation) {
  return orientation === 'portrait'
    ? { width: 595, height: 842 }
    : { width: 842, height: 595 };
}
