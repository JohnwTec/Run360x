import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Camera,
  Flame,
  Gauge,
  Play,
  Route,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { UserProfile } from '../types';
import { formatPace } from '../utils/geo';
import { ResolvedDevice } from '../utils/deviceMode';

type TimeRange = '7d' | '30d' | 'semestre' | 'ano';

interface PerformanceAnalyticsDashboardProps {
  userProfile: UserProfile;
  activeDevice: ResolvedDevice;
  onStartNewMission: () => void;
  onOpenCommunityCamera: () => void;
  theme?: 'dark' | 'light';
}

interface SeriesPoint {
  label: string;
  km: number;
  pace: number;
  speedKmh: number;
  targetPace: number;
  hrAvg: number;
  xp: number;
}

const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: '7d', label: '7 Dias' },
  { id: '30d', label: '30 Dias' },
  { id: 'semestre', label: 'Semestre' },
  { id: 'ano', label: 'Ano' },
];

export const PerformanceAnalyticsDashboard: React.FC<PerformanceAnalyticsDashboardProps> = ({
  userProfile,
  activeDevice,
  onStartNewMission,
  onOpenCommunityCamera,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const isPhoneLayout = activeDevice === 'smartphone';
  const [range, setRange] = useState<TimeRange>('30d');

  // Merge user's real completed workout history with structured progression series per selected timeframe
  const seriesData: SeriesPoint[] = useMemo(() => {
    const history = userProfile.history || [];
    const baseKmScale = Math.max(0.85, Math.min(2.2, (userProfile.totalDistanceKm || 12) / 15));

    if (range === '7d') {
      const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
      const template: SeriesPoint[] = [
        { label: days[0], km: 4.8, pace: 5.38, speedKmh: 11.2, targetPace: 5.2, hrAvg: 148, xp: 240 },
        { label: days[1], km: 0, pace: 5.32, speedKmh: 0, targetPace: 5.2, hrAvg: 0, xp: 0 },
        { label: days[2], km: 6.2, pace: 5.14, speedKmh: 11.7, targetPace: 5.2, hrAvg: 158, xp: 340 },
        { label: days[3], km: 5.0, pace: 5.25, speedKmh: 11.4, targetPace: 5.2, hrAvg: 152, xp: 280 },
        { label: days[4], km: 3.6, pace: 5.42, speedKmh: 11.1, targetPace: 5.2, hrAvg: 142, xp: 190 },
        { label: days[5], km: 8.5, pace: 4.96, speedKmh: 12.1, targetPace: 5.2, hrAvg: 164, xp: 480 },
        { label: days[6], km: 5.4, pace: 5.08, speedKmh: 11.8, targetPace: 5.2, hrAvg: 155, xp: 310 },
      ];
      // Overlay most recent real runs from userProfile.history onto the latest slots
      history.slice(0, 3).forEach((run, i) => {
        const idx = template.length - 1 - i;
        if (idx >= 0) {
          const km = Number((run.totalDistanceMeters / 1000).toFixed(2));
          const pace = Number((run.avgPaceMinKm || 5.2).toFixed(2));
          template[idx] = {
            ...template[idx],
            km,
            pace,
            speedKmh: Number((60 / Math.max(2.5, pace)).toFixed(1)),
            hrAvg: Math.round(run.avgHeartRateBpm || 156),
            xp: run.xpGained || 250,
          };
        }
      });
      return template;
    }

    if (range === '30d') {
      const weeks: SeriesPoint[] = [
        { label: 'Sem 1', km: Number((18.4 * baseKmScale).toFixed(1)), pace: 5.45, speedKmh: 11.0, targetPace: 5.15, hrAvg: 151, xp: 940 },
        { label: 'Sem 2', km: Number((22.1 * baseKmScale).toFixed(1)), pace: 5.28, speedKmh: 11.4, targetPace: 5.15, hrAvg: 155, xp: 1180 },
        { label: 'Sem 3', km: Number((24.6 * baseKmScale).toFixed(1)), pace: 5.12, speedKmh: 11.7, targetPace: 5.15, hrAvg: 158, xp: 1320 },
        { label: 'Sem 4', km: Number((27.8 * baseKmScale).toFixed(1)), pace: 4.98, speedKmh: 12.0, targetPace: 5.15, hrAvg: 161, xp: 1540 },
      ];
      if (history.length > 0) {
        const recentKm = history.reduce((acc, r) => acc + r.totalDistanceMeters / 1000, 0);
        const recentPace =
          history.reduce((acc, r) => acc + (r.avgPaceMinKm || 5.2), 0) / history.length;
        weeks[3] = {
          ...weeks[3],
          km: Number((weeks[3].km + recentKm).toFixed(1)),
          pace: Number(recentPace.toFixed(2)),
          speedKmh: Number((60 / Math.max(2.5, recentPace)).toFixed(1)),
        };
      }
      return weeks;
    }

    if (range === 'semestre') {
      return [
        { label: 'Mês 1', km: 68.4, pace: 5.58, speedKmh: 10.8, targetPace: 5.1, hrAvg: 149, xp: 3240 },
        { label: 'Mês 2', km: 76.2, pace: 5.42, speedKmh: 11.1, targetPace: 5.1, hrAvg: 152, xp: 3680 },
        { label: 'Mês 3', km: 84.5, pace: 5.29, speedKmh: 11.3, targetPace: 5.1, hrAvg: 155, xp: 4120 },
        { label: 'Mês 4', km: 91.0, pace: 5.18, speedKmh: 11.6, targetPace: 5.1, hrAvg: 157, xp: 4590 },
        { label: 'Mês 5', km: 96.8, pace: 5.05, speedKmh: 11.9, targetPace: 5.1, hrAvg: 159, xp: 4980 },
        { label: 'Mês 6', km: Number((104.2 + (userProfile.totalDistanceKm || 0) * 0.4).toFixed(1)), pace: 4.92, speedKmh: 12.2, targetPace: 5.1, hrAvg: 161, xp: 5420 + (userProfile.xp || 0) },
      ];
    }

    return [
      { label: 'Jan', km: 62, pace: 5.65, speedKmh: 10.6, targetPace: 5.05, hrAvg: 148, xp: 2900 },
      { label: 'Fev', km: 70, pace: 5.55, speedKmh: 10.8, targetPace: 5.05, hrAvg: 150, xp: 3320 },
      { label: 'Mar', km: 78, pace: 5.42, speedKmh: 11.1, targetPace: 5.05, hrAvg: 152, xp: 3750 },
      { label: 'Abr', km: 85, pace: 5.35, speedKmh: 11.2, targetPace: 5.05, hrAvg: 154, xp: 4100 },
      { label: 'Mai', km: 92, pace: 5.24, speedKmh: 11.5, targetPace: 5.05, hrAvg: 156, xp: 4480 },
      { label: 'Jun', km: 98, pace: 5.16, speedKmh: 11.6, targetPace: 5.05, hrAvg: 157, xp: 4820 },
      { label: 'Jul', km: 106, pace: 5.08, speedKmh: 11.8, targetPace: 5.05, hrAvg: 158, xp: 5250 },
      { label: 'Ago', km: 112, pace: 5.01, speedKmh: 12.0, targetPace: 5.05, hrAvg: 159, xp: 5610 },
      { label: 'Set', km: 118, pace: 4.95, speedKmh: 12.1, targetPace: 5.05, hrAvg: 160, xp: 5940 },
      { label: 'Out', km: 124, pace: 4.89, speedKmh: 12.3, targetPace: 5.05, hrAvg: 161, xp: 6300 },
      { label: 'Nov', km: Number((128 + (userProfile.totalDistanceKm || 0) * 0.5).toFixed(1)), pace: 4.84, speedKmh: 12.4, targetPace: 5.05, hrAvg: 162, xp: 6620 + (userProfile.xp || 0) },
    ];
  }, [range, userProfile]);

  const kpis = useMemo(() => {
    const activePoints = seriesData.filter((d) => d.km > 0);
    const totalKm = seriesData.reduce((acc, d) => acc + d.km, 0);
    const avgPace =
      activePoints.length > 0
        ? activePoints.reduce((acc, d) => acc + d.pace, 0) / activePoints.length
        : 5.2;
    const bestPace =
      activePoints.length > 0 ? Math.min(...activePoints.map((d) => d.pace)) : 4.85;
    const avgSpeed =
      activePoints.length > 0
        ? activePoints.reduce((acc, d) => acc + d.speedKmh, 0) / activePoints.length
        : 11.5;
    const peakSpeed =
      activePoints.length > 0 ? Math.max(...activePoints.map((d) => d.speedKmh)) : 12.4;
    const totalXp = seriesData.reduce((acc, d) => acc + d.xp, 0);
    return { totalKm, avgPace, bestPace, avgSpeed, peakSpeed, totalXp };
  }, [seriesData]);

  const hrZonesData = useMemo(
    () => [
      { zone: 'Z1 Recup.', minutos: 18, faixa: '110-128 bpm' },
      { zone: 'Z2 Base', minutos: 54, faixa: '129-146 bpm' },
      { zone: 'Z3 Tempo', minutos: 42, faixa: '147-162 bpm' },
      { zone: 'Z4 Limiar', minutos: 28, faixa: '163-176 bpm' },
      { zone: 'Z5 Sprint', minutos: 12, faixa: '177+ bpm' },
    ],
    []
  );

  const radarData = useMemo(() => {
    const latest = userProfile.history?.[0];
    return [
      { attr: 'Resistência', valor: latest?.strengthScore || 82 },
      { attr: 'Velocidade', valor: latest?.speedScore || 78 },
      { attr: 'Cadência', valor: latest?.agilityScore || 86 },
      { attr: 'Consistência', valor: Math.min(98, 72 + (userProfile.level || 1) * 5) },
      { attr: 'Exploração', valor: Math.min(96, 65 + (userProfile.conqueredSectors?.length || 1) * 9) },
      { attr: 'Recuperação', valor: 80 },
    ];
  }, [userProfile]);

  const recentSessions = useMemo(() => {
    if (userProfile.history && userProfile.history.length > 0) {
      return userProfile.history.slice(0, 6).map((h) => ({
        id: h.id,
        date: h.date,
        title: h.workoutTitle,
        km: (h.totalDistanceMeters / 1000).toFixed(2),
        pace: formatPace(h.avgPaceMinKm),
        speed: (60 / Math.max(2.5, h.avgPaceMinKm)).toFixed(1),
        hr: Math.round(h.avgHeartRateBpm || 156),
        xp: h.xpGained,
      }));
    }
    return [
      { id: 's1', date: 'Hoje', title: 'Ritmo Cruzeiro 5K', km: '5.42', pace: '05:08', speed: '11.7', hr: 155, xp: 320 },
      { id: 's2', date: 'Há 2 dias', title: 'Intervalado Sub-5', km: '6.80', pace: '04:56', speed: '12.2', hr: 164, xp: 450 },
      { id: 's3', date: 'Há 4 dias', title: 'Base Aeróbica Parque', km: '8.15', pace: '05:22', speed: '11.2', hr: 149, xp: 410 },
      { id: 's4', date: 'Há 6 dias', title: 'Regenerativo Leve', km: '4.20', pace: '05:44', speed: '10.5', hr: 138, xp: 210 },
    ];
  }, [userProfile.history]);

  const gridStroke = isLight ? '#e2e8f0' : '#1e293b';
  const axisTick = isLight ? '#64748b' : '#94a3b8';
  const tooltipStyle = {
    backgroundColor: isLight ? '#ffffff' : '#020617',
    borderColor: isLight ? '#cbd5e1' : '#334155',
    borderRadius: '12px',
    color: isLight ? '#0f172a' : '#f8fafc',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      {/* Top Expanded Analytics Header */}
      <div className={isPhoneLayout ? 'flex flex-col gap-3' : 'flex flex-col md:flex-row md:items-end justify-between gap-4'}>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>Central de Desempenho Expandida</span>
            <span aria-hidden="true">·</span>
            <span>
              {activeDevice === 'tablet'
                ? 'Layout Tablet'
                : activeDevice === 'smartphone'
                ? 'Visual Compacto'
                : 'Layout Computador'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-balance">
            Métricas e Gráficos de Evolução
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period Filter Segmented Control */}
          <div
            className={`inline-flex items-center gap-1 p-1 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}
          >
            {TIME_RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  range === item.id
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'bg-cyan-400 text-slate-950 shadow-sm'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenCommunityCamera}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              isLight
                ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Compartilhar</span>
          </button>

          <button
            type="button"
            onClick={onStartNewMission}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              isLight
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Nova Missão</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip (Tabular Numerals, Single Elevation) */}
      <div className={isPhoneLayout ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 lg:grid-cols-4 gap-4'}>
        <div
          className={`p-4 sm:p-5 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Volume Percorrido</span>
            <Route className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums mt-2">
            {kpis.totalKm.toFixed(1)} <span className="text-sm font-semibold text-slate-400">km</span>
          </div>
          <div className="text-xs text-emerald-500 font-medium mt-1">
            +12,4% vs período anterior
          </div>
        </div>

        <div
          className={`p-4 sm:p-5 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pace Médio</span>
            <Gauge className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums mt-2">
            {formatPace(kpis.avgPace)} <span className="text-sm font-semibold text-slate-400">/km</span>
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-1">
            Melhor marca: {formatPace(kpis.bestPace)} /km
          </div>
        </div>

        <div
          className={`p-4 sm:p-5 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Velocidade Média</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums mt-2">
            {kpis.avgSpeed.toFixed(1)} <span className="text-sm font-semibold text-slate-400">km/h</span>
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-1">
            Pico de cruzeiro: {kpis.peakSpeed.toFixed(1)} km/h
          </div>
        </div>

        <div
          className={`p-4 sm:p-5 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pontuação no Período</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums mt-2">
            {kpis.totalXp.toLocaleString('pt-BR')} <span className="text-sm font-semibold text-slate-400">XP</span>
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-1">
            Nível {userProfile.level} · {userProfile.conqueredSectors.length} setores
          </div>
        </div>
      </div>

      {/* Primary Charts Row: Volume vs Speed (7 cols) + Athlete Attribute Radar (5 cols) */}
      <div className={isPhoneLayout ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 lg:grid-cols-12 gap-5'}>
        <div
          className={`${isPhoneLayout ? '' : 'lg:col-span-7 '}p-5 rounded-2xl border space-y-4 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">Volume de Corrida (km) e Velocidade Média</h3>
              <p className="text-xs text-slate-400">
                Comparativo entre distância acumulada e velocidade média sustentada em km/h
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span className="text-cyan-400 font-semibold">Barras: km</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-semibold">Linha: km/h</span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={seriesData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: axisTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[8, 16]} tick={{ fill: axisTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  yAxisId="left"
                  dataKey="km"
                  name="Distância (km)"
                  fill={isLight ? '#f97316' : '#06b6d4'}
                  radius={[8, 8, 0, 0]}
                  maxBarSize={42}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="speedKmh"
                  name="Velocidade (km/h)"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#f59e0b' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className={`${isPhoneLayout ? '' : 'lg:col-span-5 '}p-5 rounded-2xl border space-y-4 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div>
            <h3 className="text-base font-bold">Radar de Perfil Atlético</h3>
            <p className="text-xs text-slate-400">
              Equilíbrio fisiológico e técnico calculado a partir das suas sessões
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="74%">
                <PolarGrid stroke={gridStroke} />
                <PolarAngleAxis dataKey="attr" tick={{ fill: axisTick, fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Radar
                  name="Pontuação"
                  dataKey="valor"
                  stroke={isLight ? '#ea580c' : '#22d3ee'}
                  fill={isLight ? '#fb923c' : '#06b6d4'}
                  fillOpacity={0.32}
                  strokeWidth={2.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Charts Row: Pace Trend (6 cols) + Heart Rate Zones (6 cols) */}
      <div className={isPhoneLayout ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 lg:grid-cols-12 gap-5'}>
        <div
          className={`${isPhoneLayout ? '' : 'lg:col-span-6 '}p-5 rounded-2xl border space-y-4 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">Tendência de Pace Médio (min/km)</h3>
              <p className="text-xs text-slate-400">
                Quanto menor a curva, mais rápido o ritmo em relação ao alvo
              </p>
            </div>
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={seriesData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="paceAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[4.4, 6.0]} tick={{ fill: axisTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${formatPace(Number(value ?? 0))} /km`, 'Pace Médio']}
                />
                <ReferenceLine
                  y={seriesData[0]?.targetPace || 5.15}
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  label={{ value: 'Alvo', position: 'insideTopRight', fill: '#f59e0b', fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="pace"
                  name="Pace"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#paceAreaFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className={`${isPhoneLayout ? '' : 'lg:col-span-6 '}p-5 rounded-2xl border space-y-4 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">Zonas de Frequência Cardíaca</h3>
              <p className="text-xs text-slate-400">
                Tempo acumulado por faixa de esforço cardíaco nas sessões recentes
              </p>
            </div>
            <Flame className="w-4 h-4 text-rose-400 shrink-0" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hrZonesData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="zone" tick={{ fill: axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: axisTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="minutos"
                  name="Minutos na Zona"
                  fill={isLight ? '#0284c7' : '#a855f7'}
                  radius={[8, 8, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* High-Density Tabular Sessions Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <h3 className="text-sm font-bold">Histórico Analítico de Sessões</h3>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {recentSessions.length} registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b font-mono uppercase text-[11px] ${
                  isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                }`}
              >
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Sessão</th>
                <th className="py-3 px-4 text-right">Distância</th>
                <th className="py-3 px-4 text-right">Pace Médio</th>
                <th className="py-3 px-4 text-right">Vel. Média</th>
                <th className="py-3 px-4 text-right">FC Média</th>
                <th className="py-3 px-4 text-right">XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
              {recentSessions.map((row) => (
                <tr
                  key={row.id}
                  className={isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'}
                >
                  <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{row.date}</td>
                  <td className="py-3 px-4 font-sans font-semibold">{row.title}</td>
                  <td className="py-3 px-4 text-right font-bold text-cyan-400 whitespace-nowrap">
                    {row.km} km
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">{row.pace} /km</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">{row.speed} km/h</td>
                  <td className="py-3 px-4 text-right text-rose-400 whitespace-nowrap">{row.hr} bpm</td>
                  <td className="py-3 px-4 text-right font-bold text-amber-400 whitespace-nowrap">
                    +{row.xp} XP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalyticsDashboard;
