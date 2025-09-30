import React, { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
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
  const [workspaces, setWorkspaces] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('workspaces') ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('workspaces', JSON.stringify(workspaces));
  }, [workspaces]);

  async function addWorkspace() {
    const selected = await open({ directory: true, multiple: false }) as string | string[] | null;
    if (!selected) return;
    const path = Array.isArray(selected) ? selected[0] : selected;
    setWorkspaces((s) => [path, ...s.filter(p => p !== path)].slice(0, 10));
  }

  async function openWorkspace(path: string) {
    // Set as most recent
    setWorkspaces((s) => [path, ...s.filter(p => p !== path)].slice(0, 10));
    // Notify user by appending a message via custom event on window
    window.dispatchEvent(new CustomEvent('workspace-opened', { detail: path }));
  }

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
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <strong style={{ fontSize: 'var(--text-sm)' }}>Workspaces</strong>
            <Button variant="primary" size="sm" onClick={addWorkspace}>Add</Button>
          </div>
          {workspaces.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>No workspaces</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {workspaces.map((w) => (
                <div key={w} className="card" style={{ padding: 'var(--space-2)', cursor: 'pointer' }} onClick={() => openWorkspace(w)}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)' }}>{w}</div>
                </div>
              ))}
            </div>
          )}
        </div>
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