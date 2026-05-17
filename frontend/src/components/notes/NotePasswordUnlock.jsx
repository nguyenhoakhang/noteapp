import { useState } from "react";
import { X, Lock } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

export default function NotePasswordUnlock({ note, onUnlocked, onClose }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/notes/${note.note_id}/verify-password`, {
        note_password: password,
      });
      toast.success("Note unlocked");
      onUnlocked(password);
    } catch {
      toast.error("Wrong password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="unlock-note-overlay" onClick={onClose}>
      <div className="unlock-note-modal" onClick={(e) => e.stopPropagation()}>
        <div className="unlock-icon">
          <Lock size={28} />
        </div>
        <h3>Password Required</h3>
        <p>
          This note is password protected. Please enter the password to view it.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter note password"
              autoFocus
              className="form-control"
            />
          </div>
          <div className="modal-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-sm" disabled={loading}>
              {loading ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
