# =============================================================================
# ENHANCED FULL API TEST — NoteApp
# Tests all critical API endpoints with proper error handling
# Handles API Resource wrapping ({ data: { ... } })
# =============================================================================
# Usage:  .\test_full.ps1
# Prereq: docker compose up -d --build  (containers running)
# =============================================================================

$BASE_URL = "http://localhost:8080/api"
$PASS = 0
$FAIL = 0

function Test-Step {
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

function ApiCall {
    param([string]$Method="GET", [string]$Url, [string]$Body="", [string]$Token="")
    $headers = @{"Accept"="application/json"; "Content-Type"="application/json"}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    
    $params = @{Uri="$BASE_URL$Url"; Method=$Method; Headers=$headers; ContentType="application/json"}
    if ($Body) { $params.Body = $Body }
    
    return Invoke-RestMethod @params -ErrorAction Stop
}

function GetHttpCode {
    param([string]$Method="GET", [string]$Url, [string]$Body="", [string]$Token="")
    $headers = @{"Accept"="application/json"; "Content-Type"="application/json"}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    
    $params = @{Uri="$BASE_URL$Url"; Method=$Method; Headers=$headers; ContentType="application/json"; UseBasicParsing=$true}
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

# Helper: unwrap API Resource { data: { ... } } or return raw
function Unwrap {
    param($Response)
    if ($Response -and $Response.data) {
        return $Response.data
    }
    return $Response
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ENHANCED FULL API TEST — NoteApp" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$R1 = Get-Random
$EMAIL = "test_$R1@test.com"
$PWD = "12345678"
$NOTE_PWD = "secret123"

# ── 1. Register ──
Write-Host "`n--- AUTH ---" -ForegroundColor Yellow
Test-Step "1. Register" {
    $body = @{name="TestUser"; email=$EMAIL; password=$PWD; password_confirmation=$PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/register" -Body $body
    if (-not $r.token) { throw "No token returned" }
    $script:TOKEN = $r.token
    $script:USER_ID = $r.user.id
}

Test-Step "2. Login" {
    $body = @{email=$EMAIL; password=$PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/login" -Body $body
    if (-not $r.token) { throw "No token" }
    $script:TOKEN = $r.token
}

Test-Step "3. Get /me" {
    $r = ApiCall -Method Get -Url "/me" -Token $script:TOKEN
    if ($r.email -ne $EMAIL) { throw "Email mismatch" }
}

# ── 4. Create note ──
Write-Host "`n--- NOTES ---" -ForegroundColor Yellow
Test-Step "4. Create note" {
    $body = @{title="Secret Note"; content="Protected content"} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes" -Body $body -Token $script:TOKEN
    $note = Unwrap $r
    if (-not $note.id) { throw "No note ID in response: $($r | ConvertTo-Json)" }
    $script:NOTE_ID = $note.id
}

Test-Step "5. List notes" {
    $r = ApiCall -Method Get -Url "/notes" -Token $script:TOKEN
    $notes = Unwrap $r
    if ($notes.Count -eq 0) { throw "No notes" }
}

Test-Step "6. Get single note" {
    $r = ApiCall -Method Get -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN
    $note = Unwrap $r
    if ($note.title -ne "Secret Note") { throw "Title mismatch: '$($note.title)'" }
}

Test-Step "7. Update note" {
    $body = @{title="Updated Note"; content="Updated content"} | ConvertTo-Json
    $r = ApiCall -Method Put -Url "/notes/$($script:NOTE_ID)" -Body $body -Token $script:TOKEN
    $note = Unwrap $r
    if ($note.title -ne "Updated Note") { throw "Title not updated: '$($note.title)'" }
}

# ── 8. Set password ──
Write-Host "`n--- PASSWORD PROTECTED ---" -ForegroundColor Yellow
Test-Step "8. Set password" {
    $body = @{password=$NOTE_PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes/$($script:NOTE_ID)/set-password" -Body $body -Token $script:TOKEN
    if ($r.is_protected -ne $true) { throw "Note not protected: $($r | ConvertTo-Json)" }
}

Test-Step "9. Owner bypass — get without password" {
    $r = ApiCall -Method Get -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN
    $note = Unwrap $r
    if (-not $note.content) { throw "Owner should see content" }
}

Test-Step "10. Verify password" {
    $body = @{note_password=$NOTE_PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes/$($script:NOTE_ID)/verify-password" -Body $body -Token $script:TOKEN
    if ($r.message -notmatch "verified") { throw "Not verified: $($r | ConvertTo-Json)" }
}

Test-Step "11. Remove password" {
    $body = @{current_password=$NOTE_PWD} | ConvertTo-Json
    $r = ApiCall -Method Delete -Url "/notes/$($script:NOTE_ID)/password" -Body $body -Token $script:TOKEN
    if ($r.is_protected -ne $false) { throw "Note still protected: $($r | ConvertTo-Json)" }
}

# ── 12. Labels ──
Write-Host "`n--- LABELS ---" -ForegroundColor Yellow
Test-Step "12. Create label" {
    $body = @{name="Important"} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/labels" -Body $body -Token $script:TOKEN
    if (-not $r.id) { throw "No label ID: $($r | ConvertTo-Json)" }
    $script:LABEL_ID = $r.id
}

Test-Step "13. Attach label to note" {
    $body = @{label_ids=@($script:LABEL_ID)} | ConvertTo-Json
    $r = ApiCall -Method Put -Url "/notes/$($script:NOTE_ID)" -Body $body -Token $script:TOKEN
    $note = Unwrap $r
    if ($note.labels.Count -eq 0) { throw "Label not attached: $($r | ConvertTo-Json)" }
}

# ── 14. Sharing ──
Write-Host "`n--- SHARING ---" -ForegroundColor Yellow
$R2 = Get-Random
$EMAIL2 = "share_$R2@test.com"

Test-Step "14. Register second user" {
    $body = @{name="ShareUser"; email=$EMAIL2; password=$PWD; password_confirmation=$PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/register" -Body $body
    if (-not $r.token) { throw "No token" }
    $script:TOKEN2 = $r.token
    $script:USER2_ID = $r.user.id
}

Test-Step "15. Share note" {
    $body = @{email=$EMAIL2; permission="read"} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes/$($script:NOTE_ID)/shares" -Body $body -Token $script:TOKEN
    if ($r.email -ne $EMAIL2) { throw "Share not created: $($r | ConvertTo-Json)" }
}

Test-Step "16. Get shared notes as second user" {
    $r = ApiCall -Method Get -Url "/notes/shared-with-me" -Token $script:TOKEN2
    if ($r.Count -eq 0) { throw "No shared notes" }
}

Test-Step "17. Revoke share" {
    $code = GetHttpCode -Method Delete -Url "/notes/$($script:NOTE_ID)/shares/$($script:USER2_ID)" -Token $script:TOKEN
    if ($code -ne 200) { throw "Expected 200, got $code" }
}

# ── 18. Delete note ──
Write-Host "`n--- DELETE ---" -ForegroundColor Yellow
Test-Step "18. Delete note" {
    $code = GetHttpCode -Method Delete -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN
    if ($code -ne 200) { throw "Expected 200, got $code" }
}

Test-Step "19. Verify note deleted" {
    $code = GetHttpCode -Method Get -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN
    if ($code -ne 404) { throw "Expected 404, got $code" }
}

# ── 20. Health check ──
Write-Host "`n--- SYSTEM ---" -ForegroundColor Yellow
Test-Step "20. Health check" {
    $r = ApiCall -Method Get -Url "/health"
    if ($r.status -ne "ok") { throw "Health check failed" }
}

# ── SUMMARY ──
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  TEST SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ✅ PASS: $PASS" -ForegroundColor Green
Write-Host "  ❌ FAIL: $FAIL" -ForegroundColor Red

if ($FAIL -gt 0) {
    Write-Host "`n❌ SOME TESTS FAILED!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n✅ ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
}
