import { useState, useEffect, useRef } from "react";
import { X, UserPlus, Trash2, Check, Search } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

export default function ShareModal({ note, onClose }) {
  const [email, setEmail] = useState("");
  const [perm, setPerm] = useState("read");
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const searchTimer = useRef();

  // Load existing shares
  useEffect(() => {
    api
      .get(`/notes/${note.id}/shares`)
      .then((r) => setShares(r.data))
      .catch(() => {});
  }, [note.id]);

  // Search users by email
  const handleSearch = (value) => {
    setEmail(value);
    setSelectedUser(null);
    clearTimeout(searchTimer.current);

    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/users/search", {
          params: { q: value },
        });
        // Filter out users already shared + self
        const sharedIds = shares.map((s) => s.user_id);
        setSearchResults(
          data.filter((u) => !sharedIds.includes(u.id)),
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setEmail(user.email);
    setSearchResults([]);
  };

  const addShare = async (e) => {
    e.preventDefault();
    const targetEmail = selectedUser?.email || email;
    if (!targetEmail.trim()) return;

    setAdding(true);
    try {
      const { data } = await api.post(`/notes/${note.id}/shares`, {
        email: targetEmail,
        permission: perm,
      });
      setShares((prev) => {
        const exists = prev.find((s) => s.user_id === data.user_id);
        return exists
          ? prev.map((s) => (s.user_id === data.user_id ? data : s))
          : [...prev, data];
      });
      setEmail("");
      setSelectedUser(null);
      setSearchResults([]);
      toast.success(`Shared with ${data.email}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to share");
    } finally {
      setAdding(false);
    }
  };

  const changePermission = async (userId, newPerm) => {
    try {
      await api.put(`/notes/${note.id}/shares/${userId}`, {
        permission: newPerm,
      });
      setShares((prev) =>
        prev.map((s) =>
          s.user_id === userId ? { ...s, permission: newPerm } : s,
        ),
      );
    } catch {
      toast.error("Failed to update permission");
    }
  };

  const revoke = async (userId, userEmail) => {
    if (!confirm(`Remove access for ${userEmail}?`)) return;
    try {
      await api.delete(`/notes/${note.id}/shares/${userId}`);
      setShares((prev) => prev.filter((s) => s.user_id !== userId));
      toast.success("Access revoked");
    } catch {
      toast.error("Failed to revoke");
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal share-modal"
        style={{ maxWidth: "480px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Share "{note.title || "Untitled"}"</h3>
          <button onClick={onClose} className="modal-close-btn">
            <X size={16} />
          </button>
        </div>

        {/* Search + share form */}
        <form onSubmit={addShare} className="share-add-form">
          <div className="share-search-wrap">
            <Search size={14} className="share-search-icon" />
            <input
              type="text"
              value={email}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="share-email-input"
              autoComplete="off"
            />
            {searching && <span className="share-search-spinner" />}
          </div>
          <select
            value={perm}
            onChange={(e) => setPerm(e.target.value)}
            className="share-perm-select"
          >
            <option value="read">Read</option>
            <option value="edit">Edit</option>
          </select>
          <button
            type="submit"
            className="btn-primary-sm"
            disabled={adding || !email.trim()}
            title="Share"
          >
            {adding ? "…" : <UserPlus size={14} />}
          </button>
        </form>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="share-search-results">
                {searchResults.map((u) => (
              <div
                key={u.id}
                className="share-search-item"
                onClick={() => selectUser(u)}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="share-avatar-img" />
                ) : (
                  <div className="share-avatar-initial">
                    {u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                  </div>
                )}
                <div className="share-user-info">
                  <span className="share-name">{u.name}</span>
                  <span className="share-email">{u.email}</span>
                </div>
                <Check size={14} className="share-check-icon" />
              </div>
            ))}
          </div>
        )}

        {/* Existing shares */}
        {shares.length > 0 && (
          <div className="share-list">
            <p className="share-list-title">
              Shared with ({shares.length})
            </p>
            {shares.map((s) => (
              <div key={s.user_id} className="share-row">
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt="" className="share-avatar-img" />
                ) : (
                  <div className="share-avatar-initial">
                    {s.name?.[0]?.toUpperCase() || s.email[0].toUpperCase()}
                  </div>
                )}
                <div className="share-user-info">
                  <span className="share-name">{s.name}</span>
                  <span className="share-email">{s.email}</span>
                </div>
                <div className="share-controls">
                  <div className="perm-toggle">
                    {["read", "edit"].map((p) => (
                      <button
                        key={p}
                        className={`perm-opt ${s.permission === p ? "active" : ""}`}
                        onClick={() =>
                          s.permission !== p && changePermission(s.user_id, p)
                        }
                      >
                        {p === "read" ? "Read" : "Edit"}
                      </button>
                    ))}
                  </div>
                  <button
                    className="revoke-btn"
                    onClick={() => revoke(s.user_id, s.email)}
                    title="Revoke access"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {shares.length === 0 && (
          <p className="share-empty">Not shared with anyone yet.</p>
        )}
      </div>
    </div>
  );
}
