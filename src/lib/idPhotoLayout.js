// Layout math for packing identical ID photos onto a 4×6 (10×15 cm) sheet.

export const CM_PER_INCH = 2.54;
export const EXPORT_DPI = 300;

// 4×6 photo paper. A 4×6 print is 4×6 INCHES = 10.16 × 15.24 cm, which at
// EXPORT_DPI (300) is exactly 1200 × 1800 px (so the sheet exports at
// 1800×1200 in landscape). The per-photo cells stay at their physical size,
// e.g. a 2吋大頭照 is cmToPx(3.5)×cmToPx(4.5) = 413 × 531 px.
export const SHEET = { widthCm: 10.16, heightCm: 15.24 };

// Small gap between photos so there is something to cut along.
export const GAP_CM = 0.1;

export function cmToPx(cm, dpi = EXPORT_DPI) {
  return Math.round((cm / CM_PER_INCH) * dpi);
}

// Find the grid that fits the most photos, trying both sheet orientations and
// rotating the photo 90°. Returns the densest candidate.
//   { sheetWcm, sheetHcm, cols, rows, count, cellWcm, cellHcm, rotated }
// cellW/cellH are the photo footprint on the sheet (already rotated if needed).
export function computeLayout(spec, gapCm = GAP_CM) {
  if (!spec) return null;
  const sheets = [
    { w: SHEET.widthCm, h: SHEET.heightCm },
    { w: SHEET.heightCm, h: SHEET.widthCm }
  ];
  let best = null;
  for (const sheet of sheets) {
    for (const rotated of [false, true]) {
      const pw = rotated ? spec.heightCm : spec.widthCm;
      const ph = rotated ? spec.widthCm : spec.heightCm;
      const cols = Math.floor((sheet.w + gapCm) / (pw + gapCm));
      const rows = Math.floor((sheet.h + gapCm) / (ph + gapCm));
      if (cols < 1 || rows < 1) continue;
      const count = cols * rows;
      // Prefer the most photos; on a tie prefer upright (non-rotated) photos
      // since they are more intuitive to cut.
      const better =
        !best ||
        count > best.count ||
        (count === best.count && best.rotated && !rotated);
      if (better) {
        best = {
          sheetWcm: sheet.w,
          sheetHcm: sheet.h,
          cols,
          rows,
          count,
          cellWcm: pw,
          cellHcm: ph,
          rotated
        };
      }
    }
  }
  return best;
}

// Distribute the distinct source photos across `count` cells, grouped and as
// evenly as possible. 1 source → all cells; 2 sources over 8 → 4+4; 3 over
// 8 → 3+3+2. Returns an array of length `count` holding source indices.
export function assignCells(sourceCount, count) {
  const cells = new Array(count).fill(null);
  if (sourceCount <= 0) return cells;
  const base = Math.floor(count / sourceCount);
  let extra = count - base * sourceCount;
  let cell = 0;
  for (let s = 0; s < sourceCount && cell < count; s++) {
    let n = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    for (let j = 0; j < n && cell < count; j++) cells[cell++] = s;
  }
  return cells;
}

// Human-readable "每種張數" breakdown, e.g. [4, 4] or [3, 3, 2].
export function perSourceCounts(sourceCount, count) {
  const cells = assignCells(sourceCount, count);
  const counts = new Array(sourceCount).fill(0);
  cells.forEach((s) => {
    if (s != null) counts[s]++;
  });
  return counts;
}
