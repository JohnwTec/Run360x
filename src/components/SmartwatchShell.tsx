import React, { useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Compass,
  Flag,
  Flame,
  Monitor,
  Pause,
  Play,
  Smartphone,
  Trophy,
  Watch,
  Zap,
} from 'lucide-react';
import { TrainingLevel, UserProfile, WeatherData } from '../types';
import { formatPace, formatTime } from '../utils/geo';
import { DevicePreference } from '../utils/deviceMode';

interface SmartwatchShellProps {
  userProfile: UserProfile;
  selectedLevel: TrainingLevel;
  isWorkoutActive: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  totalDistanceMeters: number;
  currentPaceMinKm: number;
  currentSpeedKmh: number;
  ghostDistanceMeters: number;
  userHeading: number;
  xpGained: number;
  batteryPercent: number;
  weather: WeatherData | null;
  onStartWorkout: () => void;
  onTogglePause: () => void;
  onFinishWorkout: () => void;
  onExitWatchMode: (target: DevicePreference) => void;
  isNativeTinyScreen: boolean;
  theme?: 'dark' | 'light';
}

type WatchFaceId = 'run' | 'compass' | 'weather' | 'profile';

const WATCH_FACES: { id: WatchFaceId; label: string }[] = [
  { id: 'run', label: 'Corrida' },
  { id: 'compass', label: 'Radar' },
  { id: 'weather', label: 'Clima' },
  { id: 'profile', label: 'Status' },
];

export const SmartwatchShell: React.FC<SmartwatchShellProps> = ({
  userProfile,
  selectedLevel,
  isWorkoutActive,
  isPaused,
  elapsedSeconds,
  totalDistanceMeters,
  currentPaceMinKm,
  currentSpeedKmh,
  ghostDistanceMeters,
  userHeading,
  xpGained,
  batteryPercent,
  weather,
  onStartWorkout,
  onTogglePause,
  onFinishWorkout,
  onExitWatchMode,
  isNativeTinyScreen,
  theme = 'dark',
}) => {
  const [faceIndex, setFaceIndex] = useState<number>(0);
  const currentFace = WATCH_FACES[faceIndex].id;
  const isLight = theme === 'light';

  const distanceKm = totalDistanceMeters / 1000;
  const ghostDeltaMeters = Math.round(totalDistanceMeters - ghostDistanceMeters);
  const estimatedHr = isWorkoutActive
    ? Math.min(192, Math.max(115, Math.round(126 + currentSpeedKmh * 3.8)))
    : 64;

  const currentClock = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleNextFace = () => setFaceIndex((prev) => (prev + 1) % WATCH_FACES.length);
  const handlePrevFace = () =>
    setFaceIndex((prev) => (prev - 1 + WATCH_FACES.length) % WATCH_FACES.length);

  const watchScreenContent = (
    <div className="relative w-full h-full bg-black text-white flex flex-col justify-between p-4 select-none overflow-hidden">
      {/* Top Status Arc: Clock & Battery */}
      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-300 px-2">
        <span className="font-bold text-cyan-300">{currentClock}</span>
        <span className="uppercase tracking-wider text-[10px] text-slate-400">
          {WATCH_FACES[faceIndex].label}
        </span>
        <span className="font-bold text-emerald-400">{Math.round(batteryPercent)}%</span>
      </div>

      {/* Main Watch Face Body */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-1 my-1">
        {currentFace === 'run' && (
          <div className="w-full space-y-2.5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 block">
                {isWorkoutActive ? (isPaused ? 'PAUSADO' : 'EM CORRIDA') : selectedLevel.codename}
              </span>
              <div className="text-4xl font-black font-mono tabular-nums tracking-tight leading-none mt-1 text-white">
                {distanceKm.toFixed(2)}
                <span className="text-sm font-bold text-cyan-400 ml-1">km</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800 font-mono tabular-nums">
              <div>
                <span className="text-[9px] text-slate-400 block">PACE</span>
                <span className="text-sm font-black text-amber-300">
                  {formatPace(currentPaceMinKm)}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block">TEMPO</span>
                <span className="text-sm font-black text-white">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block">BPM</span>
                <span className="text-sm font-black text-rose-400">{estimatedHr}</span>
              </div>
            </div>

            {/* Tactile Watch Workout Controls */}
            <div className="flex items-center justify-center gap-2 pt-1">
              {!isWorkoutActive ? (
                <button
                  type="button"
                  onClick={onStartWorkout}
                  className="min-h-[46px] flex-1 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Correr</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onTogglePause}
                    className="min-h-[46px] flex-1 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition"
                  >
                    {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                    <span>{isPaused ? 'Retomar' : 'Pausar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onFinishWorkout}
                    aria-label="Finalizar corrida"
                    className="min-h-[46px] min-w-[46px] rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center cursor-pointer active:scale-95 transition"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {currentFace === 'compass' && (
          <div className="w-full space-y-2.5 flex flex-col items-center">
            <div className="relative w-28 h-28 rounded-full border-2 border-cyan-500/50 bg-slate-950 flex items-center justify-center">
              <span className="absolute top-1 text-[9px] font-mono font-bold text-rose-400">N</span>
              <span className="absolute bottom-1 text-[9px] font-mono text-slate-500">S</span>
              <span className="absolute left-1.5 text-[9px] font-mono text-slate-500">O</span>
              <span className="absolute right-1.5 text-[9px] font-mono text-slate-500">L</span>
              <div className="flex flex-col items-center">
                <Compass className="w-7 h-7 text-cyan-300" />
                <span className="text-xs font-mono font-black tabular-nums mt-0.5">
                  {Math.round(userHeading)}°
                </span>
              </div>
            </div>
            <div className="text-xs font-mono tabular-nums">
              <span className="text-slate-400 block text-[10px]">CORREDOR FANTASMA</span>
              <span
                className={`font-black text-sm ${
                  ghostDeltaMeters >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {ghostDeltaMeters >= 0 ? `+${ghostDeltaMeters}m à frente` : `${ghostDeltaMeters}m atrás`}
              </span>
            </div>
          </div>
        )}

        {currentFace === 'weather' && (
          <div className="w-full space-y-2">
            <div className="text-3xl">{weather?.condition.icon || '☀️'}</div>
            <div className="text-3xl font-black font-mono tabular-nums">
              {weather ? `${weather.temperatureC}°C` : '24°C'}
            </div>
            <div className="text-xs font-medium text-cyan-300 truncate px-2">
              {weather?.condition.label || 'Céu limpo'}
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1.5 pt-1">
              <CloudRain className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {weather
                  ? `Hidratação: ${weather.hydration.volumePerInterval} / ${weather.hydration.intervalMinutes}m`
                  : 'Hidratação: 200ml / 20m'}
              </span>
            </div>
          </div>
        )}

        {currentFace === 'profile' && (
          <div className="w-full space-y-2.5 font-mono tabular-nums">
            <div className="text-xs font-bold text-cyan-300 truncate px-2">
              {userProfile.name || 'Atleta RUN360X'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-400 block">NÍVEL</span>
                <span className="text-lg font-black text-amber-400 flex items-center justify-center gap-1">
                  <Trophy className="w-3.5 h-3.5" /> {userProfile.level}
                </span>
              </div>
              <div className="p-2 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[9px] text-slate-400 block">TOTAL KM</span>
                <span className="text-lg font-black text-cyan-300">
                  {userProfile.totalDistanceKm.toFixed(1)}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>{userProfile.xp + xpGained} XP acumulados</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Face Carousel Navigation */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={handlePrevFace}
          aria-label="Tela anterior do relógio"
          className="min-h-[38px] min-w-[38px] rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-slate-300" />
        </button>

        <div className="flex items-center gap-1.5">
          {WATCH_FACES.map((wf, idx) => (
            <button
              key={wf.id}
              type="button"
              onClick={() => setFaceIndex(idx)}
              aria-label={`Ir para tela ${wf.label}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === faceIndex ? 'w-5 bg-cyan-400' : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleNextFace}
          aria-label="Próxima tela do relógio"
          className="min-h-[38px] min-w-[38px] rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
      </div>
    </div>
  );

  // On an actual tiny smartwatch screen (<= 320px), render full-bleed
  if (isNativeTinyScreen) {
    return <div className="w-screen h-screen bg-black">{watchScreenContent}</div>;
  }

  // On desktop/tablet/phone previewing Smartwatch aesthetic, display an interactive AMOLED wearable casing + quick switch controls
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center gap-6">
      <div className="text-center space-y-1.5 max-w-lg">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-400">
          <Watch className="w-4 h-4 text-cyan-400" />
          <span>Modo Smartwatch AMOLED</span>
          <span aria-hidden="true">·</span>
          <span>Alta legibilidade em movimento</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight">Interface Tática de Pulso</h2>
        <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          Navegue entre as 4 telas rápidas de pulso — Corrida ao vivo, Radar/Fantasma, Clima e Status — com comandos táteis amplos sincronizados ao seu treino.
        </p>
      </div>

      {/* Physical Wearable Casing */}
      <div className="relative flex items-center justify-center">
        {/* Top & Bottom Sport Strap Hint */}
        <div className="absolute -top-8 w-36 h-10 rounded-t-3xl bg-gradient-to-b from-slate-800 to-slate-900 border-x border-t border-slate-700/70" />
        <div className="absolute -bottom-8 w-36 h-10 rounded-b-3xl bg-gradient-to-t from-slate-800 to-slate-900 border-x border-b border-slate-700/70" />

        {/* Metallic Titanium Bezel + Digital Crown */}
        <div className="relative z-10 w-[310px] h-[368px] rounded-[64px] p-3 bg-gradient-to-br from-slate-600 via-slate-800 to-slate-950 shadow-[0_24px_64px_rgba(0,0,0,0.65)] border border-slate-500/40">
          {/* Side Digital Crown */}
          <button
            type="button"
            onClick={handleNextFace}
            title="Girar / Pressionar Coroa Digital para alternar tela"
            aria-label="Coroa digital: alternar tela"
            className="absolute -right-3 top-24 w-3 h-14 rounded-r-lg bg-gradient-to-b from-orange-400 via-orange-500 to-orange-600 border border-orange-300/60 shadow-md cursor-pointer hover:brightness-110 transition"
          />
          <button
            type="button"
            onClick={isWorkoutActive ? onTogglePause : onStartWorkout}
            title="Botão de ação rápida: Iniciar ou pausar treino"
            aria-label="Botão lateral de ação"
            className="absolute -right-2.5 top-44 w-2.5 h-10 rounded-r-md bg-slate-600 border border-slate-400/50 cursor-pointer hover:bg-slate-500 transition"
          />

          <div className="w-full h-full rounded-[52px] overflow-hidden border border-slate-800 bg-black">
            {watchScreenContent}
          </div>
        </div>
      </div>

      {/* Quick Return to Expanded or Smartphone View */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
        <button
          type="button"
          onClick={() => onExitWatchMode('smartphone')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition cursor-pointer ${
            isLight
              ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Ir para Modo Smartphone</span>
        </button>

        <button
          type="button"
          onClick={() => onExitWatchMode('desktop')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
            isLight
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>Abrir Painel Expandido (PC / Tablet)</span>
        </button>

        <button
          type="button"
          onClick={() => onExitWatchMode('auto')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition cursor-pointer ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Voltar para Automático</span>
        </button>
      </div>
    </div>
  );
};

export default SmartwatchShell;
