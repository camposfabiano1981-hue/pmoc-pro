import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { db } from '../db/db';
import { Button } from '../components/ui';
import { PrintHeader, PrintPage, PrintToolbar, totais } from '../components/widgets';
import { useLookups } from '../lib/lookups';
import { fmtDate, money, n2 } from '../lib/format';

export default function OrcamentoPrint() {
  const { id } = useParams();
  const l = useLookups();
  const o = useLiveQuery(() => db.orcamentos.get(id!), [id]);
  if (!o) return <p className="text-sm text-slate-500">Carregando…</p>;
  const c = l.clienteMap.get(o.clienteId || '');
  const u = l.unidadeMap.get(o.unidadeId || '');
  const t = totais(o.pecas, o.servicos, o.deslocamento, o.desconto);
  const th = 'border border-slate-300 px-1.5 py-1';
  return (
    <div>
      <PrintToolbar title={`Orçamento ${o.numero}`}>
        <Link to="/orcamentos"><Button variant="outline" icon={<ArrowLeft size={16} />}>Voltar</Button></Link>
      </PrintToolbar>
      <PrintPage>
        <PrintHeader empresa={l.empresa} titulo="Orçamento / Proposta" subtitulo={<><b className="text-base text-slate-900">{o.numero}</b><br />Emissão {fmtDate(o.data)} · Válido até {fmtDate(o.validade)}</>} />
        <div className="mb-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">Cliente</p>
            <p className="font-semibold">{c?.nome}</p>
            <p>{c?.cpfCnpj}</p>
            <p>{[c?.endereco, c?.numero, c?.bairro, c?.cidade && `${c.cidade}/${c.uf || ''}`].filter(Boolean).join(', ')}</p>
            <p>{[c?.contato, c?.telefone, c?.email].filter(Boolean).join(' · ')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">Local de execução</p>
            <p className="font-semibold">{u?.nome || '—'}</p>
            <p>{[u?.endereco, u?.numero, u?.bairro, u?.cidade].filter(Boolean).join(', ')}</p>
          </div>
        </div>
        <h3 className="bg-brand-700 px-2 py-1 text-xs font-bold uppercase text-white">{o.titulo}</h3>
        {o.descricao && <p className="mt-1 whitespace-pre-wrap">{o.descricao}</p>}
        <table className="mt-3 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className={th}>Item</th>
              <th className={th}>Descrição</th>
              <th className={th + ' text-right'}>Qtd</th>
              <th className={th + ' text-right'}>Unitário</th>
              <th className={th + ' text-right'}>Total</th>
            </tr>
          </thead>
          <tbody>
            {o.servicos.map((s, i) => (
              <tr key={'s' + i}><td className={th}>S{i + 1}</td><td className={th}>{s.descricao}</td><td className={th + ' text-right'}>{n2(s.quantidade)}</td><td className={th + ' text-right'}>{money(s.precoUnit)}</td><td className={th + ' text-right'}>{money(s.quantidade * s.precoUnit)}</td></tr>
            ))}
            {o.pecas.map((p, i) => (
              <tr key={'p' + i}><td className={th}>P{i + 1}</td><td className={th}>{p.descricao}</td><td className={th + ' text-right'}>{n2(p.quantidade)} {p.unidade}</td><td className={th + ' text-right'}>{money(p.precoUnit)}</td><td className={th + ' text-right'}>{money(p.quantidade * p.precoUnit)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={4} className={th + ' text-right'}>Serviços</td><td className={th + ' text-right'}>{money(t.servicos)}</td></tr>
            <tr><td colSpan={4} className={th + ' text-right'}>Peças e materiais</td><td className={th + ' text-right'}>{money(t.pecas)}</td></tr>
            {!!o.deslocamento && <tr><td colSpan={4} className={th + ' text-right'}>Deslocamento</td><td className={th + ' text-right'}>{money(o.deslocamento)}</td></tr>}
            {!!o.desconto && <tr><td colSpan={4} className={th + ' text-right'}>Desconto</td><td className={th + ' text-right'}>− {money(o.desconto)}</td></tr>}
            <tr className="text-sm font-bold"><td colSpan={4} className={th + ' text-right'}>TOTAL</td><td className={th + ' text-right'}>{money(t.total)}</td></tr>
          </tfoot>
        </table>
        <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
          <div><b>Prazo de execução:</b><br />{o.prazoExecucao || '—'}</div>
          <div><b>Garantia:</b><br />{o.garantia || '—'}</div>
          <div><b>Validade da proposta:</b><br />{fmtDate(o.validade)}</div>
        </div>
        {o.condicoes && <p className="mt-3 whitespace-pre-wrap text-[11px]"><b>Condições:</b> {o.condicoes}</p>}
        {o.observacoes && <p className="mt-2 whitespace-pre-wrap text-[11px]"><b>Observações:</b> {o.observacoes}</p>}
        <div className="mt-14 grid grid-cols-2 gap-10 text-center text-[11px]">
          <div className="border-t border-slate-500 pt-1">{l.empresa.razaoSocial}</div>
          <div className="border-t border-slate-500 pt-1">De acordo — {c?.nome}<br />Data: ___/___/______</div>
        </div>
        <p className="mt-6 border-t border-slate-200 pt-1 text-center text-[10px] text-slate-500">{l.empresa.rodape}</p>
      </PrintPage>
    </div>
  );
}
