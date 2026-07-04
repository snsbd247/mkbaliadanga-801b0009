<?php

namespace App\Http\Controllers;

use App\Models\LegacyIrrigationRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Legacy irrigation collection history import & lookup.
 *
 * Completely isolated from the live modules — writes only to the
 * `legacy_irrigation_records` table. Rows are searched by farmer code.
 */
class LegacyIrrigationController extends Controller
{
    /** List / search records. Filter by ?farmer_code=, ?season=, ?batch=. */
    public function index(Request $request): JsonResponse
    {
        $scopeOffice = $request->attributes->get('scope_office_id');

        $q = LegacyIrrigationRecord::query()
            ->when($scopeOffice, fn ($qq) => $qq->where('office_id', $scopeOffice))
            ->when($request->query('farmer_code'), fn ($qq, $c) => $qq->where('legacy_farmer_code', trim((string) $c)))
            ->when($request->query('season'), fn ($qq, $s) => $qq->where('season_year', $s))
            ->when($request->query('batch'), fn ($qq, $b) => $qq->where('import_batch_id', $b))
            ->orderByDesc('collection_date')
            ->orderBy('receipt_no');

        return response()->json($q->limit(2000)->get());
    }

    /** Bulk import rows for one uploaded file (one batch). */
    public function import(Request $request): JsonResponse
    {
        $data = $request->validate([
            'batch_id' => ['nullable', 'uuid'],
            'skip_duplicate_receipts' => ['sometimes', 'boolean'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'total_rows' => ['nullable', 'integer', 'min:0'],
            'final' => ['sometimes', 'boolean'],
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.legacy_farmer_code' => ['nullable', 'string', 'max:64'],
            'rows.*.farmer_name' => ['nullable', 'string', 'max:255'],
            'rows.*.father_name' => ['nullable', 'string', 'max:255'],
            'rows.*.village' => ['nullable', 'string', 'max:255'],
            'rows.*.mobile_no' => ['nullable', 'string', 'max:64'],
            'rows.*.mouza_name' => ['nullable', 'string', 'max:255'],
            'rows.*.season_year' => ['nullable', 'string', 'max:64'],
            'rows.*.land_shatak' => ['nullable', 'numeric'],
            'rows.*.dag_no' => ['nullable', 'string', 'max:255'],
            'rows.*.rate' => ['nullable', 'numeric'],
            'rows.*.owner_id_name' => ['nullable', 'string', 'max:255'],
            'rows.*.due_amount' => ['nullable', 'numeric'],
            'rows.*.paid_amount' => ['nullable', 'numeric'],
            'rows.*.owner_type_name' => ['nullable', 'string', 'max:255'],
            'rows.*.owner_father_name' => ['nullable', 'string', 'max:255'],
            'rows.*.owner_village' => ['nullable', 'string', 'max:255'],
            'rows.*.owner_mobile_no' => ['nullable', 'string', 'max:64'],
            'rows.*.owner_fid' => ['nullable', 'string', 'max:64'],
            'rows.*.receipt_no' => ['nullable', 'string', 'max:64'],
            'rows.*.collection_date' => ['nullable', 'date'],
        ]);

        $officeId = $request->attributes->get('scope_office_id') ?? $request->user()->office_id;
        // Reuse a supplied batch id so chunked uploads land in one batch.
        $batchId = $data['batch_id'] ?? (string) Str::uuid();
        $skipDup = (bool) ($data['skip_duplicate_receipts'] ?? false);
        $now = now();

        $inputRows = $data['rows'];
        $skipped = [];

        if ($skipDup) {
            $receiptNos = array_values(array_filter(array_map(fn ($r) => $r['receipt_no'] ?? null, $inputRows)));
            $existing = [];
            if ($receiptNos) {
                $existing = LegacyIrrigationRecord::query()
                    ->when($officeId, fn ($qq) => $qq->where('office_id', $officeId))
                    ->whereIn('receipt_no', $receiptNos)
                    ->pluck('receipt_no')
                    ->all();
            }
            $existingSet = array_flip($existing);
            $inputRows = array_values(array_filter($inputRows, function ($r) use ($existingSet, &$skipped) {
                $rn = $r['receipt_no'] ?? null;
                if ($rn !== null && isset($existingSet[$rn])) {
                    $skipped[] = $rn;
                    return false;
                }
                return true;
            }));
        }


        $records = array_map(function (array $r) use ($officeId, $batchId, $now) {
            return [
                'id' => (string) Str::uuid(),
                'office_id' => $officeId,
                'import_batch_id' => $batchId,
                'legacy_farmer_code' => $r['legacy_farmer_code'] ?? null,
                'farmer_name' => $r['farmer_name'] ?? null,
                'father_name' => $r['father_name'] ?? null,
                'village' => $r['village'] ?? null,
                'mobile_no' => $r['mobile_no'] ?? null,
                'mouza_name' => $r['mouza_name'] ?? null,
                'season_year' => $r['season_year'] ?? null,
                'land_shatak' => $r['land_shatak'] ?? null,
                'dag_no' => $r['dag_no'] ?? null,
                'rate' => $r['rate'] ?? null,
                'owner_id_name' => $r['owner_id_name'] ?? null,
                'due_amount' => $r['due_amount'] ?? null,
                'paid_amount' => $r['paid_amount'] ?? null,
                'owner_type_name' => $r['owner_type_name'] ?? null,
                'owner_father_name' => $r['owner_father_name'] ?? null,
                'owner_village' => $r['owner_village'] ?? null,
                'owner_mobile_no' => $r['owner_mobile_no'] ?? null,
                'owner_fid' => $r['owner_fid'] ?? null,
                'receipt_no' => $r['receipt_no'] ?? null,
                'collection_date' => $r['collection_date'] ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $inputRows);

        if ($records) {
            DB::transaction(function () use ($records) {
                foreach (array_chunk($records, 500) as $chunk) {
                    DB::table('legacy_irrigation_records')->insert($chunk);
                }
            });
        }

        // ── Audit log: one row per batch, counts accumulate across chunks ──
        $user = $request->user();
        $isFinal = (bool) ($data['final'] ?? false);
        $existingAudit = DB::table('legacy_import_audit')->where('import_batch_id', $batchId)->first();
        if ($existingAudit) {
            DB::table('legacy_import_audit')->where('import_batch_id', $batchId)->update([
                'total_rows' => max((int) $existingAudit->total_rows, (int) ($data['total_rows'] ?? 0)),
                'inserted' => (int) $existingAudit->inserted + count($records),
                'skipped' => (int) $existingAudit->skipped + count($skipped),
                'status' => $isFinal ? 'completed' : 'in_progress',
                'updated_at' => $now,
            ]);
        } else {
            DB::table('legacy_import_audit')->insert([
                'id' => (string) Str::uuid(),
                'import_batch_id' => $batchId,
                'office_id' => $officeId,
                'user_id' => $user?->id,
                'user_name' => $user?->name,
                'file_name' => $data['file_name'] ?? null,
                'total_rows' => (int) ($data['total_rows'] ?? count($records)),
                'inserted' => count($records),
                'skipped' => count($skipped),
                'blocked' => 0,
                'status' => $isFinal ? 'completed' : 'in_progress',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return response()->json([
            'batch_id' => $batchId,
            'inserted' => count($records),
            'skipped' => $skipped,
            'skipped_count' => count($skipped),
        ], 201);
    }

    /** Current status of a batch (for resume + progress display). */
    public function batchStatus(Request $request, string $batchId): JsonResponse
    {
        $scopeOffice = $request->attributes->get('scope_office_id');

        $audit = DB::table('legacy_import_audit')
            ->when($scopeOffice, fn ($qq) => $qq->where('office_id', $scopeOffice))
            ->where('import_batch_id', $batchId)
            ->first();

        $recordCount = LegacyIrrigationRecord::query()
            ->when($scopeOffice, fn ($qq) => $qq->where('office_id', $scopeOffice))
            ->where('import_batch_id', $batchId)
            ->count();

        return response()->json([
            'exists' => $audit !== null || $recordCount > 0,
            'audit' => $audit,
            'record_count' => $recordCount,
        ]);
    }


    /** List import batches with counts (for review / rollback). */
    public function batches(Request $request): JsonResponse
    {
        $scopeOffice = $request->attributes->get('scope_office_id');

        $rows = LegacyIrrigationRecord::query()
            ->when($scopeOffice, fn ($qq) => $qq->where('office_id', $scopeOffice))
            ->select('import_batch_id')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('MIN(created_at) as created_at')
            ->groupBy('import_batch_id')
            ->orderByDesc('created_at')
            ->get();

        $audits = DB::table('legacy_import_audit')
            ->when($scopeOffice, fn ($qq) => $qq->where('office_id', $scopeOffice))
            ->get()
            ->keyBy('import_batch_id');

        $rows = $rows->map(function ($r) use ($audits) {
            $a = $audits->get($r->import_batch_id);
            $r->file_name = $a->file_name ?? null;
            $r->user_name = $a->user_name ?? null;
            $r->total_rows = $a->total_rows ?? null;
            $r->skipped = $a->skipped ?? null;
            $r->blocked = $a->blocked ?? null;
            $r->status = $a->status ?? null;
            return $r;
        });

        return response()->json($rows);
    }

    /** Delete a whole import batch (rollback a bad import). */
    public function destroyBatch(Request $request, string $batchId): JsonResponse
    {
        $scopeOffice = $request->attributes->get('scope_office_id');

        $deleted = LegacyIrrigationRecord::query()
            ->when($scopeOffice, fn ($qq) => $qq->where('office_id', $scopeOffice))
            ->where('import_batch_id', $batchId)
            ->delete();

        DB::table('legacy_import_audit')
            ->when($scopeOffice, fn ($qq) => $qq->where('office_id', $scopeOffice))
            ->where('import_batch_id', $batchId)
            ->delete();

        return response()->json(['deleted' => $deleted]);
    }
}
