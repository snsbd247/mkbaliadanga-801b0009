import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { useLang } from "@/i18n/LanguageProvider";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLang();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-muted">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">{t("pageNotFound")}</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            {t("returnToHome")}
          </a>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default NotFound;
