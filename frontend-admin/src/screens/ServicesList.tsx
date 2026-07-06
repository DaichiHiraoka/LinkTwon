import { useState, type FormEvent } from "react";
import { ServiceIcon } from "../components/Icons";
import { DataTable, type Column } from "../components/DataTable";
import { DeleteConfirmModal, Modal } from "../components/Modal";
import { createService, deleteService, getErrorMessage, updateService } from "../api";
import { formatDate, padId } from "../format";
import type { AdminServiceItem, StoreItem } from "../types";

type FeedbackSetter = (ok: boolean, message: string) => void;

export function ServicesList({
  services,
  stores,
  token,
  onReload,
  notify,
}: {
  services: AdminServiceItem[];
  stores: StoreItem[];
  token: string;
  onReload: () => Promise<void>;
  notify: FeedbackSetter;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminServiceItem | null>(null);
  const [detail, setDetail] = useState<AdminServiceItem | null>(null);
  const [deleting, setDeleting] = useState<AdminServiceItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = search.trim()
    ? services.filter((s) =>
        `${s.service_name} ${s.store_name} ${s.service_id}`.toLowerCase().includes(search.toLowerCase()),
      )
    : services;

  const columns: Array<Column<AdminServiceItem>> = [
    { key: "id", label: "ID", render: (row) => padId(row.service_id), width: "80px" },
    { key: "store", label: "店名", render: (row) => row.store_name },
    { key: "name", label: "サービス・商品名", render: (row) => row.service_name },
    { key: "registered", label: "登録日", render: (row) => formatDate(row.created_at), width: "120px" },
    { key: "points", label: "消費ポイント", render: (row) => `${row.required_points}pt`, width: "120px" },
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

  async function handleDelete() {
    if (!deleting || submitting) return;
    setSubmitting(true);
    try {
      await deleteService(deleting.service_id, token);
      notify(true, "サービスを削除しました。");
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
        title="サービス一覧"
        titleIcon={<ServiceIcon size={22} />}
        rows={filtered}
        columns={columns}
        rowKey={(row) => row.service_id}
        searchValue={search}
        onSearch={setSearch}
        addCta={{ label: "サービス追加", onClick: () => setAdding(true) }}
        rowActions={[
          { kind: "view", onClick: (row) => setDetail(row) },
          { kind: "edit", onClick: (row) => setEditing(row) },
          { kind: "delete", onClick: (row) => setDeleting(row) },
        ]}
      />

      <Modal open={!!detail} title={undefined} size="lg" onClose={() => setDetail(null)}>
        {detail ? (
          <div className="service-detail">
            <div className="service-detail__head">
              <span>ID：{padId(detail.service_id)}</span>
              <span>店名：{detail.store_name}</span>
              <span>登録日：{formatDate(detail.created_at)}</span>
            </div>
            <h3 className="service-detail__title">サービス・商品：{detail.service_name}</h3>
            <div className="service-detail__body">
              <div className="service-detail__photo">写真</div>
              <dl className="service-detail__info">
                <div>
                  <dt>消費ポイント</dt>
                  <dd>{detail.required_points}pt</dd>
                </div>
                <div>
                  <dt>店舗</dt>
                  <dd>{detail.store_name}</dd>
                </div>
                {detail.store_address ? (
                  <div>
                    <dt>住所</dt>
                    <dd>{detail.store_address}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>状態</dt>
                  <dd>{detail.status === "paused" ? "停止中" : "公開中"}</dd>
                </div>
              </dl>
            </div>
            <div className="service-detail__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setEditing(detail);
                  setDetail(null);
                }}
              >
                編集
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ServiceFormModal
        open={adding || !!editing}
        initial={editing}
        stores={stores}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSubmit={async (payload, serviceId) => {
          setSubmitting(true);
          try {
            if (serviceId) {
              await updateService(serviceId, payload, token);
              notify(true, "サービスを更新しました。");
            } else {
              await createService(payload, token);
              notify(true, "サービスを追加しました。");
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
        targetLabel="サービス情報"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        submitting={submitting}
      />
    </section>
  );
}

function ServiceFormModal({
  open,
  initial,
  stores,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initial: AdminServiceItem | null;
  stores: StoreItem[];
  onClose: () => void;
  onSubmit: (
    payload: { store_id: number; service_name: string; required_points: number; status?: "active" | "paused" },
    serviceId?: number,
  ) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.service_name ?? "");
  const [storeId, setStoreId] = useState<number | "">(initial?.store_id ?? "");
  const [points, setPoints] = useState(initial?.required_points ?? 100);
  const [status, setStatus] = useState<"active" | "paused">(initial?.status ?? "active");

  useResetForm(initial?.service_id ?? "new", () => {
    setName(initial?.service_name ?? "");
    setStoreId(initial?.store_id ?? "");
    setPoints(initial?.required_points ?? 100);
    setStatus(initial?.status ?? "active");
  });

  async function handle(event: FormEvent) {
    event.preventDefault();
    if (!storeId) return;
    await onSubmit(
      {
        store_id: Number(storeId),
        service_name: name.trim(),
        required_points: Number(points),
        status,
      },
      initial?.service_id,
    );
  }

  return (
    <Modal open={open} title={initial ? "サービス編集" : "サービス追加"} onClose={onClose}>
      <form className="form" onSubmit={handle}>
        <label className="form__field">
          <span>店舗</span>
          <select value={storeId} onChange={(event) => setStoreId(event.target.value ? Number(event.target.value) : "")} required>
            <option value="">選択</option>
            {stores.map((store) => (
              <option key={store.store_id} value={store.store_id}>
                {store.store_name}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field">
          <span>サービス・商品名</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="form__field">
          <span>消費ポイント</span>
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
            {initial ? "保存" : "追加"}
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
