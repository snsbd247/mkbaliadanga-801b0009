<?php

namespace Tests\Feature;

use App\Http\Controllers\FunctionController;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use ReflectionMethod;
use Tests\TestCase;

class AdminUsersFunctionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('offices', function ($table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('users', function ($table) {
            $table->uuid('id')->primary();
            $table->string('username')->unique();
            $table->string('name')->nullable();
            $table->string('email')->nullable()->unique();
            $table->string('phone')->nullable();
            $table->string('password');
            $table->uuid('office_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('roles', function ($table) {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::create('user_roles', function ($table) {
            $table->uuid('user_id');
            $table->uuid('role_id');
            $table->timestamps();
            $table->primary(['user_id', 'role_id']);
        });

        Schema::create('profiles', function ($table) {
            $table->uuid('id')->primary();
            $table->string('full_name')->nullable();
            $table->string('email')->nullable();
            $table->uuid('office_id')->nullable();
            $table->string('language_pref')->nullable();
            $table->string('username')->nullable();
            $table->boolean('is_active')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('action');
            $table->string('entity_type')->nullable();
            $table->uuid('entity_id')->nullable();
            $table->uuid('office_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('personal_access_tokens', function ($table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    private function role(string $name): Role
    {
        return Role::query()->firstOrCreate(
            ['name' => $name],
            ['id' => (string) Str::uuid(), 'description' => $name],
        );
    }

    private function userWithRole(string $username, string $role, ?string $officeId = null): User
    {
        $user = User::create([
            'id' => (string) Str::uuid(),
            'username' => $username,
            'name' => ucfirst($username),
            'email' => $username.'@example.test',
            'password' => Hash::make('password123'),
            'office_id' => $officeId,
            'is_active' => true,
        ]);
        $user->roles()->sync([$this->role($role)->id]);
        return $user->refresh();
    }

    private function call(User $actor, array $payload, ?string $scopeOfficeId = null): array
    {
        $request = Request::create('/api/fn/admin-users', 'POST', [], [], [], [], json_encode($payload));
        $request->headers->set('Content-Type', 'application/json');
        $request->setUserResolver(fn () => $actor);
        $request->attributes->set('scope_office_id', $scopeOfficeId);
        $request->attributes->set('is_super_admin', true);

        $method = new ReflectionMethod(FunctionController::class, 'fn_admin_users');
        $method->setAccessible(true);
        $response = $method->invoke(new FunctionController(), $request);

        return [
            'status' => $response->getStatusCode(),
            'json' => json_decode($response->getContent(), true),
        ];
    }

    public function test_developer_can_create_staff_user_and_profile_role_are_synced(): void
    {
        $officeId = (string) Str::uuid();
        DB::table('offices')->insert(['id' => $officeId, 'name' => 'প্রধান কার্যালয়']);
        $developer = $this->userWithRole('dev', 'developer');

        $res = $this->call($developer, [
            'action' => 'create',
            'username' => 'rahmot123',
            'email' => 'rahmot123@example.test',
            'password' => '123456789',
            'full_name' => 'Rahmot Ali',
            'role' => 'staff',
            'office_id' => $officeId,
        ]);

        $this->assertSame(201, $res['status']);
        $this->assertTrue($res['json']['ok']);
        $userId = $res['json']['user_id'];

        $created = User::query()->findOrFail($userId);
        $this->assertSame(['staff'], $created->roleNames());
        $this->assertTrue(Hash::check('123456789', $created->password));
        $this->assertDatabaseHas('profiles', [
            'id' => $userId,
            'username' => 'rahmot123',
            'full_name' => 'Rahmot Ali',
            'office_id' => $officeId,
        ]);
    }

    public function test_developer_can_list_edit_reset_role_and_delete_users(): void
    {
        $officeId = (string) Str::uuid();
        DB::table('offices')->insert(['id' => $officeId, 'name' => 'প্রধান কার্যালয়']);
        $developer = $this->userWithRole('dev', 'developer');
        $target = $this->userWithRole('target', 'staff', $officeId);

        $list = $this->call($developer, ['action' => 'list']);
        $this->assertSame(200, $list['status']);
        $this->assertContains($target->id, array_column($list['json']['users'], 'id'));

        $edit = $this->call($developer, [
            'action' => 'update_profile',
            'user_id' => $target->id,
            'username' => 'target2',
            'email' => 'target2@example.test',
            'full_name' => 'Target Two',
            'office_id' => $officeId,
        ]);
        $this->assertSame(200, $edit['status']);
        $this->assertSame('target2', $target->refresh()->username);

        $role = $this->call($developer, ['action' => 'set_role', 'user_id' => $target->id, 'role' => 'admin']);
        $this->assertSame(200, $role['status']);
        $this->assertSame(['admin'], $target->refresh()->roleNames());

        $reset = $this->call($developer, ['action' => 'reset_password', 'user_id' => $target->id, 'password' => 'newpass123']);
        $this->assertSame(200, $reset['status']);
        $this->assertTrue(Hash::check('newpass123', $target->refresh()->password));

        $delete = $this->call($developer, ['action' => 'delete', 'user_id' => $target->id]);
        $this->assertSame(200, $delete['status']);
        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }

    public function test_non_developer_non_super_is_forbidden_from_all_admin_actions(): void
    {
        $officeId = (string) Str::uuid();
        DB::table('offices')->insert(['id' => $officeId, 'name' => 'শাখা কার্যালয়']);
        $staff = $this->userWithRole('staffuser', 'staff', $officeId);

        foreach (['list', 'delete', 'reset_password', 'set_role', 'update_profile', 'create'] as $action) {
            $res = $this->call($staff, ['action' => $action, 'user_id' => $staff->id]);
            $this->assertSame(403, $res['status'], "Action {$action} should be forbidden for staff");
        }
    }

    public function test_developer_list_bypasses_office_scope_and_returns_all_users(): void
    {
        $officeA = (string) Str::uuid();
        $officeB = (string) Str::uuid();
        DB::table('offices')->insert([
            ['id' => $officeA, 'name' => 'কার্যালয় ক'],
            ['id' => $officeB, 'name' => 'কার্যালয় খ'],
        ]);
        $developer = $this->userWithRole('dev', 'developer');
        $userA = $this->userWithRole('usera', 'staff', $officeA);
        $userB = $this->userWithRole('userb', 'staff', $officeB);

        // Even with a restrictive office scope, a developer must see every user.
        $list = $this->call($developer, ['action' => 'list'], $officeA);
        $this->assertSame(200, $list['status']);
        $ids = array_column($list['json']['users'], 'id');
        $this->assertContains($userA->id, $ids);
        $this->assertContains($userB->id, $ids);
    }
}