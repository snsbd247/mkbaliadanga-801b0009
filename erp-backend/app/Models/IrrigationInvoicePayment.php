<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class IrrigationInvoicePayment extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = ['id'];
    protected $casts = ['amount' => 'decimal:2', 'delay_fee' => 'decimal:2', 'is_void' => 'boolean', 'extra' => 'array'];

    public function invoice() { return $this->belongsTo(IrrigationInvoice::class, 'invoice_id'); }
}
