import React from 'react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

interface Conversation {
  id: number;
  messages: any[];
}

interface SidebarProps {
  conversations: Conversation[];
  mode: string;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  onApplySettings: () => void;
  onStartStop: () => void;
  isRunning: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  mode,
  baseUrl,
  onBaseUrlChange,
  onApplySettings,
  onStartStop,
  isRunning,
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--font-weight-semibold)' }}>
            Conversations
          </h3>
          <Badge variant="primary">{mode.toUpperCase()}</Badge>
        </div>
        <p style={{ 
          margin: '4px 0 0', 
          fontSize: 'var(--text-xs)', 
          color: 'var(--color-text-muted)' 
        }}>
          New: Alt+M to cycle modes · Tab toggles Think
        </p>
      </div>
      
      <div className="sidebar-content">
        {conversations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {conversations.map((conv) => (
              <div key={conv.id} className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ 
                  fontSize: 'var(--text-sm)', 
                  fontWeight: 'var(--font-weight-medium)', 
                  marginBottom: 'var(--space-1)' 
                }}>
                  Conversation {conv.id}
                </div>
                <div style={{ 
                  fontSize: 'var(--text-xs)', 
                  color: 'var(--color-text-tertiary)' 
                }}>
                  {conv.messages.length} messages
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            color: 'var(--color-text-muted)', 
            fontSize: 'var(--text-sm)',
            padding: 'var(--space-8) 0'
          }}>
            No conversations yet
          </div>
        )}
      </div>
      
      <div className="sidebar-footer">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ 
            display: 'block', 
            fontSize: 'var(--text-sm)', 
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-2)' 
          }}>
            Anthropic Base URL
          </label>
          <input
            type="text"
            className="input"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="https://api.anthropic.com"
            style={{ fontSize: 'var(--text-sm)' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onApplySettings}
            style={{ flex: 1 }}
          >
            Save
          </Button>
          <Button
            variant={isRunning ? "danger" : "primary"}
            size="sm"
            onClick={onStartStop}
            style={{ flex: 1 }}
          >
            {isRunning ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;