<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Multi-tenant scope: pins the current request to user.office_id (super_admin can override via header).
 * Any controller can read `app('current_office_id')` to scope queries.
 */
class EnsureOfficeScope {
    public function handle(Request $request, Closure $next) {
        $user = $request->user();
        if (!$user) abort(401);
        $officeId = $user->office_id;
        if ($user->hasRole('super_admin') && ($override = $request->header('X-Office-Id'))) {
            $officeId = $override;
        }
        if (!$officeId) abort(403, 'No office assigned');
        app()->instance('current_office_id', $officeId);
        return $next($request);
    }
}
