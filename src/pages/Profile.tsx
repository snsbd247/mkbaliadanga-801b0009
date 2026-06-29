import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, User as UserIcon, KeyRound, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { passwordIssues } from "@/lib/passwordPolicy";

const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Full name must be at most 120 characters")
    .regex(/^[\p{L}\p{M}.\-' ]+$/u, "Only letters, spaces, dots, hyphens and apostrophes"),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_.-]{3,30}$/, "3–30 chars; letters, digits, dot, underscore, hyphen"),
});

async function logAudit(user_id: string, action: string, meta: Record<string, any> = {}) {
  try {
    await db.from("audit_logs").insert({
      user_id,
      action,
      entity: "profile",
      entity_id: user_id,
      meta,
    });
  } catch {
    /* non-fatal */
  }
}

export default function Profile() {
  const { user, signOut, refresh } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [email, setEmail] = useState("");

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!user) return;
      const { data, error } = await db
        .from("profiles")
        .select("full_name, username, email")
        .eq("id", user.id)
        .maybeSingle();
      if (cancel) return;
      if (error) toast.error(error.message);
      setFullName(data?.full_name ?? "");
      setUsername(data?.username ?? "");
      const e = data?.email ?? user.email ?? "";
      setEmail(e);
      setOriginalEmail(e);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    const parsed = profileSchema.safeParse({ full_name: fullName, username });
    if (!parsed.success) {
      const first = parsed.error.errors[0]?.message;
      return toast.error(first ?? t("prof_validationFailed" as any));
    }
    setSaving(true);
    const { data: dup } = await db
      .from("profiles")
      .select("id")
      .eq("username", parsed.data.username)
      .neq("id", user.id)
      .maybeSingle();
    if (dup) {
      setSaving(false);
      return toast.error(t("prof_usernameTaken" as any));
    }
    const { error } = await db
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        username: parsed.data.username,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(user.id, "profile.update", { full_name: parsed.data.full_name, username: parsed.data.username });
    toast.success(t("prof_updated" as any));
    refresh();
  };

  const changeEmail = async () => {
    if (!user) return;
    const emailParsed = z.string().trim().email().max(255).safeParse(email);
    if (!emailParsed.success) return toast.error(t("prof_invalidEmail" as any));
    if (emailParsed.data === originalEmail) return toast.info(t("prof_emailUnchanged" as any));

    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser(
      { email: emailParsed.data },
      { emailRedirectTo: `${window.location.origin}/` }
    );
    setEmailSaving(false);
    if (error) return toast.error(error.message);
    await logAudit(user.id, "profile.email_change_requested", { from: originalEmail, to: emailParsed.data });
    toast.success(t("prof_verificationSent" as any), { duration: 8000 });
  };

  const changePassword = async () => {
    if (!user) return;
    const issues = passwordIssues(pw, 10);
    if (issues.length) return toast.error(issues.join(" • "));
    if (pw !== pw2) return toast.error(t("prof_passwordsMismatch" as any));

    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setPwSaving(false);
      return toast.error(error.message);
    }
    await logAudit(user.id, "profile.password_changed", { at: new Date().toISOString() });
    toast.success(t("prof_passwordChanged" as any), { duration: 5000 });
    setPw(""); setPw2("");
    setTimeout(async () => {
      await signOut();
      navigate("/auth", { replace: true });
    }, 1500);
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5" /> {t("prof_yourProfile" as any)}</CardTitle>
          <CardDescription>{t("prof_updateInfo" as any)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{t("prof_fullName" as any)}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
            <p className="text-xs text-muted-foreground">{t("prof_fullNameHint" as any)}</p>
          </div>
          <div className="grid gap-2">
            <Label>{t("prof_username" as any)}</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} />
            <p className="text-xs text-muted-foreground">{t("prof_usernameHint" as any)}</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("prof_saveChanges" as any)}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> {t("prof_emailAddress" as any)}</CardTitle>
          <CardDescription>{t("prof_emailDesc" as any)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{t("prof_email" as any)}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>{t("prof_verificationRequired" as any)}</AlertTitle>
            <AlertDescription className="text-xs">
              {t("prof_verificationDesc" as any)}
            </AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <Button onClick={changeEmail} disabled={emailSaving || email === originalEmail}>
              {emailSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("prof_sendVerification" as any)}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> {t("prof_changePassword" as any)}</CardTitle>
          <CardDescription>{t("prof_changePasswordDesc" as any)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{t("prof_newPassword" as any)}</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            <PasswordStrength value={pw} minLen={10} />
          </div>
          <div className="grid gap-2">
            <Label>{t("prof_confirmNewPassword" as any)}</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            {pw2 && pw !== pw2 && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {t("prof_passwordsMismatch" as any)}</p>
            )}
          </div>
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {t("prof_passwordSignoutNotice" as any)}
            </AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={pwSaving || !pw || !pw2}>
              {pwSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("prof_updatePassword" as any)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
