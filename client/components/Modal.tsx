"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Animated confirmation dialog. Escape / backdrop click cancel; focus moves to the safe button. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onCancel()}>
      <div className="panel modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-title">{title}</h2>
        {children && <div className="muted modal-body">{children}</div>}
        <div className="btn-row modal-actions">
          <button ref={cancelRef} type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={danger ? "btn btn-danger-solid" : "btn btn-primary"} disabled={busy} onClick={onConfirm}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
