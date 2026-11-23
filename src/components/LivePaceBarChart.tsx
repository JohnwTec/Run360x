import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { BarChart3, Target } from 'lucide-react';
import { formatPace } from '../utils/geo';

export interface LivePaceSample {
  id: string;
  timeLabel: string;
  elapsedSeconds: number;
  pace: number; // min/km
  targetPace: number; // min/km
  deltaSeconds: number; // positive = slower than target, negative = faster than target
  status: 'fast' | 'on_target' | 'slow' | 'critical';
}

interface LivePaceBarChartProps {
  samples: LivePaceSample[];
  targetPaceMinKm: number;
  theme?: 'dark' | 'light';
}

const getBarColor = (status: LivePaceSample['status'], isLight: boolean): string => {
  switch (status) {
    case 'fast':
      return isLight ? '#0284c7' : '#22d3ee'; // Sky / Cyan (Faster than target)
    case 'on_target':
      return isLight ? '#059669' : '#10b981'; // Emerald (Consistent / On target)
    case 'slow':
      return '#f59e0b'; // Amber (Slightly slower)
    case 'critical':
      return '#f43f5e'; // Rose (Significantly slower)
  }
};

const getStatusLabel = (status: LivePaceSample['status']): string => {
  switch (status) {
    case 'fast':
      return 'Ritmo Forte (Abaixo do Alvo)';
    case 'on_target':
      return 'Consistente (Na Zona Alvo)';
    case 'slow':
      return 'Levemente Acima do Alvo';
    case 'critical':
      return 'Abaixo da Meta — Acelere';
  }
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: LivePaceSample }>;
  isLight: boolean;
}

const PaceTooltip: React.FC<CustomTooltipProps> = ({ active, payload, isLight }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  const deltaSign = item.deltaSeconds > 0 ? '+' : '';

  return (
    <div
      className={`px-3 py-2 rounded-xl border text-[11px] font-mono shadow-xl space-y-1 ${
        isLight
          ? 'bg-white/95 border-slate-200 text-slate-800'
          : 'bg-slate-950/95 border-cyan-500/40 text-slate-100'
      }`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800 pb-1">
        <span className="font-bold opacity-75">Tempo {item.timeLabel}</span>
        <span className="font-black" style={{ color: getBarColor(item.status, isLight) }}>
          {formatPace(item.pace)}/km
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-[10px]">
        <span className="opacity-75">Alvo: {formatPace(item.targetPace)}/km</span>
        <span
          className={`font-bold ${
            item.deltaSeconds <= 15
              ? 'text-emerald-500'
              : item.deltaSeconds <= 35
              ? 'text-amber-500'
              : 'text-rose-500'
          }`}
        >
          {deltaSign}
          {item.deltaSeconds}s/km
        </span>
      </div>
      <p className="text-[10px] font-bold pt-0.5" style={{ color: getBarColor(item.status, isLight) }}>
        {getStatusLabel(item.status)}
      </p>
    </div>
  );
};

export const LivePaceBarChart: React.FC<LivePaceBarChartProps> = ({
  samples,
  targetPaceMinKm,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  // Calculate consistency KPI metrics
  const { consistencyPercent, avgPace, bestPace, minDomain, maxDomain } = React.useMemo(() => {
    if (samples.length === 0) {
      return {
        consistencyPercent: 100,
        avgPace: targetPaceMinKm,
        bestPace: targetPaceMinKm,
        minDomain: Math.max(2.5, Number((targetPaceMinKm - 1.2).toFixed(2))),
        maxDomain: Number((targetPaceMinKm + 1.2).toFixed(2)),
      };
    }

    const consistentCount = samples.filter(
      (s) => s.status === 'on_target' || s.status === 'fast'
    ).length;
    const sumPace = samples.reduce((acc, s) => acc + s.pace, 0);
    const minP = Math.min(...samples.map((s) => s.pace), targetPaceMinKm);
    const maxP = Math.max(...samples.map((s) => s.pace), targetPaceMinKm);

    return {
      consistencyPercent: Math.round((consistentCount / samples.length) * 100),
      avgPace: sumPace / samples.length,
      bestPace: Math.min(...samples.map((s) => s.pace)),
      minDomain: Math.max(2.0, Number((minP - 0.6).toFixed(2))),
      maxDomain: Number((maxP + 0.6).toFixed(2)),
    };
  }, [samples, targetPaceMinKm]);

  const consistencyColor =
    consistencyPercent >= 75
      ? isLight
        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
        : 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
      : consistencyPercent >= 45
      ? isLight
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
      : isLight
      ? 'bg-rose-100 text-rose-800 border-rose-300'
      : 'bg-rose-950/70 text-rose-300 border-rose-500/40';

  return (
    <div
      className={`p-3.5 rounded-2xl border space-y-3 transition-colors ${
        isLight
          ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
          : 'bg-slate-900/90 border-slate-800 text-slate-100'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center border ${
              isLight
                ? 'bg-orange-50 border-orange-200 text-orange-600'
                : 'bg-cyan-950 border-cyan-500/40 text-cyan-400'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-[11px] font-mono font-black uppercase tracking-wide">
              VARIAÇÃO DO PACE (MIN/KM)
            </h4>
            <p className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Consistência ao vivo vs. Alvo {formatPace(targetPaceMinKm)}/km
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 font-mono">
          <span
            className={`px-2 py-0.5 rounded-lg border text-[10px] font-black flex items-center gap-1 ${consistencyColor}`}
            title="Porcentagem de parciais dentro ou abaixo do pace alvo"
          >
            <Target className="w-3 h-3" />
            <span>{consistencyPercent}% NO ALVO</span>
          </span>
        </div>
      </div>

      {/* Session Mini-Metrics */}
      <div
        className={`grid grid-cols-3 gap-2 p-2 rounded-xl border text-center font-mono ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800/80'
        }`}
      >
        <div>
          <span className="text-[9px] uppercase opacity-65 block">Pace Alvo</span>
          <span className={`text-xs font-black ${isLight ? 'text-orange-600' : 'text-amber-400'}`}>
            {formatPace(targetPaceMinKm)}
          </span>
        </div>
        <div className="border-x border-slate-200 dark:border-slate-800">
          <span className="text-[9px] uppercase opacity-65 block">Média Sessão</span>
          <span className={`text-xs font-black ${isLight ? 'text-slate-800' : 'text-cyan-300'}`}>
            {formatPace(avgPace)}
          </span>
        </div>
        <div>
          <span className="text-[9px] uppercase opacity-65 block">Melhor Pace</span>
          <span className="text-xs font-black text-emerald-500">{formatPace(bestPace)}</span>
        </div>
      </div>

      {/* Recharts BarChart */}
      <div className="w-full h-44">
        {samples.length === 0 ? (
          <div
            className={`w-full h-full rounded-xl border border-dashed flex items-center justify-center text-xs font-mono ${
              isLight ? 'border-slate-300 text-slate-500' : 'border-slate-800 text-slate-500'
            }`}
          >
            Coletando parciais de pace da sessão...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={samples} margin={{ top: 10, right: 12, left: -14, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isLight ? '#e2e8f0' : '#1e293b'}
              />
              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 10, fill: isLight ? '#64748b' : '#94a3b8', fontFamily: 'monospace' }}
                axisLine={{ stroke: isLight ? '#cbd5e1' : '#334155' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minDomain, maxDomain]}
                tickFormatter={(v: number) => formatPace(v)}
                tick={{ fontSize: 10, fill: isLight ? '#64748b' : '#94a3b8', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={<PaceTooltip isLight={isLight} />}
                cursor={{ fill: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(34, 211, 238, 0.08)' }}
              />
              <ReferenceLine
                y={targetPaceMinKm}
                stroke={isLight ? '#ea580c' : '#f59e0b'}
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `ALVO ${formatPace(targetPaceMinKm)}`,
                  position: 'insideTopRight',
                  fill: isLight ? '#ea580c' : '#fbbf24',
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              />
              <Bar
                dataKey="pace"
                radius={[5, 5, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              >
                {samples.map((entry) => (
                  <Cell key={entry.id} fill={getBarColor(entry.status, isLight)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Compact Color Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800/80 text-[10px] font-mono">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block" />
            <span className="opacity-80">Forte</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            <span className="opacity-80">No Alvo</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
            <span className="opacity-80">Lento</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            <span className="opacity-80">Crítico</span>
          </span>
        </div>
        <span className="opacity-70 flex items-center gap-1">
          <span className="w-3 border-t-2 border-dashed border-amber-500 inline-block" />
          <span>Meta</span>
        </span>
      </div>
    </div>
  );
};
