import jsPDF from 'jspdf';
import { applyImageAdjustments } from './imageAdjustments.js';

// A4 in points (jsPDF default unit): 595.28 x 841.89
const A4_PT = { width: 595.28, height: 841.89 };

// Render Konva stages to a multi-page PDF.
// canvases: [{ id, orientation, items }]
// stageRefs: { [canvasId]: Konva.Stage }
// adjustments: { brightness, contrast, saturation } in percent
//
// We render each stage at pixelRatio=4, giving roughly 300 DPI output
// (since the on-screen stage is at 72 DPI / A4 pt size).
export async function exportCanvasesToPdf(canvases, stageRefs, adjustments) {
  if (canvases.length === 0) return;

  // Initialize with first canvas's orientation
  const first = canvases[0];
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: first.orientation === 'landscape' ? 'landscape' : 'portrait',
    compress: true
  });

  for (let i = 0; i < canvases.length; i++) {
    const c = canvases[i];
    const stage = stageRefs[c.id];
    if (!stage) continue;

    if (i > 0) {
      pdf.addPage(
        'a4',
        c.orientation === 'landscape' ? 'landscape' : 'portrait'
      );
    }

    // Hide the selection Transformer (and any of its handles) while we
    // snapshot the stage, otherwise the resize/rotate UI bleeds into the PDF.
    const transformers = stage.find('Transformer');
    transformers.forEach((t) => t.visible(false));
    stage.draw();

    let dataUrl;
    try {
      dataUrl = stage.toDataURL({
        mimeType: 'image/jpeg',
        quality: 0.95,
        pixelRatio: 4
      });
    } finally {
      transformers.forEach((t) => t.visible(true));
      stage.draw();
    }

    // Tonal adjustments (brightness/contrast/saturation) — used to compensate
    // for P3→sRGB darkening on iPhone photos. No-op when settings are 100%.
    dataUrl = await applyImageAdjustments(dataUrl, adjustments);

    const pageW = c.orientation === 'landscape' ? A4_PT.height : A4_PT.width;
    const pageH = c.orientation === 'landscape' ? A4_PT.width : A4_PT.height;

    pdf.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
  }

  const filename = `mergephoto-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}
