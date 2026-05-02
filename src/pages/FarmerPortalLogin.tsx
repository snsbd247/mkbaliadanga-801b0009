import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout, Loader2, ShieldCheck, ArrowLeft, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBranding } from "@/lib/branding";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SiteFooter } from "@/components/layout/SiteFooter";
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
  const otpInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the OTP input whenever a validation/server error appears on the OTP step.
  useEffect(() => {
    if (step === "otp" && error) {
      otpInputRef.current?.focus();
      otpInputRef.current?.select?.();
    } else if (step === "id" && error) {
      idInputRef.current?.focus();
    }
  }, [error, step]);

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
    <div className="min-h-screen bg-gradient-surface flex flex-col motion-reduce:transition-none">
      {/* Skip link – visually hidden until focused */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8 md:py-10 focus:outline-none"
        aria-labelledby="portal-title"
      >
        <div className="w-full max-w-md space-y-4 sm:space-y-5">
          <div className="flex justify-end items-center">
            <LanguageToggle />
          </div>

          <header className="text-center">
            {brand.logo_url ? (
              <img
                src={brand.logo_url}
                alt={`${brand.company_name} logo`}
                className="mx-auto mb-3 h-14 w-14 rounded-xl object-cover shadow-elegant"
              />
            ) : (
              <div
                className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant"
                aria-hidden="true"
              >
                <Sprout className="h-7 w-7" />
              </div>
            )}
            <h1 id="portal-title" className="text-2xl font-bold">
              {brand.company_name_bn || brand.company_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Farmer Self-Service Portal</p>
          </header>

          <Card className="p-6 shadow-elegant motion-reduce:shadow-none">
            {step === "id" ? (
              <>
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Sign in with OTP
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter your Farmer ID or Member Number. We'll send a 6-digit code to your registered mobile.
                </p>
                <form onSubmit={requestOtp} className="space-y-3" aria-label="Request OTP form">
                  <div>
                    <Label htmlFor="fid">Farmer ID / Member No.</Label>
                    <Input
                      id="fid"
                      ref={idInputRef}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. 2026-00000123 or M-000123"
                      autoComplete="off"
                      autoFocus
                      disabled={busy}
                      aria-required="true"
                      aria-invalid={!!error}
                      aria-describedby={error ? "portal-error" : undefined}
                    />
                  </div>
                  {error && (
                    <Alert variant="destructive" id="portal-error" role="alert" aria-live="assertive" aria-atomic="true">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    className="w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4" aria-hidden="true" />
                        Send OTP
                      </>
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Enter verification code
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {maskedMobile
                    ? <>A 6-digit code was sent to <span className="font-medium">{maskedMobile}</span>. Valid for 5 minutes.</>
                    : <>If your ID is valid, a 6-digit code was sent to your registered mobile.</>}
                </p>
                <form onSubmit={verifyOtp} className="space-y-3" aria-label="Verify OTP form">
                  <div>
                    <Label htmlFor="otp">6-digit OTP</Label>
                    <Input
                      id="otp"
                      ref={otpInputRef}
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      autoFocus
                      disabled={busy}
                      aria-required="true"
                      aria-invalid={!!error}
                      aria-describedby={error ? "portal-error" : undefined}
                    />
                  </div>
                  {error && (
                    <Alert variant="destructive" id="portal-error" role="alert" aria-live="assertive" aria-atomic="true">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="submit"
                    className="w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        Verifying…
                      </>
                    ) : (
                      "Verify & Continue"
                    )}
                  </Button>
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => { setStep("id"); setOtp(""); setError(null); }}
                      disabled={busy}
                      aria-label="Change Farmer ID and request a new code"
                    >
                      <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Change ID
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={(e) => requestOtp(e as any)}
                      disabled={busy}
                      aria-label="Resend OTP code"
                    >
                      Resend OTP
                    </button>
                  </div>
                </form>
              </>
            )}
          </Card>

          <div className="text-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => nav("/auth")}
              aria-label="Go to Admin Login page"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Admin Login →
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

