import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, CalendarDays, Wallet,
  HandCoins, Droplets, Receipt, FileBarChart, ShieldCheck, ScrollText, Sprout,
  ScanLine, Settings as SettingsIcon, BookOpen, FileText, AlertTriangle, Database,
  BookText, Calculator, TrendingUp, ClipboardCheck, BookKey, ShieldAlert, Lock, PieChart, Smartphone,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useBranding } from "@/lib/branding";
import { usePermissions } from "@/lib/permissions";

type Item = { url: string; icon: any; label: string; permKey?: string; superOnly?: boolean };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { t, lang } = useLang();
  const { isSuper } = useAuth();
  const brand = useBranding();
  const { can } = usePermissions();

  const groups: { label: string; items: Item[] }[] = [
    {
      label: "Main",
      items: [
        { url: "/", icon: LayoutDashboard, label: t("dashboard"), permKey: "dashboard" },
      ],
    },
    {
      label: "Operations",
      items: [
        { url: "/farmers", icon: Users, label: t("farmers"), permKey: "farmers" },
        { url: "/seasons", icon: CalendarDays, label: t("seasons"), permKey: "seasons" },
        { url: "/savings", icon: Wallet, label: t("savings"), permKey: "savings" },
        { url: "/loans", icon: HandCoins, label: t("loans"), permKey: "loans" },
        { url: "/irrigation", icon: Droplets, label: t("irrigation"), permKey: "irrigation" },
        { url: "/statement", icon: FileText, label: (t as any)("statement") || "Statement", permKey: "savings" },
      ],
    },
    {
      label: "Cash & Payments",
      items: [
        { url: "/payments", icon: Receipt, label: t("payments"), permKey: "payments" },
        { url: "/scan", icon: ScanLine, label: t("scanQr"), permKey: "payments" },
        { url: "/cashbook", icon: BookOpen, label: t("cashbook"), permKey: "reports" },
        { url: "/approvals", icon: ClipboardCheck, label: "Approvals", permKey: "payments" },
      ],
    },
    {
      label: "Accounting",
      items: [
        { url: "/finance-summary", icon: PieChart, label: "Finance Summary", permKey: "reports" },
        { url: "/accounts", icon: BookText, label: "Chart of Accounts", permKey: "reports" },
        { url: "/ledger", icon: Calculator, label: "General Ledger", permKey: "reports" },
        { url: "/journal-entry", icon: BookKey, label: "Journal Entry", permKey: "reports" },
        { url: "/financial-reports", icon: TrendingUp, label: "Financial Reports", permKey: "reports" },
        { url: "/period-close", icon: Lock, label: "Period Close", permKey: "reports" },
        { url: "/ledger-integrity", icon: ShieldAlert, label: "Ledger Integrity", permKey: "reports" },
      ],
    },
    {
      label: "Reports",
      items: [
        { url: "/reports", icon: FileBarChart, label: t("reports"), permKey: "reports" },
        { url: "/dues", icon: AlertTriangle, label: "Dues", permKey: "reports" },
      ],
    },
    {
      label: "Admin",
      items: [
        { url: "/offices", icon: Building2, label: t("offices"), permKey: "offices" },
        { url: "/users", icon: ShieldCheck, label: t("users"), superOnly: true },
        { url: "/settings", icon: SettingsIcon, label: t("settings"), superOnly: true },
        { url: "/backup", icon: Database, label: "Backup", superOnly: true },
        { url: "/audit", icon: ScrollText, label: t("auditLogs"), superOnly: true },
        { url: "/mobile-qa", icon: Smartphone, label: "Mobile QA", superOnly: true },
      ],
    },
  ];

  const filterItems = (items: Item[]) =>
    items.filter((i) => {
      if (i.superOnly) return isSuper;
      if (i.permKey) return can(i.permKey as any, "can_view");
      return true;
    });

  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.company_name} className="h-9 w-9 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Sprout className="h-5 w-5" />
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-bold text-sidebar-foreground leading-tight">
                {lang === "bn" && brand.company_name_bn ? brand.company_name_bn : brand.company_name}
              </span>
              <span className="text-[10px] text-sidebar-foreground/70 leading-tight">{t("appNameShort")}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => {
          const items = filterItems(g.items);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{collapsed ? "" : g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.label}>
                        <NavLink to={item.url} end={item.url === "/"}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
