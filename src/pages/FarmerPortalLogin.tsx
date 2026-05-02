import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout, Loader2, ShieldCheck, ArrowLeft, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBranding } from "@/lib/branding";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Step = "id" | "otp";

export default function FarmerPortalLogin() {
  const nav = useNavigate();
  const brand = useBranding();
  const { user, isSuper, isAdmin, isCommittee, rolesLoaded, roles } = useAuth();
  const [step, setStep] = useState<Step>("id");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedMobile, setMaskedMobile] = useState<string | null>(null);

  // If an admin/staff user is signed in, send them to the admin dashboard, not the farmer portal.
  useEffect(() => {
    if (!rolesLoaded || !user) return;
    if (isSuper || isAdmin || isCommittee || roles.includes("staff")) {
      nav("/admin", { replace: true });
    }
  }, [user, rolesLoaded, isSuper, isAdmin, isCommittee, roles, nav]);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = identifier.trim();
    if (!id || id.length < 3) { setError("Please enter your Farmer ID or Member No."); return; }
    setBusy(true);
    try {
      const res = await fetch(`${FN_BASE}/farmer-request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ identifier: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not send code. Try again.");
        return;
      }
      setMaskedMobile(data?.mobile_masked ?? null);
      setStep("otp");
      toast.success(data?.mobile_masked ? `Code sent to ${data.mobile_masked}` : "If your ID is valid, a code has been sent.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otp)) { setError("Enter the 6-digit code."); return; }
    setBusy(true);
    try {
      const res = await fetch(`${FN_BASE}/farmer-verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ identifier: identifier.trim(), otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        setError(data?.error || "Invalid or expired code.");
        return;
      }
      localStorage.setItem("farmer_portal_token", data.token);
      localStorage.setItem("farmer_portal_expires", data.expires_at ?? "");
      localStorage.setItem("farmer_portal_name", data.farmer?.name ?? "");
      toast.success("Verified");
      nav("/farmer/dashboard", { replace: true });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-2">
          <a href="/auth" className="text-xs text-primary underline">Admin Login →</a>
          <LanguageToggle />
        </div>
        <div className="mb-6 text-center">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.company_name} className="mx-auto mb-3 h-14 w-14 rounded-xl object-cover shadow-elegant" />
          ) : (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <Sprout className="h-7 w-7" />
            </div>
          )}
          <h1 className="text-2xl font-bold">{brand.company_name_bn || brand.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Farmer Self-Service Portal</p>
        </div>

        <Card className="p-6 shadow-elegant">
          {step === "id" ? (
            <>
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Sign in with OTP
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your Farmer ID or Member Number. We'll send a 6-digit code to your registered mobile.
              </p>
              <form onSubmit={requestOtp} className="space-y-3">
                <div>
                  <Label htmlFor="fid">Farmer ID / Member No.</Label>
                  <Input
                    id="fid"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. 2026-00000123 or M-000123"
                    autoComplete="off"
                    autoFocus
                    disabled={busy}
                  />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Smartphone className="h-4 w-4" />Send OTP</>}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Enter verification code
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {maskedMobile
                  ? <>A 6-digit code was sent to <span className="font-medium">{maskedMobile}</span>. Valid for 5 minutes.</>
                  : <>If your ID is valid, a 6-digit code was sent to your registered mobile.</>}
              </p>
              <form onSubmit={verifyOtp} className="space-y-3">
                <div>
                  <Label htmlFor="otp">6-digit OTP</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    autoFocus
                    disabled={busy}
                  />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Verifying…</> : "Verify & Continue"}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    onClick={() => { setStep("id"); setOtp(""); setError(null); }} disabled={busy}>
                    <ArrowLeft className="h-3 w-3" /> Change ID
                  </button>
                  <button type="button" className="text-primary hover:underline"
                    onClick={(e) => requestOtp(e as any)} disabled={busy}>
                    Resend OTP
                  </button>
                </div>
              </form>
            </>
          )}
        </Card>

        <div className="mt-6 text-center">
          <Button variant="outline" size="sm" onClick={() => nav("/auth")}>
            Admin Login →
          </Button>
        </div>
      </div>
    </div>
  );
}
