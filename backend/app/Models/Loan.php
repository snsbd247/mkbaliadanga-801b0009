<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Loan extends Model {
    use HasUuids, SoftDeletes;
    protected $fillable = [
        'office_id','farmer_id','plan_id','code','principal','interest_pct','term_months',
        'disbursed_on','first_due_on','status','outstanding','schedule','approved_by','approved_at',
    ];
    protected $casts = [
        'disbursed_on' => 'date', 'first_due_on' => 'date', 'approved_at' => 'datetime',
        'principal' => 'decimal:2', 'outstanding' => 'decimal:2', 'schedule' => 'array',
    ];
    public function farmer()       { return $this->belongsTo(Farmer::class); }
    public function plan()         { return $this->belongsTo(LoanPlan::class, 'plan_id'); }
    public function installments() { return $this->hasMany(LoanInstallment::class)->orderBy('seq'); }
}
