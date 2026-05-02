import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

/**
 * Shows a localized warning when an assignable user (admin/staff/committee)
 * has no office assignment, since office-scoped data will be empty.
 * Hidden for super_admins (who see everything) and while roles are still loading.
 */
export function NoOfficeBanner({ className = "" }: { className?: string }) {
  const { rolesLoaded, officeId, isSuper, isAdmin, roles } = useAuth();
  const { t } = useLang();
  if (!rolesLoaded || isSuper) return null;
  const isAssignableRole = isAdmin || roles.includes("staff") || roles.includes("committee");
  if (!isAssignableRole || officeId) return null;
  return (
    <Alert className={`mb-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription>{t("noOfficeAssigned")}</AlertDescription>
    </Alert>
  );
}
