import { useState, useCallback, useRef } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Opts = {
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type State = Opts & { open: boolean };

/**
 * Promise-based confirmation dialog.
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete?", destructive: true }))) return;
 */
export function useConfirm() {
  const [state, setState] = useState<State>({ open: false });
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((opts: Opts = {}) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ open: true, ...opts });
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = undefined;
    setState((s) => ({ ...s, open: false }));
  };

  const dialog = (
    <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title ?? "Are you sure?"}</AlertDialogTitle>
          {state.description && <AlertDialogDescription asChild><div>{state.description}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{state.cancelText ?? "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={state.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {state.confirmText ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
