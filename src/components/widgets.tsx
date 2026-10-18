import { useEffect, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Camera, Eraser, ImagePlus, Printer, Trash2 } from 'lucide-react';
import { uid } from '../db/db';
import { imprimir } from '../lib/env';
import type { Empresa, Foto, ItemPeca, ItemServico } from '../db/types';
import { compressImage, money, n2 } from '../lib/format';
import { useLookups } from '../lib/lookups';
import { Button, IconButton, Input, Select, cx, useToast } from './ui';

/* ---------------- Assinatura digital ---------------- */
export function SignaturePad({ value, onChange, label }: { value?: string; onChange: (v?: string) => void; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [editing, setEditing] = useState(!value);

  useEffect(() => {
    if (!editing) return;
    const c = ref.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * ratio;
    c.height = h * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, [editing]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  if (!editing && value)
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700">
          <img src={value} alt={label} className="h-20 flex-1 object-contain" />
          <IconButton
            title="Refazer assinatura"
            onClick={() => {
              onChange(undefined);
              setEditing(true);
            }}
          >
            <Eraser size={16} />
          </IconButton>
        </div>
      </div>
    );

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <canvas
        ref={ref}
        className="h-32 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext('2d')!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d')!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
      />
      <div className="mt-1 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const c = ref.current!;
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
          }}
        >
          Limpar
        </Button>
        <Button
          size="sm"
          onClick={() => {
            onChange(ref.current!.toDataURL('image/png'));
            setEditing(false);
          }}
        >
          Confirmar assinatura
        </Button>
      </div>
    </div>
  );
}

/* ---------------- QR Code ---------------- */
export function QRImage({ text, size = 128, className }: { text: string; size?: number; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(''));
  }, [text, size]);
  return src ? <img src={src} width={size} height={size} alt="QR Code" className={className} /> : <div style={{ width: size, height: size }} />;
}

export function appUrl(path: string): string {
  const base = window.location.href.split('#')[0];
  return `${base}#${path}`;
}

/* ---------------- Fotos ---------------- */
export function PhotoGallery({ fotos, onChange, readOnly }: { fotos: Foto[]; onChange: (f: Foto[]) => void; readOnly?: boolean }) {
  const toast = useToast();
  const [momento, setMomento] = useState<Foto['momento']>('antes');
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const novas: Foto[] = [];
    for (const f of Array.from(files)) {
      try {
        novas.push({ id: uid(), dataUrl: await compressImage(f), momento, legenda: '', data: new Date().toISOString() });
      } catch {
        toast(`Não foi possível ler ${f.name}`, 'error');
      }
    }
    onChange([...fotos, ...novas]);
  };
  return (
    <div>
      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select className="w-auto" value={momento} onChange={(e) => setMomento(e.target.value as Foto['momento'])}>
            <option value="antes">Antes</option>
            <option value="durante">Durante</option>
            <option value="depois">Depois</option>
          </Select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800">
            <Camera size={16} /> Câmera
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => add(e.target.files)} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            <ImagePlus size={16} /> Galeria
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
          </label>
        </div>
      )}
      {fotos.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma foto anexada.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f) => (
            <figure key={f.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <div className="relative">
                <img src={f.dataUrl} alt={f.legenda || 'Foto'} className="aspect-[4/3] w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">{f.momento}</span>
                {!readOnly && (
                  <button className="absolute right-1 top-1 rounded bg-white/90 p-1 text-rose-600 hover:bg-white" onClick={() => onChange(fotos.filter((x) => x.id !== f.id))} aria-label="Remover foto">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {!readOnly && (
                <input
                  className="w-full border-0 border-t border-slate-200 bg-transparent px-2 py-1 text-xs focus:outline-none dark:border-slate-700"
                  placeholder="Legenda…"
                  value={f.legenda || ''}
                  onChange={(e) => onChange(fotos.map((x) => (x.id === f.id ? { ...x, legenda: e.target.value } : x)))}
                />
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Itens: peças e serviços ---------------- */
export function totais(pecas: ItemPeca[], servicos: ItemServico[], deslocamento = 0, desconto = 0) {
  const tp = pecas.reduce((a, p) => a + (p.quantidade || 0) * (p.precoUnit || 0), 0);
  const ts = servicos.reduce((a, s) => a + (s.quantidade || 0) * (s.precoUnit || 0), 0);
  const custoPecas = pecas.reduce((a, p) => a + (p.quantidade || 0) * (p.custoUnit || 0), 0);
  const total = tp + ts + (deslocamento || 0) - (desconto || 0);
  return { pecas: tp, servicos: ts, custoPecas, total };
}

export function PecasEditor({ itens, onChange, readOnly, extra, ocultarPrecos }: { itens: ItemPeca[]; onChange: (i: ItemPeca[]) => void; readOnly?: boolean; extra?: (item: ItemPeca, i: number) => ReactNode; ocultarPrecos?: boolean }) {
  const { pecas, pecaMap } = useLookups();
  const [sel, setSel] = useState('');
  const upd = (i: number, patch: Partial<ItemPeca>) => onChange(itens.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const addPeca = (id: string) => {
    const p = pecaMap.get(id);
    if (!p) return;
    onChange([...itens, { pecaId: p.id, descricao: p.descricao, unidade: p.unidade, quantidade: 1, custoUnit: p.custo, precoUnit: p.precoVenda }]);
    setSel('');
  };
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1 pr-2">Peça / material</th>
              <th className="w-20 py-1 pr-2">Qtd</th>
              {!ocultarPrecos && <th className="w-28 py-1 pr-2">Preço un.</th>}
              {!ocultarPrecos && <th className="w-28 py-1 pr-2 text-right">Subtotal</th>}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => {
              const p = it.pecaId ? pecaMap.get(it.pecaId) : undefined;
              return (
                <tr key={i} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="py-1.5 pr-2">
                    {readOnly ? it.descricao : <Input value={it.descricao} onChange={(e) => upd(i, { descricao: e.target.value })} />}
                    {p && (
                      <p className={cx('mt-0.5 text-[11px]', (p.estoque || 0) < it.quantidade && !it.baixado ? 'text-rose-600' : 'text-slate-500')}>
                        {p.codigo} · estoque {n2(p.estoque)} {p.unidade}
                        {it.baixado && ' · baixado'}
                      </p>
                    )}
                    {extra?.(it, i)}
                  </td>
                  <td className="py-1.5 pr-2">{readOnly ? n2(it.quantidade) : <Input type="number" step="any" value={it.quantidade} disabled={it.baixado} onChange={(e) => upd(i, { quantidade: Number(e.target.value) })} />}</td>
                  {!ocultarPrecos && <td className="py-1.5 pr-2">{readOnly ? money(it.precoUnit) : <Input type="number" step="0.01" value={it.precoUnit} onChange={(e) => upd(i, { precoUnit: Number(e.target.value) })} />}</td>}
                  {!ocultarPrecos && <td className="py-1.5 pr-2 text-right tabular-nums">{money(it.quantidade * it.precoUnit)}</td>}
                  <td>
                    {!readOnly && !it.baixado && (
                      <IconButton title="Remover" onClick={() => onChange(itens.filter((_, k) => k !== i))}>
                        <Trash2 size={15} />
                      </IconButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Select className="min-w-[220px] flex-1" value={sel} onChange={(e) => addPeca(e.target.value)}>
            <option value="">+ Adicionar peça do estoque…</option>
            {pecas
              .filter((p) => p.ativo !== false)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.descricao} ({n2(p.estoque)} {p.unidade})
                </option>
              ))}
          </Select>
          <Button variant="outline" onClick={() => onChange([...itens, { descricao: '', quantidade: 1, custoUnit: 0, precoUnit: 0, unidade: 'un' }])}>
            + Item avulso
          </Button>
        </div>
      )}
    </div>
  );
}

export function ServicosEditor({ itens, onChange, readOnly }: { itens: ItemServico[]; onChange: (i: ItemServico[]) => void; readOnly?: boolean }) {
  const { servicos, servicoMap } = useLookups();
  const upd = (i: number, patch: Partial<ItemServico>) => onChange(itens.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1 pr-2">Serviço</th>
              <th className="w-20 py-1 pr-2">Qtd</th>
              <th className="w-28 py-1 pr-2">Preço un.</th>
              <th className="w-28 py-1 pr-2 text-right">Subtotal</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 pr-2">{readOnly ? it.descricao : <Input value={it.descricao} onChange={(e) => upd(i, { descricao: e.target.value })} />}</td>
                <td className="py-1.5 pr-2">{readOnly ? n2(it.quantidade) : <Input type="number" step="any" value={it.quantidade} onChange={(e) => upd(i, { quantidade: Number(e.target.value) })} />}</td>
                <td className="py-1.5 pr-2">{readOnly ? money(it.precoUnit) : <Input type="number" step="0.01" value={it.precoUnit} onChange={(e) => upd(i, { precoUnit: Number(e.target.value) })} />}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{money(it.quantidade * it.precoUnit)}</td>
                <td>
                  {!readOnly && (
                    <IconButton title="Remover" onClick={() => onChange(itens.filter((_, k) => k !== i))}>
                      <Trash2 size={15} />
                    </IconButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Select
            className="min-w-[220px] flex-1"
            value=""
            onChange={(e) => {
              const s = servicoMap.get(e.target.value);
              if (s) onChange([...itens, { servicoId: s.id, descricao: s.descricao, quantidade: 1, precoUnit: s.preco }]);
            }}
          >
            <option value="">+ Adicionar serviço do catálogo…</option>
            {servicos
              .filter((s) => s.ativo !== false)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo} — {s.descricao} ({money(s.preco)})
                </option>
              ))}
          </Select>
          <Button variant="outline" onClick={() => onChange([...itens, { descricao: '', quantidade: 1, precoUnit: 0 }])}>
            + Serviço avulso
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Impressão ---------------- */
export function PrintToolbar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
      <h1 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h1>
      <div className="flex flex-wrap gap-2">
        {children}
        <Button icon={<Printer size={16} />} onClick={imprimir}>
          Imprimir / Salvar PDF
        </Button>
      </div>
    </div>
  );
}

export function PrintHeader({ empresa, titulo, subtitulo, qr }: { empresa: Empresa; titulo: string; subtitulo?: ReactNode; qr?: string }) {
  return (
    <div className="mb-4 flex items-start gap-4 border-b-2 border-brand-700 pb-3">
      {empresa.logo && <img src={empresa.logo} alt="" className="h-16 w-16 object-contain" />}
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold leading-tight">{empresa.razaoSocial}</p>
        <p className="text-[11px] leading-snug text-slate-600">
          {[empresa.cnpj && `CNPJ ${empresa.cnpj}`, empresa.endereco, [empresa.cidade, empresa.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')}
          <br />
          {[empresa.telefone, empresa.whatsapp, empresa.email, empresa.site].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold uppercase leading-tight text-brand-800">{titulo}</p>
        {subtitulo && <div className="text-xs text-slate-600">{subtitulo}</div>}
      </div>
      {qr && <QRImage text={qr} size={64} />}
    </div>
  );
}

export function PrintPage({ children, landscape }: { children: ReactNode; landscape?: boolean }) {
  return (
    <div className={cx('print-page mx-auto bg-white p-6 text-[12px] text-slate-900 shadow-sm ring-1 ring-slate-200 print:p-0 print:shadow-none print:ring-0', landscape ? 'max-w-[1120px]' : 'max-w-[820px]')}>
      {landscape && <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>}
      {children}
    </div>
  );
}
