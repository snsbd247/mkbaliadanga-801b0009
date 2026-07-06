import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BUILD_ID, fetchDeployedFingerprint } from "@/lib/buildInfo";
import { BACKEND_LABEL } from "@/lib/backend";

// Shows the current build version and warns the user when the server has a
// newer bundle than the one loaded in this browser tab (stale cache).
export default function BuildVersionWatcher() {
  const [stale, setStale] = useState(false);
  const baseline = useRef<string | null>(null);
  const notified = useRef(false);

  useEffect(() => {
    let active = true;

    const check = async () => {
      const fp = await fetchDeployedFingerprint();
      if (!active || !fp) return;
      if (baseline.current === null) {
        baseline.current = fp;
        return;
      }
      if (fp !== baseline.current && !notified.current) {
        notified.current = true;
        setStale(true);
        toast("নতুন সংস্করণ পাওয়া গেছে", {
          description: "পুরোনো ক্যাশ এড়াতে অ্যাপটি রিফ্রেশ করুন।",
          duration: Infinity,
          action: {
            label: "রিফ্রেশ",
            onClick: () => window.location.reload(),
          },
        });
        // One-time automatic refresh, but only with the user's confirmation so
        // unsaved work is never lost silently.
        setTimeout(() => {
          if (window.confirm("নতুন সংস্করণ পাওয়া গেছে। এখনই রিফ্রেশ করবেন? (অসংরক্ষিত কাজ থাকলে বাতিল করুন)")) {
            window.location.reload();
          }
        }, 1200);
      }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      title={`Build ${BUILD_ID} • ${BACKEND_LABEL}`}
      className="fixed bottom-1 left-1 z-50 select-none rounded bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur pointer-events-none"
    >
      v{BUILD_ID}
      {stale && <span className="ml-1 font-semibold text-destructive">• আপডেট আছে</span>}
    </div>
  );
}
