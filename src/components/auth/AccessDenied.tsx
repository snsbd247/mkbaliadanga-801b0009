import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";

export function AccessDenied({ detail }: { detail?: string }) {
  const { lang } = useLang();
  const title = lang === "bn" ? "অ্যাক্সেস নেই" : "Access Denied";
  const msg = lang === "bn"
    ? "এই পেজটি দেখার অনুমতি আপনার নেই। প্রয়োজন হলে অ্যাডমিনের সাথে যোগাযোগ করুন।"
    : "You don't have permission to view this page. Please contact your administrator if you need access.";
  const back = lang === "bn" ? "ড্যাশবোর্ডে ফিরুন" : "Back to Dashboard";
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-lg border bg-card p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-semibold mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground mb-2">{msg}</p>
        {detail && <p className="text-xs text-muted-foreground/80 mb-4">{detail}</p>}
        <Button asChild size="sm" className="mt-2">
          <Link to="/admin">{back}</Link>
        </Button>
      </div>
    </div>
  );
}
