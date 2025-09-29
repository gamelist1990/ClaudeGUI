// import React from 'react'; // 未使用のため削除
import MarkdownView from './MarkdownView';

export default function Message({ m }: { m: { id: string; source: string; text: string } }) {
  return (
    <div className={`message ${m.source}`}>
      <div className="meta">{m.source}</div>
      <div className="text"><MarkdownView source={m.text} /></div>
    </div>
  );
}
