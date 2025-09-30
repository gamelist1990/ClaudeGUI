import { useState } from 'react';

export default function Settings({ visible, onClose, baseUrl, onSave, yoloEnabled, onToggleYolo }:
  { visible: boolean; onClose: () => void; baseUrl: string; onSave: (url: string) => void; yoloEnabled: boolean; onToggleYolo: (v: boolean) => void }) {
  const [url, setUrl] = useState(baseUrl ?? '');
  const [yolo, setYolo] = useState(yoloEnabled ?? false);

  if (!visible) return null;

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(2,6,23,0.6)'}}>
      <div style={{width:600,background:'#06121a',padding:20,borderRadius:12,border:'1px solid rgba(255,255,255,0.04)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:18}}>Settings ⚙️</div>
          <button onClick={onClose}>Close</button>
        </div>

        <div style={{marginBottom:12}}>
          <label style={{display:'block',marginBottom:6}}>Anthropic Base URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} style={{width:'100%',padding:8,borderRadius:8,background:'transparent',border:'1px solid rgba(255,255,255,0.03)'}} />
        </div>

        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <label>Yolo Mode (dangerous)</label>
          <input type="checkbox" checked={yolo} onChange={(e)=>{ setYolo(e.target.checked); onToggleYolo(e.target.checked); }} />
        </div>

        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={() => { onSave(url); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
