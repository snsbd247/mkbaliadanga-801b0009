import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import BuildVersionWatcher from "@/components/system/BuildVersionWatcher";
import AuthPage from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import FarmerPortalLogin from "./pages/FarmerPortalLogin";
import FarmerDashboard from "./pages/FarmerDashboard";
import Dashboard from "./pages/Dashboard";
import Offices from "./pages/Offices";
import Farmers from "./pages/Farmers";
import FarmerDetail from "./pages/FarmerDetail";
import FarmerProfileReport from "./pages/FarmerProfileReport";
import FarmerCard from "./pages/FarmerCard";
import LandDetail from "./pages/LandDetail";
import ScanPayment from "./pages/ScanPayment";
import Seasons from "./pages/Seasons";
import Savings from "./pages/Savings";
import Loans from "./pages/Loans";
import LoanForm from "./pages/LoanForm";
import LoanStatementPage from "./pages/LoanStatementPage";

import IrrigationInvoices from "./pages/IrrigationInvoices";
import IrrigationReports from "./pages/IrrigationReports";
import IrrigationRates from "./pages/IrrigationRates";
import HistoricalReceiptEntry from "./pages/HistoricalReceiptEntry";
import Payments from "./pages/Payments";
import Receipts from "./pages/Receipts";
import CombinedPayment from "./pages/CombinedPayment";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import AdminHealthCheck from "./pages/AdminHealthCheck";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";
import Scan from "./pages/Scan";
import Cashbook from "./pages/Cashbook";
import CashAudit from "./pages/CashAudit";
import IrrigationCashStatement from "./pages/reports/IrrigationCashStatement";
import SocietyCashStatement from "./pages/reports/SocietyCashStatement";
import SocietyCashBook from "./pages/reports/SocietyCashBook";
import IrrigationCashBook from "./pages/reports/IrrigationCashBook";
import IrrigationCashBookLedger from "./pages/reports/IrrigationCashBookLedger";
import IrrigationExportAudit from "./pages/admin/IrrigationExportAudit";

import HandCash from "./pages/HandCash";
import Statement from "./pages/Statement";
import Dues from "./pages/Dues";
import Backup from "./pages/Backup";
import Diagnostics from "./pages/Diagnostics";
import Accounts from "./pages/Accounts";
import Ledger from "./pages/Ledger";
import FinancialReports from "./pages/FinancialReports";
import FinancialSummary from "./pages/FinancialSummary";
import JournalEntry from "./pages/JournalEntry";
import LedgerIntegrity from "./pages/LedgerIntegrity";
import Approvals from "./pages/Approvals";
import PeriodClose from "./pages/PeriodClose";
import FinanceSummary from "./pages/FinanceSummary";
import LandHistory from "./pages/LandHistory";
import LoanPlans from "./pages/LoanPlans";

import BankAccounts from "./pages/BankAccounts";
import Vouchers from "./pages/Vouchers";
import PublicPay from "./pages/PublicPay";
import PublicPaymentIntents from "./pages/admin/PublicPaymentIntents";
import PaymentReconciliation from "./pages/admin/PaymentReconciliation";

import SmsSettings from "./pages/SmsSettings";
import SmsLogs from "./pages/SmsLogs";
import SmsTemplates from "./pages/SmsTemplates";
import Locations from "./pages/Locations";
import LedgerReconciliation from "./pages/LedgerReconciliation";
import ShareCapitalReconciliation from "./pages/ShareCapitalReconciliation";
import QrRotation from "./pages/QrRotation";
import BulkCards from "./pages/BulkCards";
import ReceiptTemplate from "./pages/ReceiptTemplate";
import ReceiptSerialAudit from "./pages/ReceiptSerialAudit";
import CardDesigner from "./pages/CardDesigner";
import RoleMatrix from "./pages/admin/RoleMatrix";
import UserRoles from "./pages/admin/UserRoles";
import AdminVerify from "./pages/admin/AdminVerify";
import DeletedFarmers from "./pages/admin/DeletedFarmers";
import MyPermissions from "./pages/admin/MyPermissions";
import FileManager from "./pages/admin/FileManager";
import SystemUpdate from "./pages/admin/SystemUpdate";
import IrrigationDueReport from "./pages/reports/IrrigationDueReport";
import IrrigationReconciliationReport from "./pages/reports/IrrigationReconciliationReport";
import IrrigationPostingReconciliation from "./pages/reports/IrrigationPostingReconciliation";
import OpeningDueReport from "./pages/reports/OpeningDueReport";
import InvoiceReport from "./pages/reports/InvoiceReport";
import CollectionReport from "./pages/reports/CollectionReport";
import BankReport from "./pages/reports/BankReport";

import ReceiptKindReport from "./pages/reports/ReceiptKindReport";
import MonthlyReceiptRegister from "./pages/reports/MonthlyReceiptRegister";
import OfficerSummaryReport from "./pages/reports/OfficerSummaryReport";
import RateSourceReport from "./pages/reports/RateSourceReport";
import OverrideAuditReport from "./pages/reports/OverrideAuditReport";
import ReceiptAuditReport from "./pages/reports/ReceiptAuditReport";
import FarmerRejectionsReport from "./pages/reports/FarmerRejectionsReport";
import ExpensesReport from "./pages/reports/ExpensesReport";
import PromiseDueReport from "./pages/reports/PromiseDueReport";
import IrrigationDueMismatch from "./pages/admin/IrrigationDueMismatch";
import RetryJobs from "./pages/admin/RetryJobs";
import AuditTimeline from "./pages/admin/AuditTimeline";
import RpcFallbackAudit from "./pages/admin/RpcFallbackAudit";
import ImportAuditLogs from "./pages/admin/ImportAuditLogs";
import FarmersImport from "./pages/FarmersImport";
import LandsImport from "./pages/LandsImport";
import OpeningDueImport from "./pages/OpeningDueImport";
import IrrigationInvoiceImport from "./pages/IrrigationInvoiceImport";
import LegacyIrrigationImport from "./pages/LegacyIrrigationImport";
import LegacyIrrigationSearch from "./pages/LegacyIrrigationSearch";
import PaymentsImport from "./pages/PaymentsImport";
import FarmerMerge from "./pages/admin/FarmerMerge";

import VoterList from "./pages/VoterList";
import VoterAudit from "./pages/VoterAudit";
import VoterHistory from "./pages/VoterHistory";
import IdReconcile from "./pages/admin/IdReconcile";
import IdReview from "./pages/admin/IdReview";
import DuplicateReceiptAudit from "./pages/admin/DuplicateReceiptAudit";
import FarmerLoginAudit from "./pages/admin/FarmerLoginAudit";
import DemoManager from "./pages/admin/DemoManager";
import IntegrityRuns from "./pages/admin/IntegrityRuns";
import BillingSplitPreview from "./pages/BillingSplitPreview";
import QuickSeed from "./pages/admin/QuickSeed";
import DemoOpsAudit from "./pages/admin/DemoOpsAudit";
import Patwaris from "./pages/admin/Patwaris";
import PatwariDetail from "./pages/admin/PatwariDetail";
import FarmerStatement from "./pages/FarmerStatement";

import CultivationHistoryReport from "./pages/reports/CultivationHistoryReport";
import IrrigationCategoryReport from "./pages/reports/IrrigationCategoryReport";
import ShareCollection from "./pages/ShareCollection";
import DuesAudit from "./pages/DuesAudit";
import Profile from "./pages/Profile";
import Help from "./pages/Help";
import Trust from "./pages/Trust";
import HelpFarmerCard from "./pages/HelpFarmerCard";
import NotFound from "./pages/NotFound.tsx";
import { RequirePerm } from "./components/auth/RequirePerm";
import { RequireRole } from "./components/auth/RequireRole";
import { RequireDeveloper } from "./components/auth/RequireDeveloper";
import DeveloperUpdates from "./pages/admin/DeveloperUpdates";
import AdminLookups from "./pages/admin/Lookups";
import RateAuditLog from "./pages/admin/RateAuditLog";
import IrrigationCategories from "./pages/admin/IrrigationCategories";
import IrrigationCategoryRates from "./pages/admin/IrrigationCategoryRates";
import AssetCategories from "./pages/admin/AssetCategories";
import AssetItems from "./pages/assets/AssetItems";
import AssetItemDetail from "./pages/assets/AssetItemDetail";
import AssetDashboard from "./pages/assets/AssetDashboard";
import IrrigationPaymentCoverageAdmin from "./pages/IrrigationPaymentCoverageAdmin";
import AssetReports from "./pages/assets/AssetReports";
import AssetScanner from "./pages/assets/AssetScanner";
import AssetScanHistory from "./pages/assets/AssetScanHistory";
import AssetBulkQR from "./pages/assets/AssetBulkQR";
import AssetDepreciation from "./pages/assets/AssetDepreciation";
import AssetStock from "./pages/assets/AssetStock";
import AssetMovements from "./pages/assets/AssetMovements";
import AssetInstallations from "./pages/assets/AssetInstallations";
import AssetMaintenance from "./pages/assets/AssetMaintenance";
import AssetDisposal from "./pages/assets/AssetDisposal";
import AssetAlerts from "./pages/assets/AssetAlerts";
import MaintenanceSchedules from "./pages/assets/MaintenanceSchedules";
import VerifyReceipt from "./pages/VerifyReceipt";
import ApiAuth from "./pages/ApiAuth";
import ApiFarmerPortal from "./pages/ApiFarmerPortal";
import ApiFarmerAuth from "./pages/ApiFarmerAuth";
import ApiFarmers from "./pages/ApiFarmers";

import ApiSavings from "./pages/ApiSavings";
import ApiPayments from "./pages/ApiPayments";
import ApiAccounts from "./pages/ApiAccounts";
import ApiJournals from "./pages/ApiJournals";
import ApiReports from "./pages/ApiReports";
import ApiUsers from "./pages/ApiUsers";
import ApiRoles from "./pages/ApiRoles";
import ApiOffices from "./pages/ApiOffices";
import ApiAudit from "./pages/ApiAudit";
import ApiSms from "./pages/ApiSms";
import ApiQr from "./pages/ApiQr";
import ApiLands from "./pages/ApiLands";
import ApiSeasons from "./pages/ApiSeasons";

import ApiIrrigationRates from "./pages/ApiIrrigationRates";
import ApiAssets from "./pages/ApiAssets";
import ApiDashboard from "./pages/ApiDashboard";
import { USE_API_BACKEND, LEGACY_TO_API } from "./lib/api/featureFlag";

// Returning to a background tab must not look like a page refresh or reset open forms.
// Keep data stable on focus; explicit mutations/invalidations still refresh the needed lists.
focusManager.setEventListener(() => () => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 60_000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BuildVersionWatcher />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<FarmerPortalLogin />} />
              <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
              <Route path="/farmer/pay" element={<PublicPay />} />
              <Route path="/pay" element={<Navigate to="/" replace />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/trust" element={<Trust />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify/:token" element={<VerifyReceipt />} />
              <Route path="/r/:token" element={<VerifyReceipt />} />
              <Route path="/api/auth" element={<ApiAuth />} />
              <Route path="/api/farmer-login" element={<ApiFarmerAuth />} />
              <Route path="/api/farmer-portal" element={<ApiFarmerPortal />} />
              <Route path="/api" element={<Navigate to="/api/dashboard" replace />} />
              <Route path="/api/dashboard" element={<ApiDashboard />} />
              <Route path="/api/farmers" element={<ApiFarmers />} />
              
              <Route path="/api/savings" element={<ApiSavings />} />
              <Route path="/api/payments" element={<ApiPayments />} />
              <Route path="/api/accounts" element={<ApiAccounts />} />
              <Route path="/api/journals" element={<ApiJournals />} />
              <Route path="/api/reports" element={<ApiReports />} />
              <Route path="/api/users" element={<ApiUsers />} />
              <Route path="/api/roles" element={<ApiRoles />} />
              <Route path="/api/offices" element={<ApiOffices />} />
              <Route path="/api/audit" element={<ApiAudit />} />
              <Route path="/api/sms" element={<ApiSms />} />
              <Route path="/api/qr" element={<ApiQr />} />
              <Route path="/api/lands" element={<ApiLands />} />
              <Route path="/api/seasons" element={<ApiSeasons />} />
              
              <Route path="/api/irrigation-rates" element={<ApiIrrigationRates />} />
              <Route path="/api/assets" element={<ApiAssets />} />
              {/* Legacy → API redirects disabled: same login/UI on preview and VPS. */}
              <Route element={<AppLayout />}>
                <Route path="/admin" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/offices" element={<RequirePerm module="offices"><Offices /></RequirePerm>} />
                <Route path="/farmers" element={<RequirePerm module="farmers"><Farmers /></RequirePerm>} />
                <Route path="/admin/farmer-merge" element={<RequireRole roles={["admin","super_admin"]}><FarmerMerge /></RequireRole>} />
                <Route path="/admin/deleted-farmers" element={<RequireRole roles={["super_admin"]}><DeletedFarmers /></RequireRole>} />
                <Route path="/voters" element={<RequirePerm module="farmers"><VoterList /></RequirePerm>} />
                <Route path="/farmers/:id" element={<RequirePerm module="farmers"><FarmerDetail /></RequirePerm>} />
                <Route path="/farmers/:id/report" element={<RequirePerm module="farmers"><FarmerProfileReport /></RequirePerm>} />
                <Route path="/farmers/:id/card" element={<RequirePerm module="farmers"><FarmerCard /></RequirePerm>} />
                <Route path="/lands/import" element={<RequirePerm module="farmers" action="can_add"><LandsImport /></RequirePerm>} />
                <Route path="/lands/:id" element={<RequirePerm module="farmers"><LandDetail /></RequirePerm>} />
                <Route path="/scan-payment" element={<RequirePerm module="payments"><ScanPayment /></RequirePerm>} />
                <Route path="/seasons" element={<RequirePerm module="seasons"><Seasons /></RequirePerm>} />
                <Route path="/savings" element={<RequirePerm module="savings"><Savings /></RequirePerm>} />
                <Route path="/loans" element={<RequirePerm module="loans"><Loans /></RequirePerm>} />
                <Route path="/loans/new" element={<RequirePerm module="loans"><LoanForm /></RequirePerm>} />
                <Route path="/loans/:id/edit" element={<RequirePerm module="loans"><LoanForm /></RequirePerm>} />
                <Route path="/loans/:id/statement" element={<RequirePerm module="loans"><LoanStatementPage /></RequirePerm>} />




                <Route path="/share-collection" element={<RequirePerm module="savings"><ShareCollection /></RequirePerm>} />
                {/* Legacy routes redirect to unified invoice/payment pages */}
                <Route path="/irrigation" element={<Navigate to="/irrigation/invoices" replace />} />
                <Route path="/irrigation/collect" element={<Navigate to="/payments" replace />} />
                <Route path="/irrigation/invoices" element={<RequirePerm module="irrigation"><IrrigationInvoices /></RequirePerm>} />
                <Route path="/irrigation/opening-due/import" element={<RequirePerm module="irrigation" action="can_add"><OpeningDueImport /></RequirePerm>} />
                <Route path="/irrigation/invoices/import" element={<RequirePerm module="irrigation" action="can_add"><IrrigationInvoiceImport /></RequirePerm>} />
                <Route path="/irrigation/legacy-import" element={<RequirePerm module="irrigation" action="can_add"><LegacyIrrigationImport /></RequirePerm>} />
                <Route path="/members/old-data" element={<RequirePerm module="farmers"><LegacyIrrigationSearch /></RequirePerm>} />
                <Route path="/payments/import" element={<RequirePerm module="payments" action="can_add"><PaymentsImport /></RequirePerm>} />
                <Route path="/irrigation/rates" element={<RequirePerm module="irrigation"><IrrigationRates /></RequirePerm>} />
                <Route path="/irrigation/historical-entry" element={<RequirePerm module="irrigation"><HistoricalReceiptEntry /></RequirePerm>} />
                <Route path="/payments" element={<RequirePerm module="payments"><Payments /></RequirePerm>} />
                <Route path="/receipts" element={<RequirePerm module="payments"><Receipts /></RequirePerm>} />
                <Route path="/payments/combined" element={<RequirePerm module="payments"><CombinedPayment /></RequirePerm>} />
                <Route path="/reports" element={<RequirePerm module="reports"><Reports /></RequirePerm>} />
                <Route path="/reports/irrigation-due" element={<RequirePerm module="reports"><IrrigationDueReport /></RequirePerm>} />
                <Route path="/reports/irrigation-reconciliation" element={<RequirePerm module="reports"><IrrigationReconciliationReport /></RequirePerm>} />
                <Route path="/reports/irrigation-posting-reconciliation" element={<RequirePerm module="reports"><IrrigationPostingReconciliation /></RequirePerm>} />
                <Route path="/reports/opening-due" element={<RequirePerm module="reports"><OpeningDueReport /></RequirePerm>} />
                <Route path="/reports/invoices" element={<RequirePerm module="reports"><InvoiceReport /></RequirePerm>} />
                <Route path="/reports/collections" element={<RequirePerm module="reports"><CollectionReport /></RequirePerm>} />
                <Route path="/reports/bank" element={<RequirePerm module="reports"><BankReport /></RequirePerm>} />
                
                <Route path="/reports/receipts" element={<RequirePerm module="reports"><ReceiptKindReport /></RequirePerm>} />
                <Route path="/reports/receipt-register" element={<RequirePerm module="reports"><MonthlyReceiptRegister /></RequirePerm>} />
                <Route path="/reports/officer-summary" element={<RequirePerm module="reports"><OfficerSummaryReport /></RequirePerm>} />
                <Route path="/reports/farmer-rejections" element={<RequirePerm module="farmers" action="can_edit"><FarmerRejectionsReport /></RequirePerm>} />
                <Route path="/reports/voter-audit" element={<RequirePerm module="farmers" action="can_edit"><VoterAudit /></RequirePerm>} />
                <Route path="/voters/history" element={<RequirePerm module="farmers" action="can_edit"><VoterHistory /></RequirePerm>} />
                <Route path="/admin/id-reconcile" element={<RequireDeveloper><IdReconcile /></RequireDeveloper>} />
                <Route path="/admin/id-review" element={<RequirePerm module="farmers" action="can_view"><IdReview /></RequirePerm>} />
                <Route path="/reports/farmer-statement" element={<RequirePerm module="reports"><FarmerStatement /></RequirePerm>} />
                <Route path="/reports/expenses" element={<RequirePerm module="reports" action="can_view"><ExpensesReport /></RequirePerm>} />
                <Route path="/reports/promise-due" element={<RequirePerm module="reports"><PromiseDueReport /></RequirePerm>} />
                <Route path="/reports/cultivation-history" element={<RequirePerm module="reports"><CultivationHistoryReport /></RequirePerm>} />
                
                <Route path="/reports/irrigation-category" element={<RequirePerm module="reports"><IrrigationCategoryReport /></RequirePerm>} />

                <Route path="/admin/irrigation-due-mismatch" element={<RequireRole roles={["admin","super_admin"]}><IrrigationDueMismatch /></RequireRole>} />
                <Route path="/admin/retry-jobs" element={<RequireRole roles={["admin","super_admin"]}><RetryJobs /></RequireRole>} />
                <Route path="/admin/audit-timeline" element={<RequireRole roles={["admin","super_admin"]}><AuditTimeline /></RequireRole>} />
                <Route path="/admin/import-audit" element={<RequireRole roles={["admin","super_admin"]}><ImportAuditLogs /></RequireRole>} />
                <Route path="/admin/payment-coverage" element={<RequireRole roles={["admin","super_admin"]}><IrrigationPaymentCoverageAdmin /></RequireRole>} />
                <Route path="/admin/rpc-fallback-audit" element={<RequireRole roles={["developer","super_admin"]}><RpcFallbackAudit /></RequireRole>} />
                <Route path="/farmers/import" element={<RequirePerm module="farmers" action="can_add"><FarmersImport /></RequirePerm>} />
                
                <Route path="/users" element={<RequireRole roles={["super_admin"]}><Users /></RequireRole>} />
                <Route path="/admin/health" element={<RequireRole roles={["admin","super_admin"]}><AdminHealthCheck /></RequireRole>} />

                <Route path="/settings" element={<RequireRole roles={["super_admin"]}><Settings /></RequireRole>} />
                <Route path="/scan" element={<RequirePerm module="payments"><Scan /></RequirePerm>} />
                <Route path="/cashbook" element={<RequirePerm module="cashbook"><Cashbook /></RequirePerm>} />
                <Route path="/hand-cash" element={<RequirePerm module="cashbook"><HandCash /></RequirePerm>} />
                <Route path="/cash-audit" element={<RequirePerm module="cashbook"><CashAudit /></RequirePerm>} />
                <Route path="/reports/irrigation-statement" element={<RequirePerm module="cashbook"><IrrigationCashStatement /></RequirePerm>} />
                <Route path="/reports/society-statement" element={<RequirePerm module="cashbook"><SocietyCashStatement /></RequirePerm>} />
                <Route path="/reports/society-cashbook" element={<RequirePerm module="cashbook"><SocietyCashBook /></RequirePerm>} />
                <Route path="/reports/irrigation-cashbook" element={<RequirePerm module="cashbook"><IrrigationCashBook /></RequirePerm>} />
                <Route path="/reports/irrigation-cashbook-ledger" element={<RequirePerm module="cashbook"><IrrigationCashBookLedger /></RequirePerm>} />
                <Route path="/reports/irrigation-cashbook-audit" element={<RequirePerm module="cashbook"><IrrigationExportAudit /></RequirePerm>} />

                <Route path="/statement" element={<RequirePerm module="savings"><Statement /></RequirePerm>} />
                <Route path="/dues" element={<RequirePerm module="reports"><Dues /></RequirePerm>} />
                <Route path="/dues-audit" element={<RequirePerm module="reports"><DuesAudit /></RequirePerm>} />
                <Route path="/backup" element={<RequireDeveloper><Backup /></RequireDeveloper>} />
                <Route path="/audit" element={<RequireDeveloper><AuditLogs /></RequireDeveloper>} />
                <Route path="/diagnostics" element={<RequireDeveloper><Diagnostics /></RequireDeveloper>} />
                <Route path="/dev/files" element={<RequireDeveloper><FileManager /></RequireDeveloper>} />
                <Route path="/dev/update" element={<RequireDeveloper><SystemUpdate /></RequireDeveloper>} />
                <Route path="/accounts" element={<RequirePerm module="accounting"><Accounts /></RequirePerm>} />
                <Route path="/ledger" element={<RequirePerm module="accounting"><Ledger /></RequirePerm>} />
                <Route path="/financial-reports" element={<RequirePerm module="accounting"><FinancialReports /></RequirePerm>} />
                <Route path="/financial-summary" element={<RequireRole roles={["admin","super_admin"]}><RequirePerm module="accounting"><FinancialSummary /></RequirePerm></RequireRole>} />
                <Route path="/journal-entry" element={<RequirePerm module="accounting" action="can_add"><JournalEntry /></RequirePerm>} />
                <Route path="/ledger-integrity" element={<RequirePerm module="accounting"><LedgerIntegrity /></RequirePerm>} />
                <Route path="/approvals" element={<RequirePerm module="approvals"><Approvals /></RequirePerm>} />
                <Route path="/period-close" element={<RequirePerm module="accounting" action="can_edit"><PeriodClose /></RequirePerm>} />
                <Route path="/finance-summary" element={<RequirePerm module="accounting"><FinanceSummary /></RequirePerm>} />
                <Route path="/land-history" element={<RequirePerm module="farmers"><LandHistory /></RequirePerm>} />
                
                <Route path="/bank-accounts" element={<RequirePerm module="accounting"><BankAccounts /></RequirePerm>} />
                <Route path="/vouchers" element={<RequirePerm module="accounting"><Vouchers /></RequirePerm>} />
                <Route path="/public-payments" element={<RequireRole roles={["admin","super_admin","staff"]}><PublicPaymentIntents /></RequireRole>} />
                <Route path="/payment-reconciliation" element={<RequireRole roles={["admin","super_admin","committee"]}><PaymentReconciliation /></RequireRole>} />

                <Route path="/sms-settings" element={<RequireRole roles={["super_admin"]}><SmsSettings /></RequireRole>} />
                <Route path="/sms-logs" element={<RequirePerm module="sms"><SmsLogs /></RequirePerm>} />
                <Route path="/sms-templates" element={<RequireRole roles={["super_admin"]}><SmsTemplates /></RequireRole>} />
                <Route path="/locations" element={<RequirePerm module="locations"><Locations /></RequirePerm>} />
                <Route path="/admin/reconciliation" element={<RequirePerm module="accounting"><LedgerReconciliation /></RequirePerm>} />
                <Route path="/admin/share-capital-reconciliation" element={<RequirePerm module="accounting"><ShareCapitalReconciliation /></RequirePerm>} />
                <Route path="/admin/qr-rotation" element={<RequireRole roles={["super_admin"]}><QrRotation /></RequireRole>} />
                <Route path="/admin/bulk-cards" element={<RequirePerm module="farmers"><BulkCards /></RequirePerm>} />
                <Route path="/admin/receipt-template" element={<RequireRole roles={["super_admin"]}><ReceiptTemplate /></RequireRole>} />
                <Route path="/admin/receipt-serial-audit" element={<RequireRole roles={["super_admin"]}><ReceiptSerialAudit /></RequireRole>} />
                <Route path="/admin/card-designer" element={<RequireRole roles={["super_admin"]}><CardDesigner /></RequireRole>} />
                <Route path="/admin/role-matrix" element={<RequireDeveloper><RoleMatrix /></RequireDeveloper>} />
                <Route path="/admin/user-roles" element={<RequireRole roles={["super_admin"]}><UserRoles /></RequireRole>} />
                <Route path="/admin/verify" element={<RequireRole roles={["super_admin"]}><AdminVerify /></RequireRole>} />
                <Route path="/admin/my-permissions" element={<MyPermissions />} />
                <Route path="/admin/duplicate-receipts" element={<RequireDeveloper><DuplicateReceiptAudit /></RequireDeveloper>} />
                <Route path="/admin/farmer-login-audit" element={<RequireDeveloper><FarmerLoginAudit /></RequireDeveloper>} />
                <Route path="/admin/demo-manager" element={<RequireDeveloper><DemoManager /></RequireDeveloper>} />
                <Route path="/admin/quick-seed" element={<RequireDeveloper><QuickSeed /></RequireDeveloper>} />
                <Route path="/admin/demo-ops-audit" element={<RequireDeveloper><DemoOpsAudit /></RequireDeveloper>} />
                <Route path="/admin/integrity-runs" element={<RequireRole roles={["admin","super_admin"]}><IntegrityRuns /></RequireRole>} />
                <Route path="/irrigation/billing-split" element={<RequireRole roles={["admin","super_admin"]}><BillingSplitPreview /></RequireRole>} />
                <Route path="/admin/patwaris" element={<RequireRole roles={["admin","super_admin"]}><Patwaris /></RequireRole>} />
                <Route path="/admin/patwaris/:id" element={<RequireRole roles={["admin","super_admin"]}><PatwariDetail /></RequireRole>} />
                <Route path="/admin/developer-updates" element={<RequireDeveloper><DeveloperUpdates /></RequireDeveloper>} />
                <Route path="/admin/lookups" element={<RequireRole roles={["admin","super_admin"]}><AdminLookups /></RequireRole>} />
                <Route path="/admin/loan-plans" element={<RequireRole roles={["admin","super_admin"]}><LoanPlans /></RequireRole>} />
                <Route path="/admin/rate-audit" element={<RequireRole roles={["admin","super_admin"]}><RateAuditLog /></RequireRole>} />
                <Route path="/admin/irrigation-categories" element={<RequireRole roles={["admin","super_admin"]}><IrrigationCategories /></RequireRole>} />
                <Route path="/admin/irrigation-category-rates" element={<RequireRole roles={["admin","super_admin"]}><IrrigationCategoryRates /></RequireRole>} />
                <Route path="/admin/asset-categories" element={<RequirePerm module="assets" action="can_edit"><AssetCategories /></RequirePerm>} />
                <Route path="/assets/items" element={<RequirePerm module="assets"><AssetItems /></RequirePerm>} />
                <Route path="/assets/items/:id" element={<RequirePerm module="assets"><AssetItemDetail /></RequirePerm>} />
                <Route path="/assets/dashboard" element={<RequirePerm module="assets"><AssetDashboard /></RequirePerm>} />
                <Route path="/assets/reports" element={<RequirePerm module="assets"><AssetReports /></RequirePerm>} />
                <Route path="/assets/scan" element={<RequirePerm module="assets"><AssetScanner /></RequirePerm>} />
                <Route path="/assets/scan/history" element={<RequirePerm module="assets"><AssetScanHistory /></RequirePerm>} />
                <Route path="/assets/qr-bulk" element={<RequirePerm module="assets"><AssetBulkQR /></RequirePerm>} />
                <Route path="/assets/depreciation" element={<RequirePerm module="assets"><AssetDepreciation /></RequirePerm>} />
                <Route path="/assets/stock" element={<RequirePerm module="assets"><AssetStock /></RequirePerm>} />
                <Route path="/assets/movements" element={<RequirePerm module="assets"><AssetMovements /></RequirePerm>} />
                <Route path="/assets/installations" element={<RequirePerm module="assets"><AssetInstallations /></RequirePerm>} />
                <Route path="/assets/maintenance" element={<RequirePerm module="assets"><AssetMaintenance /></RequirePerm>} />
                <Route path="/assets/disposal" element={<RequirePerm module="assets"><AssetDisposal /></RequirePerm>} />
                <Route path="/assets/alerts" element={<RequirePerm module="assets"><AssetAlerts /></RequirePerm>} />
                <Route path="/assets/maintenance-schedules" element={<RequirePerm module="assets"><MaintenanceSchedules /></RequirePerm>} />
                <Route path="/reports/rate-source" element={<RequireRole roles={["admin","super_admin"]}><RateSourceReport /></RequireRole>} />
                <Route path="/reports/override-audit" element={<RequireRole roles={["admin","super_admin"]}><OverrideAuditReport /></RequireRole>} />
                <Route path="/reports/receipt-audit" element={<RequireRole roles={["admin","super_admin"]}><ReceiptAuditReport /></RequireRole>} />
                <Route path="/irrigation-reports" element={<RequirePerm module="reports"><IrrigationReports /></RequirePerm>} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/help" element={<Help />} />
                <Route path="/help/farmer-card" element={<HelpFarmerCard />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
