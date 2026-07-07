<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

/**
 * Comprehensive schema reconciliation: ensures every canonical table
 * and column exists on the deployed (VPS/MySQL) database. Fully idempotent.
 * Auto-generated from the canonical schema.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ---- accounting_periods ----
        if (! Schema::hasTable('accounting_periods')) {
            Schema::create('accounting_periods', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->date('period_start');
                $table->date('period_end');
                $table->text('status');
                $table->timestamp('closed_at')->nullable();
                $table->char('closed_by', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->decimal('total_debit', 20, 4);
                $table->decimal('total_credit', 20, 4);
                $table->decimal('total_income', 20, 4);
                $table->decimal('total_expense', 20, 4);
                $table->decimal('net_income', 20, 4);
                $table->decimal('cash_in', 20, 4);
                $table->decimal('cash_out', 20, 4);
                $table->json('closing_balance_snapshot')->nullable();
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('accounting_periods', function (Blueprint $table) {
                if (! Schema::hasColumn('accounting_periods', 'period_start')) {
                    $table->date('period_start')->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'period_end')) {
                    $table->date('period_end')->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'closed_at')) {
                    $table->timestamp('closed_at')->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'closed_by')) {
                    $table->char('closed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'total_debit')) {
                    $table->decimal('total_debit', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'total_credit')) {
                    $table->decimal('total_credit', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'total_income')) {
                    $table->decimal('total_income', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'total_expense')) {
                    $table->decimal('total_expense', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'net_income')) {
                    $table->decimal('net_income', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'cash_in')) {
                    $table->decimal('cash_in', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'cash_out')) {
                    $table->decimal('cash_out', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'closing_balance_snapshot')) {
                    $table->json('closing_balance_snapshot')->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('accounting_periods', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- accounts ----
        if (! Schema::hasTable('accounts')) {
            Schema::create('accounts', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('code');
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->text('type');
                $table->char('parent_id', 36)->nullable();
                $table->boolean('is_system');
                $table->boolean('is_active');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('accounts', function (Blueprint $table) {
                if (! Schema::hasColumn('accounts', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('accounts', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('accounts', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('accounts', 'type')) {
                    $table->text('type')->nullable();
                }
                if (! Schema::hasColumn('accounts', 'parent_id')) {
                    $table->char('parent_id', 36)->nullable();
                }
                if (! Schema::hasColumn('accounts', 'is_system')) {
                    $table->boolean('is_system')->nullable();
                }
                if (! Schema::hasColumn('accounts', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('accounts', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('accounts', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- asset_alerts ----
        if (! Schema::hasTable('asset_alerts')) {
            Schema::create('asset_alerts', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_id', 36);
                $table->char('location_id', 36)->nullable();
                $table->text('alert_type');
                $table->text('severity');
                $table->text('message_en');
                $table->text('message_bn')->nullable();
                $table->json('details')->nullable();
                $table->text('status');
                $table->integer('sms_sent_count');
                $table->timestamp('last_sms_at')->nullable();
                $table->char('acknowledged_by', 36)->nullable();
                $table->timestamp('acknowledged_at')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('asset_alerts', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_alerts', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'location_id')) {
                    $table->char('location_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'alert_type')) {
                    $table->text('alert_type')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'severity')) {
                    $table->text('severity')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'message_en')) {
                    $table->text('message_en')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'message_bn')) {
                    $table->text('message_bn')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'details')) {
                    $table->json('details')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'sms_sent_count')) {
                    $table->integer('sms_sent_count')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'last_sms_at')) {
                    $table->timestamp('last_sms_at')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'acknowledged_by')) {
                    $table->char('acknowledged_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'acknowledged_at')) {
                    $table->timestamp('acknowledged_at')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'resolved_at')) {
                    $table->timestamp('resolved_at')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_alerts', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- asset_audit_logs ----
        if (! Schema::hasTable('asset_audit_logs')) {
            Schema::create('asset_audit_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('user_id', 36)->nullable();
                $table->char('asset_id', 36)->nullable();
                $table->text('entity');
                $table->char('entity_id', 36)->nullable();
                $table->text('action_type');
                $table->json('old_data')->nullable();
                $table->json('new_data')->nullable();
                $table->text('remarks')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('asset_audit_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_audit_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_audit_logs', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_audit_logs', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_audit_logs', 'entity')) {
                    $table->text('entity')->nullable();
                }
                if (! Schema::hasColumn('asset_audit_logs', 'entity_id')) {
                    $table->char('entity_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_audit_logs', 'action_type')) {
                    $table->text('action_type')->nullable();
                }
                if (! Schema::hasColumn('asset_audit_logs', 'old_data')) {
                    $table->json('old_data')->nullable();
                }
                if (! Schema::hasColumn('asset_audit_logs', 'new_data')) {
                    $table->json('new_data')->nullable();
                }
                if (! Schema::hasColumn('asset_audit_logs', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('asset_audit_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- asset_categories ----
        if (! Schema::hasTable('asset_categories')) {
            Schema::create('asset_categories', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->text('name_bn')->nullable();
                $table->text('name_en');
                $table->text('code');
                $table->text('tracking_mode');
                $table->boolean('is_active');
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
            });
        } else {
            Schema::table('asset_categories', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_categories', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_categories', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('asset_categories', 'name_en')) {
                    $table->text('name_en')->nullable();
                }
                if (! Schema::hasColumn('asset_categories', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('asset_categories', 'tracking_mode')) {
                    $table->text('tracking_mode')->nullable();
                }
                if (! Schema::hasColumn('asset_categories', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('asset_categories', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_categories', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_categories', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('asset_categories', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
            });
        }
        // ---- asset_damage_reports ----
        if (! Schema::hasTable('asset_damage_reports')) {
            Schema::create('asset_damage_reports', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_id', 36);
                $table->date('report_date');
                $table->text('severity')->nullable();
                $table->char('reported_by', 36)->nullable();
                $table->text('status')->nullable();
                $table->text('remarks')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
            });
        } else {
            Schema::table('asset_damage_reports', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_damage_reports', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_damage_reports', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_damage_reports', 'report_date')) {
                    $table->date('report_date')->nullable();
                }
                if (! Schema::hasColumn('asset_damage_reports', 'severity')) {
                    $table->text('severity')->nullable();
                }
                if (! Schema::hasColumn('asset_damage_reports', 'reported_by')) {
                    $table->char('reported_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_damage_reports', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('asset_damage_reports', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('asset_damage_reports', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_damage_reports', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
            });
        }
        // ---- asset_depreciation_schedule ----
        if (! Schema::hasTable('asset_depreciation_schedule')) {
            Schema::create('asset_depreciation_schedule', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('asset_id', 36);
                $table->char('office_id', 36)->nullable();
                $table->date('period_month');
                $table->decimal('opening_book_value', 20, 4);
                $table->decimal('depreciation_amount', 20, 4);
                $table->decimal('accumulated_depreciation', 20, 4);
                $table->decimal('closing_book_value', 20, 4);
                $table->text('status');
                $table->char('journal_entry_id', 36)->nullable();
                $table->timestamp('posted_at')->nullable();
                $table->char('posted_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('asset_depreciation_schedule', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_depreciation_schedule', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'period_month')) {
                    $table->date('period_month')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'opening_book_value')) {
                    $table->decimal('opening_book_value', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'depreciation_amount')) {
                    $table->decimal('depreciation_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'accumulated_depreciation')) {
                    $table->decimal('accumulated_depreciation', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'closing_book_value')) {
                    $table->decimal('closing_book_value', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'journal_entry_id')) {
                    $table->char('journal_entry_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'posted_at')) {
                    $table->timestamp('posted_at')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'posted_by')) {
                    $table->char('posted_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_schedule', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- asset_depreciation_settings ----
        if (! Schema::hasTable('asset_depreciation_settings')) {
            Schema::create('asset_depreciation_settings', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('asset_id', 36);
                $table->char('office_id', 36)->nullable();
                $table->text('method');
                $table->integer('useful_life_months');
                $table->decimal('salvage_value', 20, 4);
                $table->decimal('wdv_rate_pct', 20, 4);
                $table->date('start_on');
                $table->text('expense_account_code');
                $table->text('accum_account_code');
                $table->boolean('is_active');
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('asset_depreciation_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_depreciation_settings', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'method')) {
                    $table->text('method')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'useful_life_months')) {
                    $table->integer('useful_life_months')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'salvage_value')) {
                    $table->decimal('salvage_value', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'wdv_rate_pct')) {
                    $table->decimal('wdv_rate_pct', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'start_on')) {
                    $table->date('start_on')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'expense_account_code')) {
                    $table->text('expense_account_code')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'accum_account_code')) {
                    $table->text('accum_account_code')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_depreciation_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- asset_disposals ----
        if (! Schema::hasTable('asset_disposals')) {
            Schema::create('asset_disposals', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_id', 36);
                $table->date('disposal_date');
                $table->text('method');
                $table->decimal('sale_amount', 20, 4);
                $table->decimal('book_value', 20, 4);
                $table->decimal('gain_loss', 20, 4);
                $table->char('journal_entry_id', 36)->nullable();
                $table->text('remarks')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
            });
        } else {
            Schema::table('asset_disposals', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_disposals', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'disposal_date')) {
                    $table->date('disposal_date')->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'method')) {
                    $table->text('method')->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'sale_amount')) {
                    $table->decimal('sale_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'book_value')) {
                    $table->decimal('book_value', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'gain_loss')) {
                    $table->decimal('gain_loss', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'journal_entry_id')) {
                    $table->char('journal_entry_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_disposals', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
            });
        }
        // ---- asset_installations ----
        if (! Schema::hasTable('asset_installations')) {
            Schema::create('asset_installations', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_id', 36);
                $table->char('location_id', 36)->nullable();
                $table->text('location_name')->nullable();
                $table->char('installed_by', 36)->nullable();
                $table->date('install_date');
                $table->text('condition_status')->nullable();
                $table->text('remarks')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
            });
        } else {
            Schema::table('asset_installations', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_installations', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_installations', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_installations', 'location_id')) {
                    $table->char('location_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_installations', 'location_name')) {
                    $table->text('location_name')->nullable();
                }
                if (! Schema::hasColumn('asset_installations', 'installed_by')) {
                    $table->char('installed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_installations', 'install_date')) {
                    $table->date('install_date')->nullable();
                }
                if (! Schema::hasColumn('asset_installations', 'condition_status')) {
                    $table->text('condition_status')->nullable();
                }
                if (! Schema::hasColumn('asset_installations', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('asset_installations', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_installations', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
            });
        }
        // ---- asset_maintenance_logs ----
        if (! Schema::hasTable('asset_maintenance_logs')) {
            Schema::create('asset_maintenance_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_id', 36);
                $table->date('maintenance_date');
                $table->text('vendor')->nullable();
                $table->decimal('cost', 20, 4);
                $table->integer('downtime_days');
                $table->text('status')->nullable();
                $table->text('remarks')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
            });
        } else {
            Schema::table('asset_maintenance_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_maintenance_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'maintenance_date')) {
                    $table->date('maintenance_date')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'vendor')) {
                    $table->text('vendor')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'cost')) {
                    $table->decimal('cost', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'downtime_days')) {
                    $table->integer('downtime_days')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_logs', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
            });
        }
        // ---- asset_maintenance_schedules ----
        if (! Schema::hasTable('asset_maintenance_schedules')) {
            Schema::create('asset_maintenance_schedules', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_id', 36);
                $table->text('title');
                $table->integer('frequency_days');
                $table->date('next_due_at');
                $table->text('vendor')->nullable();
                $table->text('notes')->nullable();
                $table->boolean('active');
                $table->timestamp('last_generated_alert_at')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('asset_maintenance_schedules', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_maintenance_schedules', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'title')) {
                    $table->text('title')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'frequency_days')) {
                    $table->integer('frequency_days')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'next_due_at')) {
                    $table->date('next_due_at')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'vendor')) {
                    $table->text('vendor')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'notes')) {
                    $table->text('notes')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'active')) {
                    $table->boolean('active')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'last_generated_alert_at')) {
                    $table->timestamp('last_generated_alert_at')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_maintenance_schedules', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- asset_movements ----
        if (! Schema::hasTable('asset_movements')) {
            Schema::create('asset_movements', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_id', 36);
                $table->char('from_location_id', 36)->nullable();
                $table->char('to_location_id', 36)->nullable();
                $table->decimal('quantity', 20, 4);
                $table->char('moved_by', 36)->nullable();
                $table->date('movement_date');
                $table->text('remarks')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->text('approval_status');
                $table->char('requested_by', 36)->nullable();
                $table->char('approved_by', 36)->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->text('rejection_reason')->nullable();
                $table->boolean('applied');
            });
        } else {
            Schema::table('asset_movements', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_movements', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'from_location_id')) {
                    $table->char('from_location_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'to_location_id')) {
                    $table->char('to_location_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'quantity')) {
                    $table->decimal('quantity', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'moved_by')) {
                    $table->char('moved_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'movement_date')) {
                    $table->date('movement_date')->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'approval_status')) {
                    $table->text('approval_status')->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'requested_by')) {
                    $table->char('requested_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'approved_by')) {
                    $table->char('approved_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'approved_at')) {
                    $table->timestamp('approved_at')->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'rejection_reason')) {
                    $table->text('rejection_reason')->nullable();
                }
                if (! Schema::hasColumn('asset_movements', 'applied')) {
                    $table->boolean('applied')->nullable();
                }
            });
        }
        // ---- asset_purchases ----
        if (! Schema::hasTable('asset_purchases')) {
            Schema::create('asset_purchases', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_id', 36);
                $table->date('purchase_date');
                $table->decimal('quantity', 20, 4);
                $table->decimal('unit_price', 20, 4);
                $table->decimal('total_amount', 20, 4);
                $table->text('supplier')->nullable();
                $table->text('invoice_no')->nullable();
                $table->text('payment_method')->nullable();
                $table->char('journal_entry_id', 36)->nullable();
                $table->text('notes')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
            });
        } else {
            Schema::table('asset_purchases', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_purchases', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'purchase_date')) {
                    $table->date('purchase_date')->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'quantity')) {
                    $table->decimal('quantity', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'unit_price')) {
                    $table->decimal('unit_price', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'total_amount')) {
                    $table->decimal('total_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'supplier')) {
                    $table->text('supplier')->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'invoice_no')) {
                    $table->text('invoice_no')->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'payment_method')) {
                    $table->text('payment_method')->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'journal_entry_id')) {
                    $table->char('journal_entry_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'notes')) {
                    $table->text('notes')->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('asset_purchases', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
            });
        }
        // ---- asset_scan_logs ----
        if (! Schema::hasTable('asset_scan_logs')) {
            Schema::create('asset_scan_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->timestamp('scanned_at');
                $table->char('scanned_by', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->text('scanned_text');
                $table->char('asset_id', 36)->nullable();
                $table->text('asset_code')->nullable();
                $table->boolean('success');
                $table->text('error_message')->nullable();
                $table->text('source');
            });
        } else {
            Schema::table('asset_scan_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_scan_logs', 'scanned_at')) {
                    $table->timestamp('scanned_at')->nullable();
                }
                if (! Schema::hasColumn('asset_scan_logs', 'scanned_by')) {
                    $table->char('scanned_by', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_scan_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_scan_logs', 'scanned_text')) {
                    $table->text('scanned_text')->nullable();
                }
                if (! Schema::hasColumn('asset_scan_logs', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_scan_logs', 'asset_code')) {
                    $table->text('asset_code')->nullable();
                }
                if (! Schema::hasColumn('asset_scan_logs', 'success')) {
                    $table->boolean('success')->nullable();
                }
                if (! Schema::hasColumn('asset_scan_logs', 'error_message')) {
                    $table->text('error_message')->nullable();
                }
                if (! Schema::hasColumn('asset_scan_logs', 'source')) {
                    $table->text('source')->nullable();
                }
            });
        }
        // ---- asset_stocks ----
        if (! Schema::hasTable('asset_stocks')) {
            Schema::create('asset_stocks', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_id', 36);
                $table->char('location_id', 36)->nullable();
                $table->decimal('quantity', 20, 4);
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('asset_stocks', function (Blueprint $table) {
                if (! Schema::hasColumn('asset_stocks', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_stocks', 'asset_id')) {
                    $table->char('asset_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_stocks', 'location_id')) {
                    $table->char('location_id', 36)->nullable();
                }
                if (! Schema::hasColumn('asset_stocks', 'quantity')) {
                    $table->decimal('quantity', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('asset_stocks', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- assets ----
        if (! Schema::hasTable('assets')) {
            Schema::create('assets', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('asset_category_id', 36)->nullable();
                $table->text('asset_code');
                $table->text('serial_no')->nullable();
                $table->text('name_bn')->nullable();
                $table->text('name_en');
                $table->text('tracking_mode');
                $table->text('unit')->nullable();
                $table->decimal('purchase_price', 20, 4);
                $table->date('warranty_until')->nullable();
                $table->text('current_status');
                $table->char('current_location_id', 36)->nullable();
                $table->timestamp('installed_at')->nullable();
                $table->text('notes')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->text('asset_type');
                $table->text('lifecycle_status')->nullable();
                $table->decimal('min_stock_level', 20, 4);
                $table->integer('warranty_alert_days');
            });
        } else {
            Schema::table('assets', function (Blueprint $table) {
                if (! Schema::hasColumn('assets', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('assets', 'asset_category_id')) {
                    $table->char('asset_category_id', 36)->nullable();
                }
                if (! Schema::hasColumn('assets', 'asset_code')) {
                    $table->text('asset_code')->nullable();
                }
                if (! Schema::hasColumn('assets', 'serial_no')) {
                    $table->text('serial_no')->nullable();
                }
                if (! Schema::hasColumn('assets', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('assets', 'name_en')) {
                    $table->text('name_en')->nullable();
                }
                if (! Schema::hasColumn('assets', 'tracking_mode')) {
                    $table->text('tracking_mode')->nullable();
                }
                if (! Schema::hasColumn('assets', 'unit')) {
                    $table->text('unit')->nullable();
                }
                if (! Schema::hasColumn('assets', 'purchase_price')) {
                    $table->decimal('purchase_price', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('assets', 'warranty_until')) {
                    $table->date('warranty_until')->nullable();
                }
                if (! Schema::hasColumn('assets', 'current_status')) {
                    $table->text('current_status')->nullable();
                }
                if (! Schema::hasColumn('assets', 'current_location_id')) {
                    $table->char('current_location_id', 36)->nullable();
                }
                if (! Schema::hasColumn('assets', 'installed_at')) {
                    $table->timestamp('installed_at')->nullable();
                }
                if (! Schema::hasColumn('assets', 'notes')) {
                    $table->text('notes')->nullable();
                }
                if (! Schema::hasColumn('assets', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('assets', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('assets', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('assets', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('assets', 'asset_type')) {
                    $table->text('asset_type')->nullable();
                }
                if (! Schema::hasColumn('assets', 'lifecycle_status')) {
                    $table->text('lifecycle_status')->nullable();
                }
                if (! Schema::hasColumn('assets', 'min_stock_level')) {
                    $table->decimal('min_stock_level', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('assets', 'warranty_alert_days')) {
                    $table->integer('warranty_alert_days')->nullable();
                }
            });
        }
        // ---- audit_logs ----
        if (! Schema::hasTable('audit_logs')) {
            Schema::create('audit_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('user_id', 36)->nullable();
                $table->text('action');
                $table->text('entity')->nullable();
                $table->char('entity_id', 36)->nullable();
                $table->json('meta')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                $table->text('ip_address')->nullable();
            });
        } else {
            Schema::table('audit_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('audit_logs', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('audit_logs', 'action')) {
                    $table->text('action')->nullable();
                }
                if (! Schema::hasColumn('audit_logs', 'entity')) {
                    $table->text('entity')->nullable();
                }
                if (! Schema::hasColumn('audit_logs', 'entity_id')) {
                    $table->char('entity_id', 36)->nullable();
                }
                if (! Schema::hasColumn('audit_logs', 'meta')) {
                    $table->json('meta')->nullable();
                }
                if (! Schema::hasColumn('audit_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('audit_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('audit_logs', 'old_values')) {
                    $table->json('old_values')->nullable();
                }
                if (! Schema::hasColumn('audit_logs', 'new_values')) {
                    $table->json('new_values')->nullable();
                }
                if (! Schema::hasColumn('audit_logs', 'ip_address')) {
                    $table->text('ip_address')->nullable();
                }
            });
        }
        // ---- background_retry_jobs ----
        if (! Schema::hasTable('background_retry_jobs')) {
            Schema::create('background_retry_jobs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->text('job_type');
                $table->char('reference_id', 36)->nullable();
                $table->json('payload');
                $table->text('status');
                $table->integer('retry_count');
                $table->integer('max_retry');
                $table->timestamp('next_retry_at');
                $table->text('last_error')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('background_retry_jobs', function (Blueprint $table) {
                if (! Schema::hasColumn('background_retry_jobs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'job_type')) {
                    $table->text('job_type')->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'reference_id')) {
                    $table->char('reference_id', 36)->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'payload')) {
                    $table->json('payload')->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'retry_count')) {
                    $table->integer('retry_count')->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'max_retry')) {
                    $table->integer('max_retry')->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'next_retry_at')) {
                    $table->timestamp('next_retry_at')->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'last_error')) {
                    $table->text('last_error')->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('background_retry_jobs', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- bank_accounts ----
        if (! Schema::hasTable('bank_accounts')) {
            Schema::create('bank_accounts', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->text('bank_name');
                $table->text('branch')->nullable();
                $table->text('account_no');
                $table->text('account_title')->nullable();
                $table->text('account_type')->nullable();
                $table->decimal('opening_balance', 20, 4);
                $table->boolean('is_active');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->text('stream');
            });
        } else {
            Schema::table('bank_accounts', function (Blueprint $table) {
                if (! Schema::hasColumn('bank_accounts', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'bank_name')) {
                    $table->text('bank_name')->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'branch')) {
                    $table->text('branch')->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'account_no')) {
                    $table->text('account_no')->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'account_title')) {
                    $table->text('account_title')->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'account_type')) {
                    $table->text('account_type')->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'opening_balance')) {
                    $table->decimal('opening_balance', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('bank_accounts', 'stream')) {
                    $table->text('stream')->nullable();
                }
            });
        }
        // ---- bank_transactions ----
        if (! Schema::hasTable('bank_transactions')) {
            Schema::create('bank_transactions', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('bank_account_id', 36);
                $table->date('txn_date');
                $table->text('txn_type');
                $table->decimal('amount', 20, 4);
                $table->text('reference_no')->nullable();
                $table->char('counterparty_account_id', 36)->nullable();
                $table->char('transfer_group', 36)->nullable();
                $table->text('note')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->char('link_id', 36)->nullable();
            });
        } else {
            Schema::table('bank_transactions', function (Blueprint $table) {
                if (! Schema::hasColumn('bank_transactions', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'bank_account_id')) {
                    $table->char('bank_account_id', 36)->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'txn_date')) {
                    $table->date('txn_date')->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'txn_type')) {
                    $table->text('txn_type')->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'reference_no')) {
                    $table->text('reference_no')->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'counterparty_account_id')) {
                    $table->char('counterparty_account_id', 36)->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'transfer_group')) {
                    $table->char('transfer_group', 36)->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('bank_transactions', 'link_id')) {
                    $table->char('link_id', 36)->nullable();
                }
            });
        }
        // ---- card_settings ----
        if (! Schema::hasTable('card_settings')) {
            Schema::create('card_settings', function (Blueprint $table) {
                $table->integer('id');
                $table->text('template_id');
                $table->text('accent_color');
                $table->text('header_text');
                $table->text('header_text_bn');
                $table->boolean('show_photo');
                $table->boolean('show_account_number');
                $table->boolean('show_voter_number');
                $table->boolean('show_issue_date');
                $table->boolean('show_qr');
                $table->decimal('photo_size_mm', 20, 4);
                $table->decimal('font_scale', 20, 4);
                $table->timestamp('updated_at')->nullable();
                $table->char('updated_by', 36)->nullable();
                $table->decimal('header_height_mm', 20, 4);
                $table->decimal('logo_size_mm', 20, 4);
                $table->text('custom_text');
                $table->text('custom_text_bn');
            });
        } else {
            Schema::table('card_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('card_settings', 'template_id')) {
                    $table->text('template_id')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'accent_color')) {
                    $table->text('accent_color')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'header_text')) {
                    $table->text('header_text')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'header_text_bn')) {
                    $table->text('header_text_bn')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'show_photo')) {
                    $table->boolean('show_photo')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'show_account_number')) {
                    $table->boolean('show_account_number')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'show_voter_number')) {
                    $table->boolean('show_voter_number')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'show_issue_date')) {
                    $table->boolean('show_issue_date')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'show_qr')) {
                    $table->boolean('show_qr')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'photo_size_mm')) {
                    $table->decimal('photo_size_mm', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'font_scale')) {
                    $table->decimal('font_scale', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'updated_by')) {
                    $table->char('updated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'header_height_mm')) {
                    $table->decimal('header_height_mm', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'logo_size_mm')) {
                    $table->decimal('logo_size_mm', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'custom_text')) {
                    $table->text('custom_text')->nullable();
                }
                if (! Schema::hasColumn('card_settings', 'custom_text_bn')) {
                    $table->text('custom_text_bn')->nullable();
                }
            });
        }
        // ---- cashbook_expense_heads ----
        if (! Schema::hasTable('cashbook_expense_heads')) {
            Schema::create('cashbook_expense_heads', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->text('stream');
                $table->text('name_bn');
                $table->text('name_en')->nullable();
                $table->integer('sort_order');
                $table->boolean('is_active');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('cashbook_expense_heads', function (Blueprint $table) {
                if (! Schema::hasColumn('cashbook_expense_heads', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('cashbook_expense_heads', 'stream')) {
                    $table->text('stream')->nullable();
                }
                if (! Schema::hasColumn('cashbook_expense_heads', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('cashbook_expense_heads', 'name_en')) {
                    $table->text('name_en')->nullable();
                }
                if (! Schema::hasColumn('cashbook_expense_heads', 'sort_order')) {
                    $table->integer('sort_order')->nullable();
                }
                if (! Schema::hasColumn('cashbook_expense_heads', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('cashbook_expense_heads', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('cashbook_expense_heads', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- cashbook_submissions ----
        if (! Schema::hasTable('cashbook_submissions')) {
            Schema::create('cashbook_submissions', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->integer('year');
                $table->integer('month');
                $table->decimal('opening_cash', 20, 4);
                $table->decimal('closing_cash', 20, 4);
                $table->decimal('total_income', 20, 4);
                $table->decimal('total_expense', 20, 4);
                $table->text('note')->nullable();
                $table->char('submitted_by', 36)->nullable();
                $table->timestamp('submitted_at');
                $table->boolean('locked');
                $table->timestamp('created_at')->nullable();
                $table->text('stream');
            });
        } else {
            Schema::table('cashbook_submissions', function (Blueprint $table) {
                if (! Schema::hasColumn('cashbook_submissions', 'year')) {
                    $table->integer('year')->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'month')) {
                    $table->integer('month')->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'opening_cash')) {
                    $table->decimal('opening_cash', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'closing_cash')) {
                    $table->decimal('closing_cash', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'total_income')) {
                    $table->decimal('total_income', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'total_expense')) {
                    $table->decimal('total_expense', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'submitted_by')) {
                    $table->char('submitted_by', 36)->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'submitted_at')) {
                    $table->timestamp('submitted_at')->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'locked')) {
                    $table->boolean('locked')->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('cashbook_submissions', 'stream')) {
                    $table->text('stream')->nullable();
                }
            });
        }
        // ---- cashbook_voucher_seq ----
        if (! Schema::hasTable('cashbook_voucher_seq')) {
            Schema::create('cashbook_voucher_seq', function (Blueprint $table) {
                $table->char('office_id', 36);
                $table->text('stream');
                $table->integer('last_no');
            });
        } else {
            Schema::table('cashbook_voucher_seq', function (Blueprint $table) {
                if (! Schema::hasColumn('cashbook_voucher_seq', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('cashbook_voucher_seq', 'stream')) {
                    $table->text('stream')->nullable();
                }
                if (! Schema::hasColumn('cashbook_voucher_seq', 'last_no')) {
                    $table->integer('last_no')->nullable();
                }
            });
        }
        // ---- company_settings ----
        if (! Schema::hasTable('company_settings')) {
            Schema::create('company_settings', function (Blueprint $table) {
                $table->integer('id');
                $table->text('company_name');
                $table->text('company_name_bn')->nullable();
                $table->text('logo_url')->nullable();
                $table->text('email')->nullable();
                $table->text('mobile')->nullable();
                $table->text('address')->nullable();
                $table->decimal('default_loan_interest', 20, 4);
                $table->timestamp('updated_at')->nullable();
                $table->text('penalty_type');
                $table->decimal('penalty_value', 20, 4);
                $table->integer('penalty_grace_days');
                $table->smallInteger('fiscal_year_start_month');
                $table->text('pdf_footer_text')->nullable();
                $table->boolean('pdf_footer_show_address');
                $table->boolean('pdf_footer_show_contact');
                $table->text('loan_receipt_header_en')->nullable();
                $table->text('loan_receipt_header_bn')->nullable();
                $table->text('loan_receipt_footer_en')->nullable();
                $table->text('loan_receipt_footer_bn')->nullable();
                $table->text('loan_receipt_no_format')->nullable();
                $table->text('registration_no')->nullable();
                $table->text('editor_signature_url')->nullable();
            });
        } else {
            Schema::table('company_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('company_settings', 'company_name')) {
                    $table->text('company_name')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'company_name_bn')) {
                    $table->text('company_name_bn')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'logo_url')) {
                    $table->text('logo_url')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'email')) {
                    $table->text('email')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'mobile')) {
                    $table->text('mobile')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'address')) {
                    $table->text('address')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'default_loan_interest')) {
                    $table->decimal('default_loan_interest', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'penalty_type')) {
                    $table->text('penalty_type')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'penalty_value')) {
                    $table->decimal('penalty_value', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'penalty_grace_days')) {
                    $table->integer('penalty_grace_days')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'fiscal_year_start_month')) {
                    $table->smallInteger('fiscal_year_start_month')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'pdf_footer_text')) {
                    $table->text('pdf_footer_text')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'pdf_footer_show_address')) {
                    $table->boolean('pdf_footer_show_address')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'pdf_footer_show_contact')) {
                    $table->boolean('pdf_footer_show_contact')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'loan_receipt_header_en')) {
                    $table->text('loan_receipt_header_en')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'loan_receipt_header_bn')) {
                    $table->text('loan_receipt_header_bn')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'loan_receipt_footer_en')) {
                    $table->text('loan_receipt_footer_en')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'loan_receipt_footer_bn')) {
                    $table->text('loan_receipt_footer_bn')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'loan_receipt_no_format')) {
                    $table->text('loan_receipt_no_format')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'registration_no')) {
                    $table->text('registration_no')->nullable();
                }
                if (! Schema::hasColumn('company_settings', 'editor_signature_url')) {
                    $table->text('editor_signature_url')->nullable();
                }
            });
        }
        // ---- demo_operations_log ----
        if (! Schema::hasTable('demo_operations_log')) {
            Schema::create('demo_operations_log', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('user_id', 36)->nullable();
                $table->text('user_email')->nullable();
                $table->text('action');
                $table->text('modules');
                $table->integer('size')->nullable();
                $table->text('ip')->nullable();
                $table->text('user_agent')->nullable();
                $table->boolean('success');
                $table->text('error_message')->nullable();
                $table->json('summary')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('demo_operations_log', function (Blueprint $table) {
                if (! Schema::hasColumn('demo_operations_log', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'user_email')) {
                    $table->text('user_email')->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'action')) {
                    $table->text('action')->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'modules')) {
                    $table->text('modules')->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'size')) {
                    $table->integer('size')->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'ip')) {
                    $table->text('ip')->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'user_agent')) {
                    $table->text('user_agent')->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'success')) {
                    $table->boolean('success')->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'error_message')) {
                    $table->text('error_message')->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'summary')) {
                    $table->json('summary')->nullable();
                }
                if (! Schema::hasColumn('demo_operations_log', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- developer_update_logs ----
        if (! Schema::hasTable('developer_update_logs')) {
            Schema::create('developer_update_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('user_id', 36);
                $table->text('action');
                $table->text('repo_url');
                $table->text('commit_sha')->nullable();
                $table->text('commit_message')->nullable();
                $table->text('release_tag')->nullable();
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->text('status')->nullable();
            });
        } else {
            Schema::table('developer_update_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('developer_update_logs', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('developer_update_logs', 'action')) {
                    $table->text('action')->nullable();
                }
                if (! Schema::hasColumn('developer_update_logs', 'repo_url')) {
                    $table->text('repo_url')->nullable();
                }
                if (! Schema::hasColumn('developer_update_logs', 'commit_sha')) {
                    $table->text('commit_sha')->nullable();
                }
                if (! Schema::hasColumn('developer_update_logs', 'commit_message')) {
                    $table->text('commit_message')->nullable();
                }
                if (! Schema::hasColumn('developer_update_logs', 'release_tag')) {
                    $table->text('release_tag')->nullable();
                }
                if (! Schema::hasColumn('developer_update_logs', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('developer_update_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('developer_update_logs', 'status')) {
                    $table->text('status')->nullable();
                }
            });
        }
        // ---- districts ----
        if (! Schema::hasTable('districts')) {
            Schema::create('districts', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('division_id', 36)->nullable();
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->text('code')->nullable();
                $table->boolean('is_active');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('districts', function (Blueprint $table) {
                if (! Schema::hasColumn('districts', 'division_id')) {
                    $table->char('division_id', 36)->nullable();
                }
                if (! Schema::hasColumn('districts', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('districts', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('districts', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('districts', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('districts', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('districts', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- divisions ----
        if (! Schema::hasTable('divisions')) {
            Schema::create('divisions', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->text('code')->nullable();
                $table->boolean('is_active');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('divisions', function (Blueprint $table) {
                if (! Schema::hasColumn('divisions', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('divisions', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('divisions', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('divisions', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('divisions', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('divisions', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- expenses ----
        if (! Schema::hasTable('expenses')) {
            Schema::create('expenses', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->date('expense_date');
                $table->text('head');
                $table->text('payee')->nullable();
                $table->decimal('amount', 20, 4);
                $table->text('method')->nullable();
                $table->text('note')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->text('stream');
                $table->text('voucher_no')->nullable();
                $table->text('attachment_path')->nullable();
                $table->text('attachment_mime')->nullable();
                $table->char('bank_account_id', 36)->nullable();
                $table->boolean('is_bank_deposit');
                $table->char('head_id', 36)->nullable();
                $table->char('link_id', 36)->nullable();
            });
        } else {
            Schema::table('expenses', function (Blueprint $table) {
                if (! Schema::hasColumn('expenses', 'expense_date')) {
                    $table->date('expense_date')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'head')) {
                    $table->text('head')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'payee')) {
                    $table->text('payee')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('expenses', 'method')) {
                    $table->text('method')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('expenses', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('expenses', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'stream')) {
                    $table->text('stream')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'voucher_no')) {
                    $table->text('voucher_no')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'attachment_path')) {
                    $table->text('attachment_path')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'attachment_mime')) {
                    $table->text('attachment_mime')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'bank_account_id')) {
                    $table->char('bank_account_id', 36)->nullable();
                }
                if (! Schema::hasColumn('expenses', 'is_bank_deposit')) {
                    $table->boolean('is_bank_deposit')->nullable();
                }
                if (! Schema::hasColumn('expenses', 'head_id')) {
                    $table->char('head_id', 36)->nullable();
                }
                if (! Schema::hasColumn('expenses', 'link_id')) {
                    $table->char('link_id', 36)->nullable();
                }
            });
        }
        // ---- farmer_login_attempts ----
        if (! Schema::hasTable('farmer_login_attempts')) {
            Schema::create('farmer_login_attempts', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('identifier');
                $table->char('farmer_id', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->boolean('success');
                $table->text('error_reason')->nullable();
                $table->text('ip')->nullable();
                $table->text('user_agent')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('farmer_login_attempts', function (Blueprint $table) {
                if (! Schema::hasColumn('farmer_login_attempts', 'identifier')) {
                    $table->text('identifier')->nullable();
                }
                if (! Schema::hasColumn('farmer_login_attempts', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_login_attempts', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_login_attempts', 'success')) {
                    $table->boolean('success')->nullable();
                }
                if (! Schema::hasColumn('farmer_login_attempts', 'error_reason')) {
                    $table->text('error_reason')->nullable();
                }
                if (! Schema::hasColumn('farmer_login_attempts', 'ip')) {
                    $table->text('ip')->nullable();
                }
                if (! Schema::hasColumn('farmer_login_attempts', 'user_agent')) {
                    $table->text('user_agent')->nullable();
                }
                if (! Schema::hasColumn('farmer_login_attempts', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- farmer_notes ----
        if (! Schema::hasTable('farmer_notes')) {
            Schema::create('farmer_notes', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->text('note');
                $table->boolean('pinned');
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('farmer_notes', function (Blueprint $table) {
                if (! Schema::hasColumn('farmer_notes', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_notes', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('farmer_notes', 'pinned')) {
                    $table->boolean('pinned')->nullable();
                }
                if (! Schema::hasColumn('farmer_notes', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_notes', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_notes', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- farmer_otps ----
        if (! Schema::hasTable('farmer_otps')) {
            Schema::create('farmer_otps', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->text('otp_hash');
                $table->text('mobile_masked')->nullable();
                $table->timestamp('expires_at');
                $table->integer('attempts');
                $table->boolean('used');
                $table->text('ip')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('farmer_otps', function (Blueprint $table) {
                if (! Schema::hasColumn('farmer_otps', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_otps', 'otp_hash')) {
                    $table->text('otp_hash')->nullable();
                }
                if (! Schema::hasColumn('farmer_otps', 'mobile_masked')) {
                    $table->text('mobile_masked')->nullable();
                }
                if (! Schema::hasColumn('farmer_otps', 'expires_at')) {
                    $table->timestamp('expires_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_otps', 'attempts')) {
                    $table->integer('attempts')->nullable();
                }
                if (! Schema::hasColumn('farmer_otps', 'used')) {
                    $table->boolean('used')->nullable();
                }
                if (! Schema::hasColumn('farmer_otps', 'ip')) {
                    $table->text('ip')->nullable();
                }
                if (! Schema::hasColumn('farmer_otps', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- farmer_portal_sessions ----
        if (! Schema::hasTable('farmer_portal_sessions')) {
            Schema::create('farmer_portal_sessions', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->text('token_hash');
                $table->timestamp('expires_at');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('last_used_at')->nullable();
                $table->text('ip')->nullable();
                $table->text('user_agent')->nullable();
            });
        } else {
            Schema::table('farmer_portal_sessions', function (Blueprint $table) {
                if (! Schema::hasColumn('farmer_portal_sessions', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_portal_sessions', 'token_hash')) {
                    $table->text('token_hash')->nullable();
                }
                if (! Schema::hasColumn('farmer_portal_sessions', 'expires_at')) {
                    $table->timestamp('expires_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_portal_sessions', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_portal_sessions', 'last_used_at')) {
                    $table->timestamp('last_used_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_portal_sessions', 'ip')) {
                    $table->text('ip')->nullable();
                }
                if (! Schema::hasColumn('farmer_portal_sessions', 'user_agent')) {
                    $table->text('user_agent')->nullable();
                }
            });
        }
        // ---- farmer_rejections ----
        if (! Schema::hasTable('farmer_rejections')) {
            Schema::create('farmer_rejections', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->timestamp('created_at')->nullable();
                $table->char('user_id', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->char('farmer_id', 36)->nullable();
                $table->text('operation');
                $table->text('failed_level');
                $table->text('reason');
                $table->json('attempted');
                $table->text('error_message');
            });
        } else {
            Schema::table('farmer_rejections', function (Blueprint $table) {
                if (! Schema::hasColumn('farmer_rejections', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_rejections', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_rejections', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_rejections', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_rejections', 'operation')) {
                    $table->text('operation')->nullable();
                }
                if (! Schema::hasColumn('farmer_rejections', 'failed_level')) {
                    $table->text('failed_level')->nullable();
                }
                if (! Schema::hasColumn('farmer_rejections', 'reason')) {
                    $table->text('reason')->nullable();
                }
                if (! Schema::hasColumn('farmer_rejections', 'attempted')) {
                    $table->json('attempted')->nullable();
                }
                if (! Schema::hasColumn('farmer_rejections', 'error_message')) {
                    $table->text('error_message')->nullable();
                }
            });
        }
        // ---- farmer_savings_plans ----
        if (! Schema::hasTable('farmer_savings_plans')) {
            Schema::create('farmer_savings_plans', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->char('plan_id', 36);
                $table->date('start_date');
                $table->decimal('expected_total', 20, 4);
                $table->decimal('expected_interest', 20, 4);
                $table->decimal('maturity_amount', 20, 4);
                $table->text('status');
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->char('approved_by', 36)->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->char('cancelled_by', 36)->nullable();
                $table->timestamp('cancelled_at')->nullable();
                $table->text('cancel_reason')->nullable();
            });
        } else {
            Schema::table('farmer_savings_plans', function (Blueprint $table) {
                if (! Schema::hasColumn('farmer_savings_plans', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'plan_id')) {
                    $table->char('plan_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'start_date')) {
                    $table->date('start_date')->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'expected_total')) {
                    $table->decimal('expected_total', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'expected_interest')) {
                    $table->decimal('expected_interest', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'maturity_amount')) {
                    $table->decimal('maturity_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'approved_by')) {
                    $table->char('approved_by', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'approved_at')) {
                    $table->timestamp('approved_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'cancelled_by')) {
                    $table->char('cancelled_by', 36)->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'cancelled_at')) {
                    $table->timestamp('cancelled_at')->nullable();
                }
                if (! Schema::hasColumn('farmer_savings_plans', 'cancel_reason')) {
                    $table->text('cancel_reason')->nullable();
                }
            });
        }
        // ---- farmers ----
        if (! Schema::hasTable('farmers')) {
            Schema::create('farmers', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('farmer_code');
                $table->text('name_en');
                $table->text('name_bn')->nullable();
                $table->text('father_name')->nullable();
                $table->text('mother_name')->nullable();
                $table->text('nid')->nullable();
                $table->text('mobile')->nullable();
                $table->text('village')->nullable();
                $table->text('post_office')->nullable();
                $table->text('upazila')->nullable();
                $table->text('district')->nullable();
                $table->text('division')->nullable();
                $table->text('address')->nullable();
                $table->text('photo_url')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->text('status');
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->text('member_no')->nullable();
                $table->char('division_id', 36)->nullable();
                $table->char('district_id', 36)->nullable();
                $table->char('upazila_id', 36)->nullable();
                $table->text('account_number')->nullable();
                $table->text('voter_number')->nullable();
                $table->boolean('is_voter');
                $table->timestamp('deleted_at')->nullable();
                $table->timestamp('voter_cancelled_at')->nullable();
                $table->char('voter_cancelled_by', 36)->nullable();
                $table->text('voter_cancel_reason')->nullable();
                $table->timestamp('voter_reactivated_at')->nullable();
                $table->char('voter_reactivated_by', 36)->nullable();
                $table->text('voter_reactivate_reason')->nullable();
                $table->char('mouza_id', 36)->nullable();
                $table->char('union_id', 36)->nullable();
                $table->char('ward_id', 36)->nullable();
                $table->char('village_id', 36)->nullable();
                $table->text('nominee_name')->nullable();
                $table->text('nominee_mobile')->nullable();
                $table->text('nominee_relation')->nullable();
                $table->text('nominee_nid')->nullable();
                $table->text('nominee_address')->nullable();
                $table->char('merged_into', 36)->nullable();
                $table->timestamp('merged_at')->nullable();
                $table->char('merged_by', 36)->nullable();
                $table->boolean('savings_inactive');
            });
        } else {
            Schema::table('farmers', function (Blueprint $table) {
                if (! Schema::hasColumn('farmers', 'farmer_code')) {
                    $table->text('farmer_code')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'name_en')) {
                    $table->text('name_en')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'father_name')) {
                    $table->text('father_name')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'mother_name')) {
                    $table->text('mother_name')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'nid')) {
                    $table->text('nid')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'mobile')) {
                    $table->text('mobile')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'village')) {
                    $table->text('village')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'post_office')) {
                    $table->text('post_office')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'upazila')) {
                    $table->text('upazila')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'district')) {
                    $table->text('district')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'division')) {
                    $table->text('division')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'address')) {
                    $table->text('address')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'photo_url')) {
                    $table->text('photo_url')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'member_no')) {
                    $table->text('member_no')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'division_id')) {
                    $table->char('division_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'district_id')) {
                    $table->char('district_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'upazila_id')) {
                    $table->char('upazila_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'account_number')) {
                    $table->text('account_number')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'voter_number')) {
                    $table->text('voter_number')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'is_voter')) {
                    $table->boolean('is_voter')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'voter_cancelled_at')) {
                    $table->timestamp('voter_cancelled_at')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'voter_cancelled_by')) {
                    $table->char('voter_cancelled_by', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'voter_cancel_reason')) {
                    $table->text('voter_cancel_reason')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'voter_reactivated_at')) {
                    $table->timestamp('voter_reactivated_at')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'voter_reactivated_by')) {
                    $table->char('voter_reactivated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'voter_reactivate_reason')) {
                    $table->text('voter_reactivate_reason')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'mouza_id')) {
                    $table->char('mouza_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'union_id')) {
                    $table->char('union_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'ward_id')) {
                    $table->char('ward_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'village_id')) {
                    $table->char('village_id', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'nominee_name')) {
                    $table->text('nominee_name')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'nominee_mobile')) {
                    $table->text('nominee_mobile')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'nominee_relation')) {
                    $table->text('nominee_relation')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'nominee_nid')) {
                    $table->text('nominee_nid')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'nominee_address')) {
                    $table->text('nominee_address')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'merged_into')) {
                    $table->char('merged_into', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'merged_at')) {
                    $table->timestamp('merged_at')->nullable();
                }
                if (! Schema::hasColumn('farmers', 'merged_by')) {
                    $table->char('merged_by', 36)->nullable();
                }
                if (! Schema::hasColumn('farmers', 'savings_inactive')) {
                    $table->boolean('savings_inactive')->nullable();
                }
            });
        }
        // ---- hand_cash_submissions ----
        if (! Schema::hasTable('hand_cash_submissions')) {
            Schema::create('hand_cash_submissions', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->integer('year');
                $table->integer('month');
                $table->decimal('opening_cash', 20, 4);
                $table->decimal('total_income', 20, 4);
                $table->decimal('total_expense', 20, 4);
                $table->decimal('closing_cash', 20, 4);
                $table->boolean('locked');
                $table->char('submitted_by', 36)->nullable();
                $table->timestamp('submitted_at')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('hand_cash_submissions', function (Blueprint $table) {
                if (! Schema::hasColumn('hand_cash_submissions', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'year')) {
                    $table->integer('year')->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'month')) {
                    $table->integer('month')->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'opening_cash')) {
                    $table->decimal('opening_cash', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'total_income')) {
                    $table->decimal('total_income', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'total_expense')) {
                    $table->decimal('total_expense', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'closing_cash')) {
                    $table->decimal('closing_cash', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'locked')) {
                    $table->boolean('locked')->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'submitted_by')) {
                    $table->char('submitted_by', 36)->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'submitted_at')) {
                    $table->timestamp('submitted_at')->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('hand_cash_submissions', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- import_audit_logs ----
        if (! Schema::hasTable('import_audit_logs')) {
            Schema::create('import_audit_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('user_id', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->text('module');
                $table->text('mode');
                $table->integer('rows_processed');
                $table->integer('rows_inserted');
                $table->integer('rows_updated');
                $table->integer('rows_failed');
                $table->text('error_report_url')->nullable();
                $table->json('summary')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('import_audit_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('import_audit_logs', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'module')) {
                    $table->text('module')->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'mode')) {
                    $table->text('mode')->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'rows_processed')) {
                    $table->integer('rows_processed')->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'rows_inserted')) {
                    $table->integer('rows_inserted')->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'rows_updated')) {
                    $table->integer('rows_updated')->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'rows_failed')) {
                    $table->integer('rows_failed')->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'error_report_url')) {
                    $table->text('error_report_url')->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'summary')) {
                    $table->json('summary')->nullable();
                }
                if (! Schema::hasColumn('import_audit_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- irrigation_cashbook_export_audit ----
        if (! Schema::hasTable('irrigation_cashbook_export_audit')) {
            Schema::create('irrigation_cashbook_export_audit', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('user_id', 36);
                $table->char('office_id', 36)->nullable();
                $table->date('date_from');
                $table->date('date_to');
                $table->text('format');
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('irrigation_cashbook_export_audit', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_cashbook_export_audit', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_export_audit', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_export_audit', 'date_from')) {
                    $table->date('date_from')->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_export_audit', 'date_to')) {
                    $table->date('date_to')->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_export_audit', 'format')) {
                    $table->text('format')->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_export_audit', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- irrigation_cashbook_presets ----
        if (! Schema::hasTable('irrigation_cashbook_presets')) {
            Schema::create('irrigation_cashbook_presets', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('user_id', 36);
                $table->text('name');
                $table->date('date_from');
                $table->date('date_to');
                $table->text('office_filter');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('irrigation_cashbook_presets', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_cashbook_presets', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_presets', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_presets', 'date_from')) {
                    $table->date('date_from')->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_presets', 'date_to')) {
                    $table->date('date_to')->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_presets', 'office_filter')) {
                    $table->text('office_filter')->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_presets', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_cashbook_presets', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- irrigation_categories ----
        if (! Schema::hasTable('irrigation_categories')) {
            Schema::create('irrigation_categories', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->text('code');
                $table->text('name_bn')->nullable();
                $table->text('name_en')->nullable();
                $table->text('calculation_basis');
                $table->boolean('allow_manual_negotiation');
                $table->boolean('is_active');
                $table->timestamp('deleted_at')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->char('created_by', 36)->nullable();
            });
        } else {
            Schema::table('irrigation_categories', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_categories', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'name_en')) {
                    $table->text('name_en')->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'calculation_basis')) {
                    $table->text('calculation_basis')->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'allow_manual_negotiation')) {
                    $table->boolean('allow_manual_negotiation')->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_categories', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
            });
        }
        // ---- irrigation_category_rates ----
        if (! Schema::hasTable('irrigation_category_rates')) {
            Schema::create('irrigation_category_rates', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('irrigation_season_id', 36);
                $table->char('irrigation_category_id', 36);
                $table->text('rate_type');
                $table->decimal('rate', 20, 4);
                $table->text('unit')->nullable();
                $table->boolean('is_negotiable');
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('irrigation_category_rates', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_category_rates', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_category_rates', 'irrigation_season_id')) {
                    $table->char('irrigation_season_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_category_rates', 'irrigation_category_id')) {
                    $table->char('irrigation_category_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_category_rates', 'rate_type')) {
                    $table->text('rate_type')->nullable();
                }
                if (! Schema::hasColumn('irrigation_category_rates', 'rate')) {
                    $table->decimal('rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_category_rates', 'unit')) {
                    $table->text('unit')->nullable();
                }
                if (! Schema::hasColumn('irrigation_category_rates', 'is_negotiable')) {
                    $table->boolean('is_negotiable')->nullable();
                }
                if (! Schema::hasColumn('irrigation_category_rates', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_category_rates', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_category_rates', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- irrigation_charge_settings ----
        if (! Schema::hasTable('irrigation_charge_settings')) {
            Schema::create('irrigation_charge_settings', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->decimal('delay_fee_percent', 20, 4);
                $table->decimal('maintenance_percent', 20, 4);
                $table->decimal('canal_percent', 20, 4);
                $table->integer('grace_days');
                $table->boolean('auto_apply_delay_fee');
                $table->char('created_by', 36)->nullable();
                $table->char('updated_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('irrigation_charge_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_charge_settings', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charge_settings', 'delay_fee_percent')) {
                    $table->decimal('delay_fee_percent', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charge_settings', 'maintenance_percent')) {
                    $table->decimal('maintenance_percent', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charge_settings', 'canal_percent')) {
                    $table->decimal('canal_percent', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charge_settings', 'grace_days')) {
                    $table->integer('grace_days')->nullable();
                }
                if (! Schema::hasColumn('irrigation_charge_settings', 'auto_apply_delay_fee')) {
                    $table->boolean('auto_apply_delay_fee')->nullable();
                }
                if (! Schema::hasColumn('irrigation_charge_settings', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charge_settings', 'updated_by')) {
                    $table->char('updated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charge_settings', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_charge_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- irrigation_charges ----
        if (! Schema::hasTable('irrigation_charges')) {
            Schema::create('irrigation_charges', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->char('land_id', 36);
                $table->char('season_id', 36);
                $table->text('basis');
                $table->decimal('quantity', 20, 4);
                $table->decimal('base_charge', 20, 4);
                $table->decimal('canal_charge', 20, 4);
                $table->decimal('maintenance_charge', 20, 4);
                $table->decimal('other_charge', 20, 4);
                $table->decimal('total', 20, 4);
                $table->decimal('paid_amount', 20, 4);
                $table->decimal('due_amount', 20, 4);
                $table->date('entry_date');
                $table->text('note')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->decimal('previous_due_brought', 20, 4);
                $table->decimal('penalty_amount', 20, 4);
                $table->timestamp('deleted_at')->nullable();
                $table->char('patwari_id', 36)->nullable();
            });
        } else {
            Schema::table('irrigation_charges', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_charges', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'land_id')) {
                    $table->char('land_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'season_id')) {
                    $table->char('season_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'basis')) {
                    $table->text('basis')->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'quantity')) {
                    $table->decimal('quantity', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'base_charge')) {
                    $table->decimal('base_charge', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'canal_charge')) {
                    $table->decimal('canal_charge', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'maintenance_charge')) {
                    $table->decimal('maintenance_charge', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'other_charge')) {
                    $table->decimal('other_charge', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'total')) {
                    $table->decimal('total', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'paid_amount')) {
                    $table->decimal('paid_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'due_amount')) {
                    $table->decimal('due_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'entry_date')) {
                    $table->date('entry_date')->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'previous_due_brought')) {
                    $table->decimal('previous_due_brought', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'penalty_amount')) {
                    $table->decimal('penalty_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_charges', 'patwari_id')) {
                    $table->char('patwari_id', 36)->nullable();
                }
            });
        }
        // ---- irrigation_delay_fee_audit ----
        if (! Schema::hasTable('irrigation_delay_fee_audit')) {
            Schema::create('irrigation_delay_fee_audit', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('invoice_id', 36);
                $table->char('payment_id', 36)->nullable();
                $table->decimal('original_amount', 20, 4);
                $table->decimal('modified_amount', 20, 4);
                $table->text('reason')->nullable();
                $table->char('changed_by', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('irrigation_delay_fee_audit', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_delay_fee_audit', 'invoice_id')) {
                    $table->char('invoice_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_delay_fee_audit', 'payment_id')) {
                    $table->char('payment_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_delay_fee_audit', 'original_amount')) {
                    $table->decimal('original_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_delay_fee_audit', 'modified_amount')) {
                    $table->decimal('modified_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_delay_fee_audit', 'reason')) {
                    $table->text('reason')->nullable();
                }
                if (! Schema::hasColumn('irrigation_delay_fee_audit', 'changed_by')) {
                    $table->char('changed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_delay_fee_audit', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_delay_fee_audit', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- irrigation_due_promises ----
        if (! Schema::hasTable('irrigation_due_promises')) {
            Schema::create('irrigation_due_promises', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('farmer_id', 36);
                $table->char('payment_id', 36)->nullable();
                $table->decimal('previous_due_amount', 20, 4);
                $table->date('promise_date');
                $table->text('remarks')->nullable();
                $table->char('approved_by', 36)->nullable();
                $table->text('status');
                $table->timestamp('fulfilled_at')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('irrigation_due_promises', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_due_promises', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'payment_id')) {
                    $table->char('payment_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'previous_due_amount')) {
                    $table->decimal('previous_due_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'promise_date')) {
                    $table->date('promise_date')->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'approved_by')) {
                    $table->char('approved_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'fulfilled_at')) {
                    $table->timestamp('fulfilled_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_due_promises', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- irrigation_invoice_audit ----
        if (! Schema::hasTable('irrigation_invoice_audit')) {
            Schema::create('irrigation_invoice_audit', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('invoice_id', 36);
                $table->text('action');
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                $table->text('note')->nullable();
                $table->char('user_id', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('irrigation_invoice_audit', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_invoice_audit', 'invoice_id')) {
                    $table->char('invoice_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_audit', 'action')) {
                    $table->text('action')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_audit', 'old_values')) {
                    $table->json('old_values')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_audit', 'new_values')) {
                    $table->json('new_values')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_audit', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_audit', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_audit', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_audit', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- irrigation_invoice_payments ----
        if (! Schema::hasTable('irrigation_invoice_payments')) {
            Schema::create('irrigation_invoice_payments', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('invoice_id', 36);
                $table->char('payment_id', 36)->nullable();
                $table->decimal('collected_amount', 20, 4);
                $table->decimal('delay_fee_collected', 20, 4);
                $table->decimal('maintenance_collected', 20, 4);
                $table->decimal('canal_collected', 20, 4);
                $table->decimal('irrigation_collected', 20, 4);
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->decimal('current_invoice_collected', 20, 4);
                $table->decimal('previous_due_collected', 20, 4);
                $table->decimal('delay_fee_original', 20, 4)->nullable();
                $table->text('delay_fee_override_reason')->nullable();
            });
        } else {
            Schema::table('irrigation_invoice_payments', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_invoice_payments', 'invoice_id')) {
                    $table->char('invoice_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'payment_id')) {
                    $table->char('payment_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'collected_amount')) {
                    $table->decimal('collected_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'delay_fee_collected')) {
                    $table->decimal('delay_fee_collected', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'maintenance_collected')) {
                    $table->decimal('maintenance_collected', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'canal_collected')) {
                    $table->decimal('canal_collected', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'irrigation_collected')) {
                    $table->decimal('irrigation_collected', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'current_invoice_collected')) {
                    $table->decimal('current_invoice_collected', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'previous_due_collected')) {
                    $table->decimal('previous_due_collected', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'delay_fee_original')) {
                    $table->decimal('delay_fee_original', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoice_payments', 'delay_fee_override_reason')) {
                    $table->text('delay_fee_override_reason')->nullable();
                }
            });
        }
        // ---- irrigation_invoices ----
        if (! Schema::hasTable('irrigation_invoices')) {
            Schema::create('irrigation_invoices', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('invoice_no');
                $table->char('office_id', 36)->nullable();
                $table->char('season_id', 36);
                $table->char('land_id', 36);
                $table->char('owner_farmer_id', 36);
                $table->char('farmer_id', 36);
                $table->boolean('is_borga');
                $table->decimal('irrigation_amount', 20, 4);
                $table->decimal('maintenance_amount', 20, 4);
                $table->decimal('canal_amount', 20, 4);
                $table->decimal('delay_fee', 20, 4);
                $table->decimal('other_charge', 20, 4);
                $table->decimal('payable_amount', 20, 4);
                $table->decimal('paid_amount', 20, 4);
                $table->decimal('due_amount', 20, 4);
                $table->date('due_date');
                $table->text('invoice_status');
                $table->text('note')->nullable();
                $table->char('generated_by', 36)->nullable();
                $table->timestamp('generated_at');
                $table->char('cancelled_by', 36)->nullable();
                $table->timestamp('cancelled_at')->nullable();
                $table->text('cancel_reason')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->decimal('season_rate', 20, 4)->nullable();
                $table->char('land_type_id', 36)->nullable();
                $table->text('land_type_name')->nullable();
                $table->json('calculation_snapshot')->nullable();
                $table->boolean('is_manual_rate');
                $table->text('manual_rate_reason')->nullable();
                $table->timestamp('recalculated_at')->nullable();
                $table->char('recalculated_by', 36)->nullable();
                $table->char('irrigation_category_id', 36)->nullable();
                $table->text('irrigation_category_name')->nullable();
                $table->text('rate_source')->nullable();
                $table->decimal('original_standard_rate', 20, 4)->nullable();
                $table->decimal('applied_rate', 20, 4)->nullable();
                $table->text('override_reason')->nullable();
                $table->decimal('previous_due_amount', 20, 4);
                $table->timestamp('carried_forward_at')->nullable();
                $table->char('carried_forward_to', 36)->nullable();
            });
        } else {
            Schema::table('irrigation_invoices', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_invoices', 'invoice_no')) {
                    $table->text('invoice_no')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'season_id')) {
                    $table->char('season_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'land_id')) {
                    $table->char('land_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'owner_farmer_id')) {
                    $table->char('owner_farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'is_borga')) {
                    $table->boolean('is_borga')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'irrigation_amount')) {
                    $table->decimal('irrigation_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'maintenance_amount')) {
                    $table->decimal('maintenance_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'canal_amount')) {
                    $table->decimal('canal_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'delay_fee')) {
                    $table->decimal('delay_fee', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'other_charge')) {
                    $table->decimal('other_charge', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'payable_amount')) {
                    $table->decimal('payable_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'paid_amount')) {
                    $table->decimal('paid_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'due_amount')) {
                    $table->decimal('due_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'due_date')) {
                    $table->date('due_date')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'invoice_status')) {
                    $table->text('invoice_status')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'generated_by')) {
                    $table->char('generated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'generated_at')) {
                    $table->timestamp('generated_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'cancelled_by')) {
                    $table->char('cancelled_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'cancelled_at')) {
                    $table->timestamp('cancelled_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'cancel_reason')) {
                    $table->text('cancel_reason')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'season_rate')) {
                    $table->decimal('season_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'land_type_id')) {
                    $table->char('land_type_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'land_type_name')) {
                    $table->text('land_type_name')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'calculation_snapshot')) {
                    $table->json('calculation_snapshot')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'is_manual_rate')) {
                    $table->boolean('is_manual_rate')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'manual_rate_reason')) {
                    $table->text('manual_rate_reason')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'recalculated_at')) {
                    $table->timestamp('recalculated_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'recalculated_by')) {
                    $table->char('recalculated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'irrigation_category_id')) {
                    $table->char('irrigation_category_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'irrigation_category_name')) {
                    $table->text('irrigation_category_name')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'rate_source')) {
                    $table->text('rate_source')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'original_standard_rate')) {
                    $table->decimal('original_standard_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'applied_rate')) {
                    $table->decimal('applied_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'override_reason')) {
                    $table->text('override_reason')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'previous_due_amount')) {
                    $table->decimal('previous_due_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'carried_forward_at')) {
                    $table->timestamp('carried_forward_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_invoices', 'carried_forward_to')) {
                    $table->char('carried_forward_to', 36)->nullable();
                }
            });
        }
        // ---- irrigation_partial_payment_settings ----
        if (! Schema::hasTable('irrigation_partial_payment_settings')) {
            Schema::create('irrigation_partial_payment_settings', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('allowed_roles');
                $table->char('updated_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('irrigation_partial_payment_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_partial_payment_settings', 'allowed_roles')) {
                    $table->text('allowed_roles')->nullable();
                }
                if (! Schema::hasColumn('irrigation_partial_payment_settings', 'updated_by')) {
                    $table->char('updated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_partial_payment_settings', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_partial_payment_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- irrigation_rate_audit_logs ----
        if (! Schema::hasTable('irrigation_rate_audit_logs')) {
            Schema::create('irrigation_rate_audit_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('irrigation_season_id', 36)->nullable();
                $table->char('land_type_id', 36)->nullable();
                $table->decimal('old_rate', 20, 4)->nullable();
                $table->decimal('new_rate', 20, 4)->nullable();
                $table->text('change_reason')->nullable();
                $table->char('changed_by', 36)->nullable();
                $table->timestamp('changed_at');
                $table->text('ip')->nullable();
                $table->text('action');
            });
        } else {
            Schema::table('irrigation_rate_audit_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'irrigation_season_id')) {
                    $table->char('irrigation_season_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'land_type_id')) {
                    $table->char('land_type_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'old_rate')) {
                    $table->decimal('old_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'new_rate')) {
                    $table->decimal('new_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'change_reason')) {
                    $table->text('change_reason')->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'changed_by')) {
                    $table->char('changed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'changed_at')) {
                    $table->timestamp('changed_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'ip')) {
                    $table->text('ip')->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_audit_logs', 'action')) {
                    $table->text('action')->nullable();
                }
            });
        }
        // ---- irrigation_rate_overrides ----
        if (! Schema::hasTable('irrigation_rate_overrides')) {
            Schema::create('irrigation_rate_overrides', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('irrigation_invoice_id', 36);
                $table->decimal('original_rate', 20, 4);
                $table->decimal('overridden_rate', 20, 4);
                $table->text('override_reason')->nullable();
                $table->char('approved_by', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('irrigation_rate_overrides', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_rate_overrides', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_overrides', 'irrigation_invoice_id')) {
                    $table->char('irrigation_invoice_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_overrides', 'original_rate')) {
                    $table->decimal('original_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_overrides', 'overridden_rate')) {
                    $table->decimal('overridden_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_overrides', 'override_reason')) {
                    $table->text('override_reason')->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_overrides', 'approved_by')) {
                    $table->char('approved_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_overrides', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rate_overrides', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- irrigation_rates ----
        if (! Schema::hasTable('irrigation_rates')) {
            Schema::create('irrigation_rates', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('season_id', 36);
                $table->text('basis');
                $table->decimal('base_rate', 20, 4);
                $table->decimal('canal_charge', 20, 4);
                $table->decimal('maintenance_charge', 20, 4);
                $table->decimal('other_charge', 20, 4);
                $table->boolean('is_active');
                $table->text('note')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('irrigation_rates', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_rates', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'season_id')) {
                    $table->char('season_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'basis')) {
                    $table->text('basis')->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'base_rate')) {
                    $table->decimal('base_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'canal_charge')) {
                    $table->decimal('canal_charge', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'maintenance_charge')) {
                    $table->decimal('maintenance_charge', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'other_charge')) {
                    $table->decimal('other_charge', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_rates', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- irrigation_season_rates ----
        if (! Schema::hasTable('irrigation_season_rates')) {
            Schema::create('irrigation_season_rates', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('irrigation_season_id', 36);
                $table->char('land_type_id', 36);
                $table->decimal('rate_per_shotok', 20, 4);
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->text('calculation_basis');
            });
        } else {
            Schema::table('irrigation_season_rates', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_season_rates', 'irrigation_season_id')) {
                    $table->char('irrigation_season_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_rates', 'land_type_id')) {
                    $table->char('land_type_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_rates', 'rate_per_shotok')) {
                    $table->decimal('rate_per_shotok', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_rates', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_rates', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_rates', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_rates', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_rates', 'calculation_basis')) {
                    $table->text('calculation_basis')->nullable();
                }
            });
        }
        // ---- irrigation_season_types ----
        if (! Schema::hasTable('irrigation_season_types')) {
            Schema::create('irrigation_season_types', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('code');
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->boolean('is_active');
                $table->integer('sort_order');
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->text('name_en')->nullable();
                $table->timestamp('deleted_at')->nullable();
            });
        } else {
            Schema::table('irrigation_season_types', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_season_types', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'sort_order')) {
                    $table->integer('sort_order')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'name_en')) {
                    $table->text('name_en')->nullable();
                }
                if (! Schema::hasColumn('irrigation_season_types', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
            });
        }
        // ---- irrigation_sms_logs ----
        if (! Schema::hasTable('irrigation_sms_logs')) {
            Schema::create('irrigation_sms_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('irrigation_invoice_id', 36)->nullable();
                $table->char('farmer_id', 36)->nullable();
                $table->text('mobile')->nullable();
                $table->text('sms_type');
                $table->text('message')->nullable();
                $table->text('status');
                $table->text('failure_reason')->nullable();
                $table->json('gateway_response')->nullable();
                $table->integer('retry_count');
                $table->char('sent_by', 36)->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('delivered_at')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('irrigation_sms_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('irrigation_sms_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'irrigation_invoice_id')) {
                    $table->char('irrigation_invoice_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'mobile')) {
                    $table->text('mobile')->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'sms_type')) {
                    $table->text('sms_type')->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'message')) {
                    $table->text('message')->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'failure_reason')) {
                    $table->text('failure_reason')->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'gateway_response')) {
                    $table->json('gateway_response')->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'retry_count')) {
                    $table->integer('retry_count')->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'sent_by')) {
                    $table->char('sent_by', 36)->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'sent_at')) {
                    $table->timestamp('sent_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable();
                }
                if (! Schema::hasColumn('irrigation_sms_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- journal_entries ----
        if (! Schema::hasTable('journal_entries')) {
            Schema::create('journal_entries', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->date('entry_date');
                $table->text('reference')->nullable();
                $table->text('description')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->boolean('posted');
                $table->timestamp('posted_at')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
            });
        } else {
            Schema::table('journal_entries', function (Blueprint $table) {
                if (! Schema::hasColumn('journal_entries', 'entry_date')) {
                    $table->date('entry_date')->nullable();
                }
                if (! Schema::hasColumn('journal_entries', 'reference')) {
                    $table->text('reference')->nullable();
                }
                if (! Schema::hasColumn('journal_entries', 'description')) {
                    $table->text('description')->nullable();
                }
                if (! Schema::hasColumn('journal_entries', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('journal_entries', 'posted')) {
                    $table->boolean('posted')->nullable();
                }
                if (! Schema::hasColumn('journal_entries', 'posted_at')) {
                    $table->timestamp('posted_at')->nullable();
                }
                if (! Schema::hasColumn('journal_entries', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('journal_entries', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('journal_entries', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('journal_entries', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
            });
        }
        // ---- journal_entry_lines ----
        if (! Schema::hasTable('journal_entry_lines')) {
            Schema::create('journal_entry_lines', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('journal_id', 36);
                $table->char('account_id', 36);
                $table->decimal('debit', 20, 4);
                $table->decimal('credit', 20, 4);
                $table->text('description')->nullable();
                $table->integer('position');
            });
        } else {
            Schema::table('journal_entry_lines', function (Blueprint $table) {
                if (! Schema::hasColumn('journal_entry_lines', 'journal_id')) {
                    $table->char('journal_id', 36)->nullable();
                }
                if (! Schema::hasColumn('journal_entry_lines', 'account_id')) {
                    $table->char('account_id', 36)->nullable();
                }
                if (! Schema::hasColumn('journal_entry_lines', 'debit')) {
                    $table->decimal('debit', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('journal_entry_lines', 'credit')) {
                    $table->decimal('credit', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('journal_entry_lines', 'description')) {
                    $table->text('description')->nullable();
                }
                if (! Schema::hasColumn('journal_entry_lines', 'position')) {
                    $table->integer('position')->nullable();
                }
            });
        }
        // ---- land_change_log ----
        if (! Schema::hasTable('land_change_log')) {
            Schema::create('land_change_log', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('land_id', 36)->nullable();
                $table->char('farmer_id', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->text('change_type');
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                $table->text('remarks')->nullable();
                $table->char('changed_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('land_change_log', function (Blueprint $table) {
                if (! Schema::hasColumn('land_change_log', 'land_id')) {
                    $table->char('land_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_change_log', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_change_log', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_change_log', 'change_type')) {
                    $table->text('change_type')->nullable();
                }
                if (! Schema::hasColumn('land_change_log', 'old_values')) {
                    $table->json('old_values')->nullable();
                }
                if (! Schema::hasColumn('land_change_log', 'new_values')) {
                    $table->json('new_values')->nullable();
                }
                if (! Schema::hasColumn('land_change_log', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('land_change_log', 'changed_by')) {
                    $table->char('changed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('land_change_log', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- land_history ----
        if (! Schema::hasTable('land_history')) {
            Schema::create('land_history', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('land_id', 36)->nullable();
                $table->char('farmer_id', 36);
                $table->integer('fiscal_year');
                $table->text('season')->nullable();
                $table->text('mouza')->nullable();
                $table->text('dag_no')->nullable();
                $table->decimal('land_size', 20, 4);
                $table->text('owner_type')->nullable();
                $table->text('field_type')->nullable();
                $table->char('cultivator_farmer_id', 36)->nullable();
                $table->text('remarks')->nullable();
                $table->char('recorded_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->text('crop')->nullable();
                $table->decimal('yield_amount', 20, 4)->nullable();
                $table->text('yield_unit')->nullable();
            });
        } else {
            Schema::table('land_history', function (Blueprint $table) {
                if (! Schema::hasColumn('land_history', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_history', 'land_id')) {
                    $table->char('land_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_history', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_history', 'fiscal_year')) {
                    $table->integer('fiscal_year')->nullable();
                }
                if (! Schema::hasColumn('land_history', 'season')) {
                    $table->text('season')->nullable();
                }
                if (! Schema::hasColumn('land_history', 'mouza')) {
                    $table->text('mouza')->nullable();
                }
                if (! Schema::hasColumn('land_history', 'dag_no')) {
                    $table->text('dag_no')->nullable();
                }
                if (! Schema::hasColumn('land_history', 'land_size')) {
                    $table->decimal('land_size', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('land_history', 'owner_type')) {
                    $table->text('owner_type')->nullable();
                }
                if (! Schema::hasColumn('land_history', 'field_type')) {
                    $table->text('field_type')->nullable();
                }
                if (! Schema::hasColumn('land_history', 'cultivator_farmer_id')) {
                    $table->char('cultivator_farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_history', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
                if (! Schema::hasColumn('land_history', 'recorded_by')) {
                    $table->char('recorded_by', 36)->nullable();
                }
                if (! Schema::hasColumn('land_history', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('land_history', 'crop')) {
                    $table->text('crop')->nullable();
                }
                if (! Schema::hasColumn('land_history', 'yield_amount')) {
                    $table->decimal('yield_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('land_history', 'yield_unit')) {
                    $table->text('yield_unit')->nullable();
                }
            });
        }
        // ---- land_note_attachments ----
        if (! Schema::hasTable('land_note_attachments')) {
            Schema::create('land_note_attachments', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('land_id', 36);
                $table->char('office_id', 36)->nullable();
                $table->text('file_path');
                $table->text('file_name');
                $table->text('content_type')->nullable();
                $table->bigInteger('size_bytes')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('land_note_attachments', function (Blueprint $table) {
                if (! Schema::hasColumn('land_note_attachments', 'land_id')) {
                    $table->char('land_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_note_attachments', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_note_attachments', 'file_path')) {
                    $table->text('file_path')->nullable();
                }
                if (! Schema::hasColumn('land_note_attachments', 'file_name')) {
                    $table->text('file_name')->nullable();
                }
                if (! Schema::hasColumn('land_note_attachments', 'content_type')) {
                    $table->text('content_type')->nullable();
                }
                if (! Schema::hasColumn('land_note_attachments', 'size_bytes')) {
                    $table->bigInteger('size_bytes')->nullable();
                }
                if (! Schema::hasColumn('land_note_attachments', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('land_note_attachments', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- land_note_audit ----
        if (! Schema::hasTable('land_note_audit')) {
            Schema::create('land_note_audit', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('land_id', 36);
                $table->char('office_id', 36)->nullable();
                $table->text('old_note')->nullable();
                $table->text('new_note')->nullable();
                $table->char('changed_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('land_note_audit', function (Blueprint $table) {
                if (! Schema::hasColumn('land_note_audit', 'land_id')) {
                    $table->char('land_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_note_audit', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_note_audit', 'old_note')) {
                    $table->text('old_note')->nullable();
                }
                if (! Schema::hasColumn('land_note_audit', 'new_note')) {
                    $table->text('new_note')->nullable();
                }
                if (! Schema::hasColumn('land_note_audit', 'changed_by')) {
                    $table->char('changed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('land_note_audit', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- land_relations ----
        if (! Schema::hasTable('land_relations')) {
            Schema::create('land_relations', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('land_id', 36);
                $table->char('owner_farmer_id', 36);
                $table->char('sharecropper_farmer_id', 36)->nullable();
                $table->decimal('share_percentage', 20, 4);
                $table->date('valid_from');
                $table->date('valid_to')->nullable();
                $table->text('note')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->decimal('area_decimal', 20, 4)->nullable();
            });
        } else {
            Schema::table('land_relations', function (Blueprint $table) {
                if (! Schema::hasColumn('land_relations', 'land_id')) {
                    $table->char('land_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'owner_farmer_id')) {
                    $table->char('owner_farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'sharecropper_farmer_id')) {
                    $table->char('sharecropper_farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'share_percentage')) {
                    $table->decimal('share_percentage', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'valid_from')) {
                    $table->date('valid_from')->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'valid_to')) {
                    $table->date('valid_to')->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('land_relations', 'area_decimal')) {
                    $table->decimal('area_decimal', 20, 4)->nullable();
                }
            });
        }
        // ---- land_transfer_integrity_runs ----
        if (! Schema::hasTable('land_transfer_integrity_runs')) {
            Schema::create('land_transfer_integrity_runs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('run_type');
                $table->text('status');
                $table->char('office_id', 36)->nullable();
                $table->date('date_from')->nullable();
                $table->date('date_to')->nullable();
                $table->integer('total_transfers');
                $table->integer('error_count');
                $table->integer('warning_count');
                $table->json('summary')->nullable();
                $table->json('violations')->nullable();
                $table->text('error_message')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('land_transfer_integrity_runs', function (Blueprint $table) {
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'run_type')) {
                    $table->text('run_type')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'date_from')) {
                    $table->date('date_from')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'date_to')) {
                    $table->date('date_to')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'total_transfers')) {
                    $table->integer('total_transfers')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'error_count')) {
                    $table->integer('error_count')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'warning_count')) {
                    $table->integer('warning_count')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'summary')) {
                    $table->json('summary')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'violations')) {
                    $table->json('violations')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'error_message')) {
                    $table->text('error_message')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('land_transfer_integrity_runs', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- land_transfer_recipients ----
        if (! Schema::hasTable('land_transfer_recipients')) {
            Schema::create('land_transfer_recipients', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('transfer_id', 36);
                $table->char('recipient_farmer_id', 36);
                $table->char('new_land_id', 36)->nullable();
                $table->decimal('area_decimal', 20, 4);
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('land_transfer_recipients', function (Blueprint $table) {
                if (! Schema::hasColumn('land_transfer_recipients', 'transfer_id')) {
                    $table->char('transfer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_transfer_recipients', 'recipient_farmer_id')) {
                    $table->char('recipient_farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_transfer_recipients', 'new_land_id')) {
                    $table->char('new_land_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_transfer_recipients', 'area_decimal')) {
                    $table->decimal('area_decimal', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('land_transfer_recipients', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- land_transfers ----
        if (! Schema::hasTable('land_transfers')) {
            Schema::create('land_transfers', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('source_land_id', 36);
                $table->char('source_farmer_id', 36);
                $table->text('transfer_type');
                $table->text('remark')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->date('transferred_at');
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->text('source_dag_no')->nullable();
                $table->text('source_mouza')->nullable();
                $table->decimal('source_land_size', 20, 4)->nullable();
                $table->text('source_owner_name')->nullable();
                $table->text('source_owner_code')->nullable();
            });
        } else {
            Schema::table('land_transfers', function (Blueprint $table) {
                if (! Schema::hasColumn('land_transfers', 'source_land_id')) {
                    $table->char('source_land_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'source_farmer_id')) {
                    $table->char('source_farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'transfer_type')) {
                    $table->text('transfer_type')->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'remark')) {
                    $table->text('remark')->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'transferred_at')) {
                    $table->date('transferred_at')->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'source_dag_no')) {
                    $table->text('source_dag_no')->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'source_mouza')) {
                    $table->text('source_mouza')->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'source_land_size')) {
                    $table->decimal('source_land_size', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'source_owner_name')) {
                    $table->text('source_owner_name')->nullable();
                }
                if (! Schema::hasColumn('land_transfers', 'source_owner_code')) {
                    $table->text('source_owner_code')->nullable();
                }
            });
        }
        // ---- land_types ----
        if (! Schema::hasTable('land_types')) {
            Schema::create('land_types', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('code');
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->boolean('is_active');
                $table->integer('sort_order');
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->text('name_en')->nullable();
                $table->timestamp('deleted_at')->nullable();
            });
        } else {
            Schema::table('land_types', function (Blueprint $table) {
                if (! Schema::hasColumn('land_types', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('land_types', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('land_types', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('land_types', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('land_types', 'sort_order')) {
                    $table->integer('sort_order')->nullable();
                }
                if (! Schema::hasColumn('land_types', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('land_types', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('land_types', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('land_types', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('land_types', 'name_en')) {
                    $table->text('name_en')->nullable();
                }
                if (! Schema::hasColumn('land_types', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
            });
        }
        // ---- lands ----
        if (! Schema::hasTable('lands')) {
            Schema::create('lands', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->text('mouza')->nullable();
                $table->text('dag_no')->nullable();
                $table->decimal('land_size', 20, 4);
                $table->text('owner_type');
                $table->text('field_type');
                $table->timestamp('created_at')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->char('owner_farmer_id', 36)->nullable();
                $table->char('division_id', 36)->nullable();
                $table->char('district_id', 36)->nullable();
                $table->char('upazila_id', 36)->nullable();
                $table->char('mouza_id', 36)->nullable();
                $table->char('land_type_id', 36)->nullable();
                $table->text('dag_numbers');
                $table->char('patwari_id', 36)->nullable();
                $table->text('notes')->nullable();
                $table->text('remarks')->nullable();
            });
        } else {
            Schema::table('lands', function (Blueprint $table) {
                if (! Schema::hasColumn('lands', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'mouza')) {
                    $table->text('mouza')->nullable();
                }
                if (! Schema::hasColumn('lands', 'dag_no')) {
                    $table->text('dag_no')->nullable();
                }
                if (! Schema::hasColumn('lands', 'land_size')) {
                    $table->decimal('land_size', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('lands', 'owner_type')) {
                    $table->text('owner_type')->nullable();
                }
                if (! Schema::hasColumn('lands', 'field_type')) {
                    $table->text('field_type')->nullable();
                }
                if (! Schema::hasColumn('lands', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('lands', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('lands', 'owner_farmer_id')) {
                    $table->char('owner_farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'division_id')) {
                    $table->char('division_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'district_id')) {
                    $table->char('district_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'upazila_id')) {
                    $table->char('upazila_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'mouza_id')) {
                    $table->char('mouza_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'land_type_id')) {
                    $table->char('land_type_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'dag_numbers')) {
                    $table->text('dag_numbers')->nullable();
                }
                if (! Schema::hasColumn('lands', 'patwari_id')) {
                    $table->char('patwari_id', 36)->nullable();
                }
                if (! Schema::hasColumn('lands', 'notes')) {
                    $table->text('notes')->nullable();
                }
                if (! Schema::hasColumn('lands', 'remarks')) {
                    $table->text('remarks')->nullable();
                }
            });
        }
        // ---- ledger_entries ----
        if (! Schema::hasTable('ledger_entries')) {
            Schema::create('ledger_entries', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->date('entry_date');
                $table->char('account_id', 36);
                $table->decimal('debit', 20, 4);
                $table->decimal('credit', 20, 4);
                $table->text('reference_type')->nullable();
                $table->char('reference_id', 36)->nullable();
                $table->text('description')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('ledger_entries', function (Blueprint $table) {
                if (! Schema::hasColumn('ledger_entries', 'entry_date')) {
                    $table->date('entry_date')->nullable();
                }
                if (! Schema::hasColumn('ledger_entries', 'account_id')) {
                    $table->char('account_id', 36)->nullable();
                }
                if (! Schema::hasColumn('ledger_entries', 'debit')) {
                    $table->decimal('debit', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('ledger_entries', 'credit')) {
                    $table->decimal('credit', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('ledger_entries', 'reference_type')) {
                    $table->text('reference_type')->nullable();
                }
                if (! Schema::hasColumn('ledger_entries', 'reference_id')) {
                    $table->char('reference_id', 36)->nullable();
                }
                if (! Schema::hasColumn('ledger_entries', 'description')) {
                    $table->text('description')->nullable();
                }
                if (! Schema::hasColumn('ledger_entries', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('ledger_entries', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('ledger_entries', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- loan_delay_fee_settings ----
        if (! Schema::hasTable('loan_delay_fee_settings')) {
            Schema::create('loan_delay_fee_settings', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->text('mode');
                $table->decimal('value', 20, 4);
                $table->integer('grace_days');
                $table->boolean('auto_apply');
                $table->boolean('allow_partial_installment');
                $table->char('created_by', 36)->nullable();
                $table->char('updated_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->decimal('daily_penalty', 20, 4);
                $table->decimal('max_penalty', 20, 4)->nullable();
                $table->text('enforcement_mode');
            });
        } else {
            Schema::table('loan_delay_fee_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('loan_delay_fee_settings', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'mode')) {
                    $table->text('mode')->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'value')) {
                    $table->decimal('value', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'grace_days')) {
                    $table->integer('grace_days')->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'auto_apply')) {
                    $table->boolean('auto_apply')->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'allow_partial_installment')) {
                    $table->boolean('allow_partial_installment')->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'updated_by')) {
                    $table->char('updated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'daily_penalty')) {
                    $table->decimal('daily_penalty', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'max_penalty')) {
                    $table->decimal('max_penalty', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_delay_fee_settings', 'enforcement_mode')) {
                    $table->text('enforcement_mode')->nullable();
                }
            });
        }
        // ---- loan_discount_audit ----
        if (! Schema::hasTable('loan_discount_audit')) {
            Schema::create('loan_discount_audit', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('loan_id', 36);
                $table->char('payment_id', 36)->nullable();
                $table->text('receipt_no')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->char('changed_by', 36)->nullable();
                $table->decimal('interest_before', 20, 4);
                $table->decimal('interest_after', 20, 4);
                $table->decimal('discount_before', 20, 4);
                $table->decimal('discount_after', 20, 4);
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('loan_discount_audit', function (Blueprint $table) {
                if (! Schema::hasColumn('loan_discount_audit', 'loan_id')) {
                    $table->char('loan_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'payment_id')) {
                    $table->char('payment_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'receipt_no')) {
                    $table->text('receipt_no')->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'changed_by')) {
                    $table->char('changed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'interest_before')) {
                    $table->decimal('interest_before', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'interest_after')) {
                    $table->decimal('interest_after', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'discount_before')) {
                    $table->decimal('discount_before', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'discount_after')) {
                    $table->decimal('discount_after', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('loan_discount_audit', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- loan_guarantors ----
        if (! Schema::hasTable('loan_guarantors')) {
            Schema::create('loan_guarantors', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('loan_id', 36);
                $table->char('farmer_id', 36)->nullable();
                $table->text('name');
                $table->text('father_name')->nullable();
                $table->text('village')->nullable();
                $table->text('mobile')->nullable();
                $table->text('nid')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->text('role');
            });
        } else {
            Schema::table('loan_guarantors', function (Blueprint $table) {
                if (! Schema::hasColumn('loan_guarantors', 'loan_id')) {
                    $table->char('loan_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_guarantors', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_guarantors', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('loan_guarantors', 'father_name')) {
                    $table->text('father_name')->nullable();
                }
                if (! Schema::hasColumn('loan_guarantors', 'village')) {
                    $table->text('village')->nullable();
                }
                if (! Schema::hasColumn('loan_guarantors', 'mobile')) {
                    $table->text('mobile')->nullable();
                }
                if (! Schema::hasColumn('loan_guarantors', 'nid')) {
                    $table->text('nid')->nullable();
                }
                if (! Schema::hasColumn('loan_guarantors', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_guarantors', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('loan_guarantors', 'role')) {
                    $table->text('role')->nullable();
                }
            });
        }
        // ---- loan_installment_delay_audit ----
        if (! Schema::hasTable('loan_installment_delay_audit')) {
            Schema::create('loan_installment_delay_audit', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('installment_id', 36);
                $table->char('loan_id', 36);
                $table->char('payment_id', 36)->nullable();
                $table->decimal('original_amount', 20, 4);
                $table->decimal('modified_amount', 20, 4);
                $table->text('reason')->nullable();
                $table->char('changed_by', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('loan_installment_delay_audit', function (Blueprint $table) {
                if (! Schema::hasColumn('loan_installment_delay_audit', 'installment_id')) {
                    $table->char('installment_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_installment_delay_audit', 'loan_id')) {
                    $table->char('loan_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_installment_delay_audit', 'payment_id')) {
                    $table->char('payment_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_installment_delay_audit', 'original_amount')) {
                    $table->decimal('original_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_installment_delay_audit', 'modified_amount')) {
                    $table->decimal('modified_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_installment_delay_audit', 'reason')) {
                    $table->text('reason')->nullable();
                }
                if (! Schema::hasColumn('loan_installment_delay_audit', 'changed_by')) {
                    $table->char('changed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_installment_delay_audit', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_installment_delay_audit', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- loan_installments ----
        if (! Schema::hasTable('loan_installments')) {
            Schema::create('loan_installments', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('loan_id', 36);
                $table->integer('installment_no');
                $table->date('due_date');
                $table->decimal('amount', 20, 4);
                $table->decimal('paid_amount', 20, 4);
                $table->decimal('penalty_amount', 20, 4);
                $table->text('status');
                $table->date('paid_on')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->integer('overdue_days');
                $table->json('penalty_rule_snapshot')->nullable();
                $table->boolean('strict_validation_override');
            });
        } else {
            Schema::table('loan_installments', function (Blueprint $table) {
                if (! Schema::hasColumn('loan_installments', 'loan_id')) {
                    $table->char('loan_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'installment_no')) {
                    $table->integer('installment_no')->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'due_date')) {
                    $table->date('due_date')->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'paid_amount')) {
                    $table->decimal('paid_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'penalty_amount')) {
                    $table->decimal('penalty_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'paid_on')) {
                    $table->date('paid_on')->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'overdue_days')) {
                    $table->integer('overdue_days')->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'penalty_rule_snapshot')) {
                    $table->json('penalty_rule_snapshot')->nullable();
                }
                if (! Schema::hasColumn('loan_installments', 'strict_validation_override')) {
                    $table->boolean('strict_validation_override')->nullable();
                }
            });
        }
        // ---- loan_payments ----
        if (! Schema::hasTable('loan_payments')) {
            Schema::create('loan_payments', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('loan_id', 36);
                $table->decimal('amount', 20, 4);
                $table->date('paid_on');
                $table->char('collected_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->text('status');
                $table->char('approved_by', 36)->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->text('approval_note')->nullable();
                $table->text('note')->nullable();
                $table->decimal('penalty_collected', 20, 4);
                $table->text('override_reason')->nullable();
                $table->char('override_by', 36)->nullable();
                $table->text('receipt_no')->nullable();
                $table->decimal('principal_amount', 20, 4)->nullable();
                $table->decimal('interest_amount', 20, 4)->nullable();
                $table->decimal('discount_amount', 20, 4);
            });
        } else {
            Schema::table('loan_payments', function (Blueprint $table) {
                if (! Schema::hasColumn('loan_payments', 'loan_id')) {
                    $table->char('loan_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'paid_on')) {
                    $table->date('paid_on')->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'collected_by')) {
                    $table->char('collected_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'approved_by')) {
                    $table->char('approved_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'approved_at')) {
                    $table->timestamp('approved_at')->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'approval_note')) {
                    $table->text('approval_note')->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'penalty_collected')) {
                    $table->decimal('penalty_collected', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'override_reason')) {
                    $table->text('override_reason')->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'override_by')) {
                    $table->char('override_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'receipt_no')) {
                    $table->text('receipt_no')->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'principal_amount')) {
                    $table->decimal('principal_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'interest_amount')) {
                    $table->decimal('interest_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_payments', 'discount_amount')) {
                    $table->decimal('discount_amount', 20, 4)->nullable();
                }
            });
        }
        // ---- loan_plans ----
        if (! Schema::hasTable('loan_plans')) {
            Schema::create('loan_plans', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->integer('duration_months');
                $table->text('installment_type');
                $table->decimal('interest_rate', 20, 4);
                $table->text('penalty_type');
                $table->decimal('penalty_value', 20, 4);
                $table->integer('grace_period_days');
                $table->boolean('is_active');
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('loan_plans', function (Blueprint $table) {
                if (! Schema::hasColumn('loan_plans', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'duration_months')) {
                    $table->integer('duration_months')->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'installment_type')) {
                    $table->text('installment_type')->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'interest_rate')) {
                    $table->decimal('interest_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'penalty_type')) {
                    $table->text('penalty_type')->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'penalty_value')) {
                    $table->decimal('penalty_value', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'grace_period_days')) {
                    $table->integer('grace_period_days')->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('loan_plans', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- loans ----
        if (! Schema::hasTable('loans')) {
            Schema::create('loans', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->decimal('principal', 20, 4);
                $table->boolean('interest_enabled');
                $table->decimal('interest_rate', 20, 4);
                $table->decimal('total_payable', 20, 4);
                $table->date('issued_on');
                $table->date('next_due_on')->nullable();
                $table->text('status');
                $table->char('approved_by', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->text('approval_note')->nullable();
                $table->char('plan_id', 36)->nullable();
                $table->decimal('installment_amount', 20, 4)->nullable();
                $table->decimal('total_due', 20, 4)->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->boolean('is_temporary');
                $table->text('temp_purpose')->nullable();
                $table->text('loan_no')->nullable();
                $table->text('repayment_mode');
                $table->date('fully_paid_on')->nullable();
            });
        } else {
            Schema::table('loans', function (Blueprint $table) {
                if (! Schema::hasColumn('loans', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loans', 'principal')) {
                    $table->decimal('principal', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loans', 'interest_enabled')) {
                    $table->boolean('interest_enabled')->nullable();
                }
                if (! Schema::hasColumn('loans', 'interest_rate')) {
                    $table->decimal('interest_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loans', 'total_payable')) {
                    $table->decimal('total_payable', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loans', 'issued_on')) {
                    $table->date('issued_on')->nullable();
                }
                if (! Schema::hasColumn('loans', 'next_due_on')) {
                    $table->date('next_due_on')->nullable();
                }
                if (! Schema::hasColumn('loans', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('loans', 'approved_by')) {
                    $table->char('approved_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loans', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('loans', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('loans', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('loans', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('loans', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loans', 'approval_note')) {
                    $table->text('approval_note')->nullable();
                }
                if (! Schema::hasColumn('loans', 'plan_id')) {
                    $table->char('plan_id', 36)->nullable();
                }
                if (! Schema::hasColumn('loans', 'installment_amount')) {
                    $table->decimal('installment_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loans', 'total_due')) {
                    $table->decimal('total_due', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('loans', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('loans', 'is_temporary')) {
                    $table->boolean('is_temporary')->nullable();
                }
                if (! Schema::hasColumn('loans', 'temp_purpose')) {
                    $table->text('temp_purpose')->nullable();
                }
                if (! Schema::hasColumn('loans', 'loan_no')) {
                    $table->text('loan_no')->nullable();
                }
                if (! Schema::hasColumn('loans', 'repayment_mode')) {
                    $table->text('repayment_mode')->nullable();
                }
                if (! Schema::hasColumn('loans', 'fully_paid_on')) {
                    $table->date('fully_paid_on')->nullable();
                }
            });
        }
        // ---- member_block_audit ----
        if (! Schema::hasTable('member_block_audit')) {
            Schema::create('member_block_audit', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('attempted_by', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->char('farmer_id', 36)->nullable();
                $table->text('transaction_type');
                $table->text('reason');
                $table->text('member_no')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('member_block_audit', function (Blueprint $table) {
                if (! Schema::hasColumn('member_block_audit', 'attempted_by')) {
                    $table->char('attempted_by', 36)->nullable();
                }
                if (! Schema::hasColumn('member_block_audit', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('member_block_audit', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('member_block_audit', 'transaction_type')) {
                    $table->text('transaction_type')->nullable();
                }
                if (! Schema::hasColumn('member_block_audit', 'reason')) {
                    $table->text('reason')->nullable();
                }
                if (! Schema::hasColumn('member_block_audit', 'member_no')) {
                    $table->text('member_no')->nullable();
                }
                if (! Schema::hasColumn('member_block_audit', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- mouzas ----
        if (! Schema::hasTable('mouzas')) {
            Schema::create('mouzas', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('upazila_id', 36);
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->text('code')->nullable();
                $table->boolean('is_active');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('mouzas', function (Blueprint $table) {
                if (! Schema::hasColumn('mouzas', 'upazila_id')) {
                    $table->char('upazila_id', 36)->nullable();
                }
                if (! Schema::hasColumn('mouzas', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('mouzas', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('mouzas', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('mouzas', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('mouzas', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('mouzas', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- notifications ----
        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('user_id', 36)->nullable();
                $table->text('kind');
                $table->text('title');
                $table->text('body')->nullable();
                $table->text('link')->nullable();
                $table->boolean('read');
                $table->timestamp('created_at')->nullable();
                $table->boolean('archived');
            });
        } else {
            Schema::table('notifications', function (Blueprint $table) {
                if (! Schema::hasColumn('notifications', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('notifications', 'kind')) {
                    $table->text('kind')->nullable();
                }
                if (! Schema::hasColumn('notifications', 'title')) {
                    $table->text('title')->nullable();
                }
                if (! Schema::hasColumn('notifications', 'body')) {
                    $table->text('body')->nullable();
                }
                if (! Schema::hasColumn('notifications', 'link')) {
                    $table->text('link')->nullable();
                }
                if (! Schema::hasColumn('notifications', 'read')) {
                    $table->boolean('read')->nullable();
                }
                if (! Schema::hasColumn('notifications', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('notifications', 'archived')) {
                    $table->boolean('archived')->nullable();
                }
            });
        }
        // ---- office_incomes ----
        if (! Schema::hasTable('office_incomes')) {
            Schema::create('office_incomes', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->text('receipt_no');
                $table->text('income_type');
                $table->text('payer_name');
                $table->decimal('amount', 20, 4);
                $table->date('received_on');
                $table->text('stream');
                $table->text('note')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->text('father_name')->nullable();
                $table->text('village')->nullable();
                $table->text('mobile')->nullable();
            });
        } else {
            Schema::table('office_incomes', function (Blueprint $table) {
                if (! Schema::hasColumn('office_incomes', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'receipt_no')) {
                    $table->text('receipt_no')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'income_type')) {
                    $table->text('income_type')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'payer_name')) {
                    $table->text('payer_name')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'received_on')) {
                    $table->date('received_on')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'stream')) {
                    $table->text('stream')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'father_name')) {
                    $table->text('father_name')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'village')) {
                    $table->text('village')->nullable();
                }
                if (! Schema::hasColumn('office_incomes', 'mobile')) {
                    $table->text('mobile')->nullable();
                }
            });
        }
        // ---- offices ----
        if (! Schema::hasTable('offices')) {
            Schema::create('offices', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('name');
                $table->text('registration_no')->nullable();
                $table->date('established_on')->nullable();
                $table->text('contact')->nullable();
                $table->text('address')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->text('payment_priority');
            });
        } else {
            Schema::table('offices', function (Blueprint $table) {
                if (! Schema::hasColumn('offices', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('offices', 'registration_no')) {
                    $table->text('registration_no')->nullable();
                }
                if (! Schema::hasColumn('offices', 'established_on')) {
                    $table->date('established_on')->nullable();
                }
                if (! Schema::hasColumn('offices', 'contact')) {
                    $table->text('contact')->nullable();
                }
                if (! Schema::hasColumn('offices', 'address')) {
                    $table->text('address')->nullable();
                }
                if (! Schema::hasColumn('offices', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('offices', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('offices', 'payment_priority')) {
                    $table->text('payment_priority')->nullable();
                }
            });
        }
        // ---- patwaris ----
        if (! Schema::hasTable('patwaris')) {
            Schema::create('patwaris', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->text('mobile')->nullable();
                $table->text('nid')->nullable();
                $table->text('address')->nullable();
                $table->char('mouza_id', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->boolean('is_active');
                $table->text('note')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->char('created_by', 36)->nullable();
            });
        } else {
            Schema::table('patwaris', function (Blueprint $table) {
                if (! Schema::hasColumn('patwaris', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'mobile')) {
                    $table->text('mobile')->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'nid')) {
                    $table->text('nid')->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'address')) {
                    $table->text('address')->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'mouza_id')) {
                    $table->char('mouza_id', 36)->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('patwaris', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
            });
        }
        // ---- payment_allocations ----
        if (! Schema::hasTable('payment_allocations')) {
            Schema::create('payment_allocations', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('payment_id', 36);
                $table->text('kind');
                $table->char('reference_id', 36)->nullable();
                $table->decimal('amount', 20, 4);
                $table->char('office_id', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('payment_allocations', function (Blueprint $table) {
                if (! Schema::hasColumn('payment_allocations', 'payment_id')) {
                    $table->char('payment_id', 36)->nullable();
                }
                if (! Schema::hasColumn('payment_allocations', 'kind')) {
                    $table->text('kind')->nullable();
                }
                if (! Schema::hasColumn('payment_allocations', 'reference_id')) {
                    $table->char('reference_id', 36)->nullable();
                }
                if (! Schema::hasColumn('payment_allocations', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('payment_allocations', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('payment_allocations', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- payments ----
        if (! Schema::hasTable('payments')) {
            Schema::create('payments', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->text('kind');
                $table->char('reference_id', 36)->nullable();
                $table->decimal('amount', 20, 4);
                $table->text('method')->nullable();
                $table->text('note')->nullable();
                $table->char('collected_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->text('receipt_url')->nullable();
                $table->text('status');
                $table->char('approved_by', 36)->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->text('idempotency_key')->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->text('receipt_no')->nullable();
                $table->char('patwari_id', 36)->nullable();
                $table->text('verify_token');
                $table->timestamp('voided_at')->nullable();
                $table->char('voided_by', 36)->nullable();
                $table->text('void_reason')->nullable();
                $table->text('category');
            });
        } else {
            Schema::table('payments', function (Blueprint $table) {
                if (! Schema::hasColumn('payments', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('payments', 'kind')) {
                    $table->text('kind')->nullable();
                }
                if (! Schema::hasColumn('payments', 'reference_id')) {
                    $table->char('reference_id', 36)->nullable();
                }
                if (! Schema::hasColumn('payments', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('payments', 'method')) {
                    $table->text('method')->nullable();
                }
                if (! Schema::hasColumn('payments', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('payments', 'collected_by')) {
                    $table->char('collected_by', 36)->nullable();
                }
                if (! Schema::hasColumn('payments', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('payments', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('payments', 'receipt_url')) {
                    $table->text('receipt_url')->nullable();
                }
                if (! Schema::hasColumn('payments', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('payments', 'approved_by')) {
                    $table->char('approved_by', 36)->nullable();
                }
                if (! Schema::hasColumn('payments', 'approved_at')) {
                    $table->timestamp('approved_at')->nullable();
                }
                if (! Schema::hasColumn('payments', 'idempotency_key')) {
                    $table->text('idempotency_key')->nullable();
                }
                if (! Schema::hasColumn('payments', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('payments', 'receipt_no')) {
                    $table->text('receipt_no')->nullable();
                }
                if (! Schema::hasColumn('payments', 'patwari_id')) {
                    $table->char('patwari_id', 36)->nullable();
                }
                if (! Schema::hasColumn('payments', 'verify_token')) {
                    $table->text('verify_token')->nullable();
                }
                if (! Schema::hasColumn('payments', 'voided_at')) {
                    $table->timestamp('voided_at')->nullable();
                }
                if (! Schema::hasColumn('payments', 'voided_by')) {
                    $table->char('voided_by', 36)->nullable();
                }
                if (! Schema::hasColumn('payments', 'void_reason')) {
                    $table->text('void_reason')->nullable();
                }
                if (! Schema::hasColumn('payments', 'category')) {
                    $table->text('category')->nullable();
                }
            });
        }
        // ---- permission_audit_logs ----
        if (! Schema::hasTable('permission_audit_logs')) {
            Schema::create('permission_audit_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('changed_by', 36)->nullable();
                $table->text('role')->nullable();
                $table->char('target_user_id', 36)->nullable();
                $table->text('module');
                $table->text('action');
                $table->boolean('old_value')->nullable();
                $table->boolean('new_value')->nullable();
                $table->text('reason')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('permission_audit_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('permission_audit_logs', 'changed_by')) {
                    $table->char('changed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('permission_audit_logs', 'role')) {
                    $table->text('role')->nullable();
                }
                if (! Schema::hasColumn('permission_audit_logs', 'target_user_id')) {
                    $table->char('target_user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('permission_audit_logs', 'module')) {
                    $table->text('module')->nullable();
                }
                if (! Schema::hasColumn('permission_audit_logs', 'action')) {
                    $table->text('action')->nullable();
                }
                if (! Schema::hasColumn('permission_audit_logs', 'old_value')) {
                    $table->boolean('old_value')->nullable();
                }
                if (! Schema::hasColumn('permission_audit_logs', 'new_value')) {
                    $table->boolean('new_value')->nullable();
                }
                if (! Schema::hasColumn('permission_audit_logs', 'reason')) {
                    $table->text('reason')->nullable();
                }
                if (! Schema::hasColumn('permission_audit_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- profiles ----
        if (! Schema::hasTable('profiles')) {
            Schema::create('profiles', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('full_name')->nullable();
                $table->text('email')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->text('language_pref');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->text('username')->nullable();
                $table->json('receipt_options')->nullable();
            });
        } else {
            Schema::table('profiles', function (Blueprint $table) {
                if (! Schema::hasColumn('profiles', 'full_name')) {
                    $table->text('full_name')->nullable();
                }
                if (! Schema::hasColumn('profiles', 'email')) {
                    $table->text('email')->nullable();
                }
                if (! Schema::hasColumn('profiles', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('profiles', 'language_pref')) {
                    $table->text('language_pref')->nullable();
                }
                if (! Schema::hasColumn('profiles', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('profiles', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('profiles', 'username')) {
                    $table->text('username')->nullable();
                }
                if (! Schema::hasColumn('profiles', 'receipt_options')) {
                    $table->json('receipt_options')->nullable();
                }
            });
        }
        // ---- public_payment_intents ----
        if (! Schema::hasTable('public_payment_intents')) {
            Schema::create('public_payment_intents', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('farmer_code');
                $table->text('phone')->nullable();
                $table->decimal('amount', 20, 4);
                $table->text('allocation_hint')->nullable();
                $table->text('note')->nullable();
                $table->text('status');
                $table->char('processed_by', 36)->nullable();
                $table->timestamp('processed_at')->nullable();
                $table->char('payment_id', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->char('office_id', 36)->nullable();
            });
        } else {
            Schema::table('public_payment_intents', function (Blueprint $table) {
                if (! Schema::hasColumn('public_payment_intents', 'farmer_code')) {
                    $table->text('farmer_code')->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'phone')) {
                    $table->text('phone')->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'allocation_hint')) {
                    $table->text('allocation_hint')->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'processed_by')) {
                    $table->char('processed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'processed_at')) {
                    $table->timestamp('processed_at')->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'payment_id')) {
                    $table->char('payment_id', 36)->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('public_payment_intents', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
            });
        }
        // ---- qr_rotation_settings ----
        if (! Schema::hasTable('qr_rotation_settings')) {
            Schema::create('qr_rotation_settings', function (Blueprint $table) {
                $table->integer('id');
                $table->boolean('enabled');
                $table->integer('interval_days');
                $table->integer('grace_hours');
                $table->timestamp('last_run_at')->nullable();
                $table->json('last_run_summary')->nullable();
                $table->char('updated_by', 36)->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('qr_rotation_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('qr_rotation_settings', 'enabled')) {
                    $table->boolean('enabled')->nullable();
                }
                if (! Schema::hasColumn('qr_rotation_settings', 'interval_days')) {
                    $table->integer('interval_days')->nullable();
                }
                if (! Schema::hasColumn('qr_rotation_settings', 'grace_hours')) {
                    $table->integer('grace_hours')->nullable();
                }
                if (! Schema::hasColumn('qr_rotation_settings', 'last_run_at')) {
                    $table->timestamp('last_run_at')->nullable();
                }
                if (! Schema::hasColumn('qr_rotation_settings', 'last_run_summary')) {
                    $table->json('last_run_summary')->nullable();
                }
                if (! Schema::hasColumn('qr_rotation_settings', 'updated_by')) {
                    $table->char('updated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('qr_rotation_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- qr_tokens ----
        if (! Schema::hasTable('qr_tokens')) {
            Schema::create('qr_tokens', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->text('token');
                $table->boolean('revoked');
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->char('rotated_from', 36)->nullable();
            });
        } else {
            Schema::table('qr_tokens', function (Blueprint $table) {
                if (! Schema::hasColumn('qr_tokens', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('qr_tokens', 'token')) {
                    $table->text('token')->nullable();
                }
                if (! Schema::hasColumn('qr_tokens', 'revoked')) {
                    $table->boolean('revoked')->nullable();
                }
                if (! Schema::hasColumn('qr_tokens', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('qr_tokens', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('qr_tokens', 'expires_at')) {
                    $table->timestamp('expires_at')->nullable();
                }
                if (! Schema::hasColumn('qr_tokens', 'rotated_from')) {
                    $table->char('rotated_from', 36)->nullable();
                }
            });
        }
        // ---- receipt_counters ----
        if (! Schema::hasTable('receipt_counters')) {
            Schema::create('receipt_counters', function (Blueprint $table) {
                $table->text('kind');
                $table->integer('year');
                $table->bigInteger('last_no');
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('receipt_counters', function (Blueprint $table) {
                if (! Schema::hasColumn('receipt_counters', 'kind')) {
                    $table->text('kind')->nullable();
                }
                if (! Schema::hasColumn('receipt_counters', 'year')) {
                    $table->integer('year')->nullable();
                }
                if (! Schema::hasColumn('receipt_counters', 'last_no')) {
                    $table->bigInteger('last_no')->nullable();
                }
                if (! Schema::hasColumn('receipt_counters', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- receipt_no_pool ----
        if (! Schema::hasTable('receipt_no_pool')) {
            Schema::create('receipt_no_pool', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->text('receipt_no');
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('receipt_no_pool', function (Blueprint $table) {
                if (! Schema::hasColumn('receipt_no_pool', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('receipt_no_pool', 'receipt_no')) {
                    $table->text('receipt_no')->nullable();
                }
                if (! Schema::hasColumn('receipt_no_pool', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- receipt_sequences ----
        if (! Schema::hasTable('receipt_sequences')) {
            Schema::create('receipt_sequences', function (Blueprint $table) {
                $table->char('office_id', 36);
                $table->text('kind');
                $table->integer('year');
                $table->integer('month');
                $table->integer('last_no');
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('receipt_sequences', function (Blueprint $table) {
                if (! Schema::hasColumn('receipt_sequences', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('receipt_sequences', 'kind')) {
                    $table->text('kind')->nullable();
                }
                if (! Schema::hasColumn('receipt_sequences', 'year')) {
                    $table->integer('year')->nullable();
                }
                if (! Schema::hasColumn('receipt_sequences', 'month')) {
                    $table->integer('month')->nullable();
                }
                if (! Schema::hasColumn('receipt_sequences', 'last_no')) {
                    $table->integer('last_no')->nullable();
                }
                if (! Schema::hasColumn('receipt_sequences', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- receipt_settings ----
        if (! Schema::hasTable('receipt_settings')) {
            Schema::create('receipt_settings', function (Blueprint $table) {
                $table->integer('id');
                $table->text('language');
                $table->text('paper_size');
                $table->text('accent_color');
                $table->boolean('show_logo');
                $table->boolean('show_signature_line');
                $table->boolean('show_office');
                $table->boolean('show_token_block');
                $table->text('header_alignment');
                $table->text('footer_note');
                $table->text('footer_note_bn');
                $table->timestamp('updated_at')->nullable();
                $table->char('updated_by', 36)->nullable();
                $table->boolean('show_watermark');
                $table->text('watermark_text');
                $table->boolean('show_penalty_row');
                $table->boolean('show_charge_row');
                $table->text('qr_placement');
            });
        } else {
            Schema::table('receipt_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('receipt_settings', 'language')) {
                    $table->text('language')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'paper_size')) {
                    $table->text('paper_size')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'accent_color')) {
                    $table->text('accent_color')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'show_logo')) {
                    $table->boolean('show_logo')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'show_signature_line')) {
                    $table->boolean('show_signature_line')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'show_office')) {
                    $table->boolean('show_office')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'show_token_block')) {
                    $table->boolean('show_token_block')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'header_alignment')) {
                    $table->text('header_alignment')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'footer_note')) {
                    $table->text('footer_note')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'footer_note_bn')) {
                    $table->text('footer_note_bn')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'updated_by')) {
                    $table->char('updated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'show_watermark')) {
                    $table->boolean('show_watermark')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'watermark_text')) {
                    $table->text('watermark_text')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'show_penalty_row')) {
                    $table->boolean('show_penalty_row')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'show_charge_row')) {
                    $table->boolean('show_charge_row')->nullable();
                }
                if (! Schema::hasColumn('receipt_settings', 'qr_placement')) {
                    $table->text('qr_placement')->nullable();
                }
            });
        }
        // ---- receipts ----
        if (! Schema::hasTable('receipts')) {
            Schema::create('receipts', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('receipt_no')->nullable();
                $table->text('kind');
                $table->char('farmer_id', 36)->nullable();
                $table->char('reference_id', 36)->nullable();
                $table->decimal('amount', 20, 4);
                $table->text('method')->nullable();
                $table->text('note')->nullable();
                $table->date('receipt_date');
                $table->char('office_id', 36)->nullable();
                $table->char('collected_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->char('link_id', 36)->nullable();
                $table->timestamp('voided_at')->nullable();
                $table->char('voided_by', 36)->nullable();
                $table->text('void_reason')->nullable();
            });
        } else {
            Schema::table('receipts', function (Blueprint $table) {
                if (! Schema::hasColumn('receipts', 'receipt_no')) {
                    $table->text('receipt_no')->nullable();
                }
                if (! Schema::hasColumn('receipts', 'kind')) {
                    $table->text('kind')->nullable();
                }
                if (! Schema::hasColumn('receipts', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('receipts', 'reference_id')) {
                    $table->char('reference_id', 36)->nullable();
                }
                if (! Schema::hasColumn('receipts', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('receipts', 'method')) {
                    $table->text('method')->nullable();
                }
                if (! Schema::hasColumn('receipts', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('receipts', 'receipt_date')) {
                    $table->date('receipt_date')->nullable();
                }
                if (! Schema::hasColumn('receipts', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('receipts', 'collected_by')) {
                    $table->char('collected_by', 36)->nullable();
                }
                if (! Schema::hasColumn('receipts', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('receipts', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('receipts', 'link_id')) {
                    $table->char('link_id', 36)->nullable();
                }
                if (! Schema::hasColumn('receipts', 'voided_at')) {
                    $table->timestamp('voided_at')->nullable();
                }
                if (! Schema::hasColumn('receipts', 'voided_by')) {
                    $table->char('voided_by', 36)->nullable();
                }
                if (! Schema::hasColumn('receipts', 'void_reason')) {
                    $table->text('void_reason')->nullable();
                }
            });
        }
        // ---- role_permissions ----
        if (! Schema::hasTable('role_permissions')) {
            Schema::create('role_permissions', function (Blueprint $table) {
                $table->text('role');
                $table->text('module');
                $table->boolean('can_view');
                $table->boolean('can_add');
                $table->boolean('can_edit');
                $table->boolean('can_delete');
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('role_permissions', function (Blueprint $table) {
                if (! Schema::hasColumn('role_permissions', 'role')) {
                    $table->text('role')->nullable();
                }
                if (! Schema::hasColumn('role_permissions', 'module')) {
                    $table->text('module')->nullable();
                }
                if (! Schema::hasColumn('role_permissions', 'can_view')) {
                    $table->boolean('can_view')->nullable();
                }
                if (! Schema::hasColumn('role_permissions', 'can_add')) {
                    $table->boolean('can_add')->nullable();
                }
                if (! Schema::hasColumn('role_permissions', 'can_edit')) {
                    $table->boolean('can_edit')->nullable();
                }
                if (! Schema::hasColumn('role_permissions', 'can_delete')) {
                    $table->boolean('can_delete')->nullable();
                }
                if (! Schema::hasColumn('role_permissions', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- savings_plans ----
        if (! Schema::hasTable('savings_plans')) {
            Schema::create('savings_plans', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->integer('duration_months');
                $table->text('installment_type');
                $table->decimal('installment_amount', 20, 4);
                $table->decimal('interest_rate', 20, 4);
                $table->text('maturity_type');
                $table->boolean('is_active');
                $table->char('office_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('savings_plans', function (Blueprint $table) {
                if (! Schema::hasColumn('savings_plans', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'duration_months')) {
                    $table->integer('duration_months')->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'installment_type')) {
                    $table->text('installment_type')->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'installment_amount')) {
                    $table->decimal('installment_amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'interest_rate')) {
                    $table->decimal('interest_rate', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'maturity_type')) {
                    $table->text('maturity_type')->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('savings_plans', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- savings_transactions ----
        if (! Schema::hasTable('savings_transactions')) {
            Schema::create('savings_transactions', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->text('type');
                $table->decimal('amount', 20, 4);
                $table->text('status');
                $table->date('txn_date');
                $table->text('note')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->char('approved_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->char('office_id', 36)->nullable();
                $table->timestamp('deleted_at')->nullable();
                $table->text('receipt_no')->nullable();
                $table->timestamp('decided_at')->nullable();
                $table->text('reject_reason')->nullable();
                $table->text('category')->nullable();
                $table->text('field_receipt_no')->nullable();
            });
        } else {
            Schema::table('savings_transactions', function (Blueprint $table) {
                if (! Schema::hasColumn('savings_transactions', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'type')) {
                    $table->text('type')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'txn_date')) {
                    $table->date('txn_date')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'approved_by')) {
                    $table->char('approved_by', 36)->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'receipt_no')) {
                    $table->text('receipt_no')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'decided_at')) {
                    $table->timestamp('decided_at')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'reject_reason')) {
                    $table->text('reject_reason')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'category')) {
                    $table->text('category')->nullable();
                }
                if (! Schema::hasColumn('savings_transactions', 'field_receipt_no')) {
                    $table->text('field_receipt_no')->nullable();
                }
            });
        }
        // ---- savings_yearly_opening ----
        if (! Schema::hasTable('savings_yearly_opening')) {
            Schema::create('savings_yearly_opening', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->integer('year');
                $table->decimal('opening_balance', 20, 4);
                $table->char('office_id', 36)->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('savings_yearly_opening', function (Blueprint $table) {
                if (! Schema::hasColumn('savings_yearly_opening', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('savings_yearly_opening', 'year')) {
                    $table->integer('year')->nullable();
                }
                if (! Schema::hasColumn('savings_yearly_opening', 'opening_balance')) {
                    $table->decimal('opening_balance', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('savings_yearly_opening', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('savings_yearly_opening', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- seasons ----
        if (! Schema::hasTable('seasons')) {
            Schema::create('seasons', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->integer('year');
                $table->text('type');
                $table->text('name')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->char('season_type_id', 36)->nullable();
                $table->text('fiscal_year')->nullable();
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->date('due_date')->nullable();
                $table->text('status');
            });
        } else {
            Schema::table('seasons', function (Blueprint $table) {
                if (! Schema::hasColumn('seasons', 'year')) {
                    $table->integer('year')->nullable();
                }
                if (! Schema::hasColumn('seasons', 'type')) {
                    $table->text('type')->nullable();
                }
                if (! Schema::hasColumn('seasons', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('seasons', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('seasons', 'season_type_id')) {
                    $table->char('season_type_id', 36)->nullable();
                }
                if (! Schema::hasColumn('seasons', 'fiscal_year')) {
                    $table->text('fiscal_year')->nullable();
                }
                if (! Schema::hasColumn('seasons', 'start_date')) {
                    $table->date('start_date')->nullable();
                }
                if (! Schema::hasColumn('seasons', 'end_date')) {
                    $table->date('end_date')->nullable();
                }
                if (! Schema::hasColumn('seasons', 'due_date')) {
                    $table->date('due_date')->nullable();
                }
                if (! Schema::hasColumn('seasons', 'status')) {
                    $table->text('status')->nullable();
                }
            });
        }
        // ---- shares ----
        if (! Schema::hasTable('shares')) {
            Schema::create('shares', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->decimal('balance', 20, 4);
                $table->timestamp('updated_at')->nullable();
                $table->char('office_id', 36)->nullable();
            });
        } else {
            Schema::table('shares', function (Blueprint $table) {
                if (! Schema::hasColumn('shares', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('shares', 'balance')) {
                    $table->decimal('balance', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('shares', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('shares', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
            });
        }
        // ---- sms_logs ----
        if (! Schema::hasTable('sms_logs')) {
            Schema::create('sms_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('mobile');
                $table->text('message');
                $table->text('status');
                $table->text('provider_response')->nullable();
                $table->text('event_type')->nullable();
                $table->char('farmer_id', 36)->nullable();
                $table->text('reference_type')->nullable();
                $table->char('reference_id', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->integer('retry_count');
                $table->timestamp('sent_at')->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->text('template_key')->nullable();
                $table->text('provider_used')->nullable();
                $table->timestamp('delivered_at')->nullable();
                $table->json('dlr_payload')->nullable();
            });
        } else {
            Schema::table('sms_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('sms_logs', 'mobile')) {
                    $table->text('mobile')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'message')) {
                    $table->text('message')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'provider_response')) {
                    $table->text('provider_response')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'event_type')) {
                    $table->text('event_type')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'reference_type')) {
                    $table->text('reference_type')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'reference_id')) {
                    $table->char('reference_id', 36)->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'retry_count')) {
                    $table->integer('retry_count')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'sent_at')) {
                    $table->timestamp('sent_at')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'template_key')) {
                    $table->text('template_key')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'provider_used')) {
                    $table->text('provider_used')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable();
                }
                if (! Schema::hasColumn('sms_logs', 'dlr_payload')) {
                    $table->json('dlr_payload')->nullable();
                }
            });
        }
        // ---- sms_office_settings ----
        if (! Schema::hasTable('sms_office_settings')) {
            Schema::create('sms_office_settings', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36);
                $table->boolean('enabled');
                $table->text('sender_id')->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('sms_office_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('sms_office_settings', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('sms_office_settings', 'enabled')) {
                    $table->boolean('enabled')->nullable();
                }
                if (! Schema::hasColumn('sms_office_settings', 'sender_id')) {
                    $table->text('sender_id')->nullable();
                }
                if (! Schema::hasColumn('sms_office_settings', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('sms_office_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- sms_provider_secrets ----
        if (! Schema::hasTable('sms_provider_secrets')) {
            Schema::create('sms_provider_secrets', function (Blueprint $table) {
                $table->text('provider');
                $table->text('api_token');
                $table->timestamp('updated_at')->nullable();
                $table->char('updated_by', 36)->nullable();
                $table->char('id', 36)->primary();
                $table->text('status');
                $table->timestamp('expires_at')->nullable();
                $table->timestamp('activated_at')->nullable();
                $table->text('label')->nullable();
                $table->integer('priority');
                $table->text('dlr_url')->nullable();
            });
        } else {
            Schema::table('sms_provider_secrets', function (Blueprint $table) {
                if (! Schema::hasColumn('sms_provider_secrets', 'provider')) {
                    $table->text('provider')->nullable();
                }
                if (! Schema::hasColumn('sms_provider_secrets', 'api_token')) {
                    $table->text('api_token')->nullable();
                }
                if (! Schema::hasColumn('sms_provider_secrets', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('sms_provider_secrets', 'updated_by')) {
                    $table->char('updated_by', 36)->nullable();
                }
                if (! Schema::hasColumn('sms_provider_secrets', 'status')) {
                    $table->text('status')->nullable();
                }
                if (! Schema::hasColumn('sms_provider_secrets', 'expires_at')) {
                    $table->timestamp('expires_at')->nullable();
                }
                if (! Schema::hasColumn('sms_provider_secrets', 'activated_at')) {
                    $table->timestamp('activated_at')->nullable();
                }
                if (! Schema::hasColumn('sms_provider_secrets', 'label')) {
                    $table->text('label')->nullable();
                }
                if (! Schema::hasColumn('sms_provider_secrets', 'priority')) {
                    $table->integer('priority')->nullable();
                }
                if (! Schema::hasColumn('sms_provider_secrets', 'dlr_url')) {
                    $table->text('dlr_url')->nullable();
                }
            });
        }
        // ---- sms_settings ----
        if (! Schema::hasTable('sms_settings')) {
            Schema::create('sms_settings', function (Blueprint $table) {
                $table->integer('id');
                $table->boolean('enabled');
                $table->text('sender_id')->nullable();
                $table->boolean('api_key_set');
                $table->boolean('send_on_savings_deposit');
                $table->boolean('send_on_savings_withdraw');
                $table->boolean('send_on_loan_approved');
                $table->boolean('send_on_loan_payment');
                $table->boolean('send_on_irrigation_payment');
                $table->boolean('send_on_due_reminder');
                $table->text('tpl_savings_deposit');
                $table->text('tpl_savings_withdraw');
                $table->text('tpl_loan_approved');
                $table->text('tpl_loan_payment');
                $table->text('tpl_irrigation_payment');
                $table->text('tpl_due_reminder');
                $table->json('config');
                $table->timestamp('updated_at')->nullable();
                $table->text('language');
                $table->integer('reminder_days_before');
                $table->text('tpl_savings_deposit_en');
                $table->text('tpl_savings_withdraw_en');
                $table->text('tpl_loan_approved_en');
                $table->text('tpl_loan_payment_en');
                $table->text('tpl_irrigation_payment_en');
                $table->text('tpl_due_reminder_en');
                $table->boolean('send_on_qr_rotate');
                $table->boolean('send_on_qr_revoke');
                $table->text('tpl_qr_rotate');
                $table->text('tpl_qr_revoke');
                $table->text('tpl_qr_rotate_en');
                $table->text('tpl_qr_revoke_en');
            });
        } else {
            Schema::table('sms_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('sms_settings', 'enabled')) {
                    $table->boolean('enabled')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'sender_id')) {
                    $table->text('sender_id')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'api_key_set')) {
                    $table->boolean('api_key_set')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'send_on_savings_deposit')) {
                    $table->boolean('send_on_savings_deposit')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'send_on_savings_withdraw')) {
                    $table->boolean('send_on_savings_withdraw')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'send_on_loan_approved')) {
                    $table->boolean('send_on_loan_approved')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'send_on_loan_payment')) {
                    $table->boolean('send_on_loan_payment')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'send_on_irrigation_payment')) {
                    $table->boolean('send_on_irrigation_payment')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'send_on_due_reminder')) {
                    $table->boolean('send_on_due_reminder')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_savings_deposit')) {
                    $table->text('tpl_savings_deposit')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_savings_withdraw')) {
                    $table->text('tpl_savings_withdraw')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_loan_approved')) {
                    $table->text('tpl_loan_approved')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_loan_payment')) {
                    $table->text('tpl_loan_payment')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_irrigation_payment')) {
                    $table->text('tpl_irrigation_payment')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_due_reminder')) {
                    $table->text('tpl_due_reminder')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'config')) {
                    $table->json('config')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'language')) {
                    $table->text('language')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'reminder_days_before')) {
                    $table->integer('reminder_days_before')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_savings_deposit_en')) {
                    $table->text('tpl_savings_deposit_en')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_savings_withdraw_en')) {
                    $table->text('tpl_savings_withdraw_en')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_loan_approved_en')) {
                    $table->text('tpl_loan_approved_en')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_loan_payment_en')) {
                    $table->text('tpl_loan_payment_en')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_irrigation_payment_en')) {
                    $table->text('tpl_irrigation_payment_en')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_due_reminder_en')) {
                    $table->text('tpl_due_reminder_en')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'send_on_qr_rotate')) {
                    $table->boolean('send_on_qr_rotate')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'send_on_qr_revoke')) {
                    $table->boolean('send_on_qr_revoke')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_qr_rotate')) {
                    $table->text('tpl_qr_rotate')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_qr_revoke')) {
                    $table->text('tpl_qr_revoke')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_qr_rotate_en')) {
                    $table->text('tpl_qr_rotate_en')->nullable();
                }
                if (! Schema::hasColumn('sms_settings', 'tpl_qr_revoke_en')) {
                    $table->text('tpl_qr_revoke_en')->nullable();
                }
            });
        }
        // ---- sms_templates ----
        if (! Schema::hasTable('sms_templates')) {
            Schema::create('sms_templates', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->text('key');
                $table->text('name');
                $table->text('body');
                $table->text('variables')->nullable();
                $table->boolean('is_active');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
                $table->text('preferred_provider')->nullable();
            });
        } else {
            Schema::table('sms_templates', function (Blueprint $table) {
                if (! Schema::hasColumn('sms_templates', 'key')) {
                    $table->text('key')->nullable();
                }
                if (! Schema::hasColumn('sms_templates', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('sms_templates', 'body')) {
                    $table->text('body')->nullable();
                }
                if (! Schema::hasColumn('sms_templates', 'variables')) {
                    $table->text('variables')->nullable();
                }
                if (! Schema::hasColumn('sms_templates', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('sms_templates', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('sms_templates', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
                if (! Schema::hasColumn('sms_templates', 'preferred_provider')) {
                    $table->text('preferred_provider')->nullable();
                }
            });
        }
        // ---- system_audit_logs ----
        if (! Schema::hasTable('system_audit_logs')) {
            Schema::create('system_audit_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->char('user_id', 36)->nullable();
                $table->text('module');
                $table->text('action_type');
                $table->char('reference_id', 36)->nullable();
                $table->json('old_data')->nullable();
                $table->json('new_data')->nullable();
                $table->text('ip')->nullable();
                $table->text('user_agent')->nullable();
                $table->timestamp('created_at')->nullable();
            });
        } else {
            Schema::table('system_audit_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('system_audit_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('system_audit_logs', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('system_audit_logs', 'module')) {
                    $table->text('module')->nullable();
                }
                if (! Schema::hasColumn('system_audit_logs', 'action_type')) {
                    $table->text('action_type')->nullable();
                }
                if (! Schema::hasColumn('system_audit_logs', 'reference_id')) {
                    $table->char('reference_id', 36)->nullable();
                }
                if (! Schema::hasColumn('system_audit_logs', 'old_data')) {
                    $table->json('old_data')->nullable();
                }
                if (! Schema::hasColumn('system_audit_logs', 'new_data')) {
                    $table->json('new_data')->nullable();
                }
                if (! Schema::hasColumn('system_audit_logs', 'ip')) {
                    $table->text('ip')->nullable();
                }
                if (! Schema::hasColumn('system_audit_logs', 'user_agent')) {
                    $table->text('user_agent')->nullable();
                }
                if (! Schema::hasColumn('system_audit_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
            });
        }
        // ---- unions ----
        if (! Schema::hasTable('unions')) {
            Schema::create('unions', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('upazila_id', 36)->nullable();
                $table->text('name')->nullable();
                $table->text('name_bn')->nullable();
                $table->text('code')->nullable();
                $table->boolean('is_active');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('unions', function (Blueprint $table) {
                if (! Schema::hasColumn('unions', 'upazila_id')) {
                    $table->char('upazila_id', 36)->nullable();
                }
                if (! Schema::hasColumn('unions', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('unions', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('unions', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('unions', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('unions', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('unions', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- upazilas ----
        if (! Schema::hasTable('upazilas')) {
            Schema::create('upazilas', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('district_id', 36)->nullable();
                $table->text('name');
                $table->text('name_bn')->nullable();
                $table->text('code')->nullable();
                $table->boolean('is_active');
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('upazilas', function (Blueprint $table) {
                if (! Schema::hasColumn('upazilas', 'district_id')) {
                    $table->char('district_id', 36)->nullable();
                }
                if (! Schema::hasColumn('upazilas', 'name')) {
                    $table->text('name')->nullable();
                }
                if (! Schema::hasColumn('upazilas', 'name_bn')) {
                    $table->text('name_bn')->nullable();
                }
                if (! Schema::hasColumn('upazilas', 'code')) {
                    $table->text('code')->nullable();
                }
                if (! Schema::hasColumn('upazilas', 'is_active')) {
                    $table->boolean('is_active')->nullable();
                }
                if (! Schema::hasColumn('upazilas', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('upazilas', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
        // ---- user_permissions ----
        if (! Schema::hasTable('user_permissions')) {
            Schema::create('user_permissions', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('user_id', 36);
                $table->text('module');
                $table->boolean('can_view');
                $table->boolean('can_add');
                $table->boolean('can_edit');
                $table->boolean('can_delete');
            });
        } else {
            Schema::table('user_permissions', function (Blueprint $table) {
                if (! Schema::hasColumn('user_permissions', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('user_permissions', 'module')) {
                    $table->text('module')->nullable();
                }
                if (! Schema::hasColumn('user_permissions', 'can_view')) {
                    $table->boolean('can_view')->nullable();
                }
                if (! Schema::hasColumn('user_permissions', 'can_add')) {
                    $table->boolean('can_add')->nullable();
                }
                if (! Schema::hasColumn('user_permissions', 'can_edit')) {
                    $table->boolean('can_edit')->nullable();
                }
                if (! Schema::hasColumn('user_permissions', 'can_delete')) {
                    $table->boolean('can_delete')->nullable();
                }
            });
        }
        // ---- user_roles ----
        if (! Schema::hasTable('user_roles')) {
            Schema::create('user_roles', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('user_id', 36);
                $table->text('role');
            });
        } else {
            Schema::table('user_roles', function (Blueprint $table) {
                if (! Schema::hasColumn('user_roles', 'user_id')) {
                    $table->char('user_id', 36)->nullable();
                }
                if (! Schema::hasColumn('user_roles', 'role')) {
                    $table->text('role')->nullable();
                }
            });
        }
        // ---- voter_audit_logs ----
        if (! Schema::hasTable('voter_audit_logs')) {
            Schema::create('voter_audit_logs', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('farmer_id', 36);
                $table->text('account_number')->nullable();
                $table->text('voter_number_old')->nullable();
                $table->text('voter_number_new')->nullable();
                $table->boolean('is_voter_old')->nullable();
                $table->boolean('is_voter_new')->nullable();
                $table->char('changed_by', 36)->nullable();
                $table->char('office_id', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->text('note')->nullable();
                $table->text('action')->nullable();
            });
        } else {
            Schema::table('voter_audit_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('voter_audit_logs', 'farmer_id')) {
                    $table->char('farmer_id', 36)->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'account_number')) {
                    $table->text('account_number')->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'voter_number_old')) {
                    $table->text('voter_number_old')->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'voter_number_new')) {
                    $table->text('voter_number_new')->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'is_voter_old')) {
                    $table->boolean('is_voter_old')->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'is_voter_new')) {
                    $table->boolean('is_voter_new')->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'changed_by')) {
                    $table->char('changed_by', 36)->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'note')) {
                    $table->text('note')->nullable();
                }
                if (! Schema::hasColumn('voter_audit_logs', 'action')) {
                    $table->text('action')->nullable();
                }
            });
        }
        // ---- voucher_sequences ----
        if (! Schema::hasTable('voucher_sequences')) {
            Schema::create('voucher_sequences', function (Blueprint $table) {
                $table->char('office_id', 36);
                $table->text('voucher_type');
                $table->integer('fiscal_year');
                $table->integer('last_no');
            });
        } else {
            Schema::table('voucher_sequences', function (Blueprint $table) {
                if (! Schema::hasColumn('voucher_sequences', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('voucher_sequences', 'voucher_type')) {
                    $table->text('voucher_type')->nullable();
                }
                if (! Schema::hasColumn('voucher_sequences', 'fiscal_year')) {
                    $table->integer('fiscal_year')->nullable();
                }
                if (! Schema::hasColumn('voucher_sequences', 'last_no')) {
                    $table->integer('last_no')->nullable();
                }
            });
        }
        // ---- vouchers ----
        if (! Schema::hasTable('vouchers')) {
            Schema::create('vouchers', function (Blueprint $table) {
                $table->char('id', 36)->primary();
                $table->char('office_id', 36)->nullable();
                $table->text('voucher_no');
                $table->text('voucher_type');
                $table->date('voucher_date');
                $table->decimal('amount', 20, 4);
                $table->text('payee')->nullable();
                $table->text('narration')->nullable();
                $table->text('attachment_path')->nullable();
                $table->text('attachment_mime')->nullable();
                $table->text('reference_type')->nullable();
                $table->char('reference_id', 36)->nullable();
                $table->char('created_by', 36)->nullable();
                $table->timestamp('created_at')->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('vouchers', function (Blueprint $table) {
                if (! Schema::hasColumn('vouchers', 'office_id')) {
                    $table->char('office_id', 36)->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'voucher_no')) {
                    $table->text('voucher_no')->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'voucher_type')) {
                    $table->text('voucher_type')->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'voucher_date')) {
                    $table->date('voucher_date')->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'amount')) {
                    $table->decimal('amount', 20, 4)->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'payee')) {
                    $table->text('payee')->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'narration')) {
                    $table->text('narration')->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'attachment_path')) {
                    $table->text('attachment_path')->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'attachment_mime')) {
                    $table->text('attachment_mime')->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'reference_type')) {
                    $table->text('reference_type')->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'reference_id')) {
                    $table->char('reference_id', 36)->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'created_by')) {
                    $table->char('created_by', 36)->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'created_at')) {
                    $table->timestamp('created_at')->nullable();
                }
                if (! Schema::hasColumn('vouchers', 'updated_at')) {
                    $table->timestamp('updated_at')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        // Non-destructive reconciliation; columns/tables left in place.
    }
};
