/**
 * Client-side document scanner — best-effort substitute for ClamAV in dev.
 * Inspects up to the first 256 KB of a file to decide whether it should be
 * accepted, flagged as suspicious, or refused outright. Used by the patient
 * document upload flow before the file ever lands in the vault.
 *
 * Checks (any one that fires returns `infected`):
 *
 *   1. Filename extension is in a dangerous list (.exe, .bat, .ps1, etc.).
 *   2. File body contains the canonical EICAR antivirus test signature.
 *   3. File magic bytes do NOT match the declared extension (e.g. a `.pdf`
 *      whose first bytes are MZ → Windows executable in a pdf wrapper).
 *   4. PDF contains `/JavaScript` or `/OpenAction` / `/Launch` tags
 *      (real ClamAV's `Pdf.Exploit.*` family flags these too).
 */

export type ScanStatus = "clean" | "infected";

export interface ScanResult {
  status: ScanStatus;
  /** When `infected`, a short user-facing explanation; absent when `clean`. */
  reason?: string;
}

const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "scr", "msi", "ps1", "vbs", "vbe", "jse",
  "wsf", "wsh", "hta", "jar", "sh", "py", "pl", "rb", "lnk",
]);

// Standard EICAR test string per https://www.eicar.org/. Antivirus engines
// are required to flag any file containing this exact string as infected —
// it's the universal "is your AV working" test.
const EICAR_SIGNATURE =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

const SUSPICIOUS_PDF_TAGS = ["/JavaScript", "/JS ", "/OpenAction", "/Launch", "/EmbeddedFile"];

const MAX_BYTES_TO_INSPECT = 256 * 1024; // 256 KB — enough for header + signature scan

interface MagicSig {
  /** Hex string the file's first bytes must match (lowercase, no spaces). */
  prefix: string;
  /** Allowed extensions for this signature. */
  extensions: string[];
}

const MAGIC_SIGNATURES: MagicSig[] = [
  { prefix: "25504446",         extensions: ["pdf"] },                    // %PDF
  { prefix: "89504e470d0a1a0a", extensions: ["png"] },                    // PNG
  { prefix: "ffd8ff",           extensions: ["jpg", "jpeg"] },            // JPEG (any variant)
  { prefix: "47494638",         extensions: ["gif"] },                    // GIF8 (7a / 9a)
  { prefix: "504b0304",         extensions: ["zip", "docx", "xlsx", "pptx", "odt"] }, // ZIP container
  { prefix: "d0cf11e0a1b11ae1", extensions: ["doc", "xls", "ppt", "msg"] }, // Legacy OLE/CFB
  { prefix: "49492a00",         extensions: ["tiff", "tif"] },            // TIFF (little-endian)
  { prefix: "4d4d002a",         extensions: ["tiff", "tif"] },            // TIFF (big-endian)
  { prefix: "424d",             extensions: ["bmp"] },                    // BMP
];

function bytesToHex(bytes: Uint8Array, len: number): string {
  let out = "";
  const max = Math.min(len, bytes.length);
  for (let i = 0; i < max; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function decodeUtf8Lossy(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i < 0 ? "" : filename.slice(i + 1).toLowerCase();
}

/**
 * Read the first `MAX_BYTES_TO_INSPECT` bytes of a File as a Uint8Array.
 * Returns an empty array on any read failure — the caller treats that as
 * "could not inspect, refuse to be safe".
 */
async function readHead(file: File): Promise<Uint8Array> {
  const slice = file.slice(0, MAX_BYTES_TO_INSPECT);
  try {
    const buf = await slice.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return new Uint8Array(0);
  }
}

export async function scanFile(file: File): Promise<ScanResult> {
  const ext = extensionOf(file.name);

  // 1. Dangerous extension — refuse without even reading the bytes.
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      status: "infected",
      reason: `.${ext} files are not allowed (executable / scriptable).`,
    };
  }

  // Empty file.
  if (file.size === 0) {
    return { status: "infected", reason: "Empty file — nothing to scan." };
  }

  const head = await readHead(file);
  if (head.length === 0) {
    return { status: "infected", reason: "Could not read file for scanning." };
  }

  const hex = bytesToHex(head, 16);
  const text = decodeUtf8Lossy(head);

  // 2. EICAR test signature anywhere in the inspected window.
  if (text.includes(EICAR_SIGNATURE)) {
    return { status: "infected", reason: "EICAR antivirus test signature detected." };
  }

  // 3. Extension/magic-byte mismatch — only enforced when we have a known
  // signature for the declared extension. Files with no signature in our
  // catalog (e.g. plain .txt, .csv, .json) skip this check.
  const expected = MAGIC_SIGNATURES.find((s) => s.extensions.includes(ext));
  if (expected) {
    const matches = hex.startsWith(expected.prefix);
    if (!matches) {
      return {
        status: "infected",
        reason: `File header doesn't match a real .${ext} — possible disguised payload.`,
      };
    }
  } else if (ext) {
    // Has an extension we don't recognize — check if its header matches any
    // KNOWN signature for a different type (e.g. a .jpg that's actually an
    // EXE: starts with `MZ` = `4d5a`). If so, refuse.
    if (hex.startsWith("4d5a")) {
      return { status: "infected", reason: "File appears to be a Windows executable." };
    }
    if (hex.startsWith("7f454c46")) {
      return { status: "infected", reason: "File appears to be a Linux executable (ELF)." };
    }
  }

  // 4. PDF with suspicious tags.
  if (ext === "pdf") {
    for (const tag of SUSPICIOUS_PDF_TAGS) {
      if (text.includes(tag)) {
        return {
          status: "infected",
          reason: `PDF contains suspicious tag ${tag.trim()} (active content / embedded payload).`,
        };
      }
    }
  }

  return { status: "clean" };
}
