import { Component, type ReactNode } from 'react';

interface State {
  erro?: Error;
}

/** Evita tela em branco: mostra o erro e permite recarregar. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};
  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }
  render() {
    if (!this.state.erro) return this.props.children;
    const semBanco = /IndexedDB|DatabaseClosed|MissingAPI|OpenFailed/i.test(this.state.erro.name + this.state.erro.message);
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-xl border border-rose-200 bg-white p-6 text-sm text-slate-700 shadow dark:border-rose-900 dark:bg-slate-900 dark:text-slate-200">
        <p className="mb-2 text-base font-semibold text-rose-700 dark:text-rose-300">{semBanco ? 'Armazenamento local indisponível' : 'Algo deu errado nesta tela'}</p>
        <p className="mb-4">
          {semBanco
            ? 'O navegador bloqueou o banco de dados local (janela anônima ou dados do site bloqueados). Abra em uma janela normal para usar a plataforma.'
            : this.state.erro.message}
        </p>
        <button className="rounded-lg bg-brand-700 px-3 py-2 font-medium text-white" onClick={() => location.reload()}>
          Recarregar
        </button>
      </div>
    );
  }
}
