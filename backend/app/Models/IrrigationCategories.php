<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationCategories extends Model
{
    protected $table = 'irrigation_categories';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['office_id', 'code', 'name_bn', 'name_en', 'calculation_basis', 'allow_manual_negotiation', 'is_active', 'deleted_at', 'created_by'];
}
