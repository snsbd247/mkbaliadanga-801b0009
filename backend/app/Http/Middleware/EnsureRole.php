<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureRole {
    public function handle(Request $request, Closure $next, string ...$roles) {
        $user = $request->user();
        if (!$user) abort(401, 'Unauthenticated');
        foreach ($roles as $r) if ($user->hasRole($r)) return $next($request);
        abort(403, 'Forbidden — required role: '.implode('|', $roles));
    }
}
