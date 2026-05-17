# notes-app

Final Project Semester 2 2025-2026

## Enter the root folder then
```
docker compose up -d --build
docker exec noteapp_backend php artisan migrate --force
docker compose restart
```
http://localhost:5173 should run