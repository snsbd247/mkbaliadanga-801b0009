import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ResponsiveTable — a reusable table wrapper that guarantees:
 *  - consistent column widths (table-layout can be toggled)
 *  - single-line (nowrap) headers on screen
 *  - smooth horizontal scrolling with sticky header row
 *  - print-safe layout (landscape, no header overlap) via the
 *    shared `.rt-table` styles in index.css
 *
 * Usage:
 *   <ResponsiveTable minWidth={1400} sticky>
 *     <table className="rt-table">...</table>  // or pass children as rows
 *   </ResponsiveTable>
 */
/**
 * Per-report minWidth presets so irrigation / savings / loan / cashbook
 * tables get a stable, consistent layout without manual tuning.
 */
export const TABLE_PRESETS = {
  irrigation: 1600,
  savings: 1400,
  loan: 1400,
  cashbook: 1400,
  report: 1200,
} as const;

export type TablePreset = keyof typeof TABLE_PRESETS;

export interface ResponsiveTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Minimum width (px) before horizontal scrolling kicks in. Overrides `preset`. */
  minWidth?: number;
  /** Named column-width preset for a report family (irrigation/savings/loan/cashbook/report). */
  preset?: TablePreset;
  /** Keep the <thead> pinned to the top while scrolling vertically. */
  sticky?: boolean;
  /** Applied to the inner <table>. */
  tableClassName?: string;
  children: React.ReactNode;
}

export const ResponsiveTable = React.forwardRef<HTMLDivElement, ResponsiveTableProps>(
  ({ minWidth, preset, sticky = true, className, tableClassName, children, ...props }, ref) => {
    const resolvedMinWidth = minWidth ?? (preset ? TABLE_PRESETS[preset] : 1200);
    return (
      <div
        ref={ref}
        data-table-wrap
        className={cn("rt-scroll relative w-full overflow-x-auto", className)}
        {...props}
      >
        <table
          className={cn("rt-table w-full caption-bottom text-sm", sticky && "rt-sticky", tableClassName)}
          style={{ minWidth }}
        >
          {children}
        </table>
      </div>
    );
  },
);
ResponsiveTable.displayName = "ResponsiveTable";
