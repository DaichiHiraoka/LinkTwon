import { useState, type FormEvent } from "react";
import { BellIcon } from "../components/Icons";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { createNotification, getErrorMessage, getSupportTickets, updateSupportTicket } from "../api";
import { formatDateTime, padId } from "../format";
import type { ManagedUser, SupportTicket } from "../types";

type FeedbackSetter = (ok: boolean, message: string) => void;

export function NotificationsList({
  tickets,
  users,
  token,
  onReload,
  notify,
}: {
  tickets: SupportTicket[];
  users: ManagedUser[];
  token: string;
  onReload: () => Promise<void>;
  notify: FeedbackSetter;
}) {
  const [tab, setTab] = useState<"send" | "tickets">("send");
  const [target, setTarget] = useState<"all" | "user">("all");
  const [userId, setUserId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketEditing, setTicketEditing] = useState<SupportTicket | null>(null);
  const [savingTicket, setSavingTicket] = useState(false);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!title.trim() || !body.trim()) {
      notify(false, "タイトルと本文を入力してください。");
      return;
    }
    if (target === "user" && !userId) {
      notify(false, "対象ユーザーを選択してください。");
      return;
    }
    setSubmitting(true);
    try {
      const response = await createNotification(
        { user_id: target === "user" ? Number(userId) : undefined, title: title.trim(), body: body.trim() },
        token,
      );
      notify(true, `お知らせを配信しました (${response.delivered_count}件)`);
      setTitle("");
      setBody("");
      setUserId("");
      setTarget("all");
    } catch (error) {
      notify(false, getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTicket() {
    if (!ticketEditing) return;
    setSavingTicket(true);
    try {
      await updateSupportTicket(
        ticketEditing.ticket_id,
        { status: ticketEditing.status, admin_note: ticketEditing.admin_note ?? "" },
        token,
      );
      notify(true, "問い合わせを更新しました。");
      setTicketEditing(null);
      await onReload();
      await getSupportTickets(token).catch(() => {});
    } catch (error) {
      notify(false, getErrorMessage(error));
    } finally {
      setSavingTicket(false);
    }
  }

  const ticketColumns: Array<Column<SupportTicket>> = [
    { key: "id", label: "ID", render: (row) => padId(row.ticket_id), width: "80px" },
    { key: "kind", label: "種別", render: (row) => (row.category === "bug" ? "不具合" : "問い合わせ"), width: "100px" },
    { key: "subject", label: "件名", render: (row) => row.subject },
    { key: "from", label: "送信者", render: (row) => row.user_name ?? row.user_email ?? "-" },
    { key: "status", label: "状態", render: (row) => row.status, width: "120px" },
    { key: "date", label: "作成日", render: (row) => formatDateTime(row.created_at), width: "150px" },
  ];

  return (
    <section className="page">
      <header className="page__head">
        <h1 className="page__title">
          <BellIcon size={22} /> お知らせ管理
        </h1>
      </header>
      <div className="tabs">
        <button type="button" className={tab === "send" ? "tab tab--active" : "tab"} onClick={() => setTab("send")}>
          配信
        </button>
        <button type="button" className={tab === "tickets" ? "tab tab--active" : "tab"} onClick={() => setTab("tickets")}>
          問い合わせ ({tickets.length})
        </button>
      </div>

      {tab === "send" ? (
        <form className="form notification-form" onSubmit={handleSend}>
          <label className="form__field">
            <span>配信先</span>
            <select value={target} onChange={(event) => setTarget(event.target.value as "all" | "user")}>
              <option value="all">全ユーザー</option>
              <option value="user">特定ユーザー</option>
            </select>
          </label>
          {target === "user" ? (
            <label className="form__field">
              <span>対象ユーザー</span>
              <select value={userId} onChange={(event) => setUserId(event.target.value ? Number(event.target.value) : "")}>
                <option value="">選択</option>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="form__field">
            <span>タイトル</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="form__field">
            <span>本文</span>
            <textarea rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <div className="form__actions">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              配信する
            </button>
          </div>
        </form>
      ) : (
        <DataTable
          title="問い合わせ・不具合報告"
          rows={tickets}
          columns={ticketColumns}
          rowKey={(row) => row.ticket_id}
          rowActions={[{ kind: "view", onClick: (row) => setTicketEditing({ ...row }) }]}
        />
      )}

      <Modal open={!!ticketEditing} title={ticketEditing ? `問い合わせ #${padId(ticketEditing.ticket_id)}` : ""} size="lg" onClose={() => setTicketEditing(null)}>
        {ticketEditing ? (
          <div className="ticket-detail">
            <p>
              <strong>件名:</strong> {ticketEditing.subject}
            </p>
            <p>
              <strong>送信者:</strong> {ticketEditing.user_name ?? "-"} ({ticketEditing.user_email ?? "-"})
            </p>
            <p>
              <strong>本文:</strong>
            </p>
            <pre className="ticket-detail__body">{ticketEditing.body}</pre>
            <label className="form__field">
              <span>状態</span>
              <select
                value={ticketEditing.status}
                onChange={(event) => setTicketEditing({ ...ticketEditing, status: event.target.value as SupportTicket["status"] })}
              >
                <option value="open">open</option>
                <option value="in_progress">in_progress</option>
                <option value="resolved">resolved</option>
                <option value="closed">closed</option>
              </select>
            </label>
            <label className="form__field">
              <span>管理者メモ</span>
              <textarea
                rows={4}
                value={ticketEditing.admin_note ?? ""}
                onChange={(event) => setTicketEditing({ ...ticketEditing, admin_note: event.target.value })}
              />
            </label>
            <div className="form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setTicketEditing(null)}>
                キャンセル
              </button>
              <button type="button" className="btn btn--primary" onClick={saveTicket} disabled={savingTicket}>
                保存
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
