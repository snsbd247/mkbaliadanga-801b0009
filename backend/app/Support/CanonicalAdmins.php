<?php

namespace App\Support;

use App\Models\Office;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Log;
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
        self::ensureWildcardPermission($role);
        $user->roles()->syncWithoutDetaching([$role->id]);

        return true;
    }

    /**
     * Build the current status report for the two required accounts.
     *
     * @return array<int, array{username:string, expected_role:string, exists:bool, active:bool, has_role:bool, password_ok:bool, token_ok:bool, token_error:?string, payload_ok:bool, payload_error:?string, ok:bool}>
     */
    public static function status(): array
    {
        $out = [];
        foreach (self::expected() as $a) {
            $user = User::query()->where('username', $a['username'])->first();
            $exists = (bool) $user;
            $active = $exists && (bool) $user->is_active;
            $hasRole = $exists && in_array($a['role'], $user->roleNames(), true);
            // Informational only: whether the account still uses the default
            // password. A changed password is expected and must NOT count as a
            // failure, otherwise admin:verify would keep trying to "fix" it.
            $passwordOk = $exists && Hash::check('Admin@123', $user->password);
            $tokenProbe = self::probeTokenHealth($user);
            $payloadProbe = self::probePayloadHealth($user);
            $out[] = [
                'username' => $a['username'],
                'expected_role' => $a['role'],
                'exists' => $exists,
                'active' => $active,
                'has_role' => $hasRole,
                'password_ok' => $passwordOk,
                'token_ok' => $tokenProbe['ok'],
                'token_error' => $tokenProbe['error'],
                'payload_ok' => $payloadProbe['ok'],
                'payload_error' => $payloadProbe['error'],
                'ok' => $exists && $active && $hasRole && $passwordOk && $tokenProbe['ok'] && $payloadProbe['ok'],
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
            self::ensureWildcardPermission($role);

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
            } else {
                // Repair profile + office/active state ONLY. Never reset the
                // password of an existing account — an admin may have changed it,
                // and update.sh must not revert it to the default.
                $updates = [
                    'name' => $a['name'],
                    'email' => $a['username'].'@mohammadkhani.com',
                    'office_id' => $user->office_id ?: $office->id,
                    'is_active' => true,
                ];

                $user->fill($updates)->save();
                $actions[] = "Verified account details for '{$a['username']}' (password preserved).";
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

    private static function ensureWildcardPermission(Role $role): void
    {
        $wildcard = Permission::query()->firstOrCreate(
            ['key' => '*'],
            ['id' => (string) Str::uuid(), 'module' => 'system', 'description' => 'All permissions'],
        );

        $role->permissions()->syncWithoutDetaching([$wildcard->id]);
    }

    /**
     * Attempt real token creation so deploy verification catches Sanctum/schema
     * problems before an admin discovers them on the login screen.
     *
     * @return array{ok:bool,error:?string}
     */
    private static function probeTokenHealth(?User $user): array
    {
        if (! $user || ! $user->is_active) {
            return ['ok' => false, 'error' => 'User missing or inactive'];
        }

        try {
            SanctumTokenSchema::ensureUuidTokenableId();
            $issued = $user->createToken('__admin_verify__'.Str::random(6));
            $issued->accessToken->delete();

            return ['ok' => true, 'error' => null];
        } catch (\Throwable $e) {
            Log::warning('Canonical admin token probe failed: '.$e->getMessage(), [
                'username' => $user->username,
                'user_id' => $user->id,
            ]);

            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    /** @return array{ok:bool,error:?string} */
    private static function probePayloadHealth(?User $user): array
    {
        if (! $user || ! $user->is_active) {
            return ['ok' => false, 'error' => 'User missing or inactive'];
        }

        try {
            $roles = $user->roleNames();
            $permissions = $user->permissionList();

            if (empty($roles)) {
                return ['ok' => false, 'error' => 'No roles returned by user role mapping'];
            }

            if ((in_array('developer', $roles, true) || in_array('super_admin', $roles, true)) && ! in_array('*', $permissions, true)) {
                return ['ok' => false, 'error' => 'Admin wildcard permission missing from payload'];
            }

            return ['ok' => true, 'error' => null];
        } catch (\Throwable $e) {
            Log::warning('Canonical admin payload probe failed: '.$e->getMessage(), [
                'username' => $user->username,
                'user_id' => $user->id,
            ]);

            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }
}
