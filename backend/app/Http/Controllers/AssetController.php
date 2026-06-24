<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $scopeOffice = $request->attributes->get('scope_office_id');

        $assets = Asset::query()
            ->when($scopeOffice, fn ($q) => $q->where('office_id', $scopeOffice))
            ->when($request->query('q'), function ($q, $term) {
                $q->where(function ($w) use ($term) {
                    $w->where('name', 'like', "%{$term}%")
                        ->orWhere('serial_no', 'like', "%{$term}%")
                        ->orWhere('category', 'like', "%{$term}%");
                });
            })
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json($assets);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request, required: true);
        $data['office_id'] ??= $request->attributes->get('scope_office_id');

        $asset = Asset::create($data);

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $asset->office_id,
            'action' => 'asset.create',
            'entity_type' => 'asset',
            'entity_id' => $asset->id,
        ]);

        return response()->json($asset, 201);
    }

    public function update(Request $request, Asset $asset): JsonResponse
    {
        $asset->update($this->validateData($request, required: false));

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $asset->office_id,
            'action' => 'asset.update',
            'entity_type' => 'asset',
            'entity_id' => $asset->id,
        ]);

        return response()->json($asset);
    }

    private function validateData(Request $request, bool $required): array
    {
        return $request->validate([
            'name' => [$required ? 'required' : 'sometimes', 'string', 'max:191'],
            'category' => ['nullable', 'string', 'max:128'],
            'serial_no' => ['nullable', 'string', 'max:128'],
            'purchase_date' => ['nullable', 'date'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', 'max:64'],
            'office_id' => ['nullable', 'string', 'exists:offices,id'],
        ]);
    }
}
