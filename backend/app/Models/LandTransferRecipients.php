<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LandTransferRecipients extends Model
{
    protected $table = 'land_transfer_recipients';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['transfer_id', 'recipient_farmer_id', 'new_land_id', 'area_decimal'];
}
