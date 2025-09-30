import React from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
// import Badge from '../ui/Badge'; // Not used in this component
import Button from '../ui/Button';

interface Message {
  id: string;
  source: 'user' | 'claude' | 'stderr';
  text: string;
}

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  mode: string;
  thinkMode: boolean;
  onSaveConversation: () => void;
  onExportConversations: () => void;
  disabled?: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  onSendMessage,
  mode,
  thinkMode,
  onSaveConversation,
  onExportConversations,
  disabled,
}) => {
  return (
    <main className="main-content">
      {/* Warning for YOLO mode */}
      {mode === 'yolo' && (
        <div style={{
          padding: 'var(--space-3) var(--space-6)',
          background: 'var(--color-warning-light)',
          border: '1px solid var(--color-warning)',
          borderRadius: 'var(--radius-md)',
          margin: 'var(--space-4) var(--space-6) 0',
          color: 'var(--color-warning)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-weight-medium)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)'
        }}>
          ⚠️ YOLO Mode enabled: --dangerously-skip-permissions will be passed when starting Claude.
        </div>
      )}
      
      <div className="chat-container">
        <MessageList messages={messages} />
        
        <div style={{
          padding: 'var(--space-4) var(--space-6)',
          background: 'var(--color-surface-primary)',
          borderTop: '1px solid var(--color-border-primary)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-3)'
        }}>
          <div style={{ flex: 1 }}>
            <ChatInput
              onSend={onSendMessage}
              mode={mode}
              thinkMode={thinkMode}
              disabled={disabled}
            />
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: 'var(--space-2)',
            marginBottom: '22px' // Align with input bottom
          }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onSaveConversation}
              disabled={messages.length === 0}
              title="Save current conversation"
            >
              💾 Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportConversations}
              title="Export all conversations"
            >
              ⤓ Export
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ChatContainer;