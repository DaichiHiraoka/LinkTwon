import { useState, type FormEvent } from "react";
import { CalendarIcon } from "../components/Icons";
import { DataTable, type Column } from "../components/DataTable";
import { DeleteConfirmModal, Modal } from "../components/Modal";
import {
  approveEventSubmission,
  closeEvent,
  completeParticipation,
  createEvent,
  deleteEvent,
  getErrorMessage,
  getEventParticipations,
  rejectEventSubmission,
  updateEvent,
} from "../api";
import { formatDateTime, padId, toDateTimeLocal } from "../format";
import type { EventItem, EventParticipation, EventSubmission } from "../types";

type FeedbackSetter = (ok: boolean, message: string) => void;

export function EventsList({
  events,
  submissions,
  token,
  onReload,
  notify,
}: {
  events: EventItem[];
  submissions: EventSubmission[];
  token: string;
  onReload: () => Promise<void>;
  notify: FeedbackSetter;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"published" | "submissions">("published");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [detail, setDetail] = useState<EventItem | null>(null);
  const [eventParticipations, setEventParticipations] = useState<EventParticipation[]>([]);
  const [deleting, setDeleting] = useState<EventItem | null>(null);
  const [reviewing, setReviewing] = useState<{ submission: EventSubmission; approved: boolean } | null>(null);
  const [reviewPoints, setReviewPoints] = useState(0);
  const [reviewNote, setReviewNote] = useState("");
  const [correcting, setCorrecting] = useState<EventParticipation | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [closing, setClosing] = useState<EventItem | null>(null);
  const [closeReason, setCloseReason] = useState("");
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

  async function showDetail(event: EventItem) {
    setDetail(event);
    try {
      setEventParticipations(await getEventParticipations(event.event_id, token));
    } catch (error) {
      notify(false, getErrorMessage(error));
    }
  }

  function openReview(submission: EventSubmission, approved: boolean) {
    setReviewing({ submission, approved });
    setReviewPoints(submission.requested_grant_points);
    setReviewNote(submission.review_note || "");
  }

  async function submitReview() {
    if (!reviewing || submitting || (!reviewing.approved && !reviewNote.trim())) return;
    setSubmitting(true);
    try {
      if (reviewing.approved) {
        await approveEventSubmission(
          reviewing.submission.submission_id,
          { grant_points: reviewPoints, review_note: reviewNote },
          token,
        );
        notify(true, "イベント申請を承認しました。");
      } else {
        await rejectEventSubmission(reviewing.submission.submission_id, reviewNote, token);
        notify(true, "イベント申請を却下しました。");
      }
      setReviewing(null);
      await onReload();
    } catch (error) {
      notify(false, getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCorrection() {
    if (!correcting || !detail || submitting || !correctionReason.trim()) return;
    setSubmitting(true);
    try {
      await completeParticipation(correcting.participation_id, correctionReason, token);
      notify(true, "参加完了へ補正しました。");
      setCorrecting(null);
      setCorrectionReason("");
      await showDetail(detail);
      await onReload();
    } catch (error) {
      notify(false, getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitClose() {
    if (!closing || submitting) return;
    setSubmitting(true);
    try {
      await closeEvent(closing.event_id, token, closeReason.trim() || "管理画面から受付終了");
      notify(true, "イベントを終了しました。");
      setClosing(null);
      setCloseReason("");
      setDetail(null);
      await onReload();
    } catch (error) {
      notify(false, getErrorMessage(error));
    } finally {
      setSubmitting(false);
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
      <div className="detail__actions">
        <button className={`btn ${view === "published" ? "btn--primary" : "btn--ghost"}`} onClick={() => setView("published")}>
          公開イベント
        </button>
        <button className={`btn ${view === "submissions" ? "btn--primary" : "btn--ghost"}`} onClick={() => setView("submissions")}>
          承認待ち申請 ({submissions.filter((item) => item.status === "pending").length})
        </button>
      </div>
      {view === "published" ? <DataTable
        title="イベント一覧"
        titleIcon={<CalendarIcon size={22} />}
        rows={filtered}
        columns={columns}
        rowKey={(row) => row.event_id}
        searchValue={search}
        onSearch={setSearch}
        addCta={{ label: "イベント追加", onClick: () => setAdding(true) }}
        rowActions={[
          { kind: "view", onClick: (row) => void showDetail(row) },
          {
            kind: "edit",
            onClick: (row) =>
              setEditing({
                ...row,
                event_datetime: toDateTimeLocal(row.event_datetime),
                event_end_datetime: row.event_end_datetime ? toDateTimeLocal(row.event_end_datetime) : "",
              }),
          },
          { kind: "delete", onClick: (row) => setDeleting(row) },
        ]}
      /> : (
        <div className="event-list">
          {submissions.map((submission) => (
            <article className="detail" key={submission.submission_id}>
              <div className="detail__meta">
                <span>{submission.organizer_name}</span>
                <span>{formatDateTime(submission.event_datetime)} ～ {formatDateTime(submission.event_end_datetime)}</span>
                <span className={`status-pill status-pill--${submission.status}`}>{submission.status}</span>
              </div>
              <h3>{submission.event_name}</h3>
              <p>{submission.location || "-"} · 希望 {submission.requested_grant_points}pt</p>
              {submission.description ? <p>{submission.description}</p> : null}
              {submission.review_note ? <p>審査メモ: {submission.review_note}</p> : null}
              {submission.status === "pending" ? (
                <div className="detail__actions">
                  <button className="btn btn--primary" onClick={() => openReview(submission, true)}>承認</button>
                  <button className="btn btn--danger" onClick={() => openReview(submission, false)}>却下</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Modal open={!!detail} title="イベント詳細" onClose={() => setDetail(null)}>
        {detail ? (
          <div className="detail">
            <div className="detail__meta">
              <span>ID: {padId(detail.event_id)}</span>
              <span>開催: {formatDateTime(detail.event_datetime)}</span>
              <span>終了: {detail.event_end_datetime ? formatDateTime(detail.event_end_datetime) : "未設定"}</span>
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
            {detail.description ? <p>概要: {detail.description}</p> : null}
            {detail.activity ? <p>活動内容: {detail.activity}</p> : null}
            {detail.notes ? <p>注意事項: {detail.notes}</p> : null}
            <p>
              申込 {detail.application_count || 0} / 受付 {detail.checked_in_count || 0} / 完了{" "}
              {detail.completed_count || 0} / 未完了 {detail.incomplete_count || 0}
            </p>
            {eventParticipations.filter((item) => item.status === "incomplete").map((item) => (
              <div className="detail__actions" key={item.participation_id}>
                <span>{item.user_name} ({item.email}) · {item.grant_points_snapshot}pt</span>
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    setCorrecting(item);
                    setCorrectionReason("");
                  }}
                >
                  完了へ補正
                </button>
              </div>
            ))}
            <div className="detail__actions">
              {["active", "paused"].includes(detail.status || "active") ? (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => {
                    setClosing(detail);
                    setCloseReason("");
                  }}
                >
                  イベント受付終了
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setEditing({
                    ...detail,
                    event_datetime: toDateTimeLocal(detail.event_datetime),
                    event_end_datetime: detail.event_end_datetime ? toDateTimeLocal(detail.event_end_datetime) : "",
                  });
                  setDetail(null);
                }}
              >
                編集
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!reviewing}
        title={reviewing?.approved ? "イベント申請を承認" : "イベント申請を却下"}
        onClose={() => setReviewing(null)}
      >
        {reviewing ? (
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitReview();
            }}
          >
            <p>{reviewing.submission.organizer_name} / {reviewing.submission.event_name}</p>
            {reviewing.approved ? (
              <label className="form__field">
                <span>確定付与ポイント</span>
                <input
                  type="number"
                  min={0}
                  value={reviewPoints}
                  onChange={(event) => setReviewPoints(Number(event.target.value))}
                  required
                />
              </label>
            ) : null}
            <label className="form__field">
              <span>{reviewing.approved ? "承認メモ（任意）" : "却下理由"}</span>
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                required={!reviewing.approved}
              />
            </label>
            <div className="form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setReviewing(null)}>
                キャンセル
              </button>
              <button type="submit" className={reviewing.approved ? "btn btn--primary" : "btn btn--danger"} disabled={submitting}>
                {reviewing.approved ? "承認を確定" : "却下を確定"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!correcting} title="参加完了へ補正" onClose={() => setCorrecting(null)}>
        {correcting ? (
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCorrection();
            }}
          >
            <p>{correcting.user_name} / {correcting.grant_points_snapshot}pt</p>
            <label className="form__field">
              <span>補正理由</span>
              <textarea
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                required
              />
            </label>
            <div className="form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setCorrecting(null)}>
                キャンセル
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                補正を確定
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!closing} title="イベント受付終了" onClose={() => setClosing(null)}>
        {closing ? (
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitClose();
            }}
          >
            <p>{closing.event_name}を終了します。申込済みは欠席、受付済みは未完了になります。</p>
            <label className="form__field">
              <span>監査メモ（任意）</span>
              <textarea value={closeReason} onChange={(event) => setCloseReason(event.target.value)} />
            </label>
            <div className="form__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setClosing(null)}>
                キャンセル
              </button>
              <button type="submit" className="btn btn--danger" disabled={submitting}>
                受付終了を確定
              </button>
            </div>
          </form>
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

    </section>
  );
}

type EventFormPayload = {
  event_name: string;
  event_datetime: string;
  event_end_datetime: string;
  location?: string;
  grant_points: number;
  description?: string;
  activity?: string;
  notes?: string;
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
  const [endDatetime, setEndDatetime] = useState(initial?.event_end_datetime ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [points, setPoints] = useState(initial?.grant_points ?? 50);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [activity, setActivity] = useState(initial?.activity ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<"active" | "paused">(initial?.status === "paused" ? "paused" : "active");

  // sync initial when changes
  const initialKey = initial ? initial.event_id : "new";
  useResetForm(initialKey, () => {
    setName(initial?.event_name ?? "");
    setDatetime(initial?.event_datetime ?? "");
    setEndDatetime(initial?.event_end_datetime ?? "");
    setLocation(initial?.location ?? "");
    setPoints(initial?.grant_points ?? 50);
    setDescription(initial?.description ?? "");
    setActivity(initial?.activity ?? "");
    setNotes(initial?.notes ?? "");
    setStatus(initial?.status === "paused" ? "paused" : "active");
  });

  async function handle(event: FormEvent) {
    event.preventDefault();
    await onSubmit(
      {
        event_name: name.trim(),
        event_datetime: datetime,
        event_end_datetime: endDatetime,
        location: location.trim() || undefined,
        grant_points: Number(points),
        description: description.trim() || undefined,
        activity: activity.trim() || undefined,
        notes: notes.trim() || undefined,
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
          <span>終了日時</span>
          <input
            type="datetime-local"
            value={endDatetime}
            min={datetime}
            onChange={(event) => setEndDatetime(event.target.value)}
            required
          />
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
          <span>概要</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="form__field">
          <span>活動内容</span>
          <textarea value={activity} onChange={(event) => setActivity(event.target.value)} />
        </label>
        <label className="form__field">
          <span>注意事項</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
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
