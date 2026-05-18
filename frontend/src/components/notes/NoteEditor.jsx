import { useState, useEffect, useRef, useCallback } from "react";
import { X, Lock, Share2, Paperclip, Trash2 } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";
import ShareModal from "./ShareModal";
import NotePasswordModal from "./NotePasswordModal";
import useAuthStore from "../../store/authStore";
import { createNote, updateNote } from "../../api/offlineApi";
import RichNoteEditor from "../editor/RichNoteEditor";

const COLORS = [
  "#ffffff",
  "#fef9c3",
  "#d1fae5",
  "#dbeafe",
  "#fce7f3",
  "#ede9fe",
  "#ffedd5",
  "#f1f5f9",
];
const AUTOSAVE_DELAY = 1500;

export default function NoteEditor({
  note,
  labels,
  onSave,
  onClose,
  readOnly = false,
  initialPassword = "",
  onPasswordVerified,
  isOwner = false,
}) {
  const isNew = !note?.id;
  const [form, setForm] = useState({
    title: note?.title || "",
    content: note?.content || "",
    color: note?.color || "#ffffff",
    label_ids: note?.labels?.map((l) => l.id) || [],
  });
  const [loadingFull, setLoadingFull] = useState(false);

  // Fetch full note from show endpoint when mounting (fixes content loss + share sync)
  useEffect(() => {
    if (!note?.id) return;
    if (note?.content && note.content.length > 500) return; // already full content
    setLoadingFull(true);

    const params = {};
    if (initialPassword) {
      params.note_password = initialPassword;
    }

    api
      .get(`/notes/${note.id}`, { params })
      .then(({ data }) => {
        const n = data?.data ?? data;
        if (n) {
          setForm({
            title: n.title || "",
            content: n.content || "",
            color: n.color || "#ffffff",
            label_ids: n.labels?.map((l) => l.id) || [],
          });
          setAttachments(n.attachments || []);
          setIsProtected(n.is_protected || false);
          setNoteData(n);
          // If we got content back, the password was accepted — mark as unlocked
          if (initialPassword) {
            setLocked(false);
            setUnlockedOnce(true);
            unlockedOnceRef.current = true;
            notePasswordRef.current = initialPassword;
          }
          // If note is protected but we got content back (backend cache was valid),
          // unlock the editor without requiring password re-entry
          // NOTE: Only unlock if initialPassword was provided (not for owners who bypass password)
          if (initialPassword && note?.is_protected && n.content) {
            setLocked(false);
            setUnlockedOnce(true);
            unlockedOnceRef.current = true;
            // Try to find the password from sessionStorage
            try {
              const stored = JSON.parse(sessionStorage.getItem("verified_note_passwords") || "{}");
              const entry = stored[note.id];
              if (entry?.password) {
                notePasswordRef.current = entry.password;
              }
            } catch {}
          }
        }
      })
      .catch((err) => {
        console.error("Failed to fetch note:", err);
        // Handle password-protected notes that need unlock
        if (err?.response?.status === 403 && err?.response?.data?.needs_unlock) {
          setLocked(true);
          return;
        }
        toast.error("Failed to load note content");
      })
      .finally(() => setLoadingFull(false));
  }, [note?.id, initialPassword]);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(""); // "" | "saving" | "saved" | "failed" | "offline"
  const [noteId, setNoteId] = useState(note?.id || null);
  const [dirty, setDirty] = useState(false);
  const [isProtected, setIsProtected] = useState(note?.is_protected || false);

  // Refs MUST be declared before any useState that references them
  const notePasswordRef = useRef("");
  const unlockedOnceRef = useRef(false);

  // Password unlock state — check sessionStorage cache first
  const [locked, setLocked] = useState(() => {
    if (!note?.is_protected) return false;
    // Check if password was cached in sessionStorage (from NotesPage)
    if (initialPassword) {
      notePasswordRef.current = initialPassword;
      unlockedOnceRef.current = true;
      return false;
    }
    // Check if backend cache is likely valid (within 1 hour of last verify)
    try {
      const stored = JSON.parse(sessionStorage.getItem("verified_note_passwords") || "{}");
      const entry = stored[note.id];
      if (entry && Date.now() - entry.verifiedAt < 55 * 60 * 1000) {
        notePasswordRef.current = entry.password;
        unlockedOnceRef.current = true;
        return false; // backend cache should still be valid
      }
    } catch {}
    return true;
  });
  const [notePassword, setNotePassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unlockedOnce, setUnlockedOnce] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState(note?.attachments || []);
  const fileRef = useRef();
  const lastSavedRef = useRef(form);
  const isSavingRef = useRef(false);
  const [showShare, setShowShare] = useState(false);
  const [noteData, setNoteData] = useState(note);
  const { user } = useAuthStore();
  const token = localStorage.getItem("token");

  // Solo mode hook (regular Tiptap)
  const [soloContent, setSoloContent] = useState(form.content);
  const editorRef = useRef(null);

  // For solo mode, we use RichNoteEditor's onChange directly
  const handleContentChange = (html) => {
    setForm((f) => ({ ...f, content: html }));
    setSoloContent(html);
  };

  const timerRef = useRef();

  // Track mouse position to prevent accidental close on drag
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const handleMouseDown = useCallback((e) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Build save payload with note_password if unlocked
  const buildSavePayload = useCallback((data) => {
    const payload = { ...data };
    if (unlockedOnceRef.current && notePasswordRef.current) {
      payload.note_password = notePasswordRef.current;
    }
    return payload;
  }, []);

  // Helper to update save status with auto-clear
  const showSaveStatus = useCallback((status) => {
    setSaveStatus(status);
    if (status === "saved") {
      setTimeout(() => setSaveStatus(""), 2000);
    }
  }, []);

  const autoSave = useCallback(
    async (data, id) => {
      setSaving(true);
      showSaveStatus("saving");
      try {
        let saved;
        const saveData = buildSavePayload(data);
        if (!id) {
          saved = await createNote(saveData);
          setNoteId(saved.id);
        } else {
          saved = await updateNote(id, saveData);
        }
        showSaveStatus("saved");
        onSave?.(saved);
        return saved?.id;
      } catch (err) {
        // Handle session expiry — re-lock the editor
        if (err?.response?.status === 403 && err?.response?.data?.needs_unlock) {
          setLocked(true);
          setUnlockedOnce(false);
          unlockedOnceRef.current = false;
          notePasswordRef.current = '';
          toast.error('Session expired. Please unlock again.');
          return;
        }
        showSaveStatus("failed");
        toast.error("Save failed");
      } finally {
        setSaving(false);
      }
    },
    [onSave, buildSavePayload, showSaveStatus],
  );

  const saveNow = useCallback(
    async (data, id) => {
      if (isSavingRef.current) return;
      if (!id && !data.title?.trim() && !data.content?.trim()) return;

      isSavingRef.current = true;
      setSaving(true);
      showSaveStatus("saving");
      try {
        let saved;
        const saveData = buildSavePayload(data);
        if (!id) {
          saved = await createNote(saveData);
          setNoteId(saved.id);
          id = saved.id;
        } else {
          saved = await updateNote(id, saveData);
        }
        lastSavedRef.current = structuredClone(data);
        setDirty(false);
        showSaveStatus("saved");
        onSave?.(saved);
        return id;
      } catch (err) {
        // Handle session expiry — re-lock the editor
        if (err?.response?.status === 403 && err?.response?.data?.needs_unlock) {
          setLocked(true);
          setUnlockedOnce(false);
          unlockedOnceRef.current = false;
          notePasswordRef.current = '';
          toast.error('Session expired. Please unlock again.');
          return;
        }
        showSaveStatus("failed");
        // Don't clear dirty — retry on next change
        toast.error("Save failed");
      } finally {
        setSaving(false);
        isSavingRef.current = false;
      }
    },
    [onSave, buildSavePayload, showSaveStatus],
  );

  useEffect(() => {
    if (readOnly || locked) return;
    const hasChanges =
      form.title !== lastSavedRef.current.title ||
      form.content !== lastSavedRef.current.content ||
      form.color !== lastSavedRef.current.color ||
      JSON.stringify(form.label_ids) !==
        JSON.stringify(lastSavedRef.current.label_ids);

    if (!hasChanges) return;
    setDirty(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveNow(form, noteId), 1500);
    return () => clearTimeout(timerRef.current);
  }, [form, readOnly, locked, noteId, saveNow]);

  const setFormField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleClose = async () => {
    clearTimeout(timerRef.current);
    if (dirty && !readOnly && !locked) {
      await saveNow(form, noteId);
    }
    onClose();
  };

  const toggleLabel = (id) => {
    setFormField(
      "label_ids",
      form.label_ids.includes(id)
        ? form.label_ids.filter((i) => i !== id)
        : [...form.label_ids, id],
    );
  };

  const unlock = async () => {
    setUnlocking(true);
    try {
      await api.post(`/notes/${noteId}/verify-password`, {
        note_password: notePassword,
      });
      const { data } = await api.get(`/notes/${noteId}`, {
        params: { note_password: notePassword },
      });
      // Handle API Resource wrapping: response is { data: { ...noteFields } }
      const n = data?.data ?? data;
      setForm({
        title: n.title || "",
        content: n.content || "",
        color: n.color,
        label_ids: n.labels?.map((l) => l.id) || [],
      });
      setLocked(false);
      // Track that we've unlocked so auto-save includes the password
      setUnlockedOnce(true);
      unlockedOnceRef.current = true;
      notePasswordRef.current = notePassword;
      // Notify parent so it can store the password for future re-opens
      if (onPasswordVerified) {
        onPasswordVerified(noteId, notePassword);
      }
    } catch {
      toast.error("Wrong password");
    } finally {
      setUnlocking(false);
    }
  };

  const uploadFiles = async (files) => {
    const fileArray = Array.from(files);
    // Validate each file
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain"];
    for (const f of fileArray) {
      if (f.size > MAX_SIZE) {
        toast.error(`"${f.name}" exceeds 10MB limit`);
        return;
      }
      if (!allowedTypes.includes(f.type) && !f.type.startsWith("image/")) {
        toast.error(`"${f.name}" has unsupported file type`);
        return;
      }
    }
    const fd = new FormData();
    fileArray.forEach((f) => fd.append("files[]", f));
    // Include note_password if unlocked
    if (unlockedOnceRef.current && notePasswordRef.current) {
      fd.append("note_password", notePasswordRef.current);
    }
    try {
      const { data } = await api.post(`/notes/${noteId}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachments((a) => [...a, ...data]);
    } catch {
      toast.error("Upload failed");
    }
  };


  const deleteAttachment = async (att) => {
    try {
      await api.delete(`/attachments/${att.id}`);
      setAttachments((a) => a.filter((x) => x.id !== att.id));
    } catch {
      toast.error("Delete failed");
    }
  };

  const handlePasswordChanged = (protectedState, newPassword) => {
    setIsProtected(protectedState);
    setNoteData((prev) => ({ ...prev, is_protected: protectedState }));
    if (protectedState && newPassword) {
      // Cache the password so owner doesn't get locked out immediately
      notePasswordRef.current = newPassword;
      unlockedOnceRef.current = true;
      setUnlockedOnce(true);
      setLocked(false);
      // Also store in sessionStorage for future re-opens
      try {
        const stored = JSON.parse(sessionStorage.getItem("verified_note_passwords") || "{}");
        stored[noteId] = { password: newPassword, verifiedAt: Date.now() };
        sessionStorage.setItem("verified_note_passwords", JSON.stringify(stored));
      } catch {}
    }
    toast.success(protectedState ? "Password set" : "Password removed");
  };

  // Render save status indicator
  const renderSaveStatus = () => {
    if (saveStatus === "saving") return "💾 Saving…";
    if (saveStatus === "saved") return "✓ Saved";
    if (saveStatus === "failed") return "✗ Failed to save";
    return "";
  };

  if (locked) {
    return (
      <div className="unlock-note-overlay" onClick={handleClose}>
        <div className="unlock-note-modal" onClick={(e) => e.stopPropagation()}>
          <div className="unlock-icon">🔒</div>
          <h3>Password Required</h3>
          <p>This note is password protected. Please enter the password to view it.</p>
          <div className="form-group">
            <input
              type="password"
              className="form-control"
              value={notePassword}
              autoFocus
              onChange={(e) => setNotePassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              placeholder="Enter note password"
            />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              className="btn-primary-sm"
              onClick={unlock}
              disabled={unlocking}
            >
              {unlocking ? "Checking…" : "Unlock"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="modal-overlay" onMouseDown={handleMouseDown} onClick={(e) => {
        // Only close if mouse didn't move significantly (intentional click, not drag)
        const dx = Math.abs(e.clientX - mouseDownPos.current.x);
        const dy = Math.abs(e.clientY - mouseDownPos.current.y);
        if (dx > 5 || dy > 5) return;
        handleClose();
      }}>
        <div className="note-editor" style={{ "--note-bg": form.color }} onClick={(e) => e.stopPropagation()}>
          {/* Header — NO background color from note */}
          <div className="editor-header">
            <input
              className="editor-title"
              placeholder="Title"
              value={form.title}
              readOnly={readOnly}
              onChange={(e) => setFormField("title", e.target.value)}
            />
            <div className="editor-header-actions">
              <span className={`autosave-status ${saveStatus === "failed" ? "autosave-status--failed" : ""}`}>
                {renderSaveStatus()}
              </span>
              {noteId && !readOnly && (
                <button onClick={() => setShowShare(true)} title="Share note">
                  <Share2 size={16} />
                </button>
              )}
              <button onClick={handleClose}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content — color tinted via CSS using --note-bg on .note-editor */}
          <div className="editor-body">
            <RichNoteEditor
              noteId={noteId}
              content={form.content}
              readOnly={readOnly || locked}
              onChange={handleContentChange}
              onImageUploaded={(att) => setAttachments((a) => [...a, att])}
              onImageDeleted={(src) => {
                // Khi ảnh bị xóa khỏi editor, tìm attachment tương ứng và xóa
                const path = src.replace("/storage/", "");
                const att = attachments.find((a) => a.path === path);
                if (att) deleteAttachment(att);
              }}
            />

          </div>

          {/* Color picker */}
          {!readOnly && (
            <div className="editor-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-dot ${form.color === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setFormField("color", c)}
                />
              ))}
            </div>
          )}

          {/* Labels */}
          <div className="editor-labels">
            {labels.map((l) => (
              <button
                key={l.id}
                className={`label-chip ${form.label_ids.includes(l.id) ? "active" : ""}`}
                onClick={() => !readOnly && toggleLabel(l.id)}
              >
                {l.name}
              </button>
            ))}
          </div>

          {/* Footer với nút password */}
          <div className="editor-footer">
            {!readOnly && (
              <button
                className="btn-icon"
                onClick={() => {
                  if (!noteId || String(noteId).startsWith("temp_")) {
                    toast.error("Save the note first before setting a password");
                    return;
                  }
                  setShowPasswordModal(true);
                }}
                title={
                  !noteId || String(noteId).startsWith("temp_")
                    ? "Save the note first"
                    : isProtected
                      ? "Change/remove password"
                      : "Set password"
                }
              >
                <Lock size={14} />
                {isProtected ? "Protected" : "Add password"}
              </button>
            )}
          </div>

          {/* Attachments */}
          {noteId && (
            <div className="editor-attachments">
              {attachments.map((att) => (
                <div key={att.id} className="attachment-item">
                  {att.mime_type?.startsWith("image/") ? (
                    <img
                      src={`/storage/${att.path}`}
                      alt={att.filename}
                      className="attachment-thumb"
                    />
                  ) : (
                    <a
                      href={`/storage/${att.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📎 {att.filename}
                    </a>
                  )}
                  {!readOnly && (
                    <button
                      className="attachment-delete"
                      onClick={() => deleteAttachment(att)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <>
                  <button
                    className="btn-icon"
                    onClick={() => fileRef.current.click()}
                  >
                    <Paperclip size={15} /> Attach
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => uploadFiles(e.target.files)}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Share Modal — rendered OUTSIDE note-editor to avoid overflow:hidden clipping */}
      {showShare && (
        <ShareModal
          note={{
            id: noteId,
            title: form.title || note?.title || "Untitled",
            shares: attachments,
            is_protected: noteData?.is_protected,
          }}
          onClose={() => setShowShare(false)}
          onUpdate={() => onSave?.({ ...noteData, id: noteId })}
        />
      )}

      {/* Note Password Modal — rendered OUTSIDE note-editor to avoid overflow:hidden clipping */}
      {showPasswordModal && (
        <NotePasswordModal
          isProtected={isProtected}
          noteId={noteId}
          onClose={() => setShowPasswordModal(false)}
          onChanged={handlePasswordChanged}
        />
      )}
    </>
  );
}
