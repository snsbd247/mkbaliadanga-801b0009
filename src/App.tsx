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
import Seasons from "./pages/Seasons";
import Savings from "./pages/Savings";
import Loans from "./pages/Loans";
import Irrigation from "./pages/Irrigation";
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
import NotFound from "./pages/NotFound.tsx";

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
                <Route path="/farmers/:id" element={<FarmerDetail />} />
                <Route path="/seasons" element={<Seasons />} />
                <Route path="/savings" element={<Savings />} />
                <Route path="/loans" element={<Loans />} />
                <Route path="/irrigation" element={<Irrigation />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/scan" element={<Scan />} />
                <Route path="/cashbook" element={<Cashbook />} />
                <Route path="/statement" element={<Statement />} />
                <Route path="/dues" element={<Dues />} />
                <Route path="/backup" element={<Backup />} />
                <Route path="/audit" element={<AuditLogs />} />
                <Route path="/diagnostics" element={<Diagnostics />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/ledger" element={<Ledger />} />
                <Route path="/financial-reports" element={<FinancialReports />} />
                <Route path="/journal-entry" element={<JournalEntry />} />
                <Route path="/ledger-integrity" element={<LedgerIntegrity />} />
                <Route path="/approvals" element={<Approvals />} />
                <Route path="/period-close" element={<PeriodClose />} />
                <Route path="/finance-summary" element={<FinanceSummary />} />
                
                <Route path="/sms-settings" element={<SmsSettings />} />
                <Route path="/sms-logs" element={<SmsLogs />} />
                <Route path="/locations" element={<Locations />} />
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
