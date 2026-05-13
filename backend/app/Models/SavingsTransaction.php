<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SavingsTransaction extends Model {
    use HasUuids;
    protected $fillable = ['savings_account_id','office_id','tx_date','kind','amount','receipt_no','memo','created_by'];
    protected $casts = ['tx_date'=>'date','amount'=>'decimal:2'];
}
