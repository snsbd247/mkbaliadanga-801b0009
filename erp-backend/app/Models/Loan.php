<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Loan extends Model
{
    use HasUuids, SoftDeletes;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = ['id'];
    protected $casts = [
        'principal' => 'decimal:2', 'interest_rate' => 'decimal:2',
        'paid' => 'decimal:2', 'outstanding' => 'decimal:2',
        'disbursed_at' => 'date', 'extra' => 'array',
    ];

    public function farmer() { return $this->belongsTo(Farmer::class); }
    public function payments() { return $this->hasMany(LoanPayment::class); }
}
