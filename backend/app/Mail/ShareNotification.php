<?php
namespace App\Mail;

use App\Models\User;
use App\Models\Note;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ShareNotification extends Mailable
{
    use Queueable, SerializesModels;

    public User $sharer;
    public Note $note;
    public string $permission;

    public function __construct(User $sharer, Note $note, string $permission)
    {
        $this->sharer = $sharer;
        $this->note = $note;
        $this->permission = $permission;
    }

    public function build()
    {
        $frontendUrl = config('app.frontend_url', 'http://localhost:5173');

        return $this->subject("{$this->sharer->name} shared a note with you")
                    ->markdown('emails.share-notification')
                    ->with([
                        'sharerName' => $this->sharer->name,
                        'noteTitle' => $this->note->title ?: 'Untitled',
                        'permission' => $this->permission === 'edit' ? 'Can edit' : 'Read only',
                        'noteUrl' => $frontendUrl . '/notes',
                    ]);
    }
}
