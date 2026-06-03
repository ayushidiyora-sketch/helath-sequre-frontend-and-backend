/**
 * Anomaly signatures contain colons and ISO timestamps (e.g.
 * `bulkUpload:35de4e2b-…:2026-06-03T16:40:00.000Z`), which break URL
 * parsing because every `:` becomes `%3A` and ends up getting double-decoded
 * by Next.js + our own `decodeURIComponent`. Encode/decode via Base64URL so
 * the URL segment is opaque, stable across the network, and round-trippable.
 */

export function encodeSig(signature: string): string {
  return Buffer.from(signature, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeSig(encoded: string): string {
  const pad = encoded.length % 4 === 0 ? "" : "=".repeat(4 - (encoded.length % 4));
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + pad;
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return encoded;
  }
}

/**
 * Browser-safe variants for use in client components — `Buffer` isn't
 * available in the browser bundle, so fall back to `atob`/`btoa`.
 */
export function encodeSigBrowser(signature: string): string {
  if (typeof window === "undefined") return encodeSig(signature);
  const utf8 = unescape(encodeURIComponent(signature));
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSigBrowser(encoded: string): string {
  if (typeof window === "undefined") return decodeSig(encoded);
  const pad = encoded.length % 4 === 0 ? "" : "=".repeat(4 - (encoded.length % 4));
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + pad;
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return encoded;
  }
}
