<?php

namespace Tests\Feature;

use App\Http\Controllers\RpcController;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * Validates the RPC contract endpoint: it must report available RPCs and
 * flag missing required RPCs with a clear 409 error.
 */
class RpcContractTest extends TestCase
{
    public function test_contract_reports_available_and_required_rpcs(): void
    {
        $controller = new RpcController();
        $response = $controller->contract(Request::create('/api/rpc/_contract', 'GET'));

        $this->assertSame(200, $response->getStatusCode());
        $body = $response->getData(true);

        $this->assertTrue($body['ok']);
        $this->assertEmpty($body['missing']);
        $this->assertContains('get_land_billing_split', $body['available']);
        $this->assertContains('get_billed_farmer_for_land', $body['available']);
        $this->assertContains('log_rpc_fallback', $body['available']);

        // Every required RPC must actually be implemented.
        foreach ($body['required'] as $rpc) {
            $this->assertContains($rpc, $body['available'], "Required RPC {$rpc} is missing");
        }
    }
}
