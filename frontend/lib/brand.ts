/**
 * Shared brand assets — used by email templates, PDF generators, and the
 * Excel report exports so they all render the same HealthSecure mark + the
 * same teal palette as the in-app sidebar Logo.
 *
 * The SVG mirrors the inline SVG in `components/shared/logo.tsx` (shield +
 * cross). For PDFs / Excel we draw the same shape using the renderer's
 * native primitives — keeps the dependency surface small and the output
 * pixel-perfect at any zoom level. For HTML emails we inline the SVG
 * directly (every modern mail client renders inline SVG, including Gmail,
 * Outlook web, Apple Mail).
 */

import type { jsPDF } from "jspdf";

export const BRAND_NAME = "HealthSecure";
export const BRAND_TAGLINE = "Portal";
/** Hex string matching the sidebar gradient mid-stop. */
export const BRAND_TEAL = "#0F5B66";
/** Slightly darker teal for accents / subtitle band. */
export const BRAND_TEAL_DARK = "#115E59";
/** Light teal used for the sidebar gradient start. */
export const BRAND_TEAL_LIGHT = "#5FA6AD";

/**
 * Inline SVG of the brand mark — teal shield with a white cross. Drop into
 * any HTML email body. Width / height controlled by the wrapping element.
 */
export const BRAND_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" role="img" aria-label="HealthSecure">
  <defs>
    <linearGradient id="hsg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5FA6AD"/>
      <stop offset="100%" stop-color="#0F5B66"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" rx="10" fill="url(#hsg)"/>
  <g fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 32s8-4 8-10V11l-8-3-8 3v11c0 6 8 10 8 10z"/>
    <path d="M16 19h8"/>
    <path d="M20 15v8"/>
  </g>
</svg>`.trim();

/**
 * Draw the HealthSecure brand mark + wordmark on a jsPDF document. Renders
 * a 28×28 rounded white badge with a stroked teal shield + cross, followed
 * by the bold "HealthSecure" wordmark and the "Portal" tagline beneath it.
 *
 * Returns the x-coordinate where the wordmark ends — callers can use it to
 * place the "Generated at" timestamp on the same row without overlapping.
 *
 * @param doc        active jsPDF instance (assumed to already have the
 *                   teal header band drawn behind these coordinates).
 * @param x          left edge of the badge in pt.
 * @param y          top edge of the badge in pt.
 * @param onTeal     pass true when the surface behind the logo is teal
 *                   (e.g. the report PDF header band) — the badge becomes
 *                   white-on-teal with teal shield strokes. Pass false on
 *                   plain white surfaces — the badge becomes teal-on-white.
 */
export function drawPdfBrandHeader(
  doc: jsPDF,
  x: number,
  y: number,
  onTeal = true,
): number {
  const size = 28;

  // Badge background.
  doc.setFillColor(onTeal ? 255 : 0x0f, onTeal ? 255 : 0x5b, onTeal ? 255 : 0x66);
  doc.roundedRect(x, y, size, size, 6, 6, "F");

  // Shield path — approximated with two triangles + a base curve. Drawn
  // small enough that the polyline approximation is invisible at print
  // size. Coordinates relative to the badge top-left.
  const strokeR = onTeal ? 0x0f : 255;
  const strokeG = onTeal ? 0x5b : 255;
  const strokeB = onTeal ? 0x66 : 255;
  doc.setDrawColor(strokeR, strokeG, strokeB);
  doc.setLineWidth(1.6);

  const cx = x + size / 2;
  const top = y + 6;
  const left = x + 7;
  const right = x + size - 7;
  const bottom = y + size - 4;
  const midY = y + size / 2 + 2;

  // Shield outline (rough — top fan + side curves down to a point).
  doc.lines(
    [
      [right - cx, 2],         // top to upper-right
      [0, midY - top - 2],     // right side down
      [cx - right, bottom - midY], // curve in to bottom point
      [left - cx, midY - bottom],  // curve out to lower-left
      [0, -(midY - top - 2)],  // left side up
      [right - left, 0],       // close
    ],
    cx + (left - cx), top,
    [1, 1],
    "S",
    true,
  );

  // White cross inside the shield.
  doc.setDrawColor(onTeal ? 0x0f : 255, onTeal ? 0x5b : 255, onTeal ? 0x66 : 255);
  doc.setLineWidth(1.8);
  doc.line(cx - 4, midY - 2, cx + 4, midY - 2); // horizontal
  doc.line(cx, midY - 6, cx, midY + 2);          // vertical

  // Wordmark.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  if (onTeal) doc.setTextColor(255, 255, 255);
  else doc.setTextColor(15, 91, 102);
  const wordX = x + size + 10;
  doc.text(BRAND_NAME, wordX, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(onTeal ? 230 : 120, onTeal ? 230 : 130, onTeal ? 230 : 140);
  doc.text(BRAND_TAGLINE.toUpperCase(), wordX, y + 24);

  return wordX + doc.getTextWidth(BRAND_NAME);
}

/**
 * Returns a small HTML snippet for use inside an email header band — the
 * brand mark next to the wordmark, both white-on-teal so it sits cleanly
 * on the existing `#0f5b66` band the templates already use.
 */
export function emailBrandHeader(): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse">
      <tr>
        <td style="vertical-align:middle;padding-right:10px;line-height:0">
          ${BRAND_LOGO_SVG}
        </td>
        <td style="vertical-align:middle;color:#ffffff;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
          <div style="font-size:15px;font-weight:700;letter-spacing:0.2px;line-height:1">${BRAND_NAME}</div>
          <div style="font-size:9px;font-weight:600;letter-spacing:0.18em;color:#cbe7ea;margin-top:3px;line-height:1">${BRAND_TAGLINE.toUpperCase()}</div>
        </td>
      </tr>
    </table>`.trim();
}
