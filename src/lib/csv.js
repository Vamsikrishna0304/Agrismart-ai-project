/**
 * Shared CSV download used by the app's export buttons.
 *
 * Every cell is quoted and inner quotes are doubled, so a value containing a
 * comma, a quote or a newline (farm names, notes) cannot shift the columns when
 * the file is opened in Excel, Numbers or Google Sheets. A byte-order mark is
 * written first so non-English names (for example Telugu) stay readable.
 */
function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows].map((cells) => cells.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}