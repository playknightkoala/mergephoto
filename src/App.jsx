import { useState } from 'react';
import CollageApp from './CollageApp.jsx';
import IdPhotoStudio from './components/IdPhotoStudio.jsx';

const MODES = [
  { id: 'collage', label: '拼貼 A4' },
  { id: 'idphoto', label: '證件照' }
];

export default function App() {
  const [mode, setMode] = useState('collage');

  return (
    <div className="root-shell">
      <nav className="mode-tabs">
        <span className="mode-tabs-brand">合併相片</span>
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-tab ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </nav>
      <div className="mode-body">
        {mode === 'collage' ? <CollageApp /> : <IdPhotoStudio />}
      </div>
    </div>
  );
}
