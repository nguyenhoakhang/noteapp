<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function updatePreferences(Request $request)
    {
        $request->validate([
            'font_size'   => 'sometimes|in:small,medium,large',
            'note_color'  => 'sometimes|string|max:20',
            'theme'       => 'sometimes|in:light,dark',
        ]);

        $request->user()->update($request->only('font_size', 'note_color', 'theme'));

        return response()->json($request->user());
    }

public function updateProfile(Request $request)
    {
        $request->validate([
            'name'  => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $request->user()->id,
        ]);

        $request->user()->update($request->only('name', 'email'));

        return response()->json($request->user());
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'password'         => 'required|confirmed|min:8',
        ]);

        if (!\Hash::check($request->current_password, $request->user()->password)) {
            return response()->json(['message' => 'Current password incorrect'], 422);
        }

        $request->user()->update(['password' => \Hash::make($request->password)]);
        $request->user()->tokens()->delete(); // force re-login

        return response()->json(['message' => 'Password changed. Please login again.']);
    }
    public function search(Request $request)
    {
        $request->validate(['q' => 'required|string|max:255']);
        $users = \App\Models\User::where('email', 'like', "%{$request->q}%")
            ->orWhere('name', 'like', "%{$request->q}%")
            ->limit(10)
            ->get(['id', 'name', 'email', 'avatar']);

        // Add avatar_url for each user
        $users->transform(function ($user) {
            $user->avatar_url = $user->avatar ? asset('storage/' . $user->avatar) : null;
            return $user;
        });

        return response()->json($users);
    }

    public function uploadAvatar(Request $request)
{
    $request->validate([
        'avatar' => 'required|image|max:2048|mimes:jpg,jpeg,png,gif,webp',
    ]);

    $user = $request->user();

    // Delete old avatar
    if ($user->avatar) {
        \Storage::disk('public')->delete($user->avatar);
    }

    $path = $request->file('avatar')->store('avatars', 'public');
    $user->update(['avatar' => $path]);

    return response()->json([
        'avatar' => $path,
        'avatar_url' => asset('storage/' . $path),
    ]);
}
}