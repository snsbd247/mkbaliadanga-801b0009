import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout, Loader2, ShieldCheck, LogIn } from "lucide-react";
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

export default function FarmerPortalLogin() {
  const nav = useNavigate();
  const brand = useBranding();
  const { t } = useLang();
  const { user, isSuper, isAdmin, isCommittee, rolesLoaded, roles } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rolesLoaded || !user) return;
    if (isSuper || isAdmin || isCommittee || roles.includes("staff")) {
      nav("/admin", { replace: true });
    }
  }, [user, rolesLoaded, isSuper, isAdmin, isCommittee, roles, nav]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = identifier.trim();
    const mob = mobile.trim();
    if (!id || id.length < 3) { setError(t("enterFarmerIdError") || "Enter your farmer ID"); return; }
    if (!mob || mob.replace(/\D/g, "").length < 6) { setError(t("enterMobileError") || "Enter your mobile number"); return; }
    setBusy(true);
    try {
      const res = await fetch(`${FN_BASE}/farmer-password-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ identifier: id, password: mob }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        setError(data?.error || t("invalidCredentials") || "Invalid farmer ID or mobile number");
        idInputRef.current?.focus();
        return;
      }
      localStorage.setItem("farmer_portal_token", data.token);
      localStorage.setItem("farmer_portal_expires", data.expires_at ?? "");
      localStorage.setItem("farmer_portal_name", data.farmer?.name ?? "");
      toast.success(t("verified") || "Logged in");
      nav("/farmer/dashboard", { replace: true });
    } catch {
      setError(t("networkErrorRetry"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-surface flex flex-col motion-reduce:transition-none">
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
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> {t("login")}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t("farmerLoginDesc") || "Use your Farmer ID as username and your registered mobile number as password."}
            </p>
            <form onSubmit={login} className="space-y-3" aria-label={t("login")}>
              <div>
                <Label htmlFor="fid">{t("farmerIdOrMemberNo")}</Label>
                <Input
                  id="fid"
                  ref={idInputRef}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t("farmerIdPlaceholder")}
                  autoComplete="username"
                  autoFocus
                  disabled={busy}
                  aria-required="true"
                />
              </div>
              <div>
                <Label htmlFor="mob">{t("mobile") || "Mobile number"}</Label>
                <Input
                  id="mob"
                  type="password"
                  inputMode="numeric"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  autoComplete="current-password"
                  disabled={busy}
                  aria-required="true"
                />
              </div>
              {error && (
                <Alert variant="destructive" id="portal-error" role="alert" aria-live="assertive" aria-atomic="true">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={busy} aria-busy={busy}>
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("sending")}</>
                ) : (
                  <><LogIn className="h-4 w-4" aria-hidden="true" /> {t("login")}</>
                )}
              </Button>
            </form>
          </Card>

          <div className="text-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => nav("/auth")}
              aria-label={t("adminLoginArrow")}
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
