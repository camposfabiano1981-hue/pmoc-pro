import { Plus, RotateCcw, Trash2, Truck } from 'lucide-react';
import { Button, Card, IconButton, Input, PageHeader } from '../../components/ui';
import { Num, useParametrosEditaveis } from '../../components/precoUi';
import { money } from '../../lib/format';
import { PARAMETROS_PADRAO } from '../../lib/precificacao';

/** Custos operacionais padrão (carregados em cada novo estudo de preço). */
export default function CustosPage() {
  const [p, upd, , salvo] = useParametrosEditaveis();
  if (!p) return <p className="text-sm text-slate-500">Carregando…</p>;
  const lista = p.custosPadrao;
  const set = (i: number, patch: Partial<(typeof lista)[number]>) => upd({ custosPadrao: lista.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  const total = lista.reduce((a, c) => a + (c.valorMensal || 0), 0);
  return (
    <div>
      <PageHeader
        title="Custos operacionais"
        subtitle="Custos mensais da operação, materiais de consumo e custo por km — carregados em cada novo estudo de preço"
        icon={<Truck size={20} />}
        actions={<span className="text-xs text-slate-500">{salvo ? 'Salvo' : 'Salvando…'}</span>}
      />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card
          title="Custos fixos mensais da operação"
          actions={
            <>
              <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => upd({ custosPadrao: PARAMETROS_PADRAO.custosPadrao })}>Lista sugerida</Button>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => upd({ custosPadrao: [...lista, { descricao: '', valorMensal: 0 }] })}>Adicionar</Button>
            </>
          }
        >
          <div className="space-y-2">
            {lista.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="flex-1" value={c.descricao} placeholder="Descrição do custo" onChange={(e) => set(i, { descricao: e.target.value })} />
                <Num className="w-40" prefix="R$" value={c.valorMensal} onChange={(v) => set(i, { valorMensal: v ?? 0 })} />
                <IconButton title="Remover" onClick={() => upd({ custosPadrao: lista.filter((_, k) => k !== i) })}><Trash2 size={15} /></IconButton>
              </div>
            ))}
            {!lista.length && <p className="text-sm text-slate-500">Nenhum custo cadastrado.</p>}
          </div>
          <p className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold dark:border-slate-800">
            <span>Total mensal</span>
            <span>{money(total)}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Entram como custo direto do contrato e são rateados entre os equipamentos (pelas horas ou por equipamento). Não inclua aqui a administração central da empresa, que já está no BDI (AC).
          </p>
        </Card>
        <Card title="Valores de referência">
          <div className="space-y-3">
            <Num label="Materiais de consumo por equipamento/mês" prefix="R$" value={p.materiaisPadraoMes} onChange={(v) => upd({ materiaisPadraoMes: v ?? 0 })} help="Produtos de limpeza e higienização, bactericida, fitas, abraçadeiras" />
            <Num label="Custo por km rodado" prefix="R$" value={p.custoKmPadrao} onChange={(v) => upd({ custoKmPadrao: v ?? 0 })} help="Combustível e desgaste; depreciação e seguro ficam nos custos fixos" />
          </div>
        </Card>
      </div>
    </div>
  );
}
