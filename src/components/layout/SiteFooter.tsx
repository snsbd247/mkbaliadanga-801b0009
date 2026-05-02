export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-auto w-full border-t border-border bg-muted/60 px-3 py-2.5 sm:py-3 text-center text-[10.5px] sm:text-xs leading-relaxed text-muted-foreground no-print"
      role="contentinfo"
    >
      <p className="mx-auto max-w-3xl break-words">
        © 2025-{year} All rights reserved by{" "}
        <span className="font-medium text-foreground/80">Mohammadkhani Irrigation Project</span>.
        {" "}Developed By{" "}
        <span className="font-medium text-foreground/80">Sync &amp; Solutions IT</span>
      </p>
    </footer>
  );
}
