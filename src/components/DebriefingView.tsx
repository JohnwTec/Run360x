import React, { useRef, useEffect, useState } from 'react';
import { Trophy, Share2, Download, Zap, Flame, Shield, ArrowLeft, CheckCircle, Calendar, Clock, MapPin, Activity, X, Sparkles, Instagram, Camera } from 'lucide-react';
import confetti from 'canvas-confetti';
import { WorkoutStats, TrainingLevel, LevelUpEvent } from '../types';
import { formatPace, formatTime } from '../utils/geo';
import { tacticalAudio } from '../utils/audio';
import { ConqueredSegmentsView } from './ConqueredSegmentsView';
import { HistoricalComparisonCard } from './HistoricalComparisonCard';
import { LevelUpCelebrationModal } from './LevelUpCelebrationModal';
import { InstagramShareModal } from './InstagramShareModal';
import { SocialShareModal, SocialSharePayload } from './SocialShareModal';

interface DebriefingViewProps {
  stats: WorkoutStats;
  level: TrainingLevel;
  levelUpEvent?: LevelUpEvent | null;
  athleteName?: string;
  onClose: () => void;
  onShareToCommunityCamera?: (stats: WorkoutStats) => void;
  theme?: 'dark' | 'light';
}

export const DebriefingView: React.FC<DebriefingViewProps> = ({
  stats,
  level,
  levelUpEvent,
  athleteName,
  onClose,
  onShareToCommunityCamera,
  theme = 'dark',
}) => {
  const cardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isLight = theme === 'light';
  const [borgPse, setBorgPse] = useState<number>(6);
  const [cardStyle, setCardStyle] = useState<'cyberpunk' | 'synthwave' | 'stealth'>('cyberpunk');
  const [showCardModal, setShowCardModal] = useState<boolean>(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState<boolean>(false);
  const [showInstagramModal, setShowInstagramModal] = useState<boolean>(false);
  const [showSocialShareModal, setShowSocialShareModal] = useState<boolean>(false);

  const workoutSharePayload: SocialSharePayload = {
    kind: 'workout',
    badge: `MISSÃO CONCLUÍDA • NÍVEL ${level.levelNumber}`,
    title: level.codename,
    subtitle: `Setor Dominado: ${stats.sectorConquered || 'Circuito Urbano'} • ${stats.date}`,
    metrics: [
      { label: 'Distância', value: `${(stats.totalDistanceMeters / 1000).toFixed(2)} km` },
      { label: 'Pace Médio', value: `${formatPace(stats.avgPaceMinKm)}` },
      { label: 'Tempo Total', value: formatTime(stats.durationSeconds) },
      { label: 'XP Conquistado', value: `+${stats.xpGained} XP` },
    ],
    defaultCaption:
      `🏃‍♂️ Missão concluída no RUN360X! ⚡\n` +
      `🎯 ${level.codename} (${stats.sectorConquered || 'Setor Urbano'})\n` +
      `📏 Distância: ${(stats.totalDistanceMeters / 1000).toFixed(2)} km\n` +
      `⏱️ Pace Médio: ${formatPace(stats.avgPaceMinKm)} /km • Tempo: ${formatTime(stats.durationSeconds)}\n` +
      `🏆 +${stats.xpGained} XP conquistados!\n\n` +
      `#RUN360X #Corrida #Running #Pace #TreinoConcluido`,
  };

  const didLevelUp = Boolean(levelUpEvent && levelUpEvent.newLevel > levelUpEvent.previousLevel);

  // Trigger victory fanfare and automatically launch triumphant Level Up animation when a new experience level is reached
  useEffect(() => {
    tacticalAudio.playGhostOvertakeSound();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00f0ff', '#ff0055', '#38bdf8', '#ffaa00'],
    });

    if (didLevelUp) {
      const timer = window.setTimeout(() => {
        setShowLevelUpModal(true);
      }, 550);
      return () => window.clearTimeout(timer);
    } else {
      tacticalAudio.speakTacticalCoach(
        `Missão concluída com sucesso! Você percorreu ${(stats.totalDistanceMeters / 1000).toFixed(
          1
        )} quilômetros e acumulou ${stats.xpGained} pontos de experiência.`
      );
    }
  }, [stats, didLevelUp]);

  // Simulated splits for table display
  const totalKm = Math.max(1, Math.floor(stats.totalDistanceMeters / 1000));
  const splits = Array.from({ length: totalKm }, (_, idx) => ({
    km: idx + 1,
    pace: (stats.avgPaceMinKm + (idx % 2 === 0 ? -0.15 : 0.12)).toFixed(2),
    elevGain: Math.round(3 + (idx * 2)),
    heartRate: Math.round(152 + (idx * 3)),
  }));

  // Render Instagram Share Card onto Canvas
  useEffect(() => {
    const canvas = cardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = (canvas.width = 600);
    const H = (canvas.height = 750);

    // Background Dark/Light Cyberpunk Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (isLight) {
      bgGrad.addColorStop(0, '#ffffff');
      bgGrad.addColorStop(0.5, '#f8fafc');
      bgGrad.addColorStop(1, '#f1f5f9');
    } else {
      bgGrad.addColorStop(0, '#090e18');
      bgGrad.addColorStop(0.5, '#050810');
      bgGrad.addColorStop(1, '#0c051a');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Top Accent Border
    ctx.fillStyle = isLight ? '#f97316' : '#00f0ff';
    ctx.fillRect(0, 0, W, 8);

    // Header Title
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.font = '900 28px sans-serif';
    ctx.fillText('RUNLEVEL', 40, 55);

    ctx.fillStyle = isLight ? '#f97316' : '#00f0ff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('REGISTRO OFICIAL DE TREINO • MISSÃO DIÁRIA', 40, 75);

    // Date & Time badge
    ctx.fillStyle = isLight ? '#f1f5f9' : '#1e293b';
    ctx.strokeStyle = isLight ? '#cbd5e1' : '#00f0ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(40, 92, 320, 32, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isLight ? '#334155' : '#38bdf8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`📅 ${stats.date || '22 de Julho de 2026, 16:27'}`, 52, 113);

    // Main Metrics Matrix Box
    ctx.fillStyle = isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = isLight ? '#e2e8f0' : 'rgba(0, 240, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(40, 140, W - 80, 150, 16);
    ctx.fill();
    ctx.stroke();

    // Metric 1: Distance
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText('DISTÂNCIA', 65, 170);
    ctx.fillStyle = isLight ? '#ea580c' : '#00f0ff';
    ctx.font = '900 36px monospace';
    ctx.fillText(`${(stats.totalDistanceMeters / 1000).toFixed(2)}`, 65, 210);
    ctx.font = '16px monospace';
    ctx.fillText('KM', 185, 210);

    // Metric 2: Pace
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText('PACE MÉDIO', 320, 170);
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.font = '900 36px monospace';
    ctx.fillText(formatPace(stats.avgPaceMinKm), 320, 210);

    // Metric 3: Time
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText('TEMPO TOTAL', 65, 250);
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.font = '700 20px monospace';
    ctx.fillText(formatTime(stats.durationSeconds), 65, 275);

    // Metric 4: Max Speed
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText('VELOCIDADE MÁXIMA', 320, 250);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 20px monospace';
    ctx.fillText(`${stats.maxSpeedKmh.toFixed(1)} km/h`, 320, 275);

    // Route Heatmap Box
    const mapY = 310;
    const mapH = 210;
    ctx.fillStyle = isLight ? '#f8fafc' : '#070b12';
    ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(0, 240, 255, 0.3)';
    ctx.beginPath();
    ctx.roundRect(40, mapY, W - 80, mapH, 16);
    ctx.fill();
    ctx.stroke();

    // Draw Heatmap Path
    // Draw Glowing Speed Heatmap Path
    if (stats.path.length > 1) {
      const minLat = Math.min(...stats.path.map((p) => p.lat));
      const maxLat = Math.max(...stats.path.map((p) => p.lat));
      const minLng = Math.min(...stats.path.map((p) => p.lng));
      const maxLng = Math.max(...stats.path.map((p) => p.lng));

      const latSpan = Math.max(0.0001, maxLat - minLat);
      const lngSpan = Math.max(0.0001, maxLng - minLng);

      const mapPadding = 35;
      const mapBoxW = W - 80 - mapPadding * 2;
      const mapBoxH = mapH - mapPadding * 2;

      ctx.save();
      for (let i = 1; i < stats.path.length; i++) {
        const p1 = stats.path[i - 1];
        const p2 = stats.path[i];

        const x1 = 40 + mapPadding + ((p1.lng - minLng) / lngSpan) * mapBoxW;
        const y1 = mapY + mapH - mapPadding - ((p1.lat - minLat) / latSpan) * mapBoxH;
        const x2 = 40 + mapPadding + ((p2.lng - minLng) / lngSpan) * mapBoxW;
        const y2 = mapY + mapH - mapPadding - ((p2.lat - minLat) / latSpan) * mapBoxH;

        const speed = p2.speedKmh || 8;
        let strokeColor = '#10b981';
        let glowColor = 'rgba(16, 185, 129, 0.5)';
        let alpha = 0.7;
        let lineWidth = 3;

        if (speed >= 11.5) {
          strokeColor = '#ff2e00'; // Hot Red/Orange Sprint
          glowColor = 'rgba(255, 46, 0, 0.85)';
          alpha = 1.0;
          lineWidth = 6;
        } else if (speed >= 8.5) {
          strokeColor = '#00f0ff'; // Cyan Cruise
          glowColor = 'rgba(0, 240, 255, 0.7)';
          alpha = 0.85;
          lineWidth = 4.5;
        }

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = speed >= 11.5 ? 12 : 6;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.fillStyle = isLight ? '#0f172a' : '#00f0ff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('MAPA DE CALOR • VELOCIDADE & BRILHO DO TRAJETO', 55, mapY + 24);

    // RPG Attributes Row
    const statsY = 540;
    ctx.fillStyle = isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = isLight ? '#e2e8f0' : 'rgba(168, 85, 247, 0.3)';
    ctx.beginPath();
    ctx.roundRect(40, statsY, W - 80, 110, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isLight ? '#7c3aed' : '#c084fc';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('MÉTRICAS DE DESEMPENHO', 60, statsY + 28);

    const drawStatBar = (label: string, val: number, color: string, yPos: number) => {
      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText(label, 60, yPos);

      ctx.fillStyle = isLight ? '#e2e8f0' : '#1e293b';
      ctx.fillRect(150, yPos - 10, 300, 10);

      ctx.fillStyle = color;
      ctx.fillRect(150, yPos - 10, (val / 100) * 300, 10);

      ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${val}/100`, 465, yPos);
    };

    drawStatBar('FORÇA', stats.strengthScore, '#ef4444', statsY + 50);
    drawStatBar('VELOCIDADE', stats.speedScore, '#f59e0b', statsY + 70);
    drawStatBar('AGILIDADE', stats.agilityScore, '#10b981', statsY + 90);

    // Footer XP & Sector Banner
    ctx.fillStyle = isLight ? '#fff7ed' : '#1e1b4b';
    ctx.strokeStyle = isLight ? '#fdba74' : '#6366f1';
    ctx.beginPath();
    ctx.roundRect(40, 665, W - 80, 50, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isLight ? '#c2410c' : '#a5b4fc';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`🏆 XP GANHO: +${stats.xpGained} XP  |  SETOR: ${stats.sectorConquered}`, 60, 695);
  }, [stats, level, isLight, cardStyle]);

  // Download Card image as PNG
  const handleDownloadCard = () => {
    const canvas = cardCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `RunLevel_Treino_${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      {/* Debriefing Banner */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 border shadow-lg transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-slate-900 border-cyan-500/40 text-white shadow-[0_0_50px_rgba(6,182,212,0.15)]'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`px-3 py-1 font-mono text-xs font-bold rounded-full uppercase tracking-wider ${
                  isLight ? 'bg-orange-100 text-orange-700' : 'bg-cyan-950 border border-cyan-500/40 text-cyan-400'
                }`}
              >
                REGISTRO DE TREINO CULMINADO
              </span>
              <span className={`text-xs font-mono flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                <Calendar className="w-3.5 h-3.5" />
                {stats.date}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wide">
              {level.codename}
            </h1>
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Setor Dominado: <strong className={isLight ? 'text-orange-600' : 'text-cyan-300'}>{stats.sectorConquered}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {didLevelUp && levelUpEvent && (
              <button
                type="button"
                onClick={() => setShowLevelUpModal(true)}
                className="px-3.5 py-2.5 rounded-xl text-xs font-black font-mono border bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 hover:opacity-95 text-slate-950 border-cyan-300 flex items-center gap-2 transition cursor-pointer shadow-[0_0_24px_rgba(6,182,212,0.5)]"
              >
                <Sparkles className="w-4 h-4" />
                <span>LEVEL UP · LVL {levelUpEvent.newLevel}!</span>
              </button>
            )}

            {onShareToCommunityCamera && (
              <button
                type="button"
                onClick={() => onShareToCommunityCamera(stats)}
                className="px-4 py-2.5 rounded-xl text-xs font-black font-mono border bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-95 text-slate-950 border-amber-300 flex items-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(251,146,60,0.4)]"
              >
                <Camera className="w-4 h-4" />
                <span>CÂMERA · COMUNIDADE</span>
              </button>
            )}

            <button
              onClick={() => setShowSocialShareModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-black font-mono border bg-gradient-to-r from-cyan-500 to-emerald-500 hover:opacity-95 text-slate-950 border-cyan-300 flex items-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            >
              <Share2 className="w-4 h-4" />
              <span>COMPARTILHAR REDES</span>
            </button>

            <button
              onClick={() => setShowInstagramModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-black font-mono border bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:opacity-95 text-white border-pink-400 flex items-center gap-2 transition cursor-pointer shadow-[0_0_20px_rgba(236,72,153,0.4)]"
            >
              <Instagram className="w-4 h-4 text-pink-200" />
              <span>INSTAGRAM STORIES</span>
            </button>

            <button
              onClick={() => setShowCardModal(true)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold font-mono border flex items-center gap-2 transition cursor-pointer shadow-md ${
                isLight
                  ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
                  : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/40'
              }`}
            >
              <Trophy className="w-4 h-4" /> 🎨 CARD HD
            </button>

            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono border flex items-center gap-2 transition cursor-pointer ${
                isLight
                  ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-800'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" /> SAIR
            </button>
          </div>
        </div>

        {/* Achievement Bullets with Neon Unlock Animation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div
            style={{ animationDelay: '100ms' }}
            className={`p-3.5 rounded-2xl flex items-center gap-3 border animate-neon-unlock badge-unlock-glow ${
              isLight ? 'bg-emerald-50 border-emerald-300 shadow-sm' : 'bg-slate-950/80 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            }`}
          >
            <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 animate-bounce" />
            <div>
              <span className={`text-[10px] font-mono uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Status Corredor Fantasma
              </span>
              <p className="text-xs font-black text-emerald-600 dark:text-emerald-300">
                {stats.ghostDefeated ? '🚀 DESBLOQUEADO: Fantasma Ultrapassado!' : '⚠️ Fantasma Manteve Liderança'}
              </p>
            </div>
          </div>

          <div
            style={{ animationDelay: '250ms' }}
            className={`p-3.5 rounded-2xl flex items-center gap-3 border animate-neon-unlock badge-unlock-glow ${
              isLight ? 'bg-amber-50 border-amber-300 shadow-sm' : 'bg-slate-950/80 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
            }`}
          >
            <Zap className="w-6 h-6 text-amber-500 shrink-0 animate-pulse" />
            <div>
              <span className={`text-[10px] font-mono uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Orbes & XP Coletados
              </span>
              <p className="text-xs font-black text-amber-600 dark:text-amber-300">
                +{stats.xpGained} XP ({stats.orbsCollectedCount} Orbes Coletadas)
              </p>
            </div>
          </div>

          <div
            style={{ animationDelay: '400ms' }}
            className={`p-3.5 rounded-2xl flex items-center gap-3 border animate-neon-unlock badge-unlock-glow ${
              isLight ? 'bg-orange-50 border-orange-300 shadow-sm' : 'bg-slate-950/80 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-neon-glow-pulse'
            }`}
          >
            <Trophy className={`w-6 h-6 shrink-0 ${isLight ? 'text-orange-600' : 'text-cyan-400'}`} />
            <div>
              <span className={`text-[10px] font-mono uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Ranking do Setor
              </span>
              <p className={`text-xs font-black ${isLight ? 'text-orange-700' : 'text-cyan-300'}`}>🏆 Top 3 Regional Conquistado!</p>
            </div>
          </div>
        </div>
      </div>

      {/* CARD DE COMPARATIVO DE PERFORMANCE ATUAL VS MÉDIA HISTÓRICA */}
      <HistoricalComparisonCard stats={stats} theme={theme} />

      {/* DETALHAMENTO DE SEGMENTOS CONQUISTADOS & GRÁFICO DE PACE vs ELEVAÇÃO */}
      <ConqueredSegmentsView stats={stats} theme={theme} />

      {/* MAPA DE CALOR DE VELOCIDADE & ANÁLISE INFORMATIVA DE DESEMPENHO */}
      <div
        className={`p-6 rounded-3xl border space-y-6 transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-slate-900 border-cyan-500/30 text-white shadow-[0_0_40px_rgba(6,182,212,0.1)]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                isLight ? 'bg-orange-100 text-orange-700' : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
              }`}>
                TELEMETRIA DE GPS & RITMO
              </span>
            </div>
            <h2 className="text-xl font-black uppercase tracking-wide mt-1 flex items-center gap-2">
              Mapa de Calor de Velocidade do Trajeto
              <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
            </h2>
            <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Opacidade e brilho variáveis destacam o nível de aceleração e potência empregados em cada trecho do percurso.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Escala de Calor:</span>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center gap-1">
                💥 Alta ({'>'}11.5 km/h)
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                ⚡ Cruzeiro (8.5-11.5)
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                🍃 Recuperação ({'<'}8.5)
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Heatmap SVG Canvas Representation */}
        <div className={`relative h-64 sm:h-72 w-full rounded-2xl border overflow-hidden flex items-center justify-center ${
          isLight ? 'bg-slate-900 border-slate-300' : 'bg-slate-950 border-slate-800'
        }`}>
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

          {/* SVG Heatmap Path */}
          {stats.path.length > 1 ? (
            <svg className="w-full h-full p-6" viewBox="0 0 500 250" preserveAspectRatio="xMidYMid meet">
              <defs>
                <filter id="glow-sprint" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-cruise" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Draw each line segment with velocity-based stroke & glow */}
              {(() => {
                const minLat = Math.min(...stats.path.map((p) => p.lat));
                const maxLat = Math.max(...stats.path.map((p) => p.lat));
                const minLng = Math.min(...stats.path.map((p) => p.lng));
                const maxLng = Math.max(...stats.path.map((p) => p.lng));

                const latSpan = Math.max(0.0001, maxLat - minLat);
                const lngSpan = Math.max(0.0001, maxLng - minLng);

                const mapW = 460;
                const mapH = 200;
                const offsetX = 20;
                const offsetY = 25;

                return stats.path.map((p2, idx) => {
                  if (idx === 0) return null;
                  const p1 = stats.path[idx - 1];

                  const x1 = offsetX + ((p1.lng - minLng) / lngSpan) * mapW;
                  const y1 = offsetY + mapH - ((p1.lat - minLat) / latSpan) * mapH;
                  const x2 = offsetX + ((p2.lng - minLng) / lngSpan) * mapW;
                  const y2 = offsetY + mapH - ((p2.lat - minLat) / latSpan) * mapH;

                  const speed = p2.speedKmh || 8;
                  let color = '#10b981';
                  let strokeWidth = 3;
                  let opacity = 0.6;
                  let filter = undefined;

                  if (speed >= 11.5) {
                    color = '#ff0055'; // High Intensity Neon Red/Pink
                    strokeWidth = 6;
                    opacity = 1.0;
                    filter = 'url(#glow-sprint)';
                  } else if (speed >= 8.5) {
                    color = '#00f0ff'; // Cruise Cyan
                    strokeWidth = 4;
                    opacity = 0.85;
                    filter = 'url(#glow-cruise)';
                  }

                  return (
                    <line
                      key={idx}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={strokeWidth}
                      strokeOpacity={opacity}
                      strokeLinecap="round"
                      filter={filter}
                    />
                  );
                });
              })()}
            </svg>
          ) : (
            <div className="text-center font-mono text-xs text-slate-500">
              [Dados insuficientes de GPS para renderização de Mapa de Calor]
            </div>
          )}

          {/* Live Floating Info Card on top of Map */}
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-slate-950/90 border border-slate-800 backdrop-blur-md p-3 rounded-xl font-mono text-xs space-y-1 text-slate-200 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <span className="text-cyan-400 font-bold uppercase text-[10px]">PICO DE VELOCIDADE:</span>
              <span className="text-rose-400 font-extrabold">{stats.maxSpeedKmh.toFixed(1)} km/h</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
              <span>Ritmo Médio Sustentado:</span>
              <span className="text-emerald-400 font-bold">{formatPace(stats.avgPaceMinKm)} min/km</span>
            </div>
          </div>
        </div>

        {/* INFORMATIVE DIAGNOSTICS: ONDE O TREINO FOI MELHOR vs ONDE MELHORAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
          {/* Best Performance Sector */}
          <div className={`p-4 rounded-2xl border space-y-2 ${
            isLight ? 'bg-emerald-50/60 border-emerald-200 text-slate-800' : 'bg-slate-950 border-emerald-500/30 text-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500 text-white font-black text-xs">
                🎯 MELHOR DESEMPENHO
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                Zona de Maior Eficiência
              </span>
            </div>
            <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-300">
              Pico de Explosão e Ritmo Sustentado (Trecho Intermediário)
            </h4>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              No setor entre <strong>KM 2.0 e KM 3.5</strong>, você alcançou a maior densidade de brilho no mapa de calor, mantendo velocidade média de <strong>{(stats.maxSpeedKmh * 0.9).toFixed(1)} km/h</strong> e cadência fluida.
            </p>
            <div className="pt-2 border-t border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <span>Eficiência Mecânica: 94%</span>
              <span>Cadência: ~176 PPM</span>
            </div>
          </div>

          {/* Area Needing Improvement */}
          <div className={`p-4 rounded-2xl border space-y-2 ${
            isLight ? 'bg-amber-50/60 border-amber-200 text-slate-800' : 'bg-slate-950 border-amber-500/30 text-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs">
                ⚠️ PONTO DE ATENÇÃO
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">
                Trecho com Queda de Velocidade
              </span>
            </div>
            <h4 className="text-sm font-black text-amber-600 dark:text-amber-400">
              Queda de Ritmo no Quilômetro Final (Fadiga / Aclive)
            </h4>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              No trecho final (últimos 800 metros), o mapa de calor transicionou para tom esmeralda, indicando desaceleração de <strong>~18%</strong> em relação ao pico do treino.
            </p>
            <div className="pt-2 border-t border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <span>Recomendação: Fortalecimento de Core</span>
              <span>Solução: Treino Intervalado</span>
            </div>
          </div>
        </div>

        {/* Speed Distribution Bars */}
        <div className={`p-4 rounded-2xl border space-y-3 font-mono ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <span className="text-xs font-bold uppercase text-slate-400 block">
            Distribuição do Tempo de Treino por Intensidade de Calor:
          </span>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-rose-500 font-bold">💥 Zona de Explosão / Sprint ({'>'}11.5 km/h)</span>
                <span className="font-bold">35% do tempo</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: '35%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-cyan-400 font-bold">⚡ Zona de Ritmo Cruzeiro (8.5 - 11.5 km/h)</span>
                <span className="font-bold">50% do tempo</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-cyan-400" style={{ width: '50%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-500 font-bold">🍃 Zona de Recuperação ({'<'}8.5 km/h)</span>
                <span className="font-bold">15% do tempo</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: '15%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Escala de Percepção do Esforço de Borg (PSE 1-10) */}
      <div
        className={`p-6 rounded-3xl border space-y-4 font-mono ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-500 uppercase block">MONITORAMENTO DE CARGA</span>
            <h3 className="text-sm font-bold uppercase tracking-wider">
              Percepção Subjetiva de Esforço (Escala de Borg 1-10)
            </h3>
          </div>
          <span className="text-lg font-black text-amber-500">{borgPse} / 10</span>
        </div>

        <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          Selecione a intensidade percebida pelo seu corpo nesta sessão:
        </p>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
            <button
              key={val}
              onClick={() => setBorgPse(val)}
              className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                borgPse === val
                  ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md font-extrabold scale-105'
                  : isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {val}
            </button>
          ))}
        </div>

        {borgPse >= 8 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-2xl text-xs text-amber-600 dark:text-amber-300 space-y-1">
            <p className="font-bold">⚠️ ALERTA DE MONITORAÇÃO DE CARGA (OVERTRAINING):</p>
            <p className="text-[11px] leading-relaxed">
              Você classificou este treino com esforço exaustivo ({borgPse}/10). Recomenda-se 24h a 48h de recuperação ativa ou regenerativo com hidratação reforçada.
            </p>
          </div>
        )}
      </div>

      {/* Km Splits Table (Marcações de Tempo e Distância) */}
      <div
        className={`p-6 rounded-3xl border ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        <h3 className="text-sm font-bold uppercase font-mono tracking-wider mb-4 flex items-center gap-2">
          <Activity className={`w-4 h-4 ${isLight ? 'text-orange-500' : 'text-cyan-400'}`} />
          Marcações de Tempo & Distância por Km (Splits)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className={`border-b ${isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
                <th className="py-2 px-3">Quilômetro</th>
                <th className="py-2 px-3">Pace Médio</th>
                <th className="py-2 px-3">Ganho de Elevação</th>
                <th className="py-2 px-3">Freq. Cardíaca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {splits.map((s) => (
                <tr key={s.km} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-950'}>
                  <td className="py-3 px-3 font-bold text-orange-600 dark:text-cyan-400">KM {s.km}</td>
                  <td className="py-3 px-3">{s.pace} min/km</td>
                  <td className="py-3 px-3">+{s.elevGain} m</td>
                  <td className="py-3 px-3">{s.heartRate} bpm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cyberpunk Instagram Share Card & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Canvas Preview Container */}
        <div
          className={`border rounded-3xl p-4 sm:p-6 flex flex-col items-center gap-4 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <h3 className={`text-sm font-bold uppercase font-mono tracking-wider flex items-center gap-2 ${
            isLight ? 'text-slate-800' : 'text-slate-300'
          }`}>
            <Share2 className={`w-4 h-4 ${isLight ? 'text-orange-500' : 'text-cyan-400'}`} /> Card de Compartilhamento Strava/Runna
          </h3>

          <div className={`w-full max-w-[360px] aspect-[4/5] overflow-hidden rounded-2xl border shadow-md ${
            isLight ? 'border-slate-200' : 'border-cyan-500/30'
          }`}>
            <canvas ref={cardCanvasRef} className="w-full h-full object-contain" />
          </div>

          <div className="space-y-2">
            <button
              onClick={handleDownloadCard}
              className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase font-mono flex items-center justify-center gap-2 transition shadow-md cursor-pointer ${
                isLight
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
              }`}
            >
              <Download className="w-4 h-4" /> BAIXAR CARD DE CONQUISTA (.PNG HD)
            </button>

            {onShareToCommunityCamera && (
              <button
                type="button"
                onClick={() => onShareToCommunityCamera(stats)}
                className="w-full py-3 rounded-xl text-xs font-black uppercase font-mono flex items-center justify-center gap-2 transition shadow-md cursor-pointer bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:opacity-95"
              >
                <Camera className="w-4 h-4" />
                <span>POSTAR NA COMUNIDADE COM CÂMERA AO VIVO</span>
              </button>
            )}

            <button
              onClick={() => setShowSocialShareModal(true)}
              className="w-full py-3 rounded-xl text-xs font-black uppercase font-mono flex items-center justify-center gap-2 transition shadow-md cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-slate-950"
            >
              <Share2 className="w-4 h-4" />
              <span>WHATSAPP, X, FACEBOOK, LINKEDIN & TELEGRAM</span>
            </button>

            <button
              onClick={() => setShowInstagramModal(true)}
              className="w-full py-3 rounded-xl text-xs font-black uppercase font-mono flex items-center justify-center gap-2 transition shadow-md cursor-pointer bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white hover:opacity-95 shadow-[0_0_20px_rgba(236,72,153,0.3)]"
            >
              <Instagram className="w-4 h-4 text-pink-200" />
              <span>COMPARTILHAR NO INSTAGRAM (STORIES 1080x1920)</span>
            </button>
          </div>
        </div>

        {/* Tactical Performance Breakdown */}
        <div
          className={`border rounded-3xl p-6 space-y-5 ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
          }`}
        >
          <h3 className="text-sm font-bold uppercase font-mono tracking-wider">
            Análise de Atributos de Desempenho
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-rose-500 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> FORÇA (RESISTÊNCIA)
                </span>
                <span className="font-bold">{stats.strengthScore} / 100</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${stats.strengthScore}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-amber-500 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> VELOCIDADE (EXPLOSÃO)
                </span>
                <span className="font-bold">{stats.speedScore} / 100</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${stats.speedScore}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-emerald-500 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> AGILIDADE (CADÊNCIA)
                </span>
                <span className="font-bold">{stats.agilityScore} / 100</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.agilityScore}%` }} />
              </div>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl space-y-2 text-xs border ${
              isLight
                ? 'bg-orange-50/50 border-orange-200 text-slate-700'
                : 'bg-slate-950/80 border-slate-800 text-slate-300'
            }`}
          >
            <p className={`font-bold font-mono ${isLight ? 'text-orange-700' : 'text-cyan-300'}`}>RECOMENDAÇÃO DE TREINO:</p>
            <p className="leading-relaxed">
              Excelente consistência de ritmo! Sua velocidade máxima atingiu{' '}
              <strong className="text-amber-500">{stats.maxSpeedKmh.toFixed(1)} km/h</strong>. Continue registrando seus treinos diários para evoluir de nível.
            </p>
          </div>
        </div>
      </div>

      {/* Cyberpunk Achievement Card High-Res Preview & Export Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className={`relative w-full max-w-2xl rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl transition-all my-8 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900 shadow-orange-500/10'
              : 'bg-slate-900 border-cyan-500/40 text-slate-100 shadow-[0_0_60px_rgba(6,182,212,0.2)]'
          }`}>
            <button
              onClick={() => setShowCardModal(false)}
              className={`absolute top-5 right-5 p-2 rounded-xl border transition cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600' : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 uppercase">
                  ESTÚDIO DE CONQUISTAS NEON
                </span>
                <h3 className="text-xl font-black uppercase tracking-wide mt-0.5">
                  Card de Conquista Cyberpunk
                </h3>
              </div>
            </div>

            <p className="text-xs font-mono text-slate-400">
              Captura em tempo real do trajeto com telemetria de GPS, métricas de velocidade e insígnias táticas personalizadas.
            </p>

            {/* Canvas Render Display */}
            <div className="flex justify-center my-4">
              <div className="w-full max-w-[380px] aspect-[4/5] rounded-2xl border border-cyan-500/40 overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.25)] bg-slate-950 p-1">
                <canvas ref={cardCanvasRef} className="w-full h-full object-contain rounded-xl" />
              </div>
            </div>

            {/* Download & Share Actions */}
            <div className="space-y-3 font-mono">
              <button
                onClick={() => {
                  handleDownloadCard();
                  setShowCardModal(false);
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              >
                <Download className="w-5 h-5" />
                <span>BAIXAR CARD DE CONQUISTA (.PNG HD)</span>
              </button>

              <button
                onClick={() => {
                  setShowCardModal(false);
                  setShowInstagramModal(true);
                }}
                className={`w-full py-3 rounded-2xl border font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-pink-400'
                }`}
              >
                <Instagram className="w-4 h-4 text-pink-400" />
                <span>COMPARTILHAR NO INSTAGRAM STORIES</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level Up Celebration Modal Component */}
      {showLevelUpModal && (
        <LevelUpCelebrationModal
          stats={stats}
          currentLevel={level}
          levelUpEvent={levelUpEvent || undefined}
          athleteName={athleteName}
          onShareToCommunityCamera={onShareToCommunityCamera}
          onClose={() => setShowLevelUpModal(false)}
        />
      )}

      {/* Instagram Connectivity & Share Modal Component */}
      {showInstagramModal && (
        <InstagramShareModal
          stats={stats}
          level={level}
          onClose={() => setShowInstagramModal(false)}
          isLevelUp={true}
        />
      )}

      {/* Multi-Network Social Share Modal */}
      {showSocialShareModal && (
        <SocialShareModal
          payload={workoutSharePayload}
          onClose={() => setShowSocialShareModal(false)}
          onOpenInstagramStory={() => setShowInstagramModal(true)}
          theme={theme}
        />
      )}
    </div>
  );
};

