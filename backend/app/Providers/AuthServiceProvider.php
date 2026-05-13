<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\AuthServiceProvider as BaseProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends BaseProvider {
    protected $policies = [
        \App\Models\Farmer::class            => \App\Policies\FarmerPolicy::class,
        \App\Models\Loan::class              => \App\Policies\LoanPolicy::class,
        \App\Models\Payment::class           => \App\Policies\PaymentPolicy::class,
        \App\Models\IrrigationInvoice::class => \App\Policies\IrrigationPolicy::class,
    ];
    public function boot(): void {
        $this->registerPolicies();
        Gate::before(function ($user, $ability) {
            return $user->hasRole('super_admin') ? true : null;
        });
    }
}
