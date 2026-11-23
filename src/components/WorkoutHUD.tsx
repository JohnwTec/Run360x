import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Zap,
  BatteryCharging,
  Flame,
  ArrowLeft,
  ArrowRight,
  Heart,
  Lock,
  Unlock,
  Calendar,
  Clock,
  Activity,
  ShieldAlert,
  Thermometer,
  Droplets,
  Wind,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Volume2,
  VolumeX,
  Sliders,
  Gauge,
  Flag,
  Radio,
  Minus,
  Plus,
  Mountain,
  Timer,
} from 'lucide-react';
import { TrainingLevel, XPOrb, CombatZone, LatLng, WeatherData, RunVenueType } from '../types';
import { getRunVenueConfig } from '../data/runVenues';
import { calculateDistanceMeters, formatPace, formatTime } from '../utils/geo';
import { fetchLiveWeather } from '../utils/weather';
import { AudioCoachSnapshot, tacticalAudio } from '../utils/audio';
import { WeatherModal } from './WeatherModal';
import { AudioCoachSettingsModal } from './AudioCoachSettingsModal';
import { LivePaceBarChart, LivePaceSample } from './LivePaceBarChart';
import { HeartRateZonesPanel } from './HeartRateZonesPanel';
import { computeHeartRateTelemetry } from '../utils/heartRateZones';
import { SpeedLinesOverlay } from './SpeedLinesOverlay';

const HYPER_SPEED_THRESHOLD_KMH = 16;

interface WorkoutHUDProps {
  level: TrainingLevel;
  isActive: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  totalDistanceMeters: number;
  currentPaceMinKm: number;
  currentSpeedKmh: number;
  maxSpeedKmh: number;
  currentIntervalIndex: number;
  ghostDistanceMeters: number;
  batteryPercent: number;
  xpGained: number;
  orbs: XPOrb[];
  combatZones: CombatZone[];
  isSimulating: boolean;
  simSpeedMultiplier: number;
  theme?: 'dark' | 'light';
  userPosition?: LatLng;
  weatherData?: WeatherData | null;
  onRefreshWeather?: () => void;

  autoPauseEnabled?: boolean;
  isAutoPaused?: boolean;
  stationarySeconds?: number;
  autoPauseThresholdSeconds?: number;
  liveGeoVelocityMs?: number | null;
  isSimStationary?: boolean;
  onToggleAutoPause?: () => void;
  onToggleSimStationary?: () => void;

  onTogglePause: () => void;
  onFinishWorkout: () => void;
  onToggleSimulating: () => void;
  onChangeSimSpeed: (mult: number) => void;
  onSteerSim: (direction: 'left' | 'right' | 'straight') => void;
  onTriggerBurst: () => void;

  // Running Venue & Surface Telemetry
  venue?: RunVenueType;
  inclinePercent?: number;
  elevationGainMeters?: number;
  onChangeIncline?: (next: number) => void;

  // Athlete Age for Dynamic Heart Rate Zones
  athleteAge?: number;
  onUpdateAthleteAge?: (nextAge: number) => void;
}

export const WorkoutHUD: React.FC<WorkoutHUDProps> = ({
  level,
  isActive,
  isPaused,
  elapsedSeconds,
  totalDistanceMeters,
  currentPaceMinKm,
  currentSpeedKmh,
  maxSpeedKmh,
  currentIntervalIndex,
  ghostDistanceMeters,
  batteryPercent,
  xpGained,
  orbs,
  combatZones,
  isSimulating,
  simSpeedMultiplier,
  theme = 'dark',
  userPosition,
  weatherData,
  onRefreshWeather,
  autoPauseEnabled = true,
  isAutoPaused = false,
  stationarySeconds = 0,
  autoPauseThresholdSeconds = 30,
  liveGeoVelocityMs = null,
  isSimStationary = false,
  onToggleAutoPause,
  onToggleSimStationary,
  onTogglePause,
  onFinishWorkout,
  onToggleSimulating,
  onChangeSimSpeed,
  onSteerSim,
  onTriggerBurst,
  venue = 'road_city' as RunVenueType,
  inclinePercent = 1.0,
  elevationGainMeters = 0,
  onChangeIncline,
  athleteAge = 28,
  onUpdateAthleteAge,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [liveWeather, setLiveWeather] = useState<WeatherData | null>(weatherData || null);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);
  const [showWeatherModal, setShowWeatherModal] = useState<boolean>(false);
  const [showAudioModal, setShowAudioModal] = useState<boolean>(false);
  const [audioSnap, setAudioSnap] = useState<AudioCoachSnapshot>(() => tacticalAudio.getSnapshot());
  const [paceHistory, setPaceHistory] = useState<LivePaceSample[]>([]);
  const lastPaceSampleSecRef = useRef<number>(-1);
  const lastSampledPaceRef = useRef<number | null>(null);

  const isLight = theme === 'light';

  useEffect(() => {
    return tacticalAudio.subscribe(setAudioSnap);
  }, []);

  // Sincronização e carregamento de clima via Open-Meteo Open Weather API
  const handleFetchWeather = async () => {
    setIsWeatherLoading(true);
    try {
      const pos = userPosition || { lat: -23.561684, lng: -46.655981 };
      const data = await fetchLiveWeather(pos);
      setLiveWeather(data);
    } catch (err) {
      console.warn('Erro ao carregar clima:', err);
    } finally {
      setIsWeatherLoading(false);
    }
  };

  useEffect(() => {
    if (weatherData) {
      setLiveWeather(weatherData);
    } else {
      handleFetchWeather();
    }
  }, [userPosition?.lat, userPosition?.lng, weatherData]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setCurrentDateTime(`${dateStr} • ${timeStr}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentInterval = level.intervals[currentIntervalIndex] || level.intervals[0];
  const collectedOrbsCount = orbs.filter((o) => o.collected).length;
  const activeZone = combatZones.find((z) => z.active);

  // Dynamic Heart Rate & Zones calculated from Athlete Age (Tanaka FC Máx) & Current Pace
  const hrTelemetry = computeHeartRateTelemetry({
    athleteAge,
    currentPaceMinKm,
    currentSpeedKmh,
    isPaused,
    elapsedSeconds,
    inclinePercent,
    venue,
  });
  const baseHeartRate = hrTelemetry.currentBpm;
  const heartZone = `${hrTelemetry.activeZone.code} - ${hrTelemetry.activeZone.name.toUpperCase()}`;
  const heartZoneColor = isLight
    ? hrTelemetry.activeZone.textLightClass
    : hrTelemetry.activeZone.textDarkClass;

  // Calculated Cadence (Passos por minuto - PPM)
  const currentCadencePpm = Math.min(195, Math.max(140, Math.round(158 + currentSpeedKmh * 1.8)));
  const isCadenceIdeal = currentCadencePpm >= 170 && currentCadencePpm <= 182;

  // Automatic Hyper-Speed Motion Blur / Speed Lines activation (> 16 km/h)
  const isHyperSpeed = isActive && !isPaused && currentSpeedKmh > HYPER_SPEED_THRESHOLD_KMH;
  const speedOverdriveLevel = isHyperSpeed
    ? Math.min(100, Math.round(((currentSpeedKmh - HYPER_SPEED_THRESHOLD_KMH) / 6) * 100))
    : 0;

  // Haptic Feedback helper
  const triggerHaptic = (pattern: number | number[] = 100) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // ignore
      }
    }
  };

  // Trigger vibration when interval phase changes
  useEffect(() => {
    triggerHaptic([100, 50, 100]);
  }, [currentIntervalIndex]);

  // Ring gauge progress calculation
  const targetMeters = (level.targetDistanceKm || 3) * 1000;
  const distanceProgressPercent = Math.min(100, (totalDistanceMeters / targetMeters) * 100);
  const strokeDashoffset = 440 - (440 * distanceProgressPercent) / 100;

  // Pace Delta check
  const targetPace = currentInterval.targetPaceMinKm;
  const paceDiff = currentPaceMinKm - targetPace;
  const isPaceGood = paceDiff <= 0.3;

  // Record live pace variation samples during the active session for the Recharts BarChart
  useEffect(() => {
    if (!isActive || elapsedSeconds === 0) {
      setPaceHistory([]);
      lastPaceSampleSecRef.current = -1;
      lastSampledPaceRef.current = null;
      return;
    }

    if (isPaused || !isFinite(currentPaceMinKm) || currentPaceMinKm <= 0 || currentPaceMinKm > 20) {
      return;
    }

    const secSinceLast = elapsedSeconds - lastPaceSampleSecRef.current;
    const sharpChange =
      lastSampledPaceRef.current !== null &&
      Math.abs(currentPaceMinKm - lastSampledPaceRef.current) >= 0.4;

    if (lastPaceSampleSecRef.current < 0 || secSinceLast >= 3 || (sharpChange && secSinceLast >= 1)) {
      lastPaceSampleSecRef.current = elapsedSeconds;
      lastSampledPaceRef.current = currentPaceMinKm;

      const diffMin = currentPaceMinKm - targetPace;
      const deltaSeconds = Math.round(diffMin * 60);
      let status: LivePaceSample['status'] = 'on_target';
      if (diffMin < -0.25) status = 'fast';
      else if (diffMin <= 0.25) status = 'on_target';
      else if (diffMin <= 0.6) status = 'slow';
      else status = 'critical';

      const sample: LivePaceSample = {
        id: `p-${elapsedSeconds}-${Date.now()}`,
        timeLabel: formatTime(elapsedSeconds),
        elapsedSeconds,
        pace: Number(currentPaceMinKm.toFixed(2)),
        targetPace: Number(targetPace.toFixed(2)),
        deltaSeconds,
        status,
      };

      setPaceHistory((prev) => [...prev.slice(-17), sample]);
    }
  }, [isActive, isPaused, elapsedSeconds, currentPaceMinKm, targetPace]);

  // Simulated Km Splits list
  const currentKm = Math.floor(totalDistanceMeters / 1000);
  const splits = Array.from({ length: Math.max(1, currentKm) }, (_, idx) => {
    const kmNum = idx + 1;
    const paceVal = (4.8 + (idx % 3) * 0.12).toFixed(2);
    return { km: kmNum, pace: paceVal };
  });

  return (
    <div className="flex flex-col gap-3 font-sans select-none relative">
      {/* Automatic Peripheral Viewport Speed Lines & Motion Blur Vignette (> 16 km/h) */}
      <SpeedLinesOverlay
        active={isHyperSpeed}
        speedKmh={currentSpeedKmh}
        thresholdKmh={HYPER_SPEED_THRESHOLD_KMH}
        theme={theme}
        variant="viewport"
      />
      {/* Date & Time Header (Inspired by Life Run reference image) */}
      <div
        className={`px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-mono border transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-700 shadow-sm'
            : 'bg-slate-900/90 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <Calendar className={`w-3.5 h-3.5 ${isLight ? 'text-orange-500' : 'text-cyan-400'}`} />
          <span className="font-bold capitalize">{currentDateTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => tacticalAudio.updateSettings({ enabled: !audioSnap.settings.enabled })}
            className={`px-2 py-0.5 rounded-lg border font-mono font-bold flex items-center gap-1 transition cursor-pointer hover:scale-105 ${
              audioSnap.settings.enabled
                ? audioSnap.isSpeaking
                  ? isLight
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-800 animate-pulse'
                    : 'bg-emerald-950 border-emerald-400 text-emerald-300 animate-pulse'
                  : isLight
                  ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800'
                  : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
                : isLight
                ? 'bg-slate-100 border-slate-300 text-slate-500'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={audioSnap.settings.enabled ? 'Silenciar Audio Coach por Voz' : 'Ativar Audio Coach por Voz'}
          >
            {audioSnap.settings.enabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{audioSnap.settings.enabled ? 'VOZ ON' : 'MUDO'}</span>
          </button>

          {liveWeather && (
            <button
              onClick={() => setShowWeatherModal(true)}
              className={`px-2 py-0.5 rounded-lg border font-mono font-bold flex items-center gap-1 transition cursor-pointer hover:scale-105 ${
                isLight
                  ? 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-800'
                  : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
              }`}
              title="Abrir Telemetria Meteorológica & Guia de Hidratação/Equipamento"
            >
              <span>{liveWeather.condition.icon}</span>
              <span>{liveWeather.temperatureC}°C</span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="font-bold">
              {isPaused ? (isAutoPaused ? 'AUTO-PAUSADO' : 'PAUSADO') : 'EM ANDAMENTO'}
            </span>
          </div>
        </div>
      </div>

      {/* Venue & Athlete Motivation Telemetry Strip */}
      {(() => {
        const venueCfg = getRunVenueConfig(venue);
        const lapLen = venueCfg.lapLengthMeters;
        const currentLap = lapLen ? Math.floor(totalDistanceMeters / lapLen) + 1 : null;
        const lapProgress = lapLen ? Math.round(totalDistanceMeters % lapLen) : null;
        const lapRemaining = lapLen && lapProgress !== null ? lapLen - lapProgress : null;
        const lapPct = lapLen && lapProgress !== null ? Math.min(100, Math.round((lapProgress / lapLen) * 100)) : 0;

        const motivationMsg = isPaused
          ? 'Recupere o fôlego — seu progresso está salvo.'
          : lapLen && lapRemaining !== null && lapRemaining <= 80
            ? `Reta final! Faltam apenas ${lapRemaining}m para fechar a Volta ${currentLap}!`
            : isPaceGood
              ? 'Ritmo de alta performance — sustente essa cadência!'
              : 'Ajuste a postura e aumente a cadência para encostar no ritmo alvo.';

        return (
          <div
            className={`px-4 py-3 rounded-2xl border space-y-2 ${
              isLight
                ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
                : 'bg-slate-900/95 border-slate-800 text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-mono font-black uppercase tracking-wide">
                <span className={isLight ? 'text-orange-600' : 'text-cyan-400'}>{venueCfg.label}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-slate-400 font-semibold normal-case">{venueCfg.surfaceLabel}</span>
              </div>

              {lapLen && currentLap !== null && lapProgress !== null && (
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold tabular-nums text-amber-500">
                  <Timer className="w-3.5 h-3.5" />
                  <span>Volta {currentLap} · {lapProgress}m/{lapLen}m</span>
                </div>
              )}

              {venue === 'trail' && (
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold tabular-nums text-emerald-500">
                  <Mountain className="w-3.5 h-3.5" />
                  <span>+{Math.round(elevationGainMeters)}m Elevação</span>
                </div>
              )}

              {venue === 'treadmill' && onChangeIncline && (
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-[10px] uppercase font-bold text-amber-500">Inclinação</span>
                  <button
                    type="button"
                    onClick={() => onChangeIncline(Math.max(0, Number((inclinePercent - 0.5).toFixed(1))))}
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${
                      isLight ? 'bg-slate-50 border-slate-300 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-black tabular-nums min-w-[44px] text-center">{inclinePercent.toFixed(1)}%</span>
                  <button
                    type="button"
                    onClick={() => onChangeIncline(Math.min(15, Number((inclinePercent + 0.5).toFixed(1))))}
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${
                      isLight ? 'bg-slate-50 border-slate-300 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {lapLen && (
              <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                <div
                  className={`h-full transition-all duration-300 ${isLight ? 'bg-orange-500' : 'bg-cyan-400'}`}
                  style={{ width: `${lapPct}%` }}
                />
              </div>
            )}

            <p className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              {motivationMsg}
            </p>
          </div>
        );
      })()}

      {/* Geolocation Velocity Auto-Pause Banner & Stationary Countdown */}
      {isPaused && isAutoPaused && (
        <div
          className={`px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 text-xs font-mono ${
            isLight
              ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
              : 'bg-amber-950/60 border-amber-500/50 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Pause className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="font-black uppercase tracking-wide">
                AUTO-PAUSE ATIVADO (PARADO &gt; {autoPauseThresholdSeconds}s)
              </p>
              <p className="text-[11px] opacity-85">
                Velocidade GPS estacionária detectada. Volte a correr para retomar automaticamente ou toque em RETOMAR.
              </p>
            </div>
          </div>
          <button
            onClick={onTogglePause}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase text-[10px] shrink-0 cursor-pointer transition"
          >
            RETOMAR
          </button>
        </div>
      )}

      {!isPaused && autoPauseEnabled && stationarySeconds > 0 && (
        <div
          className={`px-4 py-2.5 rounded-2xl border text-xs font-mono space-y-1.5 ${
            isLight
              ? 'bg-amber-50/90 border-amber-200 text-amber-900'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
              <span>PARADA DETECTADA • AUTO-PAUSE EM {Math.max(0, autoPauseThresholdSeconds - stationarySeconds + 1)}s</span>
            </span>
            <span className="text-[11px] font-black">
              {Math.min(stationarySeconds, autoPauseThresholdSeconds)}s / {autoPauseThresholdSeconds}s
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-amber-500/20 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (stationarySeconds / autoPauseThresholdSeconds) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Circular Gauge Card (Life Run / Strava / Runna Style) */}
      <div
        className={`relative overflow-hidden p-6 rounded-3xl border flex flex-col items-center justify-center text-center shadow-lg transition-all duration-300 ${
          isHyperSpeed
            ? isLight
              ? 'bg-white border-orange-400 text-slate-800 hud-hyperspeed-card'
              : 'bg-slate-900/95 border-cyan-400/80 text-white hud-hyperspeed-card'
            : isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-slate-900/95 border-cyan-500/30 text-white shadow-[0_0_30px_rgba(6,182,212,0.1)]'
        }`}
      >
        {/* Local HUD Radial Speed Lines & Directional Motion Blur Streaks (> 16 km/h) */}
        <SpeedLinesOverlay
          active={isHyperSpeed}
          speedKmh={currentSpeedKmh}
          thresholdKmh={HYPER_SPEED_THRESHOLD_KMH}
          theme={theme}
          variant="hud"
        />

        {/* Phase & Live Hyper-Speed Status Header */}
        <div className="relative z-10 mb-3 flex flex-col items-center gap-1.5">
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${
              currentInterval.type === 'sprint'
                ? isLight
                  ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                  : 'bg-rose-950 text-rose-400 border-rose-500/40 animate-pulse'
                : isLight
                ? 'bg-orange-100 text-orange-700 border-orange-300'
                : 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
            }`}
          >
            {currentInterval.label} • Alvo {formatPace(targetPace)}/km
          </span>

          {isHyperSpeed && (
            <div
              className={`flex items-center gap-2 text-[11px] font-mono font-black uppercase tracking-wider tabular-nums ${
                isLight ? 'text-orange-600' : 'text-cyan-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>MODO TURBO · {currentSpeedKmh.toFixed(1)} km/h</span>
              <span className="opacity-60">·</span>
              <span className={isLight ? 'text-amber-600' : 'text-amber-300'}>
                +{Math.max(10, speedOverdriveLevel)}% VELOCIDADE
              </span>
            </div>
          )}
        </div>

        {/* Circular Progress Ring with Timer & Live Velocity Readout */}
        <div className="relative z-10 w-52 h-52 flex items-center justify-center my-2">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            {/* Background Ring */}
            <circle
              cx="80"
              cy="80"
              r="70"
              className={isLight ? 'stroke-slate-200' : 'stroke-slate-800'}
              strokeWidth="10"
              fill="transparent"
            />
            {/* Progress Ring */}
            <circle
              cx="80"
              cy="80"
              r="70"
              className={`transition-all duration-500 ${
                isHyperSpeed
                  ? isLight
                    ? 'stroke-amber-500'
                    : 'stroke-amber-400'
                  : isLight
                  ? 'stroke-orange-500'
                  : 'stroke-cyan-400'
              }`}
              strokeWidth="10"
              strokeDasharray="440"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Inner Circle Timer & Speed Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={`text-[10px] font-mono uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              TEMPO TOTAL
            </span>
            <span
              className={`text-3xl sm:text-4xl font-black font-mono tabular-nums tracking-tight my-0.5 transition-all ${
                isHyperSpeed ? 'hud-speed-blur-text scale-[1.03]' : ''
              } ${isLight ? 'text-slate-900' : 'text-white'}`}
            >
              {formatTime(elapsedSeconds)}
            </span>
            <div className="flex items-center gap-2 mt-1 text-xs font-mono font-bold tabular-nums">
              <span
                className={
                  isHyperSpeed
                    ? isLight
                      ? 'text-orange-600 font-black'
                      : 'text-cyan-300 font-black'
                    : isLight
                    ? 'text-slate-600'
                    : 'text-slate-300'
                }
              >
                {currentSpeedKmh.toFixed(1)} km/h
              </span>
              <span className="opacity-40">·</span>
              <span className="flex items-center gap-0.5 text-amber-500">
                <Zap className="w-3 h-3 fill-amber-500" />
                +{xpGained} XP
              </span>
            </div>
          </div>
        </div>

        {/* Primary Metrics Row (Distância & Ritmo Médio) */}
        <div className="relative z-10 w-full grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-center border-r border-slate-200 dark:border-slate-800 pr-2">
            <span className={`text-[10px] font-mono uppercase block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              DISTÂNCIA
            </span>
            <p className={`text-2xl font-black font-mono ${isLight ? 'text-slate-900' : 'text-cyan-400'}`}>
              {(totalDistanceMeters / 1000).toFixed(2)}{' '}
              <span className={`text-xs font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>km</span>
            </p>
          </div>

          <div className="text-center pl-2">
            <span className={`text-[10px] font-mono uppercase block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              RITMO MÉDIO
            </span>
            <p className={`text-2xl font-black font-mono ${isPaceGood ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : (isLight ? 'text-orange-600' : 'text-rose-400')}`}>
              {formatPace(currentPaceMinKm)}
              <span className={`text-xs font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}> min/km</span>
            </p>
          </div>
        </div>

        {/* Heart Rate & Cadence Metrics Row */}
        <div className={`relative z-10 w-full mt-4 p-3 rounded-2xl grid grid-cols-2 gap-3 border ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
        }`}>
          {/* Frequência Cardíaca */}
          <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-800 pr-2">
            <Heart className={`w-5 h-5 text-rose-500 ${!isPaused && 'animate-ping'}`} />
            <div className="text-left">
              <span className={`text-[10px] font-mono uppercase block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                FREQ. CARDÍACA
              </span>
              <p className="text-sm font-black font-mono">{baseHeartRate} <span className="text-[10px] font-normal text-slate-400">bpm</span></p>
              <span className={`text-[9px] font-mono font-bold uppercase ${heartZoneColor}`}>{heartZone}</span>
            </div>
          </div>

          {/* Cadência de Passos (PPM) */}
          <div className="flex items-center gap-2 pl-1">
            <Activity className={`w-5 h-5 ${isCadenceIdeal ? 'text-emerald-500' : 'text-amber-500'}`} />
            <div className="text-left">
              <span className={`text-[10px] font-mono uppercase block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                CADÊNCIA (PPM)
              </span>
              <p className="text-sm font-black font-mono tabular-nums">{currentCadencePpm} <span className="text-[10px] font-normal text-slate-400">passos/min</span></p>
              <span className={`text-[9px] font-mono font-bold uppercase ${isCadenceIdeal ? 'text-emerald-500' : 'text-amber-500'}`}>
                {isCadenceIdeal ? '🎯 CADÊNCIA IDEAL (170-180)' : '⚠️ PASSADA LONGA (AUMENTAR PPM)'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Heart Rate Zones Panel (Age + Current Pace) */}
        <div className="relative z-10 w-full mt-3.5">
          <HeartRateZonesPanel
            telemetry={hrTelemetry}
            currentPaceMinKm={currentPaceMinKm}
            isActive={isActive}
            isPaused={isPaused}
            elapsedSeconds={elapsedSeconds}
            onUpdateAthleteAge={onUpdateAthleteAge}
            theme={theme}
          />
        </div>

        {/* Tactical Weather, Hydration & Gear Telemetry Card */}
        {liveWeather ? (
          <div
            className={`relative z-10 w-full mt-3.5 p-3.5 rounded-2xl border transition-all text-left space-y-2.5 ${
              isLight
                ? 'bg-slate-50/90 border-slate-200 text-slate-800 shadow-sm'
                : 'bg-slate-950/90 border-cyan-500/30 text-slate-200'
            }`}
          >
            {/* Weather Header Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xl p-1 rounded-xl bg-slate-200/50 dark:bg-slate-800/80">
                  {liveWeather.condition.icon}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black tracking-wide uppercase">
                      {liveWeather.temperatureC}°C • {liveWeather.condition.label}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                      isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}>
                      Sensação {liveWeather.apparentTemperatureC}°C
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <Droplets className="w-3 h-3 text-sky-400" /> {liveWeather.humidityPercent}% umidade
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Wind className="w-3 h-3 text-teal-400" /> {liveWeather.windSpeedKmh} km/h vento
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowWeatherModal(true)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase transition cursor-pointer border flex items-center gap-1 ${
                  isLight
                    ? 'bg-orange-100 hover:bg-orange-200 border-orange-300 text-orange-800'
                    : 'bg-cyan-950 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
                }`}
              >
                <span>GUIA COMPLETO</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Hydration Directive */}
            <div className={`p-2 rounded-xl text-[11px] font-mono border flex items-start gap-2 ${
              liveWeather.hydration.urgency === 'critical'
                ? isLight ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                : liveWeather.hydration.urgency === 'high'
                ? isLight ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                : isLight ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-cyan-950/50 border-cyan-500/30 text-cyan-200'
            }`}>
              <Droplets className="w-4 h-4 shrink-0 text-cyan-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-bold flex items-center justify-between gap-1 flex-wrap">
                  <span>HIDRATAÇÃO: {liveWeather.hydration.volumePerInterval} a cada {liveWeather.hydration.intervalMinutes}m</span>
                  <span className="text-[9px] opacity-80 uppercase">{liveWeather.hydration.electrolytesRecommendation}</span>
                </div>
                <p className="text-[10px] opacity-90 leading-tight mt-0.5 truncate sm:whitespace-normal">
                  {liveWeather.hydration.tip}
                </p>
              </div>
            </div>

            {/* Suggested Gear Quick Tags */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className={`text-[9px] font-mono uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                🛡️ Equipamento sugerido:
              </span>
              {liveWeather.gearSuggestions.slice(0, 3).map((g) => (
                <span
                  key={g.id}
                  onClick={() => setShowWeatherModal(true)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border flex items-center gap-1 cursor-pointer transition hover:scale-105 ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-500/40'
                  }`}
                  title={`${g.title}: ${g.reason}`}
                >
                  <span>{g.icon}</span>
                  <span className="truncate max-w-[130px]">{g.title.split(' (')[0]}</span>
                </span>
              ))}
            </div>

            {/* Smart Devices connectivity status bar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800/60 text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Sensor Garmin / Apple Watch conectado</span>
              </div>
              <button
                onClick={() => setShowAudioModal(true)}
                className="hidden sm:inline underline decoration-dotted hover:text-cyan-400 cursor-pointer"
              >
                🎧 Audio Coach {audioSnap.settings.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        ) : (
          <div className={`relative z-10 w-full mt-3 p-3 rounded-2xl border text-xs font-mono flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}>
            <span>📡 Sincronizando dados climáticos com Open-Meteo...</span>
            <button
              onClick={handleFetchWeather}
              className="text-cyan-500 font-bold underline cursor-pointer"
            >
              Reconectar
            </button>
          </div>
        )}

        {/* Web Speech API Live Audio Coach Panel */}
        <div
          className={`relative z-10 w-full mt-3 p-3.5 rounded-2xl border text-left space-y-2.5 transition-all ${
            audioSnap.isSpeaking
              ? isLight
                ? 'bg-emerald-50/90 border-emerald-400 text-slate-800 shadow-sm'
                : 'bg-cyan-950/50 border-cyan-400/70 text-slate-100 shadow-[0_0_18px_rgba(6,182,212,0.18)]'
              : isLight
              ? 'bg-slate-50 border-slate-200 text-slate-800'
              : 'bg-slate-950/85 border-slate-800 text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center border shrink-0 ${
                  audioSnap.settings.enabled
                    ? audioSnap.isSpeaking
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 animate-pulse'
                      : isLight
                      ? 'bg-orange-100 border-orange-200 text-orange-600'
                      : 'bg-cyan-950 border-cyan-500/40 text-cyan-400'
                    : 'bg-slate-800/60 border-slate-700 text-slate-500'
                }`}
              >
                {audioSnap.settings.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-black uppercase tracking-wide">
                    AUDIO COACH POR VOZ
                  </span>
                  {audioSnap.isSpeaking && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                      <Radio className="w-2.5 h-2.5 animate-ping" /> FALANDO
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {audioSnap.settings.enabled
                    ? `Ritmo a cada ${audioSnap.settings.paceIntervalSeconds}s • Marcos ${
                        audioSnap.settings.milestoneStepMeters === 1000
                          ? '1 km'
                          : `${audioSnap.settings.milestoneStepMeters}m`
                      } • Combate ${audioSnap.settings.announceCombatZones ? 'ON' : 'OFF'}`
                    : 'Voz silenciada — toque em Ligar para ativar avisos'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => tacticalAudio.updateSettings({ enabled: !audioSnap.settings.enabled })}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition cursor-pointer ${
                  audioSnap.settings.enabled
                    ? isLight
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                      : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                    : isLight
                    ? 'bg-slate-200 border-slate-300 text-slate-600'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {audioSnap.settings.enabled ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setShowAudioModal(true)}
                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
                }`}
                title="Configurar Web Speech API Audio Coach"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Spoken Caption / Last Cue */}
          {(audioSnap.currentAnnouncement || audioSnap.recentAnnouncements[0]) && (
            <div
              className={`p-2 rounded-xl border text-[11px] font-mono leading-snug flex items-start gap-2 ${
                (audioSnap.currentAnnouncement || audioSnap.recentAnnouncements[0]).category === 'combat_zone'
                  ? isLight
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                  : (audioSnap.currentAnnouncement || audioSnap.recentAnnouncements[0]).category === 'milestone'
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                  : isLight
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-slate-900/90 border-cyan-500/30 text-cyan-100'
              }`}
            >
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-black/15 dark:bg-white/10 shrink-0 mt-0.5">
                {(audioSnap.currentAnnouncement || audioSnap.recentAnnouncements[0]).category === 'combat_zone'
                  ? 'COMBATE'
                  : (audioSnap.currentAnnouncement || audioSnap.recentAnnouncements[0]).category === 'milestone'
                  ? 'MARCO'
                  : (audioSnap.currentAnnouncement || audioSnap.recentAnnouncements[0]).category === 'pace'
                  ? 'RITMO'
                  : 'COACH'}
              </span>
              <span className="flex-1">
                &ldquo;{(audioSnap.currentAnnouncement || audioSnap.recentAnnouncements[0]).text}&rdquo;
              </span>
            </div>
          )}

          {/* On-Demand Voice Prompt Buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => {
                if (!audioSnap.settings.enabled) tacticalAudio.updateSettings({ enabled: true });
                tacticalAudio.announcePaceUpdate({
                  currentPaceMinKm,
                  targetPaceMinKm: targetPace,
                  speedKmh: currentSpeedKmh,
                  totalDistanceMeters,
                  elapsedSeconds,
                  reason: 'manual',
                });
              }}
              className={`px-2 py-1.5 rounded-xl border text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-sky-50 border-slate-200 text-sky-700'
                  : 'bg-slate-900 hover:bg-cyan-950 border-slate-800 hover:border-cyan-500/40 text-cyan-300'
              }`}
              title="Anunciar ritmo atual por voz agora"
            >
              <Gauge className="w-3 h-3 shrink-0" />
              <span>Falar Ritmo</span>
            </button>

            <button
              onClick={() => {
                if (!audioSnap.settings.enabled) tacticalAudio.updateSettings({ enabled: true });
                tacticalAudio.announceDistanceStatus({
                  totalDistanceMeters,
                  targetDistanceMeters: targetMeters,
                  currentPaceMinKm,
                  elapsedSeconds,
                });
              }}
              className={`px-2 py-1.5 rounded-xl border text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-emerald-50 border-slate-200 text-emerald-700'
                  : 'bg-slate-900 hover:bg-emerald-950 border-slate-800 hover:border-emerald-500/40 text-emerald-300'
              }`}
              title="Anunciar distância e progresso da meta agora"
            >
              <Flag className="w-3 h-3 shrink-0" />
              <span>Distância</span>
            </button>

            <button
              onClick={() => {
                if (!audioSnap.settings.enabled) tacticalAudio.updateSettings({ enabled: true });
                const pos = userPosition || { lat: -23.561684, lng: -46.655981 };
                if (activeZone) {
                  tacticalAudio.announceCombatZoneAlert({
                    phase: 'entered',
                    zoneTitle: activeZone.title,
                    description: activeZone.description,
                    manual: true,
                  });
                } else if (combatZones.length > 0) {
                  const nextZone = combatZones.find((z) => !z.cleared) || combatZones[0];
                  const dist = calculateDistanceMeters(pos, nextZone.startPoint);
                  tacticalAudio.announceCombatZoneAlert({
                    phase: 'status',
                    zoneTitle: nextZone.title,
                    distanceToStartMeters: dist,
                    manual: true,
                  });
                } else {
                  tacticalAudio.speakTacticalCoach('Nenhuma Zona de Combate ativa no radar neste momento.', {
                    category: 'combat_zone',
                    priority: 'high',
                    interrupt: true,
                    ignoreCategoryFilter: true,
                  });
                }
              }}
              className={`px-2 py-1.5 rounded-xl border text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-rose-50 border-slate-200 text-rose-700'
                  : 'bg-slate-900 hover:bg-rose-950 border-slate-800 hover:border-rose-500/40 text-rose-300'
              }`}
              title="Anunciar status da Zona de Combate por voz agora"
            >
              <ShieldAlert className="w-3 h-3 shrink-0" />
              <span>Combate</span>
            </button>
          </div>
        </div>

        {/* Combat Zone Warning if active */}
        {activeZone && (
          <div className="relative z-10 w-full mt-3 p-3 bg-rose-500/10 border border-rose-500/50 rounded-2xl flex items-center gap-2 text-rose-600 dark:text-rose-300 text-xs font-semibold animate-bounce">
            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{activeZone.description}</span>
          </div>
        )}
      </div>

      {/* Gamified Status Rows: Ghost Proximity & Battery Charge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Ghost Runner Proximity */}
        <div className={`p-3 rounded-2xl border flex items-center justify-between ${
          isLight ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-purple-950/30 border-purple-500/30 text-purple-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">👻</span>
            <div>
              <span className="text-[10px] font-mono uppercase opacity-70">Corredor Fantasma</span>
              <p className="text-xs font-bold">
                {ghostDistanceMeters >= 0
                  ? `🚀 +${Math.round(ghostDistanceMeters)}m À FRENTE`
                  : `⚠️ -${Math.abs(Math.round(ghostDistanceMeters))}m ATRÁS`}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold">{ghostDistanceMeters >= 0 ? 'LIDERANDO' : 'DESAFIANDO'}</span>
        </div>

        {/* Battery Charge Meter */}
        <div className={`p-3 rounded-2xl border flex items-center justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <BatteryCharging className={`w-5 h-5 ${batteryPercent > 40 ? 'text-emerald-500' : 'text-rose-500 animate-pulse'}`} />
            <div>
              <span className={`text-[10px] font-mono uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Bateria Tática
              </span>
              <p className="text-xs font-bold">{batteryPercent}% Restante</p>
            </div>
          </div>
          <div className="w-20 bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-300 dark:border-slate-700">
            <div
              className={`h-full transition-all duration-300 ${
                batteryPercent > 50 ? 'bg-emerald-500' : batteryPercent > 20 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${batteryPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Live Pace Variation Bar Chart (Recharts) */}
      <LivePaceBarChart
        samples={paceHistory}
        targetPaceMinKm={targetPace}
        theme={theme}
      />

      {/* Km Splits List */}
      {splits.length > 0 && (
        <div className={`p-3 rounded-2xl border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <span className={`text-[10px] font-mono uppercase block mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            MARCAÇÕES DE KM (SPLITS)
          </span>
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            {splits.map((s) => (
              <span
                key={s.km}
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <span className="font-bold text-orange-500 dark:text-cyan-400">KM {s.km}:</span>
                <span>{s.pace} min/km</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Action Buttons (Finalizar, Pausar, Bloqueio) - Reference Image 2 Style */}
      <div className={`p-4 rounded-3xl border flex items-center justify-center gap-4 ${
        isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900/90 border-slate-800'
      }`}>
        {/* Finalize Button */}
        <button
          onClick={onFinishWorkout}
          disabled={isLocked}
          className={`flex flex-col items-center justify-center w-20 h-20 rounded-full font-mono text-[10px] font-bold uppercase transition cursor-pointer border ${
            isLocked ? 'opacity-40 cursor-not-allowed' : ''
          } ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
          }`}
        >
          <Square className="w-5 h-5 mb-1" />
          <span>FINALIZAR</span>
        </button>

        {/* Pause/Resume Button (Large Central Orange/Cyan Button) */}
        <button
          onClick={onTogglePause}
          disabled={isLocked}
          className={`flex flex-col items-center justify-center w-24 h-24 rounded-full font-mono text-xs font-black uppercase shadow-xl transition cursor-pointer border-2 ${
            isLocked ? 'opacity-40 cursor-not-allowed' : ''
          } ${
            isPaused
              ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/30'
              : 'bg-rose-500 hover:bg-rose-600 border-rose-400 text-white shadow-rose-500/30 animate-pulse'
          }`}
        >
          {isPaused ? <Play className="w-7 h-7 mb-0.5 fill-current" /> : <Pause className="w-7 h-7 mb-0.5 fill-current" />}
          <span>{isPaused ? 'RETOMAR' : 'PAUSAR'}</span>
        </button>

        {/* Lock Screen Button */}
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={`flex flex-col items-center justify-center w-20 h-20 rounded-full font-mono text-[10px] font-bold uppercase transition cursor-pointer border ${
            isLocked
              ? 'bg-amber-500/20 border-amber-500 text-amber-500'
              : isLight
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
          }`}
        >
          {isLocked ? <Lock className="w-5 h-5 mb-1 text-amber-500" /> : <Unlock className="w-5 h-5 mb-1" />}
          <span>{isLocked ? 'BLOQUEADO' : 'BLOQUEIO'}</span>
        </button>
      </div>

      {/* Simulator GPS & Auto-Pause Controls */}
      <div className={`p-3 rounded-2xl border space-y-2.5 text-xs font-mono ${
        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={onToggleSimulating}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                isSimulating
                  ? isLight ? 'bg-orange-500 text-white' : 'bg-cyan-500 text-slate-950'
                  : 'bg-emerald-500 text-slate-950'
              }`}
            >
              {isSimulating ? '🎮 SIMULAÇÃO GPS' : '📡 GPS REAL'}
            </button>

            {onToggleAutoPause && (
              <button
                onClick={onToggleAutoPause}
                className={`px-2.5 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1 ${
                  autoPauseEnabled
                    ? isLight
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                    : isLight
                    ? 'bg-white border-slate-300 text-slate-500'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title="Ativar ou desativar Auto-Pause automático ao ficar parado por mais de 30 segundos"
              >
                <Pause className="w-3 h-3" />
                <span>AUTO-PAUSE: {autoPauseEnabled ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>

          {isSimulating && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSteerSim('left')}
                className="p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                title="Virar à esquerda"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSteerSim('right')}
                className="p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                title="Virar à direita"
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              {onToggleSimStationary && (
                <button
                  onClick={onToggleSimStationary}
                  className={`px-2.5 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                    isSimStationary
                      ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-slate-950'
                      : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-400'
                  }`}
                  title="Simular velocidade zero (0 m/s) para testar o Auto-Pause de 30s"
                >
                  {isSimStationary ? '🏃 CORRER' : '🛑 PARAR'}
                </button>
              )}

              <button
                onClick={onTriggerBurst}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5" /> NITRO
              </button>
            </div>
          )}
        </div>

        {/* Live Geolocation Velocity Telemetry Footer */}
        <div className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[10px] ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-slate-800 text-slate-400'
        }`}>
          <span>
            Velocidade GPS:{' '}
            <strong className={isLight ? 'text-slate-900' : 'text-cyan-300'}>
              {liveGeoVelocityMs !== null ? `${liveGeoVelocityMs.toFixed(1)} m/s (${(liveGeoVelocityMs * 3.6).toFixed(1)} km/h)` : 'Aguardando sinal...'}
            </strong>
          </span>
          <span>
            Gatilho Auto-Pause: <strong>&gt; {autoPauseThresholdSeconds}s parado (&lt; 0.5 m/s)</strong>
          </span>
        </div>
      </div>
      {/* Sweat Lock Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in space-y-4">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-500 animate-pulse">
            <Lock className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-black font-mono uppercase text-amber-400">
              🔒 TELA BLOQUEADA CONTRA SUOR
            </h3>
            <p className="text-xs font-mono text-slate-300 max-w-xs">
              Toques acidentais por gotas de suor foram desativados.
            </p>
          </div>

          <button
            onClick={() => {
              triggerHaptic([200]);
              setIsLocked(false);
            }}
            className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-amber-500/30"
          >
            DESBLOQUEAR TELA
          </button>
        </div>
      )}

      {/* Weather & Hydration Detail Modal */}
      {showWeatherModal && liveWeather && (
        <WeatherModal
          weather={liveWeather}
          isLoading={isWeatherLoading}
          onRefresh={handleFetchWeather}
          onClose={() => setShowWeatherModal(false)}
          theme={theme}
        />
      )}

      {/* Web Speech API Audio Coach Settings Modal */}
      {showAudioModal && (
        <AudioCoachSettingsModal
          onClose={() => setShowAudioModal(false)}
          theme={theme}
          currentPaceMinKm={currentPaceMinKm}
          targetPaceMinKm={targetPace}
          currentSpeedKmh={currentSpeedKmh}
          totalDistanceMeters={totalDistanceMeters}
          elapsedSeconds={elapsedSeconds}
        />
      )}
    </div>
  );
};

