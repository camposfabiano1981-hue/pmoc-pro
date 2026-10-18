import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownCircle, ArrowUpCircle, Boxes, RefreshCw, Trash2 } from 'lucide-react';
import { db, excluirMovimento, movimentarEstoque } from '../db/db';
import type { MovEstoque } from '../db/types';
import { Badge, Button, Card, Field, IconButton, Input, Modal, PageHeader, Select, Stat, Textarea, useConfirm, useToast } from '../components/ui';
import { useLookups } from '../lib/lookups';
import { fmtDate, money, n2, todayStr } from '../lib/format';
import { exportXlsx } from '../lib/excel';

export default function Estoque() {
  const l = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const movs = useLiveQuery(() => db.movimentos.orderBy('data').reverse().toArray(), []);
  const osMap = useLiveQuery(async () => new Map((await db.os.toArray()).map((o) => [o.id, o.numero])), []);
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [form, setForm] = useState<Partial<MovEstoque>>({ tipo: 'entrada', data: todayStr(), quantidade: 1 });

  const baixo = l.pecas.filter((p) => p.ativo !== false && (p.estoque || 0) <= (p.estoqueMinimo || 0));
  const valor = l.pecas.reduce((a, p) => a + Math.max(0, p.estoque || 0) * (p.custo || 0), 0);
  const lista = useMemo(() => (movs || []).filter((m) => !filtro || m.pecaId === filtro), [movs, filtro]);

  const salvar = async () => {
    if (!form.pecaId || form.quantidade === undefined || (form.tipo !== 'ajuste' && form.quantidade <= 0)) {
      toast('Selecione a peça e informe a quantidade.', 'warning');
      return;
    }
    await movimentarEstoque({ pecaId: form.pecaId, tipo: form.tipo as MovEstoque['tipo'], quantidade: Number(form.quantidade), custoUnit: form.custoUnit, data: form.data || todayStr(), documento: form.documento, observacoes: form.observacoes });
    toast('Movimentação registrada.');
    setOpen(false);
    setForm({ tipo: 'entrada', data: todayStr(), quantidade: 1 });
  };

  const sugestaoCompra = async () => {
    await exportXlsx(
      [{
        name: 'Sugestão de compra',
        headers: ['Código', 'Descrição', 'Unidade', 'Estoque', 'Mínimo', 'Sugerido (2× mín − saldo)', 'Custo unit.', 'Total estimado', 'Fornecedor'],
        rows: baixo.map((p) => {
          const q = Math.max(0, (p.estoqueMinimo || 0) * 2 - (p.estoque || 0));
          return [p.codigo, p.descricao, p.unidade, p.estoque, p.estoqueMinimo, q, p.custo, q * (p.custo || 0), l.fornecedorMap.get(p.fornecedorId || '')?.nome];
        }),
      }],
      `sugestao-compra-${todayStr()}.xlsx`,
    );
  };

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle="Entradas, saídas (baixas por OS) e ajustes de inventário com custo médio ponderado"
        icon={<Boxes size={20} />}
        actions={
          <>
            <Link to="/pecas"><Button variant="outline">Cadastro de peças</Button></Link>
            <Button variant="outline" onClick={sugestaoCompra} disabled={!baixo.length}>Sugestão de compra</Button>
            <Button onClick={() => setOpen(true)}>Nova movimentação</Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Itens cadastrados" value={l.pecas.length} icon={<Boxes size={18} />} />
        <Stat label="Valor em estoque" value={money(valor)} tone="green" icon={<ArrowDownCircle size={18} />} />
        <Stat label="Abaixo do mínimo" value={baixo.length} tone={baixo.length ? 'red' : 'green'} icon={<ArrowUpCircle size={18} />} />
        <Stat label="Movimentações" value={movs?.length ?? 0} tone="slate" icon={<RefreshCw size={18} />} />
      </div>
      {baixo.length > 0 && (
        <Card title="Itens abaixo do estoque mínimo" className="mb-4">
          <div className="flex flex-wrap gap-2">
            {baixo.map((p) => (
              <Badge key={p.id} className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
                {p.descricao}: {n2(p.estoque)}/{n2(p.estoqueMinimo)} {p.unidade}
              </Badge>
            ))}
          </div>
        </Card>
      )}
      <Card
        title="Movimentações"
        bodyClass="p-0"
        actions={
          <Select className="w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todas as peças</option>
            {l.pecas.map((p) => <option key={p.id} value={p.id}>{p.descricao}</option>)}
          </Select>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Peça</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-3 py-2 text-right">Custo un.</th>
                <th className="px-3 py-2">Documento / OS</th>
                <th className="px-3 py-2">Obs.</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lista.map((m) => {
                const p = l.pecaMap.get(m.pecaId);
                return (
                  <tr key={m.id}>
                    <td className="px-3 py-2">{fmtDate(m.data)}</td>
                    <td className="px-3 py-2">
                      <Badge className={m.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : m.tipo === 'saida' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : undefined}>{m.tipo}</Badge>
                    </td>
                    <td className="px-3 py-2">{p?.descricao || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.tipo === 'saida' ? '−' : m.tipo === 'ajuste' ? '=' : '+'}{n2(m.quantidade)} {p?.unidade}</td>
                    <td className="px-3 py-2 text-right">{m.custoUnit ? money(m.custoUnit) : '—'}</td>
                    <td className="px-3 py-2">{m.osId ? <Link className="text-brand-700 hover:underline dark:text-brand-300" to={`/os/${m.osId}`}>{osMap?.get(m.osId) || 'OS'}</Link> : m.documento || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{m.observacoes}</td>
                    <td className="px-2 py-1 text-right">
                      <IconButton
                        title="Excluir movimento (estorna saldo)"
                        onClick={async () => {
                          if (await confirm({ message: 'Excluir esta movimentação? O saldo será estornado (exceto ajustes).', danger: true, confirmText: 'Excluir' })) {
                            await excluirMovimento(m.id);
                            toast('Movimentação excluída.');
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
              {lista.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Nenhuma movimentação.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova movimentação de estoque" size="md" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={salvar}>Registrar</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peça" className="col-span-2" required>
            <Select value={form.pecaId || ''} onChange={(e) => { const p = l.pecaMap.get(e.target.value); setForm({ ...form, pecaId: e.target.value, custoUnit: p?.custo }); }}>
              <option value="">— selecione —</option>
              {l.pecas.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao} (saldo {n2(p.estoque)} {p.unidade})</option>)}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as MovEstoque['tipo'] })}>
              <option value="entrada">Entrada (compra)</option>
              <option value="saida">Saída (consumo)</option>
              <option value="ajuste">Ajuste de inventário (saldo final)</option>
            </Select>
          </Field>
          <Field label="Data"><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
          <Field label={form.tipo === 'ajuste' ? 'Saldo contado' : 'Quantidade'} required><Input type="number" step="any" value={form.quantidade ?? ''} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></Field>
          <Field label="Custo unitário (R$)" help={form.tipo === 'entrada' ? 'Atualiza o custo médio' : undefined}><Input type="number" step="0.01" value={form.custoUnit ?? ''} onChange={(e) => setForm({ ...form, custoUnit: Number(e.target.value) })} /></Field>
          <Field label="Documento (NF, requisição…)" className="col-span-2"><Input value={form.documento || ''} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></Field>
          <Field label="Observações" className="col-span-2"><Textarea rows={2} value={form.observacoes || ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
