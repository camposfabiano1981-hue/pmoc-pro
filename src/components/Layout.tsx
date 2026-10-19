import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertOctagon, BarChart3, Boxes, Building2, CalendarDays, ClipboardCheck, ClipboardList, Factory, FileSignature, FileText, HardHat, LayoutDashboard,
  ListChecks, MapPin, Menu, Moon, Package, Receipt, Search, Settings, Snowflake, Sun, Truck, Users, Wind, Wrench, X, CalendarRange, UserCircle2, CalendarCheck2,
} from 'lucide-react';
import { useSessao, type Perfil } from '../lib/sessao';
import { Badge, Button, Input, Modal } from './ui';
import { useLookups } from '../lib/lookups';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Link } from 'react-router-dom';
import { cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** perfis que veem o item; ausente = gestor e supervisor */
  perfis?: Perfil[];
}

const TODOS: Perfil[] = ['tecnico', 'supervisor', 'gestor'];

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Operação',
    items: [
      { to: '/', label: 'Painel', icon: <LayoutDashboard size={18} /> },
      { to: '/preventivas', label: 'Preventivas', icon: <CalendarCheck2 size={18} />, perfis: TODOS },
      { to: '/campo', label: 'Área do técnico', icon: <HardHat size={18} />, perfis: TODOS },
      { to: '/agenda', label: 'Agenda', icon: <CalendarDays size={18} />, perfis: TODOS },
      { to: '/os', label: 'Ordens de serviço', icon: <ClipboardList size={18} /> },
      { to: '/ocorrencias', label: 'Ocorrências / chamados', icon: <AlertOctagon size={18} />, perfis: TODOS },
      { to: '/orcamentos', label: 'Orçamentos', icon: <Receipt size={18} /> },
    ],
  },
  {
    group: 'PMOC',
    items: [
      { to: '/pmoc', label: 'Documentos PMOC', icon: <FileText size={18} /> },
      { to: '/cronograma', label: 'Cronograma por equipamento', icon: <CalendarRange size={18} />, perfis: TODOS },
      { to: '/planos', label: 'Planos de manutenção', icon: <ListChecks size={18} /> },
      { to: '/qualidade-ar', label: 'Qualidade do ar', icon: <Snowflake size={18} /> },
      { to: '/fluidos', label: 'Fluidos refrigerantes', icon: <Factory size={18} />, perfis: TODOS },
    ],
  },
  {
    group: 'Cadastros',
    items: [
      { to: '/clientes', label: 'Clientes', icon: <Users size={18} /> },
      { to: '/unidades', label: 'Unidades', icon: <Building2 size={18} /> },
      { to: '/ambientes', label: 'Ambientes', icon: <MapPin size={18} /> },
      { to: '/equipamentos', label: 'Equipamentos', icon: <Wind size={18} />, perfis: TODOS },
      { to: '/profissionais', label: 'Profissionais', icon: <HardHat size={18} /> },
      { to: '/servicos', label: 'Serviços', icon: <Wrench size={18} /> },
      { to: '/pecas', label: 'Peças e materiais', icon: <Package size={18} /> },
      { to: '/estoque', label: 'Estoque', icon: <Boxes size={18} /> },
      { to: '/fornecedores', label: 'Fornecedores', icon: <Truck size={18} /> },
      { to: '/contratos', label: 'Contratos', icon: <FileSignature size={18} /> },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { to: '/relatorios', label: 'Relatórios e indicadores', icon: <BarChart3 size={18} /> },
      { to: '/configuracoes', label: 'Configurações', icon: <Settings size={18} />, perfis: ['gestor'] },
    ],
  },
];

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
  const item = NAV.flatMap((g) => g.items).find((i) => i.to === to);
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
      <div className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {NAV.map((g) => ({ ...g, items: g.items.filter((i) => podeVer(usuario.perfil, i.to)) })).filter((g) => g.items.length).map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{g.group}</p>
            {g.items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'bg-brand-600/20 font-medium text-brand-200' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                {i.icon}
                {i.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-500">Lei 13.589/2018 · Portaria 3.523/98 · RE 09/2003</div>
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
        {demo && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 print:hidden dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Você está vendo <b>dados fictícios de demonstração</b>. Para usar com seus dados, vá em{' '}
            <Link to="/configuracoes" className="font-semibold underline">Configurações → Backup e dados → Apagar todos os dados</Link>.
          </div>
        )}
        <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
          {podeVerRota(usuario.perfil, loc.pathname) ? (
            <Outlet />
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
