# notes-app
Final Project Semester 2 2025-2026
docker exec -it noteapp_frontend sh
# Sau khi vào trong container rồi thì chạy:
npm install @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor @tiptap/y-tiptap yjs y-prosemirror @hocuspocus/provider --legacy-peer-deps
exit
docker exec -it noteapp_frontend npm install @tiptap/extension-collaboration@latest @tiptap/extension-collaboration-cursor@latest --legacy-peer-deps

docker exec -it noteapp_frontend npm install date-fns