<?php

namespace App\Support;

use App\Models\Office;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Single source of truth for the two required admin accounts and their roles.
 *
 *   developer    -> ismail162  / Admin@123
 *   super_admin  -> suparadmin / Admin@123
 *
 * Used by the SuperAdminSeeder, the `admin:verify` command, the login
 * autofix and the admin verification screen so they never drift apart.
 */
class CanonicalAdmins
{
    /** @return array<int, array{username:string, role:string, name:string}> */
    public static function expected(): array
    {
        return [
            ['username' => 'ismail162', 'role' => 'developer', 'name' => 'Developer'],
            ['username' => 'suparadmin', 'role' => 'super_admin', 'name' => 'Super Admin'],
        ];
    }

    public static function isCanonical(string $username): bool
    {
        foreach (self::expected() as $a) {
            if ($a['username'] === $username) {
                return true;
            }
        }

        return false;
    }

    public static function expectedRoleFor(string $username): ?string
    {
        foreach (self::expected() as $a) {
            if ($a['username'] === $username) {
                return $a['role'];
            }
        }

        return null;
    }

    /**
     * Ensure the given canonical user has its required role. Idempotent.
     * Returns true if a role was (re)assigned.
     */
    public static function ensureRole(User $user): bool
    {
        $expected = self::expectedRoleFor($user->username);
        if ($expected === null) {
            return false;
        }

        if (in_array($expected, $user->roleNames(), true)) {
            return false;
        }

        $role = Role::query()->firstOrCreate(
            ['name' => $expected],
            ['id' => (string) Str::uuid(), 'description' => ucfirst(str_replace('_', ' ', $expected))],
        );
        $user->roles()->syncWithoutDetaching([$role->id]);

        return true;
    }

    /**
     * Build the current status report for the two required accounts.
     *
     * @return array<int, array{username:string, expected_role:string, exists:bool, active:bool, has_role:bool, ok:bool}>
     */
    public static function status(): array
    {
        $out = [];
        foreach (self::expected() as $a) {
            $user = User::query()->where('username', $a['username'])->first();
            $exists = (bool) $user;
            $active = $exists && (bool) $user->is_active;
            $hasRole = $exists && in_array($a['role'], $user->roleNames(), true);
            $out[] = [
                'username' => $a['username'],
                'expected_role' => $a['role'],
                'exists' => $exists,
                'active' => $active,
                'has_role' => $hasRole,
                'ok' => $exists && $active && $hasRole,
            ];
        }

        return $out;
    }

    /**
     * Create/repair both required accounts. Idempotent — never touches other data.
     * Returns a list of human-readable actions taken.
     *
     * @return array<int, string>
     */
    public static function fix(): array
    {
        $actions = [];

        $office = Office::query()->firstOrCreate(
            ['code' => 'HO'],
            ['id' => (string) Str::uuid(), 'name' => 'প্রধান কার্যালয়', 'is_active' => true],
        );

        foreach (self::expected() as $a) {
            $role = Role::query()->firstOrCreate(
                ['name' => $a['role']],
                ['id' => (string) Str::uuid(), 'description' => ucfirst(str_replace('_', ' ', $a['role']))],
            );

            $user = User::query()->where('username', $a['username'])->first();
            if (! $user) {
                $user = User::query()->create([
                    'name' => $a['name'],
                    'username' => $a['username'],
                    'email' => $a['username'].'@mohammadkhani.com',
                    'password' => Hash::make('Admin@123'),
                    'office_id' => $office->id,
                    'is_active' => true,
                ]);
                $actions[] = "Created missing user '{$a['username']}'.";
            }

            if (! $user->is_active) {
                $user->update(['is_active' => true]);
                $actions[] = "Reactivated '{$a['username']}'.";
            }

            if (! in_array($a['role'], $user->roleNames(), true)) {
                $user->roles()->syncWithoutDetaching([$role->id]);
                $actions[] = "Assigned role '{$a['role']}' to '{$a['username']}'.";
            }
        }

        return $actions;
    }
}
