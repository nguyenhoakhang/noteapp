import { useState, useEffect, useRef, useMemo } from "react";
import api from "../api/axios";
import useAuthStore from "../store/authStore";
import useDebounce from "../hooks/useDebounce";
import toast from "react-hot-toast";

import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import NoteGrid from "../components/notes/NoteGrid";
import NoteEditor from "../components/notes/NoteEditor";
import DeleteConfirmModal from "../components/notes/DeleteConfirmModal";
import ConfirmRemoveModal from "../components/notes/ConfirmRemoveModal";
import UnverifiedBanner from "../components/UnverifiedBanner";
import {
  fetchNotes,
  fetchLabels,
  createNote,
  updateNote,
  deleteNote,
  pinNote,
} from "../api/offlineApi";
import useSyncEngine from "../hooks/useSyncEngine";
import OfflineBanner from "../components/OfflineBanner";
import { getAllCached } from "../offline/noteCache.js";
import { isUnlocked, getUnlockedIds, unlock as sessionUnlock } from "../offline/sessionStore.js";

export default function NotesPage() {
  const { user, updateUser } = useAuthStore();

  const [notes, setNotes] = useState([]);
  const [shared, setShared] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid"); // grid | list
  const [activeLabel, setActiveLabel] = useState(null);
  const [activeSection, setActiveSection] = useState("notes"); // notes | shared

  const [editingNote, setEditingNote] = useState(null);
  const [deletingNote, setDeletingNote] = useState(null);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [theme, setTheme] = useState(user?.theme || "light");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sortBy, setSortBy] = useState("created_at"); // created_at | updated_at | title
  const [sortDir, setSortDir] = useState("desc"); // asc | desc

  // Track verified passwords per note with 30-min session persistence
  // Uses the new sessionStore module
  const [verifiedPasswords, setVerifiedPasswords] = useState(() => {
    // Initialize from sessionStore
    const ids = getUnlockedIds();
    const map = {};
    for (const id of ids) {
      const pwd = isUnlocked(id);
      if (pwd) map[id] = pwd;
    }
    return map;
  });
  const verifiedPasswordsRef = useRef({});

  // Remove-self modal state
  const [removingNote, setRemovingNote] = useState(null);

  const pinningRef = useRef(new Set());
  const debouncedSearch = useDebounce(search, 300);
  const { online, pendingCount, syncStatus, forceSync } = useSyncEngine();

  // ✅ Handle create note — offlineApi handles offline fallback
  const handleCreateNote = async (data) => {
    try {
      const saved = await createNote(data);
      setNotes((prev) => [saved, ...prev]);
      toast.success("Note created");
      return saved;
    } catch (error) {
      toast.error("Failed to create note");
      throw error;
    }
  };

  // ✅ Handle update note — offlineApi handles offline fallback
  const handleUpdateNote = async (id, data) => {
    try {
      const updated = await updateNote(id, data);
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      return updated;
    } catch (error) {
      toast.error("Failed to update note");
      throw error;
    }
  };

  // ✅ Handle delete note — offlineApi handles offline fallback
  const handleDeleteNote = async (note) => {
    // Optimistic update
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    setDeletingNote(null);

    try {
      await deleteNote(note.id);
      toast.success("Note deleted");
    } catch (error) {
      // Rollback on unexpected error
      setNotes((prev) => [note, ...prev]);
      toast.error("Delete failed");
    }
  };

  const handleCreatorClose = () => {
    setCreatingOpen(false);
    setNotes((prev) =>
      prev.filter(
        (n) =>
          !String(n.id).startsWith("temp_") ||
          n.title?.trim() ||
          n.content?.trim(),
      ),
    );
  };

  const handlePin = async (note) => {
    if (pinningRef.current.has(note.id)) return;
    pinningRef.current.add(note.id);

    const newPinned = !note.is_pinned;
    const newPinnedAt = newPinned ? new Date().toISOString() : null;

    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === note.id
          ? { ...n, is_pinned: newPinned, pinned_at: newPinnedAt }
          : n,
      ),
    );

    try {
      const { data } = await api.post(`/notes/${note.id}/pin`);
      // Sync with server response (single update)
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id
            ? { ...n, is_pinned: data.is_pinned, pinned_at: data.pinned_at }
            : n,
        ),
      );
    } catch {
      // Rollback
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id
            ? { ...n, is_pinned: note.is_pinned, pinned_at: note.pinned_at }
            : n,
        ),
      );
      toast.error("Failed to pin note");
    } finally {
      pinningRef.current.delete(note.id);
    }
  };

  // Sorted + filtered notes for display
  const displayNotes = useMemo(() => {
    let list;
    if (activeSection === "shared") {
      // sharedWithMe() returns flat fields (title, content, color, etc.)
      list = shared.map((s) => ({
        id: s.note_id,
        title: s.title,
        content: s.content,
        content_preview: s.content_preview,
        color: s.color,
        is_pinned: s.is_pinned,
        is_protected: s.is_protected,
        created_at: s.note_updated,
        updated_at: s.note_updated,
        _sharedBy: s.shared_by,
        _permission: s.permission,
        _shareId: s.share_id,
      }));
    } else {
      if (!search.trim()) {
        list = notes;
      } else {
        const q = search.toLowerCase();
        list = notes.filter(
          (n) =>
            n.title?.toLowerCase().includes(q) ||
            (n.content_preview || n.content || "")?.toLowerCase().includes(q) ||
            n.labels?.some((l) => l.name?.toLowerCase().includes(q)),
        );
      }
    }

    // Apply sorting — pinned notes ALWAYS on top regardless of sort mode
    return [...list].sort((a, b) => {
      // Pinned first
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      // Then sort by selected criteria
      let cmp = 0;
      if (sortBy === "title") {
        cmp = (a.title || "").localeCompare(b.title || "");
      } else if (sortBy === "updated_at") {
        cmp = new Date(a.updated_at || 0) - new Date(b.updated_at || 0);
      } else {
        cmp = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [notes, shared, search, activeSection, sortBy, sortDir]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const size = { small: "14px", medium: "16px", large: "18px" };
    document.documentElement.style.setProperty(
      "--base-font",
      size[user?.font_size || "medium"],
    );
  }, [theme, user?.font_size]);

  const toggleTheme = async () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      await api.patch("/user/preferences", { theme: next });
    } catch {}
  };

  // Load notes — stale-while-revalidate: show cached instantly, fetch fresh in background
  useEffect(() => {
    // 1. Load cached notes instantly (if any)
    getAllCached().then((cached) => {
      if (cached.length > 0) {
        setNotes(cached);
        setLoading(false);
      }
    });

    // 2. Fetch fresh data from API
    fetchNotesData();
    fetchLabelsData();
    fetchShared();
  }, []);

  // Periodic refresh for reactive share updates (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchShared();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Search / filter — local-first: filter cached notes, only hit API if needed
  useEffect(() => {
    if (!debouncedSearch.trim() && !activeLabel) {
      setSearching(false);
      fetchNotesData();
      return;
    }
    setSearching(true);
    // Try local filtering first
    getAllCached().then((cached) => {
      if (cached.length > 0) {
        const q = debouncedSearch.toLowerCase();
        let filtered = cached;
        if (q) {
          filtered = filtered.filter(
            (n) =>
              n.title?.toLowerCase().includes(q) ||
              (n.content_preview || n.content || "")?.toLowerCase().includes(q) ||
              n.labels?.some((l) => l.name?.toLowerCase().includes(q)),
          );
        }
        if (activeLabel) {
          filtered = filtered.filter((n) =>
            n.labels?.some((l) => l.id === activeLabel),
          );
        }
        setNotes(filtered);
        setSearching(false);
      }
    });
    // Also fetch from API in background for fresh results
    fetchNotesData().finally(() => setSearching(false));
  }, [debouncedSearch, activeLabel]);

  const fetchNotesData = async () => {
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (activeLabel) params.label_id = activeLabel;
      const data = await fetchNotes(params);
      setNotes(data);
    } catch {
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const fetchShared = async () => {
    try {
      const { data } = await api.get("/notes/shared-with-me");
      setShared(data);
    } catch {}
  };

  const fetchLabelsData = async () => {
    const data = await fetchLabels();
    setLabels(data);
  };

  // Note saved from editor (create or update)
  const handleSave = async (savedNote) => {
    if (savedNote.id && !String(savedNote.id).startsWith("temp_")) {
      // Update existing note — preserve note_password in the update payload
      const updatePayload = {
        title: savedNote.title,
        content: savedNote.content,
        color: savedNote.color,
        label_ids: savedNote.label_ids,
      };
      // If we have a verified password for this note, include it
      const pwd = verifiedPasswordsRef.current[savedNote.id];
      if (pwd) {
        updatePayload.note_password = pwd;
      }
      await handleUpdateNote(savedNote.id, updatePayload);
    } else {
      // Create new note
      await handleCreateNote({
        title: savedNote.title,
        content: savedNote.content,
        color: savedNote.color,
        label_ids: savedNote.label_ids,
      });
    }
    // Refresh shared notes in case sharing changed
    fetchShared();
  };

  const handleDelete = async (notePassword) => {
    const target = deletingNote;
    // If password provided, include it in the delete request
    if (notePassword) {
      try {
        await api.delete(`/notes/${target.id}`, {
          data: { note_password: notePassword },
        });
        setNotes((prev) => prev.filter((n) => n.id !== target.id));
        toast.success("Note deleted");
      } catch (error) {
        setNotes((prev) => [target, ...prev]);
        toast.error("Delete failed");
      }
      setDeletingNote(null);
      return;
    }
    await handleDeleteNote(target);
  };

  // Store verified password for a note (called from NoteEditor after unlock)
  // Uses the new sessionStore module
  const handlePasswordVerified = (noteId, password) => {
    sessionUnlock(noteId, password);
    setVerifiedPasswords((prev) => ({ ...prev, [noteId]: password }));
    verifiedPasswordsRef.current[noteId] = password;
  };

  const handleRemoveShared = async (note) => {
    // Optimistic update
    setShared((prev) => prev.filter((s) => s.share_id !== note._shareId));
    setRemovingNote(null);
    try {
      await api.delete(`/notes/${note.id}/shares/${user.id}`);
      toast.success("Removed yourself from this note");
    } catch {
      // Rollback
      fetchShared();
      toast.error("Failed to remove");
    }
  };

  const handleLabelClick = (labelId) => {
    setActiveLabel(labelId);
    setSidebarOpen(false);
  };

  const handleSectionClick = (section) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  return (
    <div className="app-layout" data-theme={theme}>
      <OfflineBanner online={online} />

      <Navbar
        search={search}
        setSearch={setSearch}
        searching={searching}
        view={view}
        setView={setView}
        theme={theme}
        toggleTheme={toggleTheme}
        onMenuClick={() => setSidebarOpen((s) => !s)}
      />

      <div className="app-body">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          labels={labels}
          activeLabel={activeLabel}
          setActiveLabel={handleLabelClick}
          onLabelsChange={setLabels}
          activeSection={activeSection}
          setActiveSection={handleSectionClick}
        />

        <main className="notes-main">
          <div className="notes-toolbar">
            <h2 className="notes-heading">
              {activeSection === "shared"
                ? "Shared with me"
                : activeLabel
                  ? `# ${labels.find((l) => l.id === activeLabel)?.name}`
                  : "All Notes"}
            </h2>
            <div className="notes-toolbar-actions">
              <div className="sort-controls">
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="created_at">Created</option>
                  <option value="updated_at">Updated</option>
                  <option value="title">Title</option>
                </select>
                <button
                  className="sort-dir-btn"
                  onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  title={sortDir === "desc" ? "Newest first" : "Oldest first"}
                >
                  {sortDir === "desc" ? "↓" : "↑"}
                </button>
              </div>
              {activeSection === "notes" && (
                <button
                  className="btn-primary-sm"
                  onClick={() => setCreatingOpen(true)}
                >
                  + New Note
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="notes-container">
              <section className="notes-section">
                <p className="notes-section-label skeleton-label">Pinned</p>
                <div className="note-grid">
                  <div className="skeleton note-skeleton" />
                  <div className="skeleton note-skeleton" />
                  <div className="skeleton note-skeleton" />
                </div>
              </section>
              <section className="notes-section">
                <p className="notes-section-label skeleton-label">Others</p>
                <div className="note-grid">
                  <div className="skeleton note-skeleton" />
                  <div className="skeleton note-skeleton" />
                  <div className="skeleton note-skeleton" />
                  <div className="skeleton note-skeleton" />
                  <div className="skeleton note-skeleton" />
                  <div className="skeleton note-skeleton" />
                </div>
              </section>
            </div>
          ) : (
            <NoteGrid
              notes={displayNotes}
              view={view}
              onEdit={setEditingNote}
              onDelete={setDeletingNote}
              onPin={handlePin}
              onRemove={(note) => setRemovingNote(note)}
              isSearching={!!debouncedSearch.trim()}
            />
          )}
        </main>
      </div>

      {/* New note editor */}
      {creatingOpen && (
        <NoteEditor
          note={null}
          labels={labels}
          onSave={handleSave}
          onClose={handleCreatorClose}
        />
      )}

      {/* Edit note editor */}
      {editingNote && (
        <NoteEditor
          note={editingNote}
          labels={labels}
          onSave={handleSave}
          onClose={() => setEditingNote(null)}
          readOnly={editingNote._permission === "read"}
          initialPassword={verifiedPasswords[editingNote.id] || ""}
          onPasswordVerified={handlePasswordVerified}
          isOwner={!editingNote._permission}
        />
      )}

      {/* Delete confirm */}
      {deletingNote && (
        <DeleteConfirmModal
          note={deletingNote}
          onConfirm={handleDelete}
          onCancel={() => setDeletingNote(null)}
        />
      )}

      {/* Remove-self confirm modal */}
      {removingNote && (
        <ConfirmRemoveModal
          note={removingNote}
          onConfirm={() => handleRemoveShared(removingNote)}
          onCancel={() => setRemovingNote(null)}
        />
      )}
    </div>
  );
}
