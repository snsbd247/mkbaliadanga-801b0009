<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SavingsTransaction extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = ['id'];
    protected $casts = ['amount' => 'decimal:2', 'txn_date' => 'date', 'is_void' => 'boolean', 'extra' => 'array'];

    public function farmer() { return $this->belongsTo(Farmer::class); }
}
