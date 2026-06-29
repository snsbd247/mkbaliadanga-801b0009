import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LaravelAuthProvider, useLaravelAuth } from "@/auth/LaravelAuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sprout } from "lucide-react";
import { isSupabaseBackend } from "@/lib/backend";

function StaffLoginInner() {
  const { signIn, user, loading } = useLaravelAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/api/dashboard" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(identifier.trim(), password);
      toast({ title: "Welcome", description: "Signed in successfully" });
      setTimeout(() => navigate("/api/dashboard"), 50);
    } catch (err: any) {
      const isAccessDenied = err?.name === "AccessDeniedError";
      toast({
        title: isAccessDenied ? "Access denied" : "Login failed",
        // Safe message only — never leak whether the username/password specifically was wrong.
        description: isAccessDenied
          ? err.message
          : err?.response?.status === 401 || err?.response?.status === 422
            ? "Invalid user ID or password."
            : err?.response?.data?.message || "Unable to sign in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Staff sign in</CardTitle>
          <CardDescription>For Developer, Super Admin and Staff accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">User ID</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. ismail162"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
          <Link
            to="/api/farmer-login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Sprout className="h-4 w-4" />
            Are you a farmer? Sign in here
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ApiAuth() {
  // In Lovable preview (no Laravel backend), fall back to the Supabase auth page.
  if (isSupabaseBackend) return <Navigate to="/auth" replace />;
  return (
    <LaravelAuthProvider>
      <StaffLoginInner />
    </LaravelAuthProvider>
  );
}
