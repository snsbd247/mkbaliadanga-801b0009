<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Land;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LandController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $scopeOffice = $request->attributes->get('scope_office_id');

        $lands = Land::query()
            ->when($scopeOffice, fn ($q) => $q->where('office_id', $scopeOffice))
            ->when($request->query('farmer_id'), fn ($q, $fid) => $q->where('farmer_id', $fid))
            ->when($request->query('q'), function ($q, $term) {
                $q->where(function ($w) use ($term) {
                    $w->where('khatian_no', 'like', "%{$term}%")
                        ->orWhere('dag_no', 'like', "%{$term}%")
                        ->orWhere('mouza', 'like', "%{$term}%");
                });
            })
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json($lands);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request, required: true);
        $data['office_id'] ??= $request->attributes->get('scope_office_id');

        $land = Land::create($data);

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $land->office_id,
            'action' => 'land.create',
            'entity_type' => 'land',
            'entity_id' => $land->id,
        ]);

        return response()->json($land, 201);
    }

    public function update(Request $request, Land $land): JsonResponse
    {
        $land->update($this->validateData($request, required: false));

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $land->office_id,
            'action' => 'land.update',
            'entity_type' => 'land',
            'entity_id' => $land->id,
        ]);

        return response()->json($land);
    }

    public function destroy(Request $request, Land $land): JsonResponse
    {
        $id = $land->id;
        $office = $land->office_id;
        $land->delete();

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $office,
            'action' => 'land.delete',
            'entity_type' => 'land',
            'entity_id' => $id,
        ]);

        return response()->json(['message' => 'মুছে ফেলা হয়েছে।']);
    }

    private function validateData(Request $request, bool $required): array
    {
        return $request->validate([
            'farmer_id' => [$required ? 'required' : 'sometimes', 'string', 'exists:farmers,id'],
            'office_id' => ['nullable', 'string', 'exists:offices,id'],
            'land_type_id' => ['nullable', 'string', 'exists:land_types,id'],
            'khatian_no' => ['nullable', 'string', 'max:64'],
            'dag_no' => ['nullable', 'string', 'max:64'],
            'area_decimal' => ['nullable', 'numeric'],
            'mouza' => ['nullable', 'string', 'max:128'],
            'notes' => ['nullable', 'string'],
        ]);
    }
}
