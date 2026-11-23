import React from 'react';
import {
  CommunityHudAnchor,
  CommunityOverlayStyle,
  CommunityPostMetrics,
} from '../types';
import { formatPace } from '../utils/geo';
import { parseRouteLinePoints } from '../utils/communityMetrics';

interface FloatingTelemetryOverlayProps {
  metrics: CommunityPostMetrics;
  vibrantText: string;
  overlayStyle: CommunityOverlayStyle;
  hudAnchor: CommunityHudAnchor;
  authorName?: string;
  compact?: boolean;
}

const STYLE_CONFIG: Record<
  CommunityOverlayStyle,
  {
    surface: string;
    border: string;
    accentText: string;
    secondaryText: string;
    vibrantTextClass: string;
    strokeHex: string;
    glowClass: string;
  }
> = {
  neon: {
    surface: 'bg-slate-950/70 backdrop-blur-md',
    border: 'border-cyan-400/55',
    accentText: 'text-cyan-300',
    secondaryText: 'text-sky-300',
    vibrantTextClass: 'text-white drop-shadow-[0_2px_10px_rgba(0,240,255,0.65)]',
    strokeHex: '#22d3ee',
    glowClass: 'drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]',
  },
  solar: {
    surface: 'bg-stone-950/70 backdrop-blur-md',
    border: 'border-amber-400/60',
    accentText: 'text-amber-300',
    secondaryText: 'text-orange-300',
    vibrantTextClass: 'text-amber-100 drop-shadow-[0_2px_10px_rgba(251,146,60,0.75)]',
    strokeHex: '#fb923c',
    glowClass: 'drop-shadow-[0_0_8px_rgba(251,146,60,0.9)]',
  },
  emerald: {
    surface: 'bg-emerald-950/70 backdrop-blur-md',
    border: 'border-emerald-400/55',
    accentText: 'text-emerald-300',
    secondaryText: 'text-teal-200',
    vibrantTextClass: 'text-emerald-50 drop-shadow-[0_2px_10px_rgba(52,211,153,0.7)]',
    strokeHex: '#34d399',
    glowClass: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.85)]',
  },
  crystal: {
    surface: 'bg-slate-900/50 backdrop-blur-lg',
    border: 'border-white/45',
    accentText: 'text-white',
    secondaryText: 'text-slate-200',
    vibrantTextClass: 'text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]',
    strokeHex: '#ffffff',
    glowClass: 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]',
  },
};

export const FloatingTelemetryOverlay: React.FC<FloatingTelemetryOverlayProps> = ({
  metrics,
  vibrantText,
  overlayStyle,
  hudAnchor,
  authorName,
  compact = false,
}) => {
  const palette = STYLE_CONFIG[overlayStyle] || STYLE_CONFIG.neon;
  const routePoints = parseRouteLinePoints(metrics.routeLine);
  const svgPolylinePoints = routePoints
    .map((pt) => `${(pt.x * 100).toFixed(1)},${(pt.y * 100).toFixed(1)}`)
    .join(' ');
  const startPt = routePoints[0];
  const endPt = routePoints[routePoints.length - 1];

  const anchorPositionClass =
    hudAnchor === 'top'
      ? 'justify-start pt-10 sm:pt-12'
      : hudAnchor === 'center'
      ? 'justify-center'
      : 'justify-end pb-3 sm:pb-4';

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
      {/* Subtle Top Scrim & Brand Stamp */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/65 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

      <div className="relative z-10 flex items-center justify-between gap-2 text-white">
        <div className="min-w-0">
          <div className={`text-xs font-black tracking-wider ${palette.accentText}`}>RUN360X</div>
          {authorName && (
            <div className="text-[10px] font-mono text-white/80 truncate">
              {authorName} · {metrics.achievementTitle}
            </div>
          )}
        </div>
        <div className="text-[10px] font-mono font-bold text-white/85 tabular-nums shrink-0">
          +{metrics.xpGained} XP
        </div>
      </div>

      {/* Floating Telemetry HUD + Mini Route Map + Vibrant Short Text */}
      <div className={`relative z-10 flex-1 flex flex-col ${anchorPositionClass}`}>
        <div
          className={`w-full rounded-2xl border ${palette.surface} ${palette.border} ${
            compact ? 'p-2.5 sm:p-3 space-y-2' : 'p-3 sm:p-4 space-y-2.5'
          } shadow-2xl transition-all duration-200`}
        >
          {/* Short Vibrant Text */}
          {vibrantText.trim().length > 0 && (
            <p
              className={`font-black leading-tight tracking-tight text-balance ${
                compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
              } ${palette.vibrantTextClass}`}
            >
              {vibrantText.trim()}
            </p>
          )}

          {/* Metrics Grid + Mini Route Line Map */}
          <div className="grid grid-cols-12 gap-2.5 items-center">
            {/* 4 Key Exercise Metrics (8 cols) */}
            <div className="col-span-8 grid grid-cols-2 gap-x-3 gap-y-2 font-mono tabular-nums">
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-white/70">
                  Quilometragem
                </span>
                <span
                  className={`font-black leading-none ${
                    compact ? 'text-sm sm:text-base' : 'text-base sm:text-xl'
                  } ${palette.accentText}`}
                >
                  {metrics.distanceKm.toFixed(2)}{' '}
                  <span className="text-[10px] font-bold text-white/80">km</span>
                </span>
              </div>

              <div>
                <span className="block text-[9px] uppercase tracking-wider text-white/70">
                  Pace / km
                </span>
                <span
                  className={`font-black leading-none text-white ${
                    compact ? 'text-sm sm:text-base' : 'text-base sm:text-xl'
                  }`}
                >
                  {formatPace(metrics.avgPaceMinKm)}
                </span>
              </div>

              <div>
                <span className="block text-[9px] uppercase tracking-wider text-white/70">
                  Km mais rápido
                </span>
                <span
                  className={`font-black leading-none ${
                    compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                  } ${palette.secondaryText}`}
                >
                  {formatPace(metrics.fastestKmPaceMinKm)}{' '}
                  <span className="text-[9px] text-white/70">/km</span>
                </span>
              </div>

              <div>
                <span className="block text-[9px] uppercase tracking-wider text-white/70">
                  Vel. Média
                </span>
                <span
                  className={`font-black leading-none text-white ${
                    compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                  }`}
                >
                  {metrics.avgSpeedKmh.toFixed(1)}{' '}
                  <span className="text-[9px] text-white/70">km/h</span>
                </span>
              </div>
            </div>

            {/* Mini Route Map Line (4 cols) */}
            <div className="col-span-4 flex flex-col items-center justify-center rounded-xl bg-black/35 border border-white/15 p-1.5">
              <svg
                viewBox="0 0 100 100"
                className={`w-full ${compact ? 'h-16 sm:h-20' : 'h-20 sm:h-24'} overflow-visible`}
                aria-label="Mini mapa do percurso percorrido"
              >
                <polyline
                  fill="none"
                  stroke={palette.strokeHex}
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={svgPolylinePoints}
                  className={palette.glowClass}
                />
                <circle
                  cx={startPt.x * 100}
                  cy={startPt.y * 100}
                  r="4.5"
                  fill="#34d399"
                  stroke="#020617"
                  strokeWidth="1.5"
                />
                <circle
                  cx={endPt.x * 100}
                  cy={endPt.y * 100}
                  r="5"
                  fill="#fb7185"
                  stroke="#020617"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="text-[8px] font-mono uppercase tracking-widest text-white/70 mt-0.5">
                Trajeto GPS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingTelemetryOverlay;
