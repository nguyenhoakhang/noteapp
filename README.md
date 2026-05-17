# NoteApp — Final Project

A full-stack note-taking application with:
- Rich text editing
- Password-protected notes
- Note sharing with permissions
- Labels & search
- Offline support (PWA)
- Dark/light mode
- Docker deployment

## Quick Start

```bash
docker compose up -d --build
```

Then open **http://localhost:8080**

> ✅ No manual commands needed — migrations, key generation, storage links, and cache clearing are all automated in the backend startup script.

## Services

| Service   | URL                    | Description          |
|-----------|------------------------|----------------------|
| Frontend  | http://localhost:5173  | Vite dev server      |
| API       | http://localhost:8080  | Nginx → Laravel      |
| Mailpit   | http://localhost:8025  | Email preview UI     |

## Testing

### Docker Deployment Verification
```powershell
.\docker_test.ps1
```

### Full API Test (requires running containers)
```powershell
.\test_full.ps1
```

### Complete Test Suite (Docker + API)
```powershell
.\complete_test_suite.ps1
```

## Architecture

```
nginx (port 8080)
  ├── /api/* → backend (port 8000)
  ├── /storage/* → backend
  ├── /sanctum/* → backend
  └── /* → frontend (port 5173)

backend (Laravel)
  ├── MySQL (noteapp_mysql)
  ├── Mailpit (SMTP)
  └── Storage volume (uploads, avatars)

frontend (Vite + React)
  └── PWA with offline support
```

## Environment Variables

### Backend (backend/.env.example)
- `DB_HOST=mysql` — Docker service name
- `FRONTEND_URL=http://localhost:5173`
- `SANCTUM_STATEFUL_DOMAINS=localhost:5173,localhost:8080`

### Frontend (frontend/.env)
- `VITE_API_URL=http://localhost:8080/api` — Nginx proxy URL
