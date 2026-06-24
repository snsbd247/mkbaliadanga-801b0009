<?php

namespace App\Http\Controllers;

use App\Models\Season;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SeasonController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Season::query()->orderByDesc('year')->orderBy('name')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request, required: true);

        return response()->json(Season::create($data), 201);
    }

    public function update(Request $request, Season $season): JsonResponse
    {
        $season->update($this->validateData($request, required: false));

        return response()->json($season);
    }

    /** Mark this season active and deactivate the rest. */
    public function activate(Season $season): JsonResponse
    {
        DB::transaction(function () use ($season) {
            Season::query()->where('id', '!=', $season->id)->update(['is_active' => false]);
            $season->update(['is_active' => true]);
        });

        return response()->json($season);
    }

    private function validateData(Request $request, bool $required): array
    {
        return $request->validate([
            'name' => [$required ? 'required' : 'sometimes', 'string', 'max:128'],
            'year' => ['nullable', 'integer'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
