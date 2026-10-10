"use client";

import { useEffect, useId, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Hide the cancel button, for plain notices. */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation on the native <dialog> element, which handles focus
 * trapping, Escape and the inert background. Replaces the RN app's
 * Alert.alert, which is a no-op under react-native-web.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  hideCancel = false,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: let React state drive closing.
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-xl"
    >
      <h2 id={titleId} className="text-lg font-bold">
        {title}
      </h2>
      {children && <div className="mt-2 text-muted">{children}</div>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {!hideCancel && (
          <button
            type="button"
            onClick={onCancel}
            // Destructive actions shouldn't be one Enter press away.
            autoFocus={destructive}
            className="rounded-lg border border-border px-4 py-2.5 font-semibold hover:bg-surface-alt"
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          autoFocus={!destructive || hideCancel}
          className={`rounded-lg px-4 py-2.5 font-semibold ${
            destructive
              ? "bg-[#c62828] text-white hover:bg-[#a31f1f]"
              : "bg-primary text-on-primary hover:bg-primary-strong"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
