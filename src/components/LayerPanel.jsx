// Photoshop-style layer panel. Rendered to the right of each A4 canvas.
// The list shows top-of-stack at the top (reverse of canvas.items, which
// stores back→front). Clicking a row is the canonical way to select an
// item — bypasses any Konva hit-detection quirks on the canvas itself.

export default function LayerPanel({
  items,
  workItems,
  selectedItemId,
  onSelect,
  onRemove,
  onReorder
}) {
  const total = items.length;
  const reversed = [...items].map((it, i) => ({ it, originalIndex: i })).reverse();

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <span>圖層</span>
        <span className="layer-panel-count">{total}</span>
      </div>

      <div className="layer-panel-list">
        {total === 0 && (
          <div className="layer-panel-empty">
            從左側拖入照片
            <br />
            或按「加入畫布」
          </div>
        )}
        {reversed.map(({ it: item, originalIndex }) => {
          const wi = workItems.find((w) => w.id === item.workItemId);
          const isSel = item.id === selectedItemId;
          return (
            <div
              key={item.id}
              className={`layer-row ${isSel ? 'selected' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <div className="layer-thumb">
                {wi && <img src={wi.src} alt="" draggable={false} />}
              </div>
              <span className="layer-name">圖層 {originalIndex + 1}</span>
              <button
                className="layer-row-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                title="刪除這張照片"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {selectedItemId && (
        <div className="layer-panel-footer">
          <button
            onClick={() => onReorder(selectedItemId, 'top')}
            title="移到最上層"
          >
            ⤒
          </button>
          <button
            onClick={() => onReorder(selectedItemId, 'up')}
            title="上一層"
          >
            ↑
          </button>
          <button
            onClick={() => onReorder(selectedItemId, 'down')}
            title="下一層"
          >
            ↓
          </button>
          <button
            onClick={() => onReorder(selectedItemId, 'bottom')}
            title="移到最下層"
          >
            ⤓
          </button>
        </div>
      )}
    </div>
  );
}
