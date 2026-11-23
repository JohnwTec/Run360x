import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Trophy,
  Zap,
  ChevronRight,
  Award,
  Volume2,
  Instagram,
  X,
  CheckCircle2,
  Camera,
  RotateCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WorkoutStats, TrainingLevel, LevelUpEvent } from '../types';
import { tacticalAudio } from '../utils/audio';
import { InstagramShareModal } from './InstagramShareModal';

interface LevelUpCelebrationModalProps {
  stats: WorkoutStats;
  currentLevel: TrainingLevel;
  levelUpEvent?: LevelUpEvent;
  athleteName?: string;
  onClose: () => void;
  onShareToCommunityCamera?: (stats: WorkoutStats) => void;
}

interface NeonParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  shape: 'orb' | 'diamond' | 'spark';
  rotation: number;
  vRot: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  lineWidth: number;
}

const NEON_PALETTE = ['#22d3ee', '#00f0ff', '#f43f5e', '#a855f7', '#fbbf24', '#34d399'];

function getAthleteRankTitle(levelNum: number): string {
  if (levelNum >= 10) return 'Lenda Suprema RUN360X';
  if (levelNum >= 7) return 'Titã do Asfalto';
  if (levelNum >= 5) return 'Vanguarda Elite';
  if (levelNum >= 4) return 'Dominador Urbano';
  if (levelNum >= 3) return 'Velocista Tático';
  if (levelNum >= 2) return 'Corredor em Ascensão';
  return 'Atleta Explorador';
}

export const LevelUpCelebrationModal: React.FC<LevelUpCelebrationModalProps> = ({
  stats,
  currentLevel,
  levelUpEvent,
  athleteName = 'Atleta',
  onClose,
  onShareToCommunityCamera,
}) => {
  const [showInstagramModal, setShowInstagramModal] = useState<boolean>(false);
  const [burstCycle, setBurstCycle] = useState<number>(0);
  const [displayedXp, setDisplayedXp] = useState<number>(0);
  const [xpBarWidth, setXpBarWidth] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spawnBurstRef = useRef<(() => void) | null>(null);

  const previousLevelNum = levelUpEvent?.previousLevel ?? Math.max(1, (currentLevel.levelNumber || 2) - 1);
  const newLevelNum = levelUpEvent?.newLevel ?? Math.max(2, currentLevel.levelNumber || 2);
  const xpGained = levelUpEvent?.xpGained ?? stats.xpGained;
  const newTotalXp = levelUpEvent?.newXp ?? newLevelNum * 1000;
  const xpIntoNewLevel = newTotalXp % 1000;
  const targetBarPct = Math.max(12, Math.min(100, Math.round((xpIntoNewLevel / 1000) * 100)));
  const rankTitle = getAthleteRankTitle(newLevelNum);

  // Fire multi-wave neon confetti + triumphant Web Audio fanfare
  const triggerCelebrationFx = useCallback(
    (announceVoice: boolean) => {
      tacticalAudio.playLevelUpSound();
      if (announceVoice) {
        tacticalAudio.speakTacticalCoach(
          `Parabéns ${athleteName}! Novo nível alcançado! Você subiu para o nível ${newLevelNum}, patente ${rankTitle}, com ${xpGained} pontos de experiência conquistados!`,
          { category: 'milestone', priority: 'high', interrupt: true }
        );
      }

      spawnBurstRef.current?.();

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      const baseColors = ['#00f0ff', '#f43f5e', '#a855f7', '#fbbf24', '#10b981'];
      confetti({
        particleCount: 95,
        spread: 75,
        startVelocity: 52,
        origin: { x: 0.5, y: 0.56 },
        colors: baseColors,
        zIndex: 70,
      });

      window.setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 60,
          spread: 58,
          startVelocity: 48,
          origin: { x: 0.08, y: 0.72 },
          colors: baseColors,
          zIndex: 70,
        });
        confetti({
          particleCount: 55,
          angle: 120,
          spread: 58,
          startVelocity: 48,
          origin: { x: 0.92, y: 0.72 },
          colors: baseColors,
          zIndex: 70,
        });
      }, 240);
    },
    [athleteName, newLevelNum, rankTitle, xpGained]
  );

  // Full-screen High-DPI Neon Particle & Shockwave Canvas Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: NeonParticle[] = [];
    const shockwaves: ShockwaveRing[] = [];

    const spawnNeonBurst = () => {
      const cx = width * 0.5;
      const cy = height * 0.44;
      const burstCount = prefersReducedMotion ? 24 : 110;

      for (let i = 0; i < burstCount; i++) {
        const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.3;
        const speed = 2.4 + Math.random() * 9.5;
        const shapes: NeonParticle['shape'][] = ['orb', 'diamond', 'spark'];
        particles.push({
          x: cx + (Math.random() - 0.5) * 24,
          y: cy + (Math.random() - 0.5) * 24,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.6,
          size: 2.2 + Math.random() * 4.4,
          alpha: 1,
          decay: 0.008 + Math.random() * 0.011,
          color: NEON_PALETTE[i % NEON_PALETTE.length],
          shape: shapes[i % shapes.length],
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.16,
        });
      }

      shockwaves.push(
        { x: cx, y: cy, radius: 22, maxRadius: Math.max(width, height) * 0.55, color: '#00f0ff', alpha: 0.95, lineWidth: 4.5 },
        { x: cx, y: cy, radius: 8, maxRadius: Math.max(width, height) * 0.42, color: '#f43f5e', alpha: 0.85, lineWidth: 3 },
        { x: cx, y: cy, radius: 2, maxRadius: Math.max(width, height) * 0.32, color: '#fbbf24', alpha: 0.8, lineWidth: 2.2 }
      );
    };

    spawnBurstRef.current = spawnNeonBurst;
    spawnNeonBurst();

    let rafId = 0;
    let frame = 0;

    const animate = () => {
      frame += 1;
      ctx.clearRect(0, 0, width, height);

      // Ambient rising neon embers for continuous triumphant glow
      if (!prefersReducedMotion && frame % 3 === 0 && particles.length < 180) {
        particles.push({
          x: Math.random() * width,
          y: height + 12,
          vx: (Math.random() - 0.5) * 0.9,
          vy: -(1.4 + Math.random() * 2.4),
          size: 1.6 + Math.random() * 2.8,
          alpha: 0.85,
          decay: 0.0045 + Math.random() * 0.004,
          color: NEON_PALETTE[Math.floor(Math.random() * NEON_PALETTE.length)],
          shape: Math.random() > 0.45 ? 'orb' : 'diamond',
          rotation: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 0.06,
        });
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Render expanding neon shockwave rings
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const ring = shockwaves[i];
        ring.radius += (ring.maxRadius - ring.radius) * 0.075 + 2.6;
        ring.alpha *= 0.955;

        if (ring.alpha < 0.02 || ring.radius >= ring.maxRadius) {
          shockwaves.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = ring.alpha;
        ctx.lineWidth = ring.lineWidth;
        ctx.shadowColor = ring.color;
        ctx.shadowBlur = 18;
        ctx.stroke();
      }

      // Render physics-driven neon particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.045; // gentle gravity
        p.rotation += p.vRot;
        p.alpha -= p.decay;

        if (p.alpha <= 0.015) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;

        if (p.shape === 'orb') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'diamond') {
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 1.3);
          ctx.lineTo(p.size * 0.9, 0);
          ctx.lineTo(0, p.size * 1.3);
          ctx.lineTo(-p.size * 0.9, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-p.size * 1.7, -p.size * 0.35, p.size * 3.4, p.size * 0.7);
        }
        ctx.restore();
      }

      ctx.restore();
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      spawnBurstRef.current = null;
    };
  }, []);

  // Trigger sound, confetti, and animated XP count-up on mount & replay
  useEffect(() => {
    triggerCelebrationFx(burstCycle === 0);

    setDisplayedXp(0);
    setXpBarWidth(0);

    const startTime = performance.now();
    const durationMs = 950;
    let rafId = 0;

    const stepCount = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedXp(Math.round(xpGained * eased));
      if (t < 1) {
        rafId = window.requestAnimationFrame(stepCount);
      }
    };
    rafId = window.requestAnimationFrame(stepCount);

    const barTimer = window.setTimeout(() => {
      setXpBarWidth(targetBarPct);
    }, 280);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(barTimer);
    };
  }, [burstCycle, xpGained, targetBarPct, triggerCelebrationFx]);

  const handleReplaySpectacle = () => {
    setBurstCycle((prev) => prev + 1);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/92 font-sans overflow-y-auto">
        {/* Full-Screen Live Neon Particles & Shockwave Canvas */}
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* Central Triumphant Neon Card */}
        <div
          key={burstCycle}
          className="relative z-10 w-full max-w-xl rounded-3xl bg-slate-900/95 border-2 border-cyan-400 p-6 sm:p-8 text-white shadow-[0_0_90px_rgba(0,240,255,0.42),0_0_40px_rgba(244,63,94,0.22)] space-y-5 text-center overflow-hidden animate-neon-unlock my-auto"
        >
          {/* Ambient Neon Halo Blobs */}
          <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-cyan-500/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 left-1/4 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 right-1/4 w-64 h-64 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

          {/* Top Neon Accent Line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer z-20"
            aria-label="Fechar celebração de Level Up"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Eyebrow */}
          <div className="flex items-center justify-center gap-2 text-xs font-mono font-black uppercase tracking-[0.22em] text-cyan-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>LEVEL UP TRIUNFANTE</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>

          {/* Animated Neon Crest Emblem with Expanding Rings */}
          <div className="relative mx-auto w-36 h-36 flex items-center justify-center my-1">
            {/* Outer Expanding Shockwave Rings */}
            <div className="absolute inset-2 rounded-full border-2 border-cyan-400/70 animate-levelup-ring pointer-events-none" />
            <div
              className="absolute inset-4 rounded-full border border-fuchsia-400/70 animate-levelup-ring pointer-events-none"
              style={{ animationDelay: '0.55s' }}
            />

            {/* Slowly Rotating Starburst Neon Orbit */}
            <div className="absolute inset-0 rounded-full border border-dashed border-cyan-400/45 animate-levelup-spin pointer-events-none" />

            {/* Core Emblem Disc */}
            <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-950 border-2 border-cyan-300 shadow-[0_0_45px_rgba(0,240,255,0.75),inset_0_0_24px_rgba(34,211,238,0.4)] flex flex-col items-center justify-center animate-levelup-crest badge-unlock-glow">
              <span className="text-[10px] font-mono font-black tracking-widest text-cyan-300 uppercase">
                NÍVEL
              </span>
              <span className="text-5xl font-black font-mono tabular-nums text-white leading-none animate-neon-flicker">
                {newLevelNum}
              </span>
            </div>
          </div>

          {/* Level Transition & Rank Title */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3 text-base sm:text-lg font-black font-mono tabular-nums">
              <span className="text-slate-500 line-through">LVL {previousLevelNum}</span>
              <ChevronRight className="w-5 h-5 text-cyan-400" />
              <span className="text-cyan-300">LVL {newLevelNum}</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-400">+{displayedXp} XP</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              {rankTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Sua evolução em <span className="text-cyan-300 font-semibold">{currentLevel.codename}</span> elevou sua patente oficial no <strong className="text-white">RUN360X</strong>.
            </p>
          </div>

          {/* Animated Neon XP Overflow Progress Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2 text-left font-mono">
            <div className="flex items-center justify-between text-[11px] tabular-nums">
              <span className="text-cyan-300 font-bold uppercase">
                Progresso para Nível {newLevelNum + 1}
              </span>
              <span className="text-slate-300 font-bold">
                {xpIntoNewLevel} / 1000 XP
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 shadow-[0_0_16px_rgba(34,211,238,0.8)] transition-all duration-1000 ease-out"
                style={{ width: `${xpBarWidth}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
              <span>XP Total Acumulado: {newTotalXp.toLocaleString('pt-BR')} XP</span>
              <span className="text-emerald-400 font-bold">
                Faltam {1000 - xpIntoNewLevel} XP
              </span>
            </div>
          </div>

          {/* Unlocked Rewards Grid */}
          <div className="p-4 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-2.5 text-left font-mono">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
              Recompensas & Bônus Desbloqueados:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 flex items-center gap-2 text-cyan-200">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>+15% Bônus em XP de Orbes</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center gap-2 text-emerald-200">
                <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Insígnia Néon Nível {newLevelNum}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-fuchsia-500/30 flex items-center gap-2 text-fuchsia-200">
                <Trophy className="w-4 h-4 text-fuchsia-400 shrink-0" />
                <span className="truncate">Patente: {rankTitle}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center gap-2 text-amber-200">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Multiplicador de Ranking Ativo</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {onShareToCommunityCamera && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onShareToCommunityCamera(stats);
                  }}
                  className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(34,211,238,0.45)] transition flex items-center justify-center gap-2 font-mono cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Postar na Comunidade</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowInstagramModal(true)}
                className={`${
                  onShareToCommunityCamera ? '' : 'sm:col-span-2'
                } py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(236,72,153,0.4)] transition flex items-center justify-center gap-2 font-mono cursor-pointer`}
              >
                <Instagram className="w-4 h-4" />
                <span>Instagram Stories</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleReplaySpectacle}
                className="flex-1 py-3 rounded-2xl bg-slate-950 border border-slate-700 hover:border-cyan-400 text-cyan-300 hover:text-white font-bold text-xs uppercase font-mono transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rever Efeito Néon</span>
                <Volume2 className="w-3.5 h-3.5 opacity-80" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase font-mono transition cursor-pointer"
              >
                Ver Resumo da Corrida
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instagram Share Modal */}
      {showInstagramModal && (
        <InstagramShareModal
          stats={stats}
          level={currentLevel}
          onClose={() => setShowInstagramModal(false)}
          isLevelUp={true}
        />
      )}
    </>
  );
};
