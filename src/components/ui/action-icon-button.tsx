import * as React from "react";
import { Pencil, Trash2, Eye, Printer, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Standard action-icon button used across all tables/lists.
 * Matches reference design: icon-only square button, transparent background,
 * colored icon (per action), subtle hover background. All four actions share
 * the same shape/size — only the icon color differs.
 */
function makeActionButton(
  Icon: LucideIcon,
  iconColor: string,
  hoverBg: string,
  defaults: { ariaLabel: string; title: string },
) {
  const Cmp = React.forwardRef<HTMLButtonElement, BtnProps>(
    (
      {
        className,
        type = "button",
        "aria-label": ariaLabel = defaults.ariaLabel,
        title = defaults.title,
        ...props
      },
      ref,
    ) => (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        title={title}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg",
          "bg-transparent transition-colors",
          hoverBg,
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring",
          "disabled:opacity-50 disabled:pointer-events-none",
          className,
        )}
        {...props}
      >
        <Icon className={cn("h-[18px] w-[18px]", iconColor)} />
      </button>
    ),
  );
  Cmp.displayName = `${defaults.ariaLabel}Button`;
  return Cmp;
}

export const EditButton = makeActionButton(
  Pencil,
  "text-amber-500",
  "hover:bg-amber-50 dark:hover:bg-amber-500/10",
  { ariaLabel: "Edit", title: "Edit" },
);

export const DeleteButton = makeActionButton(
  Trash2,
  "text-slate-500 dark:text-slate-400",
  "hover:bg-slate-100 dark:hover:bg-slate-500/10",
  { ariaLabel: "Delete", title: "Delete" },
);

export const ViewButton = makeActionButton(
  Eye,
  "text-sky-500",
  "hover:bg-sky-50 dark:hover:bg-sky-500/10",
  { ariaLabel: "View", title: "View" },
);

export const PrintButton = makeActionButton(
  Printer,
  "text-slate-600 dark:text-slate-300",
  "hover:bg-slate-100 dark:hover:bg-slate-500/10",
  { ariaLabel: "Print", title: "Print" },
);
