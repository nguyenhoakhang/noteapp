# NoteApp — Final Project

A full-stack note-taking application with rich text editing, password-protected notes, sharing with permissions, labels, offline PWA support, and dark/light mode.

**Tech Stack:** Laravel 13 (backend) + React 19 (frontend) + MySQL 8 + Nginx + Docker

---

## Table of Contents

- [Quick Start (Docker)](#quick-start-docker)
- [Manual Setup (Without Docker)](#manual-setup-without-docker)
- [Services & URLs](#services--urls)
- [Pre-loaded Test Accounts](#pre-loaded-test-accounts)
- [Features Overview](#features-overview)
- [Optional Features (Extra Credit)](#optional-features-extra-credit)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Quick Start (Docker)

**Prerequisites:** Docker Desktop (or Docker Compose v2)

```bash
# 1. Clone the project
git clone <repo-url> noteapp
cd noteapp

# 2. Start all services (build + run)
docker compose up -d --build
```

> **No manual commands needed.** The backend startup script (`backend/docker/start.sh`) automatically:
> - Waits for MySQL to be healthy
> - Runs `composer install` if vendor/ is missing
> - Copies `.env.example` to `.env` if not present
> - Generates `APP_KEY`
> - Creates `storage:link`
> - Runs `migrate --force`
> - Clears config cache

**Wait ~60 seconds** for all services to be ready, then open:

**http://localhost:8080**

### Stopping

```bash
docker compose down
```

### Rebuilding after code changes

```bash
docker compose build backend   # Rebuild backend (PHP code is baked into image)
docker compose up -d           # Recreate containers
```

> **Note:** The backend Docker image bakes the source code at build time (`COPY . .` in Dockerfile). The frontend uses a volume mount, so changes are hot-reloaded automatically.

---

## Manual Setup (Without Docker)

### Backend (Laravel)

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan storage:link
php artisan migrate

# Start dev server
php artisan serve --host=0.0.0.0 --port=8000
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev -- --host
```

### Database

Requires MySQL running on localhost:3306 with database `noteapp`, user `noteapp`, password `noteapp`.

### Nginx (optional, for unified port)

```bash
# Edit nginx/default.conf to point to your local services
# Then run nginx on port 8080
```

---

## Services & URLs

| Service   | URL                    | Description                     |
|-----------|------------------------|---------------------------------|
| Frontend  | http://localhost:5173  | Vite dev server (HMR enabled)   |
| **App**   | **http://localhost:8080** | **Nginx → unified entry point** |
| API       | http://localhost:8080/api | Laravel API via Nginx proxy   |
| Mailpit   | http://localhost:8025  | Email preview UI (SMTP :1025)   |

> **Always use http://localhost:8080** for the full application experience. The frontend at :5173 is the raw dev server.

---

## Pre-loaded Test Accounts

The database is automatically seeded with demo data on first deployment. Use these accounts to log in:

| Account | Email                | Password   | Notes & Data                                                                 |
|---------|----------------------|------------|------------------------------------------------------------------------------|
| User A  | `userA@example.com`  | `password` | 3 notes (1 pinned, 1 password-protected with password `secret123`), 3 labels |
| User B  | `userB@example.com`  | `password` | 2 notes (1 pinned), 3 labels, 1 shared note from User A (read-only)          |

### Demo Data Details

**User A's notes:**
1. **Welcome to NoteApp** (pinned, yellow) — Rich text demo with formatting
2. **Shopping List** (green) — Simple checklist
3. **Secret Note** (pink, password: `secret123`) — Password-protected note

**User B's notes:**
1. **Project Alpha** (pinned, blue) — Project plan with numbered list
2. **Study Notes** (orange) — Database design study material

**Sharing:** User A's "Welcome to NoteApp" is shared with User B (read-only permission).

### Re-running the Seeder

If you need to reset the demo data:

```bash
docker compose exec backend php artisan db:seed --force
```


---

## Features Overview

### Core Features

| Feature               | Description                                              |
|------------------------|----------------------------------------------------------|
| **User Authentication** | Register, login, logout (Sanctum token-based)           |
| **Email Verification**  | Optional email verification flow                         |
| **Password Reset**      | Forgot password via email link or OTP                    |
| **Rich Text Editor**    | TipTap editor with headings, bold, italic, lists, etc.   |
| **Note CRUD**           | Create, read, update, delete notes                       |
| **Note Colors**         | Assign colors to notes for visual organization           |
| **Pin Notes**           | Pin important notes to the top                           |
| **Labels**              | Create labels and attach them to notes                   |
| **Search**              | Search notes by title and content                        |
| **Note Sharing**        | Share notes with other users (read/edit permissions)     |
| **Password Protection** | Lock notes with a password (owner + shared users both need it) |
| **Dark/Light Mode**     | Toggle between dark and light themes                     |
| **User Preferences**    | Update profile, change password, upload avatar           |
| **Link Previews**       | Auto-fetch Open Graph metadata when pasting links        |
| **Attachments**         | Upload file attachments to notes                         |

### Optional Features (Extra Credit)

The following optional features have been implemented:

1. **Password-Protected Notes** — Notes can be locked with a password. Both the owner AND shared users must provide the password to view the content. The owner can set, change, and remove the password at any time.

2. **Offline Support (PWA)** — The frontend is a Progressive Web App with:
   - Service worker for caching
   - IndexedDB-based offline storage (`idb` library)
   - Sync queue for offline operations
   - Session store for offline auth
   - Manifest file for installability

3. **Email Integration** — Using Mailpit for email preview:
   - Email verification
   - Password reset links
   - OTP-based password reset
   - Share notifications

4. **Link Preview** — When pasting a URL in the editor, the app fetches Open Graph metadata (title, description, image) and displays a rich preview.

---

## API Endpoints

All API endpoints are prefixed with `/api`.

### Public

| Method | Endpoint                  | Description              |
|--------|---------------------------|--------------------------|
| POST   | `/register`               | Register new user        |
| POST   | `/login`                  | Login                    |
| GET    | `/email/verify/{id}/{hash}` | Verify email           |
| POST   | `/forgot-password`        | Send password reset link |
| POST   | `/reset-password`         | Reset password           |
| POST   | `/auth/otp/send`          | Send OTP                 |
| POST   | `/auth/otp/verify`        | Verify OTP               |
| POST   | `/auth/otp/reset`         | Reset with OTP           |
| GET    | `/health`                 | Health check             |

### Protected (requires `Authorization: Bearer <token>`)

#### Auth & User

| Method | Endpoint                        | Description              |
|--------|----------------------------------|--------------------------|
| POST   | `/logout`                        | Logout                   |
| GET    | `/me`                            | Get current user         |
| POST   | `/email/verification-notification` | Resend verification   |
| PATCH  | `/user/preferences`              | Update preferences       |
| PATCH  | `/user/profile`                  | Update profile           |
| POST   | `/user/change-password`          | Change password          |
| POST   | `/user/avatar`                   | Upload avatar            |
| GET    | `/users/search`                  | Search users             |

#### Notes

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| GET    | `/notes`                              | List user's notes              |
| POST   | `/notes`                              | Create note                    |
| GET    | `/notes/{id}`                         | Get single note                |
| PUT    | `/notes/{id}`                         | Update note                    |
| DELETE | `/notes/{id}`                         | Delete note                    |
| GET    | `/notes/shared-with-me`               | List notes shared with me      |
| POST   | `/notes/{id}/pin`                     | Toggle pin                     |
| POST   | `/notes/{id}/set-password`            | Set password protection        |
| POST   | `/notes/{id}/verify-password`         | Verify note password           |
| POST   | `/notes/{id}/password`                | Set password (alias)           |
| PUT    | `/notes/{id}/password`                | Change password                |
| DELETE | `/notes/{id}/password`                | Remove password                |

#### Sharing

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| GET    | `/notes/{id}/shares`                  | List shares for a note         |
| POST   | `/notes/{id}/shares`                  | Share note with user           |
| PUT    | `/notes/{id}/shares/{userId}`         | Update share permission        |
| DELETE | `/notes/{id}/shares/{userId}`         | Revoke share                   |

#### Labels

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| GET    | `/labels`                             | List labels                    |
| POST   | `/labels`                             | Create label                   |
| PUT    | `/labels/{id}`                        | Update label                   |
| DELETE | `/labels/{id}`                        | Delete label                   |

#### Attachments

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| POST   | `/notes/{id}/attachments`             | Upload attachment              |
| DELETE | `/attachments/{id}`                   | Delete attachment              |

#### Link Preview

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| GET    | `/link-preview?url=...`               | Fetch link preview metadata    |

---

## Testing

All test scripts are in the project root and require running Docker containers.

### 1. Docker Deployment Verification

Checks that all config files, Dockerfiles, and startup scripts are correctly structured:

```powershell
.\docker_test.ps1
```

### 2. Full API Test

Tests all API endpoints end-to-end (auth, notes, password protection, labels, sharing, delete):

```powershell
.\test_full.ps1
```

### 3. Bug-Specific Test

Tests the password protection flow for both owner and shared users:

```powershell
.\test_bugs.ps1
```

### 4. Complete Test Suite

Combines Docker verification + API testing + response time benchmarks:

```powershell
.\complete_test_suite.ps1
```

### Test Results (Verified)

| Test Suite               | Tests | Status |
|--------------------------|-------|--------|
| `docker_test.ps1`        | 25    | ✅ All PASS |
| `test_full.ps1`          | 20    | ✅ All PASS |
| `test_bugs.ps1`          | 14    | ✅ All PASS |
| `complete_test_suite.ps1`| 40+   | ✅ All PASS |

---

## Architecture

```
nginx (port 8080) — unified entry point
  ├── /api/*        → backend (port 8000) — Laravel artisan serve
  ├── /storage/*    → backend — file uploads
  ├── /sanctum/*    → backend — CSRF cookie routes
  └── /*            → frontend (port 5173) — Vite dev server

backend (Laravel 13)
  ├── MySQL 8 (noteapp_mysql) — persistent via mysql_data volume
  ├── Mailpit (SMTP :1025, UI :8025) — email preview
  └── Storage volume (backend_storage) — uploads, avatars

frontend (React 19 + Vite 8)
  ├── TipTap rich text editor
  ├── PWA with offline support (service worker + IndexedDB)
  └── Hot Module Replacement enabled
```

### Docker Volumes

| Volume             | Purpose                        |
|--------------------|--------------------------------|
| `mysql_data`       | Persistent MySQL database      |
| `backend_storage`  | Persistent file uploads/avatars|

### Key Design Decisions

- **Backend code is baked into the Docker image** (not mounted as a volume) for production-like behavior. Rebuild with `docker compose build backend` after code changes.
- **Frontend uses a volume mount** for hot-reloading during development.
- **Nginx** serves as a unified reverse proxy, routing `/api/*` to Laravel and `/*` to the Vite dev server.
- **Sanctum** handles API authentication with token-based auth (no session cookies needed for SPA).

---

## Environment Variables

### Backend (`backend/.env.example`)

| Variable                  | Default Value                  | Description                    |
|---------------------------|--------------------------------|--------------------------------|
| `APP_NAME`                | NoteApp                        | Application name               |
| `APP_ENV`                 | local                          | Environment                    |
| `APP_DEBUG`               | true                           | Debug mode                     |
| `APP_URL`                 | http://localhost:8080          | Application URL                |
| `DB_HOST`                 | mysql                          | MySQL host (Docker service)    |
| `DB_PORT`                 | 3306                           | MySQL port                     |
| `DB_DATABASE`             | noteapp                        | Database name                  |
| `DB_USERNAME`             | noteapp                        | Database user                  |
| `DB_PASSWORD`             | noteapp                        | Database password              |
| `FRONTEND_URL`            | http://localhost:5173          | Frontend URL for CORS          |
| `SANCTUM_STATEFUL_DOMAINS`| localhost:5173,localhost:8080  | Sanctum stateful domains       |
| `MAIL_MAILER`             | smtp                           | Mail driver                    |
| `MAIL_HOST`               | mailpit                        | SMTP host (Docker service)     |
| `MAIL_PORT`               | 1025                           | SMTP port                      |

### Frontend (`frontend/.env`)

| Variable         | Default Value                 | Description                    |
|------------------|-------------------------------|--------------------------------|
| `VITE_API_URL`   | http://localhost:8080/api     | API base URL (via Nginx proxy) |

---

## Troubleshooting

### "Connection refused" when accessing http://localhost:8080

Wait ~60 seconds for all services to start. Check container status:

```bash
docker compose ps
```

### Backend changes not taking effect

The backend code is baked into the Docker image. Rebuild and restart:

```bash
docker compose build backend
docker compose up -d
```

### MySQL connection errors

Check that MySQL is healthy:

```bash
docker compose logs mysql
```

### Frontend not loading

Check frontend logs:

```bash
docker compose logs frontend
```

### Email not sending

Check Mailpit UI at http://localhost:8025. Emails are captured by Mailpit and not actually sent.

### "No token" on API calls

Make sure to include the `Authorization: Bearer <token>` header. Tokens are obtained from `/api/login` or `/api/register`.

---

## Project Structure

```
noteapp/
├── docker-compose.yml       # Docker Compose configuration
├── README.md                # This file
├── README.txt               # Plain text version of this file
├── docker_test.ps1          # Docker deployment verification
├── test_full.ps1            # Full API test suite
├── test_bugs.ps1            # Bug-specific test (password protection)
├── complete_test_suite.ps1  # Combined test suite
├── backend/                 # Laravel application
│   ├── Dockerfile
│   ├── docker/start.sh      # Startup script (DB wait, migrations, etc.)
│   ├── .env.example
│   ├── app/
│   ├── config/
│   ├── database/
│   └── routes/api.php
├── frontend/                # React + Vite application
│   ├── Dockerfile
│   ├── .env
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── api/
│   │   └── offline/         # PWA offline support
│   └── public/
└── nginx/
    └── default.conf         # Nginx reverse proxy config
```
