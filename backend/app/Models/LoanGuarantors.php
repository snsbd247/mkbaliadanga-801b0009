<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoanGuarantors extends Model
{
    protected $table = 'loan_guarantors';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['loan_id', 'farmer_id', 'name', 'father_name', 'village', 'mobile', 'nid', 'office_id'];
}
