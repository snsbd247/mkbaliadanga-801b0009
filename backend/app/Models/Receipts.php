<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Receipts extends Model
{
    protected $table = 'receipts';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['receipt_no', 'kind', 'farmer_id', 'reference_id', 'amount', 'method', 'note', 'receipt_date', 'office_id', 'collected_by'];
}
