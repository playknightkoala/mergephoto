import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KImage, Rect, Text, Group } from 'react-konva';
import useImage from 'use-image';
import { faceGuideBands } from '../lib/idPhotoSpecs.js';
import { cmToPx } from '../lib/idPhotoLayout.js';

// Display height of the crop frame on screen. The frame is FIXED at the spec's
// aspect ratio; the user zooms/pans the PHOTO inside it (this is the intuitive
// model the spec asked for — "讓使用者自行放大縮小相片"). Guide bands are
// painted on the fixed frame so the user lines the head up to them.
const FRAME_H = 460;

// Re-render the source with a 90°-aligned rotation and optional flips.
function transformImage(srcUrl, { rotation, flipH, flipV }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const swap = rotation === 90 || rotation === 270;
      const canvas = document.createElement('canvas');
      canvas.width = swap ? h : w;
      canvas.height = swap ? w : h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -w / 2, -h / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = reject;
    img.src = srcUrl;
  });
}

export default function IdPhotoCropModal({
  src,
  name,
  spec,
  queueIndex = 0,
  queueTotal = 1,
  onConfirm,
  onDiscardOne,
  onCancelAll
}) {
  const aspect = spec.widthCm / spec.heightCm;
  const FW = Math.round(FRAME_H * aspect);
  const FH = FRAME_H;
  const bands = faceGuideBands(spec);

  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [displaySrc, setDisplaySrc] = useState(src);
  const [img] = useImage(displaySrc);

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  // Vertical shift of the guide-band pair (px). The gap stays fixed (= the
  // 3.2–3.6 cm head-length rule); only its position in the frame moves, so
  // photos with little headroom above the hair can still be aligned.
  const [bandOffsetY, setBandOffsetY] = useState(0);

  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const guidesRef = useRef(null);
  const borderRef = useRef(null);

  // How far the band group may slide while staying fully inside the frame.
  const minOffY = bands ? -bands.headTop * FH : 0;
  const maxOffY = bands ? FH - bands.chinBottom * FH : 0;

  // Re-derive displaySrc on rotation / flip.
  useEffect(() => {
    let cancelled = false;
    if (rotation === 0 && !flipH && !flipV) {
      setDisplaySrc(src);
      return;
    }
    transformImage(src, { rotation, flipH, flipV }).then((url) => {
      if (!cancelled) setDisplaySrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [src, rotation, flipH, flipV]);

  // Reset orientation when the source photo changes (queue advance).
  useEffect(() => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setBandOffsetY(0);
  }, [src]);

  // Zoom limits, derived from the loaded image. Allow zooming out to fit the
  // whole image (white margins) so even a very tightly-shot head can be made
  // to fit the band gap, and well past "cover" for tight zoom-ins.
  const coverScale = img ? Math.max(FW / img.width, FH / img.height) : 1;
  const fitScale = img ? Math.min(FW / img.width, FH / img.height) : 1;
  const minScale = fitScale;
  const maxScale = coverScale * 4;

  const clampPos = useCallback(
    (p, s) => {
      if (!img) return p;
      const iw = img.width * s;
      const ih = img.height * s;
      const x = iw >= FW ? Math.min(0, Math.max(FW - iw, p.x)) : (FW - iw) / 2;
      const y = ih >= FH ? Math.min(0, Math.max(FH - ih, p.y)) : (FH - ih) / 2;
      return { x, y };
    },
    [img, FW, FH]
  );

  // On (re)load, reset the view to "cover" and centre.
  useEffect(() => {
    if (!img) return;
    const s = Math.max(FW / img.width, FH / img.height);
    setScale(s);
    setPos({ x: (FW - img.width * s) / 2, y: (FH - img.height * s) / 2 });
  }, [img, FW, FH]);

  // Zoom keeping a given anchor point (in frame coords) stationary.
  const zoomTo = useCallback(
    (newScale, anchor) => {
      const s = Math.max(minScale, Math.min(maxScale, newScale));
      const a = anchor || { x: FW / 2, y: FH / 2 };
      const imgPt = { x: (a.x - pos.x) / scale, y: (a.y - pos.y) / scale };
      const np = clampPos({ x: a.x - imgPt.x * s, y: a.y - imgPt.y * s }, s);
      setScale(s);
      setPos(np);
    },
    [scale, pos, minScale, maxScale, FW, FH, clampPos]
  );

  const handleWheel = useCallback(
    (e) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      const anchor = stage?.getPointerPosition() || { x: FW / 2, y: FH / 2 };
      const factor = e.evt.deltaY > 0 ? 0.92 : 1.08;
      zoomTo(scale * factor, anchor);
    },
    [zoomTo, scale, FW, FH]
  );

  const rotateBy = (delta) =>
    setRotation((r) => (((r + delta) % 360) + 360) % 360);

  // Zoom as a 0–100 slider over [minScale, maxScale] (log feels nicer).
  const zoomPct =
    maxScale > minScale
      ? Math.round(
          ((Math.log(scale) - Math.log(minScale)) /
            (Math.log(maxScale) - Math.log(minScale))) *
            100
        )
      : 0;
  const onZoomSlider = (pct) => {
    const t = pct / 100;
    const s = Math.exp(Math.log(minScale) + t * (Math.log(maxScale) - Math.log(minScale)));
    zoomTo(s, { x: FW / 2, y: FH / 2 });
  };

  const handleConfirm = () => {
    const stage = stageRef.current;
    if (!stage || !img) return;
    // Hide the guide overlay + frame border so they don't bleed into the crop.
    if (guidesRef.current) guidesRef.current.visible(false);
    if (borderRef.current) borderRef.current.visible(false);
    stage.draw();
    // Render at ~300 DPI for the spec's physical size.
    const pixelRatio = cmToPx(spec.heightCm) / FH;
    let url;
    try {
      url = stage.toDataURL({ mimeType: 'image/jpeg', quality: 0.95, pixelRatio });
    } finally {
      if (guidesRef.current) guidesRef.current.visible(true);
      if (borderRef.current) borderRef.current.visible(true);
      stage.draw();
    }
    onConfirm({ dataURL: url, name });
  };

  const isBatch = queueTotal > 1;

  const bandLabel = (text, topPx) => (
    <Text
      text={text}
      x={4}
      y={topPx + 2}
      fontSize={11}
      fill="#065f46"
      listening={false}
    />
  );

  return (
    <div className="modal-backdrop" onClick={onCancelAll}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          裁切證件照 · {spec.label} ({spec.sizeLabel})
          {isBatch && (
            <span style={{ marginLeft: 12, fontSize: 13, color: '#6b7280', fontWeight: 400 }}>
              {queueIndex + 1} / {queueTotal} · {name}
            </span>
          )}
        </div>
        <div className="modal-body">
          {bands ? (
            <div className="id-crop-hint">
              滾輪縮放、拖曳移動相片，使「頭頂」落在上方綠色區、「下顎」落在下方綠色區。
              綠色參考線可上下拖曳調整位置（兩線間距固定＝頂→下顎{' '}
              {spec.faceGuide.headChinMinCm}–{spec.faceGuide.headChinMaxCm} cm，
              臉部約佔 {spec.faceGuide.facePctMin}–{spec.faceGuide.facePctMax}%）。
            </div>
          ) : (
            <div className="id-crop-hint id-crop-hint-plain">
              滾輪縮放、拖曳移動相片，調整到滿意的構圖後按「裁切並加入」。
            </div>
          )}

          <div className="aspect-row">
            <span style={{ color: '#6b7280' }}>旋轉 / 翻轉：</span>
            <button onClick={() => rotateBy(-90)} title="逆時針 90°">↺ -90°</button>
            <button onClick={() => rotateBy(90)} title="順時針 90°">↻ +90°</button>
            <button className={flipH ? 'active' : ''} onClick={() => setFlipH((v) => !v)}>
              ⇆ 水平翻轉
            </button>
            <button className={flipV ? 'active' : ''} onClick={() => setFlipV((v) => !v)}>
              ⇅ 垂直翻轉
            </button>
          </div>

          <div className="id-crop-stage-wrap" style={{ width: FW, height: FH }}>
            <Stage ref={stageRef} width={FW} height={FH} onWheel={handleWheel}>
              <Layer>
                <Rect x={0} y={0} width={FW} height={FH} fill="#ffffff" listening={false} />
                {img && (
                  <KImage
                    ref={imgRef}
                    image={img}
                    x={pos.x}
                    y={pos.y}
                    scaleX={scale}
                    scaleY={scale}
                    width={img.width}
                    height={img.height}
                    draggable
                    dragBoundFunc={(p) => clampPos(p, scale)}
                    onDragEnd={(e) => setPos({ x: e.target.x(), y: e.target.y() })}
                  />
                )}
                {bands && (
                  <Group
                    ref={guidesRef}
                    y={bandOffsetY}
                    draggable
                    dragBoundFunc={(p) => ({
                      x: 0,
                      y: Math.max(minOffY, Math.min(maxOffY, p.y))
                    })}
                    onDragEnd={(e) => setBandOffsetY(e.target.y())}
                    onMouseEnter={() => {
                      const c = stageRef.current?.container();
                      if (c) c.style.cursor = 'ns-resize';
                    }}
                    onMouseLeave={() => {
                      const c = stageRef.current?.container();
                      if (c) c.style.cursor = 'default';
                    }}
                  >
                    <Rect
                      x={0}
                      y={bands.headTop * FH}
                      width={FW}
                      height={(bands.headBottom - bands.headTop) * FH}
                      fill="rgba(16,185,129,0.28)"
                      stroke="rgba(5,150,105,0.9)"
                      strokeWidth={1}
                    />
                    <Rect
                      x={0}
                      y={bands.chinTop * FH}
                      width={FW}
                      height={(bands.chinBottom - bands.chinTop) * FH}
                      fill="rgba(16,185,129,0.28)"
                      stroke="rgba(5,150,105,0.9)"
                      strokeWidth={1}
                    />
                    {bandLabel('頭頂', bands.headTop * FH)}
                    {bandLabel('下顎', bands.chinTop * FH)}
                  </Group>
                )}
                <Rect
                  ref={borderRef}
                  x={0.5}
                  y={0.5}
                  width={FW - 1}
                  height={FH - 1}
                  stroke="#9ca3af"
                  strokeWidth={1}
                  listening={false}
                />
              </Layer>
            </Stage>
          </div>

          <div className="id-zoom-row">
            <button onClick={() => zoomTo(scale * 0.9)} title="縮小">－</button>
            <input
              type="range"
              min={0}
              max={100}
              value={zoomPct}
              onChange={(e) => onZoomSlider(Number(e.target.value))}
            />
            <button onClick={() => zoomTo(scale * 1.1)} title="放大">＋</button>
            <button
              className="id-zoom-reset"
              onClick={() => img && zoomTo(coverScale, { x: FW / 2, y: FH / 2 })}
              title="重設縮放"
            >
              重設
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <div className="actions">
            {isBatch && (
              <button className="btn" onClick={onDiscardOne} title="不加入這張">
                跳過這張
              </button>
            )}
          </div>
          <div className="actions">
            <button className="btn btn-danger" onClick={onCancelAll}>
              {isBatch ? '取消全部' : '取消'}
            </button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={!img}>
              {isBatch && queueTotal - queueIndex - 1 > 0 ? '裁切並下一張' : '裁切並加入'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
