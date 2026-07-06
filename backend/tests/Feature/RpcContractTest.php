<?php

namespace Tests\Feature;

use App\Http\Controllers\RpcController;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * Validates the RPC contract endpoint / evaluator: it must report available
 * RPCs and flag missing required RPCs with a clear 409 status, across several
 * missing-RPC combinations (including get_land_billing_split).
 */
class RpcContractTest extends TestCase
{
    public function test_live_contract_reports_all_required_rpcs_available(): void
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

        foreach ($body['required'] as $rpc) {
            $this->assertContains($rpc, $body['available'], "Required RPC {$rpc} is missing");
        }
    }

    /**
     * @dataProvider missingCombinations
     */
    public function test_evaluate_contract_flags_missing_required_rpcs(array $required, array $expectedMissing, bool $expectOk): void
    {
        $controller = new RpcController();
        $result = $controller->evaluateContract($required);

        $this->assertSame($expectOk, $result['ok']);
        $this->assertEqualsCanonicalizing($expectedMissing, $result['missing']);
        // Available list is always the real implemented set.
        $this->assertContains('generate_invoice_no', $result['available']);
    }

    public static function missingCombinations(): array
    {
        return [
            'all present' => [
                ['get_land_billing_split', 'get_billed_farmer_for_land'],
                [],
                true,
            ],
            'billing split missing' => [
                ['get_land_billing_split', '__does_not_exist_split'],
                ['__does_not_exist_split'],
                false,
            ],
            'multiple missing' => [
                ['__missing_a', '__missing_b', 'generate_invoice_no'],
                ['__missing_a', '__missing_b'],
                false,
            ],
            'single missing billed farmer variant' => [
                ['get_billed_farmer_for_land', '__missing_billed'],
                ['__missing_billed'],
                false,
            ],
        ];
    }

    public function test_contract_endpoint_returns_409_when_required_rpc_missing(): void
    {
        // A controller whose required list includes a non-existent RPC.
        $controller = new class extends RpcController {
            private const REQUIRED_RPCS = ['get_land_billing_split', '__missing_required_rpc'];
            public function contract(Request $request): \Illuminate\Http\JsonResponse
            {
                $result = $this->evaluateContract(self::REQUIRED_RPCS);
                return response()->json($result, $result['ok'] ? 200 : 409);
            }
        };

        $response = $controller->contract(Request::create('/api/rpc/_contract', 'GET'));
        $this->assertSame(409, $response->getStatusCode());
        $body = $response->getData(true);
        $this->assertFalse($body['ok']);
        $this->assertContains('__missing_required_rpc', $body['missing']);
        $this->assertStringContainsString('Missing required RPCs', $body['message']);
    }
}
