import { type ReactNode } from "react";
import { CloseIcon } from "./Icons";

export function Modal({
  open,
  title,
  size = "md",
  onClose,
  children,
}: {
  open: boolean;
  title?: ReactNode;
  size?: "sm" | "md" | "lg";
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <section
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <header className="modal__head">
            <h2>{title}</h2>
            <button type="button" className="modal__close" onClick={onClose} aria-label="閉じる">
              <CloseIcon size={20} />
            </button>
          </header>
        ) : (
          <button type="button" className="modal__close modal__close--floating" onClick={onClose} aria-label="閉じる">
            <CloseIcon size={20} />
          </button>
        )}
        <div className="modal__body">{children}</div>
      </section>
    </div>
  );
}

export function DeleteConfirmModal({
  open,
  targetLabel,
  description,
  onConfirm,
  onCancel,
  submitting = false,
}: {
  open: boolean;
  targetLabel: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <div className="delete-confirm">
        <h2 className="delete-confirm__title">選択した{targetLabel}を削除しますか？</h2>
        <p className="delete-confirm__body">
          {description ?? `［削除］ボタンを選択すると、選択した${targetLabel}と計測したデータをすべて削除します。`}
        </p>
        <div className="delete-confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
            キャンセル
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={submitting}>
            削除
          </button>
        </div>
      </div>
    </Modal>
  );
}
