import { useEffect, useRef, useState, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';

// Re-render the source image into a new dataURL with the given
// 90°-aligned rotation and optional horizontal/vertical flips.
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

const ASPECTS = [
  { label: '自由', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:2', value: 3 / 2 }
];

export default function CropModal({
  src,
  name,
  queueIndex = 0,
  queueTotal = 1,
  onConfirm,
  onSkipCropOne,
  onDiscardOne,
  onSkipAllRemaining,
  onCancelAll
}) {
  const imgRef = useRef(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [aspect, setAspect] = useState(undefined);
  const [rotation, setRotation] = useState(0); // 0 / 90 / 180 / 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [displaySrc, setDisplaySrc] = useState(src);

  // re-derive displaySrc whenever rotation / flip changes
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

  // reset transform/crop when the source photo changes (queue advance)
  useEffect(() => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCrop(undefined);
    setCompletedCrop(null);
  }, [src]);

  const rotateBy = (delta) =>
    setRotation((r) => (((r + delta) % 360) + 360) % 360);

  const onImageLoad = useCallback(
    (e) => {
      const { width, height } = e.currentTarget;
      const initial = aspect
        ? centerCrop(
            makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
            width,
            height
          )
        : { unit: '%', x: 5, y: 5, width: 90, height: 90 };
      setCrop(initial);
    },
    [aspect]
  );

  const handleAspectChange = (next) => {
    setAspect(next);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      if (next) {
        setCrop(
          centerCrop(
            makeAspectCrop({ unit: '%', width: 90 }, next, width, height),
            width,
            height
          )
        );
      } else {
        setCrop({ unit: '%', x: 5, y: 5, width: 90, height: 90 });
      }
    }
  };

  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img || !completedCrop) return;

    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const cx = completedCrop.x * scaleX;
    const cy = completedCrop.y * scaleY;
    const cw = completedCrop.width * scaleX;
    const ch = completedCrop.height * scaleY;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cw);
    canvas.height = Math.round(ch);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onConfirm({ src: dataUrl, width: canvas.width, height: canvas.height, name });
  };

  const isBatch = queueTotal > 1;
  const remaining = queueTotal - queueIndex - 1;

  return (
    <div className="modal-backdrop" onClick={onCancelAll}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          裁切照片
          {isBatch && (
            <span
              style={{
                marginLeft: 12,
                fontSize: 13,
                color: '#6b7280',
                fontWeight: 400
              }}
            >
              {queueIndex + 1} / {queueTotal} · {name}
            </span>
          )}
        </div>
        <div className="modal-body">
          <div className="aspect-row">
            <span style={{ color: '#6b7280' }}>裁切比例：</span>
            {ASPECTS.map((a) => (
              <button
                key={a.label}
                className={aspect === a.value ? 'active' : ''}
                onClick={() => handleAspectChange(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="aspect-row">
            <span style={{ color: '#6b7280' }}>旋轉 / 翻轉：</span>
            <button onClick={() => rotateBy(-90)} title="逆時針 90°">
              ↺ -90°
            </button>
            <button onClick={() => rotateBy(90)} title="順時針 90°">
              ↻ +90°
            </button>
            <button
              className={flipH ? 'active' : ''}
              onClick={() => setFlipH((v) => !v)}
              title="水平翻轉"
            >
              ⇆ 水平翻轉
            </button>
            <button
              className={flipV ? 'active' : ''}
              onClick={() => setFlipV((v) => !v)}
              title="垂直翻轉"
            >
              ⇅ 垂直翻轉
            </button>
            {(rotation !== 0 || flipH || flipV) && (
              <button
                onClick={() => {
                  setRotation(0);
                  setFlipH(false);
                  setFlipV(false);
                }}
                title="還原"
              >
                還原
              </button>
            )}
          </div>
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            keepSelection
          >
            <img
              ref={imgRef}
              src={displaySrc}
              alt="待裁切"
              onLoad={onImageLoad}
              style={{ maxHeight: '60vh' }}
            />
          </ReactCrop>
        </div>
        <div className="modal-footer">
          <div className="actions">
            <button className="btn" onClick={onSkipCropOne}>
              不裁切，直接加入
            </button>
            {isBatch && (
              <button className="btn" onClick={onDiscardOne} title="不加入這張">
                跳過這張
              </button>
            )}
          </div>
          <div className="actions">
            {isBatch && remaining > 0 && (
              <button
                className="btn"
                onClick={onSkipAllRemaining}
                title={`剩下 ${remaining} 張全部不裁切直接加入`}
              >
                剩下 {remaining} 張全部不裁切
              </button>
            )}
            <button className="btn btn-danger" onClick={onCancelAll}>
              {isBatch ? '取消全部' : '取消'}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={!completedCrop}
            >
              {isBatch && remaining > 0 ? '裁切並下一張' : '裁切並加入'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
