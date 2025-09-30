import React, { useState, useEffect } from 'react';
import Button from './Button';
import Badge from './Badge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseUrl: string;
  onSave: (baseUrl: string) => void;
  yoloEnabled: boolean;
  onToggleYolo: (enabled: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  baseUrl,
  onSave,
  yoloEnabled,
  onToggleYolo,
}) => {
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);
  const [localYolo, setLocalYolo] = useState(yoloEnabled);
  const [localExecutable, setLocalExecutable] = useState<string>(() => {
    return localStorage.getItem('claude_executable') ?? '';
  });

  useEffect(() => {
    setLocalBaseUrl(baseUrl);
    setLocalYolo(yoloEnabled);
  }, [baseUrl, yoloEnabled, isOpen]);

  const handleSave = () => {
    onSave(localBaseUrl);
    onToggleYolo(localYolo);
    localStorage.setItem('claude_executable', localExecutable);
    onClose();
  };

  const handleCancel = () => {
    setLocalBaseUrl(baseUrl);
    setLocalYolo(yoloEnabled);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" style={{ width: '600px', maxWidth: '90vw' }}>
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            aria-label="Close settings"
          >
            ✕
          </Button>
        </div>
        
        <div className="modal-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* API Configuration */}
            <div>
              <h3 style={{ 
                margin: '0 0 var(--space-4) 0', 
                fontSize: 'var(--text-lg)', 
                fontWeight: 'var(--font-weight-semibold)' 
              }}>
                API Configuration
              </h3>
              
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
                  type="url"
                  className="input"
                  value={localBaseUrl}
                  onChange={(e) => setLocalBaseUrl(e.target.value)}
                  placeholder="https://api.anthropic.com"
                />
                <p style={{
                  margin: 'var(--space-2) 0 0',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)'
                }}>
                  Leave empty to use the default Anthropic API endpoint
                </p>
              </div>

              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Claude Executable Path
                </label>
                <input
                  type="text"
                  className="input"
                  value={localExecutable}
                  onChange={(e) => setLocalExecutable(e.target.value)}
                  placeholder="/usr/local/bin/claude or C:\\path\\to\\claude.exe"
                />
                <p style={{
                  margin: 'var(--space-2) 0 0',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)'
                }}>
                  空欄にするとシステムの PATH にある 'claude' コマンドを使います（グローバルにインストールされている場合は通常これで動作します）。
                  アプリはワークスペース選択時にそのフォルダへ移動（cd）してから Claude を起動します。
                  PATH にない環境や明示的に指定したい場合はフルパス（例: C:\\path\\to\\claude.exe）を入力してください。
                </p>
              </div>
            </div>

            {/* Mode Configuration */}
            <div>
              <h3 style={{ 
                margin: '0 0 var(--space-4) 0', 
                fontSize: 'var(--text-lg)', 
                fontWeight: 'var(--font-weight-semibold)' 
              }}>
                Operation Mode
              </h3>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-4)',
                background: localYolo ? 'var(--color-warning-light)' : 'var(--color-surface-secondary)',
                border: `1px solid ${localYolo ? 'var(--color-warning)' : 'var(--color-border-primary)'}`,
                borderRadius: 'var(--radius-lg)'
              }}>
                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)',
                    marginBottom: 'var(--space-1)' 
                  }}>
                    <span style={{ 
                      fontSize: 'var(--text-sm)', 
                      fontWeight: 'var(--font-weight-medium)' 
                    }}>
                      YOLO Mode
                    </span>
                    {localYolo && <Badge variant="warning">DANGEROUS</Badge>}
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)'
                  }}>
                    Passes --dangerously-skip-permissions flag to Claude CLI
                  </p>
                </div>
                
                <label style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '56px',
                  height: '28px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={localYolo}
                    onChange={(e) => setLocalYolo(e.target.checked)}
                    style={{ display: 'none' }}
                  />
                  <div
                    className={`theme-toggle ${localYolo ? 'active' : ''}`}
                    style={{
                      background: localYolo ? 'var(--color-warning)' : 'var(--color-surface-tertiary)',
                      borderColor: localYolo ? 'var(--color-warning)' : 'var(--color-border-secondary)'
                    }}
                  >
                    <div className="theme-toggle-handle">
                      {localYolo ? '⚠️' : '🛡️'}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div>
              <h3 style={{ 
                margin: '0 0 var(--space-4) 0', 
                fontSize: 'var(--text-lg)', 
                fontWeight: 'var(--font-weight-semibold)' 
              }}>
                Keyboard Shortcuts
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {[
                  { key: 'Tab', action: 'Toggle Think Mode' },
                  { key: 'Alt + M', action: 'Cycle Operation Modes' },
                  { key: 'Enter', action: 'Send Message' },
                  { key: 'Shift + Enter', action: 'New Line in Message' },
                ].map(({ key, action }) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 'var(--space-2) 0'
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-sm)' }}>{action}</span>
                    <Badge variant="secondary">{key}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;