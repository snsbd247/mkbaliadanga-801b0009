<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\CanonicalAdmins;
use Illuminate\Http\JsonResponse;

class AdminVerifyController extends Controller
{
    /**
     * GET /api/admin/verify — required admin status + full user/role mapping.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'required' => CanonicalAdmins::status(),
            'users' => $this->userMap(),
        ]);
    }

    /**
     * POST /api/admin/verify/fix — repair the two required admin accounts.
     */
    public function fix(): JsonResponse
    {
        $actions = CanonicalAdmins::fix();

        return response()->json([
            'actions' => $actions,
            'required' => CanonicalAdmins::status(),
            'users' => $this->userMap(),
        ]);
    }

    /** @return array<int, array{id:string, username:string, name:string, active:bool, roles:array<int,string>}> */
    private function userMap(): array
    {
        return User::query()
            ->orderBy('username')
            ->get()
            ->map(static fn (User $u) => [
                'id' => $u->id,
                'username' => $u->username,
                'name' => $u->name,
                'active' => (bool) $u->is_active,
                'roles' => $u->roleNames(),
            ])
            ->all();
    }
}
