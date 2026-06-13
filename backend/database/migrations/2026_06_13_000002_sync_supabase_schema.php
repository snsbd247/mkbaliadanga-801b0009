<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Auto-generated to mirror the self-hosted Supabase public schema.
// Idempotent: each table guarded by Schema::hasTable().
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('accounting_periods')) {
            Schema::create('accounting_periods', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->date('period_start');
                \$table->date('period_end');
                \$table->text('status');
                \$table->timestampTz('closed_at')->nullable();
                \$table->uuid('closed_by')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->decimal('total_debit', 20, 4);
                \$table->decimal('total_credit', 20, 4);
                \$table->decimal('total_income', 20, 4);
                \$table->decimal('total_expense', 20, 4);
                \$table->decimal('net_income', 20, 4);
                \$table->decimal('cash_in', 20, 4);
                \$table->decimal('cash_out', 20, 4);
                \$table->jsonb('closing_balance_snapshot')->nullable();
                \$table->text('note')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('asset_alerts')) {
            Schema::create('asset_alerts', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('asset_id');
                \$table->uuid('location_id')->nullable();
                \$table->text('alert_type');
                \$table->text('severity');
                \$table->text('message_en');
                \$table->text('message_bn')->nullable();
                \$table->jsonb('details')->nullable();
                \$table->text('status');
                \$table->integer('sms_sent_count');
                \$table->timestampTz('last_sms_at')->nullable();
                \$table->uuid('acknowledged_by')->nullable();
                \$table->timestampTz('acknowledged_at')->nullable();
                \$table->timestampTz('resolved_at')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('asset_audit_logs')) {
            Schema::create('asset_audit_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('user_id')->nullable();
                \$table->uuid('asset_id')->nullable();
                \$table->text('entity');
                \$table->uuid('entity_id')->nullable();
                \$table->text('action_type');
                \$table->jsonb('old_data')->nullable();
                \$table->jsonb('new_data')->nullable();
                \$table->text('remarks')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('asset_damage_reports')) {
            Schema::create('asset_damage_reports', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('asset_id');
                \$table->date('report_date');
                \$table->text('severity')->nullable();
                \$table->uuid('reported_by')->nullable();
                \$table->text('status')->nullable();
                \$table->text('remarks')->nullable();
                \$table->timestampTz('created_at');
                \$table->timestampTz('deleted_at')->nullable();
            });
        }
        if (! Schema::hasTable('asset_depreciation_schedule')) {
            Schema::create('asset_depreciation_schedule', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('asset_id');
                \$table->uuid('office_id')->nullable();
                \$table->date('period_month');
                \$table->decimal('opening_book_value', 20, 4);
                \$table->decimal('depreciation_amount', 20, 4);
                \$table->decimal('accumulated_depreciation', 20, 4);
                \$table->decimal('closing_book_value', 20, 4);
                \$table->string('status');
                \$table->uuid('journal_entry_id')->nullable();
                \$table->timestampTz('posted_at')->nullable();
                \$table->uuid('posted_by')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('asset_depreciation_settings')) {
            Schema::create('asset_depreciation_settings', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('asset_id');
                \$table->uuid('office_id')->nullable();
                \$table->string('method');
                \$table->integer('useful_life_months');
                \$table->decimal('salvage_value', 20, 4);
                \$table->decimal('wdv_rate_pct', 20, 4);
                \$table->date('start_on');
                \$table->text('expense_account_code');
                \$table->text('accum_account_code');
                \$table->boolean('is_active');
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('asset_disposals')) {
            Schema::create('asset_disposals', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('asset_id');
                \$table->date('disposal_date');
                \$table->string('method');
                \$table->decimal('sale_amount', 20, 4);
                \$table->decimal('book_value', 20, 4);
                \$table->decimal('gain_loss', 20, 4);
                \$table->uuid('journal_entry_id')->nullable();
                \$table->text('remarks')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->timestampTz('created_at');
                \$table->timestampTz('deleted_at')->nullable();
            });
        }
        if (! Schema::hasTable('asset_installations')) {
            Schema::create('asset_installations', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('asset_id');
                \$table->uuid('location_id')->nullable();
                \$table->text('location_name')->nullable();
                \$table->uuid('installed_by')->nullable();
                \$table->date('install_date');
                \$table->text('condition_status')->nullable();
                \$table->text('remarks')->nullable();
                \$table->timestampTz('created_at');
                \$table->timestampTz('deleted_at')->nullable();
            });
        }
        if (! Schema::hasTable('asset_maintenance_logs')) {
            Schema::create('asset_maintenance_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('asset_id');
                \$table->date('maintenance_date');
                \$table->text('vendor')->nullable();
                \$table->decimal('cost', 20, 4);
                \$table->integer('downtime_days');
                \$table->text('status')->nullable();
                \$table->text('remarks')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->timestampTz('created_at');
                \$table->timestampTz('deleted_at')->nullable();
            });
        }
        if (! Schema::hasTable('asset_maintenance_schedules')) {
            Schema::create('asset_maintenance_schedules', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('asset_id');
                \$table->text('title');
                \$table->integer('frequency_days');
                \$table->date('next_due_at');
                \$table->text('vendor')->nullable();
                \$table->text('notes')->nullable();
                \$table->boolean('active');
                \$table->timestampTz('last_generated_alert_at')->nullable();
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('asset_movements')) {
            Schema::create('asset_movements', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('asset_id');
                \$table->uuid('from_location_id')->nullable();
                \$table->uuid('to_location_id')->nullable();
                \$table->decimal('quantity', 20, 4);
                \$table->uuid('moved_by')->nullable();
                \$table->date('movement_date');
                \$table->text('remarks')->nullable();
                \$table->timestampTz('created_at');
                \$table->timestampTz('deleted_at')->nullable();
                \$table->text('approval_status');
                \$table->uuid('requested_by')->nullable();
                \$table->uuid('approved_by')->nullable();
                \$table->timestampTz('approved_at')->nullable();
                \$table->text('rejection_reason')->nullable();
                \$table->boolean('applied');
            });
        }
        if (! Schema::hasTable('asset_purchases')) {
            Schema::create('asset_purchases', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('asset_id');
                \$table->date('purchase_date');
                \$table->decimal('quantity', 20, 4);
                \$table->decimal('unit_price', 20, 4);
                \$table->decimal('total_amount', 20, 4);
                \$table->text('supplier')->nullable();
                \$table->text('invoice_no')->nullable();
                \$table->text('payment_method')->nullable();
                \$table->uuid('journal_entry_id')->nullable();
                \$table->text('notes')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->timestampTz('deleted_at')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('asset_scan_logs')) {
            Schema::create('asset_scan_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->timestampTz('scanned_at');
                \$table->uuid('scanned_by')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->text('scanned_text');
                \$table->uuid('asset_id')->nullable();
                \$table->text('asset_code')->nullable();
                \$table->boolean('success');
                \$table->text('error_message')->nullable();
                \$table->text('source');
            });
        }
        if (! Schema::hasTable('asset_stocks')) {
            Schema::create('asset_stocks', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('asset_id');
                \$table->uuid('location_id')->nullable();
                \$table->decimal('quantity', 20, 4);
                \$table->timestampTz('updated_at');
            });
        }
        if (! Schema::hasTable('background_retry_jobs')) {
            Schema::create('background_retry_jobs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->text('job_type');
                \$table->uuid('reference_id')->nullable();
                \$table->jsonb('payload');
                \$table->text('status');
                \$table->integer('retry_count');
                \$table->integer('max_retry');
                \$table->timestampTz('next_retry_at');
                \$table->text('last_error')->nullable();
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('card_settings')) {
            Schema::create('card_settings', function (Blueprint \$table) {
                \$table->integer('id');
                \$table->text('template_id');
                \$table->text('accent_color');
                \$table->text('header_text');
                \$table->text('header_text_bn');
                \$table->boolean('show_photo');
                \$table->boolean('show_account_number');
                \$table->boolean('show_voter_number');
                \$table->boolean('show_issue_date');
                \$table->boolean('show_qr');
                \$table->decimal('photo_size_mm', 20, 4);
                \$table->decimal('font_scale', 20, 4);
                \$table->timestampTz('updated_at');
                \$table->uuid('updated_by')->nullable();
                \$table->decimal('header_height_mm', 20, 4);
                \$table->decimal('logo_size_mm', 20, 4);
                \$table->text('custom_text');
                \$table->text('custom_text_bn');
            });
        }
        if (! Schema::hasTable('cashbook_expense_heads')) {
            Schema::create('cashbook_expense_heads', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->text('stream');
                \$table->text('name_bn');
                \$table->text('name_en')->nullable();
                \$table->integer('sort_order');
                \$table->boolean('is_active');
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('cashbook_submissions')) {
            Schema::create('cashbook_submissions', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->integer('year');
                \$table->integer('month');
                \$table->decimal('opening_cash', 20, 4);
                \$table->decimal('closing_cash', 20, 4);
                \$table->decimal('total_income', 20, 4);
                \$table->decimal('total_expense', 20, 4);
                \$table->text('note')->nullable();
                \$table->uuid('submitted_by')->nullable();
                \$table->timestampTz('submitted_at');
                \$table->boolean('locked');
                \$table->timestampTz('created_at');
                \$table->text('stream');
            });
        }
        if (! Schema::hasTable('cashbook_voucher_seq')) {
            Schema::create('cashbook_voucher_seq', function (Blueprint \$table) {
                \$table->uuid('office_id');
                \$table->text('stream');
                \$table->integer('last_no');
            });
        }
        if (! Schema::hasTable('company_settings')) {
            Schema::create('company_settings', function (Blueprint \$table) {
                \$table->integer('id');
                \$table->text('company_name');
                \$table->text('company_name_bn')->nullable();
                \$table->text('logo_url')->nullable();
                \$table->text('email')->nullable();
                \$table->text('mobile')->nullable();
                \$table->text('address')->nullable();
                \$table->decimal('default_loan_interest', 20, 4);
                \$table->timestampTz('updated_at');
                \$table->text('penalty_type');
                \$table->decimal('penalty_value', 20, 4);
                \$table->integer('penalty_grace_days');
                \$table->smallInteger('fiscal_year_start_month');
                \$table->text('pdf_footer_text')->nullable();
                \$table->boolean('pdf_footer_show_address');
                \$table->boolean('pdf_footer_show_contact');
                \$table->text('loan_receipt_header_en')->nullable();
                \$table->text('loan_receipt_header_bn')->nullable();
                \$table->text('loan_receipt_footer_en')->nullable();
                \$table->text('loan_receipt_footer_bn')->nullable();
                \$table->text('loan_receipt_no_format')->nullable();
                \$table->text('registration_no')->nullable();
            });
        }
        if (! Schema::hasTable('demo_operations_log')) {
            Schema::create('demo_operations_log', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('user_id')->nullable();
                \$table->text('user_email')->nullable();
                \$table->text('action');
                \$table->json('modules');
                \$table->integer('size')->nullable();
                \$table->text('ip')->nullable();
                \$table->text('user_agent')->nullable();
                \$table->boolean('success');
                \$table->text('error_message')->nullable();
                \$table->jsonb('summary')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('developer_update_logs')) {
            Schema::create('developer_update_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('user_id');
                \$table->text('action');
                \$table->text('repo_url');
                \$table->text('commit_sha')->nullable();
                \$table->text('commit_message')->nullable();
                \$table->text('release_tag')->nullable();
                \$table->text('note')->nullable();
                \$table->timestampTz('created_at');
                \$table->text('status')->nullable();
            });
        }
        if (! Schema::hasTable('districts')) {
            Schema::create('districts', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('division_id')->nullable();
                \$table->text('name');
                \$table->text('name_bn')->nullable();
                \$table->text('code')->nullable();
                \$table->boolean('is_active');
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('divisions')) {
            Schema::create('divisions', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('name');
                \$table->text('name_bn')->nullable();
                \$table->text('code')->nullable();
                \$table->boolean('is_active');
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('expenses')) {
            Schema::create('expenses', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->date('expense_date');
                \$table->text('head');
                \$table->text('payee')->nullable();
                \$table->decimal('amount', 20, 4);
                \$table->text('method')->nullable();
                \$table->text('note')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->timestampTz('deleted_at')->nullable();
                \$table->text('stream');
                \$table->text('voucher_no')->nullable();
                \$table->text('attachment_path')->nullable();
                \$table->text('attachment_mime')->nullable();
                \$table->uuid('bank_account_id')->nullable();
                \$table->boolean('is_bank_deposit');
                \$table->uuid('head_id')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('farmer_login_attempts')) {
            Schema::create('farmer_login_attempts', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('identifier');
                \$table->uuid('farmer_id')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->boolean('success');
                \$table->text('error_reason')->nullable();
                \$table->text('ip')->nullable();
                \$table->text('user_agent')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('farmer_notes')) {
            Schema::create('farmer_notes', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('farmer_id');
                \$table->text('note');
                \$table->boolean('pinned');
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('farmer_otps')) {
            Schema::create('farmer_otps', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('farmer_id');
                \$table->text('otp_hash');
                \$table->text('mobile_masked')->nullable();
                \$table->timestampTz('expires_at');
                \$table->integer('attempts');
                \$table->boolean('used');
                \$table->text('ip')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('farmer_portal_sessions')) {
            Schema::create('farmer_portal_sessions', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('farmer_id');
                \$table->text('token_hash');
                \$table->timestampTz('expires_at');
                \$table->timestampTz('created_at');
                \$table->timestampTz('last_used_at')->nullable();
                \$table->text('ip')->nullable();
                \$table->text('user_agent')->nullable();
            });
        }
        if (! Schema::hasTable('farmer_rejections')) {
            Schema::create('farmer_rejections', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->timestampTz('created_at');
                \$table->uuid('user_id')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('farmer_id')->nullable();
                \$table->text('operation');
                \$table->text('failed_level');
                \$table->text('reason');
                \$table->jsonb('attempted');
                \$table->text('error_message');
            });
        }
        if (! Schema::hasTable('farmer_savings_plans')) {
            Schema::create('farmer_savings_plans', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('farmer_id');
                \$table->uuid('plan_id');
                \$table->date('start_date');
                \$table->decimal('expected_total', 20, 4);
                \$table->decimal('expected_interest', 20, 4);
                \$table->decimal('maturity_amount', 20, 4);
                \$table->text('status');
                \$table->uuid('office_id')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->uuid('approved_by')->nullable();
                \$table->timestampTz('approved_at')->nullable();
                \$table->uuid('cancelled_by')->nullable();
                \$table->timestampTz('cancelled_at')->nullable();
                \$table->text('cancel_reason')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('import_audit_logs')) {
            Schema::create('import_audit_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('user_id')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->text('module');
                \$table->text('mode');
                \$table->integer('rows_processed');
                \$table->integer('rows_inserted');
                \$table->integer('rows_updated');
                \$table->integer('rows_failed');
                \$table->text('error_report_url')->nullable();
                \$table->jsonb('summary')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('irrigation_categories')) {
            Schema::create('irrigation_categories', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->text('code');
                \$table->text('name_bn')->nullable();
                \$table->text('name_en')->nullable();
                \$table->text('calculation_basis');
                \$table->boolean('allow_manual_negotiation');
                \$table->boolean('is_active');
                \$table->timestampTz('deleted_at')->nullable();
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('irrigation_category_rates')) {
            Schema::create('irrigation_category_rates', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('irrigation_season_id');
                \$table->uuid('irrigation_category_id');
                \$table->text('rate_type');
                \$table->decimal('rate', 20, 4);
                \$table->text('unit')->nullable();
                \$table->boolean('is_negotiable');
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('irrigation_charge_settings')) {
            Schema::create('irrigation_charge_settings', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->decimal('delay_fee_percent', 20, 4);
                \$table->decimal('maintenance_percent', 20, 4);
                \$table->decimal('canal_percent', 20, 4);
                \$table->integer('grace_days');
                \$table->boolean('auto_apply_delay_fee');
                \$table->uuid('created_by')->nullable();
                \$table->uuid('updated_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('irrigation_charges')) {
            Schema::create('irrigation_charges', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('farmer_id');
                \$table->uuid('land_id');
                \$table->uuid('season_id');
                \$table->string('basis');
                \$table->decimal('quantity', 20, 4);
                \$table->decimal('base_charge', 20, 4);
                \$table->decimal('canal_charge', 20, 4);
                \$table->decimal('maintenance_charge', 20, 4);
                \$table->decimal('other_charge', 20, 4);
                \$table->decimal('total', 20, 4);
                \$table->decimal('paid_amount', 20, 4);
                \$table->decimal('due_amount', 20, 4);
                \$table->date('entry_date');
                \$table->text('note')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->timestampTz('created_at');
                \$table->uuid('office_id')->nullable();
                \$table->decimal('previous_due_brought', 20, 4);
                \$table->decimal('penalty_amount', 20, 4);
                \$table->timestampTz('deleted_at')->nullable();
                \$table->uuid('patwari_id')->nullable();
            });
        }
        if (! Schema::hasTable('irrigation_delay_fee_audit')) {
            Schema::create('irrigation_delay_fee_audit', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('invoice_id');
                \$table->uuid('payment_id')->nullable();
                \$table->decimal('original_amount', 20, 4);
                \$table->decimal('modified_amount', 20, 4);
                \$table->text('reason')->nullable();
                \$table->uuid('changed_by')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('irrigation_due_promises')) {
            Schema::create('irrigation_due_promises', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('farmer_id');
                \$table->uuid('payment_id')->nullable();
                \$table->decimal('previous_due_amount', 20, 4);
                \$table->date('promise_date');
                \$table->text('remarks')->nullable();
                \$table->uuid('approved_by')->nullable();
                \$table->text('status');
                \$table->timestampTz('fulfilled_at')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('irrigation_invoice_audit')) {
            Schema::create('irrigation_invoice_audit', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('invoice_id');
                \$table->text('action');
                \$table->jsonb('old_values')->nullable();
                \$table->jsonb('new_values')->nullable();
                \$table->text('note')->nullable();
                \$table->uuid('user_id')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('irrigation_invoice_payments')) {
            Schema::create('irrigation_invoice_payments', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('invoice_id');
                \$table->uuid('payment_id')->nullable();
                \$table->decimal('collected_amount', 20, 4);
                \$table->decimal('delay_fee_collected', 20, 4);
                \$table->decimal('maintenance_collected', 20, 4);
                \$table->decimal('canal_collected', 20, 4);
                \$table->decimal('irrigation_collected', 20, 4);
                \$table->uuid('office_id')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->timestampTz('created_at');
                \$table->decimal('current_invoice_collected', 20, 4);
                \$table->decimal('previous_due_collected', 20, 4);
                \$table->decimal('delay_fee_original', 20, 4)->nullable();
                \$table->text('delay_fee_override_reason')->nullable();
            });
        }
        if (! Schema::hasTable('irrigation_rate_audit_logs')) {
            Schema::create('irrigation_rate_audit_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('irrigation_season_id')->nullable();
                \$table->uuid('land_type_id')->nullable();
                \$table->decimal('old_rate', 20, 4)->nullable();
                \$table->decimal('new_rate', 20, 4)->nullable();
                \$table->text('change_reason')->nullable();
                \$table->uuid('changed_by')->nullable();
                \$table->timestampTz('changed_at');
                \$table->text('ip')->nullable();
                \$table->text('action');
            });
        }
        if (! Schema::hasTable('irrigation_rate_overrides')) {
            Schema::create('irrigation_rate_overrides', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('irrigation_invoice_id');
                \$table->decimal('original_rate', 20, 4);
                \$table->decimal('overridden_rate', 20, 4);
                \$table->text('override_reason')->nullable();
                \$table->uuid('approved_by')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('irrigation_season_rates')) {
            Schema::create('irrigation_season_rates', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('irrigation_season_id');
                \$table->uuid('land_type_id');
                \$table->decimal('rate_per_shotok', 20, 4);
                \$table->uuid('office_id')->nullable();
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('irrigation_season_types')) {
            Schema::create('irrigation_season_types', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('code');
                \$table->text('name');
                \$table->text('name_bn')->nullable();
                \$table->boolean('is_active');
                \$table->integer('sort_order');
                \$table->uuid('office_id')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->text('name_en')->nullable();
                \$table->timestampTz('deleted_at')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('irrigation_sms_logs')) {
            Schema::create('irrigation_sms_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('irrigation_invoice_id')->nullable();
                \$table->uuid('farmer_id')->nullable();
                \$table->text('mobile')->nullable();
                \$table->text('sms_type');
                \$table->text('message')->nullable();
                \$table->text('status');
                \$table->text('failure_reason')->nullable();
                \$table->jsonb('gateway_response')->nullable();
                \$table->integer('retry_count');
                \$table->uuid('sent_by')->nullable();
                \$table->timestampTz('sent_at')->nullable();
                \$table->timestampTz('delivered_at')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('journal_entry_lines')) {
            Schema::create('journal_entry_lines', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('journal_id');
                \$table->uuid('account_id');
                \$table->decimal('debit', 20, 4);
                \$table->decimal('credit', 20, 4);
                \$table->text('description')->nullable();
                \$table->integer('position');
            });
        }
        if (! Schema::hasTable('land_change_log')) {
            Schema::create('land_change_log', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('land_id')->nullable();
                \$table->uuid('farmer_id')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->text('change_type');
                \$table->jsonb('old_values')->nullable();
                \$table->jsonb('new_values')->nullable();
                \$table->text('remarks')->nullable();
                \$table->uuid('changed_by')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('land_history')) {
            Schema::create('land_history', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('land_id')->nullable();
                \$table->uuid('farmer_id');
                \$table->integer('fiscal_year');
                \$table->text('season')->nullable();
                \$table->text('mouza')->nullable();
                \$table->text('dag_no')->nullable();
                \$table->decimal('land_size', 20, 4);
                \$table->text('owner_type')->nullable();
                \$table->text('field_type')->nullable();
                \$table->uuid('cultivator_farmer_id')->nullable();
                \$table->text('remarks')->nullable();
                \$table->uuid('recorded_by')->nullable();
                \$table->timestampTz('created_at');
                \$table->text('crop')->nullable();
                \$table->decimal('yield_amount', 20, 4)->nullable();
                \$table->text('yield_unit')->nullable();
            });
        }
        if (! Schema::hasTable('land_relations')) {
            Schema::create('land_relations', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('land_id');
                \$table->uuid('owner_farmer_id');
                \$table->uuid('sharecropper_farmer_id')->nullable();
                \$table->decimal('share_percentage', 20, 4);
                \$table->date('valid_from');
                \$table->date('valid_to')->nullable();
                \$table->text('note')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->timestampTz('created_at');
                \$table->timestampTz('deleted_at')->nullable();
                \$table->decimal('area_decimal', 20, 4)->nullable();
            });
        }
        if (! Schema::hasTable('land_transfer_recipients')) {
            Schema::create('land_transfer_recipients', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('transfer_id');
                \$table->uuid('recipient_farmer_id');
                \$table->uuid('new_land_id')->nullable();
                \$table->decimal('area_decimal', 20, 4);
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('land_transfers')) {
            Schema::create('land_transfers', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('source_land_id');
                \$table->uuid('source_farmer_id');
                \$table->text('transfer_type');
                \$table->text('remark')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->date('transferred_at');
                \$table->uuid('created_by')->nullable();
                \$table->timestampTz('created_at');
                \$table->text('source_dag_no')->nullable();
                \$table->text('source_mouza')->nullable();
                \$table->decimal('source_land_size', 20, 4)->nullable();
                \$table->text('source_owner_name')->nullable();
                \$table->text('source_owner_code')->nullable();
            });
        }
        if (! Schema::hasTable('land_types')) {
            Schema::create('land_types', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('code');
                \$table->text('name');
                \$table->text('name_bn')->nullable();
                \$table->boolean('is_active');
                \$table->integer('sort_order');
                \$table->uuid('office_id')->nullable();
                \$table->uuid('created_by')->nullable();
                \$table->text('name_en')->nullable();
                \$table->timestampTz('deleted_at')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('loan_delay_fee_settings')) {
            Schema::create('loan_delay_fee_settings', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->text('mode');
                \$table->decimal('value', 20, 4);
                \$table->integer('grace_days');
                \$table->boolean('auto_apply');
                \$table->boolean('allow_partial_installment');
                \$table->uuid('created_by')->nullable();
                \$table->uuid('updated_by')->nullable();
                \$table->decimal('daily_penalty', 20, 4);
                \$table->decimal('max_penalty', 20, 4)->nullable();
                \$table->text('enforcement_mode');
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('loan_guarantors')) {
            Schema::create('loan_guarantors', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('loan_id');
                \$table->uuid('farmer_id')->nullable();
                \$table->text('name');
                \$table->text('father_name')->nullable();
                \$table->text('village')->nullable();
                \$table->text('mobile')->nullable();
                \$table->text('nid')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('loan_installment_delay_audit')) {
            Schema::create('loan_installment_delay_audit', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('installment_id');
                \$table->uuid('loan_id');
                \$table->uuid('payment_id')->nullable();
                \$table->decimal('original_amount', 20, 4);
                \$table->decimal('modified_amount', 20, 4);
                \$table->text('reason')->nullable();
                \$table->uuid('changed_by')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('loan_payments')) {
            Schema::create('loan_payments', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('loan_id');
                \$table->decimal('amount', 20, 4);
                \$table->date('paid_on');
                \$table->uuid('collected_by')->nullable();
                \$table->timestampTz('created_at');
                \$table->uuid('office_id')->nullable();
                \$table->string('status');
                \$table->uuid('approved_by')->nullable();
                \$table->timestampTz('approved_at')->nullable();
                \$table->text('approval_note')->nullable();
                \$table->text('note')->nullable();
                \$table->decimal('penalty_collected', 20, 4);
                \$table->text('override_reason')->nullable();
                \$table->uuid('override_by')->nullable();
                \$table->text('receipt_no')->nullable();
                \$table->decimal('principal_amount', 20, 4)->nullable();
                \$table->decimal('interest_amount', 20, 4)->nullable();
            });
        }
        if (! Schema::hasTable('mouzas')) {
            Schema::create('mouzas', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('upazila_id');
                \$table->text('name');
                \$table->text('name_bn')->nullable();
                \$table->text('code')->nullable();
                \$table->boolean('is_active');
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('patwaris')) {
            Schema::create('patwaris', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('name');
                \$table->text('name_bn')->nullable();
                \$table->text('mobile')->nullable();
                \$table->text('nid')->nullable();
                \$table->text('address')->nullable();
                \$table->uuid('mouza_id')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->boolean('is_active');
                \$table->text('note')->nullable();
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('payment_allocations')) {
            Schema::create('payment_allocations', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('payment_id');
                \$table->text('kind');
                \$table->uuid('reference_id')->nullable();
                \$table->decimal('amount', 20, 4);
                \$table->uuid('office_id')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('permission_audit_logs')) {
            Schema::create('permission_audit_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('changed_by')->nullable();
                \$table->string('role')->nullable();
                \$table->uuid('target_user_id')->nullable();
                \$table->text('module');
                \$table->text('action');
                \$table->boolean('old_value')->nullable();
                \$table->boolean('new_value')->nullable();
                \$table->text('reason')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('profiles')) {
            Schema::create('profiles', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('full_name')->nullable();
                \$table->text('email')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->text('language_pref');
                \$table->text('username')->nullable();
                \$table->jsonb('receipt_options')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('public_payment_intents')) {
            Schema::create('public_payment_intents', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('farmer_code');
                \$table->text('phone')->nullable();
                \$table->decimal('amount', 20, 4);
                \$table->text('allocation_hint')->nullable();
                \$table->text('note')->nullable();
                \$table->text('status');
                \$table->uuid('processed_by')->nullable();
                \$table->timestampTz('processed_at')->nullable();
                \$table->uuid('payment_id')->nullable();
                \$table->timestampTz('created_at');
                \$table->uuid('office_id')->nullable();
            });
        }
        if (! Schema::hasTable('qr_rotation_settings')) {
            Schema::create('qr_rotation_settings', function (Blueprint \$table) {
                \$table->integer('id');
                \$table->boolean('enabled');
                \$table->integer('interval_days');
                \$table->integer('grace_hours');
                \$table->timestampTz('last_run_at')->nullable();
                \$table->jsonb('last_run_summary')->nullable();
                \$table->uuid('updated_by')->nullable();
                \$table->timestampTz('updated_at');
            });
        }
        if (! Schema::hasTable('receipt_counters')) {
            Schema::create('receipt_counters', function (Blueprint \$table) {
                \$table->text('kind');
                \$table->integer('year');
                \$table->bigInteger('last_no');
                \$table->timestampTz('updated_at');
            });
        }
        if (! Schema::hasTable('receipt_sequences')) {
            Schema::create('receipt_sequences', function (Blueprint \$table) {
                \$table->uuid('office_id');
                \$table->text('kind');
                \$table->integer('year');
                \$table->integer('month');
                \$table->integer('last_no');
                \$table->timestampTz('updated_at');
            });
        }
        if (! Schema::hasTable('receipt_settings')) {
            Schema::create('receipt_settings', function (Blueprint \$table) {
                \$table->integer('id');
                \$table->text('language');
                \$table->text('paper_size');
                \$table->text('accent_color');
                \$table->boolean('show_logo');
                \$table->boolean('show_signature_line');
                \$table->boolean('show_office');
                \$table->boolean('show_token_block');
                \$table->text('header_alignment');
                \$table->text('footer_note');
                \$table->text('footer_note_bn');
                \$table->timestampTz('updated_at');
                \$table->uuid('updated_by')->nullable();
            });
        }
        if (! Schema::hasTable('receipts')) {
            Schema::create('receipts', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('receipt_no')->nullable();
                \$table->string('kind');
                \$table->uuid('farmer_id')->nullable();
                \$table->uuid('reference_id')->nullable();
                \$table->decimal('amount', 20, 4);
                \$table->text('method')->nullable();
                \$table->text('note')->nullable();
                \$table->date('receipt_date');
                \$table->uuid('office_id')->nullable();
                \$table->uuid('collected_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('savings_plans')) {
            Schema::create('savings_plans', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('name');
                \$table->text('name_bn')->nullable();
                \$table->integer('duration_months');
                \$table->string('installment_type');
                \$table->decimal('installment_amount', 20, 4);
                \$table->decimal('interest_rate', 20, 4);
                \$table->string('maturity_type');
                \$table->boolean('is_active');
                \$table->uuid('office_id')->nullable();
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('savings_yearly_opening')) {
            Schema::create('savings_yearly_opening', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('farmer_id');
                \$table->integer('year');
                \$table->decimal('opening_balance', 20, 4);
                \$table->uuid('office_id')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('shares')) {
            Schema::create('shares', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('farmer_id');
                \$table->decimal('balance', 20, 4);
                \$table->timestampTz('updated_at');
                \$table->uuid('office_id')->nullable();
            });
        }
        if (! Schema::hasTable('sms_office_settings')) {
            Schema::create('sms_office_settings', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id');
                \$table->boolean('enabled');
                \$table->text('sender_id')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('sms_provider_secrets')) {
            Schema::create('sms_provider_secrets', function (Blueprint \$table) {
                \$table->text('provider');
                \$table->text('api_token');
                \$table->timestampTz('updated_at');
                \$table->uuid('updated_by')->nullable();
                $table->uuid('id')->primary();
                \$table->text('status');
                \$table->timestampTz('expires_at')->nullable();
                \$table->timestampTz('activated_at')->nullable();
                \$table->text('label')->nullable();
                \$table->integer('priority');
                \$table->text('dlr_url')->nullable();
            });
        }
        if (! Schema::hasTable('sms_templates')) {
            Schema::create('sms_templates', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->text('key');
                \$table->text('name');
                \$table->text('body');
                \$table->json('variables')->nullable();
                \$table->boolean('is_active');
                \$table->text('preferred_provider')->nullable();
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('system_audit_logs')) {
            Schema::create('system_audit_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->uuid('user_id')->nullable();
                \$table->text('module');
                \$table->text('action_type');
                \$table->uuid('reference_id')->nullable();
                \$table->jsonb('old_data')->nullable();
                \$table->jsonb('new_data')->nullable();
                \$table->text('ip')->nullable();
                \$table->text('user_agent')->nullable();
                \$table->timestampTz('created_at');
            });
        }
        if (! Schema::hasTable('upazilas')) {
            Schema::create('upazilas', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('district_id')->nullable();
                \$table->text('name');
                \$table->text('name_bn')->nullable();
                \$table->text('code')->nullable();
                \$table->boolean('is_active');
                $table->timestampsTz();
            });
        }
        if (! Schema::hasTable('user_permissions')) {
            Schema::create('user_permissions', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('user_id');
                \$table->text('module');
                \$table->boolean('can_view');
                \$table->boolean('can_add');
                \$table->boolean('can_edit');
                \$table->boolean('can_delete');
            });
        }
        if (! Schema::hasTable('voter_audit_logs')) {
            Schema::create('voter_audit_logs', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('farmer_id');
                \$table->text('account_number')->nullable();
                \$table->text('voter_number_old')->nullable();
                \$table->text('voter_number_new')->nullable();
                \$table->boolean('is_voter_old')->nullable();
                \$table->boolean('is_voter_new')->nullable();
                \$table->uuid('changed_by')->nullable();
                \$table->uuid('office_id')->nullable();
                \$table->timestampTz('created_at');
                \$table->text('note')->nullable();
                \$table->text('action')->nullable();
            });
        }
        if (! Schema::hasTable('voucher_sequences')) {
            Schema::create('voucher_sequences', function (Blueprint \$table) {
                \$table->uuid('office_id');
                \$table->text('voucher_type');
                \$table->integer('fiscal_year');
                \$table->integer('last_no');
            });
        }
        if (! Schema::hasTable('vouchers')) {
            Schema::create('vouchers', function (Blueprint \$table) {
                $table->uuid('id')->primary();
                \$table->uuid('office_id')->nullable();
                \$table->text('voucher_no');
                \$table->text('voucher_type');
                \$table->date('voucher_date');
                \$table->decimal('amount', 20, 4);
                \$table->text('payee')->nullable();
                \$table->text('narration')->nullable();
                \$table->text('attachment_path')->nullable();
                \$table->text('attachment_mime')->nullable();
                \$table->text('reference_type')->nullable();
                \$table->uuid('reference_id')->nullable();
                \$table->uuid('created_by')->nullable();
                $table->timestampsTz();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vouchers');
        Schema::dropIfExists('voucher_sequences');
        Schema::dropIfExists('voter_audit_logs');
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('upazilas');
        Schema::dropIfExists('system_audit_logs');
        Schema::dropIfExists('sms_templates');
        Schema::dropIfExists('sms_provider_secrets');
        Schema::dropIfExists('sms_office_settings');
        Schema::dropIfExists('shares');
        Schema::dropIfExists('savings_yearly_opening');
        Schema::dropIfExists('savings_plans');
        Schema::dropIfExists('receipts');
        Schema::dropIfExists('receipt_settings');
        Schema::dropIfExists('receipt_sequences');
        Schema::dropIfExists('receipt_counters');
        Schema::dropIfExists('qr_rotation_settings');
        Schema::dropIfExists('public_payment_intents');
        Schema::dropIfExists('profiles');
        Schema::dropIfExists('permission_audit_logs');
        Schema::dropIfExists('payment_allocations');
        Schema::dropIfExists('patwaris');
        Schema::dropIfExists('mouzas');
        Schema::dropIfExists('loan_payments');
        Schema::dropIfExists('loan_installment_delay_audit');
        Schema::dropIfExists('loan_guarantors');
        Schema::dropIfExists('loan_delay_fee_settings');
        Schema::dropIfExists('land_types');
        Schema::dropIfExists('land_transfers');
        Schema::dropIfExists('land_transfer_recipients');
        Schema::dropIfExists('land_relations');
        Schema::dropIfExists('land_history');
        Schema::dropIfExists('land_change_log');
        Schema::dropIfExists('journal_entry_lines');
        Schema::dropIfExists('irrigation_sms_logs');
        Schema::dropIfExists('irrigation_season_types');
        Schema::dropIfExists('irrigation_season_rates');
        Schema::dropIfExists('irrigation_rate_overrides');
        Schema::dropIfExists('irrigation_rate_audit_logs');
        Schema::dropIfExists('irrigation_invoice_payments');
        Schema::dropIfExists('irrigation_invoice_audit');
        Schema::dropIfExists('irrigation_due_promises');
        Schema::dropIfExists('irrigation_delay_fee_audit');
        Schema::dropIfExists('irrigation_charges');
        Schema::dropIfExists('irrigation_charge_settings');
        Schema::dropIfExists('irrigation_category_rates');
        Schema::dropIfExists('irrigation_categories');
        Schema::dropIfExists('import_audit_logs');
        Schema::dropIfExists('farmer_savings_plans');
        Schema::dropIfExists('farmer_rejections');
        Schema::dropIfExists('farmer_portal_sessions');
        Schema::dropIfExists('farmer_otps');
        Schema::dropIfExists('farmer_notes');
        Schema::dropIfExists('farmer_login_attempts');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('divisions');
        Schema::dropIfExists('districts');
        Schema::dropIfExists('developer_update_logs');
        Schema::dropIfExists('demo_operations_log');
        Schema::dropIfExists('company_settings');
        Schema::dropIfExists('cashbook_voucher_seq');
        Schema::dropIfExists('cashbook_submissions');
        Schema::dropIfExists('cashbook_expense_heads');
        Schema::dropIfExists('card_settings');
        Schema::dropIfExists('background_retry_jobs');
        Schema::dropIfExists('asset_stocks');
        Schema::dropIfExists('asset_scan_logs');
        Schema::dropIfExists('asset_purchases');
        Schema::dropIfExists('asset_movements');
        Schema::dropIfExists('asset_maintenance_schedules');
        Schema::dropIfExists('asset_maintenance_logs');
        Schema::dropIfExists('asset_installations');
        Schema::dropIfExists('asset_disposals');
        Schema::dropIfExists('asset_depreciation_settings');
        Schema::dropIfExists('asset_depreciation_schedule');
        Schema::dropIfExists('asset_damage_reports');
        Schema::dropIfExists('asset_audit_logs');
        Schema::dropIfExists('asset_alerts');
        Schema::dropIfExists('accounting_periods');
    }
};
