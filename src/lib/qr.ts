// QR helpers. The label QR encodes an absolute trace URL so a phone camera can
// open the public "carbon passport" page directly.

import QRCode from "qrcode";

// Build the path a batch's QR should point at.
export function tracePath(batchId: string): string {
  return `/trace/${batchId}`;
}

// Absolute URL for the QR payload. Falls back to localhost for local demos.
export function traceUrl(batchId: string, origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${tracePath(batchId)}`;
}

// Render any string to an inline SVG string (served by /api/qr).
export async function qrSvg(data: string): Promise<string> {
  return QRCode.toString(data, {
    type: "svg",
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });
}
