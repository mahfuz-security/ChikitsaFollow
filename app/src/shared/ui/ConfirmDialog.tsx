import { Modal } from "./Modal";
import { ActionButton } from "./ActionButton";

export function ConfirmDialog({
  confirmLabel = "Confirm",
  destructive = false,
  message,
  onCancel,
  onConfirm,
  title
}: {
  confirmLabel?: string;
  destructive?: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="modal-actions">
        <ActionButton variant="ghost" onClick={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton variant={destructive ? "destructive" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </ActionButton>
      </div>
    </Modal>
  );
}
