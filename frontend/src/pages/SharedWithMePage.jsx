import { useState, useEffect } from "react";
import { Users, Lock, Eye, Edit3, Trash2 } from "lucide-react";
import api from "../api/axios";
import NoteEditor from "../components/notes/NoteEditor";
import NotePasswordUnlock from "../components/notes/NotePasswordUnlock";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import useAuthStore from "../store/authStore";

export default function SharedWithMePage() {
  const [shared, setShared] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNote, setOpenNote] = useState(null);
  const [unlocking, setUnlocking] = useState(null);
  const [unlockedIds, setUnlockedIds] = useState({});
  const [unlockedPasswords, setUnlockedPasswords] = useState({});
  const [removing, setRemoving] = useState(null);
  const { user } = useAuthStore();

  useEffect(() => {
    api
      .get("/notes/shared-with-me")
      .then((r) => setShared(r.data))
      .finally(() => setLoading(false));
  }, []);

  // Refresh shared notes periodically (every 30s) for reactive updates
  useEffect(() => {
    const interval = setInterval(() => {
      api.get("/notes/shared-with-me").then((r) => setShared(r.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = (item) => {
    if (item.is_protected && !unlockedIds[item.note_id]) {
      setUnlocking(item);
      return;
    }
    setOpenNote({ id: item.note_id, permission: item.permission });
  };

  const handleUnlocked = (item, password) => {
    setUnlockedIds((prev) => ({ ...prev, [item.note_id]: true }));
    if (password) {
      setUnlockedPasswords((prev) => ({ ...prev, [item.note_id]: password }));
    }
    setUnlocking(null);
    setOpenNote({ id: item.note_id, permission: item.permission });
  };

  const removeMyself = async (e, item) => {
    e.stopPropagation();
    if (!confirm(`Remove yourself from "${item.title || "Untitled"}"?`)) return;
    // Optimistic update: remove immediately from UI
    setRemoving(item.share_id);
    setShared((prev) => prev.filter((s) => s.share_id !== item.share_id));
    try {
      await api.delete(`/notes/${item.note_id}/shares/${user.id}`);
      toast.success("Removed yourself from this note");
    } catch {
      // Rollback on failure
      setShared((prev) => [...prev, item]);
      toast.error("Failed to remove");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="notes-main">
      <div className="notes-toolbar">
        <h2
          className="notes-heading"
          style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
        >
          <Users size={16} /> Shared with me
        </h2>
      </div>

      {loading && (
        <div className="loading-notes">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 96 }} />
          ))}
        </div>
      )}

      {!loading && shared.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>Nothing shared yet</h3>
          <p>Notes shared with you will appear here</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {shared.map((item) => (
          <div
            key={item.share_id}
            className="shared-note-card"
            style={{ "--note-color": item.color || undefined }}
            onClick={() => handleOpen(item)}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <strong style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                {item.title || <em style={{ opacity: 0.5 }}>Untitled</em>}
              </strong>
              <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                {item.is_protected && (
                  <Lock size={13} className="icon-lock" />
                )}
                {item.permission === "edit" ? (
                  <Edit3 size={13} style={{ color: "var(--primary)" }} />
                ) : (
                  <Eye size={13} style={{ color: "var(--text-faint)" }} />
                )}
              </div>
            </div>

            {item.preview && (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  margin: "0.2rem 0",
                }}
              >
                {item.preview}
              </p>
            )}

            <div className="shared-meta">
              <span className="shared-by">
                Shared by <strong>{item.shared_by.name}</strong> (
                {item.shared_by.email})
              </span>
              <span className={`shared-badge shared-badge--${item.permission}`}>
                {item.permission === "edit" ? "Can edit" : "Read only"}
              </span>
              <span
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-faint)",
                  marginLeft: "auto",
                }}
              >
                {formatDistanceToNow(new Date(item.shared_at), {
                  addSuffix: true,
                })}
              </span>
              <button
                className="shared-remove-btn"
                onClick={(e) => removeMyself(e, item)}
                disabled={removing === item.share_id}
                title="Remove myself"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Open note */}
      {openNote && (
        <div className="modal-overlay" onClick={() => setOpenNote(null)}>
          <div className="note-editor" onClick={(e) => e.stopPropagation()}>
            <NoteEditor
              note={{ id: openNote.id }}
              readOnly={openNote.permission === "read"}
              initialPassword={unlockedPasswords[openNote.id]}
              onClose={() => setOpenNote(null)}
            />
          </div>
        </div>
      )}

      {/* Unlock password */}
      {unlocking && (
        <NotePasswordUnlock
          note={unlocking}
          onUnlocked={() => handleUnlocked(unlocking)}
          onClose={() => setUnlocking(null)}
        />
      )}
    </div>
  );
}
