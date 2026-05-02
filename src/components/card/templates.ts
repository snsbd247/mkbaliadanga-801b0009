// Shared template definitions used by both the React preview (MembershipCard)
// and the jsPDF generator (cardPdf). Keep purely declarative so PDF output
// stays in sync with the on-screen preview.

export type TemplateId = "classic" | "minimal" | "bilingual";

export interface TemplateConfig {
  id: TemplateId;
  label: string;
  // Header bar color (RGB 0-255) – used by PDF.
  headerRgb: [number, number, number];
  // Header text color (RGB 0-255) – used by PDF.
  headerTextRgb: [number, number, number];
  // Tailwind classes for the React preview header.
  headerClass: string;
  // Body font family registered in jsPDF (helvetica/times/courier).
  pdfFont: "helvetica" | "times" | "courier";
  // Tailwind class controlling body typography in the React preview.
  bodyFontClass: string;
  // Whether to emphasize Bengali typography in the React preview.
  bnFirst: boolean;
  // Photo border color (RGB 0-255).
  borderRgb: [number, number, number];
}

export const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  classic: {
    id: "classic",
    label: "Classic",
    headerRgb: [16, 122, 87],
    headerTextRgb: [255, 255, 255],
    headerClass: "bg-emerald-700 text-white",
    pdfFont: "helvetica",
    bodyFontClass: "font-sans",
    bnFirst: false,
    borderRgb: [220, 220, 220],
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    headerRgb: [255, 255, 255],
    headerTextRgb: [17, 17, 17],
    headerClass: "bg-white text-gray-900 border-b",
    pdfFont: "helvetica",
    bodyFontClass: "font-mono",
    bnFirst: false,
    borderRgb: [200, 200, 200],
  },
  bilingual: {
    id: "bilingual",
    label: "Bilingual (BN)",
    headerRgb: [30, 64, 175],
    headerTextRgb: [255, 255, 255],
    headerClass: "bg-blue-700 text-white",
    pdfFont: "times",
    bodyFontClass: "font-serif",
    bnFirst: true,
    borderRgb: [200, 200, 200],
  },
};

export const TEMPLATE_LIST: TemplateConfig[] = Object.values(TEMPLATES);
