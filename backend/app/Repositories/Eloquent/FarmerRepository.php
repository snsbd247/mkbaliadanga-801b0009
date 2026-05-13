<?php

namespace App\Repositories\Eloquent;

use App\Models\Farmer;
use App\Repositories\Contracts\FarmerRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class FarmerRepository implements FarmerRepositoryInterface {
    public function paginateForOffice(string $officeId, array $filters = [], int $perPage = 25): LengthAwarePaginator {
        return Farmer::query()
            ->where('office_id', $officeId)
            ->when($filters['q'] ?? null, fn($q,$v) => $q->where(function($w) use ($v) {
                $w->where('name','ilike',"%$v%")
                  ->orWhere('name_bn','ilike',"%$v%")
                  ->orWhere('mobile','ilike',"%$v%")
                  ->orWhere('code','ilike',"%$v%");
            }))
            ->when(array_key_exists('is_active',$filters), fn($q) => $q->where('is_active', (bool)$filters['is_active']))
            ->when($filters['village_id'] ?? null, fn($q,$v) => $q->where('village_id', $v))
            ->orderBy($filters['sort'] ?? 'created_at', $filters['dir'] ?? 'desc')
            ->paginate($perPage);
    }
    public function findInOffice(string $id, string $officeId): ?Farmer {
        return Farmer::where('office_id', $officeId)->find($id);
    }
    public function create(array $data): Farmer { return Farmer::create($data); }
    public function update(Farmer $farmer, array $data): Farmer { $farmer->update($data); return $farmer->refresh(); }
    public function delete(Farmer $farmer): bool { return (bool)$farmer->delete(); }
}
