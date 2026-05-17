# Task Progress — Bug Fixes Complete

## Bug 1 (🔴): Owner gets 403 on password-protected note
- [x] Fix `NoteController@show` — return `needs_unlock` for owner too when note is password-protected
- [x] Fix `NoteController@verifyPassword` — accept `note_password` field (not `password`)
- [x] Fix `NoteController@removePassword` — accept `current_password` field (not `password`)
- [x] Fix `NoteResource` — hide content when `needs_unlock` for owner too
- [x] Fix `NoteEditor.jsx` — add `isOwner` prop, fix `locked` state init, fix `unlock()` API response unwrapping
- [x] Fix `NotesPage.jsx` — pass `isOwner={!editingNote._permission}`
- [x] Fix `SharedWithMePage.jsx` — pass `isOwner={false}`, fix `displayNotes` mapping, fix password propagation
- [x] Rebuild Docker image and restart containers
- [x] **test_bugs.ps1: 14/14 PASS** ✅
- [x] **test_full.ps1: 20/20 PASS** ✅

## Bug 2 (🟡): CSS cleanup
- [x] Remove collab CSS from editor.css
- [x] Remove `!important` from components.css
- [x] Remove skeleton duplicate (base.css vs components.css)
- [x] Remove color-dot duplicate (layout.css vs editor.css)
- [x] Remove search loading bar / spinner duplicate
- [x] Remove attachment-item duplicate in editor.css
