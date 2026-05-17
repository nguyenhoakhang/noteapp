import { Pin, Lock, Share2, Trash2 } from "lucide-react";

const stripHtml = (html) =>
  html
    ? html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";

export default function NoteCard({ note, view, onEdit, onDelete, onPin }) {
  const isList = view === "list";

  return (
    <div
      className={`note-card ${isList ? "note-list-item" : "note-bento-card"}`}
      style={{ "--note-color": note.color || "#ffffff" }}
      onClick={() => onEdit(note)}
    >
      <div className="note-card-inner">
        {/* Title row */}
        <div className="note-card-header">
          <h3 className="note-title">
            {note.title || <span className="note-untitled">Untitled</span>}
          </h3>
          <div className="note-status-icons">
            {note.is_pinned && <Pin size={12} className="icon-pin" />}
            {note.is_protected && <Lock size={12} className="icon-lock" />}
            {note.shares?.length > 0 && (
              <Share2 size={12} className="icon-share" />
            )}
          </div>
        </div>

        {/* Content preview */}
        {!note.is_protected ? (
          <p className="note-preview">{stripHtml(note.content)}</p>
        ) : (
          <p className="note-protected-hint">🔒 Protected</p>
        )}

        {/* Footer */}
        <div className="note-card-footer">
          <div className="note-meta">
            {note.labels?.slice(0, 2).map((l) => (
              <span key={l.id} className="note-chip">
                {l.name}
              </span>
            ))}
            {note.labels?.length > 2 && (
              <span className="note-chip note-chip-more">
                +{note.labels.length - 2}
              </span>
            )}
            <span className="note-date">
              {new Date(note.updated_at || note.created_at).toLocaleDateString(
                "en",
                { month: "short", day: "numeric" },
              )}
            </span>
          </div>

          <div className="note-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className={`note-action-btn ${note.is_pinned ? "note-action-btn--active" : ""}`}
              onClick={() => onPin(note)}
              title={note.is_pinned ? "Unpin" : "Pin"}
            >
              <Pin size={13} />
            </button>
            <button
              className="note-action-btn note-action-btn--danger"
              onClick={() => onDelete(note)}
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
