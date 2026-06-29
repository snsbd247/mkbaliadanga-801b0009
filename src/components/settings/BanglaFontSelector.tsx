import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BANGLA_FONTS, getBanglaFontPref, setBanglaFontPref, type BanglaFontId,
} from "@/lib/banglaFonts";
import { jsPDF } from "jspdf";
import { ensureBanglaFont } from "@/lib/pdfFonts";

const SAMPLE_BN = "যত মত তত পথ — বাংলাদেশের কৃষক সমিতি। কৃষ্ণচূড়া ফোটে। ক্ষুদ্র ঋণ ব্যবস্থা। ২০২৬ সালের সেচ মৌসুম। জ্ঞান, বিজ্ঞান, ঐক্য।";
const SAMPLE_DIGITS = "সংখ্যা: ০ ১ ২ ৩ ৪ ৫ ৬ ৭ ৮ ৯ — টাকা ১২,৩৪৫.৬৭";
const SAMPLE_CONJUNCTS = "যুক্তাক্ষর: ক্ষ ত্র জ্ঞ ঞ্চ ন্দ্র শ্র হ্ম ণ্ড স্ত্র";

export default function BanglaFontSelector() {
  const [pref, setPref] = useState<BanglaFontId>(() => getBanglaFontPref());
  const [busy, setBusy] = useState(false);

  // Inject @font-face for ALL fonts so the preview reflects the real glyphs.
  useEffect(() => {
    const id = "bangla-font-preview-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = BANGLA_FONTS.map((f) => `
      @font-face {
        font-family: '${f.family}';
        src: url('${f.url}') format('truetype');
        font-display: swap;
      }`).join("\n");
    document.head.appendChild(style);
  }, []);

  function choose(id: BanglaFontId) {
    setPref(id);
    setBanglaFontPref(id);
    toast.success("বাংলা ফন্ট আপডেট হয়েছে — পরবর্তী PDF ও রিসিপ্টে কার্যকর।");
  }

  async function downloadQaSample() {
    setBusy(true);
    try {
      const jsPDFmod: any = await import("jspdf");
      const { ensureBanglaFont } = await import("@/lib/pdfFonts");
      const doc = new jsPDFmod.jsPDF({ unit: "pt", format: "a4" });
      const family = await ensureBanglaFont(doc);
      if (family) doc.setFont(family, "normal");
      doc.setFontSize(16);
      doc.text("Bangla Font QA Sample", 40, 50);
      doc.setFontSize(11);
      const lines = [
        `Font: ${family ?? "(default fallback)"}`,
        "",
        SAMPLE_BN,
        SAMPLE_DIGITS,
        SAMPLE_CONJUNCTS,
      ];
      let y = 80;
      for (const ln of lines) {
        const wrapped = doc.splitTextToSize(ln, 510);
        doc.text(wrapped, 40, y);
        y += wrapped.length * 16 + 6;
      }
      doc.save(`bangla-font-qa-${pref}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "PDF তৈরি ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl p-6 mt-4">
      <div className="font-semibold mb-1">বাংলা ফন্ট (PDF / রিসিপ্ট)</div>
      <div className="text-sm text-muted-foreground mb-3">
        কোন বাংলা ফন্টে সেরা রেন্ডার হয় সেটা বেছে নিন। পছন্দ অটো-সেভ হয় এবং সব PDF/রিসিপ্টে এই ফন্ট subset-embed হয়, ফলে যেকোনো ডিভাইস ও PDF viewer-এ একই দেখাবে। ফন্ট লোড না হলে স্বয়ংক্রিয়ভাবে fallback হবে।
      </div>

      <div className="grid gap-3">
        {BANGLA_FONTS.map((f) => {
          const active = pref === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => choose(f.id)}
              className={`text-left rounded-lg border p-4 transition ${
                active
                  ? "border-primary ring-2 ring-primary/30 bg-accent/30"
                  : "border-border hover:bg-accent/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">{f.labelBn} <span className="text-xs text-muted-foreground">— {f.labelEn}</span></div>
                  <div className="text-xs text-muted-foreground">{f.description}</div>
                </div>
                {active && <span className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground">Active</span>}
              </div>
              <div className="space-y-1" style={{ fontFamily: `'${f.family}', system-ui, sans-serif` }}>
                <div className="text-base">{SAMPLE_BN}</div>
                <div className="text-sm text-muted-foreground">{SAMPLE_CONJUNCTS}</div>
                <div className="text-sm text-muted-foreground">{SAMPLE_DIGITS}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={downloadQaSample} disabled={busy}>
          {busy ? "…" : "QA নমুনা PDF ডাউনলোড"}
        </Button>
        <a
          href="/docs/bangla-font-qa.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline px-2"
        >
          মাল্টি-viewer QA গাইড →
        </a>
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        QA গাইডে Chrome, Adobe Reader, মোবাইল PDF অ্যাপে কীভাবে যাচাই করবেন তা ধাপে ধাপে দেওয়া আছে।
      </div>
    </Card>
  );
}
