import { useState, type FormEvent } from "react";
import { CalendarIcon } from "../components/Icons";
import { DataTable, type Column } from "../components/DataTable";
import { DeleteConfirmModal, Modal } from "../components/Modal";
import { createEvent, deleteEvent, getErrorMessage, getEventCheckInCode, updateEvent } from "../api";
import { formatDateTime, padId, toDateTimeLocal } from "../format";
import type { EventItem } from "../types";

type FeedbackSetter = (ok: boolean, message: string) => void;

export function EventsList({
  events,
  token,
  onReload,
  notify,
}: {
  events: EventItem[];
  token: string;
  onReload: () => Promise<void>;
  notify: FeedbackSetter;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [detail, setDetail] = useState<EventItem | null>(null);
  const [code, setCode] = useState<{ event_id: number; code: string; expires_at: string } | null>(null);
  const [deleting, setDeleting] = useState<EventItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = search.trim()
    ? events.filter((e) =>
        `${e.event_name} ${e.location ?? ""} ${e.event_id}`.toLowerCase().includes(search.toLowerCase()),
      )
    : events;

  const columns: Array<Column<EventItem>> = [
    { key: "id", label: "ID", render: (row) => padId(row.event_id), width: "80px" },
    { key: "date", label: "開催日", render: (row) => formatDateTime(row.event_datetime) },
    { key: "name", label: "イベント名", render: (row) => row.event_name },
    { key: "location", label: "場所", render: (row) => row.location ?? "-" },
    { key: "points", label: "付与ポイント", render: (row) => `${row.grant_points}pt`, width: "120px" },
    {
      key: "status",
      label: "状態",
      render: (row) => (
        <span className={`status-pill status-pill--${row.status ?? "active"}`}>
          {row.status === "paused" ? "停止中" : "公開中"}
        </span>
      ),
      width: "100px",
    },
  ];

  async function showCode(event: EventItem) {
    try {
      const response = await getEventCheckInCode(event.event_id, token);
      setCode({ event_id: response.event_id, code: response.check_in_code, expires_at: response.expires_at });
    } catch (error) {
      notify(false, getErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deleting || submitting) return;
    setSubmitting(true);
    try {
      await deleteEvent(deleting.event_id, token);
      notify(true, "イベントを削除しました。");
      setDeleting(null);
      await onReload();
    } catch (error) {
      notify(false, getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page">
      <DataTable
        title="イベント一覧"
        titleIcon={<CalendarIcon size={22} />}
        rows={filtered}
        columns={columns}
        rowKey={(row) => row.event_id}
        searchValue={search}
        onSearch={setSearch}
        addCta={{ label: "イベント追加", onClick: () => setAdding(true) }}
        rowActions={[
          { kind: "view", onClick: (row) => setDetail(row) },
          { kind: "edit", onClick: (row) => setEditing({ ...row, event_datetime: toDateTimeLocal(row.event_datetime) }) },
          { kind: "delete", onClick: (row) => setDeleting(row) },
        ]}
      />

      <Modal open={!!detail} title="イベント詳細" onClose={() => setDetail(null)}>
        {detail ? (
          <div className="detail">
            <div className="detail__meta">
              <span>ID: {padId(detail.event_id)}</span>
              <span>開催: {formatDateTime(detail.event_datetime)}</span>
              <span>場所: {detail.location ?? "-"}</span>
            </div>
            <h3 className="detail__title">{detail.event_name}</h3>
            <dl className="detail__list">
              <div>
                <dt>付与ポイント</dt>
                <dd>{detail.grant_points}pt</dd>
              </div>
              <div>
                <dt>状態</dt>
                <dd>{detail.status === "paused" ? "停止中" : "公開中"}</dd>
              </div>
            </dl>
            <div className="detail__actions">
              <button type="button" className="btn btn--ghost" onClick={() => showCode(detail)}>
                QR / Check-in code
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setEditing({ ...detail, event_datetime: toDateTimeLocal(detail.event_datetime) });
                  setDetail(null);
                }}
              >
                編集
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <EventFormModal
        open={adding || !!editing}
        initial={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSubmit={async (payload, eventId) => {
          setSubmitting(true);
          try {
            if (eventId) {
              await updateEvent(eventId, payload, token);
              notify(true, "イベントを更新しました。");
            } else {
              await createEvent(payload, token);
              notify(true, "イベントを作成しました。");
            }
            setAdding(false);
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
        targetLabel="イベント情報"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        submitting={submitting}
      />

      <Modal open={!!code} title="チェックインコード" onClose={() => setCode(null)}>
        {code ? (
          <div className="checkin-code">
            <p>下記コードを受付端末で読み取って利用してください。期限を過ぎると無効になります。</p>
            <code>{code.code}</code>
            <small>有効期限: {formatDateTime(code.expires_at)}</small>
            <button
              type="button"
              className="btn btn--primary"
              onClick={async () => {
                try {
                  const response = await getEventCheckInCode(code.event_id, token);
                  setCode({ event_id: response.event_id, code: response.check_in_code, expires_at: response.expires_at });
                  notify(true, "チェックインコードを再発行しました。");
                } catch (error) {
                  notify(false, getErrorMessage(error));
                }
              }}
            >
              再発行
            </button>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

type EventFormPayload = {
  event_name: string;
  event_datetime: string;
  location?: string;
  grant_points: number;
  status?: "active" | "paused";
};

function EventFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initial: EventItem | null;
  onClose: () => void;
  onSubmit: (payload: EventFormPayload, eventId?: number) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.event_name ?? "");
  const [datetime, setDatetime] = useState(initial?.event_datetime ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [points, setPoints] = useState(initial?.grant_points ?? 50);
  const [status, setStatus] = useState<"active" | "paused">(initial?.status ?? "active");

  // sync initial when changes
  const initialKey = initial ? initial.event_id : "new";
  useResetForm(initialKey, () => {
    setName(initial?.event_name ?? "");
    setDatetime(initial?.event_datetime ?? "");
    setLocation(initial?.location ?? "");
    setPoints(initial?.grant_points ?? 50);
    setStatus(initial?.status ?? "active");
  });

  async function handle(event: FormEvent) {
    event.preventDefault();
    await onSubmit(
      {
        event_name: name.trim(),
        event_datetime: datetime,
        location: location.trim() || undefined,
        grant_points: Number(points),
        status,
      },
      initial?.event_id,
    );
  }

  return (
    <Modal open={open} title={initial ? "イベント編集" : "イベント追加"} onClose={onClose}>
      <form className="form" onSubmit={handle}>
        <label className="form__field">
          <span>イベント名</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="form__field">
          <span>開催日時</span>
          <input type="datetime-local" value={datetime} onChange={(event) => setDatetime(event.target.value)} required />
        </label>
        <label className="form__field">
          <span>場所</span>
          <input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label className="form__field">
          <span>付与ポイント</span>
          <input type="number" min={0} value={points} onChange={(event) => setPoints(Number(event.target.value))} required />
        </label>
        <label className="form__field">
          <span>状態</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "paused")}>
            <option value="active">公開</option>
            <option value="paused">停止</option>
          </select>
        </label>
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {initial ? "保存" : "作成"}
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
