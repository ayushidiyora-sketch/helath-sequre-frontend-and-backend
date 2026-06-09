// Refresh HealthSecure_Progress_Tracker.xlsx with today's percentages.
// Edits the file in place — preserves formatting, formulas, sheet structure.
// Self-deletes after the write.
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const FILE = "d:/helathsecure/HealthSecure_Progress_Tracker.xlsx";
const TODAY = "2026-06-05";

// (row, frontend %, backend %) — keep row indices matching the existing sheet.
const UPDATES = [
  [5, "Authentication & Onboarding", 100, 90],
  [6, "Patient Dashboard & Portal", 100, 90],
  [7, "Medical Records Management", 100, 80],
  [8, "Appointment Management", 100, 98],
  [9, "Secure Document Management", 95, 60],
  [10, "Consent Management", 100, 90],
  [11, "Secure Messaging", 100, 80],
  [12, "Clinician Workspace", 90, 75],
  [13, "Organization Admin Console", 90, 75],
  [14, "Compliance & Audit", 100, 95],
  [15, "Auditor (read-only)", 95, 90],
  [16, "Super Admin & Platform", 95, 92],
  [17, "Reports & Analytics", 80, 75],
  [18, "Notification System", 100, 70],
  [19, "Audit Logging Engine", 70, 50],
  [20, "Security & Compliance Controls", 60, 40],
  [21, "Integrations (Email/S3/SMS/Virus)", 80, 25],
  [22, "Data Retention & Backup", 95, 80],
];

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);

  // ─── Sheet "Progress" ─────────────────────────────────────────────────
  const ws = wb.getWorksheet("Progress");
  if (!ws) throw new Error("Sheet 'Progress' not found");

  // R2 — refresh the snapshot subtitle (preserve whatever style it already has)
  const subtitle = ws.getCell(2, 1);
  subtitle.value = `Snapshot ${TODAY}  ·  branch ayushi  ·  Frontend vs Backend completion by module`;

  // R5..R22 — update FE / BE; leave D-column AVERAGE formula intact
  let updated = 0;
  for (const [row, name, fe, be] of UPDATES) {
    const actualName = String(ws.getCell(row, 1).value ?? "").trim();
    if (actualName !== name) {
      console.warn(
        `  ! R${row}: expected "${name}" but found "${actualName}" — updating numeric cells anyway`,
      );
    }
    ws.getCell(row, 2).value = fe;
    ws.getCell(row, 3).value = be;
    updated++;
  }
  console.log(`Updated ${updated} module rows on "Progress"`);

  // ─── Sheet "Daily Trend" ──────────────────────────────────────────────
  const trend = wb.getWorksheet("Daily Trend");
  if (!trend) throw new Error("Sheet 'Daily Trend' not found");

  // Find the next free row after R4 (the header). Append a new dated row.
  // Don't overwrite the existing 2026-06-04 history row at R5.
  let nextRow = 5;
  while (trend.getCell(nextRow, 1).value != null && String(trend.getCell(nextRow, 1).value).trim() !== "") {
    nextRow++;
    if (nextRow > 100) break; // safety
  }
  // Compute roll-up from the new per-module values
  const feSum = UPDATES.reduce((s, [, , f]) => s + f, 0);
  const beSum = UPDATES.reduce((s, [, , , b]) => s + b, 0);
  const feAvg = Math.round(feSum / UPDATES.length);
  const beAvg = Math.round(beSum / UPDATES.length);
  const overall = Math.round((feAvg + beAvg) / 2);

  trend.getCell(nextRow, 1).value = TODAY;
  trend.getCell(nextRow, 2).value = feAvg;
  trend.getCell(nextRow, 3).value = beAvg;
  trend.getCell(nextRow, 4).value = overall;
  console.log(
    `Appended Daily Trend row at R${nextRow}: ${TODAY} · FE ${feAvg} · BE ${beAvg} · Overall ${overall}`,
  );

  await wb.xlsx.writeFile(FILE);
  const size = fs.statSync(FILE).size;
  console.log(`OK: updated ${FILE}  (${(size / 1024).toFixed(1)} KB)`);

  // Also clean up the leftover inspector script if it's still around.
  const inspector = path.join(__dirname, "_inspect-tracker.js");
  try {
    fs.unlinkSync(inspector);
    console.log("OK: removed inspector script");
  } catch {
    /* not present — nothing to clean */
  }

  // Self-delete this updater script
  try {
    fs.unlinkSync(__filename);
    console.log("OK: removed updater script");
  } catch (e) {
    console.warn("(could not remove updater script — delete manually)", e.message);
  }
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
