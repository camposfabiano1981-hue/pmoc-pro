import { db, nextNumber, nowIso, uid } from '../db/db';
import { planoSugerido } from '../db/planosPadrao';
import type { Ambiente, Equipamento, Unidade } from '../db/types';
import { exportXlsx, readXlsx, type Cell } from './excel';
import { norm, parseNum, todayStr } from './format';
import { aplicarPlano } from './rotinas';

export type TipoAba = 'equipamentos' | 'ambientes' | 'ignorar';

export interface AbaDetectada {
  nome: string;
  tipo: TipoAba;
  headerRow: number;
  colunas: Record<string, number>;
  linhas: Cell[][];
}

const ALIASES: Record<string, string[]> = {
  codigo: ['codigo', 'cod', 'tag', 'cod.'],
  tipo: ['equip', 'equipamento', 'tipo', 'tipo de equipamento'],
  capacidade: ['potencia', 'capacidade', 'btu', 'capacidade btu', 'btu/h', 'capacidade (btu/h)'],
  marca: ['marca', 'fabricante'],
  modelo: ['modelo'],
  serie: ['serie', 'n serie', 'numero de serie', 'nº serie', 'n° serie', 'nº de serie'],
  patrimonio: ['pat', 'patrimonio', 'pat.'],
  unidade: ['area', 'unidade', 'grupo de areas', 'unidade de manutencao', 'site', 'area '],
  local: ['local', 'grupo', 'setor', 'identificacao ambiente', 'identificacao do ambiente'],
  sublocal: ['sublocal', 'ambiente', 'localizacao', 'sala'],
  centroCusto: ['c. custo', 'c.custo', 'centro de custo', 'cc'],
  observacao: ['observacao', 'obs', 'observacoes'],
  fluido: ['fluido', 'gas', 'refrigerante'],
  tipoAtividade: ['tipo atividade', 'tipo de atividade', 'atividade'],
  fixos: ['ocupantes', 'fixos', 'ocupantes fixos'],
  flutuantes: ['flutuantes', 'ocupantes flutuantes'],
  areaM2: ['area climatizada', 'climatizada total', 'area m2', 'area (m2)', 'area climatizada total'],
};

function mapHeader(row: Cell[]): Record<string, number> {
  const cols: Record<string, number> = {};
  row.forEach((c, i) => {
    const h = norm(c).replace(/\s+/g, ' ');
    if (!h) return;
    for (const [k, al] of Object.entries(ALIASES)) {
      if (cols[k] !== undefined) continue;
      if (al.includes(h)) {
        cols[k] = i;
        return;
      }
    }
  });
  return cols;
}

export async function analisarPlanilha(file: File): Promise<AbaDetectada[]> {
  const sheets = await readXlsx(file);
  const out: AbaDetectada[] = [];
  for (const s of sheets) {
    let found: AbaDetectada | null = null;
    for (let r = 0; r < Math.min(15, s.rows.length); r++) {
      const cols = mapHeader(s.rows[r] || []);
      const isEquip = cols.tipo !== undefined && (cols.capacidade !== undefined || cols.marca !== undefined) && (cols.codigo !== undefined || cols.patrimonio !== undefined || cols.marca !== undefined);
      const isAmb = !isEquip && cols.local !== undefined && (cols.tipoAtividade !== undefined || cols.sublocal !== undefined) && cols.unidade !== undefined;
      if (isEquip || isAmb) {
        // linha seguinte pode conter subcabeçalho (ex.: Fixos | Flutuantes)
        const next = (s.rows[r + 1] || []).map((c) => norm(c));
        if (isAmb && next.includes('fixos')) {
          const fi = next.indexOf('fixos');
          cols.fixos = fi;
          const fl = next.indexOf('flutuantes');
          if (fl >= 0) cols.flutuantes = fl;
          const ct = next.findIndex((x) => x.startsWith('climatizada'));
          if (ct >= 0) cols.areaM2 = ct;
        }
        const linhas = s.rows.slice(r + 1).filter((row) => {
          const key = isEquip ? row[cols.tipo] : row[cols.local];
          const n = norm(key);
          return n && n !== 'fixos' && !n.startsWith('total');
        });
        found = { nome: s.name, tipo: isEquip ? 'equipamentos' : 'ambientes', headerRow: r, colunas: cols, linhas };
        break;
      }
    }
    if (found && found.linhas.length) out.push(found);
  }
  // Quando há abas de equipamentos, os ambientes já são criados a partir de Local/Sublocal;
  // abas de "relação de áreas" ficam desmarcadas por padrão para evitar duplicidade.
  if (out.some((a) => a.tipo === 'equipamentos')) out.forEach((a) => a.tipo === 'ambientes' && (a.tipo = 'ignorar'));
  return out;
}

export function tipoPadrao(raw: unknown): string {
  const t = norm(raw);
  if (/janela|acj/.test(t)) return 'Janela (ACJ)';
  if (/piso.?teto/.test(t)) return 'Split Piso-Teto';
  if (/cassete|cassette/.test(t)) return 'Split Cassete';
  if (/duto|built/.test(t)) return 'Split Duto (Built-in)';
  if (/multi/.test(t)) return 'Multi-Split';
  if (/vrf|vrv/.test(t)) return 'VRF/VRV - Evaporadora';
  if (/chiller/.test(t)) return 'Chiller';
  if (/fan ?coil|fancoil/.test(t)) return 'Fan Coil';
  if (/self/.test(t)) return 'Self Contained';
  if (/rooftop/.test(t)) return 'Rooftop';
  if (/camara|câmara/.test(t)) return 'Câmara Fria';
  if (/exaust|ventila/.test(t)) return 'Exaustor / Ventilador';
  if (/cortina/.test(t)) return 'Cortina de Ar';
  if (/bebedouro|purificador/.test(t)) return 'Bebedouro / Purificador';
  if (/portatil/.test(t)) return 'Portátil';
  if (/split|hi.?wall/.test(t)) return 'Split Hi-Wall';
  return 'Outro';
}

const cap = (s: unknown) => {
  const v = String(s ?? '').trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
};

export interface ResultadoImportacao {
  unidades: number;
  ambientes: number;
  equipamentos: number;
}

export async function importarAbas(abas: AbaDetectada[], clienteId: string, unidadePadrao: string): Promise<ResultadoImportacao> {
  const res: ResultadoImportacao = { unidades: 0, ambientes: 0, equipamentos: 0 };
  const unidades = await db.unidades.toArray();
  const ambientes = await db.ambientes.toArray();
  const planos = await db.planos.toArray();
  const ts = nowIso();
  const novasU: Unidade[] = [];
  const novosA: Ambiente[] = [];
  const novosE: Equipamento[] = [];

  const getUnidade = (nome: string): Unidade => {
    const n = norm(nome || unidadePadrao) || 'unidade importada';
    let u = [...unidades, ...novasU].find((x) => norm(x.nome) === n && x.clienteId === clienteId);
    if (!u) {
      u = { id: uid(), createdAt: ts, updatedAt: ts, clienteId, nome: cap(nome || unidadePadrao) || 'Unidade importada', ativo: true };
      novasU.push(u);
      res.unidades++;
    }
    return u;
  };
  const getAmbiente = (u: Unidade, grupo: string, nome: string, extra: Partial<Ambiente> = {}): Ambiente => {
    const nn = norm(nome) || 'geral';
    const ng = norm(grupo);
    let a = [...ambientes, ...novosA].find((x) => x.unidadeId === u.id && norm(x.nome) === nn && norm(x.grupo) === ng);
    if (!a) {
      a = { id: uid(), createdAt: ts, updatedAt: ts, unidadeId: u.id, grupo: cap(grupo) || undefined, nome: cap(nome) || 'Geral', localizacao: cap(nome) || undefined, ...extra };
      novosA.push(a);
      res.ambientes++;
    }
    return a;
  };

  for (const aba of abas) {
    if (aba.tipo === 'ignorar') continue;
    const c = aba.colunas;
    const get = (row: Cell[], k: string) => (c[k] !== undefined ? row[c[k]] : undefined);
    for (const row of aba.linhas) {
      const u = getUnidade(String(get(row, 'unidade') ?? '').trim());
      const local = String(get(row, 'local') ?? '').trim();
      const sub = String(get(row, 'sublocal') ?? '').trim();
      if (aba.tipo === 'ambientes') {
        getAmbiente(u, local, sub || local, {
          tipoAtividade: cap(get(row, 'tipoAtividade')) || undefined,
          ocupantesFixos: parseNum(get(row, 'fixos')),
          ocupantesFlutuantes: parseNum(get(row, 'flutuantes')),
          areaM2: parseNum(get(row, 'areaM2')),
        });
        continue;
      }
      const amb = getAmbiente(u, sub && local !== sub ? local : '', sub || local);
      const tipo = tipoPadrao(get(row, 'tipo'));
      const codigo = get(row, 'codigo');
      const obs = [get(row, 'observacao'), codigo !== undefined && codigo !== null && codigo !== '' ? `Código de origem: ${aba.nome} #${codigo}` : ''].filter(Boolean).join(' · ');
      novosE.push({
        id: uid(),
        createdAt: ts,
        updatedAt: ts,
        tag: await nextNumber('eq'),
        unidadeId: u.id,
        ambienteId: amb.id,
        tipo,
        marca: cap(String(get(row, 'marca') ?? '').toLowerCase()) || undefined,
        modelo: get(row, 'modelo') ? String(get(row, 'modelo')) : undefined,
        numeroSerie: get(row, 'serie') ? String(get(row, 'serie')) : undefined,
        patrimonio: get(row, 'patrimonio') !== undefined && get(row, 'patrimonio') !== null ? String(get(row, 'patrimonio')) : undefined,
        capacidadeBtu: parseNum(get(row, 'capacidade')),
        fluido: get(row, 'fluido') ? String(get(row, 'fluido')).toUpperCase().replace(/^R(\d)/, 'R-$1') : undefined,
        centroCusto: get(row, 'centroCusto') ? String(get(row, 'centroCusto')) : undefined,
        criticidade: 'B',
        status: 'operando',
        planoId: planoSugerido(tipo, planos)?.id,
        observacoes: obs || undefined,
      });
      res.equipamentos++;
    }
  }
  await db.transaction('rw', db.unidades, db.ambientes, db.equipamentos, async () => {
    if (novasU.length) await db.unidades.bulkAdd(novasU);
    if (novosA.length) await db.ambientes.bulkAdd(novosA);
    if (novosE.length) await db.equipamentos.bulkAdd(novosE);
  });
  // rotinas de manutenção (periodicidade por equipamento) a partir do plano sugerido
  const hoje = todayStr();
  await db.transaction('rw', db.equipamentos, db.rotinas, db.planos, async () => {
    for (const e of novosE) await aplicarPlano(e.id, hoje);
  });
  return res;
}

export async function baixarModelo(): Promise<void> {
  await exportXlsx(
    [
      {
        name: 'Equipamentos',
        headers: ['Codigo', 'Equip', 'Potencia', 'Marca', 'Modelo', 'Serie', 'Pat', 'Fluido', 'Area', 'Local', 'Sublocal', 'C. Custo', 'Observacao'],
        rows: [
          [1, 'SPLIT', 12000, 'LG', 'S4-Q12', 'ABC123', '7796', 'R-410A', 'Escritório Central', 'Administrativo', 'Sala RH', 'CC-100', ''],
          [2, 'JANELA', 10000, 'Consul', '', '', 'S/PAT', 'R-22', 'Escritório Central', 'Apoio', 'Copa', 'CC-101', ''],
        ],
      },
      {
        name: 'Ambientes',
        headers: ['Area', 'Identificacao ambiente', 'Localizacao', 'Tipo atividade', 'Ocupantes fixos', 'Ocupantes flutuantes', 'Area climatizada'],
        rows: [['Escritório Central', 'Administrativo', 'Sala RH', 'Escritório', 4, 2, 35.7]],
      },
    ],
    'modelo-importacao-pmoc-pro.xlsx',
  );
}
