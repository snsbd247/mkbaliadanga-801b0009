import { useEffect, useRef } from "react";

/**
 * Persists form draft to sessionStorage and warns on tab close/refresh
 * if there are unsaved changes. Restores draft on mount.
 *
 * Usage:
 *   const { restore, clear } = useUnsavedFormGuard("farmer-add", formState, isDirty);
 *   // On mount: const draft = restore(); if (draft) setForm(draft);
 *   // After successful save: clear();
 */
export function useUnsavedFormGuard<T>(
  key: string,
  data: T,
  isDirty: boolean,
) {
  const storageKey = `lov:draft:${key}`;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  // Persist on every change while dirty
  useEffect(() => {
    if (!isDirty) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(data)); } catch {}
  }, [data, isDirty, storageKey]);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return {
    /** True if a saved draft exists in sessionStorage (use to gate a restore prompt). */
    hasDraft: (): boolean => {
      try { return sessionStorage.getItem(storageKey) != null; } catch { return false; }
    },
    restore: (): T | null => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch { return null; }
    },
    clear: () => {
      try { sessionStorage.removeItem(storageKey); } catch {}
    },
  };
}
