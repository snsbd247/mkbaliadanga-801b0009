<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanySettings extends Model
{
    protected $table = 'company_settings';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['company_name', 'company_name_bn', 'logo_url', 'email', 'mobile', 'address', 'default_loan_interest', 'penalty_type', 'penalty_value', 'penalty_grace_days', 'fiscal_year_start_month', 'pdf_footer_text', 'pdf_footer_show_address', 'pdf_footer_show_contact', 'loan_receipt_header_en', 'loan_receipt_header_bn', 'loan_receipt_footer_en', 'loan_receipt_footer_bn', 'loan_receipt_no_format', 'registration_no'];
}
