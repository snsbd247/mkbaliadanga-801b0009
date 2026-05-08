import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncateTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "title"> {
  children: ReactNode;
  /** Tooltip content. Falls back to children rendered as text. */
  tooltip?: ReactNode;
  /** Show tooltip even if not overflowing (default false). */
  alwaysTooltip?: boolean;
  /** Multi-line clamp. Single-line truncate if undefined. */
  lines?: 1 | 2 | 3;
  /** Pass-through className for max-w / sizing. */
  className?: string;
}

/**
 * Truncates long text with ellipsis and reveals the full value in a
 * tooltip on hover/focus/tap. Tooltip is only attached when the text
 * actually overflows its container, avoiding noise on short values.
 */
export function TruncateText({
  children,
  tooltip,
  alwaysTooltip = false,
  lines,
  className,
  ...rest
}: TruncateTextProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const isOverflow = lines
        ? el.scrollHeight - 1 > el.clientHeight
        : el.scrollWidth - 1 > el.clientWidth;
      setOverflows(isOverflow);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, lines]);

  const truncClass = lines
    ? lines === 1
      ? "truncate"
      : `line-clamp-${lines}`
    : "truncate";

  const inner = (
    <span
      ref={ref}
      className={cn("inline-block max-w-full align-bottom", truncClass, className)}
      {...rest}
    >
      {children}
    </span>
  );

  if (!overflows && !alwaysTooltip) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs break-words text-xs">
        {tooltip ?? children}
      </TooltipContent>
    </Tooltip>
  );
}
