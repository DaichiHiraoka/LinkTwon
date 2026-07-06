import { useState } from "react";
import { HelpIcon, SettingsIcon } from "./Icons";

export function TopBar({ onLogout }: { onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar__spacer" />
      <div className="topbar__actions">
        <button type="button" className="topbar__icon" aria-label="ヘルプ">
          <HelpIcon size={22} />
        </button>
        <div className="topbar__menu">
          <button type="button" className="topbar__icon" aria-label="設定" onClick={() => setMenuOpen((v) => !v)}>
            <SettingsIcon size={22} />
          </button>
          {menuOpen ? (
            <div className="topbar__dropdown" onMouseLeave={() => setMenuOpen(false)}>
              <button type="button" onClick={onLogout}>
                ログアウト
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
