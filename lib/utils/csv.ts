/**
 * Parse Google Sheets CSV export format
 * Handles quoted fields, commas within fields, and newlines
 */
export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.trim().split('\n');

  for (const line of lines) {
    const cols: string[] = [];
    let current = '';
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
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    rows.push(cols);
  }

  return rows;
}

/**
 * Convert CSV rows to array of objects using first row as headers
 */
export function csvToObjects(csvText: string): Record<string, string>[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}
