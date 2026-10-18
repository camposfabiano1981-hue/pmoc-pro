import { useEffect, useState } from 'react';
import {
  BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler);

/** Paleta categórica validada (ordem fixa) e tinta de gráfico, claro/escuro. */
const THEME = {
  light: { series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'], ink: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', surface: '#ffffff', good: '#0ca30c', critical: '#d03b3b' },
  dark: { series: ['#3987e5', '#d95926', '#199e70', '#c98500'], ink: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835', surface: '#0f172a', good: '#0ca30c', critical: '#d03b3b' },
};

export function useChartTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark ? THEME.dark : THEME.light;
}

type T = ReturnType<typeof useChartTheme>;

function baseOptions(t: T, opts: { stacked?: boolean; yFmt?: (v: number) => string; legend?: boolean; horizontal?: boolean }): ChartOptions<'bar' | 'line'> {
  const fmt = opts.yFmt || ((v: number) => v.toLocaleString('pt-BR'));
  const valueAxis = {
    stacked: opts.stacked,
    beginAtZero: true,
    grid: { color: t.grid, drawTicks: false },
    border: { display: false },
    ticks: { color: t.muted, padding: 6, font: { size: 11 }, callback: (v: string | number) => fmt(Number(v)), precision: 0 },
  };
  const catAxis = {
    stacked: opts.stacked,
    grid: { display: false },
    border: { color: t.axis },
    ticks: { color: t.muted, font: { size: 11 } },
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: opts.horizontal ? 'y' : 'x',
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: !!opts.legend, position: 'top', align: 'start', labels: { color: t.ink, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 12 } } },
      tooltip: {
        backgroundColor: t.surface === '#ffffff' ? '#0b0b0b' : '#f0efec',
        titleColor: t.surface === '#ffffff' ? '#f0efec' : '#0b0b0b',
        bodyColor: t.surface === '#ffffff' ? '#f0efec' : '#0b0b0b',
        padding: 10,
        cornerRadius: 8,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt(Number(ctx.parsed[opts.horizontal ? 'x' : 'y']))}` },
      },
    },
    scales: opts.horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
  } as ChartOptions<'bar' | 'line'>;
}

export function BarChart({ labels, series, stacked, yFmt, height = 240, horizontal }: { labels: string[]; series: { label: string; data: number[]; color?: string }[]; stacked?: boolean; yFmt?: (v: number) => string; height?: number; horizontal?: boolean }) {
  const t = useChartTheme();
  const data = {
    labels,
    datasets: series.map((s, i) => ({
      label: s.label,
      data: s.data,
      backgroundColor: s.color || t.series[i % t.series.length],
      borderRadius: 4,
      borderSkipped: 'start' as const,
      borderColor: t.surface,
      borderWidth: stacked ? { top: 2 } : 0,
      maxBarThickness: 28,
      categoryPercentage: 0.7,
      barPercentage: 0.9,
    })),
  };
  return (
    <div style={{ height }}>
      <Bar data={data} options={baseOptions(t, { stacked, yFmt, legend: series.length > 1, horizontal }) as ChartOptions<'bar'>} />
    </div>
  );
}

export function LineChart({ labels, series, yFmt, height = 240, yMax }: { labels: string[]; series: { label: string; data: (number | null)[]; color?: string }[]; yFmt?: (v: number) => string; height?: number; yMax?: number }) {
  const t = useChartTheme();
  const data = {
    labels,
    datasets: series.map((s, i) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color || t.series[i % t.series.length],
      backgroundColor: (s.color || t.series[i % t.series.length]) + '1f',
      fill: series.length === 1,
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: s.color || t.series[i % t.series.length],
      pointBorderColor: t.surface,
      pointBorderWidth: 2,
      tension: 0.2,
      cubicInterpolationMode: 'monotone' as const,
      spanGaps: true,
    })),
  };
  const opts = baseOptions(t, { yFmt, legend: series.length > 1 }) as ChartOptions<'line'>;
  if (yMax !== undefined && opts.scales?.y) (opts.scales.y as { max?: number }).max = yMax;
  return (
    <div style={{ height }}>
      <Line data={data} options={opts} />
    </div>
  );
}
