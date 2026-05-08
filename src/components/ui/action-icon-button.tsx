import * as React from "react";
import { Pencil, Trash2, Eye, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * EditButton — filled amber rounded-square icon button with white pencil.
 * Use as the standard "edit" action across all tables/lists.
 */
export const EditButton = React.forwardRef<HTMLButtonElement, BtnProps>(
  ({ className, type = "button", "aria-label": ariaLabel = "Edit", title = "Edit", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg",
        "bg-amber-500 text-white shadow-sm transition-colors",
        "hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <Pencil className="h-4 w-4" />
    </button>
  ),
);
EditButton.displayName = "EditButton";

/**
 * DeleteButton — plain outlined trash icon button (transparent background).
 */
export const DeleteButton = React.forwardRef<HTMLButtonElement, BtnProps>(
  ({ className, type = "button", "aria-label": ariaLabel = "Delete", title = "Delete", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg",
        "bg-transparent text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ),
);
DeleteButton.displayName = "DeleteButton";
