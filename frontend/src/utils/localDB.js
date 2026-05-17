// src/utils/localDB.js — IndexedDB wrapper, no deps
const DB_NAME = "noteapp";
const DB_VERSION = 1;
const STORES = ["notes", "labels", "sync_queue"];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("notes")) {
        const s = db.createObjectStore("notes", { keyPath: "id" });
        s.createIndex("updated_at", "updated_at");
        s.createIndex("user_id", "user_id");
      }
      if (!db.objectStoreNames.contains("labels")) {
        db.createObjectStore("labels", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sync_queue")) {
        const q = db.createObjectStore("sync_queue", {
          keyPath: "qid",
          autoIncrement: true,
        });
        q.createIndex("created_at", "created_at");
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = fn(store);
    if (req) {
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    } else {
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    }
  });
}

// Notes
export const localDB = {
  // Notes
  async getAllNotes() {
    return tx("notes", "readonly", (s) => s.getAll());
  },
  async getNote(id) {
    return tx("notes", "readonly", (s) => s.get(id));
  },
  async putNote(note) {
    return tx("notes", "readwrite", (s) => s.put(note));
  },
  async putNotes(notes) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction("notes", "readwrite");
      const s = t.objectStore("notes");
      notes.forEach((n) => s.put(n));
      t.oncomplete = resolve;
      t.onerror = (e) => reject(e.target.error);
    });
  },
  async deleteNote(id) {
    return tx("notes", "readwrite", (s) => s.delete(id));
  },
  async clearNotes() {
    return tx("notes", "readwrite", (s) => s.clear());
  },

  // Merge notes from list API without overwriting full content
  async mergeNotes(notes) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction("notes", "readwrite");
      const s = t.objectStore("notes");
      notes.forEach((incoming) => {
        // Try to get existing note from IndexedDB
        const getReq = s.get(incoming.id);
        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (existing && existing.content && existing.content.length > 500) {
            // Existing has full content — preserve it, only update metadata
            const merged = { ...existing };
            // Update fields that come from list API (metadata only)
            if (incoming.title !== undefined) merged.title = incoming.title;
            if (incoming.color !== undefined) merged.color = incoming.color;
            if (incoming.is_pinned !== undefined) merged.is_pinned = incoming.is_pinned;
            if (incoming.pinned_at !== undefined) merged.pinned_at = incoming.pinned_at;
            if (incoming.is_protected !== undefined) merged.is_protected = incoming.is_protected;
            if (incoming.is_shared !== undefined) merged.is_shared = incoming.is_shared;
            if (incoming.updated_at !== undefined) merged.updated_at = incoming.updated_at;
            if (incoming.labels !== undefined) merged.labels = incoming.labels;
            if (incoming.shares_count !== undefined) merged.shares_count = incoming.shares_count;
            s.put(merged);
          } else {
            // No existing full content — just save incoming (preview is fine)
            s.put(incoming);
          }
        };
        getReq.onerror = () => {
          // Can't read existing, just save incoming
          s.put(incoming);
        };
      });
      t.oncomplete = resolve;
      t.onerror = (e) => reject(e.target.error);
    });
  },

  // Labels
  async getAllLabels() {
    return tx("labels", "readonly", (s) => s.getAll());
  },
  async putLabels(labels) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction("labels", "readwrite");
      const s = t.objectStore("labels");
      s.clear();
      labels.forEach((l) => s.put(l));
      t.oncomplete = resolve;
      t.onerror = (e) => reject(e.target.error);
    });
  },

  // Sync queue (offline mutations)
  async enqueue(item) {
    return tx("sync_queue", "readwrite", (s) =>
      s.put({ ...item, created_at: Date.now() }),
    );
  },
  async getQueue() {
    return tx("sync_queue", "readonly", (s) => s.getAll());
  },
  async dequeue(qid) {
    if (!qid) return;
    return tx("sync_queue", "readwrite", (s) => s.delete(qid));
  },
  async clearQueue() {
    return tx("sync_queue", "readwrite", (s) => s.clear());
  },
};
