<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublicPaymentIntents extends Model
{
    protected $table = 'public_payment_intents';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['farmer_code', 'phone', 'amount', 'allocation_hint', 'note', 'status', 'processed_by', 'processed_at', 'payment_id', 'office_id'];
}
