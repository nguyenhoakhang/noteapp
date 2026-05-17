<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Note;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Services\NoteService;
use App\Http\Resources\NoteResource;

class NoteController extends Controller
{
    protected NoteService $noteService;

    public function __construct(NoteService $noteService)
    {
        $this->noteService = $noteService;
    }

    // GET /api/notes
public function index(Request $request)
{
    $user  = $request->user();
    $query = Note::where('user_id', $user->id)
        ->with([
            'labels:id,name',
            'shares.sharedWith:id,name,email',
            'attachments:id,note_id,path,type',
        ])
        ->select([
            'id','user_id','title',
            // Chỉ lấy 200 ký tự đầu content cho card preview
            \DB::raw('LEFT(content, 200) as content'),
            'color','is_pinned','pinned_at',
            \DB::raw('CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as is_protected'),
            'created_at','updated_at'
        ]);

    // Search
    if ($request->filled('search')) {
        $q = $request->search;
        $query->where(function ($q2) use ($q) {
            $q2->where('title',   'like', "%{$q}%")
               ->orWhere('content','like', "%{$q}%");
        });
    }

    // Label filter
    if ($request->filled('label_id')) {
        $query->whereHas('labels', fn($q) =>
            $q->where('labels.id', $request->label_id)
        );
    }

    $notes = $query
        ->orderByRaw('is_pinned DESC')
        ->orderByRaw('CASE WHEN is_pinned = 1 THEN pinned_at END DESC')
        ->orderByDesc('created_at')
        ->limit(100)
        ->get();

    return NoteResource::collection($notes);
}

    // POST /api/notes
    public function store(Request $request)
    {
        $request->validate([
            'title'   => 'nullable|string|max:255',
            'content' => 'nullable|string',
            'color'   => 'nullable|string|max:20',
        ]);

        $note = $this->noteService->createNote($request->user(), $request->all());
        return response()->json($note, 201);
    }

    // GET /api/notes/{id}
public function show(Request $request, Note $note)
{
    $this->authorizeNote($note, $request->user());
    if ($err = $this->checkNotePassword($request, $note)) return $err;

    return new NoteResource(
        $note->load('labels:id,name', 'attachments', 'shares.sharedWith:id,name,email')
    );
}

    // PUT /api/notes/{id}
public function update(Request $request, Note $note)
{
    $this->authorizeNote($note, $request->user(), 'edit');
    if ($err = $this->checkNotePassword($request, $note)) return $err;

    $note = $this->noteService->updateNote($note, $request->all());
    return response()->json($note);
}

    // DELETE /api/notes/{id}
public function destroy(Request $request, Note $note)
{
    $this->authorizeNote($note, $request->user(), 'owner');
    if ($err = $this->checkNotePassword($request, $note)) return $err;

    $note->delete();
    return response()->json(['message' => 'Deleted']);
}

    // POST /api/notes/{id}/pin
    public function pin(Request $request, Note $note)
    {
        $this->authorizeNote($note, $request->user(), 'owner');
        return response()->json($this->noteService->togglePin($note));
    }

    // POST /api/notes/{id}/set-password
public function setPassword(Request $request, Note $note)
{
    $this->authorizeNote($note, $request->user(), 'owner');
    $request->validate(['password' => 'required|min:4']);
    $note->update(['password' => Hash::make($request->password)]);
    return response()->json(['is_protected' => true]);
}

public function changePassword(Request $request, Note $note)
{
    $this->authorizeNote($note, $request->user(), 'owner');
    $request->validate([
        'current_password' => 'required',
        'password'         => 'required|min:4',
    ]);
    if (!Hash::check($request->current_password, $note->password)) {
        return response()->json(['message' => 'Current password is incorrect'], 403);
    }
    $note->update(['password' => Hash::make($request->password)]);
    return response()->json(['is_protected' => true]);
}

public function removePassword(Request $request, Note $note)
{
    $this->authorizeNote($note, $request->user(), 'owner');
    $request->validate(['current_password' => 'required']);
    if (!Hash::check($request->current_password, $note->password)) {
        return response()->json(['message' => 'Incorrect password'], 403);
    }
    $note->update(['password' => null]);
    return response()->json(['is_protected' => false]);
}
    // ── Sharing ──────────────────────────────────────────────

    // POST /api/notes/{id}/share
    public function share(Request $request, Note $note)
    {
        $this->authorizeNote($note, $request->user(), 'owner');

        $request->validate([
            'email'      => 'required|email|exists:users,email',
            'permission' => 'required|in:read,edit',
        ]);

        $target = \App\Models\User::where('email', $request->email)->first();

        if ($target->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot share with yourself'], 422);
        }

        $share = $note->shares()->updateOrCreate(
            ['shared_with_id' => $target->id],
            ['owner_id' => $request->user()->id, 'permission' => $request->permission]
        );

        return response()->json($share->load('sharedWith'), 201);
    }

    // DELETE /api/notes/{id}/share/{share_id}
    public function revokeShare(Note $note, $shareId)
    {
        $share = $note->shares()->findOrFail($shareId);
        $this->authorize('delete', $share);
        $share->delete();
        return response()->json(['message' => 'Revoked']);
    }

    // PATCH /api/notes/{id}/share/{share_id}
    public function updateShare(Request $request, Note $note, $shareId)
    {
        $this->authorizeNote($note, $request->user(), 'owner');

        $request->validate(['permission' => 'required|in:read,edit']);

        $share = $note->shares()->findOrFail($shareId);
        $share->update(['permission' => $request->permission]);

        return response()->json($share);
    }

    // GET /api/notes/shared-with-me
    public function sharedWithMe(Request $request)
    {
        $shares = \App\Models\NoteShare::where('shared_with_id', $request->user()->id)
            ->with(['note.labels', 'note.attachments', 'owner'])
            ->latest()
            ->get()
            ->map(function ($share) {
                $note = $share->note;
                if ($note && $note->password) {
                    $note->makeHidden(['content']);
                    $note->setAttribute('is_protected', true);
                }
                $note?->makeHidden(['password']);
                return [
                    'share_id'   => $share->id,
                    'permission' => $share->permission,
                    'shared_at'  => $share->created_at,
                    'shared_by'  => $share->owner->only('id', 'name', 'email'),
                    'note'       => $note,
                ];
            });

        return response()->json($shares);
    }

private function authorizeNote(Note $note, $user, string $require = 'read'): void
{
    // Debug log
    \Log::info('Authorize note', [
        'note_id' => $note->id,
        'note_user_id' => $note->user_id,
        'current_user_id' => $user->id,
        'require' => $require
    ]);
    
    if ($note->user_id === $user->id) {
        \Log::info('User is owner');
        return; // owner always allowed
    }

    $share = $note->shares()->where('shared_with_id', $user->id)->first();

    if (!$share) {
        \Log::error('No share found for user ' . $user->id);
        abort(403, 'No access to this note');
    }

    if ($require === 'owner') {
        abort(403, 'Only the owner can perform this action');
    }

    if ($require === 'edit' && $share->permission !== 'edit') {
        \Log::error('User has read-only access');
        abort(403, 'You have read-only access to this note');
    }
    
    \Log::info('Authorization passed');
}
private function checkNotePassword(Request $request, Note $note)
{
    if (!$note->password) return null;
    $provided = $request->input('note_password');
    if (!$provided || !Hash::check($provided, $note->password)) {
        return response()->json([
            'message'      => 'Note password required',
            'needs_unlock' => true,
        ], 403);
    }
    return null;
}
}