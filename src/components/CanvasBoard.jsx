import A4Canvas from './A4Canvas.jsx';

export default function CanvasBoard({
  canvases,
  workItems,
  selectedCanvasId,
  onSelectCanvas,
  onDeleteCanvas,
  onToggleOrientation,
  onDropOnCanvas,
  onUpdateItem,
  onRemoveItem,
  onReorderItem,
  registerStage
}) {
  if (canvases.length === 0) {
    return (
      <div className="canvas-area">
        <div className="canvas-area-empty">
          還沒有任何畫布
          <br />
          按上方「+ 新增畫布」開始拼貼
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-area">
      <div className="canvas-list">
        {canvases.map((canvas, idx) => (
          <A4Canvas
            key={canvas.id}
            index={idx}
            canvas={canvas}
            workItems={workItems}
            isSelected={canvas.id === selectedCanvasId}
            onSelect={() => onSelectCanvas(canvas.id)}
            onDelete={() => onDeleteCanvas(canvas.id)}
            onToggleOrientation={() => onToggleOrientation(canvas.id)}
            onDropOnCanvas={(workItemId, pos) =>
              onDropOnCanvas(canvas.id, workItemId, pos)
            }
            onUpdateItem={(itemId, patch) => onUpdateItem(canvas.id, itemId, patch)}
            onRemoveItem={(itemId) => onRemoveItem(canvas.id, itemId)}
            onReorderItem={(itemId, dir) => onReorderItem(canvas.id, itemId, dir)}
            registerStage={registerStage}
          />
        ))}
      </div>
    </div>
  );
}
