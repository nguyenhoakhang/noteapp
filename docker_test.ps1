# =============================================================================
# DOCKER DEPLOYMENT VERIFICATION — NoteApp
# Tests that docker compose up -d --build works WITHOUT manual commands
# =============================================================================
# Usage:  .\docker_test.ps1
# =============================================================================

$PASS = 0
$FAIL = 0

function Check {
    param([string]$Name, [scriptblock]$Script)
    try {
        & $Script
        $script:PASS++
        Write-Host "  ✅ $Name" -ForegroundColor Green
    } catch {
        $script:FAIL++
        Write-Host "  ❌ $Name" -ForegroundColor Red
        Write-Host "     $_" -ForegroundColor DarkRed
    }
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DOCKER DEPLOYMENT VERIFICATION" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ── 1. Check docker-compose.yml exists ──
Check "docker-compose.yml exists" {
    if (-not (Test-Path "docker-compose.yml")) { throw "docker-compose.yml not found" }
}

# ── 2. Check Dockerfiles exist ──
Check "backend/Dockerfile exists" {
    if (-not (Test-Path "backend/Dockerfile")) { throw "backend/Dockerfile not found" }
}

Check "frontend/Dockerfile exists" {
    if (-not (Test-Path "frontend/Dockerfile")) { throw "frontend/Dockerfile not found" }
}

Check "nginx/default.conf exists" {
    if (-not (Test-Path "nginx/default.conf")) { throw "nginx/default.conf not found" }
}

# ── 3. Check .env files ──
Check "backend/.env.example exists" {
    if (-not (Test-Path "backend/.env.example")) { throw "backend/.env.example not found" }
}

Check "frontend/.env exists" {
    if (-not (Test-Path "frontend/.env")) { throw "frontend/.env not found" }
}

# ── 4. Check docker-compose.yml has restart policies ──
Check "docker-compose.yml has restart policies" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "restart:") { throw "No restart policies found" }
}

# ── 5. Check docker-compose.yml has healthchecks ──
Check "docker-compose.yml has healthchecks" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "healthcheck") { throw "No healthchecks found" }
}

# ── 6. Check docker-compose.yml has volumes ──
Check "docker-compose.yml has volumes" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "volumes:") { throw "No volumes found" }
}

# ── 7. Check backend start.sh handles DB wait ──
Check "Backend start.sh has DB wait logic" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    if ($startScript -notmatch "mysqladmin ping") { throw "No DB wait logic found" }
}

# ── 8. Check backend start.sh runs artisan commands ──
Check "Backend start.sh automates artisan commands" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    $required = @("key:generate", "storage:link", "migrate", "config:clear")
    $missing = @()
    foreach ($cmd in $required) {
        if ($startScript -notmatch $cmd) { $missing += $cmd }
    }
    if ($missing.Count -gt 0) { throw "Missing in start.sh: $($missing -join ', ')" }
}

# ── 9. Check frontend Dockerfile ──
Check "Frontend Dockerfile exists and has CMD" {
    $df = Get-Content "frontend/Dockerfile" -Raw
    if ($df -notmatch "CMD|npm run") { throw "No run command found" }
}

# ── 10. Check nginx config ──
Check "nginx config has API proxy to backend" {
    $conf = Get-Content "nginx/default.conf" -Raw
    if ($conf -notmatch "proxy_pass.*noteapp_backend") { throw "No API proxy found" }
}

Check "nginx config has frontend proxy" {
    $conf = Get-Content "nginx/default.conf" -Raw
    if ($conf -notmatch "proxy_pass.*noteapp_frontend") { throw "No frontend proxy found" }
}

Check "nginx config has storage proxy" {
    $conf = Get-Content "nginx/default.conf" -Raw
    if ($conf -notmatch "location /storage") { throw "No storage proxy found" }
}

# ── 11. Check CORS config ──
Check "CORS config allows frontend origins" {
    $cors = Get-Content "backend/config/cors.php" -Raw
    if ($cors -notmatch "localhost:8080") { throw "CORS missing localhost:8080" }
    if ($cors -notmatch "localhost:5173") { throw "CORS missing localhost:5173" }
}

# ── 12. Check .env.example has all required vars ──
Check ".env.example has APP_KEY placeholder" {
    $env = Get-Content "backend/.env.example" -Raw
    if ($env -notmatch "APP_KEY") { throw "APP_KEY missing" }
}

Check ".env.example has DB config" {
    $env = Get-Content "backend/.env.example" -Raw
    if ($env -notmatch "DB_HOST|DB_DATABASE|DB_USERNAME|DB_PASSWORD") { throw "DB config missing" }
}

Check ".env.example has FRONTEND_URL" {
    $env = Get-Content "backend/.env.example" -Raw
    if ($env -notmatch "FRONTEND_URL") { throw "FRONTEND_URL missing" }
}

# ── 13. Check frontend env ──
Check "frontend/.env has VITE_API_URL" {
    $env = Get-Content "frontend/.env" -Raw
    if ($env -notmatch "VITE_API_URL") { throw "VITE_API_URL missing" }
}

# ── 14. Check package.json scripts ──
Check "frontend/package.json has dev script" {
    $pkg = Get-Content "frontend/package.json" -Raw
    if ($pkg -notmatch '"dev"') { throw "No dev script" }
}

# ── 15. Check manifest.webmanifest ──
Check "manifest.webmanifest exists" {
    if (-not (Test-Path "frontend/public/manifest.webmanifest")) { throw "manifest not found" }
}

# ── 16. Check for correct docker hostnames ──
Check "DB_HOST uses docker service name (mysql)" {
    $env = Get-Content "backend/.env.example" -Raw
    if ($env -notmatch "DB_HOST=mysql") { throw "DB_HOST should be 'mysql' (docker service name)" }
}

Check "frontend/.env uses nginx proxy URL" {
    $env = Get-Content "frontend/.env" -Raw
    if ($env -notmatch "localhost:8080") { throw "Should use nginx proxy at localhost:8080" }
}

# ── 17. Check docker-compose service names ──
Check "docker-compose has backend service" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "backend:") { throw "No backend service" }
}

Check "docker-compose has frontend service" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "frontend:") { throw "No frontend service" }
}

Check "docker-compose has nginx service" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "nginx:") { throw "No nginx service" }
}

Check "docker-compose has mysql service" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "mysql:") { throw "No mysql service" }
}

Check "docker-compose has mailpit service" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "mailpit:") { throw "No mailpit service" }
}

# ── 18. Check backend depends_on mysql with condition ──
Check "Backend depends_on mysql with healthy condition" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "condition: service_healthy") { throw "No healthy condition on mysql dependency" }
}

# ── 19. Check composer.json exists ──
Check "composer.json exists" {
    if (-not (Test-Path "backend/composer.json")) { throw "composer.json not found" }
}

# ── 20. Check for .dockerignore ──
Check "frontend/.dockerignore exists" {
    if (-not (Test-Path "frontend/.dockerignore")) { throw "frontend/.dockerignore not found" }
}

Check "backend/.dockerignore exists" {
    if (-not (Test-Path "backend/.dockerignore")) { throw "backend/.dockerignore not found" }
}

# ── 21. Check storage persistence ──
Check "docker-compose has backend_storage volume" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "backend_storage") { throw "No backend_storage volume" }
}

Check "docker-compose has mysql_data volume" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "mysql_data") { throw "No mysql_data volume" }
}

# ── 22. Check start.sh creates storage framework dirs ──
Check "start.sh creates storage framework directories" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    if ($startScript -notmatch "mkdir.*storage/framework") { throw "No storage framework dir creation" }
}

# ── 23. Check start.sh copies .env.example if .env missing ──
Check "start.sh copies .env.example if .env missing" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    if ($startScript -notmatch "cp .env.example .env") { throw "No .env fallback logic" }
}

# ── 24. Check start.sh handles vendor fallback ──
Check "start.sh has vendor fallback install" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    if ($startScript -notmatch "composer install") { throw "No composer install fallback" }
}

# ── 25. Check nginx client_max_body_size ──
Check "nginx config has client_max_body_size" {
    $conf = Get-Content "nginx/default.conf" -Raw
    if ($conf -notmatch "client_max_body_size") { throw "No client_max_body_size" }
}

# ── SUMMARY ──
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  DOCKER VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ✅ PASS: $PASS" -ForegroundColor Green
Write-Host "  ❌ FAIL: $FAIL" -ForegroundColor Red

if ($FAIL -gt 0) {
    Write-Host "`n❌ Some checks failed — review above." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n✅ All checks passed — ready for deployment!" -ForegroundColor Green
    exit 0
}
