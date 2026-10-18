import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLookups } from './lookups';

export type Perfil = 'tecnico' | 'supervisor' | 'gestor';

export interface Usuario {
  id: string;
  nome: string;
  perfil: Perfil;
  /** profissional vinculado (técnicos e supervisores) */
  profissionalId?: string;
}

const GESTOR: Usuario = { id: 'gestor', nome: 'Gestor', perfil: 'gestor' };
const KEY = 'pmoc-usuario';

interface Sessao {
  usuario: Usuario;
  entrar: (id: string, pin?: string) => string | null;
  /** Permissões por perfil (controle de acesso local do navegador) */
  pode: (acao: 'cadastrar' | 'excluir' | 'liberar' | 'precos' | 'configurar' | 'gerir_os') => boolean;
}

const Ctx = createContext<Sessao>({ usuario: GESTOR, entrar: () => null, pode: () => true });
export const useSessao = () => useContext(Ctx);

function lerId(): string {
  try {
    return localStorage.getItem(KEY) || 'gestor';
  } catch {
    return 'gestor';
  }
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const l = useLookups();
  const [id, setId] = useState(lerId);

  const usuario = useMemo<Usuario>(() => {
    if (id === 'gestor') return GESTOR;
    const p = l.profissionalMap.get(id);
    if (!p || !p.ativo) return GESTOR;
    return { id: p.id, nome: p.nome, perfil: p.perfil || 'tecnico', profissionalId: p.id };
  }, [id, l.profissionalMap]);

  const entrar = useCallback(
    (novo: string, pin?: string) => {
      const esperado = novo === 'gestor' ? l.empresa.pinGestor : l.profissionalMap.get(novo)?.pin;
      if (esperado && esperado !== (pin || '')) return 'PIN incorreto.';
      setId(novo);
      try {
        localStorage.setItem(KEY, novo);
      } catch {
        /* armazenamento indisponível */
      }
      return null;
    },
    [l.empresa.pinGestor, l.profissionalMap],
  );

  const pode = useCallback<Sessao['pode']>(
    (acao) => {
      const p = usuario.perfil;
      if (p === 'gestor') return true;
      if (p === 'supervisor') return acao !== 'configurar';
      return false;
    },
    [usuario.perfil],
  );

  return <Ctx.Provider value={{ usuario, entrar, pode }}>{children}</Ctx.Provider>;
}

/** Nome para registros de auditoria. */
export function assinaturaUsuario(u: Usuario): string {
  return u.perfil === 'gestor' && !u.profissionalId ? 'Gestor' : u.nome;
}
