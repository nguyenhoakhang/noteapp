// src/offline/sessionStore.js — In-memory + sessionStorage password session manager
// Tracks which password-protected notes have been unlocked in the current session

const SESSION_KEY = 'verified_note_passwords'
const DEFAULT_TTL = 30 * 60 * 1000 // 30 minutes

// In-memory cache (faster than sessionStorage)
const unlocked = new Map()

// ── Initialize from sessionStorage on load ──
function init() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const now = Date.now()
      for (const [id, entry] of Object.entries(parsed)) {
        if (now - entry.verifiedAt < DEFAULT_TTL) {
          unlocked.set(id, entry)
        }
      }
    }
  } catch {}
}

// Initialize immediately
init()

// ── Persist to sessionStorage ──
function persist() {
  try {
    const obj = {}
    for (const [id, entry] of unlocked) {
      obj[id] = entry
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj))
  } catch {}
}

// ── Check if a note is unlocked ──
// Returns the password string if unlocked, null otherwise
export function isUnlocked(noteId) {
  if (!noteId) return null
  const entry = unlocked.get(noteId)
  if (!entry) return null
  if (Date.now() - entry.verifiedAt > DEFAULT_TTL) {
    unlocked.delete(noteId)
    persist()
    return null
  }
  return entry.password
}

// ── Mark a note as unlocked ──
export function unlock(noteId, password, ttl = DEFAULT_TTL) {
  if (!noteId) return
  unlocked.set(noteId, { password, verifiedAt: Date.now() })
  persist()
}

// ── Forget a note's password ──
export function invalidate(noteId) {
  unlocked.delete(noteId)
  persist()
}

// ── Clear all unlocked sessions ──
export function clearAll() {
  unlocked.clear()
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {}
}

// ── Get all unlocked note IDs ──
export function getUnlockedIds() {
  return Array.from(unlocked.keys())
}
