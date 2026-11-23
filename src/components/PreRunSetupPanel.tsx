import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Compass,
  Flame,
  Gauge,
  MapPin,
  Minus,
  Mountain,
  Play,
  Plus,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Sparkles,
  Timer,
  Trees,
  Volume2,
  VolumeX,
  BellRing,
  CloudRain,
} from 'lucide-react';
import {
  GpsSyncStatus,
  LatLng,
  RunVenueType,
  TrainingLevel,
  WeatherData,
  WorkoutOption,
} from '../types';
import { RUN_VENUES, getRunVenueConfig } from '../data/runVenues';
import { TRAINING_LEVELS } from '../data/trainingPrograms';
import { AudioCoachSnapshot, tacticalAudio } from '../utils/audio';
import { LocalPushStatusSummary } from './LocalPushNotification';

interface PreRunSetupPanelProps {
  selectedLevel: TrainingLevel;
  selectedWorkoutOption?: WorkoutOption;
  onSelectWorkoutOption: (level: TrainingLevel, opt: WorkoutOption) => void;
  selectedVenue: RunVenueType;
  onSelectVenue: (venue: RunVenueType) => void;
  treadmillIncline: number;
  onChangeTreadmillIncline: (incline: number) => void;
  userPosition: LatLng;
  onGpsPositionResolved: (pos: LatLng, useSimulation: boolean) => void;
  onLaunchWorkout: (params: { venue: RunVenueType; useSimulation: boolean; inclinePercent: number }) => void;
  onOpenCoach: () => void;
  onOpenWeatherModal: () => void;
  onOpenAudioModal: () => void;
  onOpenPushModal: () => void;
  liveWeather: WeatherData | null;
  audioCoachSnap: AudioCoachSnapshot;
  pushStatus: LocalPushStatusSummary | null;
  userLevel: number;
  userXp: number;
  athleteName?: string;
  theme?: 'dark' | 'light';
}

export const PreRunSetupPanel: React.FC<PreRunSetupPanelProps> = ({
  selectedLevel,
  selectedWorkoutOption,
  onSelectWorkoutOption,
  selectedVenue,
  onSelectVenue,
  treadmillIncline,
  onChangeTreadmillIncline,
  userPosition,
  onGpsPositionResolved,
  onLaunchWorkout,
  onOpenCoach,
  onOpenWeatherModal,
  onOpenAudioModal,
  onOpenPushModal,
  liveWeather,
  audioCoachSnap,
  pushStatus,
  userLevel,
  userXp,
  athleteName = 'Atleta',
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const venueConfig = getRunVenueConfig(selectedVenue);

  const [gpsStatus, setGpsStatus] = useState<GpsSyncStatus>(
    venueConfig.requiresOutdoorGps ? 'searching' : 'indoor_ready'
  );
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [gpsProgress, setGpsProgress] = useState<number>(venueConfig.requiresOutdoorGps ? 25 : 100);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [isUsingSimulatedGps, setIsUsingSimulatedGps] = useState<boolean>(false);
  const [syncAttempt, setSyncAttempt] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);

  // Run live GPS synchronization whenever an outdoor venue is active
  useEffect(() => {
    if (!venueConfig.requiresOutdoorGps) {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsStatus('indoor_ready');
      setGpsProgress(100);
      setGpsErrorMsg(null);
      return;
    }

    if (isUsingSimulatedGps) {
      setGpsStatus('simulated');
      setGpsProgress(100);
      setGpsAccuracyMeters(5);
      setGpsErrorMsg(null);
      return;
    }

    setGpsStatus('searching');
    setGpsProgress(22);
    setGpsErrorMsg(null);

    const progressTimer = window.setInterval(() => {
      setGpsProgress((prev) => (prev < 86 ? prev + 14 : prev));
    }, 450);

    if (!('geolocation' in navigator)) {
      window.clearInterval(progressTimer);
      setGpsStatus('error');
      setGpsErrorMsg('Geolocalização não disponível neste navegador. Ative o Simulador GPS abaixo.');
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      window.clearInterval(progressTimer);
      const acc = Math.round(pos.coords.accuracy || 12);
      setGpsAccuracyMeters(acc);
      setGpsProgress(100);
      setGpsStatus('locked');
      setGpsErrorMsg(null);
      onGpsPositionResolved(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        false
      );
    };

    const onError = (err: GeolocationPositionError) => {
      window.clearInterval(progressTimer);
      setGpsStatus('error');
      setGpsProgress(0);
      if (err.code === err.PERMISSION_DENIED) {
        setGpsErrorMsg('Permissão de GPS recusada. Libere a localização ou use o Simulador GPS.');
      } else {
        setGpsErrorMsg('Sinal de satélites fraco em ambiente fechado. Tentar novamente ou usar Simulador GPS.');
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 4000,
    });

    return () => {
      window.clearInterval(progressTimer);
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [venueConfig.requiresOutdoorGps, isUsingSimulatedGps, syncAttempt]);

  const isReadyToStart =
    gpsStatus === 'locked' || gpsStatus === 'simulated' || gpsStatus === 'indoor_ready';

  const handleActivateSimulatedGps = () => {
    setIsUsingSimulatedGps(true);
    setGpsStatus('simulated');
    setGpsAccuracyMeters(5);
    setGpsProgress(100);
    setGpsErrorMsg(null);
    onGpsPositionResolved(userPosition, true);
  };

  const handleRetryRealGps = () => {
    setIsUsingSimulatedGps(false);
    setSyncAttempt((prev) => prev + 1);
  };

  const nextLevelXp = userLevel * 1000;
  const levelProgressPct = Math.min(100, Math.round(((userXp % 1000) / 1000) * 100));

  const getVenueIcon = (id: RunVenueType) => {
    switch (id) {
      case 'track_400m':
        return <Timer className="w-4 h-4" />;
      case 'track_200m':
        return <Flame className="w-4 h-4" />;
      case 'treadmill':
        return <Activity className="w-4 h-4" />;
      case 'road_city':
        return <Compass className="w-4 h-4" />;
      case 'trail':
        return <Trees className="w-4 h-4" />;
    }
  };

  return (
    <div
      className={`p-5 sm:p-6 border rounded-3xl space-y-5 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
          : 'bg-slate-900 border-slate-800 text-white'
      }`}
    >
      {/* Motivational Athlete Readiness Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                isLight ? 'text-orange-600' : 'text-cyan-400'
              }`}
            >
              Preparação de Largada · {athleteName}
            </p>
            <h2 className="text-xl font-black tracking-tight uppercase mt-0.5">
              {selectedLevel.title.split(' • ')[0]}: {selectedLevel.codename}
            </h2>
          </div>

          <div className="text-right font-mono tabular-nums shrink-0">
            <div className={`text-xs font-black ${isLight ? 'text-orange-600' : 'text-cyan-400'}`}>
              LVL {userLevel}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {userXp} / {nextLevelXp} XP
            </div>
          </div>
        </div>

        {/* XP Readiness Bar & Motivational Quote */}
        <div className="space-y-1.5">
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isLight ? 'bg-orange-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.max(8, levelProgressPct)}%` }}
            />
          </div>
          <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            “{venueConfig.motivationQuote}”
          </p>
        </div>
      </div>

      {/* STEP 1: GPS SYNCHRONIZATION GATE */}
      <div
        className={`p-4 rounded-2xl border space-y-3 ${
          gpsStatus === 'locked' || gpsStatus === 'indoor_ready'
            ? isLight
              ? 'bg-emerald-50/70 border-emerald-200'
              : 'bg-emerald-950/25 border-emerald-500/35'
            : gpsStatus === 'simulated'
              ? isLight
                ? 'bg-sky-50/70 border-sky-200'
                : 'bg-cyan-950/25 border-cyan-500/35'
              : gpsStatus === 'error'
                ? isLight
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-amber-950/30 border-amber-500/40'
                : isLight
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-slate-950/70 border-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                gpsStatus === 'locked' || gpsStatus === 'indoor_ready'
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : gpsStatus === 'simulated'
                    ? 'bg-cyan-500/15 text-cyan-400'
                    : gpsStatus === 'error'
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-sky-500/15 text-sky-400'
              }`}
            >
              {gpsStatus === 'locked' || gpsStatus === 'indoor_ready' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Satellite className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-black uppercase tracking-wider">
                  1. Sincronização de GPS
                </span>
                <span
                  className={`text-[10px] font-mono font-bold uppercase ${
                    gpsStatus === 'locked' || gpsStatus === 'indoor_ready'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : gpsStatus === 'simulated'
                        ? 'text-sky-600 dark:text-cyan-300'
                        : gpsStatus === 'error'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {gpsStatus === 'locked'
                    ? `Sinal Fixo · ±${gpsAccuracyMeters ?? 10}m`
                    : gpsStatus === 'indoor_ready'
                      ? 'Modo Indoor Pronto (Sem GPS)'
                      : gpsStatus === 'simulated'
                        ? 'Simulador GPS Sincronizado'
                        : gpsStatus === 'error'
                          ? 'Sinal Indisponível'
                          : 'Buscando satélites...'}
                </span>
              </div>

              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                {gpsStatus === 'indoor_ready'
                  ? 'Esteira selecionada: sensor de passada e controle de inclinação calibrados instantaneamente.'
                  : gpsStatus === 'locked'
                    ? `Coordenadas sincronizadas (${userPosition.lat.toFixed(4)}, ${userPosition.lng.toFixed(4)}). Pronto para largada!`
                    : gpsStatus === 'simulated'
                      ? `Percurso simulado sincronizado em (${userPosition.lat.toFixed(4)}, ${userPosition.lng.toFixed(4)}).`
                      : gpsErrorMsg || 'Aguarde a fixação do GPS antes de iniciar sua corrida ao ar livre.'}
              </p>
            </div>
          </div>
        </div>

        {/* GPS Acquisition Progress Bar */}
        {venueConfig.requiresOutdoorGps && gpsStatus === 'searching' && (
          <div className="space-y-1">
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${gpsProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* GPS Actions */}
        {venueConfig.requiresOutdoorGps && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {(gpsStatus === 'searching' || gpsStatus === 'error') && (
              <button
                type="button"
                onClick={handleActivateSimulatedGps}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                  isLight
                    ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                    : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40'
                }`}
              >
                Usar Simulador GPS
              </button>
            )}
            {(gpsStatus === 'error' || gpsStatus === 'simulated') && (
              <button
                type="button"
                onClick={handleRetryRealGps}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sincronizar GPS Real</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* STEP 2: RUNNING VENUE / SURFACE SELECTOR (5 MODES) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-mono font-black uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            2. Onde será sua corrida?
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            5 cenários em 3D
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {RUN_VENUES.map((v) => {
            const active = selectedVenue === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVenue(v.id)}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-start gap-3 min-h-[72px] ${
                  active
                    ? isLight
                      ? 'bg-orange-50 border-orange-500 text-slate-900 ring-1 ring-orange-400'
                      : 'bg-cyan-950/45 border-cyan-400 text-white ring-1 ring-cyan-400/50'
                    : isLight
                      ? 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    active
                      ? isLight
                        ? 'bg-orange-500 text-white'
                        : 'bg-cyan-400 text-slate-950'
                      : isLight
                        ? 'bg-white border border-slate-200 text-slate-600'
                        : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}
                >
                  {getVenueIcon(v.id)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-black tracking-tight">{v.label}</span>
                    {v.lapLengthMeters && (
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                        {v.lapLengthMeters}m/volta
                      </span>
                    )}
                    {v.id === 'treadmill' && (
                      <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                        Indoor
                      </span>
                    )}
                    {v.id === 'trail' && (
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Elevação
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-snug mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {v.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Treadmill Incline Pre-Config when Esteira is chosen */}
        {selectedVenue === 'treadmill' && (
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isLight
                ? 'bg-amber-50/70 border-amber-200 text-slate-800'
                : 'bg-slate-950/80 border-amber-500/35 text-slate-200'
            }`}
          >
            <div>
              <p className="text-xs font-mono font-bold uppercase text-amber-600 dark:text-amber-400">
                Inclinação Inicial da Esteira
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ajuste a inclinação (0% a 15%) antes ou durante a corrida
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onChangeTreadmillIncline(Math.max(0, Number((treadmillIncline - 0.5).toFixed(1))))}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition ${
                  isLight ? 'bg-white border-slate-300 hover:bg-slate-100' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
                }`}
                aria-label="Reduzir inclinação"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-base font-mono font-black tabular-nums min-w-[52px] text-center">
                {treadmillIncline.toFixed(1)}%
              </span>
              <button
                type="button"
                onClick={() => onChangeTreadmillIncline(Math.min(15, Number((treadmillIncline + 0.5).toFixed(1))))}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition ${
                  isLight ? 'bg-white border-slate-300 hover:bg-slate-100' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'
                }`}
                aria-label="Aumentar inclinação"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* STEP 3: WORKOUT MODALITY SELECTOR (3 OPTIONS) */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <span className={`text-[11px] font-mono uppercase font-bold block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          3. Modalidade do Treino
        </span>
        <div className="grid grid-cols-3 gap-2">
          {selectedLevel.workoutOptions.map((opt) => {
            const isSelected = selectedWorkoutOption?.id === opt.id || selectedLevel.title.includes(opt.title);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const baseLevel = TRAINING_LEVELS.find((l) => l.id === selectedLevel.id) || selectedLevel;
                  onSelectWorkoutOption(
                    {
                      ...baseLevel,
                      title: `${baseLevel.title} • ${opt.title}`,
                      targetDistanceKm: opt.targetDistanceKm,
                      intervals: opt.intervals,
                    },
                    opt
                  );
                }}
                className={`p-2.5 rounded-xl border text-center font-mono transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  isSelected
                    ? isLight
                      ? 'bg-orange-50 border-orange-500 text-orange-800'
                      : 'bg-cyan-950/70 border-cyan-400 text-cyan-200'
                    : isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="text-lg">{opt.badge}</span>
                <span className="text-[11px] font-bold leading-tight">{opt.title.split(' ')[0]}</span>
                <span className="text-[10px] opacity-80 tabular-nums">{opt.targetDistanceKm} km</span>
              </button>
            );
          })}
        </div>

        {selectedWorkoutOption && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/70 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap tabular-nums">
              <span className="font-bold">{selectedWorkoutOption.targetDistanceKm} km</span>
              <span className="opacity-40">·</span>
              <span>~{selectedWorkoutOption.estimatedDurationMins} min</span>
              <span className="opacity-40">·</span>
              <span>Pace {selectedWorkoutOption.targetPaceMinKm.toFixed(1)} min/km</span>
            </div>
            <span className="text-amber-500 font-bold">+{selectedWorkoutOption.xpBonus} XP</span>
          </div>
        )}
      </div>

      {/* Compact Readiness Utilities Row: Weather · Audio Coach · Rain Alert */}
      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
        <button
          type="button"
          onClick={onOpenWeatherModal}
          className={`px-2.5 py-2 rounded-xl border text-left transition cursor-pointer truncate ${
            isLight
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <span className="block font-bold truncate">
            {liveWeather ? `${liveWeather.condition.icon} ${liveWeather.temperatureC}°C` : 'Clima'}
          </span>
          <span className="text-[10px] text-slate-500 truncate block">Hidratação</span>
        </button>

        <button
          type="button"
          onClick={onOpenAudioModal}
          className={`px-2.5 py-2 rounded-xl border text-left transition cursor-pointer truncate ${
            isLight
              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <span className="flex items-center gap-1 font-bold truncate">
            {audioCoachSnap.settings.enabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span>Voz {audioCoachSnap.settings.enabled ? 'ON' : 'OFF'}</span>
          </span>
          <span className="text-[10px] text-slate-500 truncate block">Audio Coach</span>
        </button>

        <button
          type="button"
          onClick={onOpenPushModal}
          className={`px-2.5 py-2 rounded-xl border text-left transition cursor-pointer truncate ${
            pushStatus?.isHeavyRain
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
              : isLight
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <span className="flex items-center gap-1 font-bold truncate">
            {pushStatus?.isHeavyRain ? (
              <CloudRain className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <BellRing className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            <span>{pushStatus?.isHeavyRain ? 'Chuva' : 'Alerta'}</span>
          </span>
          <span className="text-[10px] text-slate-500 truncate block">T-15m Push</span>
        </button>
      </div>

      {/* Primary Launch CTA & Coach Button */}
      <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
        <button
          type="button"
          onClick={onOpenCoach}
          className={`px-4 py-3.5 font-bold rounded-2xl text-xs font-mono transition cursor-pointer flex items-center justify-center gap-1.5 border ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-cyan-300'
          }`}
        >
          <Bot className="w-4 h-4 text-cyan-400" />
          <span>Coach IA</span>
        </button>

        <button
          type="button"
          disabled={!isReadyToStart}
          onClick={() =>
            onLaunchWorkout({
              venue: selectedVenue,
              useSimulation: isUsingSimulatedGps || !venueConfig.requiresOutdoorGps,
              inclinePercent: treadmillIncline,
            })
          }
          className={`flex-1 py-3.5 px-5 font-black rounded-2xl text-sm font-mono uppercase tracking-wider transition flex items-center justify-center gap-2 ${
            !isReadyToStart
              ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
              : isLight
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md cursor-pointer'
                : 'bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-lg cursor-pointer'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>
            {!isReadyToStart
              ? 'Aguardando GPS...'
              : `Iniciar em ${venueConfig.label}`}
          </span>
        </button>
      </div>
    </div>
  );
};
