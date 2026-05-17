#!/bin/bash
# Test script for Bug 1 (shared note shows blank) and Bug 2 (password not enforced)
BASE="http://localhost:8080/api"

echo "=== Bug 1: Share feature - shared note shows as blank/untitled ==="
echo ""

# Register User A (owner)
echo "--- Registering User A (owner) ---"
R1=$(curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name":"OwnerA","email":"ownera@test.com","password":"12345678","password_confirmation":"12345678"}')
TOKEN_A=$(echo "$R1" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "$R1" | python -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Token A: ${TOKEN_A:0:20}..."

# Register User B (sharee)
echo "--- Registering User B (sharee) ---"
R2=$(curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name":"UserB","email":"userb@test.com","password":"12345678","password_confirmation":"12345678"}')
TOKEN_B=$(echo "$R2" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "$R2" | python -c "import sys,json; print(json.load(sys.stdin)['token'])")
USER_B_ID=$(echo "$R2" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])" 2>/dev/null || echo "$R2" | python -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
echo "Token B: ${TOKEN_B:0:20}..., User B ID: $USER_B_ID"

# User A creates a note
echo "--- User A creates a note ---"
NOTE_R=$(curl -s -X POST "$BASE/notes" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{"title":"Shared Test Note","content":"<p>This is shared content</p>","color":"#d1fae5"}')
NOTE_ID=$(echo "$NOTE_R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "$NOTE_R" | python -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Note ID: $NOTE_ID"

# User A shares the note with User B
echo "--- User A shares note with User B ---"
SHARE_R=$(curl -s -X POST "$BASE/notes/$NOTE_ID/shares" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"email\":\"userb@test.com\",\"permission\":\"read\"}")
echo "Share response: $SHARE_R"

# User B checks shared-with-me
echo "--- User B checks shared notes ---"
SHARED_R=$(curl -s -X GET "$BASE/notes/shared-with-me" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN_B")
echo "Shared with me response:"
echo "$SHARED_R" | python3 -m json.tool 2>/dev/null || echo "$SHARED_R" | python -m json.tool 2>/dev/null || echo "$SHARED_R"

echo ""
echo "=== Bug 2: Set password for note - password is enforced ==="
echo ""

# User A sets password on the note
echo "--- User A sets password on note ---"
PWD_R=$(curl -s -X POST "$BASE/notes/$NOTE_ID/set-password" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{"password":"secret123"}')
echo "Set password response: $PWD_R"

# User A (owner) should bypass password - get content without password
echo "--- User A (owner) gets note WITHOUT password (should see content) ---"
OWNER_R=$(curl -s -X GET "$BASE/notes/$NOTE_ID" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN_A")
OWNER_CONTENT=$(echo "$OWNER_R" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('content:', d.get('content','NONE'))" 2>/dev/null || echo "$OWNER_R" | python -c "import sys,json; d=json.load(sys.stdin)['data']; print('content:', d.get('content','NONE'))")
echo "Owner sees: $OWNER_CONTENT"

# User B (non-owner) tries to get note WITHOUT password - should get 403 needs_unlock
echo "--- User B (non-owner) gets note WITHOUT password (should get 403 needs_unlock) ---"
B_NO_PWD=$(curl -s -w "\n%{http_code}" -X GET "$BASE/notes/$NOTE_ID" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN_B")
HTTP_CODE=$(echo "$B_NO_PWD" | tail -1)
BODY=$(echo "$B_NO_PWD" | head -n -1)
echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"

# User B verifies password first
echo "--- User B verifies password ---"
VERIFY_R=$(curl -s -X POST "$BASE/notes/$NOTE_ID/verify-password" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d '{"note_password":"secret123"}')
echo "Verify response: $VERIFY_R"

# User B gets note WITH password - should see content
echo "--- User B gets note WITH password (should see content) ---"
B_WITH_PWD=$(curl -s -X GET "$BASE/notes/$NOTE_ID" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN_B" \
  -d '{"note_password":"secret123"}')
B_CONTENT=$(echo "$B_WITH_PWD" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('content:', d.get('content','NONE'))" 2>/dev/null || echo "$B_WITH_PWD" | python -c "import sys,json; d=json.load(sys.stdin)['data']; print('content:', d.get('content','NONE'))")
echo "User B sees: $B_CONTENT"

echo ""
echo "=== SUMMARY ==="
echo "Bug 1 (shared note blank): Check if shared-with-me response has title/content"
echo "Bug 2 (password not enforced): Check if non-owner gets 403 without password"
