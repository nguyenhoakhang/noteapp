<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\PasswordResetOtp;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules\Password;
use Illuminate\Auth\Events\Verified;


class AuthController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'name'                  => 'required|string|max:255',
            'email'                 => 'required|email|unique:users',
            'password'              => ['required', 'confirmed', Password::min(8)],
        ]);

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
        ]);

        // Queue verification email instead of sending synchronously
        $user->sendEmailVerificationNotification();

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $user  = Auth::user();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    public function sendVerification(Request $request)
    {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json(['message' => 'Already verified']);
        }
        $request->user()->sendEmailVerificationNotification();
        return response()->json(['message' => 'Verification email sent']);
    }

    public function verify(Request $request, $id, $hash)
    {
        $user = \App\Models\User::findOrFail($id);

        if (!hash_equals((string) $hash, sha1($user->email))) {
            return redirect(env('FRONTEND_URL', 'http://localhost:8080') . '/?verified=error');
        }

        if (!$user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return redirect(env('FRONTEND_URL', 'http://localhost:8080') . '/?verified=1');
    }
    
    public function resendVerification(Request $request)
    {
        $user = $request->user();
        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Already verified'], 400);
        }
        $user->sendEmailVerificationNotification();
        return response()->json(['message' => 'Verification email sent']);
    }

    // =========================
    // Password Reset via OTP
    // =========================

    /**
     * Step 1: Send OTP to email
     */
    public function sendOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email'
        ]);

        // Delete old OTPs for this email
        PasswordResetOtp::where('email', $request->email)->delete();

        // Generate 6-digit OTP
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        PasswordResetOtp::create([
            'email'      => $request->email,
            'otp'        => bcrypt($otp),
            'expires_at' => now()->addMinutes(10),
        ]);

        // Send email
        Mail::send('emails.otp', ['otp' => $otp], function ($m) use ($request) {
            $m->to($request->email)
              ->subject('Your password reset OTP');
        });

        return response()->json(['message' => 'OTP sent to your email']);
    }

    /**
     * Step 2: Verify OTP and return reset token
     */
    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp'   => 'required|string|size:6',
        ]);

        $record = PasswordResetOtp::where('email', $request->email)
            ->latest()
            ->first();

        if (!$record || $record->isExpired() || !Hash::check($request->otp, $record->otp)) {
            return response()->json(['message' => 'Invalid or expired OTP'], 422);
        }

        // Return a short-lived token to authorize reset
        $resetToken = base64_encode($request->email . '|' . time());
        
        // Invalidate this OTP
        $record->update(['otp' => bcrypt('used_' . $resetToken)]);

        return response()->json(['reset_token' => $resetToken]);
    }

    /**
     * Step 3: Reset password using reset token
     */
    public function resetWithOtp(Request $request)
    {
        $request->validate([
            'reset_token' => 'required|string',
            'password'    => 'required|min:8|confirmed',
        ]);

        try {
            [$email, $ts] = explode('|', base64_decode($request->reset_token));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Invalid token'], 422);
        }

        // Token valid for 15 minutes
        if (time() - (int)$ts > 900) {
            return response()->json(['message' => 'Reset token expired'], 422);
        }

        $user = User::where('email', $email)->firstOrFail();
        $user->forceFill(['password' => Hash::make($request->password)])->save();
        
        // Delete all user tokens to force re-login
        $user->tokens()->delete();

        // Delete OTP records
        PasswordResetOtp::where('email', $email)->delete();

        return response()->json(['message' => 'Password reset successfully']);
    }
}