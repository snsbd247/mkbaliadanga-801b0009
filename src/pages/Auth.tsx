import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout, Mail, AlertCircle, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { isLaravelBackend } from "@/lib/backend";
import { api, ApiError, setApiToken } from "@/lib/api/client";
import { useLang } from "@/i18n/LanguageProvider";
import { useBranding } from "@/lib/branding";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SiteFooter } from "@/components/layout/SiteFooter";

type StepStatus = "idle" | "running" | "ok" | "fail";
interface DebugInfo {
  lookup: StepStatus;
  password: StepStatus;
  redirect: StepStatus;
  resolvedEmail?: string;
  errorCode?: string;
  errorMessage?: string;
  errorStatus?: number | string;
  hint?: string;
}

const initialDebug: DebugInfo = { lookup: "idle", password: "idle", redirect: "idle" };

export default function AuthPage() {
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const { t, lang, setLang } = useLang();
  const brand = useBranding();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotInput, setForgotInput] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [debug, setDebug] = useState<DebugInfo>(initialDebug);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => { document.title = `${t("login")} — ${brand.company_name}`; }, [t, brand.company_name]);
  useEffect(() => { if (user) nav("/admin", { replace: true }); }, [user, nav]);

  const handleCapsLockCheck = (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) => {
    const ev = e as any;
    if (typeof ev.getModifierState === "function") setCapsOn(!!ev.getModifierState("CapsLock"));
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    const uErr = !u ? (lang === "bn" ? "ইউজারনেম দিন" : "Enter your username") : null;
    const pErr = !password ? (lang === "bn" ? "পাসওয়ার্ড দিন" : "Enter your password") : null;
    setUsernameError(uErr);
    setPasswordError(pErr);
    if (uErr || pErr) {
      setDebug({ ...initialDebug, hint: "Both username and password are required." });
      return toast.error(t("usernameAndPasswordRequired"));
    }
    setBusy(true);
    const d: DebugInfo = { lookup: "running", password: "idle", redirect: "idle" };
    setDebug(d);

    // ── Laravel backend (VPS): username/email + password → /auth/login ──
    if (isLaravelBackend) {
      try {
        const { data } = await api.post("/auth/login", { identifier: u, password });
        const token = data.token ?? data.access_token;
        if (!token) throw new Error("No token returned");
        setApiToken(token);
        setDebug({ ...d, lookup: "ok", password: "ok", redirect: "running", resolvedEmail: data.user?.email });
        toast.success(t("welcomeBack"));
        await refresh();
        nav("/admin", { replace: true });
        setTimeout(() => {
          if (window.location.pathname === "/auth") window.location.replace("/admin");
        }, 1200);
      } catch (err: any) {
        const apiError = err instanceof ApiError ? err : new ApiError(err?.message || "Login failed");
        const msg = apiError.message || "Login failed";
        const invalidCreds =
          apiError.status === 401 ||
          apiError.status === 422 ||
          /ভুল ইউজারনেম বা পাসওয়ার্ড|invalid credentials|incorrect password/i.test(msg);

        setPasswordError(invalidCreds ? (lang === "bn" ? "পাসওয়ার্ড সঠিক নয়" : "Incorrect password") : null);
        setDebug({
          ...d,
          password: "fail",
          errorStatus: apiError.status,
          errorMessage: msg,
          hint: invalidCreds
            ? "Laravel /auth/login rejected the credentials."
            : "Laravel login returned a server-side error. Use the exact backend message above.",
        });
        toast.error(msg);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Step 1: resolve username -> email (or accept email directly)
    let email = u;
    if (!/@/.test(u)) {
      const { data, error } = await db.rpc("email_for_username", { _username: u });
      if (error) {
        setBusy(false);
        setDebug({
          ...d, lookup: "fail",
          errorCode: error.code, errorMessage: error.message,
          hint: "Username lookup failed at the backend (RPC error). Check that the RPC is callable.",
        });
        return toast.error(t("usernameLookupFailed"));
      }
      if (!data) {
        setBusy(false);
        const msg = lang === "bn"
          ? `"${u}" নামে কোন একাউন্ট নেই। বানান চেক করুন বা ইমেইল দিয়ে চেষ্টা করুন।`
          : `No account found for username "${u}". Check spelling or try email instead.`;
        setUsernameError(lang === "bn" ? "ইউজারনেম পাওয়া যায়নি" : "Username not found");
        setDebug({
          ...d, lookup: "fail",
          errorMessage: msg,
          hint: "The username does not exist. Check spelling, or use email instead.",
        });
        return toast.error(msg);
      }
      email = data as string;
    }

    d.lookup = "ok";
    d.resolvedEmail = email;
    d.password = "running";
    setDebug({ ...d });

    // Step 2: password sign-in
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      const status = (error as any).status;
      const isInvalid = /invalid login|invalid_credentials/i.test(error.message);
      const isUnconfirmed = /email not confirmed/i.test(error.message);
      const friendly = isInvalid
        ? (lang === "bn" ? "পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন বা 'পাসওয়ার্ড ভুলে গেছেন' ব্যবহার করুন।" : "Password is incorrect. Try again or use ‘Forgot password’.")
        : isUnconfirmed
        ? (lang === "bn" ? "ইমেইল এখনও যাচাই হয়নি।" : "Email is not confirmed yet.")
        : error.message;
      if (isInvalid) setPasswordError(lang === "bn" ? "পাসওয়ার্ড সঠিক নয়" : "Incorrect password");
      setDebug({
        ...d, password: "fail",
        errorCode: (error as any).code ?? "auth_error",
        errorStatus: status,
        errorMessage: friendly,
        hint:
          isInvalid
            ? "The password is wrong for this account, or the user is disabled."
            : isUnconfirmed
            ? "The email address has not been confirmed yet."
            : "See backend message above.",
      });
      return toast.error(friendly);
    }

    d.password = "ok";
    d.redirect = "running";
    setDebug({ ...d });
    toast.success(t("welcomeBack"));

    // Step 3: redirect — try immediately, then a fallback hard-redirect on timeout
    nav("/admin", { replace: true });
    setTimeout(() => {
      // If we are still on /auth after 1.2s, force redirect.
      if (window.location.pathname === "/auth") {
        window.location.replace("/admin");
      } else {
        setDebug(prev => ({ ...prev, redirect: "ok" }));
      }
    }, 1200);
    setBusy(false);
  };

  async function sendReset() {
    const v = forgotInput.trim();
    if (!v) return toast.error(t("usernameOrEmail"));
    setForgotBusy(true);
    let email = v;
    // If it doesn't look like an email, treat it as a username and resolve.
    if (!/@/.test(v)) {
      const { data, error } = await db.rpc("email_for_username", { _username: v });
      if (error || !data) {
        setForgotBusy(false);
        // Show a generic success message either way to avoid account enumeration.
        toast.success(t("ifAccountExistsResetSent"));
        setForgotOpen(false);
        return;
      }
      email = data as string;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
        toast.success(t("ifAccountExistsResetSent"));
      setForgotOpen(false);
      setForgotInput("");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-surface flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-2">
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
          <h1 className="text-2xl font-bold">{lang === "bn" && brand.company_name_bn ? brand.company_name_bn : brand.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("cooperativeMgmtSystem")}</p>
        </div>

        <Card className="p-6 shadow-elegant">
          <h2 className="text-lg font-semibold mb-1">{t("login")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("signInDesc")}</p>
          <form onSubmit={signIn} className="space-y-3">
            <div>
              <Label htmlFor="login-username">{t("username")}</Label>
              <Input
                id="login-username"
                name="username"
                required
                autoComplete="username"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={e => { setUsername(e.target.value); if (usernameError) setUsernameError(null); }}
                placeholder={t("username")}
                aria-invalid={!!usernameError}
                aria-describedby={usernameError ? "login-username-err" : undefined}
              />
              {usernameError && <p id="login-username-err" className="text-xs text-destructive mt-1">{usernameError}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">{t("password")}</Label>
                <button type="button" onClick={() => { setForgotInput(username); setForgotOpen(true); }} className="text-xs text-primary hover:underline">
                  {t("forgotPassword")}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  name="current-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }}
                  onKeyUp={handleCapsLockCheck}
                  onKeyDown={handleCapsLockCheck}
                  onBlur={() => setCapsOn(false)}
                  placeholder={t("password")}
                  className="pr-10"
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "login-password-err" : (capsOn ? "login-password-caps" : undefined)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? (lang === "bn" ? "পাসওয়ার্ড লুকান" : "Hide password") : (lang === "bn" ? "পাসওয়ার্ড দেখান" : "Show password")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && <p id="login-password-err" className="text-xs text-destructive mt-1">{passwordError}</p>}
              {capsOn && !passwordError && (
                <p id="login-password-caps" className="text-xs text-warning-foreground mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {lang === "bn" ? "Caps Lock চালু আছে" : "Caps Lock is on"}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : t("login")}</Button>
          </form>

          {debug.errorMessage && (
            <div className="mt-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("loginFailed")}</AlertTitle>
                <AlertDescription>
                  <div className="text-sm">{debug.errorMessage}</div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <Alert className="mt-4">
            <Mail className="h-4 w-4" />
            <AlertTitle>{lang === "bn" ? "অ্যাডমিন লগইন তথ্য" : "Admin login details"}</AlertTitle>
            <AlertDescription>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  {lang === "bn"
                    ? "ইউজারনেম অথবা ইমেইল দিয়ে লগইন করুন। @ ছাড়া দিলে এটি ইউজারনেম হিসেবে ধরা হবে; সমস্যা হলে পুরো ইমেইল দিয়ে চেষ্টা করুন।"
                    : "Log in with your username or email. Input without @ is treated as a username; if it fails, try the full email."}
                </p>
                <p>
                  {lang === "bn"
                    ? "ডিপ্লয়মেন্টের পর অ্যাডমিন ইমেইল ও পাসওয়ার্ড সার্ভারের deploy/.env.production ফাইলের ADMIN_EMAIL এবং ADMIN_PASSWORD এ পাওয়া যাবে।"
                    : "After deployment, the admin email and password are in the server's deploy/.env.production file under ADMIN_EMAIL and ADMIN_PASSWORD."}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </Card>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />{t("resetYourPassword")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("resetEmailDesc")}</p>
            <div>
              <Label>{t("usernameOrEmail")}</Label>
              <Input value={forgotInput} onChange={e => setForgotInput(e.target.value)} placeholder={t("usernameOrEmailPh")} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)} disabled={forgotBusy}>{t("cancel")}</Button>
            <Button onClick={sendReset} disabled={forgotBusy}>{forgotBusy ? t("sendingDots") : t("sendResetLink")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      <SiteFooter />
    </div>
  );
}

function StepRow({ label, status, extra }: { label: string; status: StepStatus; extra?: string }) {
  const Icon = status === "ok" ? CheckCircle2 : status === "fail" ? XCircle : status === "running" ? Loader2 : AlertCircle;
  const color =
    status === "ok" ? "text-green-600" :
    status === "fail" ? "text-destructive" :
    status === "running" ? "text-primary" :
    "text-muted-foreground";
  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-3.5 w-3.5 mt-0.5 ${color} ${status === "running" ? "animate-spin" : ""}`} />
      <div className="flex-1">
        <div className={color}>{label}</div>
        {extra && <div className="text-[10px] font-mono text-muted-foreground break-all">{extra}</div>}
      </div>
    </div>
  );
}
