import { useState, type FormEvent } from "react";
import { StoreIcon } from "../components/Icons";
import { DataTable, type Column } from "../components/DataTable";
import { DeleteConfirmModal, Modal } from "../components/Modal";
import { createStore, deleteStore, getErrorMessage, updateStore } from "../api";
import { formatDate, padId } from "../format";
import type { AdminServiceItem, StoreItem } from "../types";

type FeedbackSetter = (ok: boolean, message: string) => void;

export function StoresList({
  stores,
  services,
  token,
  onReload,
  notify,
}: {
  stores: StoreItem[];
  services: AdminServiceItem[];
  token: string;
  onReload: () => Promise<void>;
  notify: FeedbackSetter;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StoreItem | null>(null);
  const [detail, setDetail] = useState<StoreItem | null>(null);
  const [deleting, setDeleting] = useState<StoreItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = search.trim()
    ? stores.filter((s) => `${s.store_name} ${s.store_id}`.toLowerCase().includes(search.toLowerCase()))
    : stores;

  const serviceNamesByStore = new Map<number, string[]>();
  for (const service of services) {
    const list = serviceNamesByStore.get(service.store_id) ?? [];
    list.push(service.service_name);
    serviceNamesByStore.set(service.store_id, list);
  }

  const columns: Array<Column<StoreItem>> = [
    { key: "id", label: "ID", render: (row) => padId(row.store_id), width: "80px" },
    { key: "name", label: "店名", render: (row) => row.store_name },
    {
      key: "services",
      label: "サービス・商品名",
      render: (row) => {
        const names = serviceNamesByStore.get(row.store_id) ?? [];
        return names.length === 0 ? "-" : names.join(" / ");
      },
    },
    { key: "registered", label: "登録日", render: (row) => formatDate(row.created_at), width: "120px" },
    {
      key: "status",
      label: "状態",
      render: (row) => (
        <span className={`status-pill status-pill--${row.status}`}>
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
      await deleteStore(deleting.store_id, token);
      notify(true, "加盟店を削除しました。");
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
        title="加盟店一覧"
        titleIcon={<StoreIcon size={22} />}
        rows={filtered}
        columns={columns}
        rowKey={(row) => row.store_id}
        searchValue={search}
        onSearch={setSearch}
        addCta={{ label: "加盟店追加", onClick: () => setAdding(true) }}
        rowActions={[
          { kind: "view", onClick: (row) => setDetail(row) },
          { kind: "edit", onClick: (row) => setEditing(row) },
          { kind: "delete", onClick: (row) => setDeleting(row) },
        ]}
      />

      <Modal open={!!detail} title="加盟店詳細" onClose={() => setDetail(null)}>
        {detail ? (
          <div className="detail">
            <div className="detail__meta">
              <span>ID: {padId(detail.store_id)}</span>
              <span>登録日: {formatDate(detail.created_at)}</span>
            </div>
            <h3 className="detail__title">{detail.store_name}</h3>
            <p>
              取扱いサービス: {(serviceNamesByStore.get(detail.store_id) ?? []).join(" / ") || "なし"}
            </p>
            <div className="detail__actions">
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

      <StoreFormModal
        open={adding || !!editing}
        initial={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSubmit={async (payload, storeId) => {
          setSubmitting(true);
          try {
            if (storeId) {
              await updateStore(storeId, payload, token);
              notify(true, "加盟店を更新しました。");
            } else {
              await createStore(payload, token);
              notify(true, "加盟店を追加しました。");
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
        targetLabel="加盟店情報"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        submitting={submitting}
      />
    </section>
  );
}

function StoreFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initial: StoreItem | null;
  onClose: () => void;
  onSubmit: (payload: { store_name: string; status?: "active" | "paused" }, storeId?: number) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.store_name ?? "");
  const [status, setStatus] = useState<"active" | "paused">(initial?.status ?? "active");

  useResetForm(initial?.store_id ?? "new", () => {
    setName(initial?.store_name ?? "");
    setStatus(initial?.status ?? "active");
  });

  async function handle(event: FormEvent) {
    event.preventDefault();
    await onSubmit({ store_name: name.trim(), status }, initial?.store_id);
  }

  return (
    <Modal open={open} title={initial ? "加盟店編集" : "加盟店追加"} onClose={onClose}>
      <form className="form" onSubmit={handle}>
        <label className="form__field">
          <span>店名</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
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
