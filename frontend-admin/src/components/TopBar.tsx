import { useState } from "react";
import { HelpIcon, SettingsIcon } from "./Icons";
import type { SystemConnection } from "../types";

export function TopBar({
  onLogout,
  connection,
  connectionStatus,
  apiTarget,
  onRefresh,
}: {
  onLogout: () => void;
  connection: SystemConnection | null;
  connectionStatus: "checking" | "connected" | "error";
  apiTarget: string;
  onRefresh: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const connectionText =
    connectionStatus === "checking"
      ? "DB接続を確認中"
      : connectionStatus === "connected" && connection
        ? `DB接続済み: ${connection.db_client} / ${connection.database}`
        : "DBに接続できません";

  return (
    <header className="topbar">
      <button
        type="button"
        className={`topbar__connection topbar__connection--${connectionStatus}`}
        onClick={onRefresh}
        title={`API接続先: ${apiTarget}`}
        aria-live="polite"
      >
        <span className="topbar__connection-dot" aria-hidden="true" />
        <span>{connectionText}</span>
        <small>再取得</small>
      </button>
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
