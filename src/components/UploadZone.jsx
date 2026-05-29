import { useRef } from 'react';

export default function UploadZone({ onFileSelected }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onFileSelected(files);
    e.target.value = ''; // allow re-selecting same file
  };

  return (
    <div className="upload-zone">
      <button
        className="upload-button"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        📷 上傳照片
        <div style={{ fontSize: 11, marginTop: 4, fontWeight: 400 }}>
          可一次選多張，會依序開啟裁切視窗
        </div>
      </button>
      <input
        ref={inputRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
      />
    </div>
  );
}
