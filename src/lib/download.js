// Trigger a browser download for a data/object URL. Shared by the work-item
// library and the ID-photo sheet export.
export function triggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
