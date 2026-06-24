<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Loan extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'farmer_id', 'loan_plan_id', 'office_id', 'loan_no', 'principal',
        'interest_rate', 'tenure_months', 'outstanding', 'status', 'disbursed_at', 'extra',
    ];

    protected $casts = [
        'principal' => 'float',
        'interest_rate' => 'float',
        'tenure_months' => 'integer',
        'outstanding' => 'float',
        'disbursed_at' => 'datetime',
        'extra' => 'array',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(LoanPlan::class, 'loan_plan_id');
    }

    public function repayments(): HasMany
    {
        return $this->hasMany(LoanRepayment::class)->orderByDesc('paid_at');
    }
}
