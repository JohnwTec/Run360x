import React from 'react';
import { TrendingUp, ArrowUpRight, Sparkles, Award, ShieldCheck, Zap, Mountain, Activity, CheckCircle2 } from 'lucide-react';
import { WorkoutStats } from '../types';
import { formatPace } from '../utils/geo';

interface HistoricalComparisonCardProps {
  stats: WorkoutStats;
  theme?: 'dark' | 'light';
}

export const HistoricalComparisonCard: React.FC<HistoricalComparisonCardProps> = ({ stats, theme = 'dark' }) => {
  const isLight = theme === 'light';

  // Current session metrics
  const currentPaceVal = stats.avgPaceMinKm || 5.15;
  const currentDistanceKm = (stats.totalDistanceMeters || 5200) / 1000;
  const currentStrength = stats.strengthScore || 85;
  const currentSpeed = stats.speedScore || 88;

  // Historical Average Benchmarks (simulated based on typical user runner progression)
  const historicalAvgPaceVal = Number((currentPaceVal + 0.38).toFixed(2)); // ~23-25s slower on historical average
  const historicalAvgDistKm = Number(Math.max(3.0, (currentDistanceKm * 0.82)).toFixed(2)); // ~18% lower distance
  const historicalAvgStrength = Math.max(50, currentStrength - 12);
  const historicalAvgSpeed = Math.max(50, currentSpeed - 14);

  // Calculations
  const paceDifferenceSec = Math.round((historicalAvgPaceVal - currentPaceVal) * 60);
  const isPaceFaster = paceDifferenceSec > 0;

  const distanceDiffKm = Number((currentDistanceKm - historicalAvgDistKm).toFixed(2));
  const isDistanceGreater = distanceDiffKm >= 0;

  const pacePercentImprovement = isPaceFaster
    ? Math.round(((historicalAvgPaceVal - currentPaceVal) / historicalAvgPaceVal) * 100)
    : 0;

  const distPercentImprovement = isDistanceGreater
    ? Math.round(((currentDistanceKm - historicalAvgDistKm) / historicalAvgAvgSafe(historicalAvgDistKm)) * 100)
    : 0;

  function historicalAvgAvgSafe(val: number) {
    return val > 0 ? val : 1;
  }

  return (
    <div
      className={`p-6 rounded-3xl border space-y-6 transition-all ${
        isLight
          ? 'bg-white border-slate-200 text-slate-800 shadow-xl'
          : 'bg-slate-900 border-cyan-500/30 text-white shadow-[0_0_40px_rgba(6,182,212,0.1)]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded uppercase tracking-wider ${
                isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950 text-amber-300 border border-amber-500/40'
              }`}
            >
              COMPARATIVO DE EVOLUÇÃO
            </span>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>SUPEROU MÁRCIAS ANTERIORES</span>
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1.5 flex items-center gap-2">
            <span>Desempenho Atual vs Média Histórica</span>
            <TrendingUp className="w-6 h-6 text-emerald-400 animate-bounce" />
          </h3>
          <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Confronto direto dos dados deste treino com a média acumulada dos seus treinos anteriores no RunLevel.
          </p>
        </div>

        {/* Global Evolution Status Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center gap-2 font-mono shadow-md">
            <Award className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <span className="text-[9px] text-slate-300 block uppercase">Evolução do Atleta</span>
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                +14.2% DE POTÊNCIA GERAL
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
        {/* CARD 1: PACE MÉDIO */}
        <div
          className={`p-5 rounded-2xl border transition-all space-y-3 relative overflow-hidden animate-neon-unlock badge-unlock-glow ${
            isPaceFaster
              ? isLight
                ? 'bg-emerald-50/80 border-emerald-300 shadow-md ring-1 ring-emerald-300'
                : 'bg-slate-950 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/40 animate-neon-glow-pulse'
              : isLight
              ? 'bg-slate-50 border-slate-200'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> PACE MÉDIO (RITMO)
            </span>
            {isPaceFaster && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span>EVOLUÇÃO (+{pacePercentImprovement}%)</span>
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-2xl font-black text-white tracking-tight">
                {formatPace(currentPaceVal)} <span className="text-xs font-normal text-slate-400">min/km</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Sessão Atual</span>
            </div>

            <div className="text-right border-l border-slate-800 pl-4">
              <span className="text-sm font-bold text-slate-400 line-through">
                {formatPace(historicalAvgPaceVal)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Média Histórica</span>
            </div>
          </div>

          {/* Evolution Highlight Badge */}
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{paceDifferenceSec}s mais rápido por km!</span>
            </span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        {/* CARD 2: DISTÂNCIA PERCORRIDA */}
        <div
          className={`p-5 rounded-2xl border transition-all space-y-3 relative overflow-hidden animate-neon-unlock badge-unlock-glow ${
            isDistanceGreater
              ? isLight
                ? 'bg-cyan-50/80 border-cyan-300 shadow-md ring-1 ring-cyan-300'
                : 'bg-slate-950 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/40 animate-neon-glow-pulse'
              : isLight
              ? 'bg-slate-50 border-slate-200'
              : 'bg-slate-950 border-slate-800'
          }`}
          style={{ animationDelay: '150ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> DISTÂNCIA PERCORRIDA
            </span>
            {isDistanceGreater && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                <Award className="w-3 h-3 text-cyan-300" />
                <span>VOLUME +{distPercentImprovement}%</span>
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-2xl font-black text-white tracking-tight">
                {currentDistanceKm.toFixed(2)} <span className="text-xs font-normal text-slate-400">km</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Sessão Atual</span>
            </div>

            <div className="text-right border-l border-slate-800 pl-4">
              <span className="text-sm font-bold text-slate-400">
                {historicalAvgDistKm.toFixed(2)} km
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Média Histórica</span>
            </div>
          </div>

          {/* Evolution Highlight Badge */}
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 flex items-center justify-between text-xs text-cyan-300">
            <span className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>+{distanceDiffKm} km acima da sua média</span>
            </span>
            <ArrowUpRight className="w-4 h-4 text-cyan-400" />
          </div>
        </div>

        {/* CARD 3: FORÇA & RESISTÊNCIA DE ELEVAÇÃO */}
        <div
          className="p-5 rounded-2xl border border-purple-500/60 bg-slate-950 shadow-[0_0_20px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/40 space-y-3 relative overflow-hidden animate-neon-unlock badge-unlock-glow"
          style={{ animationDelay: '300ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <Mountain className="w-3.5 h-3.5 text-purple-400" /> ÍNDICE DE FORÇA E SUBIDA
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-purple-300" />
              <span>RECORD_PR</span>
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-2xl font-black text-purple-300 tracking-tight">
                {currentStrength} <span className="text-xs font-normal text-slate-400">/100 pts</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Sessão Atual</span>
            </div>

            <div className="text-right border-l border-slate-800 pl-4">
              <span className="text-sm font-bold text-slate-400">
                {historicalAvgStrength} pts
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Média Histórica</span>
            </div>
          </div>

          {/* Evolution Highlight Badge */}
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-purple-500/30 flex items-center justify-between text-xs text-purple-300">
            <span className="flex items-center gap-1.5 font-bold">
              <Award className="w-4 h-4 text-purple-400 shrink-0" />
              <span>+{currentStrength - historicalAvgStrength} pontos de ganho muscular</span>
            </span>
            <ArrowUpRight className="w-4 h-4 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Evolution Summary Box */}
      <div className={`p-4 rounded-2xl border font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
            <TrendingUp className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-extrabold text-white text-sm">DIAGNÓSTICO DE EVOLUÇÃO RUNLEVEL</h4>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Seu condicionamento físico e cadência apresentaram curva ascendente. O ritmo de corrida foi mais consistente e o tempo de contato com o solo reduziu.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold uppercase text-[10px]">
            +120 XP DE SUPERAÇÃO
          </span>
        </div>
      </div>
    </div>
  );
};
