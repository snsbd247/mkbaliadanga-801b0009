import * as React from "react";
import { Pencil, Trash2, Eye, Printer, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type BaseProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Visible tooltip text on hover. Defaults to the button's action name. */
  tooltip?: React.ReactNode;
};

/**
 * Standard action-icon button: square, transparent, colored icon, hover bg.
 * Wraps the button in a Radix Tooltip so the action name shows on hover.
 */
function makeActionButton(
  Icon: LucideIcon,
  iconColor: string,
  hoverBg: string,
  defaults: { ariaLabel: string; title: string },
) {
  const Cmp = React.forwardRef<HTMLButtonElement, BaseProps>(
    (
      {
        className,
        type = "button",
        "aria-label": ariaLabel = defaults.ariaLabel,
        title,
        tooltip,
        children,
        ...props
      },
      ref,
    ) => {
      const tip = tooltip ?? title ?? defaults.title;
      const btn = (
        <button
          ref={ref}
          type={type}
          aria-label={ariaLabel}
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
          {children ?? <Icon className={cn("h-[18px] w-[18px]", iconColor)} />}
        </button>
      );
      if (!tip) return btn;
      return (
        <Tooltip>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="top">{tip}</TooltipContent>
        </Tooltip>
      );
    },
  );
  Cmp.displayName = `${defaults.ariaLabel}Button`;
  return Cmp;
}

const EditBase = makeActionButton(
  Pencil,
  "text-amber-500",
  "hover:bg-amber-50 dark:hover:bg-amber-500/10",
  { ariaLabel: "Edit", title: "Edit" },
);
export const EditButton = EditBase;

const ViewBase = makeActionButton(
  Eye,
  "text-sky-500",
  "hover:bg-sky-50 dark:hover:bg-sky-500/10",
  { ariaLabel: "View", title: "View" },
);
export const ViewButton = ViewBase;

const DeleteBase = makeActionButton(
  Trash2,
  "text-slate-500 dark:text-slate-400",
  "hover:bg-slate-100 dark:hover:bg-slate-500/10",
  { ariaLabel: "Delete", title: "Delete" },
);

type DeleteProps = BaseProps & {
  /** When provided, clicking opens an AlertDialog and calls this on confirm. */
  onConfirm?: () => void | Promise<void>;
  confirmTitle?: React.ReactNode;
  confirmDescription?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
};

/**
 * DeleteButton:
 * - If `onConfirm` is supplied → renders inside AlertDialog with confirm/cancel.
 * - Otherwise behaves as a plain icon button using `onClick` (back-compat).
 */
export const DeleteButton = React.forwardRef<HTMLButtonElement, DeleteProps>(
  (
    {
      onConfirm,
      confirmTitle = "Are you sure?",
      confirmDescription = "This action cannot be undone.",
      confirmLabel = "Delete",
      cancelLabel = "Cancel",
      disabled,
      ...rest
    },
    ref,
  ) => {
    if (!onConfirm) return <DeleteBase ref={ref} disabled={disabled} {...rest} />;
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <DeleteBase ref={ref} disabled={disabled} {...rest} />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void onConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
);
DeleteButton.displayName = "DeleteButton";

const PrintBase = makeActionButton(
  Printer,
  "text-slate-600 dark:text-slate-300",
  "hover:bg-slate-100 dark:hover:bg-slate-500/10",
  { ariaLabel: "Print", title: "Print" },
);

type PrintProps = BaseProps & {
  /** Force the spinner/disabled state (e.g. parent-controlled). */
  loading?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement> | (() => void | Promise<void>);
};

/**
 * PrintButton: when `onClick` returns a Promise OR `loading` is true, the button
 * shows a spinner and is disabled so users can't click repeatedly.
 */
export const PrintButton = React.forwardRef<HTMLButtonElement, PrintProps>(
  ({ loading, disabled, children, tooltip, title, onClick, ...rest }, ref) => {
    const [pending, setPending] = React.useState(false);
    const busy = loading || pending;
    const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!onClick) return;
      const result = (onClick as any)(e);
      if (result && typeof result.then === "function") {
        setPending(true);
        Promise.resolve(result).finally(() => setPending(false));
      }
    };
    return (
      <PrintBase
        ref={ref}
        disabled={disabled || busy}
        tooltip={busy ? "Printing…" : tooltip ?? title}
        onClick={handle}
        {...rest}
      >
        {busy ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin text-slate-500" />
        ) : (
          children
        )}
      </PrintBase>
    );
  },
);
PrintButton.displayName = "PrintButton";
