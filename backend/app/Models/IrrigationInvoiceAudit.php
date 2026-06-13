<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationInvoiceAudit extends Model
{
    protected $table = 'irrigation_invoice_audit';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['invoice_id', 'action', 'old_values', 'new_values', 'note', 'user_id', 'office_id'];
}
