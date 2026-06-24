<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Farmer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FarmerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $scopeOffice = $request->attributes->get('scope_office_id');

        $farmers = Farmer::query()
            ->when($scopeOffice, fn ($q) => $q->where('office_id', $scopeOffice))
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->query('village'), fn ($q, $v) => $q->where('village', $v))
            ->when($request->query('q'), function ($q, $term) {
                $q->where(function ($w) use ($term) {
                    $w->where('name', 'like', "%{$term}%")
                        ->orWhere('code', 'like', "%{$term}%")
                        ->orWhere('phone', 'like', "%{$term}%")
                        ->orWhere('nid', 'like', "%{$term}%");
                });
            })
            ->orderBy('name')
            ->paginate($perPage);

        return response()->json($farmers);
    }

    public function show(Farmer $farmer): JsonResponse
    {
        return response()->json($farmer->load('lands'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);

        $data['office_id'] ??= $request->attributes->get('scope_office_id');
        $farmer = Farmer::create($data);

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $farmer->office_id,
            'action' => 'farmer.create',
            'entity_type' => 'farmer',
            'entity_id' => $farmer->id,
        ]);

        return response()->json($farmer, 201);
    }

    public function update(Request $request, Farmer $farmer): JsonResponse
    {
        $farmer->update($this->validateData($request, $farmer->id));

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $farmer->office_id,
            'action' => 'farmer.update',
            'entity_type' => 'farmer',
            'entity_id' => $farmer->id,
        ]);

        return response()->json($farmer);
    }

    public function destroy(Request $request, Farmer $farmer): JsonResponse
    {
        $id = $farmer->id;
        $office = $farmer->office_id;
        $farmer->delete();

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $office,
            'action' => 'farmer.delete',
            'entity_type' => 'farmer',
            'entity_id' => $id,
        ]);

        return response()->json(['message' => 'মুছে ফেলা হয়েছে।']);
    }

    private function validateData(Request $request, ?string $ignoreId = null): array
    {
        return $request->validate([
            'office_id' => ['nullable', 'string', 'exists:offices,id'],
            'code' => [
                'nullable', 'string', 'max:64',
                Rule::unique('farmers', 'code')->ignore($ignoreId),
            ],
            'name' => [$ignoreId ? 'sometimes' : 'required', 'string', 'max:191'],
            'father_name' => ['nullable', 'string', 'max:191'],
            'mother_name' => ['nullable', 'string', 'max:191'],
            'phone' => ['nullable', 'string', 'max:32'],
            'nid' => ['nullable', 'string', 'max:64'],
            'address' => ['nullable', 'string', 'max:255'],
            'village' => ['nullable', 'string', 'max:128'],
            'union' => ['nullable', 'string', 'max:128'],
            'upazila' => ['nullable', 'string', 'max:128'],
            'district' => ['nullable', 'string', 'max:128'],
            'status' => ['sometimes', 'string', 'max:32'],
        ]);
    }
}
