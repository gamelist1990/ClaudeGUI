import React, { useState, useRef, useEffect } from 'react';
import Button from '../ui/Button';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  mode?: string;
  thinkMode?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder,
  mode = 'normal',
  thinkMode = false,
}) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || isLoading) return;

    const messageToSend = message.trim();
    setMessage('');
    setIsLoading(true);

    try {
      await onSend(messageToSend);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isLoading && message.trim()) {
        handleSubmit(e);
      }
    }
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    
    const modeText = mode !== 'normal' ? ` • Mode: ${mode}` : '';
    const thinkText = thinkMode ? ' • Think ON' : '';
    return `Type your message${modeText}${thinkText}...`;
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <textarea
            ref={textareaRef}
            className="input textarea-auto"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={disabled || isLoading}
            rows={1}
            style={{
              minHeight: '44px',
              maxHeight: '200px',
              resize: 'none',
              overflow: 'hidden',
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)'
          }}>
            <span>
              Press Enter to send, Shift+Enter for new line
            </span>
            {(mode !== 'normal' || thinkMode) && (
              <span>
                {mode !== 'normal' && <span>Mode: {mode.toUpperCase()}</span>}
                {mode !== 'normal' && thinkMode && ' • '}
                {thinkMode && <span>Think: ON</span>}
              </span>
            )}
          </div>
        </div>
        
        <Button
          type="submit"
          variant="primary"
          disabled={!message.trim() || disabled}
          loading={isLoading}
          style={{ marginBottom: '22px' }} // Align with textarea bottom considering help text
        >
          {isLoading ? 'Sending...' : 'Send'}
        </Button>
      </form>
    </div>
  );
};

export default ChatInput;