import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout, Mail, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { useBranding } from "@/lib/branding";

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
  const { user } = useAuth();
  const { t, lang, setLang } = useLang();
  const brand = useBranding();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotInput, setForgotInput] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [debug, setDebug] = useState<DebugInfo>(initialDebug);

  useEffect(() => { document.title = `${t("login")} — ${brand.company_name}`; }, [t, brand.company_name]);
  useEffect(() => { if (user) nav("/", { replace: true }); }, [user, nav]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) {
      setDebug({ ...initialDebug, hint: "Both username and password are required." });
      return toast.error("Username and password required");
    }
    setBusy(true);
    const d: DebugInfo = { lookup: "running", password: "idle", redirect: "idle" };
    setDebug(d);

    // Step 1: resolve username -> email (or accept email directly)
    let email = u;
    if (!/@/.test(u)) {
      const { data, error } = await supabase.rpc("email_for_username", { _username: u });
      if (error) {
        setBusy(false);
        setDebug({
          ...d, lookup: "fail",
          errorCode: error.code, errorMessage: error.message,
          hint: "Username lookup failed at the backend (RPC error). Check that the RPC is callable.",
        });
        return toast.error("Username lookup failed");
      }
      if (!data) {
        setBusy(false);
        setDebug({
          ...d, lookup: "fail",
          errorMessage: `No account found for username "${u}"`,
          hint: "The username does not exist. Check spelling, or use email instead.",
        });
        return toast.error(`No account found for "${u}"`);
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
      setDebug({
        ...d, password: "fail",
        errorCode: (error as any).code ?? "auth_error",
        errorStatus: status,
        errorMessage: error.message,
        hint:
          /invalid login/i.test(error.message)
            ? "The password is wrong for this account, or the user is disabled."
            : /email not confirmed/i.test(error.message)
            ? "The email address has not been confirmed yet."
            : "See backend message above.",
      });
      return toast.error(error.message || "Invalid password");
    }

    d.password = "ok";
    d.redirect = "running";
    setDebug({ ...d });
    toast.success(t("welcomeBack"));

    // Step 3: redirect — try immediately, then a fallback hard-redirect on timeout
    nav("/", { replace: true });
    setTimeout(() => {
      // If we are still on /auth after 1.2s, force redirect.
      if (window.location.pathname === "/auth") {
        window.location.replace("/");
      } else {
        setDebug(prev => ({ ...prev, redirect: "ok" }));
      }
    }, 1200);
    setBusy(false);
  };

  async function sendReset() {
    const v = forgotInput.trim();
    if (!v) return toast.error("Enter your username or email");
    setForgotBusy(true);
    let email = v;
    // If it doesn't look like an email, treat it as a username and resolve.
    if (!/@/.test(v)) {
      const { data, error } = await supabase.rpc("email_for_username", { _username: v });
      if (error || !data) {
        setForgotBusy(false);
        // Show a generic success message either way to avoid account enumeration.
        toast.success("If an account exists, a reset link has been sent.");
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
      toast.success("If an account exists, a reset link has been sent.");
      setForgotOpen(false);
      setForgotInput("");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-surface p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.company_name} className="mx-auto mb-3 h-14 w-14 rounded-xl object-cover shadow-elegant" />
          ) : (
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <Sprout className="h-7 w-7" />
            </div>
          )}
          <h1 className="text-2xl font-bold">{lang === "bn" && brand.company_name_bn ? brand.company_name_bn : brand.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Cooperative Management System</p>
          <button onClick={() => setLang(lang === "en" ? "bn" : "en")} className="mt-2 text-xs text-primary underline">
            {lang === "en" ? "বাংলা" : "English"}
          </button>
        </div>

        <Card className="p-6 shadow-elegant">
          <h2 className="text-lg font-semibold mb-1">{t("login")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("signInDesc")}</p>
          <form onSubmit={signIn} className="space-y-3">
            <div>
              <Label>Username</Label>
              <Input
                required
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>{t("password")}</Label>
                <button type="button" onClick={() => { setForgotInput(username); setForgotOpen(true); }} className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : t("login")}</Button>
          </form>

          {(debug.lookup !== "idle" || debug.errorMessage) && (
            <div className="mt-4 space-y-2">
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
                <div className="font-semibold text-sm mb-1">Sign-in diagnostics</div>
                <StepRow label="1. Resolve username → email" status={debug.lookup} extra={debug.resolvedEmail} />
                <StepRow label="2. Verify password" status={debug.password} />
                <StepRow label="3. Redirect to dashboard" status={debug.redirect} />
              </div>
              {debug.errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    Login failed
                    {debug.errorCode ? ` · ${debug.errorCode}` : ""}
                    {debug.errorStatus ? ` · HTTP ${debug.errorStatus}` : ""}
                  </AlertTitle>
                  <AlertDescription className="space-y-1">
                    <div className="font-mono text-xs break-words">{debug.errorMessage}</div>
                    {debug.hint && <div className="text-xs opacity-90">{debug.hint}</div>}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Reset your password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter your username or email. If we find a matching account, we'll send you a reset link.</p>
            <div>
              <Label>Username or email</Label>
              <Input value={forgotInput} onChange={e => setForgotInput(e.target.value)} placeholder="superadmin or you@example.com" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)} disabled={forgotBusy}>Cancel</Button>
            <Button onClick={sendReset} disabled={forgotBusy}>{forgotBusy ? "Sending…" : "Send reset link"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
