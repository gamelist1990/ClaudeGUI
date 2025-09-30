import React from 'react';
// import { useTheme } from '../../contexts/ThemeContext'; // Not used directly in this component
import ThemeToggle from '../ui/ThemeToggle';
import Button from '../ui/Button';

interface HeaderProps {
  onNewSession: () => void;
  onSettings: () => void;
  thinkMode: boolean;
  onToggleThink: () => void;
  mode: string;
}

const Header: React.FC<HeaderProps> = ({
  onNewSession,
  onSettings,
  thinkMode,
  onToggleThink,
  // mode is passed but not used in this version - could be used for debugging or future features
}) => {
  return (
    <header className="header">
      <div className="header-brand">
        <h1 className="header-title">Claude GUI</h1>
        <p className="header-subtitle">軽量なGUIクライアント</p>
      </div>
      
      <div className="header-actions">
        <ThemeToggle />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleThink}
          aria-label={`思考モード${thinkMode ? 'オフ' : 'オン'}`}
        >
          {thinkMode ? '🤔 Think: ON' : '💡 Think: OFF'}
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={onNewSession}
          aria-label="新しいセッションを開始"
        >
          🔁 New Session
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onSettings}
          aria-label="設定を開く"
        >
          ⚙️
        </Button>
      </div>
    </header>
  );
};

export default Header;