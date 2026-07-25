import React, { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { LatLng, PathPoint, XPOrb, CombatZone } from '../types';
import { DARK_NEON_MAP_STYLE, LIGHT_TACTICAL_MAP_STYLE } from '../constants/mapStyles';
import { calculateDistanceMeters } from '../utils/geo';

interface TacticalMapProps {
  apiKey: string;
  hasValidKey: boolean;
  userPosition: LatLng;
  userHeading: number;
  path: PathPoint[];
  orbs: XPOrb[];
  combatZones: CombatZone[];
  ghostPosition: LatLng;
  ghostDistanceMeters: number;
  currentPhase: 'warmup' | 'jog' | 'sprint' | 'cooldown';
  isRecordSparks: boolean;
  fogClearedGrid: Set<string>; // 'x_y' keys for fog of war
  theme?: 'dark' | 'light';
}

// Helper component inside APIProvider to manipulate map instance
function MapOverlayController({
  userPosition,
}: {
  userPosition: LatLng;
  path: PathPoint[];
  orbs: XPOrb[];
  ghostPosition: LatLng;
  combatZones: CombatZone[];
}) {
  const map = useMap();

  useEffect(() => {
    if (map) {
      map.panTo(userPosition);
    }
  }, [map, userPosition]);

  return null;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  apiKey,
  hasValidKey,
  userPosition,
  userHeading,
  path,
  orbs,
  combatZones,
  ghostPosition,
  ghostDistanceMeters,
  currentPhase,
  isRecordSparks,
  fogClearedGrid,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useGoogleMaps, setUseGoogleMaps] = useState(hasValidKey);

  useEffect(() => {
    setUseGoogleMaps(hasValidKey);
  }, [hasValidKey]);

  const isLight = theme === 'light';

  // Particle sparks buffer for high speed
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([]);

  // Render tactical Canvas Grid overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = (canvas.width = canvas.parentElement?.clientWidth || 800);
      const height = (canvas.height = canvas.parentElement?.clientHeight || 600);

      // Background color depending on theme
      ctx.fillStyle = isLight ? '#f8fafc' : '#070b12';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Coordinate scaling factor (pixels per meter)
      const scale = 2.2; 

      // Function to map LatLng to canvas relative to user center
      const toCanvas = (pos: LatLng) => {
        const dLat = (pos.lat - userPosition.lat) * 111000;
        const dLng = (pos.lng - userPosition.lng) * 111000 * Math.cos((userPosition.lat * Math.PI) / 180);
        return {
          x: centerX + dLng * scale,
          y: centerY - dLat * scale,
        };
      };

      // 1. Draw Grid Lines ("O Grid")
      ctx.strokeStyle = isLight ? 'rgba(203, 213, 225, 0.8)' : 'rgba(15, 32, 53, 0.6)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      const offsetX = (centerX % gridSize);
      const offsetY = (centerY % gridSize);

      ctx.beginPath();
      for (let x = offsetX; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = offsetY; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Draw subtle city streets / grid blocks
      ctx.strokeStyle = isLight ? 'rgba(226, 232, 240, 0.9)' : 'rgba(30, 58, 95, 0.35)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(0, centerY + 80);
      ctx.lineTo(width, centerY + 80);
      ctx.moveTo(centerX - 120, 0);
      ctx.lineTo(centerX - 120, height);
      ctx.moveTo(centerX + 180, 0);
      ctx.lineTo(centerX + 180, height);
      ctx.stroke();

      // 2. Draw Fog of War
      const fogTileSize = 80;
      for (let gx = -6; gx <= 6; gx++) {
        for (let gy = -6; gy <= 6; gy++) {
          const tileKey = `${Math.floor(userPosition.lat * 1000) + gx}_${Math.floor(userPosition.lng * 1000) + gy}`;
          const tileX = centerX + gx * fogTileSize - fogTileSize / 2;
          const tileY = centerY + gy * fogTileSize - fogTileSize / 2;

          if (!fogClearedGrid.has(tileKey)) {
            ctx.fillStyle = isLight ? 'rgba(226, 232, 240, 0.85)' : 'rgba(5, 10, 20, 0.82)';
            ctx.fillRect(tileX, tileY, fogTileSize, fogTileSize);
            ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 240, 255, 0.05)';
            ctx.strokeRect(tileX, tileY, fogTileSize, fogTileSize);
          }
        }
      }

      // 3. Draw Combat Zones
      combatZones.forEach((cz) => {
        const start = toCanvas(cz.startPoint);
        const end = toCanvas(cz.endPoint);

        ctx.strokeStyle = cz.active ? '#ef4444' : 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        ctx.fillStyle = isLight ? '#dc2626' : '#ff0055';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`⚡ ${cz.title}`, (start.x + end.x) / 2 - 60, (start.y + end.y) / 2 - 12);
      });

      // 4. Draw Route Trace
      if (path.length > 1) {
        for (let i = 1; i < path.length; i++) {
          const p1 = toCanvas(path[i - 1]);
          const p2 = toCanvas(path[i]);
          const pt = path[i];

          let neonColor = isLight ? '#10b981' : '#00ff66'; // Emerald in Light
          if (pt.phase === 'sprint' || pt.speedKmh > 11) {
            neonColor = isLight ? '#ea580c' : '#ff3300'; // Vibrant Orange/Red
          } else if (pt.phase === 'warmup' || pt.phase === 'cooldown') {
            neonColor = isLight ? '#0284c7' : '#00f0ff'; // Sky Blue
          }

          ctx.shadowColor = neonColor;
          ctx.shadowBlur = isLight ? 4 : 12;
          ctx.strokeStyle = neonColor;
          ctx.lineWidth = pt.phase === 'sprint' ? 6 : 4;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();

          ctx.shadowBlur = 0;
        }
      }

      // 5. Digital Particle Sparks
      if (isRecordSparks) {
        for (let i = 0; i < 3; i++) {
          particlesRef.current.push({
            x: centerX,
            y: centerY,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1.0,
            color: Math.random() > 0.5 ? '#f59e0b' : (isLight ? '#0284c7' : '#00f0ff'),
          });
        }
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.random() * 3 + 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }

      // 6. Draw XP Orbs
      orbs.forEach((orb) => {
        if (orb.collected) return;
        const pos = toCanvas(orb.position);

        const pulse = (Date.now() / 300) % (2 * Math.PI);
        const radius = 12 + Math.sin(pulse) * 3;

        const orbColor = isLight ? '#0284c7' : '#00f0ff';

        ctx.shadowColor = orbColor;
        ctx.shadowBlur = isLight ? 6 : 15;
        ctx.strokeStyle = orbColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = orbColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`+${orb.xpValue} XP`, pos.x - 18, pos.y - 18);
      });

      // 7. Draw Ghost Runner
      const ghostCanvasPos = toCanvas(ghostPosition);

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = isLight ? 'rgba(147, 51, 234, 0.7)' : 'rgba(168, 85, 247, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(ghostCanvasPos.x, ghostCanvasPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.shadowColor = '#9333ea';
      ctx.shadowBlur = isLight ? 6 : 15;
      ctx.fillStyle = isLight ? '#9333ea' : 'rgba(168, 85, 247, 0.85)';
      ctx.beginPath();
      ctx.arc(ghostCanvasPos.x, ghostCanvasPos.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isLight ? '#581c87' : '#e9d5ff';
      ctx.font = 'bold 10px sans-serif';
      const ghostLabel = ghostDistanceMeters >= 0 
        ? `FANTASMA: -${Math.abs(Math.round(ghostDistanceMeters))}m` 
        : `FANTASMA: +${Math.abs(Math.round(ghostDistanceMeters))}m`;
      ctx.fillText(`👻 ${ghostLabel}`, ghostCanvasPos.x - 30, ghostCanvasPos.y - 16);

      // 8. Draw Runner Center Reticle / Heading
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((userHeading * Math.PI) / 180);

      const runnerColor = currentPhase === 'sprint' 
        ? (isLight ? '#ea580c' : '#ff3300') 
        : (isLight ? '#0284c7' : '#00f0ff');

      ctx.shadowColor = runnerColor;
      ctx.shadowBlur = isLight ? 8 : 20;
      ctx.fillStyle = runnerColor;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(10, 10);
      ctx.lineTo(0, 5);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Outer Radar Ping Ring
      const pingRadius = (Date.now() / 15) % 40;
      ctx.strokeStyle = isLight 
        ? `rgba(2, 132, 199, ${1 - pingRadius / 40})` 
        : `rgba(0, 240, 255, ${1 - pingRadius / 40})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pingRadius, 0, Math.PI * 2);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [userPosition, userHeading, path, orbs, combatZones, ghostPosition, ghostDistanceMeters, currentPhase, isRecordSparks, fogClearedGrid, isLight]);

  return (
    <div
      className={`relative w-full h-full min-h-[420px] overflow-hidden select-none rounded-2xl transition-colors duration-300 ${
        isLight
          ? 'bg-slate-100 border border-slate-300 shadow-lg'
          : 'bg-slate-950 border border-cyan-500/20 shadow-[0_0_40px_rgba(0,0,0,0.8)]'
      }`}
    >
      {/* Top Map Header Badge */}
      <div
        className={`absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono backdrop-blur-md transition-colors ${
          isLight
            ? 'bg-white/90 border border-slate-300 text-slate-800 shadow-sm'
            : 'bg-slate-900/90 border border-cyan-500/40 text-cyan-300'
        }`}
      >
        <span className={`w-2 h-2 rounded-full animate-ping ${isLight ? 'bg-orange-500' : 'bg-cyan-400'}`} />
        <span>
          RADAR TÁTICO:{' '}
          <strong className={isLight ? 'text-orange-600' : 'text-white'}>
            {isLight ? 'MODO DIA (LIGHT TACTICAL)' : 'DARK NEON GRID'}
          </strong>
        </span>
      </div>

      {/* Google Maps Embed or Fallback Canvas */}
      {useGoogleMaps && apiKey ? (
        <APIProvider apiKey={apiKey} version="weekly">
          <Map
            defaultCenter={{ lat: userPosition.lat, lng: userPosition.lng }}
            defaultZoom={17}
            mapId="DARK_NEON_GRID_MAP"
            styles={isLight ? LIGHT_TACTICAL_MAP_STYLE : DARK_NEON_MAP_STYLE}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            disableDefaultUI
          >
            <MapOverlayController
              userPosition={userPosition}
              path={path}
              orbs={orbs}
              ghostPosition={ghostPosition}
              combatZones={combatZones}
            />
          </Map>
        </APIProvider>
      ) : null}

      {/* High precision Canvas Overlay */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* Mode Switcher pill */}
      {hasValidKey && (
        <button
          onClick={() => setUseGoogleMaps(!useGoogleMaps)}
          className={`absolute bottom-3 right-3 z-10 px-3 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer backdrop-blur-md ${
            isLight
              ? 'bg-white/90 border border-slate-300 text-slate-700 hover:text-slate-950 shadow-sm'
              : 'bg-slate-900/90 border border-cyan-500/40 text-cyan-400 hover:text-white'
          }`}
        >
          {useGoogleMaps ? '📡 Alternar para Canvas Grid' : '🗺️ Alternar para Google Maps'}
        </button>
      )}
    </div>
  );
};

