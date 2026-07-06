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
export interface ResponsiveTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Minimum width (px) before horizontal scrolling kicks in. */
  minWidth?: number;
  /** Keep the <thead> pinned to the top while scrolling vertically. */
  sticky?: boolean;
  /** Applied to the inner <table>. */
  tableClassName?: string;
  children: React.ReactNode;
}

export const ResponsiveTable = React.forwardRef<HTMLDivElement, ResponsiveTableProps>(
  ({ minWidth = 1200, sticky = true, className, tableClassName, children, ...props }, ref) => {
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
