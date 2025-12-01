export type CsvRow = Record<string, string>;

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export function buildCsvTableData(csv: string): {
  columns: import("@tanstack/react-table").ColumnDef<CsvRow>[];
  data: CsvRow[];
} {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { columns: [], data: [] };
  }

  const headerValues = parseCsvLine(lines[0]);
  const headers = headerValues.map((header, index) => {
    const trimmed = header.trim();
    if (trimmed.length === 0) {
      return `Column ${index + 1}`;
    }
    return trimmed;
  });

  const data: CsvRow[] = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });

  const columns: import("@tanstack/react-table").ColumnDef<CsvRow>[] = headers.map(
    (header) => ({
      accessorKey: header,
      header,
    }),
  );

  return { columns, data };
}


