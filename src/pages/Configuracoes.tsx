import { useEffect, useState } from 'react';
import { Database, Download, FileSpreadsheet, Image, RotateCcw, Settings, Trash2, Upload } from 'lucide-react';
import { db, exportarBackup, importarBackup, limparTudo, setSetting } from '../db/db';
import { ensureBase, seedDemo } from '../db/seed';
import type { Empresa } from '../db/types';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Tabs, Textarea, useConfirm, useToast } from '../components/ui';
import { useLookups } from '../lib/lookups';
import { compressImage, downloadText, maskCpfCnpj, readFileAsText, todayStr } from '../lib/format';
import { NORMAS, UFS } from '../lib/catalogs';
import { analisarPlanilha, baixarModelo, importarAbas, type AbaDetectada, type TipoAba } from '../lib/importer';

type Tab = 'empresa' | 'importar' | 'backup' | 'normas';

export default function Configuracoes() {
  const l = useLookups();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('empresa');
  const [emp, setEmp] = useState<Empresa>(l.empresa);
  const [abas, setAbas] = useState<AbaDetectada[] | null>(null);
  const [clienteId, setClienteId] = useState('');
  const [novoCliente, setNovoCliente] = useState('');
  const [busy, setBusy] = useState(false);
  const [uso, setUso] = useState<string>('');

  useEffect(() => setEmp(l.empresa), [l.empresa]);
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUso(`${((e.usage || 0) / 1048576).toFixed(1)} MB usados de ~${((e.quota || 0) / 1073741824).toFixed(1)} GB disponíveis`)).catch(() => {});
  }, []);

  const salvarEmpresa = async () => {
    await setSetting('empresa', emp);
    toast('Dados da empresa salvos.');
  };

  const backup = async () => {
    const data = await exportarBackup();
    downloadText(JSON.stringify(data), `pmoc-pro-backup-${todayStr()}.json`, 'application/json');
    await setSetting('ultimoBackup', new Date().toISOString());
    toast('Backup gerado.');
  };

  const restaurar = async (file: File, modo: 'substituir' | 'mesclar') => {
    try {
      const data = JSON.parse(await readFileAsText(file));
      if (!(await confirm({ title: 'Restaurar backup', message: modo === 'substituir' ? 'Todos os dados atuais serão SUBSTITUÍDOS pelo backup. Continuar?' : 'Os registros do backup serão mesclados aos atuais (mesmo ID = sobrescreve). Continuar?', danger: modo === 'substituir', confirmText: 'Restaurar' }))) return;
      await importarBackup(data, modo);
      await ensureBase();
      toast('Backup restaurado com sucesso.');
    } catch (e) {
      toast('Falha ao restaurar: ' + (e as Error).message, 'error');
    }
  };

  const analisar = async (file: File) => {
    setBusy(true);
    try {
      const r = await analisarPlanilha(file);
      setAbas(r);
      if (!r.length) toast('Nenhuma aba reconhecida. Use o modelo de importação.', 'warning');
    } catch (e) {
      toast('Não foi possível ler a planilha: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const importar = async () => {
    if (!abas) return;
    let cid = clienteId;
    if (!cid) {
      if (!novoCliente.trim()) {
        toast('Selecione o cliente ou informe o nome de um novo cliente.', 'warning');
        return;
      }
      const ts = new Date().toISOString();
      cid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      await db.clientes.add({ id: cid, createdAt: ts, updatedAt: ts, nome: novoCliente.trim(), tipoPessoa: 'PJ', ativo: true });
    }
    setBusy(true);
    try {
      const r = await importarAbas(abas, cid, 'Unidade importada');
      toast(`Importação concluída: ${r.unidades} unidade(s), ${r.ambientes} ambiente(s), ${r.equipamentos} equipamento(s).`);
      setAbas(null);
    } catch (e) {
      toast('Erro na importação: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const e = (k: keyof Empresa) => ({ value: (emp[k] as string) || '', onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setEmp({ ...emp, [k]: ev.target.value }) });

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Empresa, importação de planilhas, backup e normas" icon={<Settings size={20} />} />
      <Tabs
        tabs={[
          { value: 'empresa', label: 'Empresa' },
          { value: 'importar', label: 'Importar planilha' },
          { value: 'backup', label: 'Backup e dados' },
          { value: 'normas', label: 'Normas e legislação' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'empresa' && (
        <Card title="Dados da empresa (cabeçalho de OS, orçamentos e PMOC)" actions={<Button onClick={salvarEmpresa}>Salvar</Button>}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Razão social" className="md:col-span-2"><Input {...e('razaoSocial')} /></Field>
            <Field label="Nome fantasia"><Input {...e('fantasia')} /></Field>
            <Field label="CNPJ"><Input value={emp.cnpj || ''} onChange={(ev) => setEmp({ ...emp, cnpj: maskCpfCnpj(ev.target.value) })} /></Field>
            <Field label="Inscrição estadual"><Input {...e('ie')} /></Field>
            <Field label="Inscrição municipal"><Input {...e('im')} /></Field>
            <Field label="Telefone"><Input {...e('telefone')} /></Field>
            <Field label="WhatsApp"><Input {...e('whatsapp')} /></Field>
            <Field label="E-mail"><Input {...e('email')} /></Field>
            <Field label="Site"><Input {...e('site')} /></Field>
            <Field label="Endereço" className="md:col-span-2"><Input {...e('endereco')} /></Field>
            <Field label="Cidade"><Input {...e('cidade')} /></Field>
            <Field label="UF">
              <Select value={emp.uf || ''} onChange={(ev) => setEmp({ ...emp, uf: ev.target.value })}>
                <option value="">—</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="CEP"><Input {...e('cep')} /></Field>
            <Field label="Rodapé dos documentos" className="md:col-span-3"><Textarea rows={2} value={emp.rodape || ''} onChange={(ev) => setEmp({ ...emp, rodape: ev.target.value })} /></Field>
            <Field label="Logotipo" className="md:col-span-4">
              <div className="flex items-center gap-3">
                {emp.logo ? <img src={emp.logo} alt="Logo" className="h-16 w-16 rounded border border-slate-200 bg-white object-contain" /> : <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-slate-300 text-slate-400"><Image size={20} /></div>}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
                  <Upload size={16} /> Enviar imagem
                  <input type="file" accept="image/*" className="hidden" onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) setEmp({ ...emp, logo: await compressImage(f, 400, 0.9) }); }} />
                </label>
                {emp.logo && <Button variant="ghost" onClick={() => setEmp({ ...emp, logo: undefined })}>Remover</Button>}
              </div>
            </Field>
          </div>
        </Card>
      )}

      {tab === 'importar' && (
        <div className="space-y-4">
          <Card title="Importar equipamentos e ambientes de planilha Excel (.xlsx)" actions={<Button variant="outline" icon={<FileSpreadsheet size={16} />} onClick={baixarModelo}>Baixar modelo</Button>}>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              O importador reconhece automaticamente abas de <b>equipamentos</b> (colunas como Código, Equip, Potência, Marca, Pat, Área, Local, Sublocal, C. Custo) e de <b>ambientes</b> (Área, Identificação ambiente, Localização, Tipo atividade, Ocupantes). Planilhas PMOC no formato "Eq_Unidade" / "Rel_areas" são aceitas diretamente.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
              <Upload size={16} /> {busy ? 'Lendo…' : 'Selecionar planilha'}
              <input type="file" accept=".xlsx" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) analisar(f); ev.target.value = ''; }} />
            </label>
          </Card>
          {abas && abas.length > 0 && (
            <Card title="Abas reconhecidas" actions={<Button onClick={importar} disabled={busy}>Importar</Button>}>
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <Field label="Cliente / proprietário de destino">
                  <Select value={clienteId} onChange={(ev) => setClienteId(ev.target.value)}>
                    <option value="">— criar novo cliente —</option>
                    {l.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </Select>
                </Field>
                {!clienteId && <Field label="Nome do novo cliente"><Input value={novoCliente} onChange={(ev) => setNovoCliente(ev.target.value)} placeholder="Razão social" /></Field>}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-3">Aba</th><th className="py-1 pr-3">Linhas</th><th className="py-1 pr-3">Colunas mapeadas</th><th className="py-1">Importar como</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {abas.map((a, i) => (
                      <tr key={a.nome}>
                        <td className="py-2 pr-3 font-medium">{a.nome}</td>
                        <td className="py-2 pr-3">{a.linhas.length}</td>
                        <td className="py-2 pr-3"><div className="flex flex-wrap gap-1">{Object.keys(a.colunas).map((c) => <Badge key={c}>{c}</Badge>)}</div></td>
                        <td className="py-2">
                          <Select className="w-auto" value={a.tipo} onChange={(ev) => setAbas(abas.map((x, k) => (k === i ? { ...x, tipo: ev.target.value as TipoAba } : x)))}>
                            <option value="equipamentos">Equipamentos</option>
                            <option value="ambientes">Ambientes</option>
                            <option value="ignorar">Ignorar</option>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500">Unidades são criadas a partir da coluna "Área"; ambientes a partir de Local/Sublocal (sem duplicar). O plano de manutenção é sugerido pelo tipo do equipamento e o código original fica registrado nas observações.</p>
            </Card>
          )}
        </div>
      )}

      {tab === 'backup' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Backup (recomendado semanalmente)">
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Os dados ficam armazenados neste navegador (IndexedDB). Gere backups regularmente e guarde-os em local seguro (Google Drive, OneDrive, pendrive). {uso}</p>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Download size={16} />} onClick={backup}>Baixar backup (.json)</Button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
                <Upload size={16} /> Restaurar (substituir)
                <input type="file" accept=".json" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) restaurar(f, 'substituir'); ev.target.value = ''; }} />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
                <Upload size={16} /> Mesclar backup
                <input type="file" accept=".json" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) restaurar(f, 'mesclar'); ev.target.value = ''; }} />
              </label>
            </div>
            <p className="mt-3 text-xs text-slate-500">Para trabalhar em equipe com vários aparelhos, use "Mesclar backup" para consolidar os dados enviados pelos técnicos.</p>
          </Card>
          <Card title="Dados da plataforma">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" icon={<Database size={16} />} onClick={async () => { if (await confirm({ message: 'Carregar dados fictícios de demonstração? Eles serão adicionados aos dados atuais.', confirmText: 'Carregar' })) { await seedDemo(); toast('Dados de demonstração carregados.'); } }}>Carregar demonstração</Button>
                <Button variant="outline" icon={<RotateCcw size={16} />} onClick={async () => { await ensureBase(); toast('Planos padrão verificados.'); }}>Verificar planos padrão</Button>
              </div>
              <div className="rounded-lg border border-rose-200 p-3 dark:border-rose-900">
                <p className="mb-2 text-sm font-medium text-rose-700 dark:text-rose-300">Zona de perigo</p>
                <Button
                  variant="danger"
                  icon={<Trash2 size={16} />}
                  onClick={async () => {
                    if (!(await confirm({ title: 'Apagar todos os dados', message: 'Todos os cadastros, OS e configurações deste navegador serão apagados. Faça um backup antes. Continuar?', danger: true, confirmText: 'Apagar tudo' }))) return;
                    await limparTudo();
                    await ensureBase();
                    await setSetting('initialized', true);
                    toast('Dados apagados. Plataforma pronta para uso real.');
                  }}
                >
                  Apagar todos os dados
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'normas' && (
        <Card title="Base legal e normativa considerada pela plataforma">
          <ul className="space-y-2 text-sm">
            {NORMAS.map((n) => (
              <li key={n.ref} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{n.ref}</p>
                <p className="text-slate-600 dark:text-slate-300">{n.desc}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Periodicidades dos planos padrão são sugestões e devem ser validadas pelo responsável técnico conforme a ABNT NBR 13971, o projeto e o manual do fabricante.</p>
        </Card>
      )}
    </div>
  );
}
