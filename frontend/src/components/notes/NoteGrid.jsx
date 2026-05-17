import { memo } from "react";
import NoteCard from "./NoteCard";

const UnifiedGrid = memo(function UnifiedGrid({ notes, onEdit, onDelete, onPin, onRemove }) {
  if (!notes.length) return null;

  return (
    <div className="note-grid">
      {notes.map((n) => (
        <NoteCard
          key={n.id}
          note={n}
          view="grid"
          onEdit={onEdit}
          onDelete={onDelete}
          onPin={onPin}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
});

function ListView({ notes, onEdit, onDelete, onPin, onRemove }) {
  return (
    <div className="list-view">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          view="list"
          onEdit={onEdit}
          onDelete={onDelete}
          onPin={onPin}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

export default function NoteGrid({ notes, view, onEdit, onDelete, onPin, onRemove, isSearching }) {
  if (!notes.length)
    return (
      <div className="empty-state">
        {isSearching ? (
          <>
            <div className="empty-icon">🔍</div>
            <h3>No results found</h3>
            <p>Try a different search term or clear the filter.</p>
          </>
        ) : (
          <>
            <div className="empty-icon">📝</div>
            <h3>No notes yet</h3>
            <p>
              Click <strong>+ New Note</strong> to get started.
            </p>
          </>
        )}
      </div>
    );

  const pinned = notes.filter((n) => n.is_pinned);
  const unpinned = notes.filter((n) => !n.is_pinned);

  return (
    <div className="notes-container">
      {pinned.length > 0 && (
        <section className="notes-section">
          <p className="notes-section-label">
            <span className="label-dot label-dot--pinned" />
            Pinned · {pinned.length}
          </p>
          {view === "list" ? (
            <ListView
              notes={pinned}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
              onRemove={onRemove}
            />
          ) : (
            <UnifiedGrid
              notes={pinned}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
              onRemove={onRemove}
            />
          )}
        </section>
      )}
      {unpinned.length > 0 && (
        <section className="notes-section">
          {pinned.length > 0 && (
            <p className="notes-section-label">
              Others · {unpinned.length}
            </p>
          )}
          {view === "list" ? (
            <ListView
              notes={unpinned}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
              onRemove={onRemove}
            />
          ) : (
            <UnifiedGrid
              notes={unpinned}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
              onRemove={onRemove}
            />
          )}
        </section>
      )}
    </div>
  );
}
