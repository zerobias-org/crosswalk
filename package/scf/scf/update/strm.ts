// Reads one SCF STRM workbook (scf-strm-<focal document>.xlsx from the SCF Council's Excel
// STRM bundle) into rows. The bundle is not uniform — learned on 2026.3:
//   - the FD→SCF table is the FIRST sheet with an `FDE#` header, not the last: 11 files
//     carry extra tabs (SCF→FD, AOs, ERL) after it;
//   - headers vary: `FDE#` / `FDE #` / `CMMC FDE#`, newlines vs spaces, typos ("Legecy"),
//     a stray `▪`, and "(optional)" / framework-specific suffixes.
import ExcelJS from 'exceljs';

export interface StrmRow {
  fde: string;
  relationship: string;
  scf: string;
  strength: string;
  legacyScf: string;
  notes: string;
}

export interface StrmSheet {
  sheet: string;
  scfVersion: string;   // from the "Reference Document" cell, e.g. 2026.3
  focalDocument: string;
  rows: StrmRow[];
}

const COLUMNS: Record<keyof StrmRow, string> = {
  fde: 'FDE #',
  relationship: 'STRM Relationship',
  scf: 'SCF #',
  strength: 'Strength of Relationship',
  legacyScf: 'Legacy SCF #',
  notes: 'Notes'
};

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map(t => t.text).join('').trim();
    if ('result' in value) return text(value.result as ExcelJS.CellValue);
    if ('text' in value) return String(value.text).trim();
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

function header(h: string): string {
  return h.replace(/\s+/g, ' ').replace(/▪/g, '').replace('Legecy', 'Legacy').replace(/^(\w+ )?FDE ?#$/, 'FDE #').trim();
}

export async function readStrm(file: string): Promise<StrmSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  for (const ws of wb.worksheets) {
    let scfVersion = '';
    let focalDocument = '';
    let headerRow = -1;
    let cols: Partial<Record<keyof StrmRow, number>> = {};

    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const cells = Array.from(ws.getRow(r).values as ExcelJS.CellValue[], text);
      const labelled = (label: string) => {
        const i = cells.findIndex(c => c.startsWith(label));
        return i >= 0 ? cells.slice(i + 1).find(c => c) ?? '' : '';
      };
      if (!scfVersion) scfVersion = /version (\d{4}\.\d+(?:\.\d+)?)/.exec(labelled('Reference Document'))?.[1] ?? '';
      if (!focalDocument) focalDocument = labelled('Focal Document:');

      const hs = cells.map(header);
      if (hs.includes('FDE #') && hs.includes('SCF #')) {
        headerRow = r;
        cols = {};
        for (const [key, name] of Object.entries(COLUMNS) as [keyof StrmRow, string][]) {
          const i = hs.findIndex(h => h === name || h.startsWith(name));
          if (i >= 0) cols[key] = i;
        }
        break;
      }
    }
    if (headerRow < 0) continue;

    for (const key of ['fde', 'relationship', 'scf', 'strength'] as const) {
      if (cols[key] === undefined) throw new Error(`${file} [${ws.name}]: no "${COLUMNS[key]}" column`);
    }

    const rows: StrmRow[] = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const cells = Array.from(ws.getRow(r).values as ExcelJS.CellValue[], text);
      const get = (k: keyof StrmRow) => (cols[k] === undefined ? '' : cells[cols[k]!] ?? '').replace(/\s+/g, ' ').trim();
      const row: StrmRow = {
        fde: get('fde'), relationship: get('relationship'), scf: get('scf'),
        strength: get('strength'), legacyScf: get('legacyScf'), notes: get('notes')
      };
      if (row.fde || row.scf || row.relationship) rows.push(row);
    }
    return { sheet: ws.name, scfVersion, focalDocument, rows };
  }
  throw new Error(`${file}: no sheet with an FDE# / SCF # header`);
}
