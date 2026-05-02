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
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Step = "id" | "otp";

export default function FarmerPortalLogin() {
  const nav = useNavigate();
  const brand = useBranding();
  const { t } = useLang();
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
    if (!id || id.length < 3) { setError(t("enterFarmerIdError")); return; }
    setBusy(true);
    try {
      const res = await fetch(`${FN_BASE}/farmer-request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ identifier: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || t("couldNotSendCode"));
        return;
      }
      setMaskedMobile(data?.mobile_masked ?? null);
      setStep("otp");
      toast.success(data?.mobile_masked ? t("codeSentToast").replace("{mobile}", data.mobile_masked) : t("codeSentGenericToast"));
    } catch {
      setError(t("networkErrorRetry"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otp)) { setError(t("enterSixDigitError")); return; }
    setBusy(true);
    try {
      const res = await fetch(`${FN_BASE}/farmer-verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ identifier: identifier.trim(), otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        setError(data?.error || t("invalidOrExpiredCode"));
        return;
      }
      localStorage.setItem("farmer_portal_token", data.token);
      localStorage.setItem("farmer_portal_expires", data.expires_at ?? "");
      localStorage.setItem("farmer_portal_name", data.farmer?.name ?? "");
      toast.success(t("verified"));
      nav("/farmer/dashboard", { replace: true });
    } catch {
      setError(t("networkErrorRetry"));
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
        {t("skipToMain")}
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
            <p className="text-sm text-muted-foreground mt-1">{t("farmerSelfServicePortal")}</p>
          </header>

          <Card className="p-6 shadow-elegant motion-reduce:shadow-none">
            {step === "id" ? (
              <>
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> {t("signInWithOtp")}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("farmerOtpDesc")}
                </p>
                <form onSubmit={requestOtp} className="space-y-3" aria-label={t("signInWithOtp")}>
                  <div>
                    <Label htmlFor="fid">{t("farmerIdOrMemberNo")}</Label>
                    <Input
                      id="fid"
                      ref={idInputRef}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={t("farmerIdPlaceholder")}
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
                        {t("sending")}
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4" aria-hidden="true" />
                        {t("sendOtp")}
                      </>
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> {t("enterVerificationCode")}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {maskedMobile
                    ? t("codeSentToMobile").replace("{mobile}", maskedMobile)
                    : t("codeSentIfValid")}
                </p>
                <form onSubmit={verifyOtp} className="space-y-3" aria-label={t("enterVerificationCode")}>
                  <div>
                    <Label htmlFor="otp">{t("sixDigitOtp")}</Label>
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
                        {t("verifying")}
                      </>
                    ) : (
                      t("verifyAndContinue")
                    )}
                  </Button>
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => { setStep("id"); setOtp(""); setError(null); }}
                      disabled={busy}
                      aria-label={t("changeId")}
                    >
                      <ArrowLeft className="h-3 w-3" aria-hidden="true" /> {t("changeId")}
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={(e) => requestOtp(e as any)}
                      disabled={busy}
                      aria-label={t("resendOtp")}
                    >
                      {t("resendOtp")}
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
              aria-label={t("adminLoginArrow")}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t("adminLoginArrow")}
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

