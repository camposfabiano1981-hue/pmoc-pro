import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertOctagon, BarChart3, Boxes, Building2, CalendarDays, ClipboardCheck, ClipboardList, Factory, FileSignature, FileText, HardHat, LayoutDashboard,
  ListChecks, MapPin, Menu, Moon, Package, Receipt, Search, Settings, Snowflake, Sun, Truck, Users, Wind, Wrench, X, CalendarRange,
} from 'lucide-react';
import { useLookups } from '../lib/lookups';
import { cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Operação',
    items: [
      { to: '/', label: 'Painel', icon: <LayoutDashboard size={18} /> },
      { to: '/agenda', label: 'Agenda', icon: <CalendarDays size={18} /> },
      { to: '/os', label: 'Ordens de serviço', icon: <ClipboardList size={18} /> },
      { to: '/ocorrencias', label: 'Ocorrências / chamados', icon: <AlertOctagon size={18} /> },
      { to: '/orcamentos', label: 'Orçamentos', icon: <Receipt size={18} /> },
    ],
  },
  {
    group: 'PMOC',
    items: [
      { to: '/pmoc', label: 'Documentos PMOC', icon: <FileText size={18} /> },
      { to: '/cronograma', label: 'Cronograma anual', icon: <CalendarRange size={18} /> },
      { to: '/planos', label: 'Planos de manutenção', icon: <ListChecks size={18} /> },
      { to: '/qualidade-ar', label: 'Qualidade do ar', icon: <Snowflake size={18} /> },
      { to: '/fluidos', label: 'Fluidos refrigerantes', icon: <Factory size={18} /> },
    ],
  },
  {
    group: 'Cadastros',
    items: [
      { to: '/clientes', label: 'Clientes', icon: <Users size={18} /> },
      { to: '/unidades', label: 'Unidades', icon: <Building2 size={18} /> },
      { to: '/ambientes', label: 'Ambientes', icon: <MapPin size={18} /> },
      { to: '/equipamentos', label: 'Equipamentos', icon: <Wind size={18} /> },
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
      { to: '/configuracoes', label: 'Configurações', icon: <Settings size={18} /> },
    ],
  },
];

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    try {
      const s = localStorage.getItem('pmoc-theme');
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

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [dark, toggle] = useTheme();
  const { empresa } = useLookups();
  const loc = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  useEffect(() => setOpen(false), [loc.pathname]);

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
        {NAV.map((g) => (
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
          <NavLink to="/os/nova" className="hidden items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 sm:inline-flex">
            <ClipboardCheck size={16} /> Nova OS
          </NavLink>
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={toggle} title="Alternar tema" aria-label="Alternar tema">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
