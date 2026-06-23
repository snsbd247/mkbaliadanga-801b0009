<?php

namespace App\Http\Controllers;

use App\Models\Land;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class LandController extends Controller
{
    // Each dag token: digits/letters (incl. Bangla digits), '/' and '-' only, max 32 chars.
    private const DAG_TOKEN_PATTERN = '/^[A-Za-z0-9০-৯\x{09E6}-\x{09EF}\/\-]{1,32}$/u';

    public function index(Request $r) {
        return Land::where('office_id', app('current_office_id'))
            ->when($r->farmer_id, fn($q,$v) => $q->where('farmer_id',$v))
            ->orderBy('created_at','desc')->paginate((int)($r->per_page ?? 50));
    }

    public function store(Request $r) {
        $d = $r->validate([
            'farmer_id'    => 'required|uuid|exists:farmers,id',
            'dag_no'       => 'nullable|string|max:255',
            'khatian_no'   => 'nullable|string|max:64',
            'area_decimal' => 'required|numeric|min:0.01',
            'village_id'   => 'nullable|uuid',
            'crop'         => 'nullable|string',
        ]);
        $d['office_id'] = app('current_office_id');
        if (!empty($d['dag_no'])) {
            $d['dag_no'] = $this->validateAndNormalizeDag($d['dag_no'], $d['village_id'] ?? null);
        }
        return response()->json(Land::create($d), 201);
    }

    public function update(Request $r, string $id) {
        $l = Land::where('office_id', app('current_office_id'))->findOrFail($id);
        $data = $r->only('dag_no','khatian_no','area_decimal','village_id','crop','meta');
        if (array_key_exists('dag_no', $data) && !empty($data['dag_no'])) {
            $mouzaId = $data['village_id'] ?? $l->village_id;
            $data['dag_no'] = $this->validateAndNormalizeDag($data['dag_no'], $mouzaId, $l->id);
        }
        $l->update($data);
        return $l;
    }

    public function destroy(string $id) {
        Land::where('office_id', app('current_office_id'))->findOrFail($id)->delete();
        return response()->noContent();
    }

    /**
     * Validate dag format + range and ensure no duplicate dag within the same Mouza.
     * Returns the canonical "a, b, c" string. Throws ValidationException on error.
     */
    private function validateAndNormalizeDag(string $raw, ?string $mouzaId, ?string $excludeLandId = null): string {
        // Normalize: newlines/tabs/semicolons -> commas, collapse whitespace, drop empties.
        $unified = preg_replace('/[\n\r\t;]+/u', ',', $raw);
        $tokens = array_values(array_filter(array_map(
            fn($t) => trim(preg_replace('/\s+/u', ' ', $t)),
            explode(',', $unified)
        ), fn($t) => $t !== ''));

        if (count($tokens) === 0) {
            throw ValidationException::withMessages(['dag_no' => 'দাগ নাম্বার আবশ্যক']);
        }

        $seen = [];
        foreach ($tokens as $t) {
            if (!preg_match(self::DAG_TOKEN_PATTERN, $t)) {
                throw ValidationException::withMessages([
                    'dag_no' => "\"$t\" — শুধু সংখ্যা, অক্ষর, ' / ' এবং ' - ' ব্যবহার করা যাবে (সর্বোচ্চ ৩২ অক্ষর)",
                ]);
            }
            $key = mb_strtolower($t);
            if (isset($seen[$key])) {
                throw ValidationException::withMessages(['dag_no' => "ডুপ্লিকেট দাগ নাম্বার: \"$t\""]);
            }
            $seen[$key] = true;
        }

        // Duplicate-per-Mouza check against other lands in the same village/mouza.
        if ($mouzaId) {
            $existing = Land::where('office_id', app('current_office_id'))
                ->where('village_id', $mouzaId)
                ->when($excludeLandId, fn($q,$v) => $q->where('id','!=',$v))
                ->whereNotNull('dag_no')
                ->pluck('dag_no');
            $taken = [];
            foreach ($existing as $s) {
                foreach (preg_split('/[,\n\r\t;]+/u', (string)$s) as $part) {
                    $p = trim($part);
                    if ($p !== '') $taken[mb_strtolower($p)] = $p;
                }
            }
            foreach ($tokens as $t) {
                if (isset($taken[mb_strtolower($t)])) {
                    throw ValidationException::withMessages([
                        'dag_no' => "এই মৌজায় দাগ নাম্বার \"$t\" আগে থেকেই আছে",
                    ]);
                }
            }
        }

        return implode(', ', $tokens);
    }
}
