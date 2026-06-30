import { useEffect } from "react";

export type Feedback = { ok: boolean; message: string } | null;

export function FeedbackBanner({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(timer);
  }, [feedback, onClose]);

  if (!feedback) return null;
  return (
    <div className={`feedback feedback--${feedback.ok ? "success" : "error"}`} role={feedback.ok ? "status" : "alert"}>
      <span>{feedback.message}</span>
      <button type="button" onClick={onClose} aria-label="閉じる">
        ×
      </button>
    </div>
  );
}
