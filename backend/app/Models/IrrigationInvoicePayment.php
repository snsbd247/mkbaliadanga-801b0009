<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IrrigationInvoicePayment extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'invoice_id', 'payment_id', 'amount', 'method', 'receipt_no', 'paid_at', 'extra',
    ];
    protected $casts = [
        'amount' => 'float',
        'paid_at' => 'datetime',
        'extra' => 'array',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(IrrigationInvoice::class, 'invoice_id');
    }
}
