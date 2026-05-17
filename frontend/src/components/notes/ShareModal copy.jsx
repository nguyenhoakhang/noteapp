import { useState, useEffect } from "react";
import { X, Trash2, Eye, Pencil } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

export default function ShareModal({ note, onClose, onUpdate }) {
  const [shares, setShares] = useState(note.shares || []);
  const [email, setEmail] = useState("");
  const [permission, setPerm] = useState("read");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Refresh shares
    api
      .get(`/notes/${note.id}`)
      .then(({ data }) => setShares(data.shares || []))
      .catch(() => {});
  }, [note.id]);

  const shareNote = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post(`/notes/${note.id}/share`, {
        email,
        permission,
      });
      setShares((s) => {
        const exists = s.find((x) => x.id === data.id);
        return exists
          ? s.map((x) => (x.id === data.id ? data : x))
          : [...s, data];
      });
      setEmail("");
      toast.success("Shared!");
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to share");
    } finally {
      setLoading(false);
    }
  };

  const revoke = async (shareId) => {
    try {
      await api.delete(`/notes/${note.id}/share/${shareId}`);
      setShares((s) => s.filter((x) => x.id !== shareId));
      onUpdate();
    } catch {
      toast.error("Failed to revoke");
    }
  };

  const changePermission = async (shareId, perm) => {
    try {
      const { data } = await api.patch(`/notes/${note.id}/share/${shareId}`, {
        permission: perm,
      });
      setShares((s) => s.map((x) => (x.id === shareId ? data : x)));
      onUpdate();
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share note</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={shareNote} className="share-form">
          <input
            type="email"
            placeholder="Share with email…"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <select value={permission} onChange={(e) => setPerm(e.target.value)}>
            <option value="read">Read only</option>
            <option value="edit">Can edit</option>
          </select>
          <button className="btn-primary-sm" type="submit" disabled={loading}>
            {loading ? "…" : "Share"}
          </button>
        </form>

        <div className="share-list">
          {shares.length === 0 && (
            <p className="share-empty">Not shared with anyone yet.</p>
          )}
          {shares.map((share) => (
            <div key={share.id} className="share-row">
              <div className="share-user">
                <div className="share-avatar">
                  {share.shared_with?.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className="share-name">{share.shared_with?.name}</div>
                  <div className="share-email">{share.shared_with?.email}</div>
                </div>
              </div>
              <div className="share-actions">
                <select
                  value={share.permission}
                  onChange={(e) => changePermission(share.id, e.target.value)}
                  className="share-perm-select"
                >
                  <option value="read">Read</option>
                  <option value="edit">Edit</option>
                </select>
                <button
                  className="btn-icon-danger"
                  onClick={() => revoke(share.id)}
                  title="Revoke"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
