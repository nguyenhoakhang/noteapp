import { X, LogOut } from "lucide-react";

export default function ConfirmRemoveModal({ note, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        style={{ maxWidth: "380px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-icon modal-header-icon--danger">
            <LogOut size={20} />
          </div>
          <h3>Remove yourself?</h3>
          <button onClick={onCancel} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p>
            Remove yourself from <strong>"{note?.title || "Untitled"}"</strong>?
            You will lose access to this note.
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-danger" onClick={onConfirm}>
            <LogOut size={14} />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
