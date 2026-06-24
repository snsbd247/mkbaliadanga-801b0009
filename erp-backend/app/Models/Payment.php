<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = ['id'];
    protected $casts = ['amount' => 'decimal:2', 'paid_at' => 'date', 'is_void' => 'boolean', 'breakdown' => 'array'];

    public function farmer() { return $this->belongsTo(Farmer::class); }
    public function receipt() { return $this->hasOne(Receipt::class); }
}
