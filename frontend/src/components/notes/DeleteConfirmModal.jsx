import { useState } from "react";
import { X, AlertTriangle, Lock } from "lucide-react";
import api from "../../api/axios";

export default function DeleteConfirmModal({ note, onConfirm, onCancel }) {
  const [notePassword, setNotePassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const isProtected = note?.is_protected;

  // Check if password was already cached in sessionStorage
  const [skipPassword, setSkipPassword] = useState(() => {
    if (!isProtected) return true;
    try {
      const stored = JSON.parse(sessionStorage.getItem("verified_note_passwords") || "{}");
      const entry = stored[note.id];
      if (entry && Date.now() - entry.verifiedAt < 55 * 60 * 1000) {
        return true; // backend cache should still be valid
      }
    } catch {}
    return false;
  });

  const handleConfirm = async () => {
    if (isProtected && !skipPassword && !notePassword) {
      setError("Please enter the note password");
      return;
    }

    if (isProtected && !skipPassword) {
      setVerifying(true);
      setError("");
      try {
        // Verify password first
        await api.post(`/notes/${note.id}/verify-password`, {
          note_password: notePassword,
        });
        // Password correct, proceed with delete
        onConfirm(notePassword);
      } catch (e) {
        setError(e?.response?.data?.message || "Wrong password");
      } finally {
        setVerifying(false);
      }
    } else {
      // Password already cached or note not protected — proceed directly
      // Try to get password from sessionStorage for the delete request
      let pwd = notePassword;
      if (!pwd && skipPassword) {
        try {
          const stored = JSON.parse(sessionStorage.getItem("verified_note_passwords") || "{}");
          const entry = stored[note.id];
          if (entry?.password) pwd = entry.password;
        } catch {}
      }
      onConfirm(pwd);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        style={{ maxWidth: "380px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-icon modal-header-icon--danger">
            <AlertTriangle size={20} />
          </div>
          <h3>{isProtected ? "Delete Protected Note" : "Delete note?"}</h3>
          <button onClick={onCancel} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p>
            Delete <strong>"{note?.title || "Untitled"}"</strong>? This cannot
            be undone.
          </p>

          {isProtected && (
            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label>
                <Lock size={12} /> This note is password protected. Please enter
                the note password to continue.
              </label>
              <input
                type="password"
                className="form-control"
                value={notePassword}
                onChange={(e) => {
                  setNotePassword(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                placeholder="Enter note password"
                autoFocus
              />
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={handleConfirm}
            disabled={verifying}
          >
            {verifying ? "Verifying…" : <><AlertTriangle size={14} /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}
