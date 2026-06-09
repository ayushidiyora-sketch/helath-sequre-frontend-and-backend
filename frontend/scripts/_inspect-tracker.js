// Inspect the existing HealthSecure_Progress_Tracker.xlsx
const ExcelJS = require("exceljs");
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("d:/helathsecure/HealthSecure_Progress_Tracker.xlsx");
  console.log(`Workbook: ${wb.title || "(no title)"} · ${wb.worksheets.length} sheets`);
  for (const ws of wb.worksheets) {
    console.log(`\n══════════════════════════════════════════════════════`);
    console.log(`Sheet: "${ws.name}"  ·  ${ws.rowCount} rows × ${ws.columnCount} cols`);
    console.log(`══════════════════════════════════════════════════════`);
    const limit = Math.min(ws.rowCount, 30);
    for (let r = 1; r <= limit; r++) {
      const row = ws.getRow(r);
      const cells = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        const v = row.getCell(c).value;
        const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 80);
        cells.push(s);
      }
      console.log(`  R${String(r).padStart(2)}: ${cells.map((c) => c.padEnd(0)).join(" | ").slice(0, 280)}`);
    }
    if (ws.rowCount > limit) console.log(`  ... (${ws.rowCount - limit} more rows)`);
  }
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
