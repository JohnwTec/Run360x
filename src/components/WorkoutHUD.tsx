import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Zap, BatteryCharging, Flame, ArrowLeft, ArrowRight, Heart, Lock, Unlock, Calendar, Clock, Activity, ShieldAlert } from 'lucide-react';
import { TrainingLevel, XPOrb, CombatZone } from '../types';
import { formatPace, formatTime } from '../utils/geo';

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

  onTogglePause: () => void;
  onFinishWorkout: () => void;
  onToggleSimulating: () => void;
  onChangeSimSpeed: (mult: number) => void;
  onSteerSim: (direction: 'left' | 'right' | 'straight') => void;
  onTriggerBurst: () => void;
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
  onTogglePause,
  onFinishWorkout,
  onToggleSimulating,
  onChangeSimSpeed,
  onSteerSim,
  onTriggerBurst,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState('');

  const isLight = theme === 'light';

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

  // Calculated Heart Rate & Zone based on current speed
  const baseHeartRate = Math.min(185, Math.max(110, Math.round(115 + currentSpeedKmh * 4.2)));
  let heartZone = 'ZONA 2 - AERÓBICA';
  let heartZoneColor = isLight ? 'text-emerald-600' : 'text-emerald-400';
  if (baseHeartRate > 165) {
    heartZone = 'ZONA 4 - ALTA';
    heartZoneColor = isLight ? 'text-orange-600' : 'text-orange-400';
  } else if (baseHeartRate > 150) {
    heartZone = 'ZONA 3 - LIMIAR';
    heartZoneColor = isLight ? 'text-sky-600' : 'text-cyan-400';
  } else if (baseHeartRate > 175) {
    heartZone = 'ZONA 5 - MÁXIMA';
    heartZoneColor = isLight ? 'text-rose-600' : 'text-rose-400';
  }

  // Calculated Cadence (Passos por minuto - PPM)
  const currentCadencePpm = Math.min(195, Math.max(140, Math.round(158 + currentSpeedKmh * 1.8)));
  const isCadenceIdeal = currentCadencePpm >= 170 && currentCadencePpm <= 182;

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

  // Simulated Km Splits list
  const currentKm = Math.floor(totalDistanceMeters / 1000);
  const splits = Array.from({ length: Math.max(1, currentKm) }, (_, idx) => {
    const kmNum = idx + 1;
    const paceVal = (4.8 + (idx % 3) * 0.12).toFixed(2);
    return { km: kmNum, pace: paceVal };
  });

  return (
    <div className="flex flex-col gap-3 font-sans select-none">
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
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="font-bold">{isPaused ? 'PAUSADO' : 'EM ANDAMENTO'}</span>
        </div>
      </div>

      {/* Main Circular Gauge Card (Life Run / Strava / Runna Style) */}
      <div
        className={`relative overflow-hidden p-6 rounded-3xl border flex flex-col items-center justify-center text-center shadow-lg transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-slate-900/95 border-cyan-500/30 text-white shadow-[0_0_30px_rgba(6,182,212,0.1)]'
        }`}
      >
        {/* Phase Badge */}
        <div className="mb-4 flex items-center gap-2">
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
        </div>

        {/* Circular Progress Ring with Timer */}
        <div className="relative w-52 h-52 flex items-center justify-center my-2">
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
              className={`transition-all duration-500 ${isLight ? 'stroke-orange-500' : 'stroke-cyan-400'}`}
              strokeWidth="10"
              strokeDasharray="440"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Inner Circle Timer Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={`text-[10px] font-mono uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              TEMPO TOTAL
            </span>
            <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tight my-0.5 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {formatTime(elapsedSeconds)}
            </span>
            <div className="flex items-center gap-1 mt-1 text-xs font-mono font-bold text-amber-500">
              <Zap className="w-3.5 h-3.5 fill-amber-500" />
              <span>+{xpGained} XP</span>
            </div>
          </div>
        </div>

        {/* Primary Metrics Row (Distância & Ritmo Médio) */}
        <div className="w-full grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
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
        <div className={`w-full mt-4 p-3 rounded-2xl grid grid-cols-2 gap-3 border ${
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
              <p className="text-sm font-black font-mono">{currentCadencePpm} <span className="text-[10px] font-normal text-slate-400">passos/min</span></p>
              <span className={`text-[9px] font-mono font-bold uppercase ${isCadenceIdeal ? 'text-emerald-500' : 'text-amber-500'}`}>
                {isCadenceIdeal ? '🎯 CADÊNCIA IDEAL (170-180)' : '⚠️ PASSADA LONGA (AUMENTAR PPM)'}
              </span>
            </div>
          </div>
        </div>

        {/* Weather & Device Telemetry Banner */}
        <div className={`w-full mt-3 p-2.5 rounded-2xl border flex flex-wrap items-center justify-between text-[11px] font-mono gap-2 ${
          isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-950/90 border-cyan-500/30 text-cyan-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-base">🌡️</span>
            <span>28°C Clima Quente • Alerta de Desidratação</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
              <span>⌚ Garmin / Apple Watch (148 BPM)</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hidden sm:inline">
              <span>🎧 AirPods Audio Coach ON</span>
            </span>
          </div>
        </div>

        {/* Combat Zone Warning if active */}
        {activeZone && (
          <div className="w-full mt-3 p-3 bg-rose-500/10 border border-rose-500/50 rounded-2xl flex items-center gap-2 text-rose-600 dark:text-rose-300 text-xs font-semibold animate-bounce">
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

      {/* Simulator GPS Controls */}
      <div className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs font-mono ${
        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-slate-800'
      }`}>
        <button
          onClick={onToggleSimulating}
          className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
            isSimulating
              ? isLight ? 'bg-orange-500 text-white' : 'bg-cyan-500 text-slate-950'
              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {isSimulating ? '🎮 SIMULAÇÃO GPS' : '📡 GPS REAL'}
        </button>

        {isSimulating && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSteerSim('left')}
              className="p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSteerSim('right')}
              className="p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onTriggerBurst}
              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" /> NITRO
            </button>
          </div>
        )}
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
    </div>
  );
};

