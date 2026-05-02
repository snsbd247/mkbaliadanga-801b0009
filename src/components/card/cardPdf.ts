import { jsPDF } from "jspdf";
import type { CardData } from "./MembershipCard";
import { TEMPLATES, type TemplateId } from "./templates";

const CARD_W = 85.6; // mm
const CARD_H = 54;

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

export async function downloadCardPdf(
  data: CardData,
  qrSvg: SVGElement | null,
  templateId: TemplateId = "classic",
) {
  const tpl = TEMPLATES[templateId] ?? TEMPLATES.classic;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont(tpl.pdfFont, "normal");
  const pageW = doc.internal.pageSize.getWidth();
  const startX = (pageW - CARD_W) / 2;
  const frontY = 20;
  const backY = frontY + CARD_H + 8;

  // FRONT card outline
  doc.setDrawColor(...tpl.borderRgb); doc.roundedRect(startX, frontY, CARD_W, CARD_H, 2, 2, "S");

  // Header bar
  doc.setFillColor(...tpl.headerRgb);
  doc.rect(startX, frontY, CARD_W, 8, "F");
  doc.setTextColor(...tpl.headerTextRgb);
  doc.setFontSize(9); doc.setFont(tpl.pdfFont, "bold");
  const titleSrc = tpl.bnFirst
    ? (data.company_name_bn || data.company_name)
    : data.company_name;
  doc.text(String(titleSrc).slice(0, 36), startX + 3, frontY + 5.5);
  doc.setTextColor(0);

  // Photo
  if (data.farmer.photo_url) {
    const pUrl = await imgToDataUrl(data.farmer.photo_url);
    if (pUrl) doc.addImage(pUrl, "JPEG", startX + 3, frontY + 11, 18, 24);
  } else {
    doc.setDrawColor(...tpl.borderRgb); doc.rect(startX + 3, frontY + 11, 18, 24);
  }

  doc.setFontSize(10); doc.setFont(tpl.pdfFont, "bold");
  doc.text(String(data.farmer.name).slice(0, 28), startX + 24, frontY + 16);
  doc.setFontSize(7); doc.setFont(tpl.pdfFont, "normal");
  let y = frontY + 21;
  if (data.farmer.farmer_code) { doc.text(`ID: ${data.farmer.farmer_code}`, startX + 24, y); y += 4; }
  if (data.farmer.member_no)  { doc.text(`Member: ${data.farmer.member_no}`, startX + 24, y); y += 4; }
  doc.text(`Issued: ${new Date(data.issued_at).toLocaleDateString()}`, startX + 24, y);

  // BACK
  doc.setDrawColor(...tpl.borderRgb); doc.roundedRect(startX, backY, CARD_W, CARD_H, 2, 2, "S");
  doc.setFontSize(8); doc.setFont(tpl.pdfFont, "bold");
  doc.text("Contact", startX + 3, backY + 5);
  doc.setFontSize(7); doc.setFont(tpl.pdfFont, "normal");
  let by = backY + 10;
  if (data.farmer.village) { doc.text(`Village: ${data.farmer.village}`, startX + 3, by); by += 4; }
  if (data.farmer.address) {
    const lines = doc.splitTextToSize(`Address: ${data.farmer.address}`, 50);
    doc.text(lines.slice(0, 3), startX + 3, by); by += Math.min(3, lines.length) * 4;
  }
  if (data.farmer.mobile) { doc.text(`Mobile: ${data.farmer.mobile}`, startX + 3, by); }

  if (qrSvg) {
    const qrUrl = await svgToDataUrl(qrSvg, 256);
    doc.addImage(qrUrl, "PNG", startX + CARD_W - 28, backY + 12, 24, 24);
    doc.setFontSize(5); doc.setTextColor(120);
    doc.text("Scan to pay", startX + CARD_W - 24, backY + 39);
    doc.setTextColor(0);
  }

  // Footer with template label (helps audit which design was issued)
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
) {
  const tpl = TEMPLATES[templateId] ?? TEMPLATES.classic;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont(tpl.pdfFont, "normal");
  const pageW = doc.internal.pageSize.getWidth();
  const startX = (pageW - CARD_W) / 2;

  for (let i = 0; i < items.length; i++) {
    const { data, qrSvg } = items[i];
    if (i > 0) doc.addPage();
    const frontY = 20;
    const backY = frontY + CARD_H + 8;

    doc.setDrawColor(...tpl.borderRgb); doc.roundedRect(startX, frontY, CARD_W, CARD_H, 2, 2, "S");
    doc.setFillColor(...tpl.headerRgb);
    doc.rect(startX, frontY, CARD_W, 8, "F");
    doc.setTextColor(...tpl.headerTextRgb);
    doc.setFontSize(9); doc.setFont(tpl.pdfFont, "bold");
    const titleSrc = tpl.bnFirst
      ? (data.company_name_bn || data.company_name)
      : data.company_name;
    doc.text(String(titleSrc).slice(0, 36), startX + 3, frontY + 5.5);
    doc.setTextColor(0);

    if (data.farmer.photo_url) {
      const pUrl = await imgToDataUrl(data.farmer.photo_url);
      if (pUrl) doc.addImage(pUrl, "JPEG", startX + 3, frontY + 11, 18, 24);
      else { doc.setDrawColor(...tpl.borderRgb); doc.rect(startX + 3, frontY + 11, 18, 24); }
    } else {
      doc.setDrawColor(...tpl.borderRgb); doc.rect(startX + 3, frontY + 11, 18, 24);
    }

    doc.setFontSize(10); doc.setFont(tpl.pdfFont, "bold");
    doc.text(String(data.farmer.name).slice(0, 28), startX + 24, frontY + 16);
    doc.setFontSize(7); doc.setFont(tpl.pdfFont, "normal");
    let y = frontY + 21;
    if (data.farmer.farmer_code) { doc.text(`ID: ${data.farmer.farmer_code}`, startX + 24, y); y += 4; }
    if (data.farmer.member_no)  { doc.text(`Member: ${data.farmer.member_no}`, startX + 24, y); y += 4; }
    doc.text(`Issued: ${new Date(data.issued_at).toLocaleDateString()}`, startX + 24, y);

    doc.setDrawColor(...tpl.borderRgb); doc.roundedRect(startX, backY, CARD_W, CARD_H, 2, 2, "S");
    doc.setFontSize(8); doc.setFont(tpl.pdfFont, "bold");
    doc.text("Contact", startX + 3, backY + 5);
    doc.setFontSize(7); doc.setFont(tpl.pdfFont, "normal");
    let by = backY + 10;
    if (data.farmer.village) { doc.text(`Village: ${data.farmer.village}`, startX + 3, by); by += 4; }
    if (data.farmer.address) {
      const lines = doc.splitTextToSize(`Address: ${data.farmer.address}`, 50);
      doc.text(lines.slice(0, 3), startX + 3, by); by += Math.min(3, lines.length) * 4;
    }
    if (data.farmer.mobile) { doc.text(`Mobile: ${data.farmer.mobile}`, startX + 3, by); }

    if (qrSvg) {
      const qrUrl = await svgToDataUrl(qrSvg, 256);
      doc.addImage(qrUrl, "PNG", startX + CARD_W - 28, backY + 12, 24, 24);
      doc.setFontSize(5); doc.setTextColor(120);
      doc.text("Scan to pay", startX + CARD_W - 24, backY + 39);
      doc.setTextColor(0);
    }

    doc.setFontSize(5); doc.setTextColor(160);
    doc.text(`Template: ${tpl.label}   Card ${i + 1} / ${items.length}`, startX, backY + CARD_H + 4);
    doc.setTextColor(0);
  }

  doc.save(filename);
}
