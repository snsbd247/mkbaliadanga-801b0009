<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LegacyIrrigationRecord extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'office_id', 'import_batch_id', 'legacy_farmer_code', 'farmer_name',
        'father_name', 'village', 'mobile_no', 'mouza_name', 'season_year',
        'land_shatak', 'dag_no', 'rate', 'owner_id_name', 'due_amount',
        'paid_amount', 'owner_type_name', 'owner_father_name', 'owner_village',
        'owner_mobile_no', 'owner_fid', 'receipt_no', 'collection_date',
    ];

    protected $casts = [
        'land_shatak' => 'float',
        'rate' => 'float',
        'due_amount' => 'float',
        'paid_amount' => 'float',
        'collection_date' => 'date',
    ];
}
