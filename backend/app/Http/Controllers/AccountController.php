<?php

namespace App\Http\Controllers;

use App\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $scopeOffice = $request->attributes->get('scope_office_id');

        $accounts = Account::query()
            ->when($scopeOffice, fn ($q) => $q->where(function ($w) use ($scopeOffice) {
                $w->where('office_id', $scopeOffice)->orWhereNull('office_id');
            }))
            ->orderBy('code')
            ->get();

        return response()->json($accounts);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request, required: true);
        $data['office_id'] ??= $request->attributes->get('scope_office_id');

        return response()->json(Account::create($data), 201);
    }

    public function update(Request $request, Account $account): JsonResponse
    {
        $account->update($this->validateData($request, required: false));

        return response()->json($account);
    }

    private function validateData(Request $request, bool $required): array
    {
        return $request->validate([
            'code' => [$required ? 'required' : 'sometimes', 'string', 'max:32'],
            'name' => [$required ? 'required' : 'sometimes', 'string', 'max:191'],
            'name_bn' => ['nullable', 'string', 'max:191'],
            'type' => [$required ? 'required' : 'sometimes', 'in:asset,liability,equity,income,expense'],
            'parent_id' => ['nullable', 'string', 'exists:accounts,id'],
            'is_active' => ['sometimes', 'boolean'],
            'office_id' => ['nullable', 'string', 'exists:offices,id'],
        ]);
    }
}
