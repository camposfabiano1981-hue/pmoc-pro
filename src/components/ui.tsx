import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm disabled:bg-brand-700/50',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ title, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={cx('inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800';

/** Remove o w-full padrão quando o chamador define a própria largura. */
const fieldCls = (className = '') => {
  let base = inputCls;
  if (/(^|\s)w-/.test(className)) base = base.replace('w-full ', '');
  if (/(^|\s)py?-/.test(className)) base = base.replace(' py-2 ', ' ');
  if (/(^|\s)px-/.test(className)) base = base.replace(' px-3 ', ' ');
  return cx(base, className);
};

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={fieldCls(className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldCls(className), 'pr-8')} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldCls(className), !/min-h-/.test(className || '') && 'min-h-[80px]')} {...rest} />;
}

export function Field({ label, children, help, className, required }: { label: string; children: ReactNode; help?: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
      {help && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{help}</span>}
    </label>
  );
}

export function Card({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/70 dark:bg-slate-900', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass && /(^|\s)p-\d/.test(bodyClass) ? bodyClass : cx('p-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', className || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>{children}</span>;
}

export function PageHeader({ title, subtitle, icon, actions }: { title: string; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">{icon}</div>}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      {icon && <div className="mb-3 text-slate-300 dark:text-slate-600">{icon}</div>}
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('flex max-h-[95vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl', w)} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <IconButton title="Fechar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === t.value ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, icon, tone = 'brand', onClick }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'brand' | 'green' | 'amber' | 'red' | 'violet' | 'slate'; onClick?: () => void }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    red: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <div
      onClick={onClick}
      className={cx('rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900', onClick && 'cursor-pointer transition hover:border-brand-300 hover:shadow')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
        </div>
        {icon && <div className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>{icon}</div>}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
      <span className={cx('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600')}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={cx('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
      {label}
    </label>
  );
}

/* ---------------- Toasts ---------------- */
type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const push = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = ++idRef.current;
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  useEffect(() => {
    const h = (e: Event) => push(String((e as CustomEvent).detail), 'info');
    window.addEventListener('pmoc-aviso', h);
    return () => window.removeEventListener('pmoc-aviso', h);
  }, [push]);
  const icons = { success: <CheckCircle2 size={18} className="text-emerald-500" />, error: <XCircle size={18} className="text-rose-500" />, info: <Info size={18} className="text-sky-500" />, warning: <AlertTriangle size={18} className="text-amber-500" /> };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2 print:hidden">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {icons[t.kind]}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Confirm ---------------- */
interface ConfirmOpts {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  danger?: boolean;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title || 'Confirmar'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {state?.confirmText || 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-slate-700 dark:text-slate-300">{state?.message}</div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
