<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Note;
use App\Models\Label;
use App\Models\NoteShare;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        // ── Users ──
        $userA = User::create([
            'name'              => 'User A',
            'email'             => 'userA@example.com',
            'password'          => Hash::make('password'),
            'email_verified_at' => now(),
        ]);

        $userB = User::create([
            'name'              => 'User B',
            'email'             => 'userB@example.com',
            'password'          => Hash::make('password'),
            'email_verified_at' => now(),
        ]);

        $labelWork     = Label::create(['user_id' => $userA->id, 'name' => 'Work']);
        $labelPersonal = Label::create(['user_id' => $userA->id, 'name' => 'Personal']);
        $labelIdeas    = Label::create(['user_id' => $userA->id, 'name' => 'Ideas']);

        $labelProjects = Label::create(['user_id' => $userB->id, 'name' => 'Projects']);
        $labelStudy    = Label::create(['user_id' => $userB->id, 'name' => 'Study']);
        $labelRandom   = Label::create(['user_id' => $userB->id, 'name' => 'Random']);

        $noteA1 = Note::create([
            'user_id'   => $userA->id,
            'title'     => 'Welcome to NoteApp',
            'content'   => '<h2>Welcome to NoteApp!</h2><p>This is a <strong>rich text</strong> note created with the TipTap editor. You can:</p><ul><li>Use <strong>bold</strong>, <em>italic</em>, and <span style="color: #ff0000">colored text</span></li><li>Create headings and lists</li><li>Add images and attachments</li><li>Pin important notes to the top</li></ul><p>524H0098 - 524H0109</p>',
            'color'     => '#fef9c3',
            'is_pinned' => true,
            'pinned_at' => now(),
        ]);

        $noteA2 = Note::create([
            'user_id'   => $userA->id,
            'title'     => 'Shopping List',
            'content'   => '<ul><li>Milk</li><li>Eggs</li><li>Bread</li><li>Apples</li><li>Chicken breast</li></ul>',
            'color'     => '#d1fae5',
            'is_pinned' => false,
        ]);

        $noteA3 = Note::create([
            'user_id'   => $userA->id,
            'title'     => 'Secret Note',
            'content'   => '<p>This note is <strong>password protected</strong>. Only people who know the password can view its content.</p><p>Password: <code>secret123</code></p>',
            'color'     => '#fce7f3',
            'is_pinned' => false,
            'password'  => Hash::make('secret123'),
        ]);

        $noteB1 = Note::create([
            'user_id'   => $userB->id,
            'title'     => 'Project Alpha',
            'content'   => '<h2>Project Alpha Plan</h2><p><strong>Goal:</strong> Launch MVP by end of Q2</p><ol><li>Finalize requirements</li><li>Design system architecture</li><li>Implement core features</li><li>Testing and QA</li><li>Deploy to production</li></ol>',
            'color'     => '#dbeafe',
            'is_pinned' => true,
            'pinned_at' => now(),
        ]);

        $noteB2 = Note::create([
            'user_id'   => $userB->id,
            'title'     => 'Study Notes',
            'content'   => '<h3>Chapter 5: Database Design</h3><p>Key concepts:</p><ul><li>Normalization (1NF, 2NF, 3NF)</li><li>Indexes and query optimization</li><li>ACID properties</li><li>Transactions and locking</li></ul>',
            'color'     => '#ffedd5',
            'is_pinned' => false,
        ]);

        $noteA1->labels()->attach([$labelWork->id]);
        $noteA2->labels()->attach([$labelPersonal->id]);
        $noteA3->labels()->attach([$labelIdeas->id]);
        $noteB1->labels()->attach([$labelProjects->id]);
        $noteB2->labels()->attach([$labelStudy->id]);

        NoteShare::create([
            'note_id'         => $noteA1->id,
            'owner_id'        => $userA->id,
            'shared_with_id'  => $userB->id,
            'permission'      => 'read',
        ]);
    }
}
