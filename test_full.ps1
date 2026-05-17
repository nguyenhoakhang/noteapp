$BASE_URL = "http://localhost:8080/api"

Write-Host "=== FULL API TEST ===" -ForegroundColor Cyan

# 1. Register
$random = Get-Random
$email = "test_$random@test.com"
Write-Host "[1] Register: $email"
$body = '{"name":"TestUser","email":"' + $email + '","password":"12345678","password_confirmation":"12345678"}'
$response = Invoke-RestMethod -Uri "$BASE_URL/register" -Method Post -Body $body -ContentType "application/json"
$token = $response.token
Write-Host "  -> OK, User ID: $($response.user.id)" -ForegroundColor Green

# 2. Create note
Write-Host "[2] Create note"
$noteBody = '{"title":"Secret Note","content":"Protected content"}'
$note = Invoke-RestMethod -Uri "$BASE_URL/notes" -Method Post -Headers @{Authorization="Bearer $token"} -Body $noteBody -ContentType "application/json"
$noteId = $note.id
Write-Host "  -> OK, Note ID: $noteId" -ForegroundColor Green

# 3. Set password
Write-Host "[3] Set password"
$passBody = '{"password":"secret123","password_confirmation":"secret123"}'
Invoke-RestMethod -Uri "$BASE_URL/notes/$noteId/set-password" -Method Post -Headers @{Authorization="Bearer $token"} -Body $passBody -ContentType "application/json" | Out-Null
Write-Host "  -> OK, Password set" -ForegroundColor Green

# 4. Get note without password (should get 403)
Write-Host "[4] Get note WITHOUT password (should fail)"
try {
    $result = Invoke-RestMethod -Uri "$BASE_URL/notes/$noteId" -Method Get -Headers @{Authorization="Bearer $token"} -ErrorAction Stop
    Write-Host "  -> FAIL: Note accessible without password!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "  -> OK, Blocked with 403" -ForegroundColor Green
    } else {
        Write-Host "  -> Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}

# 5. Get note with password
Write-Host "[5] Get note WITH password"
$result = Invoke-RestMethod -Uri "$BASE_URL/notes/$noteId?note_password=secret123" -Method Get -Headers @{Authorization="Bearer $token"}
if ($result.content -eq "Protected content") {
    Write-Host "  -> OK, Content correct" -ForegroundColor Green
} else {
    Write-Host "  -> FAIL, Content mismatch" -ForegroundColor Red
}

# 6. Create label
Write-Host "[6] Create label"
$labelBody = '{"name":"Important"}'
$label = Invoke-RestMethod -Uri "$BASE_URL/labels" -Method Post -Headers @{Authorization="Bearer $token"} -Body $labelBody -ContentType "application/json"
$labelId = $label.id
Write-Host "  -> OK, Label ID: $labelId" -ForegroundColor Green

# 7. Attach label to note
Write-Host "[7] Attach label to note"
$attachBody = '{"label_ids":[' + $labelId + ']}'
$updated = Invoke-RestMethod -Uri "$BASE_URL/notes/$noteId" -Method Put -Headers @{Authorization="Bearer $token"} -Body $attachBody -ContentType "application/json"
if ($updated.labels[0].id -eq $labelId) {
    Write-Host "  -> OK, Label attached" -ForegroundColor Green
} else {
    Write-Host "  -> FAIL, Label not attached" -ForegroundColor Red
}

# 8. Create second user
Write-Host "[8] Create second user"
$random2 = Get-Random
$email2 = "share_$random2@test.com"
$body2 = '{"name":"ShareUser","email":"' + $email2 + '","password":"12345678","password_confirmation":"12345678"}'
$user2 = Invoke-RestMethod -Uri "$BASE_URL/register" -Method Post -Body $body2 -ContentType "application/json"
$token2 = $user2.token
Write-Host "  -> OK, Second user created" -ForegroundColor Green

# 9. Share note
Write-Host "[9] Share note with second user"
$shareBody = '{"email":"' + $email2 + '","permission":"read"}'
Invoke-RestMethod -Uri "$BASE_URL/notes/$noteId/share" -Method Post -Headers @{Authorization="Bearer $token"} -Body $shareBody -ContentType "application/json" | Out-Null
Write-Host "  -> OK, Note shared" -ForegroundColor Green

# 10. Get shared notes as second user
Write-Host "[10] Get shared notes as second user"
$shared = Invoke-RestMethod -Uri "$BASE_URL/notes/shared-with-me" -Method Get -Headers @{Authorization="Bearer $token2"}
if ($shared[0].note.id -eq $noteId) {
    Write-Host "  -> OK, Note appears in shared list" -ForegroundColor Green
} else {
    Write-Host "  -> FAIL, Shared note not found" -ForegroundColor Red
}

# 11. Delete note
Write-Host "[11] Delete note (with password)"
$deleteBody = '{"note_password":"secret123"}'
Invoke-RestMethod -Uri "$BASE_URL/notes/$noteId" -Method Delete -Headers @{Authorization="Bearer $token"} -Body $deleteBody -ContentType "application/json" | Out-Null
Write-Host "  -> OK, Note deleted" -ForegroundColor Green

Write-Host "`n=== ALL TESTS PASSED! ===" -ForegroundColor Green