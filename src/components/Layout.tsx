import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertOctagon, BarChart3, Boxes, Building2, CalendarDays, ClipboardCheck, ClipboardList, Factory, FileSignature, FileText, HardHat, LayoutDashboard,
  ListChecks, MapPin, Menu, Moon, Package, Receipt, Search, Settings, Snowflake, Sun, Truck, Users, Wind, Wrench, X, CalendarRange, UserCircle2, CalendarCheck2,
  Briefcase, Calculator, ChevronDown, ChevronRight, Percent, Target, TrendingUp, UsersRound,
} from 'lucide-react';
import { addDays, todayStr } from '../lib/format';
import { ehPreventiva, isAtrasada } from '../lib/osHelpers';
import { OS_FINALIZADAS } from '../lib/catalogs';
import { useSessao, type Perfil } from '../lib/sessao';
import { Badge, Button, Input, Modal } from './ui';
import { useLookups } from '../lib/lookups';
import { BUILD, VERSAO, atualizarApp, useNovaVersao } from '../lib/versao';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Link } from 'react-router-dom';
import { cx } from './ui';

type Contador = 'preventivas' | 'osAtrasadas' | 'ocorrencias' | 'sessoes';
const DICA_CONTADOR: Record<Contador, string> = {
  preventivas: 'equipamento(s) com preventiva vencida e sem OS',
  osAtrasadas: 'OS atrasada(s)',
  ocorrencias: 'ocorrência(s) não analisada(s)',
  sessoes: 'sessão(ões) de licitação nos próximos 8 dias',
};

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** perfis que veem o item; ausente = gestor e supervisor */
  perfis?: Perfil[];
  contador?: Contador;
}

interface NavModulo {
  id: string;
  label: string;
  icon: ReactNode;
  /** módulo sem submenus (link direto) */
  to?: string;
  perfis?: Perfil[];
  items?: NavItem[];
}

const TODOS: Perfil[] = ['tecnico', 'supervisor', 'gestor'];

export const NAV: NavModulo[] = [
  { id: 'painel', label: 'Painel', icon: <LayoutDashboard size={18} />, to: '/' },
  {
    id: 'operacao',
    label: 'Operação',
    icon: <ClipboardList size={18} />,
    items: [
      { to: '/preventivas', label: 'Preventivas', icon: <CalendarCheck2 size={17} />, perfis: TODOS, contador: 'preventivas' },
      { to: '/campo', label: 'Área do técnico', icon: <HardHat size={17} />, perfis: TODOS },
      { to: '/agenda', label: 'Agenda', icon: <CalendarDays size={17} />, perfis: TODOS },
      { to: '/os', label: 'Ordens de serviço', icon: <ClipboardList size={17} />, contador: 'osAtrasadas' },
      { to: '/ocorrencias', label: 'Ocorrências / chamados', icon: <AlertOctagon size={17} />, perfis: TODOS, contador: 'ocorrencias' },
    ],
  },
  {
    id: 'pmoc',
    label: 'PMOC',
    icon: <FileText size={18} />,
    items: [
      { to: '/pmoc', label: 'Documentos PMOC', icon: <FileText size={17} /> },
      { to: '/cronograma', label: 'Cronograma por equipamento', icon: <CalendarRange size={17} />, perfis: TODOS },
      { to: '/planos', label: 'Planos de manutenção', icon: <ListChecks size={17} /> },
      { to: '/qualidade-ar', label: 'Qualidade do ar', icon: <Snowflake size={17} /> },
      { to: '/fluidos', label: 'Fluidos refrigerantes', icon: <Factory size={17} />, perfis: TODOS },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: <Briefcase size={18} />,
    items: [
      { to: '/comercial', label: 'Painel comercial', icon: <TrendingUp size={17} /> },
      { to: '/oportunidades', label: 'Oportunidades e licitações', icon: <Target size={17} />, contador: 'sessoes' },
      { to: '/orcamentos', label: 'Orçamentos', icon: <Receipt size={17} /> },
      { to: '/contratos', label: 'Contratos', icon: <FileSignature size={17} /> },
      { to: '/clientes', label: 'Clientes', icon: <Users size={17} /> },
    ],
  },
  {
    id: 'precificacao',
    label: 'Precificação',
    icon: <Calculator size={18} />,
    items: [
      { to: '/precificacao', label: 'Estudos de preço', icon: <Calculator size={17} /> },
      { to: '/precificacao/equipe', label: 'Equipe e custo-hora', icon: <UsersRound size={17} /> },
      { to: '/precificacao/tributos', label: 'Tributos, encargos e BDI', icon: <Percent size={17} /> },
      { to: '/precificacao/custos', label: 'Custos operacionais', icon: <Truck size={17} /> },
    ],
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: <Building2 size={18} />,
    items: [
      { to: '/unidades', label: 'Unidades', icon: <Building2 size={17} /> },
      { to: '/ambientes', label: 'Ambientes', icon: <MapPin size={17} /> },
      { to: '/equipamentos', label: 'Equipamentos', icon: <Wind size={17} />, perfis: TODOS },
      { to: '/profissionais', label: 'Profissionais', icon: <HardHat size={17} /> },
      { to: '/servicos', label: 'Serviços', icon: <Wrench size={17} /> },
      { to: '/fornecedores', label: 'Fornecedores', icon: <Truck size={17} /> },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    icon: <Boxes size={18} />,
    items: [
      { to: '/pecas', label: 'Peças e materiais', icon: <Package size={17} /> },
      { to: '/estoque', label: 'Movimentações e saldo', icon: <Boxes size={17} /> },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    icon: <BarChart3 size={18} />,
    items: [
      { to: '/relatorios', label: 'Relatórios e indicadores', icon: <BarChart3 size={17} /> },
      { to: '/configuracoes', label: 'Configurações', icon: <Settings size={17} />, perfis: ['gestor'] },
    ],
  },
];

const TODOS_ITENS: NavItem[] = NAV.flatMap((m) => m.items || (m.to ? [{ to: m.to, label: m.label, icon: m.icon, perfis: m.perfis }] : []));

/** Item do menu correspondente à rota (o prefixo mais longo vence: /precificacao/equipe antes de /precificacao). */
function itemDaRota(path: string): { modulo: NavModulo; item: NavItem } | undefined {
  let melhor: { modulo: NavModulo; item: NavItem } | undefined;
  for (const modulo of NAV) {
    for (const item of modulo.items || []) {
      const casa = path === item.to || path.startsWith(item.to + '/');
      if (casa && (!melhor || item.to.length > melhor.item.to.length)) melhor = { modulo, item };
    }
  }
  return melhor;
}

/** Rotas liberadas por perfil (prefixo da rota → item do menu). */
function podeVerRota(perfil: Perfil, path: string): boolean {
  if (perfil === 'gestor') return true;
  if (path.startsWith('/campo') || path.startsWith('/busca')) return true;
  if (perfil === 'tecnico' && /^\/equipamentos\/[^/]+$/.test(path)) return true;
  if (perfil === 'tecnico' && path === '/') return false;
  const base = '/' + (path.split('/')[1] || '');
  if (base === '/') return true;
  if (base === '/etiquetas') return podeVer(perfil, '/equipamentos');
  if (base === '/pmoc') return podeVer(perfil, '/pmoc');
  if (base === '/os' || base === '/orcamentos') return podeVer(perfil, '/os');
  if (base === '/planos') return podeVer(perfil, '/planos');
  return podeVer(perfil, base);
}

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    try {
      const s = localStorage.getItem('pmoc-theme') || document.documentElement.getAttribute('data-theme');
      if (s) return s === 'dark';
    } catch {
      /* armazenamento indisponível */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('pmoc-theme', dark ? 'dark' : 'light');
    } catch {
      /* ignora */
    }
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

export const podeVer = (perfil: Perfil, to: string) => {
  const item = TODOS_ITENS.find((i) => i.to === to);
  return (item?.perfis || ['gestor', 'supervisor']).includes(perfil);
};

const PERFIL_LABEL: Record<Perfil, string> = { tecnico: 'Técnico', supervisor: 'Supervisor', gestor: 'Gestor' };

function TrocarUsuario({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profissionais, empresa } = useLookups();
  const { usuario, entrar } = useSessao();
  const [sel, setSel] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();
  const opcoes = [{ id: 'gestor', nome: 'Gestor (administrador)', perfil: 'gestor' as Perfil, temPin: !!empresa.pinGestor }, ...profissionais.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome, perfil: (p.perfil || 'tecnico') as Perfil, temPin: !!p.pin }))];
  const confirmar = (id: string, temPin: boolean) => {
    if (temPin && sel !== id) {
      setSel(id);
      setPin('');
      setErro('');
      return;
    }
    const e = entrar(id, pin);
    if (e) {
      setErro(e);
      return;
    }
    const perfil = opcoes.find((o) => o.id === id)?.perfil;
    setSel(null);
    onClose();
    navigate(perfil === 'tecnico' ? '/campo' : '/');
  };
  return (
    <Modal open={open} onClose={onClose} title="Quem está usando?" size="sm">
      <p className="mb-3 text-xs text-slate-500">Os lançamentos de execução ficam registrados em nome do usuário. Defina perfil e PIN em Profissionais.</p>
      <ul className="space-y-1.5">
        {opcoes.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => confirmar(o.id, o.temPin)} className={cx('flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm', usuario.id === o.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-950' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800')}>
              <span className="font-medium">{o.nome}</span>
              <span className="flex items-center gap-1">
                {o.temPin && <span className="text-[10px] text-slate-500">PIN</span>}
                <Badge>{PERFIL_LABEL[o.perfil]}</Badge>
              </span>
            </button>
            {sel === o.id && (
              <form className="mt-1.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); confirmar(o.id, true); }}>
                <Input type="password" inputMode="numeric" autoFocus placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
                <Button type="submit">Entrar</Button>
              </form>
            )}
            {sel === o.id && erro && <p className="mt-1 text-xs text-rose-600">{erro}</p>}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

const MENU_KEY = 'pmoc-menu-abertos';

/** Contadores exibidos no menu (rotinas vencidas, OS atrasadas, chamados não analisados, sessões em 7 dias). */
function useContadoresMenu(): Record<Contador, number> {
  const hoje = todayStr();
  // Equipamentos com rotina vencida ainda sem OS de preventiva aberta (o mesmo número de "vencido(s)" da Central de Preventivas).
  const preventivas = useLiveQuery(
    async () => {
      const [rotinas, osAbertas, desativados] = await Promise.all([
        db.rotinas.where('proximaExecucao').below(hoje).filter((r) => r.ativa).toArray(),
        db.os.filter((o) => ehPreventiva(o) && !OS_FINALIZADAS.includes(o.status)).toArray(),
        db.equipamentos.filter((e) => e.status === 'desativado').primaryKeys(),
      ]);
      const programadas = new Set(osAbertas.flatMap((o) => o.equipamentos.flatMap((it) => it.checklist.map((c) => c.rotinaId))));
      const fora = new Set<string>(desativados);
      return new Set(rotinas.filter((r) => !programadas.has(r.id) && !fora.has(r.equipamentoId)).map((r) => r.equipamentoId)).size;
    },
    [hoje],
    0,
  );
  const osAtrasadas = useLiveQuery(() => db.os.filter((o) => isAtrasada(o, hoje)).count(), [hoje], 0);
  const ocorrencias = useLiveQuery(() => db.ocorrencias.where('status').equals('nao_analisada').count(), [], 0);
  const sessoes = useLiveQuery(
    () => db.oportunidades.where('dataSessao').between(hoje, addDays(hoje, 8)).filter((o) => !['ganha', 'perdida', 'desistencia'].includes(o.etapa)).count(),
    [hoje],
    0,
  );
  return { preventivas, osAtrasadas, ocorrencias, sessoes };
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [dark, toggle] = useTheme();
  const { empresa } = useLookups();
  const { usuario } = useSessao();
  const [trocar, setTrocar] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (usuario.perfil === 'tecnico' && loc.pathname === '/') navigate('/campo', { replace: true });
  }, [usuario.perfil, loc.pathname, navigate]);
  const demo = useLiveQuery(async () => (await db.settings.get('demo'))?.value === true, [], false);
  const novaVersao = useNovaVersao();
  const ativo = itemDaRota(loc.pathname);
  const contadores = useContadoresMenu();
  const [abertos, setAbertos] = useState<Set<string>>(() => {
    try {
      const salvo = localStorage.getItem(MENU_KEY);
      if (salvo) return new Set(JSON.parse(salvo) as string[]);
    } catch {
      /* armazenamento indisponível */
    }
    return new Set(['operacao']);
  });
  const salvarAbertos = (n: Set<string>) => {
    try {
      localStorage.setItem(MENU_KEY, JSON.stringify([...n]));
    } catch {
      /* ignora */
    }
  };
  const alternarModulo = (id: string) =>
    setAbertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      salvarAbertos(n);
      return n;
    });
  // o módulo da página atual abre sozinho
  const moduloAtivo = ativo?.modulo.id;
  useEffect(() => {
    if (!moduloAtivo) return;
    setAbertos((a) => {
      if (a.has(moduloAtivo)) return a;
      const n = new Set(a).add(moduloAtivo);
      salvarAbertos(n);
      return n;
    });
  }, [moduloAtivo]);

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        {empresa.logo ? (
          <img src={empresa.logo} alt="" className="h-9 w-9 rounded-lg bg-white object-contain" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Snowflake size={20} />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">PMOC Pro</p>
          <p className="truncate text-[11px] text-slate-400">{empresa.fantasia || empresa.razaoSocial}</p>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {NAV.map((m) => ({ ...m, items: m.items?.filter((i) => podeVer(usuario.perfil, i.to)) }))
          .filter((m) => (m.to ? podeVer(usuario.perfil, m.to) : m.items?.length))
          .map((m) => {
            if (m.to)
              return (
                <NavLink key={m.id} to={m.to} end className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-brand-600/20 text-brand-200' : 'text-slate-200 hover:bg-white/5 hover:text-white')}>
                  {m.icon}
                  {m.label}
                </NavLink>
              );
            const aberto = abertos.has(m.id);
            const ativoAqui = ativo?.modulo.id === m.id;
            const somaContadores = (m.items || []).reduce((a, i) => a + (i.contador ? contadores[i.contador] || 0 : 0), 0);
            return (
              <div key={m.id}>
                <button
                  type="button"
                  onClick={() => alternarModulo(m.id)}
                  aria-expanded={aberto}
                  className={cx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors', ativoAqui ? 'text-white' : 'text-slate-200 hover:bg-white/5 hover:text-white')}
                >
                  {m.icon}
                  <span className="flex-1">{m.label}</span>
                  {!aberto && somaContadores > 0 && <span className="rounded-full bg-rose-500/90 px-1.5 text-[10px] font-bold leading-4 text-white">{somaContadores}</span>}
                  <ChevronDown size={15} className={cx('shrink-0 text-slate-400 transition-transform', !aberto && '-rotate-90')} />
                </button>
                {aberto && (
                  <div className="mb-1 ml-[18px] space-y-0.5 border-l border-white/10 pl-2">
                    {m.items!.map((i) => {
                      const n = i.contador ? contadores[i.contador] || 0 : 0;
                      return (
                        <NavLink
                          key={i.to}
                          to={i.to}
                          className={cx(
                            'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                            ativo?.item.to === i.to ? 'bg-brand-600/20 font-medium text-brand-200' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                          )}
                        >
                          {i.icon}
                          <span className="flex-1">{i.label}</span>
                          {n > 0 && <span title={`${n} ${DICA_CONTADOR[i.contador!]}`} className={cx('rounded-full px-1.5 text-[10px] font-bold leading-4', i.contador === 'sessoes' ? 'bg-amber-400 text-amber-950' : 'bg-rose-500/90 text-white')}>{n}</span>}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-500">
        Lei 13.589/2018 · Portaria 3.523/98 · RE 09/2003
        <span className="mt-0.5 block" title={`Publicada em ${new Date(BUILD).toLocaleString('pt-BR')}`}>Versão {VERSAO.split('-')[0]} · {new Date(BUILD).toLocaleDateString('pt-BR')}</span>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-slate-900 print:hidden lg:block dark:bg-slate-900/80 dark:backdrop-blur">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900">
            <button className="absolute right-2 top-3 rounded p-1 text-slate-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur print:hidden dark:border-slate-800 dark:bg-slate-950/90">
          <button className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <form
            className="relative max-w-md flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) navigate(`/busca?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar OS, equipamento, TAG, cliente…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </form>
          <div className="flex-1" />
          {usuario.perfil !== 'tecnico' && (
            <NavLink to="/os/nova" className="hidden items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 sm:inline-flex">
              <ClipboardCheck size={16} /> Nova OS
            </NavLink>
          )}
          <button className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => setTrocar(true)} title="Trocar usuário" aria-label="Trocar usuário">
            <UserCircle2 size={20} />
            <span className="hidden max-w-[140px] truncate md:inline">{usuario.nome}</span>
            <Badge className="hidden bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200 sm:inline-flex">{PERFIL_LABEL[usuario.perfil]}</Badge>
          </button>
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={toggle} title="Alternar tema" aria-label="Alternar tema">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        {novaVersao && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-900 print:hidden dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <span>Há uma <b>nova versão</b> do PMOC Pro publicada.</span>
            <Button size="sm" variant="success" onClick={atualizarApp}>Atualizar agora</Button>
          </div>
        )}
        {demo && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 print:hidden dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Você está vendo <b>dados fictícios de demonstração</b>. Para usar com seus dados, vá em{' '}
            <Link to="/configuracoes" className="font-semibold underline">Configurações → Backup e dados → Apagar todos os dados</Link>.
          </div>
        )}
        <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
          {podeVerRota(usuario.perfil, loc.pathname) ? (
            <>
              {ativo && (
                <nav aria-label="Caminho" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-500 print:hidden">
                  <span>{ativo.modulo.label}</span>
                  <ChevronRight size={12} />
                  {loc.pathname === ativo.item.to ? <span className="font-medium text-slate-700 dark:text-slate-300">{ativo.item.label}</span> : <Link to={ativo.item.to} className="hover:text-brand-700 hover:underline dark:hover:text-brand-300">{ativo.item.label}</Link>}
                </nav>
              )}
              <Outlet />
            </>
          ) : (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="font-semibold">Acesso restrito ao perfil {usuario.perfil === 'tecnico' ? 'supervisor/gestor' : 'gestor'}</p>
              <p className="mt-1 text-sm text-slate-500">Troque de usuário no menu superior ou volte à sua área.</p>
              <NavLink to={usuario.perfil === 'tecnico' ? '/campo' : '/'} className="mt-3 inline-block text-sm font-medium text-brand-700 underline dark:text-brand-300">Ir para minha área</NavLink>
            </div>
          )}
        </main>
        <TrocarUsuario open={trocar} onClose={() => setTrocar(false)} />
      </div>
    </div>
  );
}
