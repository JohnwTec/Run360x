import React, { useEffect, useState } from 'react';
import { Sparkles, Trophy, Zap, Shield, ChevronRight, Award, Volume2, Instagram, X, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { WorkoutStats, TrainingLevel } from '../types';
import { tacticalAudio } from '../utils/audio';
import { InstagramShareModal } from './InstagramShareModal';

interface LevelUpCelebrationModalProps {
  stats: WorkoutStats;
  currentLevel: TrainingLevel;
  onClose: () => void;
}

export const LevelUpCelebrationModal: React.FC<LevelUpCelebrationModalProps> = ({
  stats,
  currentLevel,
  onClose,
}) => {
  const [showInstagramModal, setShowInstagramModal] = useState<boolean>(false);
  const currentNum = currentLevel.levelNumber || 1;
  const previousLevelNum = Math.max(1, currentNum - 1);

  // Trigger celebration audio and confetti on mount
  useEffect(() => {
    tacticalAudio.playLevelUpSound();

    // Multi-stage confetti cannon burst
    const count = 200;
    const defaults = {
      origin: { y: 0.6 },
      colors: ['#00f0ff', '#ff007f', '#10b981', '#f59e0b', '#a855f7'],
    };

    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.5),
      spread: 60,
      startVelocity: 55,
    });

    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.5),
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
  }, []);

  const handleReplayAudio = () => {
    tacticalAudio.playLevelUpSound();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fadeIn font-sans">
        <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border-2 border-cyan-400 p-6 sm:p-8 text-white shadow-[0_0_80px_rgba(0,240,255,0.4)] space-y-6 text-center overflow-hidden animate-neon-unlock">
          {/* Background Neon Particles Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Level Up Top Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300 text-xs font-mono font-extrabold uppercase tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>NOVO NÍVEL ALCANÇADO</span>
            <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
          </div>

          {/* Level Upgrade Animated Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-4 text-2xl font-black font-mono">
              <span className="text-slate-500 line-through">NÍVEL {previousLevelNum}</span>
              <ChevronRight className="w-6 h-6 text-cyan-400 animate-bounce" />
              <span className="text-5xl font-black text-cyan-300 drop-shadow-[0_0_25px_rgba(6,182,212,0.8)] animate-pulse">
                NÍVEL {currentNum}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wide text-white drop-shadow-md">
              {currentLevel.title}
            </h1>
            <p className="text-xs font-mono text-cyan-300/80">
              Sua persistência e ritmo de corrida destravaram uma nova patente na hierarquia do RunLevel.
            </p>
          </div>

          {/* Level Rewards Unlocked Cards */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 text-left font-mono">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
              🔓 RECOMPENSAS & BÔNUS DESBLOQUEADOS:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 flex items-center gap-2 text-cyan-300">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>+15% Bônus em XP de Orbes</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center gap-2 text-emerald-300">
                <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Emblema Ouro no Perfil</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-purple-500/30 flex items-center gap-2 text-purple-300">
                <Trophy className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Título: {currentLevel.title}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center gap-2 text-amber-300">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Modo Trilha Cyberpunk</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            {/* Primary Action: Instagram Publishing */}
            <button
              onClick={() => setShowInstagramModal(true)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-500 hover:opacity-95 text-white font-black text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(236,72,153,0.4)] transition flex items-center justify-center gap-2 font-mono"
            >
              <Instagram className="w-5 h-5 text-white animate-bounce" />
              <span>Publicar Conquista no Instagram Stories</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReplayAudio}
                className="flex-1 py-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white font-bold text-xs uppercase font-mono transition flex items-center justify-center gap-2"
              >
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>Ouvir Som Neon</span>
              </button>

              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase font-mono transition"
              >
                Continuar
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
