/**
 * Tabelas de saturação pressão × temperatura (geradas com CoolProp).
 * Formato: [temperatura °C, pressão de orvalho psig, pressão de bolha psig].
 * Para misturas zeotrópicas (R-407C, R-404A) usa-se o ponto de orvalho no
 * superaquecimento e o ponto de bolha no sub-resfriamento.
 */
export const PT_TABLES: Record<string, [number, number, number][]> = {
  'R-410A': [[-40,10.7,10.8],[-35,16.9,17.1],[-30,24.4,24.5],[-25,33.1,33.2],[-20,43.2,43.4],[-15,54.9,55.2],[-10,68.4,68.6],[-5,83.7,84.0],[0,101.1,101.4],[5,120.6,121.1],[10,142.6,143.2],[15,167.2,167.8],[20,194.6,195.3],[25,224.9,225.7],[30,258.5,259.3],[35,295.5,296.4],[40,336.1,337.1],[50,429.5,430.7],[55,483.0,484.1],[60,541.4,542.5],[65,605.5,606.4]],
  'R-32': [[-40,11.0,11.0],[-35,17.4,17.4],[-30,25.0,25.0],[-25,33.8,33.8],[-20,44.2,44.2],[-15,56.1,56.1],[-10,69.8,69.8],[-5,85.5,85.5],[0,103.2,103.2],[5,123.3,123.3],[10,145.8,145.8],[15,171.1,171.1],[20,199.2,199.2],[25,230.4,230.4],[30,264.9,264.9],[35,302.9,302.9],[40,344.8,344.8],[45,390.7,390.7],[50,440.9,440.9],[55,495.8,495.8],[60,555.8,555.8],[65,621.2,621.2],[70,692.6,692.6]],
  'R-22': [[-40,0.6,0.6],[-35,4.5,4.5],[-30,9.1,9.1],[-25,14.5,14.5],[-20,20.9,20.9],[-15,28.3,28.3],[-10,36.8,36.8],[-5,46.5,46.5],[0,57.5,57.5],[5,70.0,70.0],[10,84.1,84.1],[15,99.8,99.8],[20,117.3,117.3],[25,136.7,136.7],[30,158.2,158.2],[35,181.8,181.8],[40,207.7,207.7],[45,236.1,236.1],[50,267.1,267.1],[55,300.8,300.8],[60,337.4,337.4],[65,377.1,377.1],[70,420.0,420.0]],
  'R-134a': [[-40,-7.3,-7.3],[-35,-5.1,-5.1],[-30,-2.5,-2.5],[-25,0.7,0.7],[-20,4.6,4.6],[-15,9.1,9.1],[-10,14.4,14.4],[-5,20.6,20.6],[0,27.8,27.8],[5,36.0,36.0],[10,45.4,45.4],[15,56.1,56.1],[20,68.2,68.2],[25,81.8,81.8],[30,97.0,97.0],[35,113.9,113.9],[40,132.7,132.7],[45,153.5,153.5],[50,176.5,176.5],[55,201.6,201.6],[60,229.2,229.2],[65,259.4,259.4],[70,292.3,292.3]],
  'R-404A': [[-40,4.3,4.9],[-35,9.0,9.7],[-30,14.6,15.4],[-25,21.2,22.1],[-20,28.8,29.8],[-15,37.7,38.8],[-10,47.8,49.0],[-5,59.3,60.6],[0,72.4,73.8],[5,87.1,88.6],[10,103.6,105.3],[15,122.1,123.8],[20,142.6,144.4],[25,165.3,167.3],[30,190.4,192.5],[35,218.1,220.2],[40,248.5,250.6],[45,281.8,284.0],[50,318.3,320.4],[55,358.1,360.2],[60,401.7,403.7],[65,449.5,451.2]],
  'R-407C': [[-40,-2.3,2.7],[-35,1.2,7.2],[-30,5.4,12.4],[-25,10.5,18.7],[-20,16.4,25.9],[-15,23.5,34.3],[-10,31.7,44.0],[-5,41.2,55.1],[0,52.1,67.7],[5,64.6,81.9],[10,78.8,97.9],[15,94.9,115.8],[20,113.0,135.8],[25,133.2,157.9],[30,155.9,182.4],[35,181.0,209.4],[40,208.9,239.0],[45,239.6,271.4],[50,273.6,306.7],[60,352.1,386.9],[65,397.2,432.2],[70,446.9,481.2]],
  'R-507A': [[-40,5.4,5.4],[-35,10.3,10.4],[-30,16.2,16.2],[-25,23.0,23.0],[-20,30.9,30.9],[-15,40.0,40.1],[-10,50.5,50.5],[-5,62.4,62.4],[0,75.8,75.9],[5,90.9,91.0],[10,107.9,108.0],[15,126.8,127.0],[20,147.9,148.0],[25,171.2,171.3],[30,196.9,197.1],[35,225.2,225.4],[40,256.2,256.5],[45,290.3,290.5],[50,327.5,327.8],[60,412.7,413.0]],
  'R-290': [[-40,1.4,1.4],[-35,5.2,5.2],[-30,9.6,9.6],[-25,14.8,14.8],[-20,20.8,20.8],[-15,27.6,27.6],[-10,35.4,35.4],[-5,44.2,44.2],[0,54.1,54.1],[5,65.2,65.2],[10,77.6,77.6],[15,91.4,91.4],[20,106.6,106.6],[25,123.4,123.4],[30,141.8,141.8],[35,161.9,161.9],[40,183.9,183.9],[45,207.8,207.8],[50,233.8,233.8],[55,261.9,261.9],[60,292.3,292.3],[65,325.1,325.1],[70,360.5,360.5]],
  'R-600a': [[-40,-10.5,-10.5],[-35,-9.4,-9.4],[-30,-7.9,-7.9],[-25,-6.2,-6.2],[-20,-4.2,-4.2],[-15,-1.8,-1.8],[-10,1.0,1.0],[-5,4.3,4.3],[0,8.1,8.1],[5,12.4,12.4],[10,17.3,17.3],[15,22.9,22.9],[20,29.1,29.1],[25,36.2,36.2],[30,44.0,44.0],[35,52.7,52.7],[40,62.3,62.3],[45,73.0,73.0],[50,84.6,84.6],[55,97.4,97.4],[60,111.4,111.4],[65,126.5,126.5],[70,143.0,143.0]],
  'R-1234yf': [[-40,-5.7,-5.7],[-35,-3.3,-3.3],[-30,-0.3,-0.3],[-25,3.1,3.1],[-20,7.2,7.2],[-15,11.9,11.9],[-10,17.5,17.5],[-5,23.8,23.8],[0,31.1,31.1],[5,39.4,39.4],[10,48.8,48.8],[15,59.3,59.3],[20,71.1,71.1],[25,84.3,84.3],[30,99.0,99.0],[35,115.2,115.2],[40,133.0,133.0],[45,152.7,152.7],[50,174.2,174.2],[55,197.7,197.7],[60,223.4,223.4],[65,251.4,251.4],[70,281.8,281.8]],
};

function interp(rows: [number, number, number][], psig: number, col: 1 | 2): number | null {
  if (!rows.length) return null;
  if (psig <= rows[0][col]) return rows[0][0];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (psig <= b[col]) return a[0] + ((psig - a[col]) * (b[0] - a[0])) / (b[col] - a[col]);
  }
  return rows[rows.length - 1][0];
}

/** Temperatura de saturação (°C) a partir da pressão manométrica (psig). */
export function tSat(fluido: string | undefined, psig: number, tipo: 'orvalho' | 'bolha' = 'orvalho'): number | null {
  const rows = fluido ? PT_TABLES[fluido] : undefined;
  if (!rows || !isFinite(psig)) return null;
  return interp(rows, psig, tipo === 'orvalho' ? 1 : 2);
}

const num = (v?: string) => {
  if (v === undefined || v === null || v === '') return NaN;
  return Number(String(v).replace(',', '.'));
};

export interface Diagnostico {
  deltaT?: number;
  superaquecimento?: number;
  subresfriamento?: number;
  tSatSuccao?: number;
  tSatDescarga?: number;
  cargaPct?: number;
  alertas: string[];
}

/** Diagnóstico termodinâmico e elétrico a partir das medições de campo. */
export function diagnosticar(
  m: { tensao?: string; corrente?: string; tInsuflamento?: string; tRetorno?: string; pSuccao?: string; pDescarga?: string; tLinhaSuccao?: string; tLinhaLiquido?: string },
  fluido?: string,
  correnteNominal?: number,
  tensaoNominal?: string,
): Diagnostico {
  const out: Diagnostico = { alertas: [] };
  const ti = num(m.tInsuflamento);
  const tr = num(m.tRetorno);
  if (isFinite(ti) && isFinite(tr)) {
    out.deltaT = Math.round((tr - ti) * 10) / 10;
    if (out.deltaT < 8) out.alertas.push(`ΔT baixo (${out.deltaT} K): possível falta de fluido, filtro/serpentina suja ou compressor ineficiente.`);
    else if (out.deltaT > 14) out.alertas.push(`ΔT alto (${out.deltaT} K): possível baixa vazão de ar (filtro/turbina) ou excesso de fluido.`);
  }
  const ps = num(m.pSuccao);
  const tls = num(m.tLinhaSuccao);
  if (isFinite(ps)) {
    const sat = tSat(fluido, ps, 'orvalho');
    if (sat !== null) {
      out.tSatSuccao = Math.round(sat * 10) / 10;
      if (isFinite(tls)) {
        out.superaquecimento = Math.round((tls - sat) * 10) / 10;
        if (out.superaquecimento < 4) out.alertas.push(`Superaquecimento baixo (${out.superaquecimento} K): risco de retorno de líquido ao compressor / excesso de carga.`);
        else if (out.superaquecimento > 14) out.alertas.push(`Superaquecimento alto (${out.superaquecimento} K): possível falta de fluido ou restrição no dispositivo de expansão.`);
      }
    }
  }
  const pd = num(m.pDescarga);
  const tll = num(m.tLinhaLiquido);
  if (isFinite(pd)) {
    const sat = tSat(fluido, pd, 'bolha');
    if (sat !== null) {
      out.tSatDescarga = Math.round(sat * 10) / 10;
      if (isFinite(tll)) {
        out.subresfriamento = Math.round((sat - tll) * 10) / 10;
        if (out.subresfriamento < 3) out.alertas.push(`Sub-resfriamento baixo (${out.subresfriamento} K): possível falta de fluido.`);
        else if (out.subresfriamento > 12) out.alertas.push(`Sub-resfriamento alto (${out.subresfriamento} K): possível excesso de fluido ou restrição na linha de líquido.`);
      }
    }
  }
  const i = num(m.corrente);
  if (isFinite(i) && correnteNominal) {
    out.cargaPct = Math.round((i / correnteNominal) * 100);
    if (out.cargaPct > 110) out.alertas.push(`Corrente ${out.cargaPct}% da nominal: sobrecarga — verificar condensador, tensão e compressor.`);
  }
  const v = num(m.tensao);
  const vn = Number(String(tensaoNominal || '').replace(/\D/g, ''));
  if (isFinite(v) && vn > 0) {
    const desvio = ((v - vn) / vn) * 100;
    if (Math.abs(desvio) > 10) out.alertas.push(`Tensão ${v} V fora da faixa de ±10% da nominal (${vn} V).`);
  }
  return out;
}
