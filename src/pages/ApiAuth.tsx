import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LaravelAuthProvider, useLaravelAuth } from "@/auth/LaravelAuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { farmerRequestOtp, farmerVerifyOtp } from "@/lib/api/auth";
import { ShieldCheck, Code2, Users, Sprout } from "lucide-react";

function landingFor(roles: string[]): string {
  if (roles.includes("developer")) return "/api/dashboard";
  if (roles.includes("super_admin")) return "/api/dashboard";
  if (roles.includes("admin") || roles.includes("committee") || roles.includes("staff")) return "/api/dashboard";
  return "/api/dashboard";
}

function StaffLogin({ defaultRole }: { defaultRole?: "developer" | "super_admin" | "staff" }) {
  const { signIn, user, loading } = useLaravelAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  if (loading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to={landingFor(user.roles ?? [])} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
      toast({ title: "Welcome", description: "Signed in successfully" });
      // user state will update via provider; navigate will happen via Navigate above
      setTimeout(() => navigate("/api/dashboard"), 50);
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const placeholder =
    defaultRole === "developer" ? "developer@example.com" :
    defaultRole === "super_admin" ? "superadmin@example.com" :
    "you@example.com";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function FarmerLogin() {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"mobile" | "otp">("mobile");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await farmerRequestOtp(mobile);
      toast({ title: "OTP sent", description: `We sent a code to ${mobile}` });
      setStage("otp");
    } catch (err: any) {
      toast({ title: "Could not send OTP", description: err?.response?.data?.message || err.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await farmerVerifyOtp(mobile, otp);
      toast({ title: "Welcome", description: "Signed in" });
      navigate("/api/farmer-portal");
    } catch (err: any) {
      toast({ title: "Verification failed", description: err?.response?.data?.message || err.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  if (stage === "mobile") {
    return (
      <form onSubmit={sendOtp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile number</Label>
          <Input id="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="01XXXXXXXXX" required />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send OTP"}</Button>
      </form>
    );
  }
  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="otp">Enter the 6-digit OTP sent to {mobile}</Label>
        <Input id="otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} required />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setStage("mobile")} disabled={busy}>Back</Button>
        <Button type="submit" className="flex-1" disabled={busy}>{busy ? "Verifying…" : "Verify & sign in"}</Button>
      </div>
    </form>
  );
}

function AuthInner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Choose your account type</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="staff" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="staff" className="text-xs"><Users className="h-3.5 w-3.5 mr-1" />Staff</TabsTrigger>
              <TabsTrigger value="superadmin" className="text-xs"><ShieldCheck className="h-3.5 w-3.5 mr-1" />Super</TabsTrigger>
              <TabsTrigger value="developer" className="text-xs"><Code2 className="h-3.5 w-3.5 mr-1" />Dev</TabsTrigger>
              <TabsTrigger value="farmer" className="text-xs"><Sprout className="h-3.5 w-3.5 mr-1" />Farmer</TabsTrigger>
            </TabsList>
            <TabsContent value="staff" className="mt-4"><StaffLogin /></TabsContent>
            <TabsContent value="superadmin" className="mt-4"><StaffLogin defaultRole="super_admin" /></TabsContent>
            <TabsContent value="developer" className="mt-4"><StaffLogin defaultRole="developer" /></TabsContent>
            <TabsContent value="farmer" className="mt-4"><FarmerLogin /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ApiAuth() {
  return (
    <LaravelAuthProvider>
      <AuthInner />
    </LaravelAuthProvider>
  );
}
