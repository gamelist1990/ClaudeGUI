import React, { useEffect, useRef, useState } from 'react';

type Mode = 'normal' | 'bypass' | 'yolo';

export default function Composer({ onSend, mode, thinkMode }: { onSend: (text: string) => void; mode?: Mode; thinkMode?: boolean }) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // snippets removed per user request

  useEffect(() => {
    autosize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function autosize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 160);
    el.style.height = `${newHeight}px`;
  }

  // insertSnippet removed

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter (no shift) OR Ctrl+Enter to send
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  return (
    <div className="composer-wrap">
      <div className="composer-input">
        <textarea
          ref={textareaRef}
          className="textarea-autosize"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Type your message. Mode: ${mode ?? 'normal'}${thinkMode ? ' · Think ON' : ''}. Enter to send, Shift+Enter for newline`}
        />
      </div>

      <div className="composer-actions">
        <div>
          <button className="btn btn--primary" disabled={!text.trim()} onClick={submit}>➡️ Send</button>
        </div>
      </div>
      <div className="composer-hint">Enter to send · Shift+Enter for newline · Ctrl+Enter to force send</div>
    </div>
  );
}
