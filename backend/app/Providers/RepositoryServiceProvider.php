<?php

namespace App\Providers;

use App\Repositories\Contracts\FarmerRepositoryInterface;
use App\Repositories\Eloquent\FarmerRepository;
use Illuminate\Support\ServiceProvider;

class RepositoryServiceProvider extends ServiceProvider {
    public array $bindings = [
        FarmerRepositoryInterface::class => FarmerRepository::class,
    ];
}
