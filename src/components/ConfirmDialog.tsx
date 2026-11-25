import { useEffect } from "react";

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    /** Botón "cancelar" (y Escape/clic afuera, salvo que se pase `onDismiss`). */
    onCancel: () => void;
    /** Qué hace Escape y el clic afuera. Por defecto, lo mismo que onCancel. */
    onDismiss?: () => void;
}

/**
 * Diálogo de confirmación accesible (reemplaza a window.confirm).
 * Se cierra con Escape, con clic afuera o con el botón de cancelar.
 */
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    destructive = false,
    onConfirm,
    onCancel,
    onDismiss
}: ConfirmDialogProps) {
    const dismiss = onDismiss || onCancel;

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") dismiss();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, dismiss]);

    if (!open) return null;

    return (
        <div className="dialog-backdrop" role="presentation" onClick={dismiss}>
            <div
                className="dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                aria-describedby="dialog-message"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 id="dialog-title">{title}</h2>
                <p id="dialog-message">{message}</p>
                <div className="dialog-actions">
                    <button type="button" className="data-btn" autoFocus onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={destructive ? "dialog-btn destructive" : "dialog-btn"}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
