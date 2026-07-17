import { useState, type FormEvent } from "react";
import { UserIcon } from "../components/Icons";
import { DataTable, type Column } from "../components/DataTable";
import { DeleteConfirmModal, Modal } from "../components/Modal";
import { getErrorMessage, getUser, updateUser } from "../api";
import { formatDate, formatDateTime, padId } from "../format";
import type { AdminUserDetail, ManagedUser } from "../types";

type FeedbackSetter = (ok: boolean, message: string) => void;

export function UsersList({
  users,
  token,
  onSearch,
  searchValue,
  onReload,
  notify,
}: {
  users: ManagedUser[];
  token: string;
  searchValue: string;
  onSearch: (value: string) => void;
  onReload: () => Promise<void>;
  notify: FeedbackSetter;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [editPoints, setEditPoints] = useState<number>(0);
  const [savingPoints, setSavingPoints] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function openDetail(user: ManagedUser) {
    try {
      const response = await getUser(user.user_id, token);
      setDetail(response);
      setEditPoints(response.user.points);
    } catch (error) {
      notify(false, getErrorMessage(error));
    }
  }

  async function savePoints() {
    if (!detail) return;
    setSavingPoints(true);
    try {
      await updateUser(detail.user.user_id, { points: editPoints }, token);
      notify(true, "ポイントを更新しました。");
      setDetail(null);
      await onReload();
    } catch (error) {
      notify(false, getErrorMessage(error));
    } finally {
      setSavingPoints(false);
    }
  }

  async function handleDelete() {
    if (!deleting || submitting) return;
    notify(false, "API 側で利用者削除エンドポイントは現在実装されていません。");
    setDeleting(null);
  }

  const columns: Array<Column<ManagedUser>> = [
    { key: "id", label: "ID", render: (row) => padId(row.user_id), width: "80px" },
    { key: "name", label: "氏名", render: (row) => row.name },
    { key: "email", label: "メールアドレス", render: (row) => row.email, width: "220px" },
    {
      key: "password",
      label: "パスワード",
      render: (row) => <SecretValue value={row.login_password_plaintext} />,
      width: "160px",
    },
    { key: "type", label: "ユーザー区分", render: (row) => row.user_type ?? "-", width: "140px" },
    {
      key: "email_verified",
      label: "メール認証",
      render: (row) => (row.email_verified_at ? formatDateTime(row.email_verified_at) : "未認証"),
      width: "160px",
    },
    { key: "registered", label: "登録日", render: (row) => formatDate(row.created_at), width: "120px" },
    { key: "points", label: "所持ポイント", render: (row) => `${row.points}pt`, width: "120px" },
  ];

  return (
    <section className="page">
      <DataTable
        title="利用者一覧"
        titleIcon={<UserIcon size={22} />}
        rows={users}
        columns={columns}
        rowKey={(row) => row.user_id}
        searchValue={searchValue}
        onSearch={onSearch}
        searchPlaceholder="氏名 / メール検索"
        rowActions={[
          { kind: "view", onClick: (row) => openDetail(row) },
          { kind: "edit", onClick: (row) => setEditing(row) },
          { kind: "delete", onClick: (row) => setDeleting(row) },
        ]}
      />

      <Modal open={!!detail} title="利用者詳細" size="lg" onClose={() => setDetail(null)}>
        {detail ? (
          <div className="user-detail">
            <div className="user-detail__head">
              <span>ID: {padId(detail.user.user_id)}</span>
              <span>登録日: {formatDate(detail.user.created_at)}</span>
            </div>
            <h3>{detail.user.name}</h3>
            <dl className="detail__list">
              <div>
                <dt>メール</dt>
                <dd>{detail.user.email}</dd>
              </div>
              <div>
                <dt>パスワード</dt>
                <dd>
                  <SecretValue value={detail.user.login_password_plaintext} />
                </dd>
              </div>
              <div>
                <dt>区分</dt>
                <dd>{detail.user.user_type ?? "-"}</dd>
              </div>
              <div>
                <dt>年代</dt>
                <dd>{detail.user.age_group ?? "-"}</dd>
              </div>
            </dl>
            <div className="user-detail__points">
              <label className="form__field">
                <span>所持ポイント</span>
                <input type="number" value={editPoints} onChange={(event) => setEditPoints(Number(event.target.value))} />
              </label>
              <button type="button" className="btn btn--primary" onClick={savePoints} disabled={savingPoints}>
                保存
              </button>
            </div>
            <h4>参加履歴 ({detail.participations.length})</h4>
            <ul className="mini-list">
              {detail.participations.map((entry) => (
                <li key={entry.participation_id}>
                  {formatDateTime(entry.completed_at || entry.applied_at)} — {entry.event_name} ({entry.status}, +{entry.granted_points}pt)
                </li>
              ))}
            </ul>
            <h4>ポイント取引 ({detail.transactions.length})</h4>
            <ul className="mini-list">
              {detail.transactions.map((entry) => (
                <li key={entry.transaction_id}>
                  {formatDateTime(entry.created_at)} — {entry.type === "grant" ? "+" : "-"}
                  {entry.points}pt {entry.service_name ?? entry.description ?? ""}
                </li>
              ))}
            </ul>
            <h4>購入履歴 ({detail.purchases.length})</h4>
            <ul className="mini-list">
              {detail.purchases.map((entry) => (
                <li key={entry.purchase_id}>
                  {formatDateTime(entry.created_at)} — {entry.points}pt / {entry.amount_yen}円 / {entry.status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>

      <UserEditModal
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSubmit={async (payload, userId) => {
          setSubmitting(true);
          try {
            await updateUser(userId, payload, token);
            notify(true, "利用者情報を更新しました。");
            setEditing(null);
            await onReload();
          } catch (error) {
            notify(false, getErrorMessage(error));
          } finally {
            setSubmitting(false);
          }
        }}
        submitting={submitting}
      />

      <DeleteConfirmModal
        open={!!deleting}
        targetLabel="利用者情報"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        submitting={submitting}
      />
    </section>
  );
}

function UserEditModal({
  open,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initial: ManagedUser | null;
  onClose: () => void;
  onSubmit: (payload: Partial<ManagedUser> & { password?: string }, userId: number) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [points, setPoints] = useState(initial?.points ?? 0);
  const [userType, setUserType] = useState(initial?.user_type ?? "");
  const [password, setPassword] = useState("");

  useResetForm(initial?.user_id ?? "new", () => {
    setName(initial?.name ?? "");
    setPoints(initial?.points ?? 0);
    setUserType(initial?.user_type ?? "");
    setPassword("");
  });

  async function handle(event: FormEvent) {
    event.preventDefault();
    if (!initial) return;
    await onSubmit(
      {
        name: name.trim(),
        points: Number(points),
        user_type: userType.trim() || null,
        ...(password.trim() ? { password: password.trim() } : {}),
      },
      initial.user_id,
    );
  }

  return (
    <Modal open={open} title="利用者編集" onClose={onClose}>
      <form className="form" onSubmit={handle}>
        <label className="form__field">
          <span>氏名</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="form__field">
          <span>所持ポイント</span>
          <input type="number" value={points} onChange={(event) => setPoints(Number(event.target.value))} />
        </label>
        <label className="form__field">
          <span>区分</span>
          <input value={userType} onChange={(event) => setUserType(event.target.value)} placeholder="general / resident / ..." />
        </label>
        <label className="form__field">
          <span>ログインパスワード</span>
          <input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="変更時のみ入力"
            minLength={8}
          />
        </label>
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { useEffect, useRef } from "react";
function useResetForm(key: string | number, reset: () => void) {
  const prev = useRef<string | number | null>(null);
  useEffect(() => {
    if (prev.current !== key) {
      reset();
      prev.current = key;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function SecretValue({ value }: { value?: string | null }) {
  const [visible, setVisible] = useState(false);

  if (!value) {
    return <span className="secret-value secret-value--empty">未記録</span>;
  }

  return (
    <button type="button" className="secret-value" onClick={() => setVisible((current) => !current)}>
      {visible ? value : "••••••••"}
    </button>
  );
}
