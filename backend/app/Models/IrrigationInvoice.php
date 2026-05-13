<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class IrrigationInvoice extends Model {
    use HasUuids, SoftDeletes;
    protected $fillable = ['office_id','farmer_id','season_id','land_id','invoice_no','invoice_date','due_date','area_decimal','rate','total','paid','status','breakdown'];
    protected $casts = ['invoice_date'=>'date','due_date'=>'date','breakdown'=>'array','total'=>'decimal:2','paid'=>'decimal:2','rate'=>'decimal:2','area_decimal'=>'decimal:2'];
    public function farmer() { return $this->belongsTo(Farmer::class); }
    public function season() { return $this->belongsTo(Season::class); }
}
