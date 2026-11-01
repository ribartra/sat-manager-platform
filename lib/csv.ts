/**
 * RFC 4180-style CSV → rows keyed by the header (quotes, "" escapes, CRLF, multi-line quoted fields).
 * Fields are trimmed and a UTF-8 BOM is ignored. Shared by the bulk importer and "Import with AI".
 */
export function parseCsv(input: string): Record<string, string>[] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (quoted && next === "\"") {
        field += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);

  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];
  const headers = headerRow.map((header) => header.trim());
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

/** Rows → CSV text (every field quoted, "" escapes), the format the parser above reads back. */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n") + "\r\n";
}
