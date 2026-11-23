import {
  CommunityHudAnchor,
  CommunityOverlayStyle,
  CommunityPostMetrics,
  PathPoint,
  UserProfile,
  WorkoutStats,
} from '../types';
import { formatPace } from './geo';

export interface CommunityBackdropPreset {
  id: string;
  label: string;
  src: string;
}

export const COMMUNITY_BACKDROP_PRESETS: CommunityBackdropPreset[] = [
  {
    id: 'sunrise',
    label: 'Amanhecer no Parque',
    src: '/src/assets/images/community_run_sunrise_1795292097773.jpg',
  },
  {
    id: 'night',
    label: 'Avenida Noturna',
    src: '/src/assets/images/community_run_night_1795292097037.jpg',
  },
  {
    id: 'coastal',
    label: 'Orla Matinal',
    src: '/src/assets/images/community_run_coastal_1795292097148.jpg',
  },
];

// Realistic scenic urban loop fallback when sharing without recorded GPS coordinates
const DEFAULT_ROUTE_LINE: string[] = [
  '0.14,0.82',
  '0.22,0.74',
  '0.31,0.68',
  '0.36,0.56',
  '0.28,0.44',
  '0.26,0.30',
  '0.38,0.20',
  '0.54,0.18',
  '0.68,0.26',
  '0.78,0.38',
  '0.84,0.52',
  '0.76,0.66',
  '0.62,0.74',
  '0.48,0.78',
  '0.34,0.84',
];

export const ROUTE_PRESETS: Record<string, string[]> = {
  urbanLoop: DEFAULT_ROUTE_LINE,
  parkCircuit: [
    '0.12,0.76',
    '0.20,0.52',
    '0.32,0.34',
    '0.48,0.22',
    '0.66,0.28',
    '0.80,0.46',
    '0.86,0.64',
    '0.72,0.78',
    '0.52,0.82',
    '0.32,0.78',
  ],
  coastalSprint: [
    '0.10,0.72',
    '0.20,0.64',
    '0.30,0.58',
    '0.42,0.50',
    '0.54,0.42',
    '0.66,0.36',
    '0.78,0.28',
    '0.88,0.22',
  ],
};

/**
 * Downsamples & normalizes a GPS PathPoint[] array into <= 42 "x,y" strings in [0.08..0.92].
 */
export function normalizePathToRouteLine(path?: PathPoint[], maxPoints = 40): string[] {
  if (!path || path.length < 2) {
    return DEFAULT_ROUTE_LINE;
  }

  const lats = path.map((p) => p.lat);
  const lngs = path.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  if (latSpan < 0.00001 && lngSpan < 0.00001) {
    return DEFAULT_ROUTE_LINE;
  }

  const maxSpan = Math.max(latSpan, lngSpan);
  const padX = (maxSpan - lngSpan) / 2;
  const padY = (maxSpan - latSpan) / 2;

  const step = Math.max(1, Math.ceil(path.length / maxPoints));
  const sampled: PathPoint[] = [];
  for (let i = 0; i < path.length; i += step) {
    sampled.push(path[i]);
  }
  const last = path[path.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }

  return sampled.slice(0, maxPoints).map((pt) => {
    const nx = 0.08 + ((pt.lng - minLng + padX) / maxSpan) * 0.84;
    const ny = 0.08 + (1 - (pt.lat - minLat + padY) / maxSpan) * 0.84;
    return `${nx.toFixed(3)},${ny.toFixed(3)}`;
  });
}

export function parseRouteLinePoints(routeLine?: string[]): { x: number; y: number }[] {
  const source = routeLine && routeLine.length >= 2 ? routeLine : DEFAULT_ROUTE_LINE;
  const parsed: { x: number; y: number }[] = [];
  for (const entry of source) {
    const [xs, ys] = entry.split(',');
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      parsed.push({
        x: Math.min(0.96, Math.max(0.04, x)),
        y: Math.min(0.96, Math.max(0.04, y)),
      });
    }
  }
  return parsed.length >= 2 ? parsed : parseRouteLinePoints(DEFAULT_ROUTE_LINE);
}

/**
 * Computes Quilometragem, Pace/km, Km mais rápido, Velocidade média em km/h, and routeLine
 * from an actual WorkoutStats record or falls back cleanly to profile statistics.
 */
export function buildMetricsFromWorkout(
  stats?: WorkoutStats | null,
  profile?: UserProfile
): CommunityPostMetrics {
  if (stats) {
    const distanceKm = Number(Math.max(0.1, stats.totalDistanceMeters / 1000).toFixed(2));
    const avgPaceMinKm = Number(
      Math.min(20, Math.max(2.5, stats.avgPaceMinKm || 5.4)).toFixed(2)
    );
    const splitPaces = (stats.splits || [])
      .map((s) => s.paceMinKm)
      .filter((p) => typeof p === 'number' && p >= 2.0 && p <= 20);

    const fastestFromSpeed =
      stats.maxSpeedKmh && stats.maxSpeedKmh > 4 ? 60 / stats.maxSpeedKmh : avgPaceMinKm * 0.88;

    const fastestKmPaceMinKm = Number(
      Math.min(
        avgPaceMinKm,
        Math.max(2.3, splitPaces.length > 0 ? Math.min(...splitPaces) : fastestFromSpeed)
      ).toFixed(2)
    );

    const avgSpeedKmh =
      stats.durationSeconds > 10
        ? Number(((distanceKm / stats.durationSeconds) * 3600).toFixed(1))
        : Number((60 / avgPaceMinKm).toFixed(1));

    return {
      distanceKm,
      avgPaceMinKm,
      fastestKmPaceMinKm,
      avgSpeedKmh: Math.min(45, Math.max(2, avgSpeedKmh)),
      durationSeconds: Math.max(60, Math.round(stats.durationSeconds || distanceKm * avgPaceMinKm * 60)),
      xpGained: Math.max(0, Math.round(stats.xpGained || 120)),
      achievementTitle: (stats.workoutTitle || stats.sectorConquered || 'Treino Concluído').slice(0, 88),
      routeLine: normalizePathToRouteLine(stats.path),
    };
  }

  // Fallback using latest history workout or athlete profile summary
  const latest = profile?.history?.[0];
  if (latest) {
    return buildMetricsFromWorkout(latest, profile);
  }

  const dist = Number(Math.max(3.2, Math.min(21.1, profile?.totalDistanceKm || 5.42)).toFixed(2));
  const pace = 5.18;
  const fastest = 4.46;
  const avgSpeed = Number((60 / pace).toFixed(1));

  return {
    distanceKm: dist,
    avgPaceMinKm: pace,
    fastestKmPaceMinKm: fastest,
    avgSpeedKmh: avgSpeed,
    durationSeconds: Math.round(dist * pace * 60),
    xpGained: Math.max(150, Math.min(950, profile?.xp || 250)),
    achievementTitle: `Nível ${profile?.level || 1} • Conquista RUN360X`,
    routeLine: DEFAULT_ROUTE_LINE,
  };
}

/**
 * Compresses an HTMLVideoElement or HTMLImageElement into a bounded JPEG data URL (<= 210KB)
 * safe for Firestore storage (strictly under the 260,000 char blueprint/rule limit).
 */
export function compressSourceToDataUrl(
  source: HTMLVideoElement | HTMLImageElement,
  targetWidth = 600,
  targetHeight = 800,
  mirrorHorizontal = false
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;

  if (!srcW || !srcH) return '';

  // Center-crop to 3:4 aspect ratio
  const targetRatio = targetWidth / targetHeight;
  const srcRatio = srcW / srcH;

  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (srcRatio > targetRatio) {
    sw = srcH * targetRatio;
    sx = (srcW - sw) / 2;
  } else {
    sh = srcW / targetRatio;
    sy = (srcH - sh) / 2;
  }

  ctx.save();
  if (mirrorHorizontal) {
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
  ctx.restore();

  let quality = 0.74;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 220000 && quality > 0.35) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

/**
 * Renders a crisp 1080x1440 downloadable PNG combining the photo + floating telemetry HUD +
 * mini route map line + short vibrant text.
 */
export async function renderCompositeSharePng(params: {
  photoSrc: string;
  metrics: CommunityPostMetrics;
  vibrantText: string;
  authorName: string;
  overlayStyle: CommunityOverlayStyle;
  hudAnchor: CommunityHudAnchor;
}): Promise<string> {
  const W = 1080;
  const H = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Load image safely
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = params.photoSrc;
  });

  if (img && img.naturalWidth > 0) {
    const targetRatio = W / H;
    const srcRatio = img.naturalWidth / img.naturalHeight;
    let sx = 0;
    let sy = 0;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (srcRatio > targetRatio) {
      sw = img.naturalHeight * targetRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / targetRatio;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#071324');
    grad.addColorStop(1, '#111827');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Palette per overlayStyle
  const accentMap: Record<CommunityOverlayStyle, { accent: string; secondary: string; cardBg: string }> = {
    neon: { accent: '#00f0ff', secondary: '#38bdf8', cardBg: 'rgba(6, 12, 24, 0.72)' },
    solar: { accent: '#fb923c', secondary: '#facc15', cardBg: 'rgba(20, 10, 6, 0.72)' },
    emerald: { accent: '#34d399', secondary: '#2dd4bf', cardBg: 'rgba(5, 20, 16, 0.72)' },
    crystal: { accent: '#ffffff', secondary: '#e2e8f0', cardBg: 'rgba(15, 23, 42, 0.56)' },
  };
  const palette = accentMap[params.overlayStyle];

  // Subtle top & bottom contrast scrim
  const topScrim = ctx.createLinearGradient(0, 0, 0, 260);
  topScrim.addColorStop(0, 'rgba(0,0,0,0.68)');
  topScrim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, W, 260);

  const bottomScrim = ctx.createLinearGradient(0, H - 560, 0, H);
  bottomScrim.addColorStop(0, 'rgba(0,0,0,0)');
  bottomScrim.addColorStop(1, 'rgba(0,0,0,0.84)');
  ctx.fillStyle = bottomScrim;
  ctx.fillRect(0, H - 560, W, 560);

  // Brand watermark header
  ctx.fillStyle = palette.accent;
  ctx.font = '900 34px sans-serif';
  ctx.fillText('RUN360X', 54, 86);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 22px monospace';
  ctx.fillText(`${params.authorName.toUpperCase()}  ·  ${params.metrics.achievementTitle.slice(0, 34)}`, 54, 122);

  // Floating HUD block Y position
  const hudH = 440;
  const hudY =
    params.hudAnchor === 'top' ? 170 : params.hudAnchor === 'center' ? (H - hudH) / 2 : H - hudH - 64;
  const hudX = 52;
  const hudW = W - 104;

  // Draw floating translucent telemetry panel
  ctx.save();
  ctx.fillStyle = palette.cardBg;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, hudH, 34);
  ctx.fill();
  ctx.stroke();

  // Vibrant short text banner inside/above metrics
  const textToRender = (params.vibrantText || '').trim();
  let contentTop = hudY + 46;
  if (textToRender) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px sans-serif';
    ctx.fillText(textToRender.slice(0, 36), hudX + 38, hudY + 72);
    contentTop = hudY + 114;
  }

  // Left side: 2x2 Metrics Grid (64% width)
  const leftW = Math.round(hudW * 0.62);
  const colW = leftW / 2;
  const rowH = 132;
  const items = [
    { label: 'QUILOMETRAGEM', val: `${params.metrics.distanceKm.toFixed(2)} km`, color: palette.accent },
    { label: 'PACE MÉDIO', val: `${formatPace(params.metrics.avgPaceMinKm)} /km`, color: '#ffffff' },
    { label: 'KM MAIS RÁPIDO', val: `${formatPace(params.metrics.fastestKmPaceMinKm)} /km`, color: palette.secondary },
    { label: 'VELOCIDADE MÉDIA', val: `${params.metrics.avgSpeedKmh.toFixed(1)} km/h`, color: '#ffffff' },
  ];

  items.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const ix = hudX + 38 + col * colW;
    const iy = contentTop + 26 + row * rowH;

    ctx.fillStyle = 'rgba(226,232,240,0.75)';
    ctx.font = '700 18px monospace';
    ctx.fillText(item.label, ix, iy);

    ctx.fillStyle = item.color;
    ctx.font = '900 44px monospace';
    ctx.fillText(item.val, ix, iy + 54);
  });

  // Right side: Mini Route Map Line Box
  const mapX = hudX + leftW + 26;
  const mapY = contentTop + 6;
  const mapW = hudW - leftW - 64;
  const mapH = 264;

  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapW, mapH, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(226,232,240,0.75)';
  ctx.font = '700 16px monospace';
  ctx.fillText('TRAJETO GPS', mapX + 18, mapY + 32);

  const pts = parseRouteLinePoints(params.metrics.routeLine);
  const innerPad = 28;
  const plotW = mapW - innerPad * 2;
  const plotH = mapH - innerPad * 2 - 22;
  const plotY0 = mapY + 34 + innerPad / 2;

  ctx.save();
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((pt, idx) => {
    const px = mapX + innerPad + pt.x * plotW;
    const py = plotY0 + pt.y * plotH;
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Start & finish pins
  const start = pts[0];
  const end = pts[pts.length - 1];
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#34d399';
  ctx.beginPath();
  ctx.arc(mapX + innerPad + start.x * plotW, plotY0 + start.y * plotH, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(mapX + innerPad + end.x * plotW, plotY0 + end.y * plotH, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  return canvas.toDataURL('image/png');
}
