import { useState, type FormEvent } from "react";
import { adminLogin, getErrorMessage } from "../api";
import type { AdminSession } from "../session";
import { Logo } from "../components/Logo";

export function Login({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!adminId.trim() || !password) {
      setError("管理者IDとパスワードを入力してください。");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await adminLogin(adminId.trim(), password);
      onLogin({ token: response.token, admin: response.admin });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-card__brand">
          <Logo size={32} />
        </div>
        <h1>管理者ログイン</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-form__field">
            <span>管理者ID</span>
            <input value={adminId} onChange={(event) => setAdminId(event.target.value)} autoComplete="username" />
          </label>
          <label className="login-form__field">
            <span>パスワード</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button type="button" className="login-form__link">
            パスワードを忘れた場合
          </button>
          {error ? <p className="login-form__error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary login-form__submit" disabled={submitting}>
            {submitting ? "確認中…" : "続ける"}
          </button>
        </form>
      </section>
      <footer className="login-footer">
        <a href="#">プライバシーポリシー</a>
        <a href="#">利用規約</a>
        <a href="#">会員規約</a>
      </footer>
    </main>
  );
}
