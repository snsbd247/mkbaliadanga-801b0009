<?php

namespace Tests\Feature;

use App\Http\Controllers\RpcController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class FarmerPermanentDeleteTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('farmers', function ($t) {
            $t->uuid('id')->primary();
            $t->string('name')->nullable();
            $t->string('farmer_code')->nullable();
            $t->uuid('office_id')->nullable();
        });

        Schema::create('loans', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('farmer_id')->nullable();
        });

        Schema::create('farmer_deletion_logs', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('farmer_id')->nullable();
            $t->string('farmer_name')->nullable();
            $t->string('farmer_code')->nullable();
            $t->uuid('office_id')->nullable();
            $t->uuid('user_id')->nullable();
            $t->string('user_name')->nullable();
            $t->string('status');
            $t->text('blocking')->nullable();
            $t->text('reason')->nullable();
            $t->timestamp('created_at')->nullable();
        });
    }

    private function call(string $method, array $params): array
    {
        $controller = new RpcController();
        $ref = new \ReflectionMethod($controller, $method);
        $ref->setAccessible(true);
        return $ref->invoke($controller, $params, Request::create('/', 'POST'));
    }

    public function test_farmer_without_transactions_is_deleted(): void
    {
        $id = (string) Str::uuid();
        DB::table('farmers')->insert(['id' => $id, 'name' => 'A', 'farmer_code' => '00001']);

        $pre = $this->call('rpc_farmer_delete_precheck', ['_farmer_id' => $id]);
        $this->assertTrue($pre['can_delete']);

        $res = $this->call('rpc_farmer_permanent_delete', ['_farmer_id' => $id]);

        $this->assertTrue($res['ok']);
        $this->assertSame(0, DB::table('farmers')->where('id', $id)->count());
        $this->assertSame(1, DB::table('farmer_deletion_logs')->where('status', 'deleted')->where('farmer_id', $id)->count());
    }

    public function test_farmer_with_transactions_is_blocked(): void
    {
        $id = (string) Str::uuid();
        DB::table('farmers')->insert(['id' => $id, 'name' => 'B', 'farmer_code' => '00002']);
        DB::table('loans')->insert(['id' => (string) Str::uuid(), 'farmer_id' => $id]);

        $pre = $this->call('rpc_farmer_delete_precheck', ['_farmer_id' => $id]);
        $this->assertFalse($pre['can_delete']);
        $this->assertSame(1, $pre['blocking']['loans']);

        $res = $this->call('rpc_farmer_permanent_delete', ['_farmer_id' => $id]);

        $this->assertFalse($res['ok']);
        $this->assertSame('has_transactions', $res['reason']);
        $this->assertSame(1, DB::table('farmers')->where('id', $id)->count());
        $this->assertSame(1, DB::table('farmer_deletion_logs')->where('status', 'blocked')->where('farmer_id', $id)->count());
    }
}
