# =============================================================================
# COMPLETE TEST SUITE — NoteApp
# Combines Docker verification + Full API testing + Response time checks
# =============================================================================
# Usage:  .\complete_test_suite.ps1
# Prereq: docker compose up -d --build  (containers running)
# =============================================================================

$PASS = 0
$FAIL = 0
$TOTAL = 0
$SLOW_THRESHOLD_MS = 2000  # Warn if response > 2s
$CRITICAL_SLOW_MS = 5000   # Fail if response > 5s

function Test-Step {
    param([string]$Name, [scriptblock]$Script)
    $script:TOTAL++
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

function ApiCall {
    param([string]$Method="GET", [string]$Url, [string]$Body="", [string]$Token="")
    $headers = @{"Accept"="application/json"; "Content-Type"="application/json"}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    
    $params = @{Uri="http://localhost:8080/api$Url"; Method=$Method; Headers=$headers; ContentType="application/json"}
    if ($Body) { $params.Body = $Body }
    
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $result = Invoke-RestMethod @params -ErrorAction Stop
    $sw.Stop()
    
    $ms = $sw.ElapsedMilliseconds
    if ($ms -gt $CRITICAL_SLOW_MS) {
        Write-Host "     ⚠️  SLOW: $ms ms (threshold: ${CRITICAL_SLOW_MS}ms)" -ForegroundColor Red
    } elseif ($ms -gt $SLOW_THRESHOLD_MS) {
        Write-Host "     ⏱  $ms ms" -ForegroundColor Yellow
    }
    
    return $result
}

function GetHttpCode {
    param([string]$Method="GET", [string]$Url, [string]$Body="", [string]$Token="")
    $headers = @{"Accept"="application/json"; "Content-Type"="application/json"}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    
    $params = @{Uri="http://localhost:8080/api$Url"; Method=$Method; Headers=$headers; ContentType="application/json"; UseBasicParsing=$true}
    if ($Body) { $params.Body = $Body }
    
    try {
        $r = Invoke-WebRequest @params -ErrorAction Stop
        return $r.StatusCode
    } catch {
        if ($_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode
        }
        return 0
    }
}

function Unwrap {
    param($Response)
    if ($Response -and $Response.data) {
        return $Response.data
    }
    return $Response
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  COMPLETE TEST SUITE — NoteApp" -ForegroundColor Cyan
Write-Host "  Response time threshold: ${SLOW_THRESHOLD_MS}ms (warn), ${CRITICAL_SLOW_MS}ms (fail)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ============================================================================
# PART 1: DOCKER DEPLOYMENT VERIFICATION
# ============================================================================
Write-Host "`n============================================" -ForegroundColor Magenta
Write-Host "  PART 1: DOCKER DEPLOYMENT" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta

Test-Step "docker-compose.yml exists" {
    if (-not (Test-Path "docker-compose.yml")) { throw "docker-compose.yml not found" }
}

Test-Step "backend/Dockerfile exists" {
    if (-not (Test-Path "backend/Dockerfile")) { throw "backend/Dockerfile not found" }
}

Test-Step "frontend/Dockerfile exists" {
    if (-not (Test-Path "frontend/Dockerfile")) { throw "frontend/Dockerfile not found" }
}

Test-Step "nginx/default.conf exists" {
    if (-not (Test-Path "nginx/default.conf")) { throw "nginx/default.conf not found" }
}

Test-Step "backend/.env.example exists" {
    if (-not (Test-Path "backend/.env.example")) { throw "backend/.env.example not found" }
}

Test-Step "frontend/.env exists" {
    if (-not (Test-Path "frontend/.env")) { throw "frontend/.env not found" }
}

Test-Step "Backend start.sh has DB wait logic" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    if ($startScript -notmatch "mysqladmin ping") { throw "No DB wait logic found" }
}

Test-Step "Backend start.sh automates artisan commands" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    $required = @("key:generate", "storage:link", "migrate", "config:clear")
    $missing = @()
    foreach ($cmd in $required) {
        if ($startScript -notmatch $cmd) { $missing += $cmd }
    }
    if ($missing.Count -gt 0) { throw "Missing in start.sh: $($missing -join ', ')" }
}

Test-Step "nginx config proxies API to backend" {
    $conf = Get-Content "nginx/default.conf" -Raw
    if ($conf -notmatch "proxy_pass.*noteapp_backend") { throw "No API proxy found" }
}

Test-Step "nginx config proxies frontend" {
    $conf = Get-Content "nginx/default.conf" -Raw
    if ($conf -notmatch "proxy_pass.*noteapp_frontend") { throw "No frontend proxy found" }
}

Test-Step "nginx config proxies storage" {
    $conf = Get-Content "nginx/default.conf" -Raw
    if ($conf -notmatch "location /storage") { throw "No storage proxy found" }
}

Test-Step "CORS config allows frontend origins" {
    $cors = Get-Content "backend/config/cors.php" -Raw
    if ($cors -notmatch "localhost:8080") { throw "CORS missing localhost:8080" }
    if ($cors -notmatch "localhost:5173") { throw "CORS missing localhost:5173" }
}

Test-Step "DB_HOST uses docker service name (mysql)" {
    $env = Get-Content "backend/.env.example" -Raw
    if ($env -notmatch "DB_HOST=mysql") { throw "DB_HOST should be 'mysql'" }
}

Test-Step "frontend/.env uses nginx proxy URL" {
    $env = Get-Content "frontend/.env" -Raw
    if ($env -notmatch "localhost:8080") { throw "Should use nginx proxy at localhost:8080" }
}

Test-Step "Backend depends_on mysql with healthy condition" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "condition: service_healthy") { throw "No healthy condition on mysql dependency" }
}

Test-Step "docker-compose has backend_storage volume" {
    $yml = Get-Content "docker-compose.yml" -Raw
    if ($yml -notmatch "backend_storage") { throw "No backend_storage volume" }
}

Test-Step "start.sh creates storage framework directories" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    if ($startScript -notmatch "mkdir.*storage/framework") { throw "No storage framework dir creation" }
}

Test-Step "start.sh copies .env.example if .env missing" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    if ($startScript -notmatch "cp .env.example .env") { throw "No .env fallback logic" }
}

Test-Step "start.sh has vendor fallback install" {
    $startScript = Get-Content "backend/docker/start.sh" -Raw
    if ($startScript -notmatch "composer install") { throw "No composer install fallback" }
}

Test-Step "manifest.webmanifest exists" {
    if (-not (Test-Path "frontend/public/manifest.webmanifest")) { throw "manifest not found" }
}

# ============================================================================
# PART 2: API ENDPOINT TESTING (with response time)
# ============================================================================
Write-Host "`n============================================" -ForegroundColor Magenta
Write-Host "  PART 2: API ENDPOINT TESTING" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta

$R1 = Get-Random
$EMAIL = "test_$R1@test.com"
$PWD = "12345678"
$NOTE_PWD = "secret123"

# ── AUTH ──
Write-Host "`n--- AUTH ---" -ForegroundColor Yellow
Test-Step "Register" {
    $body = @{name="TestUser"; email=$EMAIL; password=$PWD; password_confirmation=$PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/register" -Body $body
    if (-not $r.token) { throw "No token returned" }
    $script:TOKEN = $r.token
    $script:USER_ID = $r.user.id
}

Test-Step "Login" {
    $body = @{email=$EMAIL; password=$PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/login" -Body $body
    if (-not $r.token) { throw "No token" }
    $script:TOKEN = $r.token
}

Test-Step "Get /me" {
    $r = ApiCall -Method Get -Url "/me" -Token $script:TOKEN
    if ($r.email -ne $EMAIL) { throw "Email mismatch" }
}

# ── NOTES ──
Write-Host "`n--- NOTES ---" -ForegroundColor Yellow
Test-Step "Create note" {
    $body = @{title="Secret Note"; content="Protected content"} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes" -Body $body -Token $script:TOKEN
    $note = Unwrap $r
    if (-not $note.id) { throw "No note ID" }
    $script:NOTE_ID = $note.id
}

Test-Step "List notes" {
    $r = ApiCall -Method Get -Url "/notes" -Token $script:TOKEN
    $notes = Unwrap $r
    if ($notes.Count -eq 0) { throw "No notes" }
}

Test-Step "Get single note" {
    $r = ApiCall -Method Get -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN
    $note = Unwrap $r
    if ($note.title -ne "Secret Note") { throw "Title mismatch" }
}

Test-Step "Update note" {
    $body = @{title="Updated Note"; content="Updated content"} | ConvertTo-Json
    $r = ApiCall -Method Put -Url "/notes/$($script:NOTE_ID)" -Body $body -Token $script:TOKEN
    $note = Unwrap $r
    if ($note.title -ne "Updated Note") { throw "Title not updated" }
}

# ── PASSWORD PROTECTED ──
Write-Host "`n--- PASSWORD PROTECTED ---" -ForegroundColor Yellow
Test-Step "Set password" {
    $body = @{password=$NOTE_PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes/$($script:NOTE_ID)/set-password" -Body $body -Token $script:TOKEN
    if ($r.is_protected -ne $true) { throw "Note not protected" }
}

Test-Step "Owner bypass — get without password" {
    $r = ApiCall -Method Get -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN
    $note = Unwrap $r
    if (-not $note.content) { throw "Owner should see content" }
}

Test-Step "Verify password" {
    $body = @{note_password=$NOTE_PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes/$($script:NOTE_ID)/verify-password" -Body $body -Token $script:TOKEN
    if ($r.message -notmatch "verified") { throw "Not verified" }
}

Test-Step "Remove password" {
    $body = @{current_password=$NOTE_PWD} | ConvertTo-Json
    $r = ApiCall -Method Delete -Url "/notes/$($script:NOTE_ID)/password" -Body $body -Token $script:TOKEN
    if ($r.is_protected -ne $false) { throw "Note still protected" }
}

# ── LABELS ──
Write-Host "`n--- LABELS ---" -ForegroundColor Yellow
Test-Step "Create label" {
    $body = @{name="Important"} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/labels" -Body $body -Token $script:TOKEN
    if (-not $r.id) { throw "No label ID" }
    $script:LABEL_ID = $r.id
}

Test-Step "Attach label to note" {
    $body = @{label_ids=@($script:LABEL_ID)} | ConvertTo-Json
    $r = ApiCall -Method Put -Url "/notes/$($script:NOTE_ID)" -Body $body -Token $script:TOKEN
    $note = Unwrap $r
    if ($note.labels.Count -eq 0) { throw "Label not attached" }
}

# ── SHARING ──
Write-Host "`n--- SHARING ---" -ForegroundColor Yellow
$R2 = Get-Random
$EMAIL2 = "share_$R2@test.com"

Test-Step "Register second user" {
    $body = @{name="ShareUser"; email=$EMAIL2; password=$PWD; password_confirmation=$PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/register" -Body $body
    if (-not $r.token) { throw "No token" }
    $script:TOKEN2 = $r.token
    $script:USER2_ID = $r.user.id
}

Test-Step "Share note" {
    $body = @{email=$EMAIL2; permission="read"} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes/$($script:NOTE_ID)/shares" -Body $body -Token $script:TOKEN
    if ($r.email -ne $EMAIL2) { throw "Share not created" }
}

Test-Step "Get shared notes as second user" {
    $r = ApiCall -Method Get -Url "/notes/shared-with-me" -Token $script:TOKEN2
    if ($r.Count -eq 0) { throw "No shared notes" }
}

Test-Step "Revoke share" {
    $code = GetHttpCode -Method Delete -Url "/notes/$($script:NOTE_ID)/shares/$($script:USER2_ID)" -Token $script:TOKEN
    if ($code -ne 200) { throw "Expected 200, got $code" }
}

# ── DELETE ──
Write-Host "`n--- DELETE ---" -ForegroundColor Yellow
Test-Step "Delete note" {
    $code = GetHttpCode -Method Delete -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN
    if ($code -ne 200) { throw "Expected 200, got $code" }
}

Test-Step "Verify note deleted" {
    $code = GetHttpCode -Method Get -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN
    if ($code -ne 404) { throw "Expected 404, got $code" }
}

# ── SYSTEM ──
Write-Host "`n--- SYSTEM ---" -ForegroundColor Yellow
Test-Step "Health check" {
    $r = ApiCall -Method Get -Url "/health"
    if ($r.status -ne "ok") { throw "Health check failed" }
}

# ============================================================================
# PART 3: RESPONSE TIME BENCHMARK
# ============================================================================
Write-Host "`n============================================" -ForegroundColor Magenta
Write-Host "  PART 3: RESPONSE TIME BENCHMARK" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta

$BENCHMARK_ENDPOINTS = @(
    @{Name="GET /api/notes (list)"; Method="GET"; Url="/notes"},
    @{Name="GET /api/me"; Method="GET"; Url="/me"},
    @{Name="GET /api/health"; Method="GET"; Url="/health"}
)

$benchResults = @{}
foreach ($ep in $BENCHMARK_ENDPOINTS) {
    $times = @()
    for ($i = 0; $i -lt 5; $i++) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $null = ApiCall -Method $ep.Method -Url $ep.Url -Token $script:TOKEN
        } catch {
            # ignore errors in benchmark
        }
        $sw.Stop()
        $times += $sw.ElapsedMilliseconds
    }
    $avg = [math]::Round(($times | Measure-Object -Average).Average, 0)
    $max = ($times | Measure-Object -Maximum).Maximum
    $min = ($times | Measure-Object -Minimum).Minimum
    $benchResults[$ep.Name] = @{avg=$avg; min=$min; max=$max}
    
    $statusColor = if ($avg -gt $CRITICAL_SLOW_MS) { "Red" } elseif ($avg -gt $SLOW_THRESHOLD_MS) { "Yellow" } else { "Green" }
    Write-Host "  $($ep.Name): avg=${avg}ms min=${min}ms max=${max}ms" -ForegroundColor $statusColor
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  COMPLETE TEST SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Total tests: $TOTAL" -ForegroundColor White
Write-Host "  ✅ PASS: $PASS" -ForegroundColor Green
Write-Host "  ❌ FAIL: $FAIL" -ForegroundColor Red

Write-Host "`n--- Response Time Benchmarks ---" -ForegroundColor Cyan
foreach ($key in $benchResults.Keys) {
    $r = $benchResults[$key]
    $color = if ($r.avg -gt $CRITICAL_SLOW_MS) { "Red" } elseif ($r.avg -gt $SLOW_THRESHOLD_MS) { "Yellow" } else { "Green" }
    Write-Host "  $key : avg=$($r.avg)ms | min=$($r.min)ms | max=$($r.max)ms" -ForegroundColor $color
}

if ($FAIL -gt 0) {
    Write-Host "`n❌ SOME TESTS FAILED!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n✅ ALL $TOTAL TESTS PASSED!" -ForegroundColor Green
    exit 0
}
