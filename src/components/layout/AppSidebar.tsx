import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, Building2, Users, CalendarDays, Wallet,
  HandCoins, Droplets, Receipt, FileBarChart, ShieldCheck, ScrollText, Sprout,
  ScanLine, Settings as SettingsIcon, BookOpen, FileText, AlertTriangle, Database,
  BookText, Calculator, TrendingUp, ClipboardCheck, BookKey, ShieldAlert, Lock, PieChart, MessageSquare, MessagesSquare, MapPin,
  ChevronRight, Briefcase, Banknote, BarChart3, Shield, RefreshCw, IdCard, Upload,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useBranding } from "@/lib/branding";
import { usePermissions } from "@/lib/permissions";

type SubItem = { url: string; icon: any; label: string; permKey?: string; superOnly?: boolean };
type ParentItem = {
  key: string;
  icon: any;
  label: string;
  url?: string;
  permKey?: string;
  superOnly?: boolean;
  children?: SubItem[];
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { t, lang } = useLang();
  const { isSuper } = useAuth();
  const brand = useBranding();
  const { can } = usePermissions();

  const menu: ParentItem[] = [
    { key: "dashboard", icon: LayoutDashboard, label: t("dashboard"), url: "/admin", permKey: "dashboard" },
    {
      key: "operations", icon: Briefcase, label: t("operations"),
      children: [
        { url: "/farmers", icon: Users, label: t("farmers"), permKey: "farmers" },
        { url: "/seasons", icon: CalendarDays, label: t("seasons"), permKey: "seasons" },
        { url: "/savings", icon: Wallet, label: t("savings"), permKey: "savings" },
        { url: "/loans", icon: HandCoins, label: t("loans"), permKey: "loans" },
        { url: "/irrigation", icon: Droplets, label: t("irrigation"), permKey: "irrigation" },
        { url: "/irrigation/rates", icon: Droplets, label: "Irrigation Rates", permKey: "irrigation" },
        { url: "/statement", icon: FileText, label: t("statementLabel"), permKey: "savings" },
      ],
    },
    {
      key: "cash", icon: Banknote, label: t("cashAndPayments"),
      children: [
        { url: "/payments", icon: Receipt, label: t("payments"), permKey: "payments" },
        { url: "/scan", icon: ScanLine, label: t("scanQr"), permKey: "payments" },
        { url: "/cashbook", icon: BookOpen, label: t("cashbook"), permKey: "cashbook" },
        { url: "/approvals", icon: ClipboardCheck, label: t("approvals"), permKey: "approvals" },
      ],
    },
    {
      key: "accounting", icon: Calculator, label: t("accounting"),
      children: [
        { url: "/finance-summary", icon: PieChart, label: t("financeSummary"), permKey: "accounting" },
        { url: "/accounts", icon: BookText, label: t("chartOfAccounts"), permKey: "accounting" },
        { url: "/ledger", icon: Calculator, label: t("generalLedger"), permKey: "accounting" },
        { url: "/journal-entry", icon: BookKey, label: t("journalEntry"), permKey: "accounting" },
        { url: "/financial-reports", icon: TrendingUp, label: t("financialReports"), permKey: "accounting" },
        { url: "/period-close", icon: Lock, label: t("periodClose"), permKey: "accounting" },
        { url: "/ledger-integrity", icon: ShieldAlert, label: t("ledgerIntegrity"), permKey: "accounting" },
        { url: "/admin/reconciliation", icon: ClipboardCheck, label: t("monthlyReconciliation"), permKey: "accounting" },
      ],
    },
    {
      key: "reports", icon: BarChart3, label: t("reports"),
      children: [
        { url: "/reports", icon: FileBarChart, label: t("reports"), permKey: "reports" },
        { url: "/reports/collections", icon: FileBarChart, label: t("collectionReport"), permKey: "reports" },
        { url: "/reports/irrigation-due", icon: AlertTriangle, label: t("irrigationDueReport"), permKey: "reports" },
        { url: "/reports/farmer-rejections", icon: AlertTriangle, label: t("rejectedFarmerSubmissions"), permKey: "farmers" },
        { url: "/dues", icon: AlertTriangle, label: t("dues"), permKey: "reports" },
      ],
    },
    {
      key: "admin", icon: Shield, label: t("adminGroup"),
      children: [
        { url: "/offices", icon: Building2, label: t("offices"), permKey: "offices" },
        { url: "/users", icon: ShieldCheck, label: t("users"), superOnly: true },
        { url: "/settings", icon: SettingsIcon, label: t("settings"), superOnly: true },
        { url: "/backup", icon: Database, label: t("backup"), superOnly: true },
        { url: "/audit", icon: ScrollText, label: t("auditLogs"), permKey: "audit" },
        { url: "/admin/qr-rotation", icon: RefreshCw, label: t("qrRotation"), superOnly: true },
        { url: "/admin/bulk-cards", icon: IdCard, label: t("bulkCards"), permKey: "farmers" },
        { url: "/farmers/import", icon: Upload, label: t("bulkFarmerImport"), permKey: "farmers" },
        { url: "/admin/receipt-template", icon: Receipt, label: t("receiptTemplate"), superOnly: true },
        { url: "/sms-settings", icon: MessageSquare, label: t("smsSettings"), superOnly: true },
        { url: "/sms-logs", icon: MessagesSquare, label: t("smsLogs"), permKey: "sms" },
        { url: "/locations", icon: MapPin, label: t("locations"), permKey: "locations" },
        { url: "/admin/role-matrix", icon: Shield, label: t("roleMatrix"), superOnly: true },
      ],
    },
  ];

  const allowed = (i: { permKey?: string; superOnly?: boolean }) => {
    if (i.superOnly) return isSuper;
    if (i.permKey) return can(i.permKey as any, "can_view");
    return true;
  };

  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);

  // Track open groups; default open if any child is active
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    menu.forEach((p) => {
      if (p.children?.some((c) => isActive(c.url))) init[p.key] = true;
    });
    return init;
  });

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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menu.map((parent) => {
                // Leaf item (no children)
                if (!parent.children) {
                  if (!allowed(parent)) return null;
                  return (
                    <SidebarMenuItem key={parent.key}>
                      <SidebarMenuButton asChild isActive={isActive(parent.url!)} tooltip={parent.label}>
                        <NavLink to={parent.url!} end={parent.url === "/"}>
                          <parent.icon className="h-4 w-4" />
                          <span>{parent.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Parent with children
                const visibleChildren = parent.children.filter(allowed);
                if (visibleChildren.length === 0) return null;
                const hasActiveChild = visibleChildren.some((c) => isActive(c.url));
                const isOpen = openGroups[parent.key] ?? hasActiveChild;

                return (
                  <Collapsible
                    key={parent.key}
                    open={isOpen}
                    onOpenChange={(o) => setOpenGroups((prev) => ({ ...prev, [parent.key]: o }))}
                    asChild
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={parent.label}
                          isActive={hasActiveChild && !isOpen}
                          className="group/parent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1"
                        >
                          <parent.icon className="h-4 w-4" />
                          <span>{parent.label}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/parent:rotate-90 data-[state=open]:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {visibleChildren.map((child) => (
                            <SidebarMenuSubItem key={child.url}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive(child.url)}
                                className="focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium"
                              >
                                <NavLink to={child.url}>
                                  <child.icon className="h-4 w-4" />
                                  <span>{child.label}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
