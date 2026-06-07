import { Link } from "react-router-dom";
import { ApiShell } from "@/components/api/ApiShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLaravelAuth } from "@/auth/LaravelAuthProvider";

const TILES = [
  { to: "/api/farmers", title: "Farmers", desc: "Members, lands, KYC" },
  
  { to: "/api/savings", title: "Savings", desc: "Deposits, withdrawals" },
  { to: "/api/payments", title: "Payments", desc: "Collections, receipts" },
  { to: "/api/accounts", title: "Accounts", desc: "Chart of Accounts" },
  { to: "/api/journals", title: "Journals", desc: "Manual entries" },
  { to: "/api/reports", title: "Reports", desc: "TB, P&L, BS, Cashbook" },
  { to: "/api/lands", title: "Lands", desc: "Land registry" },
  { to: "/api/seasons", title: "Seasons", desc: "Operational periods" },
  { to: "/api/irrigation-rates", title: "Irrigation Rates", desc: "Per-crop pricing" },
  
  { to: "/api/assets", title: "Assets", desc: "Inventory" },
  { to: "/api/users", title: "Users", desc: "Staff & access" },
  { to: "/api/roles", title: "Roles", desc: "RBAC matrix" },
  { to: "/api/offices", title: "Offices", desc: "Branches" },
  { to: "/api/sms", title: "SMS", desc: "Logs & retry" },
  { to: "/api/qr", title: "QR", desc: "Token issue/resolve" },
  { to: "/api/audit", title: "Audit", desc: "Activity logs" },
];

function DashboardInner() {
  const { user, roles } = useLaravelAuth();
  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {user?.name || user?.email}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Roles: {roles.join(", ") || "—"}
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        {TILES.map(t => (
          <Link key={t.to} to={t.to}>
            <Card className="hover:bg-muted/40 transition-colors h-full">
              <CardHeader className="pb-2"><CardTitle className="text-base">{t.title}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{t.desc}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ApiDashboard() {
  return (
    <ApiShell>
      <DashboardInner />
    </ApiShell>
  );
}
