<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReceiptSettings extends Model
{
    protected $table = 'receipt_settings';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['language', 'paper_size', 'accent_color', 'show_logo', 'show_signature_line', 'show_office', 'show_token_block', 'header_alignment', 'footer_note', 'footer_note_bn', 'updated_by'];
}
