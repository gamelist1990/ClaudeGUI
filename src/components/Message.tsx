// import React from 'react'; // 未使用のため削除
import { useState } from 'react';
import MarkdownView from './MarkdownView';

export default function Message({ m }: { m: { id: string; source: string; text: string } }) {
  const ts = new Date(Number(m.id.split('-')[0] || Date.now())).toLocaleTimeString();
  const isUser = m.source === 'user';
  const [copied, setCopied] = useState(false);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (e) {
      console.error('copy failed', e);
    }
  }

  return (
    <div className={`message ${m.source}`}>
      <div className="message-row">
        {!isUser && <div className="avatar">C</div>}
        <div>
          <div className="meta">{m.source} <span className="timestamp">{ts}</span></div>
          <div className={`bubble message-card ${m.source}`}>
            <div className="message-text"><MarkdownView source={m.text} /></div>
            <div className="message-actions">
              <button className={`msg-action-btn ${copied ? 'msg-action-copied' : ''}`} onClick={copyText}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
        </div>
        {isUser && <div className="avatar">You</div>}
      </div>
    </div>
  );
}
