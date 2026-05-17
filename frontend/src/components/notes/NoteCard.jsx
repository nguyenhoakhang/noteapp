import { memo } from "react";
import { Pin, Lock, Share2, Trash2, PinOff, Users, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const NoteCard = memo(function NoteCard({
  note,
  view,
  featured,
  onEdit,
  onDelete,
  onPin,
  onRemove,
}) {
  const isList = view === "list";
  const isSharedNote = !!note._sharedBy;

  const stopAndPin = (e) => {
    e.stopPropagation();
    onPin(note);
  };
  const stopAndDelete = (e) => {
    e.stopPropagation();
    onDelete(note);
  };

  // Better content preview: use content_preview if available (faster), else strip HTML
  const getPreview = () => {
    if (note.is_protected) return null;

    // Use content_preview from server if available (already stripped)
    if (note.content_preview) {
      return note.content_preview.slice(0, 180);
    }

    if (!note.content) return null;

    const text = note.content
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) return null;
    return text.slice(0, 180);
  };


  const preview = getPreview();

  const labelCount = note.labels?.length || 0;
  const visibleLabels = note.labels?.slice(0, 2) || [];
  const extraLabels = labelCount > 2 ? labelCount - 2 : 0;

  const timeAgo = note.updated_at
    ? formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })
    : "";

  const cardClasses = [
    isList
      ? "note-list-item"
      : "note-grid-card",
    note.is_pinned ? "is-pinned" : "",
  ]
    .filter(Boolean)
    .join(" ");


  return (
    <div
      className={cardClasses}
      style={note.color && note.color !== "#ffffff" ? { "--note-color": note.color } : undefined}
      onClick={() => onEdit(note)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onEdit(note)}
    >
      <div className="note-card-inner">
        {/* Header */}
        <div className="note-card-header">
          <span className={`note-title ${!note.title ? "note-untitled" : ""}`}>
            {note.title || "Untitled"}
          </span>

          {/* Status icons — always visible, with colored dot backgrounds */}
          <div className="note-status-icons">
            {note.is_pinned && (
              <span className="status-dot status-dot--pinned" title="Pinned">
                <Pin size={11} />
              </span>
            )}
            {note.is_protected && (
              <span className="status-dot status-dot--protected" title="Password protected">
                <Lock size={11} />
              </span>
            )}
            {note.is_shared && !isSharedNote && (
              isList ? (
                <span className="status-dot status-dot--shared" title="Shared with others">
                  <Share2 size={11} />
                </span>
              ) : (
                <span className="note-shared-badge" title="Shared with others">
                  <Share2 size={11} />
                  <span>Shared</span>
                </span>
              )
            )}
          </div>


        </div>

        {/* Preview — 3 lines of content */}
        {note.is_protected ? (
          <p className="note-protected-hint">🔒 Password protected</p>
        ) : preview ? (
          <p className="note-preview">{preview}</p>
        ) : null}

        {/* Shared-by info (only when viewing "Shared with me") */}
        {isSharedNote && (
          <div className="note-shared-by">
            <Users size={11} />
            <span>
              Shared by <strong>{note._sharedBy?.name}</strong>
            </span>
            <span className={`shared-badge shared-badge--${note._permission}`}>
              {note._permission === "edit" ? "Edit" : "Read"}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="note-card-footer">
          <div className="note-meta">
            {visibleLabels.map((l) => (
              <span key={l.id} className="note-chip">
                {l.name}
              </span>
            ))}
            {extraLabels > 0 && (
              <span className="note-chip note-chip-more">+{extraLabels}</span>
            )}
            <span className="note-date">{timeAgo}</span>
          </div>

          {/* Action buttons */}
          <div className="note-actions" onClick={(e) => e.stopPropagation()}>
            {!isSharedNote && (
              <button
                className={`note-action-btn ${note.is_pinned ? "note-action-btn--active" : ""}`}
                onClick={stopAndPin}
                title={note.is_pinned ? "Unpin" : "Pin"}
                aria-label={note.is_pinned ? "Unpin note" : "Pin note"}
              >
                {note.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
            )}
            {!isSharedNote && (
              <button
                className="note-action-btn note-action-btn--danger"
                onClick={stopAndDelete}
                title="Delete"
                aria-label="Delete note"
              >
                <Trash2 size={14} />
              </button>
            )}
            {isSharedNote && onRemove && (
              <button
                className="note-action-btn note-action-btn--danger"
                onClick={(e) => { e.stopPropagation(); onRemove(note); }}
                title="Remove myself"
                aria-label="Remove myself from this note"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default NoteCard;
