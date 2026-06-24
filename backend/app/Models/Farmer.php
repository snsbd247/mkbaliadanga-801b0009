<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Farmer extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'office_id', 'code', 'name', 'father_name', 'mother_name', 'phone',
        'nid', 'address', 'village', 'union', 'upazila', 'district', 'status', 'extra',
    ];

    protected $casts = ['extra' => 'array'];

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function lands(): HasMany
    {
        return $this->hasMany(Land::class);
    }
}
