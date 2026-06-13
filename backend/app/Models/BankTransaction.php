<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class BankTransaction extends Model {
    use HasUuids;
    public $timestamps = false;
    protected $fillable = ['office_id','bank_account_id','txn_date','txn_type','amount','reference_no','counterparty_account_id','transfer_group','note','created_by'];
    protected $casts = ['txn_date'=>'date','amount'=>'decimal:2','created_at'=>'datetime'];
    public function account() { return $this->belongsTo(BankAccount::class, 'bank_account_id'); }
}
