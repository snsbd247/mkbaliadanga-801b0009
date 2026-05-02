import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout, HelpCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { useBranding } from "@/lib/branding";

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

  useEffect(() => { document.title = `${t("login")} — ${brand.company_name}`; }, [t, brand.company_name]);
  useEffect(() => { if (user) nav("/", { replace: true }); }, [user, nav]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) return toast.error("Username and password required");
    setBusy(true);
    const { data: emailData, error: lookupErr } = await supabase.rpc("email_for_username", { _username: u });
    if (lookupErr || !emailData) {
      setBusy(false);
      return toast.error("Invalid username or password");
    }
    const { error } = await supabase.auth.signInWithPassword({ email: emailData as string, password });
    setBusy(false);
    if (error) toast.error("Invalid username or password");
    else { toast.success(t("welcomeBack")); nav("/", { replace: true }); }
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
        </Card>

        {/* Troubleshooting panel */}
        <Card className="mt-4 p-4">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Trouble signing in?</h3>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="wrong-credentials">
              <AccordionTrigger className="text-sm">"Invalid username or password"</AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <p>Usernames are case-insensitive but must match exactly (no spaces). Re-type your password — caps lock and Bangla keyboards are common causes.</p>
                <p>If you still cannot sign in, use <button onClick={() => { setForgotInput(username); setForgotOpen(true); }} className="text-primary underline">Forgot password</button> to receive a reset email.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="wrong-role">
              <AccordionTrigger className="text-sm">Logged in but pages are empty / "Access denied"</AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground">
                Your account exists but is missing the role required for that page (Admin, Committee, or Super Admin). Ask your Super Admin to assign the right role under Users → Roles.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="blocked">
              <AccordionTrigger className="text-sm">"Account blocked" or repeated failures</AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground">
                Too many wrong attempts can temporarily lock you out. Wait 5–10 minutes, then try again. If your account was disabled by an admin, contact your Super Admin.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="reset-pending">
              <AccordionTrigger className="text-sm">Password reset email not arriving</AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1">
                <p>Reset links can take 1–2 minutes. Check your spam / promotions folder. The link expires in 1 hour — request a new one if needed.</p>
                <p>Make sure the email on your profile is correct; if it isn't, only your Super Admin can change it.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="leaked-password">
              <AccordionTrigger className="text-sm">"Password is in a known breach"</AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground">
                Leaked-password protection is enabled. The password you tried to set has appeared in a public data breach — pick a different one with at least 10 characters, mixed case, a digit and a symbol.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
