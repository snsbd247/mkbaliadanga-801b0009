import { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { LaravelAuthProvider, useLaravelAuth } from "@/auth/LaravelAuthProvider";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/api/farmers", label: "Farmers" },
  { to: "/api/loans", label: "Loans" },
  { to: "/api/savings", label: "Savings" },
  { to: "/api/payments", label: "Payments" },
  { to: "/api/accounts", label: "Accounts" },
  { to: "/api/journals", label: "Journals" },
  { to: "/api/reports", label: "Reports" },
];

function Inner({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useLaravelAuth();
  const loc = useLocation();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <Navigate to="/api/auth" replace />;
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-4">
            <span className="font-semibold">MK API</span>
            <nav className="flex gap-1">
              {NAV.map(n => (
                <Link key={n.to} to={n.to}
                  className={`px-3 py-1.5 rounded text-sm ${loc.pathname.startsWith(n.to) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>Logout</Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function ApiShell({ children }: { children: ReactNode }) {
  return (
    <LaravelAuthProvider>
      <Inner>{children}</Inner>
    </LaravelAuthProvider>
  );
}
