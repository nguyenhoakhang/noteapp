<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Label;
use Illuminate\Http\Request;

class LabelController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            Label::where('user_id', $request->user()->id)->withCount('notes')->get()
        );
    }

    public function store(Request $request)
    {
        $request->validate(['name' => 'required|string|max:50']);

        $label = Label::create(['user_id' => $request->user()->id, 'name' => $request->name]);
        return response()->json($label, 201);
    }

    public function update(Request $request, Label $label)
    {
        abort_if($label->user_id !== $request->user()->id, 403);
        $request->validate(['name' => 'required|string|max:50']);

        $label->update(['name' => $request->name]);
        return response()->json($label);
    }

    public function destroy(Request $request, Label $label)
    {
        if ($label->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $label->notes()->detach();
        $label->delete();

        return response()->json(['message' => 'Label deleted']);
    }
}