import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, ListChecks, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { db, nowIso, saveRecord, uid } from '../db/db';
import { PLANOS_PADRAO } from '../db/planosPadrao';
import type { AtividadePlano, PlanoManutencao } from '../db/types';
import { Badge, Button, Card, Field, IconButton, Input, PageHeader, Select, Textarea, useConfirm, useToast } from '../components/ui';
import { useLookups } from '../lib/lookups';
import { MESES_CURTOS } from '../lib/format';
import { PERIODICIDADES, TIPOS_EQUIPAMENTO, periodicidadeSigla } from '../lib/catalogs';
import { isDue } from '../lib/schedule';

export function PlanosList() {
  const l = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const duplicar = async (p: PlanoManutencao) => {
    const novo = await saveRecord<PlanoManutencao>('planos', { ...structuredClone(p), id: undefined, createdAt: undefined, nome: p.nome + ' (cópia)', atividades: p.atividades.map((a) => ({ ...a, id: uid() })) });
    toast('Plano duplicado.');
    navigate(`/planos/${novo.id}`);
  };
  const restaurar = async () => {
    if (!(await confirm({ message: 'Reinstalar os planos padrão (Portaria 3.523, Split, VRF, Chiller, etc.)? Planos padrão editados serão sobrescritos; seus planos personalizados são mantidos.', confirmText: 'Reinstalar' }))) return;
    await db.planos.bulkPut(PLANOS_PADRAO);
    toast('Planos padrão reinstalados.');
  };
  return (
    <div>
      <PageHeader
        title="Planos de manutenção"
        subtitle="Modelos de atividades e periodicidades aplicados aos equipamentos (base do cronograma PMOC)"
        icon={<ListChecks size={20} />}
        actions={
          <>
            <Button variant="outline" icon={<RotateCcw size={16} />} onClick={restaurar}>Reinstalar padrões</Button>
            <Button icon={<Plus size={16} />} onClick={async () => { const p = await saveRecord<PlanoManutencao>('planos', { nome: 'Novo plano', tiposEquipamento: [], atividades: [] }); navigate(`/planos/${p.id}`); }}>Novo plano</Button>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {l.planos.map((p) => {
          const n = l.equipamentos.filter((e) => e.planoId === p.id).length;
          const horasAno = p.atividades.reduce((acc, a) => {
            const per = PERIODICIDADES.find((x) => x.value === a.periodicidade)!;
            const vezes = per.meses === 0 ? per.vezesMes * 12 : per.meses > 0 ? 12 / per.meses : 0;
            return acc + (vezes * a.tempoMin) / 60;
          }, 0);
          return (
            <Card key={p.id} className="flex flex-col" bodyClass="flex flex-1 flex-col">
              <Link to={`/planos/${p.id}`} className="text-base font-semibold text-slate-900 hover:text-brand-700 dark:text-white">{p.nome}</Link>
              <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-500">{p.descricao}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{p.atividades.length} atividades</Badge>
                <Badge>{n} equipamento(s)</Badge>
                <Badge>≈ {Math.round(horasAno)} h/ano por equip.</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">{p.tiposEquipamento.join(', ')}</p>
              <div className="mt-3 flex gap-2">
                <Link to={`/planos/${p.id}`}><Button size="sm">Editar</Button></Link>
                <Button size="sm" variant="outline" icon={<Copy size={14} />} onClick={() => duplicar(p)}>Duplicar</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function PlanoEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const l = useLookups();
  const [p, setP] = useState<PlanoManutencao | null>(null);
  const [inicio, setInicio] = useState(0);
  useEffect(() => {
    db.planos.get(id!).then((x) => setP(x || null));
  }, [id]);
  if (!p) return <p className="text-sm text-slate-500">Carregando…</p>;
  const upd = (patch: Partial<PlanoManutencao>) => setP({ ...p, ...patch });
  const updA = (i: number, patch: Partial<AtividadePlano>) => upd({ atividades: p.atividades.map((a, k) => (k === i ? { ...a, ...patch } : a)) });
  const move = (i: number, d: number) => {
    const arr = [...p.atividades];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    upd({ atividades: arr });
  };
  const salvar = async () => {
    await db.planos.put({ ...p, updatedAt: nowIso() });
    toast('Plano salvo.');
  };
  const excluir = async () => {
    const n = l.equipamentos.filter((e) => e.planoId === p.id).length;
    if (n) {
      toast(`Plano em uso por ${n} equipamento(s). Altere-os antes de excluir.`, 'warning');
      return;
    }
    if (!(await confirm({ message: 'Excluir este plano?', danger: true, confirmText: 'Excluir' }))) return;
    await db.planos.delete(p.id);
    navigate('/planos');
  };
  const grupos = [...new Set(p.atividades.map((a) => a.grupo))];

  return (
    <div>
      <PageHeader
        title={p.nome}
        icon={<ListChecks size={20} />}
        subtitle={`${p.atividades.length} atividades`}
        actions={
          <>
            <Button variant="outline" icon={<Trash2 size={16} />} onClick={excluir}>Excluir</Button>
            <Button icon={<Save size={16} />} onClick={salvar}>Salvar plano</Button>
          </>
        }
      />
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Nome do plano" className="md:col-span-2"><Input value={p.nome} onChange={(e) => upd({ nome: e.target.value })} /></Field>
          <Field label="Normas de referência" className="md:col-span-2"><Input value={p.norma || ''} onChange={(e) => upd({ norma: e.target.value })} /></Field>
          <Field label="Descrição" className="md:col-span-4"><Textarea rows={2} value={p.descricao || ''} onChange={(e) => upd({ descricao: e.target.value })} /></Field>
          <Field label="Tipos de equipamento atendidos (sugestão automática)" className="md:col-span-4">
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_EQUIPAMENTO.map((t) => {
                const on = p.tiposEquipamento.includes(t);
                return (
                  <button key={t} type="button" onClick={() => upd({ tiposEquipamento: on ? p.tiposEquipamento.filter((x) => x !== t) : [...p.tiposEquipamento, t] })} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200' : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Atividades" bodyClass="p-0" actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => upd({ atividades: [...p.atividades, { id: uid(), grupo: grupos[grupos.length - 1] || 'Geral', descricao: '', periodicidade: 'mensal', tempoMin: 10, tipo: 'check' }] })}>Atividade</Button>}>
        <datalist id="dl-grupos">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
              <tr>
                <th className="px-2 py-2">Grupo</th>
                <th className="px-2 py-2">Descrição da atividade</th>
                <th className="px-2 py-2">Periodicidade</th>
                <th className="px-2 py-2">Min</th>
                <th className="px-2 py-2">Registro</th>
                <th className="px-2 py-2">Unid. / faixa</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {p.atividades.map((a, i) => (
                <tr key={a.id} className="align-top">
                  <td className="w-48 px-2 py-1.5"><Input list="dl-grupos" className="py-1" value={a.grupo} onChange={(e) => updA(i, { grupo: e.target.value })} /></td>
                  <td className="min-w-[280px] px-2 py-1.5"><Textarea rows={1} className="min-h-[34px] py-1" value={a.descricao} onChange={(e) => updA(i, { descricao: e.target.value })} /></td>
                  <td className="w-36 px-2 py-1.5">
                    <Select className="py-1" value={a.periodicidade} onChange={(e) => updA(i, { periodicidade: e.target.value as AtividadePlano['periodicidade'] })}>
                      {PERIODICIDADES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </Select>
                  </td>
                  <td className="w-20 px-2 py-1.5"><Input type="number" className="py-1" value={a.tempoMin} onChange={(e) => updA(i, { tempoMin: Number(e.target.value) })} /></td>
                  <td className="w-32 px-2 py-1.5">
                    <Select className="py-1" value={a.tipo} onChange={(e) => updA(i, { tipo: e.target.value as AtividadePlano['tipo'] })}>
                      <option value="check">Verificação</option>
                      <option value="medicao">Medição</option>
                    </Select>
                  </td>
                  <td className="w-52 px-2 py-1.5">
                    {a.tipo === 'medicao' && (
                      <div className="flex gap-1">
                        <Input className="w-16 py-1" placeholder="un." value={a.unidade || ''} onChange={(e) => updA(i, { unidade: e.target.value })} />
                        <Input className="w-16 py-1" placeholder="mín" type="number" value={a.min ?? ''} onChange={(e) => updA(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
                        <Input className="w-16 py-1" placeholder="máx" type="number" value={a.max ?? ''} onChange={(e) => updA(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5">
                    <IconButton title="Subir" onClick={() => move(i, -1)}><ArrowUp size={14} /></IconButton>
                    <IconButton title="Descer" onClick={() => move(i, 1)}><ArrowDown size={14} /></IconButton>
                    <IconButton title="Remover" onClick={() => upd({ atividades: p.atividades.filter((_, k) => k !== i) })}><Trash2 size={14} /></IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        className="mt-4"
        title="Prévia do calendário anual (X = atividade programada)"
        actions={
          <Select className="w-auto" value={inicio} onChange={(e) => setInicio(Number(e.target.value))}>
            {MESES_CURTOS.map((m, i) => <option key={m} value={i}>1ª execução em {m}</option>)}
          </Select>
        }
        bodyClass="p-0"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-2 py-1.5 text-left">Atividade</th>
                <th className="px-1 py-1.5">Per.</th>
                {MESES_CURTOS.map((m) => <th key={m} className="w-9 px-1 py-1.5">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {p.atividades.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1">{a.descricao}</td>
                  <td className="px-1 py-1 text-center font-semibold">{periodicidadeSigla(a.periodicidade)}</td>
                  {MESES_CURTOS.map((m, i) => (
                    <td key={m} className={`px-1 py-1 text-center ${isDue(a.periodicidade, i, inicio) ? 'bg-brand-100 font-bold text-brand-800 dark:bg-brand-900/60 dark:text-brand-200' : ''}`}>{isDue(a.periodicidade, i, inicio) ? 'X' : ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
