<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationCharges extends Model
{
    protected \$table = 'irrigation_charges';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['farmer_id', 'land_id', 'season_id', 'basis', 'quantity', 'base_charge', 'canal_charge', 'maintenance_charge', 'other_charge', 'total', 'paid_amount', 'due_amount', 'entry_date', 'note', 'created_by', 'office_id', 'previous_due_brought', 'penalty_amount', 'deleted_at', 'patwari_id'];
}
