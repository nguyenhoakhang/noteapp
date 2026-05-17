# Test script for Bug 1 (shared note shows blank) and Bug 2 (password not enforced)
$BASE = "http://localhost:8080/api"
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
    $params = @{Uri="$BASE$Url"; Method=$Method; Headers=$headers; ContentType="application/json"}
    if ($Body) { $params.Body = $Body }
    return Invoke-RestMethod @params -ErrorAction Stop
}

function GetHttpCode {
    param([string]$Method="GET", [string]$Url, [string]$Body="", [string]$Token="")
    $headers = @{"Accept"="application/json"; "Content-Type"="application/json"}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{Uri="$BASE$Url"; Method=$Method; Headers=$headers; ContentType="application/json"; UseBasicParsing=$true}
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
Write-Host "  BUG TEST: Share + Password Protection" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$R1 = Get-Random
$EMAIL = "bug_$R1@test.com"
$PWD = "12345678"
$NOTE_PWD = "secret123"

# ── 1. Register User A (owner) ──
Write-Host "`n--- AUTH ---" -ForegroundColor Yellow
Test-Step "1. Register User A (owner)" {
    $body = @{name="OwnerA"; email=$EMAIL; password=$PWD; password_confirmation=$PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/register" -Body $body
    if (-not $r.token) { throw "No token returned" }
    $script:TOKEN_A = $r.token
    $script:USER_A_ID = $r.user.id
}

# ── 2. Register User B (sharee) ──
$R2 = Get-Random
$EMAIL2 = "share_$R2@test.com"
Test-Step "2. Register User B (sharee)" {
    $body = @{name="UserB"; email=$EMAIL2; password=$PWD; password_confirmation=$PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/register" -Body $body
    if (-not $r.token) { throw "No token" }
    $script:TOKEN_B = $r.token
    $script:USER_B_ID = $r.user.id
}

# ── 3. User A creates a note ──
Write-Host "`n--- NOTES ---" -ForegroundColor Yellow
Test-Step "3. User A creates a note" {
    $body = @{title="Shared Test Note"; content="<p>This is shared content</p>"; color="#d1fae5"} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes" -Body $body -Token $script:TOKEN_A
    $note = Unwrap $r
    if (-not $note.id) { throw "No note ID: $($r | ConvertTo-Json)" }
    $script:NOTE_ID = $note.id
    Write-Host "       Note ID: $($script:NOTE_ID)" -ForegroundColor Gray
}

# ── 4. User A shares note with User B ──
Test-Step "4. User A shares note with User B" {
    $body = @{email=$EMAIL2; permission="read"} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes/$($script:NOTE_ID)/shares" -Body $body -Token $script:TOKEN_A
    if (-not $r.user_id) { throw "Share not created: $($r | ConvertTo-Json)" }
}

# ── 5. User B checks shared notes (BUG 1 TEST) ──
Test-Step "5. User B checks shared notes (Bug 1: should show title/content)" {
    $r = ApiCall -Method Get -Url "/notes/shared-with-me" -Token $script:TOKEN_B
    if ($r.Count -eq 0) { throw "No shared notes returned" }
    $first = $r[0]
    Write-Host "       title: '$($first.title)'" -ForegroundColor Gray
    Write-Host "       content: '$($first.content)'" -ForegroundColor Gray
    Write-Host "       color: '$($first.color)'" -ForegroundColor Gray
    Write-Host "       is_protected: $($first.is_protected)" -ForegroundColor Gray
    if (-not $first.title) { throw "Title is empty/null - BUG 1 NOT FIXED!" }
    if ($first.title -ne "Shared Test Note") { throw "Title mismatch: '$($first.title)'" }
}

# ── 6. User A sets password on note ──
Write-Host "`n--- PASSWORD PROTECTED ---" -ForegroundColor Yellow
Test-Step "6. User A sets password on note" {
    $body = @{password=$NOTE_PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes/$($script:NOTE_ID)/set-password" -Body $body -Token $script:TOKEN_A
    if ($r.is_protected -ne $true) { throw "Note not protected: $($r | ConvertTo-Json)" }
}

# ── 7. Owner bypass - get without password ──
Test-Step "7. Owner bypass - get without password (should see content)" {
    $r = ApiCall -Method Get -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN_A
    $note = Unwrap $r
    if (-not $note.content) { throw "Owner should see content but got none" }
    Write-Host "       Owner sees content: $($note.content.Substring(0, [Math]::Min(50, $note.content.Length)))..." -ForegroundColor Gray
}

# ── 8. Non-owner gets note WITHOUT password (BUG 2 TEST) ──
Test-Step "8. Non-owner gets note WITHOUT password (Bug 2: should get 403 needs_unlock)" {
    $code = GetHttpCode -Method Get -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN_B
    if ($code -ne 403) { throw "Expected 403, got $code - BUG 2 NOT FIXED!" }
    Write-Host "       Got 403 as expected" -ForegroundColor Gray
}

# ── 9. Non-owner verifies password ──
Test-Step "9. Non-owner verifies password" {
    $body = @{note_password=$NOTE_PWD} | ConvertTo-Json
    $r = ApiCall -Method Post -Url "/notes/$($script:NOTE_ID)/verify-password" -Body $body -Token $script:TOKEN_B
    if ($r.message -notmatch "verified") { throw "Not verified: $($r | ConvertTo-Json)" }
}

# ── 10. Non-owner gets note WITH password ──
Test-Step "10. Non-owner gets note WITH password (should see content)" {
    $r = ApiCall -Method Get -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN_B
    $note = Unwrap $r
    if (-not $note.content) { throw "Should see content after password verify but got none" }
    Write-Host "       User B sees content: $($note.content.Substring(0, [Math]::Min(50, $note.content.Length)))..." -ForegroundColor Gray
}

# ── 11. Remove password ──
Test-Step "11. Remove password" {
    $body = @{current_password=$NOTE_PWD} | ConvertTo-Json
    $r = ApiCall -Method Delete -Url "/notes/$($script:NOTE_ID)/password" -Body $body -Token $script:TOKEN_A
    if ($r.is_protected -ne $false) { throw "Note still protected: $($r | ConvertTo-Json)" }
}

# ── 12. Delete note ──
Test-Step "12. Delete note" {
    $code = GetHttpCode -Method Delete -Url "/notes/$($script:NOTE_ID)" -Token $script:TOKEN_A
    if ($code -ne 200) { throw "Expected 200, got $code" }
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
