export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto w-full border-t bg-muted/40 px-3 py-2 text-center text-[11px] sm:text-xs text-muted-foreground no-print">
      © 2025-{year} All rights reserved by Mohammadkhani Irrigation Project. Developed By Sync &amp; Solutions IT
    </footer>
  );
}
