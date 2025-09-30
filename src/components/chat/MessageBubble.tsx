import React, { useState } from 'react';
import MarkdownView from '../MarkdownView';

interface Message {
  id: string;
  source: 'user' | 'claude' | 'stderr';
  text: string;
}

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const getMessageType = () => {
    switch (message.source) {
      case 'user':
        return 'user';
      case 'claude':
        return 'assistant';
      case 'stderr':
        return 'system';
      default:
        return 'assistant';
    }
  };

  const getTimestamp = () => {
    try {
      const timestamp = Number(message.id.split('-')[0]) || Date.now();
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return new Date().toLocaleTimeString();
    }
  };

  const messageType = getMessageType();
  const timestamp = getTimestamp();

  return (
    <div className={`message message-${messageType}`}>
      <div className="message-meta">
        {message.source} • {timestamp}
      </div>
      
      <div className={`message-bubble message-bubble-${messageType}`}>
        <div className="message-content">
          <MarkdownView source={message.text} />
        </div>
        
        <div className="message-actions">
          <button
            className="message-action-btn"
            onClick={handleCopy}
            title="Copy message"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;