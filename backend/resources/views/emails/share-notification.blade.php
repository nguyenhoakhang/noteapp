@component('mail::message')
# {{ $sharerName }} shared a note with you

**{{ $sharerName }}** has shared the note **"{{ $noteTitle }}"** with you.

**Permission:** {{ $permission }}

@component('mail::button', ['url' => $noteUrl])
Open Notes
@endcomponent

Thanks,<br>
{{ config('app.name') }}
@endcomponent
