import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLang } from "@/i18n/LanguageProvider";

export interface FieldError {
  field: string;
  label: string;
  message: string;
}

interface Props {
  errors: FieldError[];
  onFocusField?: (field: string) => void;
}

/**
 * Renders a list of form validation errors at the top of a form.
 * Click an error to scroll/focus the associated field (caller wires `onFocusField`).
 *
 * Used together with `useFormUx().focusFirstError` for consistent UX across
 * Farmer / Loan / Payment forms.
 */
export function FormErrorSummary({ errors, onFocusField }: Props) {
  const { tx } = useLang();
  if (!errors.length) return null;
  return (
    <Alert variant="destructive" className="mb-3">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {tx(
          `Please fix ${errors.length} issue${errors.length > 1 ? "s" : ""} below`,
          `নিচের ${errors.length}টি সমস্যা ঠিক করুন`,
        )}
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-5 mt-1 space-y-0.5 text-sm">
          {errors.map((e) => (
            <li key={e.field}>
              <button
                type="button"
                className="underline-offset-2 hover:underline text-left"
                onClick={() => onFocusField?.(e.field)}
              >
                <span className="font-medium">{e.label}:</span> {e.message}
              </button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
