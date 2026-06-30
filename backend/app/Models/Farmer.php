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
        'office_id', 'created_by',
        'code', 'farmer_code', 'member_no', 'account_number',
        'name', 'name_en', 'name_bn', 'father_name', 'mother_name',
        'phone', 'mobile', 'nid', 'address', 'photo_url', 'post_office',
        'village', 'union', 'upazila', 'district', 'division',
        'division_id', 'district_id', 'upazila_id', 'union_id', 'ward_id', 'village_id', 'mouza_id',
        'voter_number', 'is_voter', 'savings_inactive',
        'voter_cancel_reason', 'voter_cancelled_at', 'voter_cancelled_by',
        'voter_reactivate_reason', 'voter_reactivated_at', 'voter_reactivated_by',
        'merged_at', 'merged_by', 'merged_into',
        'status', 'extra',
        'nominee_name', 'nominee_mobile', 'nominee_relation', 'nominee_nid', 'nominee_address',
    ];

    protected $casts = [
        'extra' => 'array',
        'is_voter' => 'boolean',
        'savings_inactive' => 'boolean',
    ];

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function lands(): HasMany
    {
        return $this->hasMany(Land::class);
    }
}
