<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SavingsAccount extends Model {
    use HasUuids;
    protected $fillable = ['office_id','farmer_id','code','balance','opened_on','is_active'];
    protected $casts = ['opened_on'=>'date','balance'=>'decimal:2','is_active'=>'boolean'];
    public function transactions() { return $this->hasMany(SavingsTransaction::class)->orderByDesc('tx_date'); }
    public function farmer()       { return $this->belongsTo(Farmer::class); }
}
