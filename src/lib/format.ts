export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const money = (v?: number | null) => brl.format(Number(v) || 0);
export const n2 = (v?: number | null) => num.format(Number(v) || 0);

/** Converte 'YYYY-MM-DD' ou ISO em Date local sem deslocamento de fuso. */
export function toDate(s?: string | null): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(s?: string | null): string {
  const d = toDate(s);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

export function fmtDateTime(s?: string | null): string {
  const d = toDate(s);
  return d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

const pad = (n: number) => String(n).padStart(2, '0');

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Valor para <input type="datetime-local"> */
export function localDateTimeStr(d = new Date()): string {
  return `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(s: string, days: number): string {
  const d = toDate(s) || new Date();
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

export function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600_000);
}

export function diffDays(a?: string | null, b?: string | null): number | null {
  const da = toDate(a);
  const dbb = toDate(b);
  if (!da || !dbb) return null;
  return Math.round((da.getTime() - dbb.getTime()) / 86400_000);
}

export function diffHours(a?: string | null, b?: string | null): number | null {
  const da = toDate(a);
  const dbb = toDate(b);
  if (!da || !dbb) return null;
  return (da.getTime() - dbb.getTime()) / 3600_000;
}

export function ym(d: Date | string): string {
  const x = typeof d === 'string' ? toDate(d) : d;
  if (!x) return '';
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`;
}

export function fmtHoras(h: number): string {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}h${pad(total % 60)}`;
}

export const btuToTr = (btu?: number) => (Number(btu) || 0) / 12000;
export const fmtBtu = (btu?: number) => (btu ? `${num.format(btu)} BTU/h` : '—');
export const fmtTr = (btu?: number) => `${num.format(Math.round(btuToTr(btu) * 100) / 100)} TR`;

export function onlyDigits(s?: string): string {
  return (s || '').replace(/\D/g, '');
}

export function maskCpfCnpj(v?: string): string {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

export function validaCpf(v: string): boolean {
  const c = onlyDigits(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(c[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10) r = 0;
  if (r !== Number(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += Number(c[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10) r = 0;
  return r === Number(c[10]);
}

export function validaCnpj(v: string): boolean {
  const c = onlyDigits(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(c[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function validaDoc(v?: string): boolean | null {
  const d = onlyDigits(v);
  if (!d) return null;
  if (d.length === 11) return validaCpf(d);
  if (d.length === 14) return validaCnpj(d);
  return false;
}

export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ";" como separador para abrir corretamente no Excel em pt-BR; BOM para acentuação
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
}

/** Lê imagem, redimensiona e comprime para JPEG (economiza espaço no navegador). */
export function compressImage(file: File, maxSize = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(String(reader.result));
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((acc, x) => acc + (Number(f(x)) || 0), 0);
}

export function groupBy<T>(arr: T[], f: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of arr) (out[f(x)] ||= []).push(x);
  return out;
}

export function parseNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return isFinite(v) ? v : undefined;
  const s = String(v).trim().replace(/\s/g, '');
  const m = s.match(/^(-?[\d.,]+)\s*(k)?/i);
  if (!m) return undefined;
  let numStr = m[1];
  if (numStr.includes(',') && numStr.includes('.')) numStr = numStr.replace(/\./g, '').replace(',', '.');
  else if (numStr.includes(',')) numStr = numStr.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(numStr)) numStr = numStr.replace(/\./g, '');
  const n = Number(numStr);
  if (!isFinite(n)) return undefined;
  return m[2] ? n * 1000 : n;
}
