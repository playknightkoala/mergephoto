// Taiwan ID-photo specifications.
//
// faceGuide (only for the 2吋 大頭照 used by 身分證/護照/健保卡/台胞證):
//   臉部需佔相片面積的 70–80%，頭頂到下顎長度需介於 3.2–3.6 cm。
// We surface this as reference bands in the crop UI so the user can scale/move
// their photo until the top of the head and the chin fall inside the bands.
export const ID_PHOTO_SPECS = [
  {
    id: 'tw-1in',
    label: '1吋',
    sizeLabel: '2.8 × 3.5 cm',
    widthCm: 2.8,
    heightCm: 3.5,
    uses: '國內駕照、體健表、身心障礙手冊',
    faceGuide: null
  },
  {
    id: 'tw-2in',
    label: '2吋大頭照',
    sizeLabel: '3.5 × 4.5 cm',
    widthCm: 3.5,
    heightCm: 4.5,
    uses: '身分證、護照、健保卡、台胞證',
    faceGuide: { headChinMinCm: 3.2, headChinMaxCm: 3.6, facePctMin: 70, facePctMax: 80 }
  },
  {
    id: 'tw-2in-large',
    label: '2吋（大）',
    sizeLabel: '4.2 × 4.7 cm',
    widthCm: 4.2,
    heightCm: 4.7,
    uses: '學生證、履歷表、國際駕照、證書執照',
    faceGuide: null
  }
];

export function getSpec(id) {
  return ID_PHOTO_SPECS.find((s) => s.id === id) || null;
}

// Vertical reference bands as fractions of the crop (frame) height. The head is
// centred in the frame, so the allowable top-margin ranges from
// (H - maxHead)/2 to (H - minHead)/2 — mirrored at the bottom for the chin.
// With these bands aligned, the 頂→下顎 length lands in [min,max] cm and the
// face area works out to roughly 70–80% of the photo height.
export function faceGuideBands(spec) {
  const g = spec?.faceGuide;
  if (!g) return null;
  const H = spec.heightCm;
  const marginMin = (H - g.headChinMaxCm) / 2; // smallest top margin → tallest head
  const marginMax = (H - g.headChinMinCm) / 2; // largest top margin → shortest head
  return {
    headTop: marginMin / H,
    headBottom: marginMax / H,
    chinTop: 1 - marginMax / H,
    chinBottom: 1 - marginMin / H
  };
}
