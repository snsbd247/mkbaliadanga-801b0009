import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiFarmer, farmerMe, logout } from "@/lib/api/auth";
import { getApiToken } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

export default function ApiFarmerPortal() {
  const [farmer, setFarmer] = useState<ApiFarmer | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!getApiToken()) { setLoading(false); return; }
    farmerMe()
      .then(setFarmer)
      .catch((e) => setErr(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!getApiToken()) return <Navigate to="/api/auth" replace />;

  const onSignOut = async () => {
    await logout();
    toast({ title: "Signed out" });
    navigate("/api/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 h-14">
          <span className="font-semibold">Farmer Portal</span>
          <Button variant="outline" size="sm" onClick={onSignOut}>Logout</Button>
        </div>
      </header>
      <main className="container mx-auto p-4 space-y-4">
        {err && (
          <Card className="border-destructive"><CardContent className="p-4 text-sm text-destructive">{err}</CardContent></Card>
        )}
        {farmer && (
          <Card>
            <CardHeader>
              <CardTitle>Welcome, {farmer.name}</CardTitle>
              <CardDescription>Mobile: {farmer.mobile}{farmer.code ? ` · Code: ${farmer.code}` : ""}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Self-service for statements, dues, and payments will appear here once the backend exposes farmer endpoints.
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
