<?php

namespace Tests\Feature;

use App\Http\Controllers\GenericTableController;
use Illuminate\Http\Request;
use ReflectionMethod;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Role-based authorization coverage for the Bank Accounts / Ledger / Statement
 * write path through the generic table gateway.
 *
 * Verifies that:
 *   - developers & super admins (hasPermission => true) may write bank tables,
 *   - a user lacking `accounting.manage` is blocked with HTTP 403,
 *   - non-guarded tables are unaffected by the bank-specific guard.
 */
class BankAccountsPermissionTest extends TestCase
{
    /** Build a request whose authenticated user grants the given permissions. */
    private function requestAs(array $grantedPermissions, bool $wildcard = false): Request
    {
        $user = new class($grantedPermissions, $wildcard) {
            public function __construct(private array $perms, private bool $wildcard) {}

            public function hasPermission(string $permission): bool
            {
                return $this->wildcard || in_array($permission, $this->perms, true);
            }
        };

        $request = Request::create('/api/db/bank_accounts', 'POST');
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function authorize(Request $request, string $table): void
    {
        $method = new ReflectionMethod(GenericTableController::class, 'authorizeWrite');
        $method->setAccessible(true);
        $method->invoke(new GenericTableController(), $request, $table);
    }

    public function test_developer_and_super_admin_may_write_bank_tables(): void
    {
        // Both roles resolve to a wildcard permission set in the User model.
        foreach (['bank_accounts', 'bank_transactions', 'accounts'] as $table) {
            $this->authorize($this->requestAs([], wildcard: true), $table);
        }
        $this->assertTrue(true, 'wildcard users passed all guarded tables');
    }

    public function test_user_with_accounting_manage_may_write(): void
    {
        $this->authorize($this->requestAs(['accounting.manage']), 'bank_accounts');
        $this->authorize($this->requestAs(['accounting.manage']), 'bank_transactions');
        $this->assertTrue(true, 'accounting.manage grants bank write access');
    }

    public function test_user_without_permission_is_blocked_on_bank_accounts(): void
    {
        $this->expectException(HttpException::class);
        $this->expectExceptionCode(403);
        $this->authorize($this->requestAs(['farmers.view']), 'bank_accounts');
    }

    public function test_user_without_permission_is_blocked_on_transactions(): void
    {
        $this->expectException(HttpException::class);
        $this->expectExceptionCode(403);
        $this->authorize($this->requestAs(['irrigation.manage']), 'bank_transactions');
    }

    public function test_non_guarded_table_is_not_blocked_by_bank_guard(): void
    {
        // A table outside WRITE_GUARD must not be gated by the accounting permission.
        $this->authorize($this->requestAs(['farmers.view']), 'farmers');
        $this->assertTrue(true, 'non-guarded tables bypass the bank write guard');
    }
}
