export default function WorkList({
  items,
  onDelete,
  onAddToCanvas,
  onEditWatermark,
  hasSelectedCanvas
}) {
  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('application/x-workitem-id', item.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const buildDownloadName = (item, index) => {
    let filename = item.name || `photo-${index + 1}.jpg`;
    filename = filename.replace(/.*[\\/]/, '');
    if (!/\.(jpe?g|png|webp)$/i.test(filename)) {
      filename = (filename.replace(/\.[^.]+$/, '') || filename) + '.jpg';
    } else {
      filename = filename.replace(/\.(png|webp)$/i, '.jpg');
    }
    return filename;
  };

  const triggerDownload = (href, filename) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownload = (item) => {
    triggerDownload(item.src, buildDownloadName(item, 0));
  };

  const handleDownloadAll = async () => {
    // Browsers throttle/dedupe simultaneous downloads from the same gesture;
    // a small delay keeps each one as a separate save dialog/file.
    // Track filenames to avoid collisions when users uploaded duplicates.
    const used = new Set();
    for (let i = 0; i < items.length; i++) {
      let name = buildDownloadName(items[i], i);
      if (used.has(name)) {
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        name = `${stem}-${i + 1}${ext}`;
      }
      used.add(name);
      triggerDownload(items[i].src, name);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 150));
    }
  };

  if (items.length === 0) {
    return (
      <div className="work-list">
        <div className="work-list-empty">
          素材庫是空的
          <br />
          點上方按鈕上傳照片
        </div>
      </div>
    );
  }

  return (
    <div className="work-list">
      <div className="work-list-toolbar">
        <span className="work-list-count">素材 {items.length} 張</span>
        <button
          className="work-list-download-all"
          onClick={handleDownloadAll}
          title="把素材庫所有照片下載到本機"
        >
          ⬇ 下載全部
        </button>
      </div>
      <div className="work-list-grid">
        {items.map((item) => (
          <div
            key={item.id}
            className="work-item"
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            title={hasSelectedCanvas ? '點擊加入畫布，或拖到畫布' : '拖到畫布'}
          >
            <img src={item.src} alt={item.name} />
            {item.watermark && <span className="watermark-badge" title="已套用浮水印">水印</span>}
            <button
              className="watermark-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEditWatermark(item.id);
              }}
              title={item.watermark ? '編輯浮水印' : '加入浮水印'}
            >
              ⌘
            </button>
            <button
              className="download-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(item);
              }}
              title="下載這張裁切後的照片"
            >
              ⬇
            </button>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="刪除"
            >
              ×
            </button>
            <button
              className="add-btn"
              onClick={() => onAddToCanvas(item.id)}
              title="加入目前畫布"
            >
              加入畫布
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
