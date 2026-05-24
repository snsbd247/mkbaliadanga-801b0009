import { useCallback, useRef } from "react";

/**
 * Reusable form UX helpers — pairs with `<FormErrorSummary />` and
 * `useUnsavedFormGuard`. Provides:
 *   - registerField(name, el): track an element by logical field name
 *   - focusField(name): focus a registered field
 *   - focusFirstError(errorFields): focus the first invalid field
 *   - preventEnterSubmit(e): block accidental Enter-key form submission
 *     in text inputs (allows Ctrl/Cmd+Enter, textarea, and button-triggered).
 */
export function useFormUx() {
  const refs = useRef<Map<string, HTMLElement>>(new Map());

  const registerField = useCallback((name: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(name, el);
    else refs.current.delete(name);
  }, []);

  const focusField = useCallback((name: string) => {
    const el = refs.current.get(name);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = el.matches("input,textarea,select,button,[tabindex]")
      ? el
      : (el.querySelector("input,textarea,select,button,[tabindex]") as HTMLElement | null);
    focusable?.focus?.();
  }, []);

  const focusFirstError = useCallback((fieldsInOrder: string[]) => {
    for (const f of fieldsInOrder) {
      if (refs.current.has(f)) { focusField(f); return; }
    }
  }, [focusField]);

  const preventEnterSubmit = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const tgt = e.target as HTMLElement;
    if (tgt.tagName === "TEXTAREA") return;
    if (tgt.tagName === "BUTTON") return;
    // Allow Ctrl/Cmd+Enter as deliberate submit signal
    if (e.ctrlKey || e.metaKey) return;
    // Block default form submit on Enter inside text inputs
    if (tgt.tagName === "INPUT") {
      const type = (tgt as HTMLInputElement).type;
      if (type === "submit" || type === "button") return;
      e.preventDefault();
    }
  }, []);

  return { registerField, focusField, focusFirstError, preventEnterSubmit };
}
