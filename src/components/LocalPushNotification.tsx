import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CloudLightning,
  CloudRain,
  Clock,
  Droplets,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { HeavyRainAssessment, ScheduledMissionConfig, WeatherData } from '../types';
import { evaluateHeavyRainForWorkoutTime, formatLocalDateTimeInput } from '../utils/weather';
import { tacticalAudio } from '../utils/audio';

const STORAGE_KEY = 'run360x_scheduled_mission_alert';
const LEAD_TIME_MINUTES = 15;

export interface LocalPushStatusSummary {
  enabled: boolean;
  isHeavyRain: boolean;
  hasActiveBanner: boolean;
  scheduledLabel: string;
  minutesUntilStart: number | null;
  conditionLabel: string;
  precipitationMm: number;
  precipitationProbability: number;
  permission: NotificationPermission | 'unsupported';
}

interface LocalPushNotificationProps {
  weather: WeatherData | null;
  missionTitle: string;
  isWorkoutActive: boolean;
  isModalOpen: boolean;
  onCloseModal: () => void;
  onStatusChange?: (summary: LocalPushStatusSummary) => void;
  theme?: 'dark' | 'light';
}

interface ActivePushAlert {
  id: string;
  triggeredAt: string;
  missionTitle: string;
  minutesUntilStart: number;
  isSimulated: boolean;
  assessment: HeavyRainAssessment;
}

function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

function formatScheduledLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Não agendado';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoje às ${timePart}`;
  if (isTomorrow) return `Amanhã às ${timePart}`;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${timePart}`;
}

function createDefaultConfig(missionTitle: string): ScheduledMissionConfig {
  const defaultDate = new Date(Date.now() + 15 * 60 * 1000);
  defaultDate.setSeconds(0, 0);
  return {
    enabled: true,
    scheduledAtIso: formatLocalDateTimeInput(defaultDate),
    missionTitle,
    leadTimeMinutes: LEAD_TIME_MINUTES,
    lastNotifiedForIso: null,
  };
}

function loadPersistedConfig(missionTitle: string): ScheduledMissionConfig {
  if (typeof window === 'undefined') return createDefaultConfig(missionTitle);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultConfig(missionTitle);
    const parsed = JSON.parse(raw) as Partial<ScheduledMissionConfig>;
    const fallback = createDefaultConfig(missionTitle);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : fallback.enabled,
      scheduledAtIso: parsed.scheduledAtIso || fallback.scheduledAtIso,
      missionTitle: parsed.missionTitle || missionTitle,
      leadTimeMinutes: parsed.leadTimeMinutes || LEAD_TIME_MINUTES,
      lastNotifiedForIso: parsed.lastNotifiedForIso ?? null,
    };
  } catch {
    return createDefaultConfig(missionTitle);
  }
}

export const LocalPushNotification: React.FC<LocalPushNotificationProps> = ({
  weather,
  missionTitle,
  isWorkoutActive,
  isModalOpen,
  onCloseModal,
  onStatusChange,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  const [config, setConfig] = useState<ScheduledMissionConfig>(() => loadPersistedConfig(missionTitle));
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getBrowserNotificationPermission()
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [activeAlert, setActiveAlert] = useState<ActivePushAlert | null>(null);
  const [rescheduleToast, setRescheduleToast] = useState<string | null>(null);
  const [permissionFeedback, setPermissionFeedback] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  // Persist config whenever it changes
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage quota / privacy errors
    }
  }, [config]);

  // Keep missionTitle synced with active selected mission
  useEffect(() => {
    setConfig((prev) => (prev.missionTitle === missionTitle ? prev : { ...prev, missionTitle }));
  }, [missionTitle]);

  // Tick every 10 seconds to monitor T-15 min countdown accurately
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  // Cleanup feedback timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const assessment = useMemo(
    () => evaluateHeavyRainForWorkoutTime(weather, config.scheduledAtIso),
    [weather, config.scheduledAtIso]
  );

  const minutesUntilStart = useMemo(() => {
    const scheduledMs = new Date(config.scheduledAtIso).getTime();
    if (Number.isNaN(scheduledMs)) return null;
    return Math.ceil((scheduledMs - nowMs) / 60000);
  }, [config.scheduledAtIso, nowMs]);

  const scheduledLabel = useMemo(
    () => formatScheduledLabel(config.scheduledAtIso),
    [config.scheduledAtIso]
  );

  const showRescheduleConfirmation = useCallback((message: string) => {
    setRescheduleToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setRescheduleToast(null);
    }, 4500);
  }, []);

  // Dispatch both native OS/Browser Local Push (if granted) and In-App Push Toast + Audio
  const dispatchLocalPush = useCallback(
    (
      alertAssessment: HeavyRainAssessment,
      minsBefore: number,
      isSimulated: boolean
    ) => {
      const clampedMins = Math.max(1, Math.min(LEAD_TIME_MINUTES, minsBefore || LEAD_TIME_MINUTES));
      const title =
        alertAssessment.severity === 'storm'
          ? '⛈️ RUN360X • Alerta de Tempestade (T-15m)'
          : '🌧️ RUN360X • Chuva Forte Prevista (T-15m)';
      const body = `Previsão de ${alertAssessment.conditionLabel} (${alertAssessment.precipitationMm} mm/h, ${alertAssessment.precipitationProbability}%) para "${missionTitle}" em ${clampedMins} min. Sugerimos reagendar para ${alertAssessment.suggestedRescheduleLabel}.`;

      // 1. Native Browser / OS Local Notification API
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        try {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker
              .getRegistration()
              .then((reg) => {
                if (reg) {
                  return reg.showNotification(title, {
                    body,
                    tag: 'run360x-heavy-rain-t15',
                    requireInteraction: true,
                  });
                }
                new window.Notification(title, {
                  body,
                  tag: 'run360x-heavy-rain-t15',
                });
              })
              .catch(() => {
                new window.Notification(title, {
                  body,
                  tag: 'run360x-heavy-rain-t15',
                });
              });
          } else {
            new window.Notification(title, {
              body,
              tag: 'run360x-heavy-rain-t15',
            });
          }
        } catch {
          // Sandboxed iframe or restricted Notification constructor: fallback seamlessly to in-app banner
        }
      }

      // 2. Tactical Radar Ping + Optional Voice Coach Alert
      tacticalAudio.playRadarPingSound();
      if (tacticalAudio.getSettings().enabled) {
        tacticalAudio.speakTacticalCoach(
          `Atenção corredor! Previsão de chuva forte em ${clampedMins} minutos antes da sua missão. Recomendamos reagendar para ${alertAssessment.suggestedRescheduleLabel}.`,
          { category: 'system', priority: 'high' }
        );
      }

      // 3. In-App Floating Push Notification Card
      setActiveAlert({
        id: `push-${Date.now()}`,
        triggeredAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        missionTitle,
        minutesUntilStart: clampedMins,
        isSimulated,
        assessment: alertAssessment,
      });
    },
    [missionTitle]
  );

  // Automatic T-15 minute monitor: triggers local push when heavy rain is predicted within 15 min of start
  useEffect(() => {
    if (!config.enabled || isWorkoutActive) return;
    if (minutesUntilStart === null) return;
    if (minutesUntilStart <= 0 || minutesUntilStart > config.leadTimeMinutes) return;
    if (!assessment.isHeavyRain) return;
    if (config.lastNotifiedForIso === config.scheduledAtIso) return;

    setConfig((prev) => ({ ...prev, lastNotifiedForIso: prev.scheduledAtIso }));
    dispatchLocalPush(assessment, minutesUntilStart, false);
  }, [
    config.enabled,
    config.leadTimeMinutes,
    config.lastNotifiedForIso,
    config.scheduledAtIso,
    isWorkoutActive,
    minutesUntilStart,
    assessment,
    dispatchLocalPush,
  ]);

  // Notify parent App.tsx of current status for navbar badge & pre-workout preview card
  useEffect(() => {
    if (!onStatusChange) return;
    onStatusChange({
      enabled: config.enabled,
      isHeavyRain: assessment.isHeavyRain,
      hasActiveBanner: Boolean(activeAlert),
      scheduledLabel,
      minutesUntilStart,
      conditionLabel: assessment.conditionLabel,
      precipitationMm: assessment.precipitationMm,
      precipitationProbability: assessment.precipitationProbability,
      permission,
    });
  }, [
    onStatusChange,
    config.enabled,
    assessment.isHeavyRain,
    assessment.conditionLabel,
    assessment.precipitationMm,
    assessment.precipitationProbability,
    activeAlert,
    scheduledLabel,
    minutesUntilStart,
    permission,
  ]);

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      setPermissionFeedback('Notificações nativas indisponíveis neste navegador. O alerta flutuante no app continuará ativo.');
      return;
    }

    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setPermissionFeedback('Permissão concedida! Notificações Push Locais do sistema ativadas.');
        tacticalAudio.playRadarPingSound();
      } else if (result === 'denied') {
        setPermissionFeedback('Permissão negada no navegador. Você ainda receberá o alerta tático dentro do RUN360X.');
      } else {
        setPermissionFeedback('Solicitação pendente. Você pode tentar novamente quando desejar.');
      }
    } catch {
      setPermissionFeedback('Ambiente restrito para push nativo. O alerta flutuante interno do app permanece operacional.');
    }
  };

  const handleRescheduleTo = (newIso: string, labelOverride?: string) => {
    setConfig((prev) => ({
      ...prev,
      enabled: true,
      scheduledAtIso: newIso,
      lastNotifiedForIso: null,
    }));
    setNowMs(Date.now());
    setActiveAlert(null);
    const label = labelOverride || formatScheduledLabel(newIso);
    showRescheduleConfirmation(`Missão reagendada para ${label}. Alerta T-15m rearmado.`);
  };

  const handlePostponeOneHour = () => {
    const baseMs = new Date(config.scheduledAtIso).getTime();
    const safeBase = Number.isNaN(baseMs) || baseMs < Date.now() ? Date.now() : baseMs;
    const nextDate = new Date(safeBase + 60 * 60 * 1000);
    nextDate.setSeconds(0, 0);
    const nextIso = formatLocalDateTimeInput(nextDate);
    handleRescheduleTo(nextIso);
  };

  const handleQuickPreset = (preset: '15m' | '1h' | 'tomorrow7') => {
    const d = new Date();
    if (preset === '15m') {
      d.setMinutes(d.getMinutes() + 15, 0, 0);
    } else if (preset === '1h') {
      d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0);
    } else {
      d.setDate(d.getDate() + 1);
      d.setHours(7, 0, 0, 0);
    }
    setConfig((prev) => ({
      ...prev,
      enabled: true,
      scheduledAtIso: formatLocalDateTimeInput(d),
      lastNotifiedForIso: null,
    }));
    setNowMs(Date.now());
  };

  const handleSimulateHeavyRainPush = () => {
    // Use real suggested dry slot if available, otherwise +2h from now
    const fallbackDry = new Date(Date.now() + 2 * 60 * 60 * 1000);
    fallbackDry.setMinutes(0, 0, 0);
    const isTomorrow = fallbackDry.getDate() !== new Date().getDate();
    const fallbackLabel = `${isTomorrow ? 'Amanhã' : 'Hoje'} às ${fallbackDry.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    const simulatedAssessment: HeavyRainAssessment = {
      isHeavyRain: true,
      severity: 'storm',
      precipitationMm: Math.max(14.2, assessment.precipitationMm),
      precipitationProbability: Math.max(92, assessment.precipitationProbability),
      weatherCode: 65,
      conditionLabel: 'Chuva Forte Torrencial',
      suggestedRescheduleIso: assessment.isHeavyRain
        ? assessment.suggestedRescheduleIso
        : formatLocalDateTimeInput(fallbackDry),
      suggestedRescheduleLabel: assessment.isHeavyRain
        ? assessment.suggestedRescheduleLabel
        : fallbackLabel,
    };

    dispatchLocalPush(simulatedAssessment, LEAD_TIME_MINUTES, true);
  };

  const permissionBadge =
    permission === 'granted'
      ? { label: 'PUSH NATIVO ATIVO', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' }
      : permission === 'denied'
        ? { label: 'NAVEGADOR BLOQUEADO (MODO APP)', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' }
        : permission === 'unsupported'
          ? { label: 'MODO IN-APP ATIVO', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' }
          : { label: 'PERMISSÃO PENDENTE', cls: 'bg-slate-700/50 text-slate-300 border-slate-600' };

  return (
    <>
      {/* 1. Floating Local Push Notification Banner (Global T-15m Heavy Rain Alert) */}
      {activeAlert && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed top-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-md rounded-2xl border-2 p-4 shadow-2xl backdrop-blur-xl transition-all ${
            isLight
              ? 'bg-white/95 border-rose-500 text-slate-900 shadow-rose-500/20'
              : 'bg-slate-950/95 border-rose-500/90 text-white shadow-[0_0_32px_rgba(244,63,94,0.35)]'
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-400 shrink-0">
                {activeAlert.assessment.severity === 'storm' ? (
                  <CloudLightning className="w-5 h-5 animate-pulse" />
                ) : (
                  <CloudRain className="w-5 h-5 animate-bounce" />
                )}
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500 text-white">
                    PUSH LOCAL • T-{activeAlert.minutesUntilStart} MIN
                  </span>
                  {activeAlert.isSimulated && (
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      SIMULAÇÃO
                    </span>
                  )}
                </div>
                <h4 className="font-black text-sm mt-1 leading-tight">
                  Alerta de Chuva Forte antes do Treino
                </h4>
              </div>
            </div>

            <button
              onClick={() => setActiveAlert(null)}
              className={`p-1 rounded-lg transition cursor-pointer ${
                isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
              aria-label="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body & Weather Details */}
          <div
            className={`mt-3 p-3 rounded-xl border text-xs font-mono space-y-1.5 ${
              isLight
                ? 'bg-rose-50 border-rose-200 text-slate-800'
                : 'bg-rose-950/35 border-rose-500/30 text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <span className="truncate">{activeAlert.missionTitle}</span>
              <span className="text-[10px] opacity-75 shrink-0">{activeAlert.triggeredAt}</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Previsão indica <strong className="text-rose-400">{activeAlert.assessment.conditionLabel}</strong>{' '}
              ({activeAlert.assessment.precipitationMm} mm/h • {activeAlert.assessment.precipitationProbability}% prob.) para o início da missão em{' '}
              <strong>{activeAlert.minutesUntilStart} minutos</strong>.
            </p>
            <div className="flex items-center gap-1.5 pt-1 text-[11px] font-bold text-cyan-400">
              <CalendarClock className="w-3.5 h-3.5 shrink-0" />
              <span>Sugestão: reagendar para {activeAlert.assessment.suggestedRescheduleLabel}</span>
            </div>
          </div>

          {/* Reschedule Action Buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                handleRescheduleTo(
                  activeAlert.assessment.suggestedRescheduleIso,
                  activeAlert.assessment.suggestedRescheduleLabel
                )
              }
              className={`flex-1 min-w-[160px] py-2 px-3 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                isLight
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>REAGENDAR ({activeAlert.assessment.suggestedRescheduleLabel.replace('Hoje às ', '').replace('Amanhã às ', 'Amanhã ')})</span>
            </button>

            <button
              onClick={handlePostponeOneHour}
              className={`py-2 px-3 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-slate-900 hover:bg-slate-800 border-cyan-500/30 text-cyan-300'
              }`}
            >
              +1 HORA
            </button>

            <button
              onClick={() => setActiveAlert(null)}
              className={`py-2 px-3 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                  : 'bg-slate-900/60 hover:bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              MANTER
            </button>
          </div>
        </div>
      )}

      {/* 2. Reschedule Confirmation Mini-Toast */}
      {rescheduleToast && !activeAlert && (
        <div
          role="status"
          className={`fixed top-20 right-4 z-50 max-w-sm rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md flex items-center gap-2.5 text-xs font-mono font-bold ${
            isLight
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-slate-950/95 border-emerald-500/60 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{rescheduleToast}</span>
          <button
            onClick={() => setRescheduleToast(null)}
            className="ml-auto p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
            aria-label="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Local Push Notification & Mission Scheduler Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onCloseModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-slate-900 border-cyan-500/30 text-slate-100 shadow-[0_0_40px_rgba(6,182,212,0.18)]'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`px-6 py-4 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/90 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-2xl border ${
                    assessment.isHeavyRain
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      : isLight
                        ? 'bg-orange-100 border-orange-200 text-orange-600'
                        : 'bg-cyan-950 border-cyan-500/40 text-cyan-400'
                  }`}
                >
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base uppercase tracking-wide">
                    Notificação Push Local (T-15 min)
                  </h3>
                  <p className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Alerta automático de chuva forte antes do início da missão
                  </p>
                </div>
              </div>

              <button
                onClick={onCloseModal}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isLight ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-800 text-slate-400'
                }`}
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Master Toggle & Browser Permission */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {config.enabled ? (
                      <Bell className={`w-4 h-4 ${isLight ? 'text-orange-600' : 'text-cyan-400'}`} />
                    ) : (
                      <BellOff className="w-4 h-4 text-slate-500" />
                    )}
                    <div>
                      <div className="text-xs font-mono font-bold uppercase">
                        Monitoramento Climático T-15 Minutos
                      </div>
                      <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Dispara push local 15 min antes se houver chuva forte
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        enabled: !prev.enabled,
                        lastNotifiedForIso: null,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                      config.enabled
                        ? isLight
                          ? 'bg-orange-500 text-white border-orange-600'
                          : 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : isLight
                          ? 'bg-slate-200 text-slate-600 border-slate-300'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {config.enabled ? 'ATIVADO' : 'DESATIVADO'}
                  </button>
                </div>

                {/* Browser Push Permission Row */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg border ${permissionBadge.cls}`}
                  >
                    {permissionBadge.label}
                  </span>

                  {permission !== 'granted' && permission !== 'unsupported' && (
                    <button
                      onClick={handleRequestPermission}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                        isLight
                          ? 'bg-white hover:bg-orange-50 border-orange-300 text-orange-700'
                          : 'bg-cyan-950 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
                      }`}
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      <span>PERMITIR PUSH DO NAVEGADOR</span>
                    </button>
                  )}
                </div>

                {permissionFeedback && (
                  <p className="text-[11px] font-mono text-cyan-400 leading-relaxed">
                    {permissionFeedback}
                  </p>
                )}
              </div>

              {/* Scheduled Mission Date/Time Picker */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="scheduled-workout-time"
                    className="text-xs font-mono font-bold uppercase flex items-center gap-1.5"
                  >
                    <Clock className={`w-4 h-4 ${isLight ? 'text-orange-600' : 'text-cyan-400'}`} />
                    <span>Horário Agendado da Missão</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-cyan-400">
                    {minutesUntilStart !== null && minutesUntilStart > 0
                      ? minutesUntilStart >= 60
                        ? `em ${Math.floor(minutesUntilStart / 60)}h ${minutesUntilStart % 60}m`
                        : `em ${minutesUntilStart} min`
                      : 'Horário atingido'}
                  </span>
                </div>

                <input
                  id="scheduled-workout-time"
                  type="datetime-local"
                  value={config.scheduledAtIso}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setConfig((prev) => ({
                      ...prev,
                      scheduledAtIso: e.target.value,
                      lastNotifiedForIso: null,
                    }));
                    setNowMs(Date.now());
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold outline-none transition ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-orange-500'
                      : 'bg-slate-900 border-slate-700 text-cyan-200 focus:border-cyan-400'
                  }`}
                />

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleQuickPreset('15m')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer ${
                      isLight
                        ? 'bg-white hover:bg-orange-50 border-slate-300 text-slate-700'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Em 15 min (Janela Push)
                  </button>
                  <button
                    onClick={() => handleQuickPreset('1h')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer ${
                      isLight
                        ? 'bg-white hover:bg-orange-50 border-slate-300 text-slate-700'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Daqui a 1 hora
                  </button>
                  <button
                    onClick={() => handleQuickPreset('tomorrow7')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer ${
                      isLight
                        ? 'bg-white hover:bg-orange-50 border-slate-300 text-slate-700'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Amanhã 07:00
                  </button>
                </div>
              </div>

              {/* Forecast Rain Assessment for Scheduled Slot */}
              <div
                className={`p-4 rounded-2xl border space-y-2.5 ${
                  assessment.isHeavyRain
                    ? isLight
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : 'bg-rose-950/35 border-rose-500/50 text-rose-100'
                    : assessment.severity === 'moderate'
                      ? isLight
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                      : isLight
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-emerald-950/25 border-emerald-500/35 text-emerald-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs font-black uppercase">
                    {assessment.isHeavyRain ? (
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Droplets className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>
                      {assessment.isHeavyRain
                        ? 'RISCO DE CHUVA FORTE DETECTADO'
                        : assessment.severity === 'moderate'
                          ? 'CHUVA MODERADA PREVISTA'
                          : 'JANELA CLIMÁTICA SEGURA'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono opacity-80">{scheduledLabel}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div
                    className={`p-2 rounded-xl border ${
                      isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="text-[10px] opacity-70">CONDIÇÃO</div>
                    <div className="text-xs font-bold truncate mt-0.5">{assessment.conditionLabel}</div>
                  </div>
                  <div
                    className={`p-2 rounded-xl border ${
                      isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="text-[10px] opacity-70">VOLUME</div>
                    <div className="text-xs font-bold mt-0.5">{assessment.precipitationMm} mm/h</div>
                  </div>
                  <div
                    className={`p-2 rounded-xl border ${
                      isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="text-[10px] opacity-70">PROB. CHUVA</div>
                    <div className="text-xs font-bold mt-0.5">{assessment.precipitationProbability}%</div>
                  </div>
                </div>

                {assessment.isHeavyRain && (
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-rose-500/30">
                    <span className="text-[11px] font-mono font-bold">
                      Janela seca sugerida: {assessment.suggestedRescheduleLabel}
                    </span>
                    <button
                      onClick={() =>
                        handleRescheduleTo(
                          assessment.suggestedRescheduleIso,
                          assessment.suggestedRescheduleLabel
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>REAGENDAR AGORA</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Instant Push Simulation Button */}
              <div
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isLight ? 'bg-orange-50/70 border-orange-200' : 'bg-cyan-950/25 border-cyan-500/30'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-mono font-bold flex items-center gap-1.5">
                    <Sparkles className={`w-3.5 h-3.5 ${isLight ? 'text-orange-600' : 'text-cyan-400'}`} />
                    <span>Simular Alerta Push de Chuva Forte (T-15m)</span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Dispara o alerta local imediatamente para testar o aviso e o reagendamento da missão.
                  </p>
                </div>

                <button
                  onClick={() => {
                    handleSimulateHeavyRainPush();
                    onCloseModal();
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                    isLight
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 shadow-[0_0_16px_rgba(244,63,94,0.35)]'
                  }`}
                >
                  <CloudLightning className="w-3.5 h-3.5" />
                  <span>TESTAR PUSH T-15M</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              className={`px-6 py-3.5 border-t flex items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/90 border-slate-800'
              }`}
            >
              <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Fonte: Open-Meteo Horário • Limiar: Chuva Forte / Tempestade
              </span>
              <button
                onClick={onCloseModal}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                  isLight
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                }`}
              >
                SALVAR & FECHAR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LocalPushNotification;
