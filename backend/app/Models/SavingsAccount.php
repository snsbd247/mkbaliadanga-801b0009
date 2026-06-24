<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SavingsAccount extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'farmer_id', 'office_id', 'account_no', 'balance', 'status', 'opened_at', 'extra',
    ];

    protected $casts = [
        'balance' => 'float',
        'opened_at' => 'datetime',
        'extra' => 'array',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(SavingsTransaction::class, 'account_id')->orderByDesc('occurred_at');
    }
}
