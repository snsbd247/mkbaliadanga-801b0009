import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
              <Label>{t("password")}</Label>
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
          <p className="mt-4 text-xs text-center text-muted-foreground">
            Accounts are created by your Super Admin.
          </p>
        </Card>
      </div>
    </div>
  );
}
