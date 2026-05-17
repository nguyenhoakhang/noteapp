import { useState } from "react";
import { Tag, Plus, Pencil, Trash2, Share2, StickyNote, X } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

export default function Sidebar({
  open = false,
  onClose,
  labels,
  activeLabel,
  setActiveLabel,
  onLabelsChange,
  activeSection,
  setActiveSection,
}) {
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const createLabel = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { data } = await api.post("/labels", { name: newName.trim() });
      onLabelsChange([...labels, data]);
      setNewName("");
      setAdding(false);
    } catch {
      toast.error("Failed to create label");
    }
  };

  const renameLabel = async (label) => {
    if (!editName.trim() || editName === label.name) return setEditing(null);
    try {
      const { data } = await api.put(`/labels/${label.id}`, {
        name: editName.trim(),
      });
      onLabelsChange(labels.map((l) => (l.id === label.id ? data : l)));
      setEditing(null);
    } catch {
      toast.error("Failed to rename");
    }
  };

  const deleteLabel = (label) => {
    setConfirmDelete(label);
  };

  const confirmDeleteLabel = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/labels/${confirmDelete.id}`);
      onLabelsChange(labels.filter((l) => l.id !== confirmDelete.id));
      if (activeLabel === confirmDelete.id) setActiveLabel(null);
      setConfirmDelete(null);
      toast.success(`Label "${confirmDelete.name}" deleted`);
    } catch {
      toast.error("Failed to delete");
      setConfirmDelete(null);
    }
  };

  const handleItemClick = (callback) => {
    if (onClose) onClose();
    callback();
  };

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <div
          className={`sidebar-item ${activeSection === "notes" && !activeLabel ? "active" : ""}`}
          onClick={() =>
            handleItemClick(() => {
              setActiveSection("notes");
              setActiveLabel(null);
            })
          }
        >
          <StickyNote size={15} /> All Notes
        </div>
        <div
          className={`sidebar-item ${activeSection === "shared" ? "active" : ""}`}
          onClick={() =>
            handleItemClick(() => {
              setActiveSection("shared");
              setActiveLabel(null);
            })
          }
        >
          <Share2 size={15} /> Shared with me
        </div>

        <div className="sidebar-section-title">
          <Tag size={14} /> Labels
          <button onClick={() => setAdding(true)} title="New label">
            <Plus size={14} />
          </button>
        </div>

        {adding && (
          <form onSubmit={createLabel} className="label-add-form">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Label name"
            />
            <button type="submit">Add</button>
            <button type="button" onClick={() => setAdding(false)}>
              <X size={14} />
            </button>
          </form>
        )}

        {labels.map((label) => (
          <div
            key={label.id}
            className={`sidebar-item label-item ${activeLabel === label.id ? "active" : ""}`}
            onClick={() =>
              handleItemClick(() => {
                setActiveLabel(label.id);
                setActiveSection("notes");
              })
            }
          >
            {editing === label.id ? (
              <input
                autoFocus
                className="label-rename-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => renameLabel(label)}
                onKeyDown={(e) => e.key === "Enter" && renameLabel(label)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="label-name"># {label.name}</span>
            )}
            <div className="label-actions" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  setEditing(label.id);
                  setEditName(label.name);
                }}
              >
                <Pencil size={12} />
              </button>
              <button onClick={() => deleteLabel(label)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </aside>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div
            className="modal"
            style={{ maxWidth: "380px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--danger">
                <Trash2 size={20} />
              </div>
              <h3>Delete label?</h3>
              <button onClick={() => setConfirmDelete(null)} className="modal-close-btn">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Delete label <strong>"{confirmDelete.name}"</strong>? Notes with this
                label will not be deleted.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmDeleteLabel}>
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
