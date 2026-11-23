import React, { useEffect, useRef, useState } from 'react';
import { Heart, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import {
  HeartRateTelemetry,
  HeartRateZoneId,
  formatZoneSeconds,
} from '../utils/heartRateZones';
import { formatPace } from '../utils/geo';

interface HeartRateZonesPanelProps {
  telemetry: HeartRateTelemetry;
  currentPaceMinKm: number;
  isActive: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  onUpdateAthleteAge?: (nextAge: number) => void;
  theme?: 'dark' | 'light';
}

export const HeartRateZonesPanel: React.FC<HeartRateZonesPanelProps> = ({
  telemetry,
  currentPaceMinKm,
  isActive,
  isPaused,
  elapsedSeconds,
  onUpdateAthleteAge,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [expanded, setExpanded] = useState<boolean>(true);
  const [zoneSeconds, setZoneSeconds] = useState<Record<HeartRateZoneId, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });

  const lastTrackedSecRef = useRef<number>(-1);

  // Accumulate live time spent in each heart rate zone during the active session
  useEffect(() => {
    if (!isActive || elapsedSeconds === 0) {
      setZoneSeconds({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      lastTrackedSecRef.current = -1;
      return;
    }

    if (isPaused || elapsedSeconds === lastTrackedSecRef.current) return;

    const delta =
      lastTrackedSecRef.current >= 0
        ? Math.min(5, Math.max(1, elapsedSeconds - lastTrackedSecRef.current))
        : 1;
    lastTrackedSecRef.current = elapsedSeconds;

    const zoneId = telemetry.activeZone.id;
    setZoneSeconds((prev) => ({
      ...prev,
      [zoneId]: prev[zoneId] + delta,
    }));
  }, [isActive, isPaused, elapsedSeconds, telemetry.activeZone.id]);

  const totalZoneSeconds =
    zoneSeconds[1] + zoneSeconds[2] + zoneSeconds[3] + zoneSeconds[4] + zoneSeconds[5];

  // Position marker along the 50%..100% FC Máx gauge bar
  const gaugeMarkerPct = Math.min(98, Math.max(2, ((telemetry.pctMaxHr - 50) / 50) * 100));

  const { activeZone } = telemetry;
  const activeTextClass = isLight ? activeZone.textLightClass : activeZone.textDarkClass;

  return (
    <div
      className={`w-full rounded-2xl border p-4 text-left space-y-3.5 transition-colors ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
          : 'bg-slate-900/95 border-slate-800 text-slate-100'
      }`}
    >
      {/* Panel Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              isLight
                ? `${activeZone.bgLightClass} ${activeZone.borderLightClass} ${activeZone.textLightClass}`
                : `${activeZone.bgDarkClass} ${activeZone.borderDarkClass} ${activeZone.textDarkClass}`
            }`}
          >
            <Heart className="w-4 h-4 fill-current" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider">
                Zonas de Frequência Cardíaca
              </span>
              <span className={`text-[11px] font-mono font-bold uppercase ${activeTextClass}`}>
                {activeZone.code} · {activeZone.name}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              Idade {telemetry.athleteAge} anos · FC Máx {telemetry.maxHr} bpm · Pace {formatPace(currentPaceMinKm)}/km
            </p>
          </div>
        </div>

        {/* Live BPM + Collapse Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right font-mono tabular-nums">
            <div className={`text-xl font-black leading-none ${activeTextClass}`}>
              {telemetry.currentBpm}
              <span className="text-[10px] font-semibold text-slate-400 ml-1">bpm</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
              {telemetry.pctMaxHr}% FC Máx
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
            }`}
            title={expanded ? 'Recolher detalhes das zonas' : 'Expandir detalhes das zonas'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Live 5-Zone Segmented Spectrum Bar with Dynamic Needle */}
      <div className="space-y-1.5">
        <div className="relative pt-2.5 pb-1">
          {/* Dynamic BPM Marker */}
          <div
            className="absolute top-0 -translate-x-1/2 transition-all duration-500 ease-out z-10 flex flex-col items-center pointer-events-none"
            style={{ left: `${gaugeMarkerPct}%` }}
          >
            <div
              className={`w-2.5 h-2.5 rotate-45 border-2 ${
                isLight ? 'bg-slate-900 border-white' : 'bg-white border-slate-950'
              }`}
            />
          </div>

          <div className="grid grid-cols-5 gap-1 h-2.5 rounded-full overflow-hidden">
            {telemetry.zones.map((z) => {
              const isCurrent = z.id === activeZone.id;
              return (
                <div
                  key={z.id}
                  className={`h-full rounded-sm transition-opacity duration-300 ${z.barClass} ${
                    isCurrent ? 'opacity-100' : 'opacity-35'
                  }`}
                  title={`${z.code} ${z.name}: ${z.minBpm}-${z.maxBpm} bpm`}
                />
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-5 text-center text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
          {telemetry.zones.map((z) => (
            <span
              key={z.id}
              className={
                z.id === activeZone.id
                  ? `font-black ${isLight ? z.textLightClass : z.textDarkClass}`
                  : ''
              }
            >
              {z.code}
            </span>
          ))}
        </div>
      </div>

      {/* Physiological Coaching Cue */}
      <p className={`text-xs leading-snug ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
        {telemetry.cue}
      </p>

      {/* Expanded 5-Zone Breakdown & Time-in-Zone Table */}
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-1.5">
            {telemetry.zones.map((z) => {
              const isCurrent = z.id === activeZone.id;
              const secs = zoneSeconds[z.id];
              const pctTime =
                totalZoneSeconds > 0 ? Math.round((secs / totalZoneSeconds) * 100) : 0;

              return (
                <div
                  key={z.id}
                  className={`px-2.5 py-2 rounded-xl border transition-colors ${
                    isCurrent
                      ? isLight
                        ? `${z.bgLightClass} ${z.borderLightClass}`
                        : `${z.bgDarkClass} ${z.borderDarkClass}`
                      : isLight
                        ? 'bg-slate-50/70 border-slate-200/70'
                        : 'bg-slate-950/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${z.barClass}`} />
                      <span
                        className={`font-black shrink-0 ${
                          isCurrent
                            ? isLight
                              ? z.textLightClass
                              : z.textDarkClass
                            : isLight
                              ? 'text-slate-800'
                              : 'text-slate-200'
                        }`}
                      >
                        {z.code}
                      </span>
                      <span className="font-semibold truncate text-[11px] font-sans">
                        {z.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 tabular-nums text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">
                        {z.minBpm}–{z.maxBpm} bpm
                      </span>
                      <span className="font-bold min-w-[42px] text-right">
                        {formatZoneSeconds(secs)}
                      </span>
                    </div>
                  </div>

                  {/* Time-in-Zone Fill Bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className={`flex-1 h-1 rounded-full overflow-hidden ${
                        isLight ? 'bg-slate-200/80' : 'bg-slate-800'
                      }`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${z.barClass}`}
                        style={{ width: `${Math.max(isCurrent ? 6 : 0, pctTime)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 min-w-[30px] text-right">
                      {pctTime}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inline Athlete Age Calibration Footer */}
          {onUpdateAthleteAge && (
            <div className="flex items-center justify-between gap-2 pt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>Calibrar idade do atleta (Tanaka 208 − 0,7×idade)</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateAthleteAge(Math.max(14, telemetry.athleteAge - 1))}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer transition ${
                    isLight
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                  aria-label="Diminuir idade do atleta"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-bold tabular-nums text-slate-800 dark:text-slate-200 min-w-[52px] text-center">
                  {telemetry.athleteAge} anos
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateAthleteAge(Math.min(90, telemetry.athleteAge + 1))}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer transition ${
                    isLight
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                  aria-label="Aumentar idade do atleta"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
