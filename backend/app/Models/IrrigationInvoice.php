<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IrrigationInvoice extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'office_id', 'farmer_id', 'season_id', 'land_id', 'invoice_no',
        'area_decimal', 'rate_per_decimal', 'amount', 'paid_amount',
        'due_amount', 'status', 'issue_date', 'due_date', 'extra',
    ];
    protected $casts = [
        'area_decimal' => 'float',
        'rate_per_decimal' => 'float',
        'amount' => 'float',
        'paid_amount' => 'float',
        'due_amount' => 'float',
        'issue_date' => 'date',
        'due_date' => 'date',
        'extra' => 'array',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(IrrigationInvoicePayment::class, 'invoice_id');
    }

    /** Recompute paid/due totals and status from linked payments. */
    public function recalculate(): void
    {
        $paid = (float) $this->payments()->sum('amount');
        $this->paid_amount = $paid;
        $this->due_amount = max(0, (float) $this->amount - $paid);
        $this->status = $this->due_amount <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');
        $this->save();
    }
}
