// import React from 'react'; // 未使用のため削除
import rehypeSanitize from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';
import ReactMarkdown from 'react-markdown';

export default function MarkdownView({ source }: { source: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>{source}</ReactMarkdown>
    </div>
  );
}
