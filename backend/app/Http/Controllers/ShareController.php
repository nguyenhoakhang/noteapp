<?php
namespace App\Http\Controllers;

use App\Models\{Note, User, NoteShare};
use App\Mail\ShareNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ShareController extends Controller
{
    // GET /api/notes/{note}/shares
    public function index(Request $request, Note $note)
    {
        if ($note->user_id !== $request->user()->id) abort(403);

        return response()->json(
            $note->shares()
                ->with('sharedWith:id,name,email,avatar')
                ->get()
                ->map(fn($s) => [
                    'user_id'    => $s->shared_with_id,
                    'name'       => $s->sharedWith->name,
                    'email'      => $s->sharedWith->email,
                    'avatar'     => $s->sharedWith->avatar,
                    'avatar_url' => $s->sharedWith->avatar ? asset('storage/' . $s->sharedWith->avatar) : null,
                    'permission' => $s->permission,
                    'shared_at'  => $s->created_at,
                ])
        );
    }

    // POST /api/notes/{note}/shares
    public function store(Request $request, Note $note)
    {
        if ($note->user_id !== $request->user()->id) abort(403);

        $request->validate([
            'email'      => 'required|email|exists:users,email',
            'permission' => 'required|in:read,edit',
        ]);

        $target = User::where('email', $request->email)->firstOrFail();

        if ($target->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot share with yourself'], 422);
        }

        $share = NoteShare::updateOrCreate(
            ['note_id' => $note->id, 'shared_with_id' => $target->id],
            ['owner_id' => $request->user()->id, 'permission' => $request->permission]
        );

        // Send email notification (queued)
        try {
            Mail::to($target->email)->queue(
                new ShareNotification($request->user(), $note, $request->permission)
            );
        } catch (\Exception $e) {
            // Email failure should not block the share
            \Log::warning('Failed to send share notification: ' . $e->getMessage());
        }

        return response()->json([
            'user_id'    => $target->id,
            'name'       => $target->name,
            'email'      => $target->email,
            'avatar'     => $target->avatar,
            'avatar_url' => $target->avatar ? asset('storage/' . $target->avatar) : null,
            'permission' => $share->permission,
            'shared_at'  => $share->created_at,
        ], 201);
    }

    // PUT /api/notes/{note}/shares/{userId}
    public function update(Request $request, Note $note, $userId)
    {
        if ($note->user_id !== $request->user()->id) abort(403);
        $request->validate(['permission' => 'required|in:read,edit']);

        $share = NoteShare::where('note_id', $note->id)
            ->where('shared_with_id', $userId)->firstOrFail();
        $share->update(['permission' => $request->permission]);

        return response()->json(['permission' => $share->permission]);
    }

    // DELETE /api/notes/{note}/shares/{userId}
    public function destroy(Request $request, Note $note, $userId)
    {
        // Owner OR the user themselves can revoke
        $me = $request->user()->id;
        if ($note->user_id !== $me && $me !== (int)$userId) abort(403);

        NoteShare::where('note_id', $note->id)
            ->where('shared_with_id', $userId)->delete();

        return response()->json(['message' => 'Access revoked']);
    }

    // GET /api/shared-with-me  ← "Shared with me" section
    public function sharedWithMe(Request $request)
    {
        $shares = NoteShare::where('shared_with_id', $request->user()->id)
            ->with([
                'note:id,title,content_preview,color,is_pinned,user_id,updated_at,password',
                'owner:id,name,email',
            ])
            ->latest()
            ->get()
            ->map(fn($s) => [
                'share_id'    => $s->id,
                'note_id'     => $s->note_id,
                'title'       => $s->note->title,
                'preview'     => $s->note->password ? null : \Str::limit(strip_tags($s->note->content_preview ?? ''), 120),
                'color'       => $s->note->color,
                'permission'  => $s->permission,
                'is_protected'=> (bool) $s->note->password,
                'shared_by'   => ['name' => $s->owner->name, 'email' => $s->owner->email],
                'shared_at'   => $s->created_at,
                'note_updated'=> $s->note->updated_at,
            ]);

        return response()->json($shares);
    }
}