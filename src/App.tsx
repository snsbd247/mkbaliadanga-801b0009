import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import AuthPage from "./pages/Auth";
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
              <Route path="/auth" element={<AuthPage />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
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
                <Route path="/audit" element={<AuditLogs />} />
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
