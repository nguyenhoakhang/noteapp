<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attachment extends Model
{
    protected $fillable = ['note_id','filename','path','mime_type','size','type'];

    public function note() { return $this->belongsTo(Note::class); }
}