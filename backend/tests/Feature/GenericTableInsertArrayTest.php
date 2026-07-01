<?php

namespace Tests\Feature;

use App\Http\Controllers\GenericTableController;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Ensures array fields (e.g. dag_numbers on lands) are always JSON-encoded
 * before they reach the MySQL insert, preventing the "Array to string
 * conversion" PDO error seen during land import.
 */
class GenericTableInsertArrayTest extends TestCase
{
    private function normalize(string $table, array $row): array
    {
        $method = new ReflectionMethod(GenericTableController::class, 'normalizeWriteRow');
        $method->setAccessible(true);
        return $method->invoke(new GenericTableController(), $table, $row);
    }

    public function test_array_field_is_json_encoded(): void
    {
        $out = $this->normalize('lands', [
            'dag_no' => '12',
            'dag_numbers' => ['12', '15', '30'],
        ]);

        $this->assertIsString($out['dag_numbers']);
        $this->assertSame('["12","15","30"]', $out['dag_numbers']);
    }

    public function test_empty_array_is_json_encoded(): void
    {
        $out = $this->normalize('lands', ['dag_numbers' => []]);
        $this->assertSame('[]', $out['dag_numbers']);
    }

    public function test_unicode_array_values_are_preserved(): void
    {
        $out = $this->normalize('lands', ['dag_numbers' => ['১২', '১৫']]);
        $this->assertIsString($out['dag_numbers']);
        $this->assertStringContainsString('১২', $out['dag_numbers']);
    }

    public function test_scalar_fields_are_untouched(): void
    {
        $out = $this->normalize('lands', ['land_size' => '33.0000', 'dag_no' => '12']);
        $this->assertSame('33.0000', $out['land_size']);
        $this->assertSame('12', $out['dag_no']);
    }
}
