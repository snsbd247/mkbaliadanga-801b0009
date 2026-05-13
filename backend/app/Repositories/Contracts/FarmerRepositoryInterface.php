<?php

namespace App\Repositories\Contracts;

use App\Models\Farmer;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface FarmerRepositoryInterface {
    public function paginateForOffice(string $officeId, array $filters = [], int $perPage = 25): LengthAwarePaginator;
    public function findInOffice(string $id, string $officeId): ?Farmer;
    public function create(array $data): Farmer;
    public function update(Farmer $farmer, array $data): Farmer;
    public function delete(Farmer $farmer): bool;
}
