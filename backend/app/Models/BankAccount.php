<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class BankAccount extends Model {
    use HasUuids;
    protected $fillable = ['office_id','bank_name','branch','account_no','account_title','account_type','opening_balance','stream','is_active'];
    protected $casts = ['opening_balance'=>'decimal:2','is_active'=>'boolean'];
    public function transactions() { return $this->hasMany(BankTransaction::class)->orderByDesc('txn_date'); }
}
