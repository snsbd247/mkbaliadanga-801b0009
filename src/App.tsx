import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { AppLayout } from "@/components/layout/AppLayout";
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
import IrrigationInvoices from "./pages/IrrigationInvoices";
import IrrigationReports from "./pages/IrrigationReports";
import IrrigationRates from "./pages/IrrigationRates";
import Payments from "./pages/Payments";
import CombinedPayment from "./pages/CombinedPayment";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";
import Scan from "./pages/Scan";
import Cashbook from "./pages/Cashbook";
import Statement from "./pages/Statement";
import Dues from "./pages/Dues";
import Backup from "./pages/Backup";
import Diagnostics from "./pages/Diagnostics";
import Accounts from "./pages/Accounts";
import Ledger from "./pages/Ledger";
import FinancialReports from "./pages/FinancialReports";
import JournalEntry from "./pages/JournalEntry";
import LedgerIntegrity from "./pages/LedgerIntegrity";
import Approvals from "./pages/Approvals";
import PeriodClose from "./pages/PeriodClose";
import FinanceSummary from "./pages/FinanceSummary";

import SmsSettings from "./pages/SmsSettings";
import SmsLogs from "./pages/SmsLogs";
import Locations from "./pages/Locations";
import LedgerReconciliation from "./pages/LedgerReconciliation";
import ShareCapitalReconciliation from "./pages/ShareCapitalReconciliation";
import QrRotation from "./pages/QrRotation";
import BulkCards from "./pages/BulkCards";
import ReceiptTemplate from "./pages/ReceiptTemplate";
import LoanReceiptSettings from "./pages/LoanReceiptSettings";
import BulkLoanExport from "./pages/BulkLoanExport";
import CardDesigner from "./pages/CardDesigner";
import RoleMatrix from "./pages/admin/RoleMatrix";
import MyPermissions from "./pages/admin/MyPermissions";
import IrrigationDueReport from "./pages/reports/IrrigationDueReport";
import InvoiceReport from "./pages/reports/InvoiceReport";
import CollectionReport from "./pages/reports/CollectionReport";
import SavingsLoanReport from "./pages/reports/SavingsLoanReport";
import ReceiptKindReport from "./pages/reports/ReceiptKindReport";
import MonthlyReceiptRegister from "./pages/reports/MonthlyReceiptRegister";
import OfficerSummaryReport from "./pages/reports/OfficerSummaryReport";
import RateSourceReport from "./pages/reports/RateSourceReport";
import OverrideAuditReport from "./pages/reports/OverrideAuditReport";
import FarmerRejectionsReport from "./pages/reports/FarmerRejectionsReport";
import ExpensesReport from "./pages/reports/ExpensesReport";
import PromiseDueReport from "./pages/reports/PromiseDueReport";
import IrrigationDueMismatch from "./pages/admin/IrrigationDueMismatch";
import RetryJobs from "./pages/admin/RetryJobs";
import AuditTimeline from "./pages/admin/AuditTimeline";
import FarmersImport from "./pages/FarmersImport";
import DataImport from "./pages/DataImport";
import VoterList from "./pages/VoterList";
import VoterAudit from "./pages/VoterAudit";
import VoterHistory from "./pages/VoterHistory";
import IdReconcile from "./pages/admin/IdReconcile";
import IdReview from "./pages/admin/IdReview";
import DuplicateReceiptAudit from "./pages/admin/DuplicateReceiptAudit";
import FarmerLoginAudit from "./pages/admin/FarmerLoginAudit";
import DemoManager from "./pages/admin/DemoManager";
import QuickSeed from "./pages/admin/QuickSeed";
import Patwaris from "./pages/admin/Patwaris";
import PatwariDetail from "./pages/admin/PatwariDetail";
import FarmerStatement from "./pages/FarmerStatement";

import LoanPlans from "./pages/LoanPlans";
import LoanDetail from "./pages/LoanDetail";
import LoanDelaySettings from "./pages/admin/LoanDelaySettings";
import LoanOverdueReport from "./pages/reports/LoanOverdueReport";
import InstallmentCollectionReport from "./pages/reports/InstallmentCollectionReport";
import LoanPenaltyReport from "./pages/reports/LoanPenaltyReport";
import ShareCollection from "./pages/ShareCollection";
import DuesAudit from "./pages/DuesAudit";
import Profile from "./pages/Profile";
import Help from "./pages/Help";
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
import VerifyReceipt from "./pages/VerifyReceipt";
import ApiAuth from "./pages/ApiAuth";
import ApiFarmerPortal from "./pages/ApiFarmerPortal";
import ApiFarmerAuth from "./pages/ApiFarmerAuth";
import ApiFarmers from "./pages/ApiFarmers";
import ApiLoans from "./pages/ApiLoans";
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
import ApiLoanPlans from "./pages/ApiLoanPlans";
import ApiIrrigationRates from "./pages/ApiIrrigationRates";
import ApiAssets from "./pages/ApiAssets";
import ApiDashboard from "./pages/ApiDashboard";
import { USE_API_BACKEND, LEGACY_TO_API } from "./lib/api/featureFlag";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<FarmerPortalLogin />} />
              <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify/:token" element={<VerifyReceipt />} />
              <Route path="/r/:token" element={<VerifyReceipt />} />
              <Route path="/api/auth" element={<ApiAuth />} />
              <Route path="/api/farmer-login" element={<ApiFarmerAuth />} />
              <Route path="/api/farmer-portal" element={<ApiFarmerPortal />} />
              <Route path="/api" element={<Navigate to="/api/dashboard" replace />} />
              <Route path="/api/dashboard" element={<ApiDashboard />} />
              <Route path="/api/farmers" element={<ApiFarmers />} />
              <Route path="/api/loans" element={<ApiLoans />} />
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
              <Route path="/api/loan-plans" element={<ApiLoanPlans />} />
              <Route path="/api/irrigation-rates" element={<ApiIrrigationRates />} />
              <Route path="/api/assets" element={<ApiAssets />} />
              {/* Legacy → API redirects disabled: same login/UI on preview and VPS. */}
              <Route element={<AppLayout />}>
                <Route path="/admin" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/offices" element={<RequirePerm module="offices"><Offices /></RequirePerm>} />
                <Route path="/farmers" element={<RequirePerm module="farmers"><Farmers /></RequirePerm>} />
                <Route path="/voters" element={<RequirePerm module="farmers"><VoterList /></RequirePerm>} />
                <Route path="/farmers/:id" element={<RequirePerm module="farmers"><FarmerDetail /></RequirePerm>} />
                <Route path="/farmers/:id/report" element={<RequirePerm module="farmers"><FarmerProfileReport /></RequirePerm>} />
                <Route path="/farmers/:id/card" element={<RequirePerm module="farmers"><FarmerCard /></RequirePerm>} />
                <Route path="/lands/:id" element={<RequirePerm module="farmers"><LandDetail /></RequirePerm>} />
                <Route path="/scan-payment" element={<RequirePerm module="payments"><ScanPayment /></RequirePerm>} />
                <Route path="/seasons" element={<RequirePerm module="seasons"><Seasons /></RequirePerm>} />
                <Route path="/savings" element={<RequirePerm module="savings"><Savings /></RequirePerm>} />

                <Route path="/loans" element={<RequirePerm module="loans"><Loans /></RequirePerm>} />
                <Route path="/loans/plans" element={<RequirePerm module="loans"><LoanPlans /></RequirePerm>} />
                <Route path="/loans/:loanId" element={<RequirePerm module="loans"><LoanDetail /></RequirePerm>} />
                <Route path="/admin/loan-delay-settings" element={<RequirePerm module="loans" action="can_edit"><LoanDelaySettings /></RequirePerm>} />
                <Route path="/reports/loan-overdue" element={<RequirePerm module="reports"><LoanOverdueReport /></RequirePerm>} />
                <Route path="/reports/installment-collection" element={<RequirePerm module="reports"><InstallmentCollectionReport /></RequirePerm>} />
                <Route path="/reports/loan-penalty" element={<RequirePerm module="reports"><LoanPenaltyReport /></RequirePerm>} />
                <Route path="/share-collection" element={<RequirePerm module="savings"><ShareCollection /></RequirePerm>} />
                {/* Legacy routes redirect to unified invoice/payment pages */}
                <Route path="/irrigation" element={<Navigate to="/irrigation/invoices" replace />} />
                <Route path="/irrigation/collect" element={<Navigate to="/payments" replace />} />
                <Route path="/irrigation/invoices" element={<RequirePerm module="irrigation"><IrrigationInvoices /></RequirePerm>} />
                <Route path="/irrigation/rates" element={<RequirePerm module="irrigation"><IrrigationRates /></RequirePerm>} />
                <Route path="/payments" element={<RequirePerm module="payments"><Payments /></RequirePerm>} />
                <Route path="/payments/combined" element={<RequirePerm module="payments"><CombinedPayment /></RequirePerm>} />
                <Route path="/reports" element={<RequirePerm module="reports"><Reports /></RequirePerm>} />
                <Route path="/reports/irrigation-due" element={<RequirePerm module="reports"><IrrigationDueReport /></RequirePerm>} />
                <Route path="/reports/invoices" element={<RequirePerm module="reports"><InvoiceReport /></RequirePerm>} />
                <Route path="/reports/collections" element={<RequirePerm module="reports"><CollectionReport /></RequirePerm>} />
                <Route path="/reports/savings-loan" element={<RequirePerm module="reports"><SavingsLoanReport /></RequirePerm>} />
                <Route path="/reports/receipts" element={<RequirePerm module="reports"><ReceiptKindReport /></RequirePerm>} />
                <Route path="/reports/receipt-register" element={<RequirePerm module="reports"><MonthlyReceiptRegister /></RequirePerm>} />
                <Route path="/reports/farmer-rejections" element={<RequirePerm module="farmers" action="can_edit"><FarmerRejectionsReport /></RequirePerm>} />
                <Route path="/reports/voter-audit" element={<RequirePerm module="farmers" action="can_edit"><VoterAudit /></RequirePerm>} />
                <Route path="/voters/history" element={<RequirePerm module="farmers" action="can_edit"><VoterHistory /></RequirePerm>} />
                <Route path="/admin/id-reconcile" element={<RequireDeveloper><IdReconcile /></RequireDeveloper>} />
                <Route path="/admin/id-review" element={<RequirePerm module="farmers" action="can_view"><IdReview /></RequirePerm>} />
                <Route path="/reports/farmer-statement" element={<RequirePerm module="reports"><FarmerStatement /></RequirePerm>} />
                <Route path="/reports/expenses" element={<RequirePerm module="reports" action="can_view"><ExpensesReport /></RequirePerm>} />
                <Route path="/reports/promise-due" element={<RequirePerm module="reports"><PromiseDueReport /></RequirePerm>} />
                <Route path="/admin/irrigation-due-mismatch" element={<RequireRole roles={["admin","super_admin"]}><IrrigationDueMismatch /></RequireRole>} />
                <Route path="/admin/retry-jobs" element={<RequireRole roles={["admin","super_admin"]}><RetryJobs /></RequireRole>} />
                <Route path="/admin/audit-timeline" element={<RequireRole roles={["admin","super_admin"]}><AuditTimeline /></RequireRole>} />
                <Route path="/farmers/import" element={<RequirePerm module="farmers" action="can_add"><FarmersImport /></RequirePerm>} />
                <Route path="/import" element={<RequirePerm module="farmers" action="can_add"><DataImport /></RequirePerm>} />
                <Route path="/users" element={<RequireRole roles={["admin","super_admin"]}><Users /></RequireRole>} />
                <Route path="/settings" element={<RequireRole roles={["admin","super_admin"]}><Settings /></RequireRole>} />
                <Route path="/scan" element={<RequirePerm module="payments"><Scan /></RequirePerm>} />
                <Route path="/cashbook" element={<RequirePerm module="cashbook"><Cashbook /></RequirePerm>} />
                <Route path="/statement" element={<RequirePerm module="savings"><Statement /></RequirePerm>} />
                <Route path="/dues" element={<RequirePerm module="reports"><Dues /></RequirePerm>} />
                <Route path="/dues-audit" element={<RequirePerm module="reports"><DuesAudit /></RequirePerm>} />
                <Route path="/backup" element={<RequireDeveloper><Backup /></RequireDeveloper>} />
                <Route path="/audit" element={<RequireDeveloper><AuditLogs /></RequireDeveloper>} />
                <Route path="/diagnostics" element={<RequireDeveloper><Diagnostics /></RequireDeveloper>} />
                <Route path="/accounts" element={<RequirePerm module="accounting"><Accounts /></RequirePerm>} />
                <Route path="/ledger" element={<RequirePerm module="accounting"><Ledger /></RequirePerm>} />
                <Route path="/financial-reports" element={<RequirePerm module="accounting"><FinancialReports /></RequirePerm>} />
                <Route path="/journal-entry" element={<RequirePerm module="accounting" action="can_add"><JournalEntry /></RequirePerm>} />
                <Route path="/ledger-integrity" element={<RequirePerm module="accounting"><LedgerIntegrity /></RequirePerm>} />
                <Route path="/approvals" element={<RequirePerm module="approvals"><Approvals /></RequirePerm>} />
                <Route path="/period-close" element={<RequirePerm module="accounting" action="can_edit"><PeriodClose /></RequirePerm>} />
                <Route path="/finance-summary" element={<RequirePerm module="accounting"><FinanceSummary /></RequirePerm>} />

                <Route path="/sms-settings" element={<RequireRole roles={["admin","super_admin"]}><SmsSettings /></RequireRole>} />
                <Route path="/sms-logs" element={<RequirePerm module="sms"><SmsLogs /></RequirePerm>} />
                <Route path="/locations" element={<RequirePerm module="locations"><Locations /></RequirePerm>} />
                <Route path="/admin/reconciliation" element={<RequirePerm module="accounting"><LedgerReconciliation /></RequirePerm>} />
                <Route path="/admin/share-capital-reconciliation" element={<RequirePerm module="accounting"><ShareCapitalReconciliation /></RequirePerm>} />
                <Route path="/admin/qr-rotation" element={<RequireRole roles={["admin","super_admin"]}><QrRotation /></RequireRole>} />
                <Route path="/admin/bulk-cards" element={<RequirePerm module="farmers"><BulkCards /></RequirePerm>} />
                <Route path="/admin/receipt-template" element={<RequireRole roles={["admin","super_admin"]}><ReceiptTemplate /></RequireRole>} />
                <Route path="/admin/loan-receipt-settings" element={<RequireRole roles={["admin","super_admin"]}><LoanReceiptSettings /></RequireRole>} />
                <Route path="/admin/bulk-loan-export" element={<RequireRole roles={["admin","super_admin"]}><BulkLoanExport /></RequireRole>} />
                <Route path="/admin/card-designer" element={<RequireRole roles={["admin","super_admin"]}><CardDesigner /></RequireRole>} />
                <Route path="/admin/role-matrix" element={<RequireDeveloper><RoleMatrix /></RequireDeveloper>} />
                <Route path="/admin/my-permissions" element={<MyPermissions />} />
                <Route path="/admin/duplicate-receipts" element={<RequireDeveloper><DuplicateReceiptAudit /></RequireDeveloper>} />
                <Route path="/admin/farmer-login-audit" element={<RequireDeveloper><FarmerLoginAudit /></RequireDeveloper>} />
                <Route path="/admin/demo-manager" element={<RequireDeveloper><DemoManager /></RequireDeveloper>} />
                <Route path="/admin/quick-seed" element={<RequireDeveloper><QuickSeed /></RequireDeveloper>} />
                <Route path="/admin/patwaris" element={<RequireRole roles={["admin","super_admin"]}><Patwaris /></RequireRole>} />
                <Route path="/admin/patwaris/:id" element={<RequireRole roles={["admin","super_admin"]}><PatwariDetail /></RequireRole>} />
                <Route path="/admin/developer-updates" element={<RequireDeveloper><DeveloperUpdates /></RequireDeveloper>} />
                <Route path="/admin/lookups" element={<RequireRole roles={["admin","super_admin"]}><AdminLookups /></RequireRole>} />
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
                <Route path="/reports/rate-source" element={<RequireRole roles={["admin","super_admin"]}><RateSourceReport /></RequireRole>} />
                <Route path="/reports/override-audit" element={<RequireRole roles={["admin","super_admin"]}><OverrideAuditReport /></RequireRole>} />
                <Route path="/irrigation-reports" element={<IrrigationReports />} />
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
