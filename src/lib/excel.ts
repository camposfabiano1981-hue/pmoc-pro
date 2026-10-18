import { downloadBlob, downloadText, toCsv } from './format';

export type Cell = string | number | null | undefined;

/** Exporta planilha .xlsx (ExcelJS carregado sob demanda). */
export async function exportXlsx(sheets: { name: string; headers: string[]; rows: Cell[][] }[], filename: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PMOC Pro';
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
    ws.addRow(s.headers);
    s.rows.forEach((r) => ws.addRow(r.map((c) => (c === undefined ? null : c))));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.headers.length } };
    s.headers.forEach((h, i) => {
      const max = Math.max(h.length, ...s.rows.slice(0, 300).map((r) => String(r[i] ?? '').length));
      ws.getColumn(i + 1).width = Math.min(Math.max(10, max + 2), 60);
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

export function exportCsv(headers: string[], rows: Cell[][], filename: string): void {
  downloadText(toCsv([headers, ...rows]), filename, 'text/csv;charset=utf-8');
}

/** Lê todas as abas de um .xlsx como matriz de valores (fórmulas → resultado em cache). */
export async function readXlsx(file: File): Promise<{ name: string; rows: Cell[][] }[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const out: { name: string; rows: Cell[][] }[] = [];
  wb.eachSheet((ws) => {
    const rows: Cell[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const vals: Cell[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        let v: unknown = cell.value;
        if (v && typeof v === 'object') {
          const o = v as { result?: unknown; text?: string; richText?: { text: string }[]; hyperlink?: string };
          if ('result' in o) v = o.result;
          else if (o.richText) v = o.richText.map((t) => t.text).join('');
          else if (o.text) v = o.text;
          else if (v instanceof Date) v = v.toISOString().slice(0, 10);
          else v = String(v);
        }
        vals[col - 1] = (v as Cell) ?? null;
      });
      rows[rowNumber - 1] = vals;
    });
    out.push({ name: ws.name, rows: Array.from(rows, (r) => r || []) });
  });
  return out;
}
