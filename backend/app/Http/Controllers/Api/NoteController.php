<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Note;
use App\Models\NoteShare;
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
            ->with('labels:id,name')
            ->withCount('shares')
            ->select([
                'id','user_id','title',
                'content_preview',
                'color','is_pinned','pinned_at',
                \DB::raw('CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as is_protected'),
                'created_at','updated_at'
            ]);

        // Search
        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($q2) use ($q) {
                $q2->where('title', 'like', "%{$q}%")
                   ->orWhere('content', 'like', "%{$q}%");
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

        // Hydrate is_shared from share count
        $notes->each(fn($n) => $n->is_shared = $n->shares_count > 0);

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
        return new NoteResource($note);
    }

    // GET /api/notes/{id}
    public function show(Request $request, Note $note)
    {
        $this->authorizeNote($note, $request->user(), 'read');
        if ($err = $this->checkNotePassword($request, $note)) return $err;

        // Mark password as verified so NoteResource includes content
        if ($note->password) {
            // Check if password was provided in request
            if ($request->filled('note_password')) {
                $note->password_verified = true;
            }
            // Check if password was previously verified via cache (verify-password endpoint)
            $cacheKey = "note_pwd_{$note->id}_" . $request->user()->id;
            if (cache()->has($cacheKey)) {
                $note->password_verified = true;
            }
        }

        return new NoteResource(
            $note->load('labels:id,name', 'attachments')
        );
    }

    // PUT /api/notes/{id}
    public function update(Request $request, Note $note)
    {
        $this->authorizeNote($note, $request->user(), 'edit');
        if ($err = $this->checkNotePassword($request, $note)) return $err;

        // Mark password as verified so NoteResource includes content
        if ($note->password) {
            if ($request->filled('note_password')) {
                $note->password_verified = true;
            }
            $cacheKey = "note_pwd_{$note->id}_" . $request->user()->id;
            if (cache()->has($cacheKey)) {
                $note->password_verified = true;
            }
        }

        $note = $this->noteService->updateNote($note, $request->all());
        return new NoteResource($note);
    }

    // DELETE /api/notes/{id}
    public function destroy(Request $request, Note $note)
    {
        $this->authorizeNote($note, $request->user(), 'owner');
        if ($err = $this->checkNotePassword($request, $note)) return $err;

        $note->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // POST /api/notes/{id}/verify-password
    public function verifyPassword(Request $request, Note $note)
    {
        $request->validate(['note_password' => 'required']);
        if (!$note->password) {
            return response()->json(['message' => 'Note is not password protected'], 400);
        }
        if (!Hash::check($request->note_password, $note->password)) {
            return response()->json(['message' => 'Invalid password'], 403);
        }

        // Store verification in cache for 1 hour so subsequent requests don't need password
        $cacheKey = "note_pwd_{$note->id}_" . $request->user()->id;
        cache([$cacheKey => true], now()->addHour());

        return response()->json(['message' => 'Password verified']);
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

    // GET /api/notes/shared-with-me
    public function sharedWithMe(Request $request)
    {
        $userId = $request->user()->id;
        $shares = \App\Models\NoteShare::where('shared_with_id', $userId)
            ->with(['note:user_id,id,title,content,content_preview,color,is_pinned,pinned_at,password,created_at,updated_at', 'owner:id,name,email'])
            ->latest()
            ->get()
            ->map(function ($share) use ($userId) {
                $note = $share->note;
                if (!$note) return null;
                
                $isProtected = (bool) $note->password;
                $isVerified = false;
                
                if ($isProtected) {
                    // Check if password was verified via cache
                    $cacheKey = "note_pwd_{$note->id}_{$userId}";
                    $isVerified = cache()->has($cacheKey);
                }
                
                // Only include full content if not protected OR if verified
                $content = null;
                if (!$isProtected || $isVerified) {
                    $content = $note->content;
                }
                
                return [
                    'share_id'       => $share->id,
                    'note_id'        => $note->id,
                    'title'          => $note->title,
                    'content'        => $content,
                    'content_preview'=> $note->content_preview,
                    'color'          => $note->color,
                    'is_pinned'      => (bool) $note->is_pinned,
                    'pinned_at'      => $note->pinned_at,
                    'is_protected'   => $isProtected,
                    'permission'     => $share->permission,
                    'shared_at'      => $share->created_at,
                    'shared_by'      => $share->owner->only('id', 'name', 'email'),
                    'note_updated'   => $note->updated_at,
                ];
            })
            ->filter()
            ->values();

        return response()->json($shares);
    }

    // ── Helpers ──────────────────────────────────────────────

    /**
     * Check user permissions for note access
     * 
     * @param Note $note
     * @param \App\Models\User $user
     * @param string $require 'read', 'edit', or 'owner'
     * @throws \Symfony\Component\HttpKernel\Exception\HttpException
     */
    private function authorizeNote(Note $note, $user, string $require = 'read'): void
    {
        // Owner always has full access
        if ($note->user_id === $user->id) {
            return;
        }

        // Check for share record
        $share = NoteShare::where('note_id', $note->id)
            ->where('shared_with_id', $user->id)
            ->first();

        if (!$share) {
            abort(403, 'No access to this note');
        }

        // Owner-only actions
        if ($require === 'owner') {
            abort(403, 'Only the owner can perform this action');
        }

        // Edit access requires edit permission
        if ($require === 'edit' && $share->permission !== 'edit') {
            abort(403, 'You have read-only access to this note');
        }
    }

    /**
     * Check and verify note password if required
     * 
     * @param Request $request
     * @param Note $note
     * @return \Illuminate\Http\JsonResponse|null
     */
    private function checkNotePassword(Request $request, Note $note)
    {
        if (!$note->password) return null;
        
        // ✅ OWNERS NEVER NEED PASSWORD — they own the note
        if ($note->user_id === $request->user()->id) return null;
        
        // Check if password was previously verified via cache (verify-password endpoint)
        $cacheKey = "note_pwd_{$note->id}_" . $request->user()->id;
        if (cache()->has($cacheKey)) {
            return null;
        }
        
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