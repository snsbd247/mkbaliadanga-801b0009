<?php

namespace Tests\Feature;

use App\Http\Controllers\RpcController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class IrrigationBillingRpcTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('land_relations');
        Schema::dropIfExists('lands');

        Schema::create('lands', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('farmer_id')->nullable();
            $table->uuid('owner_farmer_id')->nullable();
            $table->decimal('land_size', 20, 4)->nullable();
            $table->decimal('area_decimal', 20, 4)->nullable();
        });

        Schema::create('land_relations', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('land_id');
            $table->uuid('owner_farmer_id')->nullable();
            $table->uuid('sharecropper_farmer_id')->nullable();
            $table->decimal('share_percentage', 20, 4)->nullable();
            $table->decimal('area_decimal', 20, 4)->nullable();
            $table->date('valid_from')->nullable();
            $table->date('valid_to')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
    }

    private function rpc(string $name, array $params): array
    {
        $controller = new RpcController();
        $response = $controller->handle(Request::create('/api/rpc/'.$name, 'POST', $params), $name);

        $this->assertSame(200, $response->getStatusCode());
        return json_decode($response->getContent(), true)['result'];
    }

    public function test_vps_rpc_get_land_billing_split_splits_borga_and_owner_remainder(): void
    {
        $owner = (string) Str::uuid();
        $sharecropper = (string) Str::uuid();
        $land = (string) Str::uuid();

        DB::table('lands')->insert([
            'id' => $land,
            'farmer_id' => $owner,
            'owner_farmer_id' => $owner,
            'land_size' => 100,
        ]);
        DB::table('land_relations')->insert([
            'id' => (string) Str::uuid(),
            'land_id' => $land,
            'owner_farmer_id' => $owner,
            'sharecropper_farmer_id' => $sharecropper,
            'area_decimal' => 40,
            'valid_from' => '2026-01-01',
        ]);

        $rows = $this->rpc('get_land_billing_split', ['_land_id' => $land, '_as_of' => '2026-07-06']);

        $this->assertCount(2, $rows);
        $this->assertSame($sharecropper, $rows[0]['farmer_id']);
        $this->assertTrue($rows[0]['is_borga']);
        $this->assertEquals(40.0, $rows[0]['billed_area']);
        $this->assertSame($owner, $rows[1]['farmer_id']);
        $this->assertFalse($rows[1]['is_borga']);
        $this->assertEquals(60.0, $rows[1]['billed_area']);
    }

    public function test_vps_rpc_get_billed_farmer_for_land_prefers_active_sharecropper(): void
    {
        $owner = (string) Str::uuid();
        $sharecropper = (string) Str::uuid();
        $land = (string) Str::uuid();

        DB::table('lands')->insert(['id' => $land, 'farmer_id' => $owner, 'owner_farmer_id' => $owner, 'land_size' => 50]);
        DB::table('land_relations')->insert([
            'id' => (string) Str::uuid(),
            'land_id' => $land,
            'owner_farmer_id' => $owner,
            'sharecropper_farmer_id' => $sharecropper,
            'share_percentage' => 100,
            'valid_from' => '2026-01-01',
        ]);

        $row = $this->rpc('get_billed_farmer_for_land', ['_land_id' => $land, '_as_of' => '2026-07-06']);

        $this->assertSame($sharecropper, $row['farmer_id']);
        $this->assertSame($owner, $row['owner_farmer_id']);
        $this->assertTrue($row['is_borga']);
    }

    public function test_vps_rpc_get_billed_farmer_for_land_falls_back_to_owner_when_no_active_borga(): void
    {
        $owner = (string) Str::uuid();
        $land = (string) Str::uuid();

        DB::table('lands')->insert(['id' => $land, 'farmer_id' => $owner, 'owner_farmer_id' => null, 'land_size' => 25]);

        $row = $this->rpc('get_billed_farmer_for_land', ['_land_id' => $land, '_as_of' => '2026-07-06']);

        $this->assertSame($owner, $row['farmer_id']);
        $this->assertSame($owner, $row['owner_farmer_id']);
        $this->assertFalse($row['is_borga']);
    }
}