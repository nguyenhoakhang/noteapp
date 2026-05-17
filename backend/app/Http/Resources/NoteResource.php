<?php
namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class NoteResource extends JsonResource
{
    public function toArray($request): array
    {
        // Check if password is verified via:
        // 1. In-memory attribute set by controller (password_verified)
        // 2. Session/cache store (for cross-request persistence)
        $passwordVerified = !empty($this->password_verified)
            || cache("note_pwd_{$this->id}_" . ($request->user()?->id ?? 'anon')) === true;

        $canViewContent = !$this->password || $passwordVerified;

        return [
            'id'              => $this->id,
            'title'           => $this->title,
            'content'         => $canViewContent ? ($this->content ?? $this->content_preview) : null,
            'content_preview' => $this->content_preview,
            'color'           => $this->color,
            'is_pinned'       => (bool) $this->is_pinned,
            'pinned_at'       => $this->pinned_at,
            'is_protected'    => (bool) ($this->is_protected ?? $this->password),
            'is_shared'       => (bool) ($this->is_shared ?? $this->shares_count > 0),
            'created_at'      => $this->created_at,
            'updated_at'      => $this->updated_at,
            'labels'          => $this->whenLoaded('labels', fn() =>
                $this->labels->map(fn($l) => ['id' => $l->id, 'name' => $l->name])
            ),
        ];

    }
}
