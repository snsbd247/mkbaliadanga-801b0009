<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class IrrigationInvoice extends Model
{
    use HasUuids, SoftDeletes;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = ['id'];
    protected $casts = [
        'amount' => 'decimal:2', 'maintenance' => 'decimal:2', 'canal' => 'decimal:2',
        'delay_fee' => 'decimal:2', 'paid' => 'decimal:2', 'due' => 'decimal:2',
        'extra' => 'array',
    ];

    public function farmer() { return $this->belongsTo(Farmer::class); }
    public function payments() { return $this->hasMany(IrrigationInvoicePayment::class, 'invoice_id'); }
}
