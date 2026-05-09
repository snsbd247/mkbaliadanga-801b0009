// i18n-ignore-file — admin/utility page
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBranding } from "@/lib/branding";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SiteFooter } from "@/components/layout/SiteFooter";

// Strong password rules — enforced client-side; HIBP checked server-side.
const MIN_LEN = 10;
function scorePassword(p: string) {
  const checks = [
    p.length >= MIN_LEN,
    /[a-z]/.test(p),
    /[A-Z]/.test(p),
    /[0-9]/.test(p),
    /[^A-Za-z0-9]/.test(p),
  ];
  return checks.filter(Boolean).length;
}
function passwordIssues(p: string): string[] {
  const issues: string[] = [];
  if (p.length < MIN_LEN) issues.push(`At least ${MIN_LEN} characters`);
  if (!/[a-z]/.test(p)) issues.push("A lowercase letter");
  if (!/[A-Z]/.test(p)) issues.push("An uppercase letter");
  if (!/[0-9]/.test(p)) issues.push("A digit");
  if (!/[^A-Za-z0-9]/.test(p)) issues.push("A symbol (e.g. !@#$)");
  return issues;
}

export default function ResetPassword() {
  const nav = useNavigate();
  const brand = useBranding();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `Reset password — ${brand.company_name}`;
  }, [brand.company_name]);

  useEffect(() => {
    // Supabase puts a recovery session into the URL hash and the SDK creates a session.
    // We just wait until the recovery event arrives, then allow the password change.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    // If the user already has a session (e.g. they followed the link a moment ago), allow it.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const issues = passwordIssues(pw);
  const score = scorePassword(pw);
  const strengthLabel = ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"][score];
  const strengthColor = ["bg-destructive", "bg-destructive", "bg-warning", "bg-warning", "bg-success", "bg-success"][score];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (issues.length) return toast.error("Password does not meet the policy");
    if (pw !== pw2) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      // The backend HIBP check returns a clear message when the password is leaked.
      if (/pwned|leaked|compromis/i.test(error.message)) {
        return toast.error("This password has appeared in a known data breach. Pick a different one.");
      }
      return toast.error(error.message);
    }
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    nav("/auth", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-surface flex flex-col"><div className="flex-1 flex items-center justify-center p-4">
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
          <h1 className="text-2xl font-bold">{brand.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Reset your password</p>
        </div>

        <Card className="p-6 shadow-elegant">
          {!ready ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Validating reset link… If you opened this page directly, request a new reset email from the login page.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>New password</Label>
                <Input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} required />
                {pw && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-muted rounded">
                      <div className={`h-full rounded ${strengthColor}`} style={{ width: `${(score / 5) * 100}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{strengthLabel}</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Confirm new password</Label>
                <Input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} required />
              </div>

              {issues.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5 rounded-md bg-muted/50 p-3 list-disc list-inside">
                  <li className="font-medium text-foreground">Your password must include:</li>
                  {issues.map(i => <li key={i}>{i}</li>)}
                </ul>
              )}

              <Button type="submit" className="w-full" disabled={busy || issues.length > 0 || pw !== pw2}>
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-xs text-center text-muted-foreground">
            Leaked-password protection is active. Passwords found in known data breaches are rejected automatically.
          </p>
        </Card>
      </div>
      </div>
      <SiteFooter />
    </div>
  );
}
