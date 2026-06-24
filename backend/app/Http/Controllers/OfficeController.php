<?php

namespace App\Http\Controllers;

use App\Models\Office;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OfficeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Office::query()->orderBy('name')->get(['id', 'name', 'code', 'address', 'is_active'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'code' => ['nullable', 'string', 'max:32', 'unique:offices,code'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        return response()->json(Office::create($data), 201);
    }

    public function update(Request $request, Office $office): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'code' => ['nullable', 'string', 'max:32', Rule::unique('offices', 'code')->ignore($office->id)],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $office->update($data);

        return response()->json($office);
    }
}
