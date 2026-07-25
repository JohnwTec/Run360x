import React from 'react';
import { Lock, Unlock, Zap, Flame, Shield, Compass, Award, CheckCircle } from 'lucide-react';

export interface SkillNode {
  id: string;
  title: string;
  description: string;
  levelRequired: number;
  unlocked: boolean;
  category: 'resistencia' | 'velocidade' | 'recuperacao' | 'tatica';
  icon: string;
}

interface SkillTreeProps {
  userLevel: number;
  userXp: number;
  theme?: 'dark' | 'light';
}

export const SkillTree: React.FC<SkillTreeProps> = ({ userLevel, userXp, theme = 'dark' }) => {
  const isLight = theme === 'light';

  const skills: SkillNode[] = [
    {
      id: 's1',
      title: 'Base Aeróbica Inicial',
      description: 'Capacidade de correr por 15 min sem interrupção.',
      levelRequired: 1,
      unlocked: true,
      category: 'resistencia',
      icon: '🏃',
    },
    {
      id: 's2',
      title: 'Controle de Cadência (PPM)',
      description: 'Ajuste automático para ritmos de 170-180 passos/min.',
      levelRequired: 1,
      unlocked: userLevel >= 1,
      category: 'tatica',
      icon: '🎯',
    },
    {
      id: 's3',
      title: 'Tiros em Subida (VO2Max)',
      description: 'Treinos intervalados de alta intensidade em elevação.',
      levelRequired: 2,
      unlocked: userLevel >= 2,
      category: 'velocidade',
      icon: '⚡',
    },
    {
      id: 's4',
      title: 'Dominador de Setores Urbana',
      description: 'Acesso a missões de conquista e orbes bônus.',
      levelRequired: 2,
      unlocked: userLevel >= 2,
      category: 'tatica',
      icon: '🗺️',
    },
    {
      id: 's5',
      title: 'Circuito de Elite (Tiros de 800m)',
      description: 'Tiros longos de alta exigência anaeróbica.',
      levelRequired: 3,
      unlocked: userLevel >= 3,
      category: 'velocidade',
      icon: '🔥',
    },
    {
      id: 's6',
      title: 'Polimento de Prova (Tapering)',
      description: 'Redução automatizada de carga pré-prova.',
      levelRequired: 3,
      unlocked: userLevel >= 3,
      category: 'recuperacao',
      icon: '🛡️',
    },
    {
      id: 's7',
      title: 'Odisseia 42K (Resistência Extrema)',
      description: 'Acesso a treinos de rodagem de longa distância.',
      levelRequired: 4,
      unlocked: userLevel >= 4,
      category: 'resistencia',
      icon: '👑',
    },
  ];

  return (
    <div className={`p-6 rounded-3xl border space-y-6 transition-colors ${
      isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
    }`}>
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
            isLight ? 'bg-orange-100 text-orange-700' : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
          }`}>
            SISTEMA DE PROGRESSÃO
          </span>
        </div>
        <h2 className="text-xl font-black uppercase tracking-wide mt-1 flex items-center gap-2">
          Árvore de Habilidades do Corredor
          <Zap className="w-5 h-5 text-cyan-400" />
        </h2>
        <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Suba de Nível acumulando XP para desbloquear novos métodos de treino, tiros de velocidade e táticas avançadas.
        </p>
      </div>

      {/* Nodes Map */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {skills.map((skill) => {
          const isUnlocked = skill.unlocked;

          return (
            <div
              key={skill.id}
              className={`p-4 rounded-2xl border space-y-2 font-mono transition-all relative ${
                isUnlocked
                  ? isLight
                    ? 'bg-emerald-50/60 border-emerald-300 shadow-sm'
                    : 'bg-slate-950 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : isLight
                  ? 'bg-slate-100 border-slate-200 opacity-60'
                  : 'bg-slate-950/40 border-slate-800 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{skill.icon}</span>
                {isUnlocked ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-white flex items-center gap-1">
                    <CheckCircle className="w-2.5 h-2.5" /> DESBLOQUEADO
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> REQUER LEVEL {skill.levelRequired}
                  </span>
                )}
              </div>

              <div>
                <h3 className={`text-sm font-extrabold ${
                  isUnlocked
                    ? isLight ? 'text-slate-900' : 'text-cyan-300'
                    : 'text-slate-500'
                }`}>
                  {skill.title}
                </h3>
                <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {skill.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
