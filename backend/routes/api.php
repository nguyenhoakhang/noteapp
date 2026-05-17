<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\NoteController;
use App\Http\Controllers\Api\LabelController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\LinkPreviewController;
// use App\Http\Controllers\Api\ShareController;
use App\Http\Controllers\ShareController;
use Illuminate\Http\Request;

// =========================
// Public routes
// =========================

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login',    [AuthController::class, 'login']);

// Email verification (signed URL)
Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verify'])
    ->middleware(['signed'])
    ->name('verification.verify');
    
// Password reset
Route::post('/forgot-password', [PasswordResetController::class, 'sendLink']);
Route::post('/reset-password',  [PasswordResetController::class, 'reset']);

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

// OTP routes
Route::post('/auth/otp/send',   [AuthController::class, 'sendOtp']);
Route::post('/auth/otp/verify', [AuthController::class, 'verifyOtp']);
Route::post('/auth/otp/reset',  [AuthController::class, 'resetWithOtp']);

// =========================
// Protected routes (Sanctum)
// =========================

Route::middleware('auth:sanctum')->group(function () {

    Route::prefix('notes/{note}')->group(function () {
        Route::get('/shares',           [ShareController::class, 'index']);
        Route::post('/shares',          [ShareController::class, 'store']);
        Route::put('/shares/{userId}',  [ShareController::class, 'update']);
        Route::delete('/shares/{userId}', [ShareController::class, 'destroy']);
    });

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me',      [AuthController::class, 'me']);

    // Email verification
    Route::post('/email/verification-notification', [AuthController::class, 'sendVerification']);
    Route::post('/email/resend', [AuthController::class, 'resendVerification']);

    // User
    Route::patch('/user/preferences', [UserController::class, 'updatePreferences']);
    Route::patch('/user/profile',     [UserController::class, 'updateProfile']);
    Route::post('/user/change-password', [UserController::class, 'changePassword']);
    Route::post('/user/avatar', [UserController::class, 'uploadAvatar']);
    Route::get('/users/search', [UserController::class, 'search']);

    // =========================
    // Notes
    // =========================

    Route::get('/notes/shared-with-me', [NoteController::class, 'sharedWithMe']);
    Route::apiResource('notes', NoteController::class);

    // Pin note
    Route::post('/notes/{note}/pin', [NoteController::class, 'pin']);

    // Password management for notes
    Route::post('/notes/{note}/set-password',    [NoteController::class, 'setPassword']);
    Route::post('/notes/{note}/verify-password', [NoteController::class, 'verifyPassword']);
    Route::post('/notes/{note}/password',        [NoteController::class, 'setPassword']);
    Route::put('/notes/{note}/password',         [NoteController::class, 'changePassword']);
    Route::delete('/notes/{note}/password',      [NoteController::class, 'removePassword']);


    // Labels
    Route::apiResource('labels', LabelController::class)
        ->except(['show']);

    // Link preview
    Route::get('/link-preview', [LinkPreviewController::class, 'preview']);

    // Attachments
    Route::post('/notes/{note}/attachments', [AttachmentController::class, 'store']);
    Route::delete('/attachments/{attachment}', [AttachmentController::class, 'destroy']);

    // =========================
    // Collaboration Auth
    // =========================
    
    Route::get('/collab/auth/{noteId}', function (Request $request, $noteId) {
        $user = $request->user();
        $note = \App\Models\Note::findOrFail($noteId);

        $isOwner = $note->user_id === $user->id;
        $share = \App\Models\NoteShare::where('note_id', $noteId)
            ->where('shared_with_id', $user->id)
            ->first();

        $allowed = $isOwner || ($share && $share->permission === 'edit');

        return response()->json([
            'allowed' => $allowed,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
            ],
        ]);
    });
});