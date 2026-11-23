import React, { useEffect, useMemo, useState } from 'react';
import {
  Target,
  Calendar,
  TrendingUp,
  CheckCircle2,
  SlidersHorizontal,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Flame,
} from 'lucide-react';
import { WeeklyGoalConfig, WorkoutStats } from '../types';

interface WeeklyGoalsConfigProps {
  history: WorkoutStats[];
  totalDistanceKm: number;
  weeklyGoals?: WeeklyGoalConfig;
  onSaveWeeklyGoals: (goals: WeeklyGoalConfig) => void;
  theme?: 'dark' | 'light';
}

interface GoalPreset {
  id: string;
  label: string;
  targetKm: number;
  targetSessions: number;
  subtitle: string;
}

const DEFAULT_GOALS: WeeklyGoalConfig = {
  targetKm: 25,
  targetSessions: 4,
};

const GOAL_PRESETS: GoalPreset[] = [
  { id: 'base', label: 'Base', targetKm: 15, targetSessions: 3, subtitle: 'Ritmo leve' },
  { id: 'consistencia', label: 'Consistência', targetKm: 25, targetSessions: 4, subtitle: 'Equilibrado' },
  { id: 'performance', label: 'Performance', targetKm: 45, targetSessions: 5, subtitle: 'Competitivo' },
  { id: 'maratona', label: 'Maratona', targetKm: 70, targetSessions: 6, subtitle: 'Alto volume' },
];

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = MS_PER_DAY * 7;

function getWorkoutTimestampMs(workout: WorkoutStats): number | null {
  if (typeof workout.createdAtMs === 'number' && Number.isFinite(workout.createdAtMs) && workout.createdAtMs > 0) {
    return workout.createdAtMs;
  }
  if (workout.path && workout.path.length > 0 && typeof workout.path[0].timestamp === 'number' && workout.path[0].timestamp > 0) {
    return workout.path[0].timestamp;
  }
  const idMatch = workout.id?.match(/workout-(\d{10,})/);
  if (idMatch) {
    const parsed = Number(idMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function getMondayStartMs(referenceDate: Date): number {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const dayOffset = (start.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  start.setDate(start.getDate() - dayOffset);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function formatShortDayMonth(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export const WeeklyGoalsConfig: React.FC<WeeklyGoalsConfigProps> = ({
  history,
  totalDistanceKm,
  weeklyGoals,
  onSaveWeeklyGoals,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const activeGoals = weeklyGoals ?? DEFAULT_GOALS;

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draftKm, setDraftKm] = useState<number>(activeGoals.targetKm);
  const [draftSessions, setDraftSessions] = useState<number>(activeGoals.targetSessions);
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  useEffect(() => {
    setDraftKm(activeGoals.targetKm);
    setDraftSessions(activeGoals.targetSessions);
  }, [activeGoals.targetKm, activeGoals.targetSessions]);

  const weeklyAnalytics = useMemo(() => {
    const now = new Date();
    const weekStartMs = getMondayStartMs(now);
    const weekEndMs = weekStartMs + MS_PER_WEEK;
    const prevWeekStartMs = weekStartMs - MS_PER_WEEK;
    const todayIndex = (now.getDay() + 6) % 7;

    const dailyBuckets = WEEKDAY_LABELS.map((label, idx) => ({
      label,
      km: 0,
      sessions: 0,
      isToday: idx === todayIndex,
      isFuture: idx > todayIndex,
    }));

    let currentWeekKm = 0;
    let currentWeekSessions = 0;
    let prevWeekKm = 0;
    let prevWeekSessions = 0;

    // Group all historical runs by weekStartMs to calculate real historical weekly averages
    const historicalWeeksMap = new Map<number, { km: number; sessions: number }>();

    for (const workout of history) {
      const distKm = Math.max(0, (workout.totalDistanceMeters || 0) / 1000);
      const ts = getWorkoutTimestampMs(workout);

      if (ts === null) {
        // Fallback: if a legacy workout has no parseable timestamp, count toward general historical pool
        continue;
      }

      const workoutWeekStart = getMondayStartMs(new Date(ts));
      const existing = historicalWeeksMap.get(workoutWeekStart) ?? { km: 0, sessions: 0 };
      existing.km += distKm;
      existing.sessions += 1;
      historicalWeeksMap.set(workoutWeekStart, existing);

      if (ts >= weekStartMs && ts < weekEndMs) {
        currentWeekKm += distKm;
        currentWeekSessions += 1;
        const dayIndex = Math.min(6, Math.max(0, Math.floor((ts - weekStartMs) / MS_PER_DAY)));
        dailyBuckets[dayIndex].km += distKm;
        dailyBuckets[dayIndex].sessions += 1;
      } else if (ts >= prevWeekStartMs && ts < weekStartMs) {
        prevWeekKm += distKm;
        prevWeekSessions += 1;
      }
    }

    const activeWeeks = Array.from(historicalWeeksMap.values());
    const recentWeeks = Array.from(historicalWeeksMap.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 4)
      .map(([, v]) => v);

    const historicalAvgKm =
      recentWeeks.length > 0
        ? recentWeeks.reduce((acc, w) => acc + w.km, 0) / recentWeeks.length
        : 0;

    const historicalAvgSessions =
      recentWeeks.length > 0
        ? recentWeeks.reduce((acc, w) => acc + w.sessions, 0) / recentWeeks.length
        : 0;

    const maxDailyKm = Math.max(
      ...dailyBuckets.map((d) => d.km),
      activeGoals.targetKm / Math.max(1, activeGoals.targetSessions),
      1
    );

    const rangeLabel = `${formatShortDayMonth(weekStartMs)} – ${formatShortDayMonth(weekEndMs - 1000)}`;
    const daysRemaining = 6 - todayIndex;

    return {
      currentWeekKm,
      currentWeekSessions,
      prevWeekKm,
      prevWeekSessions,
      dailyBuckets,
      maxDailyKm,
      historicalAvgKm,
      historicalAvgSessions,
      trackedWeeksCount: activeWeeks.length,
      rangeLabel,
      daysRemaining,
    };
  }, [history, activeGoals.targetKm, activeGoals.targetSessions]);

  const kmProgressRaw = activeGoals.targetKm > 0 ? (weeklyAnalytics.currentWeekKm / activeGoals.targetKm) * 100 : 0;
  const kmProgressPercent = Math.min(100, Math.round(kmProgressRaw));
  const kmRemaining = Math.max(0, activeGoals.targetKm - weeklyAnalytics.currentWeekKm);
  const kmSurplus = Math.max(0, weeklyAnalytics.currentWeekKm - activeGoals.targetKm);
  const kmGoalReached = weeklyAnalytics.currentWeekKm >= activeGoals.targetKm;

  const sessionsProgressRaw =
    activeGoals.targetSessions > 0
      ? (weeklyAnalytics.currentWeekSessions / activeGoals.targetSessions) * 100
      : 0;
  const sessionsProgressPercent = Math.min(100, Math.round(sessionsProgressRaw));
  const sessionsRemaining = Math.max(0, activeGoals.targetSessions - weeklyAnalytics.currentWeekSessions);
  const sessionsGoalReached = weeklyAnalytics.currentWeekSessions >= activeGoals.targetSessions;

  const overallPercent = Math.round((kmProgressPercent + sessionsProgressPercent) / 2);
  const bothGoalsReached = kmGoalReached && sessionsGoalReached;

  const hasUnsavedChanges =
    draftKm !== activeGoals.targetKm || draftSessions !== activeGoals.targetSessions;

  const clampKm = (value: number) => Math.max(5, Math.min(200, Math.round(value)));
  const clampSessions = (value: number) => Math.max(1, Math.min(14, Math.round(value)));

  const handleSave = () => {
    const sanitized: WeeklyGoalConfig = {
      targetKm: clampKm(draftKm),
      targetSessions: clampSessions(draftSessions),
      updatedAtIso: new Date().toISOString(),
    };
    onSaveWeeklyGoals(sanitized);
    setDraftKm(sanitized.targetKm);
    setDraftSessions(sanitized.targetSessions);
    setIsEditing(false);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3500);
  };

  const handleApplyHistoricalSuggestion = () => {
    const suggestedKm = clampKm(Math.ceil(weeklyAnalytics.historicalAvgKm * 1.1));
    const suggestedSessions = clampSessions(Math.max(2, Math.round(weeklyAnalytics.historicalAvgSessions)));
    setDraftKm(suggestedKm);
    setDraftSessions(suggestedSessions);
  };

  const avgKmPerPlannedSession = (draftKm / Math.max(1, draftSessions)).toFixed(1);

  return (
    <section
      aria-label="Configuração de Metas Semanais"
      className={`p-6 border rounded-3xl space-y-5 transition-colors ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
          : 'bg-slate-900 border-slate-800 text-white'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              bothGoalsReached
                ? isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : isLight
                ? 'bg-orange-50 border-orange-200 text-orange-600'
                : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-400'
            }`}
          >
            {bothGoalsReached ? <CheckCircle2 className="w-5 h-5" /> : <Target className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black tracking-tight">
                Metas Semanais
              </h3>
              <span
                className={`text-[11px] font-mono tabular-nums font-semibold ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                • Semana {weeklyAnalytics.rangeLabel}
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {bothGoalsReached
                ? 'Meta semanal concluída! Você superou volume e frequência.'
                : weeklyAnalytics.daysRemaining === 0
                ? 'Último dia da semana para fechar sua meta.'
                : `Restam ${weeklyAnalytics.daysRemaining} ${
                    weeklyAnalytics.daysRemaining === 1 ? 'dia' : 'dias'
                  } na semana atual (Seg–Dom).`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div
            className={`px-3 py-2 rounded-xl border font-mono tabular-nums text-xs font-black ${
              bothGoalsReached
                ? isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                : isLight
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-slate-950 border-slate-800 text-cyan-300'
            }`}
          >
            {overallPercent}% concluído
          </div>

          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              isEditing
                ? isLight
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-cyan-500 text-slate-950 border-cyan-400'
                : isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Fechar Editor' : 'Configurar Metas'}</span>
          </button>
        </div>
      </div>

      {/* Confirmation feedback */}
      {savedBanner && (
        <div
          className={`px-4 py-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            isLight
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Metas semanais atualizadas: <strong className="font-mono tabular-nums">{activeGoals.targetKm} km</strong> em{' '}
            <strong className="font-mono tabular-nums">{activeGoals.targetSessions}</strong>{' '}
            {activeGoals.targetSessions === 1 ? 'sessão' : 'sessões'}.
          </span>
        </div>
      )}

      {/* Progress Bars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Distance Progress Card */}
        <div
          className={`p-4 rounded-2xl border space-y-3 ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp
                className={`w-4 h-4 ${
                  kmGoalReached
                    ? 'text-emerald-500'
                    : isLight
                    ? 'text-orange-600'
                    : 'text-cyan-400'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                Quilometragem Alvo
              </span>
            </div>
            <span
              className={`text-xs font-mono tabular-nums font-black ${
                kmGoalReached
                  ? 'text-emerald-500'
                  : isLight
                  ? 'text-orange-600'
                  : 'text-cyan-400'
              }`}
            >
              {kmProgressPercent}%
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
            <div>
              <span className="text-2xl font-black">
                {weeklyAnalytics.currentWeekKm.toFixed(1)}
              </span>
              <span className={`text-xs ml-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                / {activeGoals.targetKm} km
              </span>
            </div>
            {weeklyAnalytics.prevWeekKm > 0 && (
              <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Sem. ant: {weeklyAnalytics.prevWeekKm.toFixed(1)} km
              </span>
            )}
          </div>

          {/* Visual Distance Progress Bar with 25% / 50% / 75% reference markers */}
          <div className="relative">
            <div
              role="progressbar"
              aria-label="Progresso de quilometragem semanal"
              aria-valuenow={kmProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className={`w-full h-3.5 rounded-full overflow-hidden border relative ${
                isLight ? 'bg-slate-200 border-slate-300/80' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  kmGoalReached
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : isLight
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                    : 'bg-gradient-to-r from-cyan-500 to-teal-400'
                }`}
                style={{ width: `${Math.max(kmProgressPercent > 0 ? 4 : 0, kmProgressPercent)}%` }}
              />
              {/* Quarter ticks */}
              <div className="pointer-events-none absolute inset-0 flex justify-evenly">
                <span className={`w-px h-full ${isLight ? 'bg-white/60' : 'bg-slate-950/60'}`} />
                <span className={`w-px h-full ${isLight ? 'bg-white/60' : 'bg-slate-950/60'}`} />
                <span className={`w-px h-full ${isLight ? 'bg-white/60' : 'bg-slate-950/60'}`} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
            <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
              {kmGoalReached ? (
                <strong className="text-emerald-500">
                  Meta alcançada{kmSurplus >= 0.1 ? ` (+${kmSurplus.toFixed(1)} km extras)` : '!'}
                </strong>
              ) : (
                <>Faltam <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>{kmRemaining.toFixed(1)} km</strong></>
              )}
            </span>
            <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
              {weeklyAnalytics.historicalAvgKm > 0
                ? `Média: ${weeklyAnalytics.historicalAvgKm.toFixed(1)} km/sem`
                : `Total hist.: ${totalDistanceKm.toFixed(1)} km`}
            </span>
          </div>
        </div>

        {/* Sessions Progress Card */}
        <div
          className={`p-4 rounded-2xl border space-y-3 ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar
                className={`w-4 h-4 ${
                  sessionsGoalReached
                    ? 'text-emerald-500'
                    : isLight
                    ? 'text-indigo-600'
                    : 'text-amber-400'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider">
                Sessões Semanais
              </span>
            </div>
            <span
              className={`text-xs font-mono tabular-nums font-black ${
                sessionsGoalReached
                  ? 'text-emerald-500'
                  : isLight
                  ? 'text-indigo-600'
                  : 'text-amber-400'
              }`}
            >
              {sessionsProgressPercent}%
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
            <div>
              <span className="text-2xl font-black">
                {weeklyAnalytics.currentWeekSessions}
              </span>
              <span className={`text-xs ml-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                / {activeGoals.targetSessions}{' '}
                {activeGoals.targetSessions === 1 ? 'sessão' : 'sessões'}
              </span>
            </div>
            {weeklyAnalytics.prevWeekSessions > 0 && (
              <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Sem. ant: {weeklyAnalytics.prevWeekSessions}x
              </span>
            )}
          </div>

          {/* Segmented Visual Sessions Bar */}
          {activeGoals.targetSessions <= 10 ? (
            <div
              role="progressbar"
              aria-label="Progresso de sessões semanais"
              aria-valuenow={sessionsProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${activeGoals.targetSessions}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: activeGoals.targetSessions }).map((_, idx) => {
                const completed = idx < weeklyAnalytics.currentWeekSessions;
                return (
                  <div
                    key={idx}
                    className={`h-3.5 rounded-full border transition-all duration-500 ${
                      completed
                        ? sessionsGoalReached
                          ? 'bg-emerald-500 border-emerald-400'
                          : isLight
                          ? 'bg-indigo-600 border-indigo-500'
                          : 'bg-amber-400 border-amber-300'
                        : isLight
                        ? 'bg-slate-200 border-slate-300/80'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                    title={`Sessão ${idx + 1}: ${completed ? 'Concluída' : 'Pendente'}`}
                  />
                );
              })}
            </div>
          ) : (
            <div
              role="progressbar"
              aria-label="Progresso de sessões semanais"
              aria-valuenow={sessionsProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className={`w-full h-3.5 rounded-full overflow-hidden border ${
                isLight ? 'bg-slate-200 border-slate-300/80' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  sessionsGoalReached
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : isLight
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-500'
                    : 'bg-gradient-to-r from-amber-500 to-orange-400'
                }`}
                style={{
                  width: `${Math.max(sessionsProgressPercent > 0 ? 4 : 0, sessionsProgressPercent)}%`,
                }}
              />
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
            <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
              {sessionsGoalReached ? (
                <strong className="text-emerald-500">Frequência semanal cumprida!</strong>
              ) : (
                <>
                  Faltam{' '}
                  <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>
                    {sessionsRemaining} {sessionsRemaining === 1 ? 'treino' : 'treinos'}
                  </strong>
                </>
              )}
            </span>
            <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
              {weeklyAnalytics.historicalAvgSessions > 0
                ? `Média: ${weeklyAnalytics.historicalAvgSessions.toFixed(1)}x/sem`
                : `~${(activeGoals.targetKm / Math.max(1, activeGoals.targetSessions)).toFixed(1)} km/sessão`}
            </span>
          </div>
        </div>
      </div>

      {/* 7-Day Historical Activity Distribution (Seg–Dom) */}
      <div
        className={`p-4 rounded-2xl border space-y-3 ${
          isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/70 border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Flame className={`w-3.5 h-3.5 ${isLight ? 'text-orange-500' : 'text-cyan-400'}`} />
            Histórico da Semana (Seg–Dom)
          </span>
          <span className={`font-mono tabular-nums text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {history.length === 0
              ? 'Conclua uma corrida para preencher o gráfico semanal'
              : `${history.length} ${history.length === 1 ? 'corrida no histórico' : 'corridas no histórico'}`}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 items-end h-20 pt-2">
          {weeklyAnalytics.dailyBuckets.map((day) => {
            const heightPercent =
              day.km > 0 ? Math.max(16, Math.min(100, Math.round((day.km / weeklyAnalytics.maxDailyKm) * 100))) : 8;
            return (
              <div key={day.label} className="flex flex-col items-center gap-1 h-full justify-end">
                <span
                  className={`text-[10px] font-mono tabular-nums font-bold ${
                    day.km > 0
                      ? isLight
                        ? 'text-slate-800'
                        : 'text-cyan-300'
                      : 'text-transparent select-none'
                  }`}
                >
                  {day.km > 0 ? `${day.km.toFixed(1)}` : '0'}
                </span>
                <div className="w-full max-w-[32px] flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${
                      day.km > 0
                        ? isLight
                          ? 'bg-orange-500'
                          : 'bg-cyan-400'
                        : day.isToday
                        ? isLight
                          ? 'bg-orange-200 border border-orange-300'
                          : 'bg-cyan-950 border border-cyan-500/40'
                        : isLight
                        ? 'bg-slate-200'
                        : 'bg-slate-800/80'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                    title={`${day.label}: ${day.km.toFixed(2)} km (${day.sessions} sessões)`}
                  />
                </div>
                <span
                  className={`text-[10px] font-mono uppercase ${
                    day.isToday
                      ? isLight
                        ? 'font-black text-orange-600'
                        : 'font-black text-cyan-400'
                      : isLight
                      ? 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible Configuration Editor */}
      {isEditing && (
        <div
          className={`p-5 rounded-2xl border space-y-5 ${
            isLight
              ? 'bg-orange-50/50 border-orange-200'
              : 'bg-slate-950 border-cyan-500/30'
          }`}
        >
          {/* Quick Presets */}
          <div className="space-y-2">
            <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Perfis Rápidos de Meta
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GOAL_PRESETS.map((preset) => {
                const selected = draftKm === preset.targetKm && draftSessions === preset.targetSessions;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setDraftKm(preset.targetKm);
                      setDraftSessions(preset.targetSessions);
                    }}
                    className={`min-h-[48px] p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      selected
                        ? isLight
                          ? 'bg-orange-600 border-orange-600 text-white'
                          : 'bg-cyan-500 border-cyan-400 text-slate-950'
                        : isLight
                        ? 'bg-white hover:bg-orange-50 border-slate-200 text-slate-800'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-extrabold">{preset.label}</div>
                    <div
                      className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                        selected
                          ? isLight
                            ? 'text-orange-100'
                            : 'text-slate-900 font-bold'
                          : isLight
                          ? 'text-slate-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {preset.targetKm} km • {preset.targetSessions}x
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders & Steppers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Target Km Control */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="weekly-target-km"
                  className="text-xs font-bold uppercase tracking-wider"
                >
                  Quilometragem Alvo (km)
                </label>
                <span className="font-mono tabular-nums text-sm font-black text-cyan-500">
                  {draftKm} km
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraftKm((prev) => clampKm(prev - 5))}
                  aria-label="Reduzir 5 quilômetros"
                  className={`min-h-[40px] min-w-[40px] rounded-xl border flex items-center justify-center transition cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  id="weekly-target-km"
                  type="number"
                  min={5}
                  max={200}
                  step={1}
                  value={draftKm}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!Number.isNaN(val)) setDraftKm(Math.max(0, Math.min(200, val)));
                  }}
                  onBlur={() => setDraftKm((prev) => clampKm(prev))}
                  className={`min-h-[40px] flex-1 px-3 rounded-xl border text-center font-mono tabular-nums text-sm font-bold focus:outline-none ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-orange-500'
                      : 'bg-slate-900 border-slate-700 text-white focus:border-cyan-400'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setDraftKm((prev) => clampKm(prev + 5))}
                  aria-label="Aumentar 5 quilômetros"
                  className={`min-h-[40px] min-w-[40px] rounded-xl border flex items-center justify-center transition cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <input
                type="range"
                min={5}
                max={150}
                step={1}
                value={Math.min(150, Math.max(5, draftKm))}
                onChange={(e) => setDraftKm(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
                aria-label="Controle deslizante de quilometragem semanal"
              />
            </div>

            {/* Target Sessions Control */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="weekly-target-sessions"
                  className="text-xs font-bold uppercase tracking-wider"
                >
                  Número de Sessões
                </label>
                <span className="font-mono tabular-nums text-sm font-black text-amber-500">
                  {draftSessions} {draftSessions === 1 ? 'sessão' : 'sessões'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraftSessions((prev) => clampSessions(prev - 1))}
                  aria-label="Reduzir 1 sessão"
                  className={`min-h-[40px] min-w-[40px] rounded-xl border flex items-center justify-center transition cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  id="weekly-target-sessions"
                  type="number"
                  min={1}
                  max={14}
                  step={1}
                  value={draftSessions}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!Number.isNaN(val)) setDraftSessions(Math.max(1, Math.min(14, val)));
                  }}
                  onBlur={() => setDraftSessions((prev) => clampSessions(prev))}
                  className={`min-h-[40px] flex-1 px-3 rounded-xl border text-center font-mono tabular-nums text-sm font-bold focus:outline-none ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-orange-500'
                      : 'bg-slate-900 border-slate-700 text-white focus:border-cyan-400'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setDraftSessions((prev) => clampSessions(prev + 1))}
                  aria-label="Aumentar 1 sessão"
                  className={`min-h-[40px] min-w-[40px] rounded-xl border flex items-center justify-center transition cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {[2, 3, 4, 5, 6, 7].map((count) => {
                  const active = draftSessions === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setDraftSessions(count)}
                      className={`min-h-[36px] rounded-lg border font-mono tabular-nums text-xs font-bold transition cursor-pointer ${
                        active
                          ? isLight
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-amber-400 text-slate-950 border-amber-300'
                          : isLight
                          ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                    >
                      {count}x
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Projection + Optional Historical Suggestion */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-500/20">
            <div className="space-y-1">
              <p className={`text-xs font-mono tabular-nums ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Planejamento: <strong>{avgKmPerPlannedSession} km</strong> médios por sessão ({draftKm} km ÷ {draftSessions}x)
              </p>
              {weeklyAnalytics.historicalAvgKm > 0 && (
                <button
                  type="button"
                  onClick={handleApplyHistoricalSuggestion}
                  className={`text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:underline ${
                    isLight ? 'text-orange-700' : 'text-cyan-400'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    Aplicar progressão +10% sobre média histórica ({Math.ceil(weeklyAnalytics.historicalAvgKm * 1.1)} km)
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftKm(activeGoals.targetKm);
                    setDraftSessions(activeGoals.targetSessions);
                  }}
                  className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reverter</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                className={`min-h-[40px] px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  isLight
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm'
                    : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                }`}
              >
                Salvar Metas
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
