# test_fresh.ps1
$BASE_URL = "http://localhost:8080/api"

# Login
$loginBody = @{
    email = "test_1198678050@test.com"
    password = "12345678"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -ContentType "application/json" -Body $loginBody
$token = $loginResponse.token
Write-Host "Logged in OK" -ForegroundColor Green

# 1. Tạo note mới
$noteBody = @{
    title = "Fresh Note"
    content = "This is a secret"
} | ConvertTo-Json

$note = Invoke-RestMethod -Uri "$BASE_URL/notes" -Method POST -Headers @{
    Authorization = "Bearer $token"
} -ContentType "application/json" -Body $noteBody

$noteId = $note.id
Write-Host "Created note ID: $noteId" -ForegroundColor Green

# 2. Set password
$passwordBody = @{
    password = "mypass123"
    password_confirmation = "mypass123"
} | ConvertTo-Json

$setResult = Invoke-RestMethod -Uri "$BASE_URL/notes/$noteId/set-password" -Method POST -Headers @{
    Authorization = "Bearer $token"
} -ContentType "application/json" -Body $passwordBody

Write-Host "Set password result: $($setResult.message)" -ForegroundColor Green

# 3. Kiểm tra database ngay sau khi set
Write-Host "`nChecking database..." -ForegroundColor Yellow
$dbCheck = docker exec noteapp_mysql mysql -uroot -proot -e "USE noteapp; SELECT id, password IS NOT NULL as has_pwd FROM notes WHERE id=$noteId;" 2>$null
Write-Host $dbCheck

# 4. Test without password
Write-Host "`n--- TEST WITHOUT PASSWORD ---" -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "$BASE_URL/notes/$noteId" -Method GET -Headers @{
        Authorization = "Bearer $token"
    } -ErrorAction Stop
    Write-Host "FAIL: Note accessible without password!" -ForegroundColor Red
    Write-Host "Response: $($result | ConvertTo-Json)" -ForegroundColor Red
} catch {
    Write-Host "PASS: Correctly blocked (403)" -ForegroundColor Green
}

# 5. Test with password
Write-Host "`n--- TEST WITH PASSWORD ---" -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "$BASE_URL/notes/$noteId?note_password=mypass123" -Method GET -Headers @{
        Authorization = "Bearer $token"
    }
    if ($result.content -eq "This is a secret") {
        Write-Host "PASS: Note accessible with correct password" -ForegroundColor Green
        Write-Host "Content: $($result.content)" -ForegroundColor Gray
    } else {
        Write-Host "FAIL: Wrong content" -ForegroundColor Red
    }
} catch {
    Write-Host "FAIL: $_" -ForegroundColor Red
}

Write-Host "`n=== DONE ===" -ForegroundColor Cyan