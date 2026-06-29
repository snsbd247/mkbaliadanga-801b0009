<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::hasTable('accounting_periods') || Schema::create('accounting_periods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status', 1024)->default('open');
            $table->timestampTz('closed_at')->nullable();
            $table->uuid('closed_by')->nullable();
            $table->uuid('office_id')->nullable();
            $table->decimal('total_debit', 20, 4)->default(0);
            $table->decimal('total_credit', 20, 4)->default(0);
            $table->decimal('total_income', 20, 4)->default(0);
            $table->decimal('total_expense', 20, 4)->default(0);
            $table->decimal('net_income', 20, 4)->default(0);
            $table->decimal('cash_in', 20, 4)->default(0);
            $table->decimal('cash_out', 20, 4)->default(0);
            $table->json('closing_balance_snapshot')->nullable();
            $table->text('note')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('asset_alerts') || Schema::create('asset_alerts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('asset_id');
            $table->uuid('location_id')->nullable();
            $table->text('alert_type');
            $table->string('severity', 1024)->default('warning');
            $table->text('message_en');
            $table->text('message_bn')->nullable();
            $table->json('details')->nullable();
            $table->string('status', 1024)->default('open');
            $table->integer('sms_sent_count')->default(0);
            $table->timestampTz('last_sms_at')->nullable();
            $table->uuid('acknowledged_by')->nullable();
            $table->timestampTz('acknowledged_at')->nullable();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('asset_audit_logs') || Schema::create('asset_audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('user_id')->nullable();
            $table->uuid('asset_id')->nullable();
            $table->text('entity');
            $table->uuid('entity_id')->nullable();
            $table->text('action_type');
            $table->json('old_data')->nullable();
            $table->json('new_data')->nullable();
            $table->text('remarks')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('asset_categories') || Schema::create('asset_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->text('name_bn')->nullable();
            $table->text('name_en');
            $table->text('code');
            $table->string('tracking_mode', 1024)->default('quantity');
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
        });

        Schema::hasTable('asset_damage_reports') || Schema::create('asset_damage_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('asset_id');
            $table->date('report_date');
            $table->string('severity', 1024)->nullable()->default('minor');
            $table->uuid('reported_by')->nullable();
            $table->string('status', 1024)->nullable()->default('open');
            $table->text('remarks')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
        });

        Schema::hasTable('asset_depreciation_schedule') || Schema::create('asset_depreciation_schedule', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('asset_id');
            $table->uuid('office_id')->nullable();
            $table->date('period_month');
            $table->decimal('opening_book_value', 20, 4)->default(0);
            $table->decimal('depreciation_amount', 20, 4)->default(0);
            $table->decimal('accumulated_depreciation', 20, 4)->default(0);
            $table->decimal('closing_book_value', 20, 4)->default(0);
            $table->string('status', 1024)->default('pending');
            $table->uuid('journal_entry_id')->nullable();
            $table->timestampTz('posted_at')->nullable();
            $table->uuid('posted_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('asset_depreciation_settings') || Schema::create('asset_depreciation_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('asset_id');
            $table->uuid('office_id')->nullable();
            $table->string('method', 1024)->default('straight_line');
            $table->integer('useful_life_months')->default(60);
            $table->decimal('salvage_value', 20, 4)->default(0);
            $table->decimal('wdv_rate_pct', 20, 4)->default(0);
            $table->date('start_on');
            $table->string('expense_account_code', 1024)->default('5410');
            $table->string('accum_account_code', 1024)->default('1610');
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('asset_disposals') || Schema::create('asset_disposals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('asset_id');
            $table->date('disposal_date');
            $table->string('method', 1024)->default('scrap_sale');
            $table->decimal('sale_amount', 20, 4)->default(0);
            $table->decimal('book_value', 20, 4)->default(0);
            $table->decimal('gain_loss', 20, 4)->default(0);
            $table->uuid('journal_entry_id')->nullable();
            $table->text('remarks')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
        });

        Schema::hasTable('asset_installations') || Schema::create('asset_installations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('asset_id');
            $table->uuid('location_id')->nullable();
            $table->text('location_name')->nullable();
            $table->uuid('installed_by')->nullable();
            $table->date('install_date');
            $table->string('condition_status', 1024)->nullable()->default('good');
            $table->text('remarks')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
        });

        Schema::hasTable('asset_maintenance_logs') || Schema::create('asset_maintenance_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('asset_id');
            $table->date('maintenance_date');
            $table->text('vendor')->nullable();
            $table->decimal('cost', 20, 4)->default(0);
            $table->integer('downtime_days')->default(0);
            $table->string('status', 1024)->nullable()->default('completed');
            $table->text('remarks')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
        });

        Schema::hasTable('asset_maintenance_schedules') || Schema::create('asset_maintenance_schedules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('asset_id');
            $table->text('title');
            $table->integer('frequency_days');
            $table->date('next_due_at');
            $table->text('vendor')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('active')->default(true);
            $table->timestampTz('last_generated_alert_at')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('asset_movements') || Schema::create('asset_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('asset_id');
            $table->uuid('from_location_id')->nullable();
            $table->uuid('to_location_id')->nullable();
            $table->decimal('quantity', 20, 4)->default(1);
            $table->uuid('moved_by')->nullable();
            $table->date('movement_date');
            $table->text('remarks')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
            $table->string('approval_status', 1024)->default('pending');
            $table->uuid('requested_by')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->boolean('applied')->default(false);
        });

        Schema::hasTable('asset_purchases') || Schema::create('asset_purchases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('asset_id');
            $table->date('purchase_date');
            $table->decimal('quantity', 20, 4)->default(1);
            $table->decimal('unit_price', 20, 4)->default(0);
            $table->decimal('total_amount', 20, 4)->default(0);
            $table->text('supplier')->nullable();
            $table->text('invoice_no')->nullable();
            $table->string('payment_method', 1024)->nullable()->default('cash');
            $table->uuid('journal_entry_id')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
        });

        Schema::hasTable('asset_scan_logs') || Schema::create('asset_scan_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->timestampTz('scanned_at')->useCurrent();
            $table->uuid('scanned_by')->nullable();
            $table->uuid('office_id')->nullable();
            $table->text('scanned_text');
            $table->uuid('asset_id')->nullable();
            $table->text('asset_code')->nullable();
            $table->boolean('success')->default(false);
            $table->text('error_message')->nullable();
            $table->string('source', 1024)->default('camera');
        });

        Schema::hasTable('asset_stocks') || Schema::create('asset_stocks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('asset_id');
            $table->uuid('location_id')->nullable();
            $table->decimal('quantity', 20, 4)->default(0);
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('background_retry_jobs') || Schema::create('background_retry_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->text('job_type');
            $table->uuid('reference_id')->nullable();
            $table->json('payload');
            $table->string('status', 1024)->default('pending');
            $table->integer('retry_count')->default(0);
            $table->integer('max_retry')->default(4);
            $table->timestampTz('next_retry_at')->useCurrent();
            $table->text('last_error')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('bank_accounts') || Schema::create('bank_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->text('bank_name');
            $table->text('branch')->nullable();
            $table->text('account_no');
            $table->text('account_title')->nullable();
            $table->string('account_type', 1024)->nullable()->default('savings');
            $table->decimal('opening_balance', 20, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->string('stream', 1024)->default('other');
        });

        Schema::hasTable('bank_transactions') || Schema::create('bank_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('bank_account_id');
            $table->date('txn_date');
            $table->text('txn_type');
            $table->decimal('amount', 20, 4);
            $table->text('reference_no')->nullable();
            $table->uuid('counterparty_account_id')->nullable();
            $table->uuid('transfer_group')->nullable();
            $table->text('note')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->uuid('link_id')->nullable();
        });

        Schema::hasTable('card_settings') || Schema::create('card_settings', function (Blueprint $table) {
            $table->integer('id')->default(1);
            $table->string('template_id', 1024)->default('classic');
            $table->string('accent_color', 1024)->default('#107a57');
            $table->string('header_text', 1024)->default('');
            $table->string('header_text_bn', 1024)->default('');
            $table->boolean('show_photo')->default(true);
            $table->boolean('show_account_number')->default(true);
            $table->boolean('show_voter_number')->default(true);
            $table->boolean('show_issue_date')->default(true);
            $table->boolean('show_qr')->default(true);
            $table->decimal('photo_size_mm', 20, 4)->default(18);
            $table->decimal('font_scale', 20, 4)->default(1.0);
            $table->timestampTz('updated_at')->useCurrent();
            $table->uuid('updated_by')->nullable();
            $table->decimal('header_height_mm', 20, 4)->default(8);
            $table->decimal('logo_size_mm', 20, 4)->default(6);
            $table->string('custom_text', 1024)->default('');
            $table->string('custom_text_bn', 1024)->default('');
        });

        Schema::hasTable('cashbook_expense_heads') || Schema::create('cashbook_expense_heads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->text('stream');
            $table->text('name_bn');
            $table->text('name_en')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('cashbook_submissions') || Schema::create('cashbook_submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->integer('year');
            $table->integer('month');
            $table->decimal('opening_cash', 20, 4)->default(0);
            $table->decimal('closing_cash', 20, 4)->default(0);
            $table->decimal('total_income', 20, 4)->default(0);
            $table->decimal('total_expense', 20, 4)->default(0);
            $table->text('note')->nullable();
            $table->uuid('submitted_by')->nullable();
            $table->timestampTz('submitted_at')->useCurrent();
            $table->boolean('locked')->default(true);
            $table->timestampTz('created_at')->useCurrent();
            $table->string('stream', 1024)->default('all');
        });

        Schema::hasTable('cashbook_voucher_seq') || Schema::create('cashbook_voucher_seq', function (Blueprint $table) {
            $table->uuid('office_id');
            $table->text('stream');
            $table->integer('last_no')->default(0);
        });

        Schema::hasTable('company_settings') || Schema::create('company_settings', function (Blueprint $table) {
            $table->integer('id')->default(1);
            $table->string('company_name', 1024)->default('Smart Irrigation Cooperative');
            $table->text('company_name_bn')->nullable();
            $table->text('logo_url')->nullable();
            $table->text('email')->nullable();
            $table->text('mobile')->nullable();
            $table->text('address')->nullable();
            $table->decimal('default_loan_interest', 20, 4)->default(0);
            $table->timestampTz('updated_at')->useCurrent();
            $table->string('penalty_type', 1024)->default('flat');
            $table->decimal('penalty_value', 20, 4)->default(0);
            $table->integer('penalty_grace_days')->default(30);
            $table->integer('fiscal_year_start_month')->default(7);
            $table->string('pdf_footer_text', 1024)->nullable()->default('If found, please return to the issuing office.');
            $table->boolean('pdf_footer_show_address')->default(true);
            $table->boolean('pdf_footer_show_contact')->default(true);
            $table->string('loan_receipt_header_en', 1024)->nullable()->default('');
            $table->string('loan_receipt_header_bn', 1024)->nullable()->default('');
            $table->string('loan_receipt_footer_en', 1024)->nullable()->default('');
            $table->string('loan_receipt_footer_bn', 1024)->nullable()->default('');
            $table->string('loan_receipt_no_format', 1024)->nullable()->default('LOAN-{YYYYMMDD}-{TAIL}');
            $table->text('registration_no')->nullable();
            $table->text('editor_signature_url')->nullable();
        });

        Schema::hasTable('demo_operations_log') || Schema::create('demo_operations_log', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->text('user_email')->nullable();
            $table->text('action');
            $table->json('modules');
            $table->integer('size')->nullable();
            $table->text('ip')->nullable();
            $table->text('user_agent')->nullable();
            $table->boolean('success')->default(true);
            $table->text('error_message')->nullable();
            $table->json('summary')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('developer_update_logs') || Schema::create('developer_update_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('action');
            $table->text('repo_url');
            $table->text('commit_sha')->nullable();
            $table->text('commit_message')->nullable();
            $table->text('release_tag')->nullable();
            $table->text('note')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->text('status')->nullable();
        });

        Schema::hasTable('expenses') || Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('expense_date');
            $table->text('head');
            $table->text('payee')->nullable();
            $table->decimal('amount', 20, 4);
            $table->string('method', 1024)->nullable()->default('cash');
            $table->text('note')->nullable();
            $table->uuid('office_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
            $table->string('stream', 1024)->default('savings');
            $table->text('voucher_no')->nullable();
            $table->text('attachment_path')->nullable();
            $table->text('attachment_mime')->nullable();
            $table->uuid('bank_account_id')->nullable();
            $table->boolean('is_bank_deposit')->default(false);
            $table->uuid('head_id')->nullable();
            $table->uuid('link_id')->nullable();
        });

        Schema::hasTable('farmer_login_attempts') || Schema::create('farmer_login_attempts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('identifier');
            $table->uuid('farmer_id')->nullable();
            $table->uuid('office_id')->nullable();
            $table->boolean('success')->default(false);
            $table->text('error_reason')->nullable();
            $table->text('ip')->nullable();
            $table->text('user_agent')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('farmer_portal_sessions') || Schema::create('farmer_portal_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('farmer_id');
            $table->text('token_hash');
            $table->timestampTz('expires_at');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('last_used_at')->nullable();
            $table->text('ip')->nullable();
            $table->text('user_agent')->nullable();
        });

        Schema::hasTable('farmer_rejections') || Schema::create('farmer_rejections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->timestampTz('created_at')->useCurrent();
            $table->uuid('user_id')->nullable();
            $table->uuid('office_id')->nullable();
            $table->uuid('farmer_id')->nullable();
            $table->text('operation');
            $table->text('failed_level');
            $table->text('reason');
            $table->json('attempted');
            $table->text('error_message');
        });

        Schema::hasTable('farmer_savings_plans') || Schema::create('farmer_savings_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('farmer_id');
            $table->uuid('plan_id');
            $table->date('start_date');
            $table->decimal('expected_total', 20, 4)->default(0);
            $table->decimal('expected_interest', 20, 4)->default(0);
            $table->decimal('maturity_amount', 20, 4)->default(0);
            $table->string('status', 1024)->default('pending');
            $table->uuid('office_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->uuid('approved_by')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->text('cancel_reason')->nullable();
        });

        Schema::hasTable('hand_cash_submissions') || Schema::create('hand_cash_submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->integer('year');
            $table->integer('month');
            $table->decimal('opening_cash', 20, 4)->default(0);
            $table->decimal('total_income', 20, 4)->default(0);
            $table->decimal('total_expense', 20, 4)->default(0);
            $table->decimal('closing_cash', 20, 4)->default(0);
            $table->boolean('locked')->default(false);
            $table->uuid('submitted_by')->nullable();
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('import_audit_logs') || Schema::create('import_audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->uuid('office_id')->nullable();
            $table->text('module');
            $table->string('mode', 1024)->default('insert');
            $table->integer('rows_processed')->default(0);
            $table->integer('rows_inserted')->default(0);
            $table->integer('rows_updated')->default(0);
            $table->integer('rows_failed')->default(0);
            $table->text('error_report_url')->nullable();
            $table->json('summary')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('irrigation_cashbook_export_audit') || Schema::create('irrigation_cashbook_export_audit', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('office_id')->nullable();
            $table->date('date_from');
            $table->date('date_to');
            $table->text('format');
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('irrigation_cashbook_presets') || Schema::create('irrigation_cashbook_presets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('name');
            $table->date('date_from');
            $table->date('date_to');
            $table->string('office_filter', 1024)->default('all');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('irrigation_category_rates') || Schema::create('irrigation_category_rates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('irrigation_season_id');
            $table->uuid('irrigation_category_id');
            $table->string('rate_type', 1024)->default('per_shotok');
            $table->decimal('rate', 20, 4)->default(0);
            $table->text('unit')->nullable();
            $table->boolean('is_negotiable')->default(false);
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('irrigation_charge_settings') || Schema::create('irrigation_charge_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->decimal('delay_fee_percent', 20, 4)->default(0);
            $table->decimal('maintenance_percent', 20, 4)->default(0);
            $table->decimal('canal_percent', 20, 4)->default(0);
            $table->integer('grace_days')->default(0);
            $table->boolean('auto_apply_delay_fee')->default(true);
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('irrigation_charges') || Schema::create('irrigation_charges', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('farmer_id');
            $table->uuid('land_id');
            $table->uuid('season_id');
            $table->string('basis', 1024)->default('per_size');
            $table->decimal('quantity', 20, 4)->default(0);
            $table->decimal('base_charge', 20, 4)->default(0);
            $table->decimal('canal_charge', 20, 4)->default(0);
            $table->decimal('maintenance_charge', 20, 4)->default(0);
            $table->decimal('other_charge', 20, 4)->default(0);
            $table->decimal('total', 20, 4)->default(0);
            $table->decimal('paid_amount', 20, 4)->default(0);
            $table->decimal('due_amount', 20, 4)->default(0);
            $table->date('entry_date');
            $table->text('note')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->uuid('office_id')->nullable();
            $table->decimal('previous_due_brought', 20, 4)->default(0);
            $table->decimal('penalty_amount', 20, 4)->default(0);
            $table->timestampTz('deleted_at')->nullable();
            $table->uuid('patwari_id')->nullable();
        });

        Schema::hasTable('irrigation_delay_fee_audit') || Schema::create('irrigation_delay_fee_audit', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('invoice_id');
            $table->uuid('payment_id')->nullable();
            $table->decimal('original_amount', 20, 4)->default(0);
            $table->decimal('modified_amount', 20, 4)->default(0);
            $table->text('reason')->nullable();
            $table->uuid('changed_by')->nullable();
            $table->uuid('office_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('irrigation_due_promises') || Schema::create('irrigation_due_promises', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('farmer_id');
            $table->uuid('payment_id')->nullable();
            $table->decimal('previous_due_amount', 20, 4)->default(0);
            $table->date('promise_date');
            $table->text('remarks')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->string('status', 1024)->default('pending');
            $table->timestampTz('fulfilled_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('irrigation_invoice_audit') || Schema::create('irrigation_invoice_audit', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('invoice_id');
            $table->text('action');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->text('note')->nullable();
            $table->uuid('user_id')->nullable();
            $table->uuid('office_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('irrigation_partial_payment_settings') || Schema::create('irrigation_partial_payment_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->json('allowed_roles');
            $table->uuid('updated_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('irrigation_rate_audit_logs') || Schema::create('irrigation_rate_audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('irrigation_season_id')->nullable();
            $table->uuid('land_type_id')->nullable();
            $table->decimal('old_rate', 20, 4)->nullable();
            $table->decimal('new_rate', 20, 4)->nullable();
            $table->text('change_reason')->nullable();
            $table->uuid('changed_by')->nullable();
            $table->timestampTz('changed_at')->useCurrent();
            $table->text('ip')->nullable();
            $table->string('action', 1024)->default('update');
        });

        Schema::hasTable('irrigation_rate_overrides') || Schema::create('irrigation_rate_overrides', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('irrigation_invoice_id');
            $table->decimal('original_rate', 20, 4)->default(0);
            $table->decimal('overridden_rate', 20, 4)->default(0);
            $table->text('override_reason')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('irrigation_season_rates') || Schema::create('irrigation_season_rates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('irrigation_season_id');
            $table->uuid('land_type_id');
            $table->decimal('rate_per_shotok', 20, 4)->default(0);
            $table->uuid('office_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->string('calculation_basis', 1024)->default('per_shotok');
        });

        Schema::hasTable('irrigation_season_types') || Schema::create('irrigation_season_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('code');
            $table->text('name');
            $table->text('name_bn')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->uuid('office_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->text('name_en')->nullable();
            $table->timestampTz('deleted_at')->nullable();
        });

        Schema::hasTable('irrigation_sms_logs') || Schema::create('irrigation_sms_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('irrigation_invoice_id')->nullable();
            $table->uuid('farmer_id')->nullable();
            $table->text('mobile')->nullable();
            $table->text('sms_type');
            $table->text('message')->nullable();
            $table->string('status', 1024)->default('pending');
            $table->text('failure_reason')->nullable();
            $table->json('gateway_response')->nullable();
            $table->integer('retry_count')->default(0);
            $table->uuid('sent_by')->nullable();
            $table->timestampTz('sent_at')->nullable();
            $table->timestampTz('delivered_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('journal_entry_lines') || Schema::create('journal_entry_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('journal_id');
            $table->uuid('account_id');
            $table->decimal('debit', 20, 4)->default(0);
            $table->decimal('credit', 20, 4)->default(0);
            $table->text('description')->nullable();
            $table->integer('position')->default(0);
        });

        Schema::hasTable('land_change_log') || Schema::create('land_change_log', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('land_id')->nullable();
            $table->uuid('farmer_id')->nullable();
            $table->uuid('office_id')->nullable();
            $table->text('change_type');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->text('remarks')->nullable();
            $table->uuid('changed_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('land_history') || Schema::create('land_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('land_id')->nullable();
            $table->uuid('farmer_id');
            $table->integer('fiscal_year');
            $table->text('season')->nullable();
            $table->text('mouza')->nullable();
            $table->text('dag_no')->nullable();
            $table->decimal('land_size', 20, 4);
            $table->text('owner_type')->nullable();
            $table->text('field_type')->nullable();
            $table->uuid('cultivator_farmer_id')->nullable();
            $table->text('remarks')->nullable();
            $table->uuid('recorded_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->text('crop')->nullable();
            $table->decimal('yield_amount', 20, 4)->nullable();
            $table->text('yield_unit')->nullable();
        });

        Schema::hasTable('land_note_attachments') || Schema::create('land_note_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('land_id');
            $table->uuid('office_id')->nullable();
            $table->text('file_path');
            $table->text('file_name');
            $table->text('content_type')->nullable();
            $table->bigInteger('size_bytes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('land_note_audit') || Schema::create('land_note_audit', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('land_id');
            $table->uuid('office_id')->nullable();
            $table->text('old_note')->nullable();
            $table->text('new_note')->nullable();
            $table->uuid('changed_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('land_relations') || Schema::create('land_relations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('land_id');
            $table->uuid('owner_farmer_id');
            $table->uuid('sharecropper_farmer_id')->nullable();
            $table->decimal('share_percentage', 20, 4)->default(50);
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->text('note')->nullable();
            $table->uuid('office_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
            $table->decimal('area_decimal', 20, 4)->nullable();
        });

        Schema::hasTable('land_transfer_integrity_runs') || Schema::create('land_transfer_integrity_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('run_type', 1024)->default('manual');
            $table->string('status', 1024)->default('completed');
            $table->uuid('office_id')->nullable();
            $table->date('date_from')->nullable();
            $table->date('date_to')->nullable();
            $table->integer('total_transfers')->default(0);
            $table->integer('error_count')->default(0);
            $table->integer('warning_count')->default(0);
            $table->json('summary')->nullable();
            $table->json('violations')->nullable();
            $table->text('error_message')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('land_transfer_recipients') || Schema::create('land_transfer_recipients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('transfer_id');
            $table->uuid('recipient_farmer_id');
            $table->uuid('new_land_id')->nullable();
            $table->decimal('area_decimal', 20, 4);
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('land_transfers') || Schema::create('land_transfers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('source_land_id');
            $table->uuid('source_farmer_id');
            $table->text('transfer_type');
            $table->text('remark')->nullable();
            $table->uuid('office_id')->nullable();
            $table->date('transferred_at');
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->text('source_dag_no')->nullable();
            $table->text('source_mouza')->nullable();
            $table->decimal('source_land_size', 20, 4)->nullable();
            $table->text('source_owner_name')->nullable();
            $table->text('source_owner_code')->nullable();
        });

        Schema::hasTable('ledger_entries') || Schema::create('ledger_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('entry_date');
            $table->uuid('account_id');
            $table->decimal('debit', 20, 4)->default(0);
            $table->decimal('credit', 20, 4)->default(0);
            $table->text('reference_type')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->text('description')->nullable();
            $table->uuid('office_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('loan_delay_fee_settings') || Schema::create('loan_delay_fee_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->string('mode', 1024)->default('flat');
            $table->decimal('value', 20, 4)->default(0);
            $table->integer('grace_days')->default(0);
            $table->boolean('auto_apply')->default(true);
            $table->boolean('allow_partial_installment')->default(false);
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->decimal('daily_penalty', 20, 4)->default(0);
            $table->decimal('max_penalty', 20, 4)->nullable();
            $table->string('enforcement_mode', 1024)->default('block');
        });

        Schema::hasTable('loan_discount_audit') || Schema::create('loan_discount_audit', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('loan_id');
            $table->uuid('payment_id')->nullable();
            $table->text('receipt_no')->nullable();
            $table->uuid('office_id')->nullable();
            $table->uuid('changed_by')->nullable();
            $table->decimal('interest_before', 20, 4)->default(0);
            $table->decimal('interest_after', 20, 4)->default(0);
            $table->decimal('discount_before', 20, 4)->default(0);
            $table->decimal('discount_after', 20, 4)->default(0);
            $table->text('note')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('loan_guarantors') || Schema::create('loan_guarantors', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('loan_id');
            $table->uuid('farmer_id')->nullable();
            $table->text('name');
            $table->text('father_name')->nullable();
            $table->text('village')->nullable();
            $table->text('mobile')->nullable();
            $table->text('nid')->nullable();
            $table->uuid('office_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->string('role', 1024)->default('guarantor');
        });

        Schema::hasTable('loan_installment_delay_audit') || Schema::create('loan_installment_delay_audit', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('installment_id');
            $table->uuid('loan_id');
            $table->uuid('payment_id')->nullable();
            $table->decimal('original_amount', 20, 4)->default(0);
            $table->decimal('modified_amount', 20, 4)->default(0);
            $table->text('reason')->nullable();
            $table->uuid('changed_by')->nullable();
            $table->uuid('office_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('loan_installments') || Schema::create('loan_installments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('loan_id');
            $table->integer('installment_no');
            $table->date('due_date');
            $table->decimal('amount', 20, 4)->default(0);
            $table->decimal('paid_amount', 20, 4)->default(0);
            $table->decimal('penalty_amount', 20, 4)->default(0);
            $table->string('status', 1024)->default('due');
            $table->date('paid_on')->nullable();
            $table->uuid('office_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->integer('overdue_days')->default(0);
            $table->json('penalty_rule_snapshot')->nullable();
            $table->boolean('strict_validation_override')->default(false);
        });

        Schema::hasTable('loan_payments') || Schema::create('loan_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('loan_id');
            $table->decimal('amount', 20, 4);
            $table->date('paid_on');
            $table->uuid('collected_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->uuid('office_id')->nullable();
            $table->string('status', 1024)->default('approved');
            $table->uuid('approved_by')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->text('approval_note')->nullable();
            $table->text('note')->nullable();
            $table->decimal('penalty_collected', 20, 4)->default(0);
            $table->text('override_reason')->nullable();
            $table->uuid('override_by')->nullable();
            $table->text('receipt_no')->nullable();
            $table->decimal('principal_amount', 20, 4)->nullable();
            $table->decimal('interest_amount', 20, 4)->nullable();
            $table->decimal('discount_amount', 20, 4)->default(0);
        });

        Schema::hasTable('member_block_audit') || Schema::create('member_block_audit', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('attempted_by')->nullable();
            $table->uuid('office_id')->nullable();
            $table->uuid('farmer_id')->nullable();
            $table->text('transaction_type');
            $table->text('reason');
            $table->text('member_no')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('notifications') || Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->text('kind');
            $table->text('title');
            $table->text('body')->nullable();
            $table->text('link')->nullable();
            $table->boolean('read')->default(false);
            $table->timestampTz('created_at')->useCurrent();
            $table->boolean('archived')->default(false);
        });

        Schema::hasTable('office_incomes') || Schema::create('office_incomes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->text('receipt_no');
            $table->string('income_type', 1024)->default('other');
            $table->text('payer_name');
            $table->decimal('amount', 20, 4)->default(0);
            $table->date('received_on');
            $table->string('stream', 1024)->default('sech');
            $table->text('note')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->text('father_name')->nullable();
            $table->text('village')->nullable();
            $table->text('mobile')->nullable();
        });

        Schema::hasTable('permission_audit_logs') || Schema::create('permission_audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('changed_by')->nullable();
            $table->text('role')->nullable();
            $table->uuid('target_user_id')->nullable();
            $table->text('module');
            $table->text('action');
            $table->boolean('old_value')->nullable();
            $table->boolean('new_value')->nullable();
            $table->text('reason')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('profiles') || Schema::create('profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('full_name')->nullable();
            $table->text('email')->nullable();
            $table->uuid('office_id')->nullable();
            $table->string('language_pref', 1024)->default('en');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->text('username')->nullable();
            $table->json('receipt_options')->nullable();
        });

        Schema::hasTable('public_payment_intents') || Schema::create('public_payment_intents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('farmer_code');
            $table->text('phone')->nullable();
            $table->decimal('amount', 20, 4);
            $table->text('allocation_hint')->nullable();
            $table->text('note')->nullable();
            $table->string('status', 1024)->default('pending');
            $table->uuid('processed_by')->nullable();
            $table->timestampTz('processed_at')->nullable();
            $table->uuid('payment_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->uuid('office_id')->nullable();
        });

        Schema::hasTable('qr_rotation_settings') || Schema::create('qr_rotation_settings', function (Blueprint $table) {
            $table->integer('id')->default(1);
            $table->boolean('enabled')->default(false);
            $table->integer('interval_days')->default(90);
            $table->integer('grace_hours')->default(24);
            $table->timestampTz('last_run_at')->nullable();
            $table->json('last_run_summary')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('receipt_counters') || Schema::create('receipt_counters', function (Blueprint $table) {
            $table->text('kind');
            $table->integer('year');
            $table->bigInteger('last_no')->default(0);
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('receipt_no_pool') || Schema::create('receipt_no_pool', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->text('receipt_no');
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('receipt_sequences') || Schema::create('receipt_sequences', function (Blueprint $table) {
            $table->uuid('office_id');
            $table->text('kind');
            $table->integer('year');
            $table->integer('month');
            $table->integer('last_no')->default(0);
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('receipt_settings') || Schema::create('receipt_settings', function (Blueprint $table) {
            $table->integer('id')->default(1);
            $table->string('language', 1024)->default('en');
            $table->string('paper_size', 1024)->default('a5');
            $table->string('accent_color', 1024)->default('#1f4e79');
            $table->boolean('show_logo')->default(true);
            $table->boolean('show_signature_line')->default(true);
            $table->boolean('show_office')->default(true);
            $table->boolean('show_token_block')->default(true);
            $table->string('header_alignment', 1024)->default('center');
            $table->string('footer_note', 1024)->default('This is a system-generated receipt. Please retain for your records.');
            $table->string('footer_note_bn', 1024)->default('এটি সিস্টেম-জেনারেটেড রসিদ। অনুগ্রহ করে আপনার রেকর্ডের জন্য সংরক্ষণ করুন।');
            $table->timestampTz('updated_at')->useCurrent();
            $table->uuid('updated_by')->nullable();
            $table->boolean('show_watermark')->default(false);
            $table->string('watermark_text', 1024)->default('');
            $table->boolean('show_penalty_row')->default(true);
            $table->boolean('show_charge_row')->default(true);
            $table->string('qr_placement', 1024)->default('right');
        });

        Schema::hasTable('receipts') || Schema::create('receipts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('receipt_no')->nullable();
            $table->text('kind');
            $table->uuid('farmer_id')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->decimal('amount', 20, 4);
            $table->string('method', 1024)->nullable()->default('cash');
            $table->text('note')->nullable();
            $table->date('receipt_date');
            $table->uuid('office_id')->nullable();
            $table->uuid('collected_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->uuid('link_id')->nullable();
            $table->timestampTz('voided_at')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->text('void_reason')->nullable();
        });

        Schema::hasTable('savings_plans') || Schema::create('savings_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('name');
            $table->text('name_bn')->nullable();
            $table->integer('duration_months');
            $table->string('installment_type', 1024)->default('monthly');
            $table->decimal('installment_amount', 20, 4)->default(0);
            $table->decimal('interest_rate', 20, 4)->default(0);
            $table->string('maturity_type', 1024)->default('simple');
            $table->boolean('is_active')->default(true);
            $table->uuid('office_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('savings_yearly_opening') || Schema::create('savings_yearly_opening', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('farmer_id');
            $table->integer('year');
            $table->decimal('opening_balance', 20, 4)->default(0);
            $table->uuid('office_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('shares') || Schema::create('shares', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('farmer_id');
            $table->decimal('balance', 20, 4)->default(0);
            $table->timestampTz('updated_at')->useCurrent();
            $table->uuid('office_id')->nullable();
        });

        Schema::hasTable('sms_office_settings') || Schema::create('sms_office_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id');
            $table->boolean('enabled')->default(true);
            $table->text('sender_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::hasTable('sms_provider_secrets') || Schema::create('sms_provider_secrets', function (Blueprint $table) {
            $table->text('provider');
            $table->text('api_token');
            $table->timestampTz('updated_at')->useCurrent();
            $table->uuid('updated_by')->nullable();
            $table->uuid('id')->primary();
            $table->string('status', 1024)->default('staged');
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('activated_at')->nullable();
            $table->text('label')->nullable();
            $table->integer('priority')->default(100);
            $table->text('dlr_url')->nullable();
        });

        Schema::hasTable('sms_settings') || Schema::create('sms_settings', function (Blueprint $table) {
            $table->integer('id')->default(1);
            $table->boolean('enabled')->default(false);
            $table->text('sender_id')->nullable();
            $table->boolean('api_key_set')->default(false);
            $table->boolean('send_on_savings_deposit')->default(true);
            $table->boolean('send_on_savings_withdraw')->default(true);
            $table->boolean('send_on_loan_approved')->default(true);
            $table->boolean('send_on_loan_payment')->default(true);
            $table->boolean('send_on_irrigation_payment')->default(true);
            $table->boolean('send_on_due_reminder')->default(true);
            $table->text('tpl_savings_deposit')->nullable();
            $table->text('tpl_savings_withdraw')->nullable();
            $table->text('tpl_loan_approved')->nullable();
            $table->text('tpl_loan_payment')->nullable();
            $table->text('tpl_irrigation_payment')->nullable();
            $table->text('tpl_due_reminder')->nullable();
            $table->json('config');
            $table->timestampTz('updated_at')->useCurrent();
            $table->string('language', 16)->default('bn');
            $table->integer('reminder_days_before')->default(3);
            $table->text('tpl_savings_deposit_en')->nullable();
            $table->text('tpl_savings_withdraw_en')->nullable();
            $table->text('tpl_loan_approved_en')->nullable();
            $table->text('tpl_loan_payment_en')->nullable();
            $table->text('tpl_irrigation_payment_en')->nullable();
            $table->text('tpl_due_reminder_en')->nullable();
            $table->boolean('send_on_qr_rotate')->default(true);
            $table->boolean('send_on_qr_revoke')->default(true);
            $table->text('tpl_qr_rotate')->nullable();
            $table->text('tpl_qr_revoke')->nullable();
            $table->text('tpl_qr_rotate_en')->nullable();
            $table->text('tpl_qr_revoke_en')->nullable();
        });

        Schema::hasTable('sms_templates') || Schema::create('sms_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('key');
            $table->text('name');
            $table->text('body');
            $table->json('variables')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->text('preferred_provider')->nullable();
        });

        Schema::hasTable('system_audit_logs') || Schema::create('system_audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->uuid('user_id')->nullable();
            $table->text('module');
            $table->text('action_type');
            $table->uuid('reference_id')->nullable();
            $table->json('old_data')->nullable();
            $table->json('new_data')->nullable();
            $table->text('ip')->nullable();
            $table->text('user_agent')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::hasTable('user_permissions') || Schema::create('user_permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('module');
            $table->boolean('can_view')->default(true);
            $table->boolean('can_add')->default(false);
            $table->boolean('can_edit')->default(false);
            $table->boolean('can_delete')->default(false);
        });

        Schema::hasTable('voter_audit_logs') || Schema::create('voter_audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('farmer_id');
            $table->text('account_number')->nullable();
            $table->text('voter_number_old')->nullable();
            $table->text('voter_number_new')->nullable();
            $table->boolean('is_voter_old')->nullable();
            $table->boolean('is_voter_new')->nullable();
            $table->uuid('changed_by')->nullable();
            $table->uuid('office_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->text('note')->nullable();
            $table->text('action')->nullable();
        });

        Schema::hasTable('voucher_sequences') || Schema::create('voucher_sequences', function (Blueprint $table) {
            $table->uuid('office_id');
            $table->text('voucher_type');
            $table->integer('fiscal_year');
            $table->integer('last_no')->default(0);
        });

        Schema::hasTable('vouchers') || Schema::create('vouchers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('office_id')->nullable();
            $table->text('voucher_no');
            $table->text('voucher_type');
            $table->date('voucher_date');
            $table->decimal('amount', 20, 4)->default(0);
            $table->text('payee')->nullable();
            $table->text('narration')->nullable();
            $table->text('attachment_path')->nullable();
            $table->text('attachment_mime')->nullable();
            $table->text('reference_type')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vouchers');
        Schema::dropIfExists('voucher_sequences');
        Schema::dropIfExists('voter_audit_logs');
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('system_audit_logs');
        Schema::dropIfExists('sms_templates');
        Schema::dropIfExists('sms_settings');
        Schema::dropIfExists('sms_provider_secrets');
        Schema::dropIfExists('sms_office_settings');
        Schema::dropIfExists('shares');
        Schema::dropIfExists('savings_yearly_opening');
        Schema::dropIfExists('savings_plans');
        Schema::dropIfExists('receipts');
        Schema::dropIfExists('receipt_settings');
        Schema::dropIfExists('receipt_sequences');
        Schema::dropIfExists('receipt_no_pool');
        Schema::dropIfExists('receipt_counters');
        Schema::dropIfExists('qr_rotation_settings');
        Schema::dropIfExists('public_payment_intents');
        Schema::dropIfExists('profiles');
        Schema::dropIfExists('permission_audit_logs');
        Schema::dropIfExists('office_incomes');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('member_block_audit');
        Schema::dropIfExists('loan_payments');
        Schema::dropIfExists('loan_installments');
        Schema::dropIfExists('loan_installment_delay_audit');
        Schema::dropIfExists('loan_guarantors');
        Schema::dropIfExists('loan_discount_audit');
        Schema::dropIfExists('loan_delay_fee_settings');
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('land_transfers');
        Schema::dropIfExists('land_transfer_recipients');
        Schema::dropIfExists('land_transfer_integrity_runs');
        Schema::dropIfExists('land_relations');
        Schema::dropIfExists('land_note_audit');
        Schema::dropIfExists('land_note_attachments');
        Schema::dropIfExists('land_history');
        Schema::dropIfExists('land_change_log');
        Schema::dropIfExists('journal_entry_lines');
        Schema::dropIfExists('irrigation_sms_logs');
        Schema::dropIfExists('irrigation_season_types');
        Schema::dropIfExists('irrigation_season_rates');
        Schema::dropIfExists('irrigation_rate_overrides');
        Schema::dropIfExists('irrigation_rate_audit_logs');
        Schema::dropIfExists('irrigation_partial_payment_settings');
        Schema::dropIfExists('irrigation_invoice_audit');
        Schema::dropIfExists('irrigation_due_promises');
        Schema::dropIfExists('irrigation_delay_fee_audit');
        Schema::dropIfExists('irrigation_charges');
        Schema::dropIfExists('irrigation_charge_settings');
        Schema::dropIfExists('irrigation_category_rates');
        Schema::dropIfExists('irrigation_cashbook_presets');
        Schema::dropIfExists('irrigation_cashbook_export_audit');
        Schema::dropIfExists('import_audit_logs');
        Schema::dropIfExists('hand_cash_submissions');
        Schema::dropIfExists('farmer_savings_plans');
        Schema::dropIfExists('farmer_rejections');
        Schema::dropIfExists('farmer_portal_sessions');
        Schema::dropIfExists('farmer_login_attempts');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('developer_update_logs');
        Schema::dropIfExists('demo_operations_log');
        Schema::dropIfExists('company_settings');
        Schema::dropIfExists('cashbook_voucher_seq');
        Schema::dropIfExists('cashbook_submissions');
        Schema::dropIfExists('cashbook_expense_heads');
        Schema::dropIfExists('card_settings');
        Schema::dropIfExists('bank_transactions');
        Schema::dropIfExists('bank_accounts');
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
        Schema::dropIfExists('asset_categories');
        Schema::dropIfExists('asset_audit_logs');
        Schema::dropIfExists('asset_alerts');
        Schema::dropIfExists('accounting_periods');
    }
};
