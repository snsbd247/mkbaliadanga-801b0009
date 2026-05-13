<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LoanPlan extends Model {
    use HasUuids;
    protected $fillable = ['office_id','name','interest_pct','default_term_months','processing_fee','delay_fee_pct','rules','is_active'];
    protected $casts = ['rules' => 'array', 'is_active' => 'boolean'];
}
