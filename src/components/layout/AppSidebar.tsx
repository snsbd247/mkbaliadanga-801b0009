import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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

type SubItem = { url: string; icon: any; label: string; permKey?: string; superOnly?: boolean; developerOnly?: boolean };
type ParentItem = {
  key: string;
  icon: any;
  label: string;
  url?: string;
  permKey?: string;
  superOnly?: boolean;
  developerOnly?: boolean;
  children?: SubItem[];
};

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const closeOnNav = () => { if (isMobile) setOpenMobile(false); };
  const { pathname } = useLocation();
  const { t, lang } = useLang();
  const { isSuper, isDeveloper, user } = useAuth();
  const brand = useBranding();
  const { can } = usePermissions();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const queryKey = `sidebar:query:${user?.id ?? "guest"}`;


  const menu: ParentItem[] = [
    { key: "dashboard", icon: LayoutDashboard, label: t("dashboard"), url: "/admin", permKey: "dashboard" },

    // ── Members & Voters ──
    {
      key: "members", icon: Users, label: t("members"),
      children: [
        { url: "/farmers", icon: Users, label: t("farmers"), permKey: "farmers" },
        { url: "/farmers/import", icon: Upload, label: t("bulkFarmerImport"), permKey: "farmers" },
        { url: "/admin/bulk-cards", icon: IdCard, label: t("bulkCards"), permKey: "farmers" },
        { url: "/admin/id-review", icon: IdCard, label: t("idReview"), permKey: "farmers" },
        { url: "/admin/patwaris", icon: Users, label: t("patwaris") },
        { url: "/voters", icon: Users, label: t("voterList"), permKey: "farmers" },
        { url: "/voters/history", icon: FileBarChart, label: t("voterHistory"), permKey: "farmers" },
        { url: "/reports/voter-audit", icon: FileBarChart, label: t("voterAudit"), permKey: "farmers" },
      ],
    },

    // ── Savings & Loans ──
    {
      key: "savingsLoans", icon: Wallet, label: t("savingsAndLoans" as any) || "সঞ্চয় ও ঋণ",
      children: [
        { url: "/savings", icon: Wallet, label: t("savings"), permKey: "savings" },
        { url: "/share-collection", icon: Wallet, label: t("shareCollection"), permKey: "savings" },
        { url: "/loans", icon: HandCoins, label: t("loans"), permKey: "loans" },
        { url: "/loans/plans", icon: HandCoins, label: t("loanPlans"), permKey: "loans" },
        { url: "/admin/loan-delay-settings", icon: HandCoins, label: t("loanDelaySettings" as any), permKey: "loans" },
        { url: "/statement", icon: FileText, label: t("statementLabel"), permKey: "savings" },
      ],
    },

    // ── Irrigation ──
    {
      key: "irrigation", icon: Droplets, label: t("irrigation" as any) || "সেচ",
      children: [
        { url: "/seasons", icon: CalendarDays, label: t("seasons"), permKey: "seasons" },
        { url: "/irrigation/invoices", icon: Droplets, label: t("irrigationInvoices" as any), permKey: "irrigation" },
        { url: "/irrigation/rates", icon: Droplets, label: t("irrigationRatesLabel"), permKey: "irrigation" },
        { url: "/admin/lookups", icon: Sprout, label: t("seasonTypesAndLandKinds" as any) },
        { url: "/admin/rate-audit", icon: ScrollText, label: t("rateChangeHistory" as any) },
        { url: "/admin/irrigation-due-mismatch", icon: ShieldAlert, label: t("irrigationDueMismatch" as any) || "Irrigation Due Mismatch", permKey: "reports" },
      ],
    },

    // ── Cash & Payments ──
    {
      key: "cash", icon: Banknote, label: t("cashAndPayments"),
      children: [
        { url: "/payments", icon: Receipt, label: t("payments"), permKey: "payments" },
        { url: "/scan", icon: ScanLine, label: t("scanQr"), permKey: "payments" },
        { url: "/cashbook", icon: BookOpen, label: t("cashbook"), permKey: "cashbook" },
        { url: "/approvals", icon: ClipboardCheck, label: t("approvals"), permKey: "approvals" },
      ],
    },

    // ── Accounting ──
    {
      key: "accounting", icon: Calculator, label: t("accounting"),
      children: [
        { url: "/finance-summary", icon: PieChart, label: t("financeSummary"), permKey: "accounting" },
        { url: "/accounts", icon: BookText, label: t("chartOfAccounts"), permKey: "accounting" },
        { url: "/ledger", icon: Calculator, label: t("generalLedger"), permKey: "accounting" },
        { url: "/journal-entry", icon: BookKey, label: t("journalEntry"), permKey: "accounting" },
        { url: "/financial-reports", icon: TrendingUp, label: t("financialReports"), permKey: "accounting" },
        { url: "/period-close", icon: Lock, label: t("periodClose"), permKey: "accounting" },
        { url: "/admin/reconciliation", icon: ClipboardCheck, label: t("monthlyReconciliation"), permKey: "accounting" },
        { url: "/admin/share-capital-reconciliation", icon: ClipboardCheck, label: t("shareCapitalReconciliation"), permKey: "accounting" },
        { url: "/ledger-integrity", icon: ShieldAlert, label: t("ledgerIntegrity"), permKey: "accounting" },
      ],
    },

    // ── Reports ──
    {
      key: "reports", icon: BarChart3, label: t("reports"),
      children: [
        { url: "/reports", icon: FileBarChart, label: t("reports"), permKey: "reports" },
        { url: "/reports/collections", icon: FileBarChart, label: t("collectionReport"), permKey: "reports" },
        { url: "/reports/savings-loan", icon: FileBarChart, label: t("savingsLoanReport" as any), permKey: "reports" },
        { url: "/reports/loan-overdue", icon: AlertTriangle, label: "ঋণ মেয়াদোত্তীর্ণ", permKey: "reports" },
        { url: "/reports/installment-collection", icon: FileBarChart, label: "কিস্তি সংগ্রহ", permKey: "reports" },
        { url: "/reports/loan-penalty", icon: FileBarChart, label: "ঋণ জরিমানা", permKey: "reports" },
        { url: "/reports/receipts", icon: FileBarChart, label: t("receiptReportIrrPay" as any), permKey: "reports" },
        { url: "/reports/farmer-statement", icon: FileBarChart, label: t("farmerStatement"), permKey: "reports" },
        { url: "/reports/expenses", icon: FileBarChart, label: t("expensesReport"), permKey: "reports" },
        { url: "/reports/invoices", icon: FileBarChart, label: t("invoicesReport" as any), permKey: "reports" },
        { url: "/irrigation-reports", icon: FileBarChart, label: t("irrigationRevenueCollection" as any), permKey: "reports" },
        { url: "/reports/irrigation-due", icon: AlertTriangle, label: t("irrigationDueReport"), permKey: "reports" },
        { url: "/reports/promise-due", icon: AlertTriangle, label: t("promiseDueReport" as any) || "Promise Due", permKey: "reports" },
        { url: "/dues", icon: AlertTriangle, label: t("dues"), permKey: "reports" },
        { url: "/dues-audit", icon: AlertTriangle, label: t("duesAudit"), permKey: "reports" },
        { url: "/reports/farmer-rejections", icon: AlertTriangle, label: t("rejectedFarmerSubmissions"), permKey: "farmers" },
      ],
    },

    // ── Audit & Monitoring ──
    {
      key: "auditMon", icon: ShieldAlert, label: t("auditAndMonitoring" as any) || "অডিট ও মনিটরিং",
      children: [
        { url: "/audit", icon: ScrollText, label: t("auditLogs"), developerOnly: true },
        { url: "/admin/audit-timeline", icon: ScrollText, label: t("auditTimeline" as any) || "Audit Timeline", developerOnly: true },
        { url: "/admin/retry-jobs", icon: RefreshCw, label: t("retryJobs" as any) || "Retry Jobs", developerOnly: true },
        { url: "/admin/duplicate-receipts", icon: ShieldAlert, label: t("duplicateReceiptAudit" as any) || "Duplicate Receipts", developerOnly: true },
        { url: "/admin/farmer-login-audit", icon: ScrollText, label: t("farmerLoginAudit" as any) || "Farmer Login Audit", developerOnly: true },
        { url: "/admin/id-reconcile", icon: ShieldAlert, label: t("idReconcile"), developerOnly: true },
        { url: "/diagnostics", icon: ShieldAlert, label: t("diagnostics" as any), developerOnly: true },
      ],
    },

    // ── Administration ──
    {
      key: "admin", icon: Shield, label: t("adminGroup"),
      children: [
        { url: "/offices", icon: Building2, label: t("offices"), permKey: "offices" },
        { url: "/locations", icon: MapPin, label: t("locations"), permKey: "locations" },
        { url: "/users", icon: ShieldCheck, label: t("users"), superOnly: true },
        { url: "/admin/role-matrix", icon: Shield, label: t("roleMatrix"), developerOnly: true },
        { url: "/admin/my-permissions", icon: Shield, label: t("myPermissions" as any) },
      ],
    },

    // ── Tools & Imports ──
    {
      key: "tools", icon: Upload, label: t("toolsImports"),
      children: [
        { url: "/import", icon: Upload, label: t("universalImport"), permKey: "farmers" },
        { url: "/admin/bulk-loan-export", icon: Upload, label: t("bulkExportLoans"), superOnly: true },
        { url: "/admin/card-designer", icon: IdCard, label: t("cardDesigner"), superOnly: true },
        { url: "/admin/qr-rotation", icon: RefreshCw, label: t("qrRotation"), superOnly: true },
        { url: "/backup", icon: Database, label: t("backup"), developerOnly: true },
        { url: "/admin/demo-manager", icon: Database, label: t("demoManager" as any), developerOnly: true },
        { url: "/admin/developer-updates", icon: RefreshCw, label: t("developerUpdates" as any), developerOnly: true },
      ],
    },

    // ── Settings ──
    {
      key: "settings", icon: SettingsIcon, label: t("settings"),
      children: [
        { url: "/settings", icon: SettingsIcon, label: t("settings"), superOnly: true },
        { url: "/admin/receipt-template", icon: Receipt, label: t("receiptTemplate"), superOnly: true },
        { url: "/admin/loan-receipt-settings", icon: Receipt, label: t("loanReceiptSettings"), superOnly: true },
        { url: "/sms-settings", icon: MessageSquare, label: t("smsSettings"), superOnly: true },
        { url: "/sms-logs", icon: MessagesSquare, label: t("smsLogs"), permKey: "sms" },
      ],
    },
  ];

  const allowed = (i: { permKey?: string; superOnly?: boolean; developerOnly?: boolean }) => {
    if (i.developerOnly) return isDeveloper;
    if (i.superOnly) return isSuper;
    if (i.permKey) return can(i.permKey as any, "can_view");
    return true;
  };

  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);

  const [query, setQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try { return localStorage.getItem(queryKey) ?? ""; } catch { return ""; }
  });

  // Persist query per user
  useEffect(() => {
    try { localStorage.setItem(queryKey, query); } catch { /* noop */ }
  }, [query, queryKey]);

  // Note: global Ctrl/Cmd+K is handled by the header MenuSearch component.
  // The sidebar's local search can still be focused by clicking it directly.

  // Accordion: only one group expanded at a time
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    const active = menu.find((p) => p.children?.some((c) => isActive(c.url)));
    return active?.key ?? null;
  });

  // Filter menu by search query (case-insensitive on labels)
  const q = query.trim().toLowerCase();
  const filteredMenu = useMemo(() => {
    if (!q) return menu;
    return menu
      .map((p) => {
        if (!p.children) {
          return p.label.toLowerCase().includes(q) ? p : null;
        }
        const kids = p.children.filter((c) => c.label.toLowerCase().includes(q));
        if (kids.length === 0 && !p.label.toLowerCase().includes(q)) return null;
        return { ...p, children: kids.length ? kids : p.children };
      })
      .filter(Boolean) as ParentItem[];
  }, [q, menu]);



  // Highlight matched substring within a label
  const highlight = (text: string) => {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q);
    if (i === -1) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-primary/30 text-sidebar-foreground rounded px-0.5">
          {text.slice(i, i + q.length)}
        </mark>
        {text.slice(i + q.length)}
      </>
    );
  };

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
        {/* Menu search moved to the global header (MenuSearch) */}


        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenu.length === 0 && (
                <div className="px-3 py-4 text-xs text-sidebar-foreground/60">{t("noResults")}</div>
              )}
              {filteredMenu.map((parent) => {
                // Leaf item (no children)
                if (!parent.children) {
                  if (!allowed(parent)) return null;
                  return (
                    <SidebarMenuItem key={parent.key}>
                      <SidebarMenuButton asChild isActive={isActive(parent.url!)} tooltip={parent.label}>
                        <NavLink to={parent.url!} end={parent.url === "/"} onClick={closeOnNav}>
                          <parent.icon className="h-4 w-4" />
                          <span>{highlight(parent.label)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Parent with children
                const visibleChildren = parent.children.filter(allowed);
                if (visibleChildren.length === 0) return null;
                const hasActiveChild = visibleChildren.some((c) => isActive(c.url));
                const isOpen = q ? true : (openGroup === parent.key || (openGroup === null && hasActiveChild));

                return (
                  <Collapsible
                    key={parent.key}
                    open={isOpen}
                    onOpenChange={(o) => setOpenGroup(o ? parent.key : (openGroup === parent.key ? null : openGroup))}
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
                          <span>{highlight(parent.label)}</span>
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
                                <NavLink to={child.url} onClick={closeOnNav}>
                                  <child.icon className="h-4 w-4" />
                                  <span className="flex-1 truncate">{highlight(child.label)}</span>
                                  {q && (
                                    <span className="ml-1 shrink-0 text-[9px] uppercase tracking-wide text-sidebar-foreground/50">
                                      {parent.label}
                                    </span>
                                  )}
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
