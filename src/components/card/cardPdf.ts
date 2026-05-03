import { jsPDF } from "jspdf";
import type { CardData, CardDisplayOptions } from "./MembershipCard";
import { TEMPLATES, type TemplateId } from "./templates";

const CARD_W = 85.6; // mm
const CARD_H = 54;

function hexToRgb(hex?: string): [number, number, number] | null {
  if (!hex) return null;
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function svgToDataUrl(svg: SVGElement, size = 256): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

async function imgToDataUrl(src: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i); i.onerror = rej; i.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch { return null; }
}

interface RenderOptions {
  display?: CardDisplayOptions;
}

async function renderCard(
  doc: jsPDF,
  data: CardData,
  qrSvg: SVGElement | null,
  templateId: TemplateId,
  startX: number,
  display?: CardDisplayOptions,
) {
  const tpl = TEMPLATES[templateId] ?? TEMPLATES.classic;
  const opts: Required<Pick<CardDisplayOptions,
    "show_photo" | "show_account_number" | "show_voter_number" |
    "show_issue_date" | "show_qr">> & CardDisplayOptions = {
    show_photo: true, show_account_number: true, show_voter_number: true,
    show_issue_date: true, show_qr: true, ...(display ?? {}),
  };
  const headerH = Math.max(5, Math.min(20, opts.header_height_mm ?? 8));
  const logoSz = Math.max(3, Math.min(20, opts.logo_size_mm ?? 6));
  const photoH = Math.max(10, Math.min(40, opts.photo_size_mm ?? 24));
  const fs = Math.max(0.7, Math.min(1.6, opts.font_scale ?? 1));
  const accentRgb = hexToRgb(opts.accent_color);
  const headerRgb = accentRgb ?? tpl.headerRgb;
  const headerTextRgb: [number, number, number] = accentRgb ? [255, 255, 255] : tpl.headerTextRgb;

  const frontY = 20;
  const backY = frontY + CARD_H + 8;

  // FRONT
  doc.setDrawColor(...tpl.borderRgb);
  doc.roundedRect(startX, frontY, CARD_W, CARD_H, 2, 2, "S");
  doc.setFillColor(...headerRgb);
  doc.rect(startX, frontY, CARD_W, headerH, "F");

  // Logo
  let textX = startX + 3;
  if (data.logo_url) {
    const lUrl = await imgToDataUrl(data.logo_url);
    if (lUrl) {
      doc.addImage(lUrl, "JPEG", startX + 1.5, frontY + (headerH - logoSz) / 2, logoSz, logoSz);
      textX = startX + 1.5 + logoSz + 1.5;
    }
  }

  doc.setTextColor(...headerTextRgb);
  doc.setFontSize(9 * fs); doc.setFont(tpl.pdfFont, "bold");
  const titleSrc = tpl.bnFirst
    ? (data.company_name_bn || data.company_name)
    : data.company_name;
  doc.text(String(titleSrc).slice(0, 36), textX, frontY + headerH / 2 + 1.2);
  doc.setTextColor(0);

  // Photo
  const bodyTop = frontY + headerH + 2;
  let nameX = startX + 3;
  if (opts.show_photo) {
    const photoW = photoH * 0.78;
    if (data.farmer.photo_url) {
      const pUrl = await imgToDataUrl(data.farmer.photo_url);
      if (pUrl) doc.addImage(pUrl, "JPEG", startX + 3, bodyTop, photoW, photoH);
      else { doc.setDrawColor(...tpl.borderRgb); doc.rect(startX + 3, bodyTop, photoW, photoH); }
    } else {
      doc.setDrawColor(...tpl.borderRgb); doc.rect(startX + 3, bodyTop, photoW, photoH);
    }
    nameX = startX + 3 + photoW + 2;
  }

  doc.setFontSize(10 * fs); doc.setFont(tpl.pdfFont, "bold");
  doc.text(String(data.farmer.name).slice(0, 28), nameX, bodyTop + 4);
  doc.setFontSize(7 * fs); doc.setFont(tpl.pdfFont, "normal");
  let y = bodyTop + 9;
  if (opts.show_account_number && data.farmer.account_number) {
    doc.text(`A/C: ${data.farmer.account_number}`, nameX, y); y += 4;
  }
  if (opts.show_voter_number && data.farmer.voter_number) {
    doc.text(`Voter: ${data.farmer.voter_number}`, nameX, y); y += 4;
  }
  if (data.farmer.farmer_code) { doc.text(`ID: ${data.farmer.farmer_code}`, nameX, y); y += 4; }
  if (opts.show_issue_date) {
    doc.text(`Issued: ${new Date(data.issued_at).toLocaleDateString()}`, nameX, y); y += 4;
  }
  if (opts.custom_text || opts.custom_text_bn) {
    doc.setFontSize(6 * fs);
    const ct = [opts.custom_text, opts.custom_text_bn].filter(Boolean).join(" · ");
    doc.text(String(ct).slice(0, 60), nameX, y);
  }

  // BACK
  doc.setDrawColor(...tpl.borderRgb);
  doc.roundedRect(startX, backY, CARD_W, CARD_H, 2, 2, "S");
  doc.setFontSize(8 * fs); doc.setFont(tpl.pdfFont, "bold");
  doc.text("Contact", startX + 3, backY + 5);
  doc.setFontSize(7 * fs); doc.setFont(tpl.pdfFont, "normal");
  let by = backY + 10;
  if (data.farmer.village) { doc.text(`Village: ${data.farmer.village}`, startX + 3, by); by += 4; }
  if (data.farmer.address) {
    const lines = doc.splitTextToSize(`Address: ${data.farmer.address}`, 50);
    doc.text(lines.slice(0, 3), startX + 3, by); by += Math.min(3, lines.length) * 4;
  }
  if (data.farmer.mobile) { doc.text(`Mobile: ${data.farmer.mobile}`, startX + 3, by); }

  if (opts.show_qr && qrSvg) {
    const qrUrl = await svgToDataUrl(qrSvg, 256);
    doc.addImage(qrUrl, "PNG", startX + CARD_W - 28, backY + 12, 24, 24);
    doc.setFontSize(5); doc.setTextColor(120);
    doc.text("Scan to pay", startX + CARD_W - 24, backY + 39);
    doc.setTextColor(0);
  }

  return { backY };
}

export async function downloadCardPdf(
  data: CardData,
  qrSvg: SVGElement | null,
  templateId: TemplateId = "classic",
  display?: CardDisplayOptions,
) {
  const tpl = TEMPLATES[templateId] ?? TEMPLATES.classic;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont(tpl.pdfFont, "normal");
  const pageW = doc.internal.pageSize.getWidth();
  const startX = (pageW - CARD_W) / 2;
  const { backY } = await renderCard(doc, data, qrSvg, templateId, startX, display);

  doc.setFontSize(5); doc.setTextColor(160);
  doc.text(`Template: ${tpl.label}`, startX, backY + CARD_H + 4);
  doc.setTextColor(0);

  doc.save(`farmer-card-${tpl.id}-${data.farmer.farmer_code || data.farmer.member_no || "card"}.pdf`);
}

/** Render an array of cards into a single multi-page PDF. */
export async function downloadBulkCardsPdf(
  items: Array<{ data: CardData; qrSvg?: SVGElement | null }>,
  templateId: TemplateId = "classic",
  filename = "farmer-cards.pdf",
  display?: CardDisplayOptions,
) {
  const tpl = TEMPLATES[templateId] ?? TEMPLATES.classic;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont(tpl.pdfFont, "normal");
  const pageW = doc.internal.pageSize.getWidth();
  const startX = (pageW - CARD_W) / 2;

  for (let i = 0; i < items.length; i++) {
    const { data, qrSvg } = items[i];
    if (i > 0) doc.addPage();
    const { backY } = await renderCard(doc, data, qrSvg ?? null, templateId, startX, display);
    doc.setFontSize(5); doc.setTextColor(160);
    doc.text(`Template: ${tpl.label}   Card ${i + 1} / ${items.length}`, startX, backY + CARD_H + 4);
    doc.setTextColor(0);
  }

  doc.save(filename);
}
