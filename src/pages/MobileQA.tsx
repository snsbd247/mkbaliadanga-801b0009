import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Smartphone } from "lucide-react";

type Route = {
  path: string;
  name: string;
  fixes: string[];
  tests: string[];
};

const routes: Route[] = [
  {
    path: "/auth",
    name: "Auth",
    fixes: [
      "Inputs full-width with proper spacing",
      "Buttons stack on mobile (full-width)",
      "Card padding reduced on small screens",
    ],
    tests: [
      "Open at 360px width — form fits without horizontal scroll",
      "Tap email & password fields — keyboard does not cover submit",
      "Toggle Sign In / Sign Up — layout remains intact",
    ],
  },
  {
    path: "/",
    name: "Dashboard",
    fixes: [
      "Stat cards stack to single column under 640px",
      "Header avatar collapses to icon-only dropdown",
      "Sidebar opens as off-canvas sheet with overlay",
    ],
    tests: [
      "Tap menu (☰) — sidebar slides in, content stays usable",
      "Scroll vertically — sticky header remains visible",
      "Rotate device — no overflow, KPI cards re-flow",
    ],
  },
  {
    path: "/farmers",
    name: "Farmers",
    fixes: [
      "Filters stack vertically with full-width inputs",
      "Action buttons full-width on mobile (.btn-group-responsive)",
      "Table uses compact padding + horizontal scroll wrapper",
    ],
    tests: [
      "Search box, office filter, and Add button stack cleanly",
      "Swipe table left/right — column headers stay aligned",
      "Tap a row — detail page opens without layout break",
    ],
  },
  {
    path: "/reports",
    name: "Reports",
    fixes: [
      "Date range pickers stack on mobile",
      "Export PDF/Excel buttons full-width on mobile",
      "Report tables wrap in .table-responsive for scroll",
    ],
    tests: [
      "Pick a date range — calendars open within viewport",
      "Tap Export — file downloads with date-range filename",
      "Switch report tabs — no horizontal page overflow",
    ],
  },
];

export default function MobileQA() {
  return (
    <div>
      <PageHeader
        title="Mobile QA Checklist"
        description="Verify responsive behavior on each key route. Test at 360px, 414px, and 768px viewports."
      />

      <Card className="mb-4 border-accent/40 bg-accent/5">
        <CardContent className="pt-4 text-sm text-muted-foreground flex items-start gap-2">
          <Smartphone className="h-5 w-5 text-accent mt-0.5 shrink-0" />
          <div>
            Use Chrome DevTools (Ctrl+Shift+M) or the device-toggle above the preview.
            For each route below, run through the test steps and confirm all fixes are visible.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {routes.map((r) => (
          <Card key={r.path}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div className="min-w-0">
                <CardTitle className="text-base truncate">{r.name}</CardTitle>
                <code className="text-xs text-muted-foreground">{r.path}</code>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={r.path}>
                  Open <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                  <Badge variant="secondary" className="text-[10px]">Fixes applied</Badge>
                </div>
                <ul className="space-y-1">
                  {r.fixes.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                  <Badge className="text-[10px]">Test steps</Badge>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground marker:text-foreground">
                  {r.tests.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
