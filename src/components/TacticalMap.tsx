import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  Map3D,
  MapMode,
  Marker3D,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { Plus, Minus, LocateFixed, Swords, Box, Globe, Layers, Compass as CompassIcon } from 'lucide-react';
import { LatLng, PathPoint, XPOrb, CombatZone, DuelMapOpponent } from '../types';
import { DARK_NEON_MAP_STYLE, LIGHT_TACTICAL_MAP_STYLE } from '../constants/mapStyles';
import { Local3DMapLayer, MapVisualStyle } from './Local3DMapLayer';

const MIN_ZOOM = 13;
const MAX_ZOOM = 20;
const DEFAULT_ZOOM = 17;
const RECENTER_ZOOM = 17;
const MAX_GHOST_TRAIL_POINTS = 48;
const PITCH_PRESETS = [48, 58, 66] as const;

type MapOrientationMode = 'north-up' | 'heading-up';

const MAP_STYLE_STORAGE_KEY = 'run360x_map_visual_style';
const MAP_3D_STORAGE_KEY = 'run360x_map_3d_enabled';

function checkWebGL2Support(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const testCanvas = document.createElement('canvas');
    return Boolean(testCanvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

function zoomToCameraRangeMeters(zoom: number): number {
  // Smooth mapping: Z17 ~= 320m camera range, Z18 ~= 175m, Z16 ~= 600m
  return Math.max(90, Math.min(4500, Math.round(320 * Math.pow(1.88, DEFAULT_ZOOM - zoom))));
}

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
  duelOpponent?: DuelMapOpponent | null;
}

// Helper component inside APIProvider to manipulate Google Maps 2D / Vector 3D instance
function MapOverlayController({
  userPosition,
  userHeading,
  orientationMode,
  zoomLevel,
  is3DView,
  tiltAngle,
  recenterNonce,
  onSyncZoom,
}: {
  userPosition: LatLng;
  userHeading: number;
  orientationMode: MapOrientationMode;
  zoomLevel: number;
  is3DView: boolean;
  tiltAngle: number;
  recenterNonce: number;
  onSyncZoom: (z: number) => void;
}) {
  const map = useMap();
  const latestUserPositionRef = useRef<LatLng>(userPosition);

  useEffect(() => {
    latestUserPositionRef.current = userPosition;
    if (map) {
      map.panTo(userPosition);
    }
  }, [map, userPosition]);

  // Sync Google Maps camera heading & 3D tilt angle
  useEffect(() => {
    if (!map) return;
    const targetHeading = orientationMode === 'heading-up' ? userHeading : 0;
    const targetTilt = is3DView ? tiltAngle : 0;
    if (typeof map.moveCamera === 'function') {
      map.moveCamera({
        center: latestUserPositionRef.current,
        zoom: map.getZoom() ?? zoomLevel,
        heading: targetHeading,
        tilt: targetTilt,
      });
    } else {
      if (typeof map.setHeading === 'function') map.setHeading(targetHeading);
      if (typeof map.setTilt === 'function') map.setTilt(targetTilt);
    }
  }, [map, orientationMode, userHeading, zoomLevel, is3DView, tiltAngle]);

  useEffect(() => {
    if (map && map.getZoom() !== zoomLevel) {
      map.setZoom(zoomLevel);
    }
  }, [map, zoomLevel]);

  // Explicit Re-center trigger: immediately snap camera center to userPosition
  useEffect(() => {
    if (map && recenterNonce > 0) {
      const targetHeading = orientationMode === 'heading-up' ? userHeading : 0;
      const targetTilt = is3DView ? tiltAngle : 0;
      if (typeof map.moveCamera === 'function') {
        map.moveCamera({
          center: latestUserPositionRef.current,
          zoom: RECENTER_ZOOM,
          heading: targetHeading,
          tilt: targetTilt,
        });
      } else {
        map.setZoom(RECENTER_ZOOM);
        map.panTo(latestUserPositionRef.current);
        if (typeof map.setHeading === 'function') map.setHeading(targetHeading);
        if (typeof map.setTilt === 'function') map.setTilt(targetTilt);
      }
    }
  }, [map, recenterNonce, orientationMode, userHeading, is3DView, tiltAngle]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('zoom_changed', () => {
      const z = map.getZoom();
      if (typeof z === 'number') {
        const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z)));
        onSyncZoom(clamped);
      }
    });
    return () => {
      listener.remove();
    };
  }, [map, onSyncZoom]);

  return null;
}

const MAP_ORIENTATION_STORAGE_KEY = 'run360x_map_orientation';

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
  duelOpponent = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useGoogleMaps, setUseGoogleMaps] = useState(hasValidKey);
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);
  const [mapStyleMode, setMapStyleMode] = useState<MapVisualStyle>(() => {
    if (typeof window === 'undefined') return 'realistic';
    const saved = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY);
    return saved === 'tech' ? 'tech' : 'realistic';
  });
  const [is3DView, setIs3DView] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem(MAP_3D_STORAGE_KEY);
    return saved === 'false' ? false : true;
  });
  const [pitchIndex, setPitchIndex] = useState<number>(1); // default 58°
  const tiltAngle = PITCH_PRESETS[pitchIndex];
  const webgl2Available = useMemo(() => checkWebGL2Support(), []);

  const [orientationMode, setOrientationMode] = useState<MapOrientationMode>(() => {
    if (typeof window === 'undefined') return 'north-up';
    const saved = window.localStorage.getItem(MAP_ORIENTATION_STORAGE_KEY);
    return saved === 'heading-up' ? 'heading-up' : 'north-up';
  });
  const [compassPulse, setCompassPulse] = useState<number>(0);
  const compassPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentMapAngleRef = useRef<number>(0);
  const [recenterNonce, setRecenterNonce] = useState<number>(0);
  const [justRecentered, setJustRecentered] = useState<boolean>(false);
  const recenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zoomPulse, setZoomPulse] = useState<{ target: 'in' | 'out' | 'reset'; seq: number } | null>(null);
  const zoomPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUseGoogleMaps(hasValidKey);
  }, [hasValidKey]);

  const handleSelectStyleMode = (mode: MapVisualStyle) => {
    setMapStyleMode(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, mode);
    }
  };

  const handleToggle3D = () => {
    setIs3DView((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MAP_3D_STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  const handleCyclePitch = () => {
    setPitchIndex((prev) => (prev + 1) % PITCH_PRESETS.length);
  };

  const isGoogleMapsActive = useGoogleMaps && Boolean(apiKey);
  const isGooglePhotorealistic3D =
    isGoogleMapsActive && is3DView && mapStyleMode === 'realistic' && webgl2Available;
  const isGoogleVector3D = isGoogleMapsActive && is3DView && mapStyleMode === 'tech';

  useEffect(() => {
    return () => {
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
      if (zoomPulseTimerRef.current) clearTimeout(zoomPulseTimerRef.current);
      if (compassPulseTimerRef.current) clearTimeout(compassPulseTimerRef.current);
    };
  }, []);

  const isLight = theme === 'light';
  const hasActiveCombatZone = combatZones.some((cz) => cz.active);
  const isHeadingUp = orientationMode === 'heading-up';

  const triggerZoomPulse = (target: 'in' | 'out' | 'reset') => {
    setZoomPulse((prev) => ({ target, seq: (prev?.seq ?? 0) + 1 }));
    if (zoomPulseTimerRef.current) clearTimeout(zoomPulseTimerRef.current);
    zoomPulseTimerRef.current = setTimeout(() => setZoomPulse(null), 480);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + 1));
    triggerZoomPulse('in');
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - 1));
    triggerZoomPulse('out');
  };

  const handleResetZoom = () => {
    setZoomLevel(DEFAULT_ZOOM);
    triggerZoomPulse('reset');
  };

  const handleRecenter = () => {
    setZoomLevel(RECENTER_ZOOM);
    setRecenterNonce((n) => n + 1);
    setJustRecentered(true);
    if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
    recenterTimerRef.current = setTimeout(() => setJustRecentered(false), 700);
  };

  const handleToggleOrientation = () => {
    setOrientationMode((prev) => {
      const next: MapOrientationMode = prev === 'north-up' ? 'heading-up' : 'north-up';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MAP_ORIENTATION_STORAGE_KEY, next);
      }
      return next;
    });
    setCompassPulse((n) => n + 1);
    if (compassPulseTimerRef.current) clearTimeout(compassPulseTimerRef.current);
    compassPulseTimerRef.current = setTimeout(() => setCompassPulse(0), 480);
  };

  // Particle sparks buffer for high speed
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([]);

  // Rolling Ghost Runner trail history (fading wake behind the Ghost Runner)
  const ghostTrailRef = useRef<LatLng[]>([]);

  useEffect(() => {
    if (path.length <= 1) {
      ghostTrailRef.current = [{ ...ghostPosition }];
      return;
    }

    const trail = ghostTrailRef.current;
    const last = trail[trail.length - 1];
    if (!last) {
      ghostTrailRef.current = [{ ...ghostPosition }];
      return;
    }

    // Approximate planar meter delta to avoid duplicate stationary points
    const dLatM = (ghostPosition.lat - last.lat) * 111000;
    const dLngM =
      (ghostPosition.lng - last.lng) * 111000 * Math.cos((ghostPosition.lat * Math.PI) / 180);
    const movedMeters = Math.hypot(dLatM, dLngM);

    if (movedMeters >= 0.75) {
      const nextTrail = [...trail, { ...ghostPosition }];
      if (nextTrail.length > MAX_GHOST_TRAIL_POINTS) {
        nextTrail.splice(0, nextTrail.length - MAX_GHOST_TRAIL_POINTS);
      }
      ghostTrailRef.current = nextTrail;
    }
  }, [ghostPosition, path.length]);

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

      // Clear transparently so real local tiles / Google Maps 3D streets show crisp underneath
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Smoothly interpolate map rotation angle between North-Up (0°) and Heading-Up (-userHeading°)
      const targetAngleDeg = orientationMode === 'heading-up' ? -userHeading : 0;
      const shortestDelta = ((targetAngleDeg - currentMapAngleRef.current + 540) % 360) - 180;
      if (Math.abs(shortestDelta) < 0.15) {
        currentMapAngleRef.current = targetAngleDeg;
      } else {
        currentMapAngleRef.current += shortestDelta * 0.16;
      }
      const mapRad = (currentMapAngleRef.current * Math.PI) / 180;
      const cosMap = Math.cos(mapRad);
      const sinMap = Math.sin(mapRad);

      // Exact Web Mercator pixel-per-meter scaling so tactical overlays lock 1:1 to real streets below
      const metersPerPixel =
        (156543.03392 * Math.cos((userPosition.lat * Math.PI) / 180)) / Math.pow(2, zoomLevel);
      const scale = 1 / Math.max(0.05, metersPerPixel);
      const zoomFactor = Math.pow(1.45, zoomLevel - DEFAULT_ZOOM);

      // Function to map LatLng to canvas relative to user center (rotated by active map orientation)
      const toCanvas = (pos: LatLng) => {
        const dLat = (pos.lat - userPosition.lat) * 111320;
        const dLng = (pos.lng - userPosition.lng) * 111320 * Math.cos((userPosition.lat * Math.PI) / 180);
        const dx = dLng * scale;
        const dy = -dLat * scale;
        return {
          x: centerX + dx * cosMap - dy * sinMap,
          y: centerY + dx * sinMap + dy * cosMap,
        };
      };

      // World-rotated subtle tactical overlay (Tech Cyber Grid only in 'tech' mode, keeping 'realistic' aerial crisp)
      const coverRadius = Math.hypot(width, height) / 2 + 120;
      if (mapStyleMode === 'tech') {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(mapRad);

        // Translucent cyber grid overlay on top of real dark/light vector street map
        ctx.strokeStyle = isLight ? 'rgba(14, 116, 144, 0.14)' : 'rgba(0, 240, 255, 0.14)';
        ctx.lineWidth = 1;
        const gridSize = Math.max(24, Math.min(96, 48 * zoomFactor));
        const gridSteps = Math.ceil(coverRadius / gridSize);

        ctx.beginPath();
        for (let i = -gridSteps; i <= gridSteps; i++) {
          const offset = i * gridSize;
          ctx.moveTo(offset, -coverRadius);
          ctx.lineTo(offset, coverRadius);
          ctx.moveTo(-coverRadius, offset);
          ctx.lineTo(coverRadius, offset);
        }
        ctx.stroke();

        // Subtle translucent Fog of War sectors only when unexplored tiles exist & in tech mode
        if (fogClearedGrid.size > 0) {
          const fogTileSize = Math.max(36, 90 * zoomFactor);
          const tileRange = Math.min(6, Math.ceil(coverRadius / fogTileSize));
          for (let gx = -tileRange; gx <= tileRange; gx++) {
            for (let gy = -tileRange; gy <= tileRange; gy++) {
              const tileKey = `${Math.floor(userPosition.lat * 1000) + gx}_${Math.floor(userPosition.lng * 1000) + gy}`;
              if (!fogClearedGrid.has(tileKey)) {
                const tileX = gx * fogTileSize - fogTileSize / 2;
                const tileY = gy * fogTileSize - fogTileSize / 2;
                ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.16)' : 'rgba(2, 6, 23, 0.24)';
                ctx.fillRect(tileX, tileY, fogTileSize, fogTileSize);
              }
            }
          }
        }
        ctx.restore();
      }

      // 3. Draw Combat Zones (projected into current map orientation, labels remain upright)
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

      // 7. Draw Duel Opponent (when in 1v1 Duel Mode) OR Ghost Trail & Ghost Runner
      if (duelOpponent) {
        const oppCanvasPos = toCanvas(duelOpponent.position);
        const isUserAhead = duelOpponent.missionGapMeters >= 0;

        // 7a. Fading amber-orange opponent trail
        const oppTrailPoints = duelOpponent.trail;
        if (oppTrailPoints.length > 1) {
          const projectedOppTrail = oppTrailPoints.map((pt) => toCanvas(pt));
          const lastOpp = projectedOppTrail[projectedOppTrail.length - 1];
          if (Math.hypot(lastOpp.x - oppCanvasPos.x, lastOpp.y - oppCanvasPos.y) > 0.5) {
            projectedOppTrail.push(oppCanvasPos);
          }

          const segCount = projectedOppTrail.length - 1;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let i = 1; i < projectedOppTrail.length; i++) {
            const pPrev = projectedOppTrail[i - 1];
            const pCurr = projectedOppTrail[i];
            const t = i / segCount;
            const eased = t * t;

            ctx.strokeStyle = isLight
              ? `rgba(234, 88, 12, ${(eased * 0.28).toFixed(3)})`
              : `rgba(249, 115, 22, ${(eased * 0.36).toFixed(3)})`;
            ctx.lineWidth = 2 + eased * 8.5;
            ctx.beginPath();
            ctx.moveTo(pPrev.x, pPrev.y);
            ctx.lineTo(pCurr.x, pCurr.y);
            ctx.stroke();

            ctx.strokeStyle = isLight
              ? `rgba(249, 115, 22, ${(0.08 + eased * 0.72).toFixed(3)})`
              : `rgba(253, 186, 116, ${(0.08 + eased * 0.8).toFixed(3)})`;
            ctx.lineWidth = 1.2 + eased * 3.2;
            ctx.beginPath();
            ctx.moveTo(pPrev.x, pPrev.y);
            ctx.lineTo(pCurr.x, pCurr.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        // 7b. Compute clamping if opponent is outside current canvas viewport
        const edgePad = 36;
        const dxOpp = oppCanvasPos.x - centerX;
        const dyOpp = oppCanvasPos.y - centerY;
        const oppDistPx = Math.hypot(dxOpp, dyOpp);
        const isOffscreen =
          oppCanvasPos.x < edgePad ||
          oppCanvasPos.x > width - edgePad ||
          oppCanvasPos.y < edgePad ||
          oppCanvasPos.y > height - edgePad;

        let targetX = oppCanvasPos.x;
        let targetY = oppCanvasPos.y;

        if (isOffscreen && oppDistPx > 1) {
          const maxScaleX =
            dxOpp > 0
              ? (width - edgePad - centerX) / dxOpp
              : dxOpp < 0
              ? (edgePad - centerX) / dxOpp
              : Infinity;
          const maxScaleY =
            dyOpp > 0
              ? (height - edgePad - centerY) / dyOpp
              : dyOpp < 0
              ? (edgePad - centerY) / dyOpp
              : Infinity;
          const scaleFactor = Math.min(1, maxScaleX, maxScaleY);
          targetX = centerX + dxOpp * scaleFactor;
          targetY = centerY + dyOpp * scaleFactor;
        }

        const sepLabel =
          duelOpponent.separationMeters >= 1000
            ? `${(duelOpponent.separationMeters / 1000).toFixed(2)} km`
            : `${Math.round(duelOpponent.separationMeters)} m`;

        // 7c. Glowing dashed tactical Distance Vector Line connecting both runners
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = isLight
          ? 'rgba(234, 88, 12, 0.25)'
          : 'rgba(251, 146, 60, 0.28)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = -(Date.now() / 45) % 24;
        ctx.strokeStyle = isLight ? '#ea580c' : '#fb923c';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 7d. Upright midpoint distance pill directly along the vector line
        const midX = (centerX + targetX) / 2;
        const midY = (centerY + targetY) / 2;
        const vectorBadgeText = `↔ ${sepLabel}`;
        ctx.save();
        ctx.font = 'bold 11px monospace';
        const badgeTextWidth = ctx.measureText(vectorBadgeText).width;
        const badgeW = badgeTextWidth + 16;
        const badgeH = 22;
        const badgeX = midX - badgeW / 2;
        const badgeY = midY - badgeH / 2;

        ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.92)' : 'rgba(2, 6, 23, 0.92)';
        ctx.strokeStyle = isLight ? '#ea580c' : '#fb923c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fdba74';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(vectorBadgeText, midX, midY + 0.5);
        ctx.restore();

        // 7e. Draw rival marker (or off-screen directional edge arrow)
        if (isOffscreen) {
          const bearingRad = Math.atan2(dyOpp, dxOpp);
          ctx.save();
          ctx.translate(targetX, targetY);
          ctx.rotate(bearingRad + Math.PI / 2);
          ctx.fillStyle = '#f97316';
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(0, -12);
          ctx.lineTo(9, 8);
          ctx.lineTo(0, 4);
          ctx.lineTo(-9, 8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = isLight ? '#9a3412' : '#fed7aa';
          ctx.fillText(
            `${duelOpponent.name.split(' ')[0].toUpperCase()} · ${sepLabel}`,
            Math.max(60, Math.min(width - 60, targetX)),
            targetY > height / 2 ? targetY - 16 : targetY + 22
          );
          ctx.restore();
        } else {
          // Pulsing rival radar ring
          const oppPulse = ((Date.now() / 18) % 30) + 10;
          ctx.save();
          ctx.strokeStyle = `rgba(249, 115, 22, ${Math.max(0, 1 - (oppPulse - 10) / 30).toFixed(2)})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(oppCanvasPos.x, oppCanvasPos.y, oppPulse, 0, Math.PI * 2);
          ctx.stroke();

          // Directional rival chevron
          ctx.translate(oppCanvasPos.x, oppCanvasPos.y);
          ctx.rotate(((duelOpponent.heading + currentMapAngleRef.current) * Math.PI) / 180);
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = isLight ? 8 : 18;
          ctx.fillStyle = isLight ? '#ea580c' : '#fb923c';
          ctx.beginPath();
          ctx.moveTo(0, -13);
          ctx.lineTo(9.5, 9.5);
          ctx.lineTo(0, 4.5);
          ctx.lineTo(-9.5, 9.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Rival callout tag
          ctx.save();
          const gapMeters = Math.round(Math.abs(duelOpponent.missionGapMeters));
          const rivalTag = `${duelOpponent.name.split(' ')[0].toUpperCase()} · V${duelOpponent.currentLap} (${
            isUserAhead ? `-${gapMeters}m` : `+${gapMeters}m`
          })`;
          ctx.font = 'bold 10px monospace';
          const tagW = ctx.measureText(rivalTag).width + 12;
          const tagX = oppCanvasPos.x - tagW / 2;
          const tagY = oppCanvasPos.y - 34;

          ctx.fillStyle = isLight ? 'rgba(255, 247, 237, 0.94)' : 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = isLight ? '#fb923c' : 'rgba(251, 146, 60, 0.7)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, 18, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isLight ? '#9a3412' : '#fed7aa';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(rivalTag, oppCanvasPos.x, tagY + 9.5);
          ctx.restore();
        }
      } else {
        // Regular Workout Mode: Draw Ghost Trail (fading translucent wake) & Ghost Runner
        const ghostCanvasPos = toCanvas(ghostPosition);
        const isGhostAhead = ghostDistanceMeters < 0;
        const ghostTrailPoints = ghostTrailRef.current;

        if (ghostTrailPoints.length > 1) {
        const projectedTrail = ghostTrailPoints.map((pt) => toCanvas(pt));
        // Ensure the trail terminates cleanly right at the live Ghost Runner marker
        const lastProjected = projectedTrail[projectedTrail.length - 1];
        if (
          Math.hypot(lastProjected.x - ghostCanvasPos.x, lastProjected.y - ghostCanvasPos.y) > 0.5
        ) {
          projectedTrail.push(ghostCanvasPos);
        }

        const segCount = projectedTrail.length - 1;
        // Hotter fuchsia-violet glow when Ghost is ahead (pace pressure), cool phantom violet when runner leads
        const glowRgb = isGhostAhead
          ? isLight
            ? '192, 38, 211'
            : '217, 70, 239'
          : isLight
          ? '147, 51, 234'
          : '168, 85, 247';
        const coreRgb = isGhostAhead
          ? isLight
            ? '217, 70, 239'
            : '240, 171, 252'
          : isLight
          ? '168, 85, 247'
          : '216, 180, 254';

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < projectedTrail.length; i++) {
          const pPrev = projectedTrail[i - 1];
          const pCurr = projectedTrail[i];
          const t = i / segCount; // 0 (oldest tail) -> 1 (right behind Ghost Runner)
          const eased = t * t; // smooth exponential fade-out toward the tail

          // Outer translucent phantom halo
          ctx.strokeStyle = `rgba(${glowRgb}, ${(eased * (isLight ? 0.28 : 0.36)).toFixed(3)})`;
          ctx.lineWidth = 2 + eased * 9.5;
          ctx.beginPath();
          ctx.moveTo(pPrev.x, pPrev.y);
          ctx.lineTo(pCurr.x, pCurr.y);
          ctx.stroke();

          // Inner translucent ghost core ribbon
          ctx.strokeStyle = `rgba(${coreRgb}, ${(0.04 + eased * (isLight ? 0.65 : 0.78)).toFixed(3)})`;
          ctx.lineWidth = 1 + eased * 3.6;
          ctx.beginPath();
          ctx.moveTo(pPrev.x, pPrev.y);
          ctx.lineTo(pCurr.x, pCurr.y);
          ctx.stroke();

          // Subtle cadence echo nodes along the wake to emphasize Ghost velocity spacing
          if (i % 4 === 0 && i < projectedTrail.length - 1) {
            ctx.fillStyle = `rgba(${coreRgb}, ${(eased * 0.65).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(pCurr.x, pCurr.y, 1.4 + eased * 1.9, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Dashed pace-differential tether between Runner and Ghost Runner
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = isGhostAhead
        ? isLight
          ? 'rgba(192, 38, 211, 0.72)'
          : 'rgba(232, 121, 249, 0.68)'
        : isLight
        ? 'rgba(147, 51, 234, 0.65)'
        : 'rgba(168, 85, 247, 0.58)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(ghostCanvasPos.x, ghostCanvasPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Translucent outer aura around Ghost Runner head
      ctx.fillStyle = isGhostAhead
        ? 'rgba(217, 70, 239, 0.22)'
        : 'rgba(168, 85, 247, 0.22)';
      ctx.beginPath();
      ctx.arc(ghostCanvasPos.x, ghostCanvasPos.y, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = isGhostAhead ? '#d946ef' : '#9333ea';
      ctx.shadowBlur = isLight ? 6 : 16;
      ctx.fillStyle = isGhostAhead
        ? isLight
          ? '#c026d3'
          : 'rgba(217, 70, 239, 0.9)'
        : isLight
        ? '#9333ea'
        : 'rgba(168, 85, 247, 0.88)';
      ctx.beginPath();
      ctx.arc(ghostCanvasPos.x, ghostCanvasPos.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isLight ? '#581c87' : '#e9d5ff';
      ctx.font = 'bold 10px sans-serif';
      const ghostLabel = ghostDistanceMeters >= 0 
        ? `FANTASMA: -${Math.abs(Math.round(ghostDistanceMeters))}m` 
        : `FANTASMA: +${Math.abs(Math.round(ghostDistanceMeters))}m`;
      ctx.fillText(`👻 ${ghostLabel}`, ghostCanvasPos.x - 30, ghostCanvasPos.y - 18);
      }

      // 8. Draw Runner Center Reticle / Heading (points straight up in Heading-Up, true bearing in North-Up)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(((userHeading + currentMapAngleRef.current) * Math.PI) / 180);

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

      // 9. Subtle Rotating Cardinal Compass Ring (N / E / S / W) for instant orientation clarity
      const compassRingRadius = Math.min(width, height) * 0.42;
      ctx.save();
      ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.2)' : 'rgba(6, 182, 212, 0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, compassRingRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const cardinals: { label: string; angleDeg: number; isNorth?: boolean }[] = [
        { label: 'N', angleDeg: 0, isNorth: true },
        { label: 'E', angleDeg: 90 },
        { label: 'S', angleDeg: 180 },
        { label: 'W', angleDeg: 270 },
      ];
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      cardinals.forEach(({ label, angleDeg, isNorth }) => {
        const theta = ((angleDeg + currentMapAngleRef.current - 90) * Math.PI) / 180;
        const cx = centerX + Math.cos(theta) * (compassRingRadius + 12);
        const cy = centerY + Math.sin(theta) * (compassRingRadius + 12);
        ctx.fillStyle = isNorth
          ? '#f43f5e'
          : isLight
          ? 'rgba(71, 85, 105, 0.7)'
          : 'rgba(148, 163, 184, 0.7)';
        ctx.fillText(label, cx, cy);
      });
      ctx.restore();

      // 8b. Subtle 3D Vertical Beacon Pillar rising from Runner position in 3D Perspective mode
      if (is3DView && !isGooglePhotorealistic3D) {
        ctx.save();
        const beamGrad = ctx.createLinearGradient(centerX, centerY, centerX, centerY - 56);
        beamGrad.addColorStop(0, isLight ? 'rgba(2, 132, 199, 0.72)' : 'rgba(0, 240, 255, 0.78)');
        beamGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.strokeStyle = beamGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY - 56);
        ctx.stroke();

        // Floating 3D altitude diamond cap
        ctx.fillStyle = isLight ? '#0284c7' : '#22d3ee';
        ctx.beginPath();
        ctx.arc(centerX, centerY - 54, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [
    userPosition,
    userHeading,
    orientationMode,
    path,
    orbs,
    combatZones,
    ghostPosition,
    ghostDistanceMeters,
    currentPhase,
    isRecordSparks,
    fogClearedGrid,
    isLight,
    zoomLevel,
    duelOpponent,
    mapStyleMode,
    is3DView,
    isGooglePhotorealistic3D,
  ]);

  const effectiveRotationDeg = isHeadingUp ? -userHeading : 0;
  const stage3DTransform =
    !isGoogleMapsActive && is3DView
      ? {
          transform: `perspective(1050px) rotateX(${tiltAngle}deg) scale(1.26)`,
          transformOrigin: '50% 58%',
        }
      : undefined;

  const canvasOverlay3DTransform =
    isGoogleVector3D
      ? {
          transform: `perspective(1050px) rotateX(${tiltAngle}deg) scale(1.16)`,
          transformOrigin: '50% 56%',
        }
      : undefined;

  return (
    <div
      className={`relative w-full h-full min-h-[420px] overflow-hidden select-none rounded-2xl transition-colors duration-300 ${
        isLight
          ? 'bg-slate-200 border border-slate-300 shadow-lg'
          : 'bg-slate-950 border border-cyan-500/20 shadow-[0_0_40px_rgba(0,0,0,0.8)]'
      }`}
    >
      {/* LAYER 1: GOOGLE MAPS PLATFORM (Photorealistic 3D / Vector 3D / 2D) OR LOCAL REAL-WORLD 3D STAGE */}
      {isGoogleMapsActive ? (
        <APIProvider apiKey={apiKey} version="weekly" language="pt-BR" region="BR">
          {isGooglePhotorealistic3D ? (
            <Map3D
              mode={MapMode.HYBRID}
              center={{ lat: userPosition.lat, lng: userPosition.lng, altitude: 0 }}
              range={zoomToCameraRangeMeters(zoomLevel)}
              tilt={tiltAngle}
              heading={isHeadingUp ? userHeading : 0}
              defaultUIHidden
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
            >
              <Marker3D
                position={{ lat: userPosition.lat, lng: userPosition.lng, altitude: 18 }}
                label="VOCÊ"
              >
                <Pin background="#06b6d4" borderColor="#083344" glyphColor="#ffffff" scale={1.15} />
              </Marker3D>
              {duelOpponent && (
                <Marker3D
                  position={{
                    lat: duelOpponent.position.lat,
                    lng: duelOpponent.position.lng,
                    altitude: 18,
                  }}
                  label={`${duelOpponent.name.split(' ')[0]} · ${Math.round(duelOpponent.separationMeters)}m`}
                >
                  <Pin background="#f97316" borderColor="#431407" glyphColor="#ffffff" scale={1.15} />
                </Marker3D>
              )}
            </Map3D>
          ) : (
            <GoogleMap
              key={`gmap-${mapStyleMode}-${is3DView ? '3d' : '2d'}-${theme}`}
              defaultCenter={{ lat: userPosition.lat, lng: userPosition.lng }}
              defaultZoom={zoomLevel}
              defaultTilt={is3DView ? tiltAngle : 0}
              defaultHeading={isHeadingUp ? userHeading : 0}
              renderingType={is3DView ? 'VECTOR' : undefined}
              mapId={is3DView ? 'DEMO_MAP_ID' : undefined}
              colorScheme={is3DView ? (isLight ? 'LIGHT' : 'DARK') : undefined}
              mapTypeId={mapStyleMode === 'realistic' ? 'hybrid' : 'roadmap'}
              styles={
                !is3DView && mapStyleMode === 'tech'
                  ? isLight
                    ? LIGHT_TACTICAL_MAP_STYLE
                    : DARK_NEON_MAP_STYLE
                  : undefined
              }
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
              disableDefaultUI
            >
              <MapOverlayController
                userPosition={userPosition}
                userHeading={userHeading}
                orientationMode={orientationMode}
                zoomLevel={zoomLevel}
                is3DView={is3DView}
                tiltAngle={tiltAngle}
                recenterNonce={recenterNonce}
                onSyncZoom={setZoomLevel}
              />
            </GoogleMap>
          )}
        </APIProvider>
      ) : null}

      {/* LAYER 2: UNIFIED LOCAL 3D PERSPECTIVE STAGE (Real Local Satellite/Street Tiles + Tactical Canvas HUD) */}
      {!isGoogleMapsActive ? (
        <div
          className="absolute inset-0 transition-transform duration-500 ease-out will-change-transform"
          style={stage3DTransform}
        >
          <Local3DMapLayer
            center={userPosition}
            zoom={zoomLevel}
            rotationDeg={effectiveRotationDeg}
            styleMode={mapStyleMode}
            theme={theme}
            is3D={is3DView}
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
        </div>
      ) : (
        !isGooglePhotorealistic3D && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-10 transition-transform duration-500"
            style={canvasOverlay3DTransform}
          />
        )
      )}

      {/* Atmospheric 3D Horizon Depth Haze (creates realistic sky/depth illusion at top edge in 3D mode) */}
      {is3DView && !isGooglePhotorealistic3D && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-28 z-20 transition-opacity duration-500 ${
            mapStyleMode === 'realistic'
              ? isLight
                ? 'bg-gradient-to-b from-sky-200/80 via-sky-100/30 to-transparent'
                : 'bg-gradient-to-b from-slate-950/90 via-slate-900/40 to-transparent'
              : isLight
              ? 'bg-gradient-to-b from-slate-100/85 via-slate-100/30 to-transparent'
              : 'bg-gradient-to-b from-slate-950/95 via-cyan-950/35 to-transparent'
          }`}
          aria-hidden="true"
        />
      )}

      {/* Top Map Header Badge */}
      <div
        className={`absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono backdrop-blur-md transition-colors ${
          isLight
            ? 'bg-white/90 border border-slate-300 text-slate-800 shadow-sm'
            : 'bg-slate-900/90 border border-cyan-500/40 text-cyan-300'
        }`}
      >
        <span className={`w-2 h-2 rounded-full animate-ping ${isLight ? 'bg-orange-500' : 'bg-cyan-400'}`} />
        <span className="truncate">
          {isGoogleMapsActive ? 'GOOGLE MAPS' : 'MAPA LOCAL'}{' '}
          <strong className={isLight ? 'text-orange-600' : 'text-white'}>
            {mapStyleMode === 'realistic' ? 'REALISTA' : 'TECNOLÓGICO'} {is3DView ? '3D' : '2D'}
          </strong>
        </span>
        {is3DView && (
          <span
            className={`hidden md:inline-flex items-center pl-2 border-l text-[10px] font-bold tabular-nums ${
              isLight ? 'border-slate-300 text-slate-600' : 'border-cyan-500/30 text-cyan-200'
            }`}
          >
            {tiltAngle}°
          </span>
        )}
        <span
          className={`hidden sm:inline-flex items-center gap-1 pl-2 border-l text-[10px] font-bold tabular-nums ${
            isLight
              ? 'border-slate-300 text-slate-600'
              : 'border-cyan-500/30 text-cyan-200'
          }`}
        >
          <span>{isHeadingUp ? 'HEADING-UP' : 'NORTH-UP'}</span>
          <span className="opacity-75">
            {String(Math.round(((userHeading % 360) + 360) % 360)).padStart(3, '0')}°
          </span>
        </span>
      </div>

      {/* Live 1v1 Duel Separation Distance Strip */}
      {duelOpponent && (
        <div
          className={`absolute top-14 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-mono backdrop-blur-md border shadow-md ${
            isLight
              ? 'bg-orange-50/95 border-orange-300 text-orange-950'
              : 'bg-slate-950/90 border-orange-500/50 text-orange-100'
          }`}
        >
          <Swords className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="font-bold tabular-nums">
            {duelOpponent.separationMeters >= 1000
              ? `${(duelOpponent.separationMeters / 1000).toFixed(2)} km`
              : `${Math.round(duelOpponent.separationMeters)} m`}
          </span>
          <span className="opacity-50">·</span>
          <span
            className={`font-bold tabular-nums ${
              duelOpponent.missionGapMeters > 2
                ? isLight
                  ? 'text-emerald-700'
                  : 'text-emerald-400'
                : duelOpponent.missionGapMeters < -2
                ? isLight
                  ? 'text-rose-700'
                  : 'text-rose-400'
                : isLight
                ? 'text-slate-600'
                : 'text-cyan-300'
            }`}
          >
            {Math.abs(duelOpponent.missionGapMeters) <= 2
              ? 'Empatados'
              : duelOpponent.missionGapMeters > 0
              ? `+${Math.round(duelOpponent.missionGapMeters)} m à frente`
              : `-${Math.round(Math.abs(duelOpponent.missionGapMeters))} m atrás`}
          </span>
        </div>
      )}

      {/* Custom Floating Tactical Map Controls ('+', '-', and 'Re-center') */}
      <div className="absolute top-3 right-3 z-30 flex flex-col items-center gap-2">
        <div
          className={`flex flex-col items-center rounded-xl border backdrop-blur-md overflow-hidden shadow-lg transition-all duration-200 ${
            zoomPulse
              ? hasActiveCombatZone
                ? 'border-rose-400 shadow-[0_0_26px_rgba(244,63,94,0.75)] bg-slate-900/95'
                : isLight
                ? 'border-cyan-400 shadow-[0_0_22px_rgba(0,240,255,0.65)] bg-white/95'
                : 'border-cyan-300 shadow-[0_0_26px_rgba(0,240,255,0.75)] bg-slate-900/95'
              : hasActiveCombatZone
              ? isLight
                ? 'bg-white/95 border-rose-400 shadow-rose-500/20'
                : 'bg-slate-900/95 border-rose-500/70 shadow-[0_0_18px_rgba(244,63,94,0.35)]'
              : isLight
              ? 'bg-white/90 border-slate-300 shadow-slate-300/60'
              : 'bg-slate-900/90 border-cyan-500/40 shadow-[0_0_16px_rgba(6,182,212,0.2)]'
          }`}
          role="group"
          aria-label="Controles de zoom do mapa tático"
        >
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomLevel >= MAX_ZOOM}
            aria-label="Aumentar zoom do mapa"
            title="Aumentar zoom (+)"
            className={`relative overflow-hidden w-10 h-10 flex items-center justify-center transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
              zoomPulse?.target === 'in'
                ? hasActiveCombatZone
                  ? 'animate-zoom-neon-pulse-combat text-white'
                  : 'animate-zoom-neon-pulse text-white'
                : isLight
                ? 'text-slate-800 hover:bg-cyan-50 hover:text-cyan-700'
                : 'text-cyan-300 hover:bg-cyan-500/20 hover:text-white'
            }`}
          >
            {zoomPulse?.target === 'in' && (
              <span
                key={`ripple-in-${zoomPulse.seq}`}
                className={`pointer-events-none absolute inset-1.5 rounded-full border-2 animate-zoom-neon-ripple ${
                  hasActiveCombatZone
                    ? 'border-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.95)]'
                    : 'border-cyan-300 shadow-[0_0_14px_rgba(0,240,255,0.95)]'
                }`}
              />
            )}
            <Plus
              className={`relative z-10 w-4 h-4 stroke-[2.75] transition-transform ${
                zoomPulse?.target === 'in'
                  ? hasActiveCombatZone
                    ? 'scale-110 text-rose-200 drop-shadow-[0_0_8px_#fb7185]'
                    : 'scale-110 text-cyan-200 drop-shadow-[0_0_8px_#00f0ff]'
                  : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            title="Toque para restaurar zoom padrão (Z17)"
            className={`relative overflow-hidden w-full py-1 px-1.5 text-[10px] font-mono font-black border-y text-center transition cursor-pointer ${
              zoomPulse?.target === 'reset'
                ? hasActiveCombatZone
                  ? 'animate-zoom-neon-pulse-combat border-rose-400 text-white'
                  : 'animate-zoom-neon-pulse border-cyan-300 text-white'
                : hasActiveCombatZone
                ? isLight
                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                  : 'border-rose-500/40 bg-rose-950/60 text-rose-300 hover:bg-rose-900/70'
                : isLight
                ? 'border-slate-200 bg-slate-50 text-slate-600 hover:text-cyan-700'
                : 'border-slate-800 bg-slate-950/80 text-cyan-400 hover:text-white'
            }`}
          >
            <span
              className={`relative z-10 ${
                zoomPulse
                  ? hasActiveCombatZone
                    ? 'drop-shadow-[0_0_8px_#fb7185]'
                    : 'drop-shadow-[0_0_8px_#00f0ff]'
                  : ''
              }`}
            >
              Z{zoomLevel}
            </span>
          </button>

          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomLevel <= MIN_ZOOM}
            aria-label="Diminuir zoom do mapa"
            title="Diminuir zoom (-)"
            className={`relative overflow-hidden w-10 h-10 flex items-center justify-center transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
              zoomPulse?.target === 'out'
                ? hasActiveCombatZone
                  ? 'animate-zoom-neon-pulse-combat text-white'
                  : 'animate-zoom-neon-pulse text-white'
                : isLight
                ? 'text-slate-800 hover:bg-cyan-50 hover:text-cyan-700'
                : 'text-cyan-300 hover:bg-cyan-500/20 hover:text-white'
            }`}
          >
            {zoomPulse?.target === 'out' && (
              <span
                key={`ripple-out-${zoomPulse.seq}`}
                className={`pointer-events-none absolute inset-1.5 rounded-full border-2 animate-zoom-neon-ripple ${
                  hasActiveCombatZone
                    ? 'border-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.95)]'
                    : 'border-cyan-300 shadow-[0_0_14px_rgba(0,240,255,0.95)]'
                }`}
              />
            )}
            <Minus
              className={`relative z-10 w-4 h-4 stroke-[2.75] transition-transform ${
                zoomPulse?.target === 'out'
                  ? hasActiveCombatZone
                    ? 'scale-110 text-rose-200 drop-shadow-[0_0_8px_#fb7185]'
                    : 'scale-110 text-cyan-200 drop-shadow-[0_0_8px_#00f0ff]'
                  : ''
              }`}
            />
          </button>
        </div>

        {/* Re-center Icon Button (resets zoom to 16 & snaps camera to userPosition) */}
        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Recentralizar mapa na posição do corredor (Zoom 16)"
          title="Recentralizar no corredor (Zoom 16)"
          className={`w-10 h-10 rounded-xl border backdrop-blur-md flex items-center justify-center shadow-lg transition-all cursor-pointer ${
            justRecentered
              ? isLight
                ? 'bg-orange-500 border-orange-600 text-white scale-95 shadow-orange-500/30'
                : 'bg-cyan-500 border-cyan-400 text-slate-950 scale-95 shadow-[0_0_20px_rgba(6,182,212,0.55)]'
              : hasActiveCombatZone
              ? isLight
                ? 'bg-white/95 border-rose-400 text-rose-600 hover:bg-rose-50 shadow-rose-500/20'
                : 'bg-slate-900/95 border-rose-500/70 text-rose-300 hover:bg-rose-950 hover:text-white shadow-[0_0_18px_rgba(244,63,94,0.35)]'
              : isLight
              ? 'bg-white/90 border-slate-300 text-slate-800 hover:bg-orange-50 hover:text-orange-600 shadow-slate-300/60'
              : 'bg-slate-900/90 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 hover:text-white shadow-[0_0_16px_rgba(6,182,212,0.2)]'
          }`}
        >
          <LocateFixed className={`w-4 h-4 stroke-[2.5] ${justRecentered ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Prominent Compass North-Up / Heading-Up Orientation Toggle Button */}
      <button
        type="button"
        data-testid="compass-north-up-btn"
        onClick={handleToggleOrientation}
        aria-pressed={!isHeadingUp}
        aria-label={
          isHeadingUp
            ? 'Heading-Up orientation active. Click to switch to Compass North-Up'
            : 'Compass North-Up orientation active. Click to switch to Heading-Up'
        }
        title={
          isHeadingUp
            ? 'Heading-Up (following runner direction) • Click to switch to Compass North-Up'
            : 'Compass North-Up (True North locked up) • Click to switch to Heading-Up'
        }
        className={`absolute ${
          useGoogleMaps && apiKey ? 'bottom-9' : 'bottom-4'
        } left-3 z-30 overflow-hidden px-3 py-2 rounded-xl border backdrop-blur-md flex items-center gap-2.5 shadow-lg transition-all cursor-pointer ${
          compassPulse
            ? hasActiveCombatZone
              ? 'animate-zoom-neon-pulse-combat border-rose-400 text-white'
              : 'animate-zoom-neon-pulse border-cyan-300 text-white'
            : isHeadingUp
            ? isLight
              ? 'bg-orange-500 border-orange-600 text-white shadow-orange-500/30 hover:bg-orange-600'
              : 'bg-cyan-950/95 border-cyan-400 text-cyan-100 shadow-[0_0_22px_rgba(0,240,255,0.45)] hover:bg-cyan-900/95'
            : hasActiveCombatZone
            ? isLight
              ? 'bg-white/95 border-rose-400 text-rose-700 hover:bg-rose-50 shadow-rose-500/20'
              : 'bg-slate-900/95 border-rose-500/70 text-rose-200 hover:bg-rose-950 hover:text-white shadow-[0_0_18px_rgba(244,63,94,0.35)]'
            : isLight
            ? 'bg-white/95 border-slate-300 text-slate-800 hover:bg-cyan-50 hover:text-cyan-800 shadow-slate-300/60'
            : 'bg-slate-900/95 border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/20 hover:text-white shadow-[0_0_18px_rgba(6,182,212,0.25)]'
        }`}
      >
        {compassPulse > 0 && (
          <span
            key={`ripple-compass-${compassPulse}`}
            className={`pointer-events-none absolute inset-1 rounded-xl border-2 animate-zoom-neon-ripple ${
              hasActiveCombatZone
                ? 'border-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.95)]'
                : 'border-cyan-300 shadow-[0_0_14px_rgba(0,240,255,0.95)]'
            }`}
          />
        )}

        {/* Live Rotating Compass Rose SVG pointing toward True North */}
        <svg viewBox="0 0 32 32" className="relative z-10 w-7 h-7 shrink-0" aria-hidden="true">
          <circle
            cx="16"
            cy="16"
            r="13.5"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1.4"
          />
          <g transform={`rotate(${isHeadingUp ? -Math.round(userHeading) : 0} 16 16)`}>
            {/* True North crimson needle */}
            <polygon
              points="16,4.5 19.6,16 16,13.8 12.4,16"
              fill={isHeadingUp && isLight ? '#ffffff' : '#f43f5e'}
            />
            {/* South tail */}
            <polygon
              points="16,27.5 19.6,16 16,18.2 12.4,16"
              fill="currentColor"
              fillOpacity="0.5"
            />
            <circle cx="16" cy="16" r="1.8" fill="currentColor" />
          </g>
        </svg>

        <div className="relative z-10 flex flex-col items-start gap-1 leading-none font-mono">
          <div className="flex items-center gap-1.5 text-[10px] font-black tracking-wide">
            <span>COMPASS NORTH-UP</span>
            <span className="opacity-75">
              {String(Math.round(((userHeading % 360) + 360) % 360)).padStart(3, '0')}°
            </span>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider">
            <span
              className={`px-1.5 py-0.5 rounded transition-colors ${
                !isHeadingUp
                  ? isLight
                    ? 'bg-orange-500 text-white'
                    : 'bg-cyan-400 text-slate-950'
                  : 'opacity-60'
              }`}
            >
              North-Up
            </span>
            <span
              className={`px-1.5 py-0.5 rounded transition-colors ${
                isHeadingUp
                  ? isLight
                    ? 'bg-white text-orange-700'
                    : 'bg-cyan-400 text-slate-950'
                  : 'opacity-60'
              }`}
            >
              Heading-Up
            </span>
          </div>
        </div>
      </button>

      {/* Bottom-Right Floating 3D Perspective & Visual Style Switcher (Realista vs Tecnológico) */}
      <div
        className={`absolute ${
          isGoogleMapsActive ? 'bottom-9' : 'bottom-4'
        } right-3 z-30 flex flex-col items-end gap-1.5`}
      >
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* Style Switcher: Realista (Satellite/Photorealistic) vs Tecnológico (Cyber/Vector) */}
          <div
            className={`inline-flex p-0.5 rounded-xl border backdrop-blur-md shadow-lg ${
              isLight
                ? 'bg-white/95 border-slate-300 text-slate-800'
                : 'bg-slate-900/95 border-cyan-500/40 text-slate-200'
            }`}
            role="group"
            aria-label="Estilo visual do mapa"
          >
            <button
              type="button"
              onClick={() => handleSelectStyleMode('realistic')}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
                mapStyleMode === 'realistic'
                  ? isLight
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-emerald-400 text-slate-950'
                  : 'opacity-75 hover:opacity-100'
              }`}
              title="Mapa Realista com satélite, ruas e edifícios 3D"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Realista</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectStyleMode('tech')}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
                mapStyleMode === 'tech'
                  ? isLight
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-cyan-400 text-slate-950'
                  : 'opacity-75 hover:opacity-100'
              }`}
              title="Mapa Tecnológico estilo Google Maps Vector + Grid Tático"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tecnológico</span>
            </button>
          </div>

          {/* 3D / 2D Perspective Toggle + Pitch Angle Cycler */}
          <div
            className={`inline-flex items-center p-0.5 rounded-xl border backdrop-blur-md shadow-lg ${
              isLight
                ? 'bg-white/95 border-slate-300 text-slate-800'
                : 'bg-slate-900/95 border-cyan-500/40 text-slate-200'
            }`}
            role="group"
            aria-label="Alternar visualização 3D e inclinação"
          >
            <button
              type="button"
              onClick={handleToggle3D}
              aria-pressed={is3DView}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-mono font-black flex items-center gap-1 transition cursor-pointer ${
                is3DView
                  ? isLight
                    ? 'bg-orange-500 text-white'
                    : 'bg-cyan-400 text-slate-950'
                  : 'opacity-80 hover:opacity-100'
              }`}
              title={is3DView ? 'Voltar para visão plana 2D' : 'Ativar visualização em 3D'}
            >
              <Box className="w-3.5 h-3.5" />
              <span>{is3DView ? '3D' : '2D'}</span>
            </button>
            {is3DView && (
              <button
                type="button"
                onClick={handleCyclePitch}
                className={`min-h-[34px] px-2 py-1 rounded-lg text-[10px] font-mono font-bold tabular-nums transition cursor-pointer ${
                  isLight
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-cyan-300 hover:bg-cyan-500/20'
                }`}
                title="Ajustar ângulo de inclinação 3D (48° / 58° / 66°)"
              >
                {tiltAngle}°
              </button>
            )}
          </div>

          {/* Optional Engine Switcher when a Google Maps API Key is configured */}
          {hasValidKey && (
            <button
              type="button"
              onClick={() => setUseGoogleMaps((prev) => !prev)}
              className={`min-h-[36px] px-2.5 py-1 rounded-xl border text-[11px] font-mono font-bold transition cursor-pointer backdrop-blur-md flex items-center gap-1 ${
                isLight
                  ? 'bg-white/95 border-slate-300 text-slate-700 hover:text-slate-950 shadow-sm'
                  : 'bg-slate-900/95 border-cyan-500/40 text-cyan-300 hover:text-white'
              }`}
              title="Alternar motor Google Maps / Mapa Local"
            >
              <CompassIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{useGoogleMaps ? 'Google' : 'Local'}</span>
            </button>
          )}
        </div>

        {/* Map Data Attribution (always visible for local imagery/streets) */}
        {!isGoogleMapsActive && (
          <div
            className={`px-2 py-0.5 rounded text-[9px] font-mono backdrop-blur-sm ${
              isLight ? 'bg-white/75 text-slate-600' : 'bg-slate-950/70 text-slate-400'
            }`}
          >
            {mapStyleMode === 'realistic'
              ? 'Satélite Esri · Rótulos CARTO · © OpenStreetMap'
              : 'Mapa Vetorial CARTO · © OpenStreetMap'}
          </div>
        )}
      </div>
    </div>
  );
};

