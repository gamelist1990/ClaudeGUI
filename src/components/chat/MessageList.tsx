import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

interface Message {
  id: string;
  source: 'user' | 'claude' | 'stderr';
  text: string;
}

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="chat-messages">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          gap: 'var(--space-4)'
        }}>
          <div style={{ fontSize: '48px', opacity: 0.3 }}>💬</div>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: 'var(--text-lg)', 
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)'
            }}>
              Start a conversation
            </h3>
            <p style={{ 
              margin: 'var(--space-2) 0 0', 
              fontSize: 'var(--text-sm)' 
            }}>
              Type a message below to begin chatting with Claude
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-messages" ref={messagesContainerRef}>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;