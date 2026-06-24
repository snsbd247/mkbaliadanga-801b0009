<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Land extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'farmer_id', 'office_id', 'land_type_id', 'khatian_no', 'dag_no',
        'area_decimal', 'mouza', 'notes', 'extra',
    ];

    protected $casts = [
        'area_decimal' => 'float',
        'extra' => 'array',
    ];

    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }
}
