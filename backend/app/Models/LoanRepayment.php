<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoanRepayment extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'loan_id', 'amount', 'principal_part', 'interest_part',
        'outstanding_after', 'paid_at', 'note', 'created_by',
    ];

    protected $casts = [
        'amount' => 'float',
        'principal_part' => 'float',
        'interest_part' => 'float',
        'outstanding_after' => 'float',
        'paid_at' => 'datetime',
    ];

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }
}
