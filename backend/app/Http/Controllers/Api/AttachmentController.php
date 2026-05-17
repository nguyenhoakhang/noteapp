<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Note;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AttachmentController extends Controller
{
    // POST /api/notes/{note}/attachments
    public function store(Request $request, Note $note)
    {
        abort_if($note->user_id !== $request->user()->id, 403);

        $request->validate([
            'files'   => 'required|array',
            'files.*' => 'file|max:10240|mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,txt,zip',
        ]);

        $uploaded = [];
        foreach ($request->file('files') as $file) {
            $path = $file->store("attachments/{$note->id}", 'public');
            $uploaded[] = Attachment::create([
                'note_id'   => $note->id,
                'filename'  => $file->getClientOriginalName(),
                'path'      => $path,
                'mime_type' => $file->getMimeType(),
                'size'      => $file->getSize(),
            ]);
        }

        return response()->json($uploaded, 201);
    }

    // DELETE /api/attachments/{attachment}
    public function destroy(Request $request, Attachment $attachment)
    {
        abort_if($attachment->note->user_id !== $request->user()->id, 403);

        Storage::disk('public')->delete($attachment->path);
        $attachment->delete();

        return response()->json(['message' => 'Deleted']);
    }
}