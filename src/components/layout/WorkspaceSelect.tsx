import React from 'react';

interface Props {
  onSelect: (path: string) => void;
  onOpenPicker: () => Promise<void>;
  recent: string[];
}

const WorkspaceSelect: React.FC<Props> = ({ onSelect, onOpenPicker, recent }) => {
  return (
    <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', alignItems: 'center' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>Select a workspace</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>Pick a folder to use as the workspace. Claude CLI will be started in that directory.</p>

      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <button className="btn primary" onClick={onOpenPicker}>Choose folder</button>
      </div>

      {recent && recent.length > 0 && (
        <div style={{ marginTop: 'var(--space-6)', width: '100%', maxWidth: '800px' }}>
          <h3 style={{ marginBottom: 'var(--space-2)' }}>Recent workspaces</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {recent.map(p => (
              <div key={p} className="card" style={{ padding: 'var(--space-3)', cursor: 'pointer' }} onClick={() => onSelect(p)}>
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelect;
