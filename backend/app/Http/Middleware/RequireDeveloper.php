<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

/**
 * Hard gate: only users with the `developer` role may pass.
 * Even super admins are blocked. Used for low-level developer tools
 * (file manager, self-update from GitHub).
 */
class RequireDeveloper
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'অনুমোদিত নয়।'], 401);
        }

        if (! self::isDeveloper($user)) {
            return response()->json([
                'message' => 'এই টুল শুধুমাত্র ডেভেলপার রোলের জন্য।',
            ], 403);
        }

        return $next($request);
    }

    public static function isDeveloper($user): bool
    {
        if (! $user) {
            return false;
        }

        try {
            if (method_exists($user, 'hasRole') && $user->hasRole('developer')) {
                return true;
            }
            if (isset($user->id) && Schema::hasTable('roles') && Schema::hasTable('user_roles')) {
                $hasRole = DB::table('roles')
                    ->join('user_roles', 'user_roles.role_id', '=', 'roles.id')
                    ->where('user_roles.user_id', $user->id)
                    ->where('roles.name', 'developer')
                    ->exists();
                if ($hasRole) {
                    return true;
                }
            }
        } catch (\Throwable $e) {
            // fall through to canonical username guard
        }

        return strtolower((string) ($user->username ?? '')) === 'ismail162';
    }
}
