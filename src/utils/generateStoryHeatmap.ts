import { WorkoutStats, TrainingLevel, PathPoint } from '../types';
import { formatPace, formatTime } from './geo';

export interface StoryGenerationOptions {
  stylePreset?: 'neon' | 'sunset' | 'stealth';
  width?: number;
  height?: number;
}

/**
 * Utility function to dynamically generate a 1080x1920 Instagram Story image
 * featuring the GPS heatmap route of the run and core workout statistics.
 */
export function generateStoryHeatmapCanvas(
  stats: WorkoutStats,
  level: TrainingLevel,
  options: StoryGenerationOptions = {}
): HTMLCanvasElement {
  const W = options.width || 1080;
  const H = options.height || 1920;
  const preset = options.stylePreset || 'neon';

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  if (preset === 'neon') {
    bgGrad.addColorStop(0, '#040711');
    bgGrad.addColorStop(0.35, '#071026');
    bgGrad.addColorStop(1, '#050314');
  } else if (preset === 'sunset') {
    bgGrad.addColorStop(0, '#13041a');
    bgGrad.addColorStop(0.35, '#280727');
    bgGrad.addColorStop(1, '#0f0217');
  } else {
    bgGrad.addColorStop(0, '#000000');
    bgGrad.addColorStop(0.35, '#0c0c0e');
    bgGrad.addColorStop(1, '#18181b');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Decorative Radial Glow
  ctx.save();
  const topGlow = ctx.createRadialGradient(W / 2, 350, 20, W / 2, 350, 450);
  if (preset === 'neon') {
    topGlow.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
    topGlow.addColorStop(1, 'rgba(0, 240, 255, 0)');
  } else if (preset === 'sunset') {
    topGlow.addColorStop(0, 'rgba(255, 0, 128, 0.35)');
    topGlow.addColorStop(1, 'rgba(255, 0, 128, 0)');
  } else {
    topGlow.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
    topGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
  }
  ctx.fillStyle = topGlow;
  ctx.beginPath();
  ctx.arc(W / 2, 350, 450, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Header Branding
  ctx.textAlign = 'center';
  ctx.fillStyle = preset === 'neon' ? '#00f0ff' : preset === 'sunset' ? '#ff007f' : '#f59e0b';
  ctx.font = '900 48px sans-serif';
  ctx.fillText('RUNLEVEL', W / 2, 140);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('GPS HEATMAP • INSTAGRAM STORY', W / 2, 185);

  // 3. Level Banner Box
  const bannerY = 230;
  const bannerH = 180;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = preset === 'neon' ? '#00f0ff' : preset === 'sunset' ? '#ff007f' : '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(80, bannerY, W - 160, bannerH, 24);
  ctx.fill();
  ctx.stroke();

  const levelNum = level.levelNumber || 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 64px sans-serif';
  ctx.fillText(`NÍVEL ${levelNum}`, W / 2, bannerY + 80);

  ctx.fillStyle = preset === 'neon' ? '#38bdf8' : preset === 'sunset' ? '#f472b6' : '#fbbf24';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(`PATENTE: ${level.title.toUpperCase()}`, W / 2, bannerY + 130);

  // 4. GPS HEATMAP ROUTE BOX
  const mapY = 440;
  const mapH = 680;
  const mapW = W - 160;
  const mapX = 80;

  ctx.fillStyle = 'rgba(10, 15, 30, 0.95)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapW, mapH, 28);
  ctx.fill();
  ctx.stroke();

  // Map Box Header Tag
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('MAPA DE CALOR DA ROTA (VELOCIDADE / RITMO)', mapX + 30, mapY + 40);

  // Draw Heatmap Path inside Map Box
  const fallbackPath: PathPoint[] = [
    { lat: -23.5505, lng: -46.6333, timestamp: 0, speedKmh: 10, paceMinKm: 6.0, phase: 'jog' },
    { lat: -23.5515, lng: -46.6323, timestamp: 10, speedKmh: 12, paceMinKm: 5.0, phase: 'jog' },
    { lat: -23.5525, lng: -46.6343, timestamp: 20, speedKmh: 15, paceMinKm: 4.0, phase: 'sprint' },
    { lat: -23.5535, lng: -46.6313, timestamp: 30, speedKmh: 11, paceMinKm: 5.5, phase: 'jog' },
    { lat: -23.5545, lng: -46.6353, timestamp: 40, speedKmh: 14, paceMinKm: 4.2, phase: 'sprint' },
  ];

  const path: PathPoint[] = stats.path && stats.path.length > 1 ? stats.path : fallbackPath;

  // Calculate GPS Bounding Box
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  path.forEach((pt) => {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  });

  const latRange = Math.max(0.001, maxLat - minLat);
  const lngRange = Math.max(0.001, maxLng - minLng);

  const innerPadding = 80;
  const drawW = mapW - innerPadding * 2;
  const drawH = mapH - innerPadding * 2 - 40;
  const startX = mapX + innerPadding;
  const startY = mapY + mapH - innerPadding;

  // Convert lat/lng to Canvas X/Y
  const projectPoint = (pt: PathPoint) => {
    const xRatio = (pt.lng - minLng) / lngRange;
    const yRatio = (pt.lat - minLat) / latRange;
    const x = startX + xRatio * drawW;
    const y = startY - yRatio * drawH; // Invert Y for canvas
    return { x, y };
  };

  // Draw Outer Glow for Heatmap Path
  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = preset === 'neon' ? '#00f0ff' : preset === 'sunset' ? '#ff007f' : '#f59e0b';

  // Draw Heatmap Line Segments with Dynamic Speed Colors
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = projectPoint(path[i]);
    const p2 = projectPoint(path[i + 1]);

    const speed = path[i].speedKmh || 11;
    let segColor = '#00f0ff'; // Moderate
    if (speed >= 14) segColor = '#10b981'; // Fast / High speed (Green)
    else if (speed >= 10) segColor = '#38bdf8'; // Good pace (Cyan)
    else segColor = '#f59e0b'; // Slow / Uphill (Orange)

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = segColor;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();

  // Draw Start & Finish Dots
  if (path.length > 0) {
    const startPt = projectPoint(path[0]);
    const endPt = projectPoint(path[path.length - 1]);

    // Start Dot (Green)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(startPt.x, startPt.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(startPt.x, startPt.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Finish Dot (Neon Cyan or Pink)
    ctx.fillStyle = preset === 'neon' ? '#00f0ff' : '#ff007f';
    ctx.beginPath();
    ctx.arc(endPt.x, endPt.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(endPt.x, endPt.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heatmap Legend (Bottom of Map Box)
  const legendY = mapY + mapH - 35;
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px monospace';

  ctx.fillStyle = '#10b981';
  ctx.fillText('■ Sprint / Ritmo Forte', mapX + 150, legendY);

  ctx.fillStyle = '#38bdf8';
  ctx.fillText('■ Pace Sustentado', mapX + mapW / 2, legendY);

  ctx.fillStyle = '#f59e0b';
  ctx.fillText('■ Subida / Recuperação', mapX + mapW - 170, legendY);

  // 5. STATS SUMMARY BOX (BOTTOM HALF)
  const statsY = 1150;
  const statsH = 500;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(mapX, statsY, mapW, statsH, 28);
  ctx.fill();
  ctx.stroke();

  // Stat 1: Distance
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('DISTÂNCIA TOTAL', mapX + 50, statsY + 70);

  ctx.fillStyle = preset === 'neon' ? '#00f0ff' : '#ff007f';
  ctx.font = '900 80px monospace';
  ctx.fillText(`${(stats.totalDistanceMeters / 1000).toFixed(2)}`, mapX + 50, statsY + 150);
  ctx.font = '700 36px monospace';
  ctx.fillText('KM', mapX + 340, statsY + 150);

  // Stat 2: Pace
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('PACE MÉDIO', mapX + 500, statsY + 70);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 80px monospace';
  ctx.fillText(formatPace(stats.avgPaceMinKm), mapX + 500, statsY + 150);
  ctx.font = '700 30px monospace';
  ctx.fillText('/KM', mapX + 780, statsY + 150);

  // Separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(mapX + 50, statsY + 210);
  ctx.lineTo(mapX + mapW - 50, statsY + 210);
  ctx.stroke();

  // Stat 3: XP Gained
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('XP CONQUISTADO', mapX + 50, statsY + 270);

  ctx.fillStyle = '#10b981';
  ctx.font = '900 68px monospace';
  ctx.fillText(`+${stats.xpGained} XP`, mapX + 50, statsY + 340);

  // Stat 4: Duration
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('TEMPO DE TREINO', mapX + 500, statsY + 270);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 68px monospace';
  ctx.fillText(formatTime(stats.durationSeconds), mapX + 500, statsY + 340);

  // Bottom Conquered Sector Tag
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(`🏆 SETOR REGIONAL: SPRINT CONQUISTADO`, mapX + 50, statsY + 440);

  // 6. FOOTER BRANDING & HASHTAGS
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 34px sans-serif';
  ctx.fillText('DESAFIE SEUS LIMITES NO RUNLEVEL', W / 2, 1720);

  ctx.fillStyle = preset === 'neon' ? '#00f0ff' : '#ff007f';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('@RUNLEVEL • RUNLEVEL.APP', W / 2, 1765);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('#RunLevel #Heatmap #LevelUp #Corrida #Pace', W / 2, 1810);

  return canvas;
}

/**
 * Utility function to generate Data URL (PNG) of the 1080x1920 Story Heatmap.
 */
export function generateStoryHeatmapDataUrl(
  stats: WorkoutStats,
  level: TrainingLevel,
  options: StoryGenerationOptions = {}
): string {
  const canvas = generateStoryHeatmapCanvas(stats, level, options);
  return canvas.toDataURL('image/png');
}
