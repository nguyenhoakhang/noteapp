import { useState, useRef } from "react";
import { X, Lock, Unlock, KeyRound } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

export default function NotePasswordModal({
  isProtected,
  noteId,
  onClose,
  onChanged,
}) {
  const [mode, setMode] = useState(isProtected ? "manage" : "set");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  // Guard: if noteId is null or a temp ID, close immediately
  if (!noteId || String(noteId).startsWith("temp_")) {
    toast.error("Cannot manage password: note not yet saved");
    onClose();
    return null;
  }

  const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError("");
    if (mode !== "remove" && newPw !== confirmPw) {
      setError("Passwords do not match");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      if (mode === "set") {
        await api.post(`/notes/${noteId}/password`, { password: newPw });
        onChanged(true);
      } else if (mode === "change") {
        await api.put(`/notes/${noteId}/password`, {
          current_password: currentPw,
          password: newPw,
        });
        onChanged(true);
      } else if (mode === "remove") {
        await api.delete(`/notes/${noteId}/password`, {
          data: { current_password: currentPw },
        });
        onChanged(false);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const ModalIcon = mode === "remove" ? Unlock : Lock;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        style={{ maxWidth: "380px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-icon">
            <ModalIcon size={20} />
          </div>
          <h3>{isProtected ? "Manage Password" : "Set Password"}</h3>
          <button onClick={onClose} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {isProtected && (
            <div className="btn-group" style={{ marginBottom: "1rem" }}>
              {["change", "remove"].map((m) => (
                <button
                  key={m}
                  className={`btn-option ${mode === m ? "active" : ""}`}
                  onClick={() => {
                    setMode(m);
                    setError("");
                  }}
                >
                  {m === "change" ? (
                    <><KeyRound size={12} /> Change</>
                  ) : (
                    <><Unlock size={12} /> Remove</>
                  )}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit}>
            {(mode === "change" || mode === "remove") && (
              <div className="form-group">
                <label>Current password</label>
                <input
                  type="password"
                  value={currentPw}
                  required
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
            )}
            {(mode === "set" || mode === "change") && (
              <>
                <div className="form-group">
                  <label>New password</label>
                  <input
                    type="password"
                    value={newPw}
                    required
                    minLength={4}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm new password</label>
                  <input
                    type="password"
                    value={confirmPw}
                    required
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className={mode === "remove" ? "btn-danger" : "btn-primary-sm"}
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : mode === "remove"
                    ? "Remove password"
                    : "Save password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
