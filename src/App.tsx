import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import Irrigation from "./pages/Irrigation";
import IrrigationRates from "./pages/IrrigationRates";
import Payments from "./pages/Payments";
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
import QrRotation from "./pages/QrRotation";
import BulkCards from "./pages/BulkCards";
import ReceiptTemplate from "./pages/ReceiptTemplate";
import CardDesigner from "./pages/CardDesigner";
import RoleMatrix from "./pages/admin/RoleMatrix";
import IrrigationDueReport from "./pages/reports/IrrigationDueReport";
import CollectionReport from "./pages/reports/CollectionReport";
import FarmerRejectionsReport from "./pages/reports/FarmerRejectionsReport";
import ExpensesReport from "./pages/reports/ExpensesReport";
import FarmersImport from "./pages/FarmersImport";
import DataImport from "./pages/DataImport";
import VoterList from "./pages/VoterList";
import VoterAudit from "./pages/VoterAudit";
import VoterHistory from "./pages/VoterHistory";
import IdReconcile from "./pages/admin/IdReconcile";
import FarmerStatement from "./pages/FarmerStatement";

import LoanPlans from "./pages/LoanPlans";
import ShareCollection from "./pages/ShareCollection";
import NotFound from "./pages/NotFound.tsx";
import { RequirePerm } from "./components/auth/RequirePerm";

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
              <Route element={<AppLayout />}>
                <Route path="/admin" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/offices" element={<Offices />} />
                <Route path="/farmers" element={<Farmers />} />
                <Route path="/voters" element={<VoterList />} />
                <Route path="/farmers/:id" element={<FarmerDetail />} />
                <Route path="/farmers/:id/report" element={<FarmerProfileReport />} />
                <Route path="/farmers/:id/card" element={<FarmerCard />} />
                <Route path="/lands/:id" element={<LandDetail />} />
                <Route path="/scan-payment" element={<ScanPayment />} />
                <Route path="/seasons" element={<Seasons />} />
                <Route path="/savings" element={<Savings />} />
                
                <Route path="/loans" element={<Loans />} />
                <Route path="/loans/plans" element={<LoanPlans />} />
                <Route path="/share-collection" element={<ShareCollection />} />
                <Route path="/irrigation" element={<Irrigation />} />
                <Route path="/irrigation/rates" element={<IrrigationRates />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/reports/irrigation-due" element={<IrrigationDueReport />} />
                <Route path="/reports/collections" element={<CollectionReport />} />
                <Route path="/reports/farmer-rejections" element={<RequirePerm module="farmers" action="can_edit"><FarmerRejectionsReport /></RequirePerm>} />
                <Route path="/reports/voter-audit" element={<RequirePerm module="farmers" action="can_edit"><VoterAudit /></RequirePerm>} />
                <Route path="/voters/history" element={<RequirePerm module="farmers" action="can_edit"><VoterHistory /></RequirePerm>} />
                <Route path="/admin/id-reconcile" element={<RequirePerm module="farmers" action="can_edit"><IdReconcile /></RequirePerm>} />
                <Route path="/reports/farmer-statement" element={<FarmerStatement />} />
                <Route path="/reports/expenses" element={<RequirePerm module="reports" action="can_view"><ExpensesReport /></RequirePerm>} />
                <Route path="/farmers/import" element={<RequirePerm module="farmers" action="can_add"><FarmersImport /></RequirePerm>} />
                <Route path="/import" element={<RequirePerm module="farmers" action="can_add"><DataImport /></RequirePerm>} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/scan" element={<Scan />} />
                <Route path="/cashbook" element={<RequirePerm module="cashbook"><Cashbook /></RequirePerm>} />
                <Route path="/statement" element={<Statement />} />
                <Route path="/dues" element={<Dues />} />
                <Route path="/backup" element={<Backup />} />
                <Route path="/audit" element={<AuditLogs />} />
                <Route path="/diagnostics" element={<Diagnostics />} />
                <Route path="/accounts" element={<RequirePerm module="accounting"><Accounts /></RequirePerm>} />
                <Route path="/ledger" element={<RequirePerm module="accounting"><Ledger /></RequirePerm>} />
                <Route path="/financial-reports" element={<RequirePerm module="accounting"><FinancialReports /></RequirePerm>} />
                <Route path="/journal-entry" element={<RequirePerm module="accounting" action="can_add"><JournalEntry /></RequirePerm>} />
                <Route path="/ledger-integrity" element={<RequirePerm module="accounting"><LedgerIntegrity /></RequirePerm>} />
                <Route path="/approvals" element={<RequirePerm module="approvals"><Approvals /></RequirePerm>} />
                <Route path="/period-close" element={<RequirePerm module="accounting" action="can_edit"><PeriodClose /></RequirePerm>} />
                <Route path="/finance-summary" element={<RequirePerm module="accounting"><FinanceSummary /></RequirePerm>} />
                
                <Route path="/sms-settings" element={<SmsSettings />} />
                <Route path="/sms-logs" element={<RequirePerm module="sms"><SmsLogs /></RequirePerm>} />
                <Route path="/locations" element={<Locations />} />
                <Route path="/admin/reconciliation" element={<LedgerReconciliation />} />
                <Route path="/admin/qr-rotation" element={<QrRotation />} />
                <Route path="/admin/bulk-cards" element={<BulkCards />} />
                <Route path="/admin/receipt-template" element={<ReceiptTemplate />} />
                <Route path="/admin/card-designer" element={<CardDesigner />} />
                <Route path="/admin/role-matrix" element={<RoleMatrix />} />
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
