import { useCallback, useRef } from 'react';
import { Image as KImage } from 'react-konva';
import useImage from 'use-image';

// Each photo on the canvas. Selection is governed entirely by the LayerPanel
// — clicking the image on the canvas does NOT select it. Only the currently
// selected image is draggable; everything else is inert visual content.
//
// We register the Konva node via a memoised ref callback (not useEffect) so
// the shared parent Transformer can find it synchronously during commit,
// regardless of effect timing or StrictMode double-firing.
export default function CanvasImage({
  item,
  workItem,
  isSelected,
  registerShape,
  onChange,
  onDragMove,
  onDragEnd
}) {
  const [img] = useImage(workItem.src);
  const shapeRef = useRef(null);

  const setShapeRef = useCallback(
    (node) => {
      shapeRef.current = node;
      registerShape(item.id, node);
    },
    [item.id, registerShape]
  );

  return (
    <KImage
      ref={setShapeRef}
      name={item.id}
      image={img}
      x={item.x}
      y={item.y}
      scaleX={item.scaleX}
      scaleY={item.scaleY}
      rotation={item.rotation}
      width={workItem.width}
      height={workItem.height}
      draggable={isSelected}
      onDragMove={() => onDragMove?.(item.id)}
      onDragEnd={(e) => {
        onDragEnd?.();
        onChange({ x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;
        onChange({
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation()
        });
      }}
    />
  );
}
