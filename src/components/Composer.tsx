import { useState } from 'react';

export default function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const snippets = ["Hello", "Summarize:", "Explain like I'm five:"];

  function insertSnippet(s: string) {
    setText((t) => (t ? t + '\n' + s : s));
  }

  return (
    <div className="composer">
      <textarea value={text} onChange={(e) => setText(e.currentTarget.value)} placeholder="Type your message..." />
      <div className="composer-actions">
        <div className="snippets">
          {snippets.map((s) => (
            <button key={s} onClick={() => insertSnippet(s)}>{s}</button>
          ))}
        </div>
        <div>
          <button onClick={() => { onSend(text); setText(''); }}>Send</button>
        </div>
      </div>
    </div>
  );
}
