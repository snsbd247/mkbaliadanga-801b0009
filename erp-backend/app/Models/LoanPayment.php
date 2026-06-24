<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LoanPayment extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = ['id'];
    protected $casts = [
        'principal_part' => 'decimal:2', 'interest_part' => 'decimal:2',
        'amount' => 'decimal:2', 'is_void' => 'boolean', 'extra' => 'array',
    ];

    public function loan() { return $this->belongsTo(Loan::class); }
}
