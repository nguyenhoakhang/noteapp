<?php
namespace App\Services;

use App\Models\Note;
use App\Models\NoteShare;
use App\Http\Resources\NoteResource;
use Illuminate\Support\Facades\Log;

class NoteService
{
    public function createNote($user, array $data): Note
    {
        try {
            $content = $data['content'] ?? null;
            $preview = $content ? strip_tags(mb_substr($content, 0, 200)) : null;
            $note = Note::create([
                'user_id'         => $user->id,
                'title'           => $data['title']   ?? null,
                'content'         => $content,
                'content_preview' => $preview,
                'color'           => $data['color']   ?? $user->note_color,
            ]);
            Log::info('Note created', ['note_id' => $note->id, 'user_id' => $user->id]);
            return $note->load('labels', 'attachments');
        } catch (\Exception $e) {
            Log::error('NoteService@createNote failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            throw $e;
        }
    }

    public function updateNote(Note $note, array $data): Note
    {
        try {
            // Remove virtual attributes that should NOT be persisted to DB
            $note->offsetUnset('password_verified');

            $updateData = array_filter([
                'title'   => $data['title']   ?? $note->title,
                'content' => $data['content'] ?? $note->content,
                'color'   => $data['color']   ?? $note->color,
            ], fn($v) => $v !== null);

            // Regenerate preview if content changed
            if (isset($updateData['content'])) {
                $updateData['content_preview'] = strip_tags(mb_substr($updateData['content'], 0, 200));
            }

            $note->update($updateData);

            if (isset($data['label_ids'])) {
                $note->labels()->sync($data['label_ids']);
            }

            $note->load('labels', 'attachments');
            $note->loadCount('shares');
            $note->is_shared = $note->shares_count > 0;

            // Preserve password_verified flag if it was set (for NoteResource)

            if (!empty($note->password_verified)) {
                $note->password_verified = true;
            }

            return $note;
        } catch (\Exception $e) {
            Log::error('NoteService@updateNote failed', ['note_id' => $note->id, 'error' => $e->getMessage()]);
            throw $e;
        }
    }

    public function togglePin(Note $note): Note
    {
        $note->update([
            'is_pinned' => !$note->is_pinned,
            'pinned_at' => !$note->is_pinned ? now() : null,
        ]);
        return $note->fresh();
    }

}
