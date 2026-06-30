<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;

class Farmer extends Model
{
    use HasApiTokens, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'office_id', 'code', 'name', 'father_name', 'mother_name', 'phone',
        'nid', 'address', 'village', 'union', 'upazila', 'district', 'status', 'extra',
        'nominee_name', 'nominee_mobile', 'nominee_relation', 'nominee_nid', 'nominee_address',
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
