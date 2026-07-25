import React, { useState } from 'react';
import { Shield, Play, CheckCircle, Clock, Flame, Activity } from 'lucide-react';

export interface ExerciseRoutine {
  id: string;
  title: string;
  targetArea: string;
  durationMins: number;
  difficulty: 'Iniciante' | 'Intermediário' | 'Avançado';
  exercises: { name: string; sets: string; description: string }[];
}

interface CrossTrainingViewProps {
  theme?: 'dark' | 'light';
}

export const CrossTrainingView: React.FC<CrossTrainingViewProps> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';

  const routines: ExerciseRoutine[] = [
    {
      id: 'r1',
      title: 'Fortalecimento de Core & Estabilidade Pélvica',
      targetArea: 'Core, Abdominais e Lombares',
      durationMins: 12,
      difficulty: 'Iniciante',
      exercises: [
        { name: 'Prancha Frontal Iso', sets: '3x 40 segundos', description: 'Ativação profunda de abdômen e estabilidade para corrida.' },
        { name: 'Ponte de Glúteos Unilateral', sets: '3x 12 repetições cada perna', description: 'Previne dor na patela e síndrome do trato iliotibial.' },
        { name: 'Perdigueiro (Bird-Dog)', sets: '3x 10 repetições alternadas', description: 'Fortalece paravertebrais e melhora postura de corrida.' },
      ],
    },
    {
      id: 'r2',
      title: 'Reforço de Panturrilha & Estabilidade de Tornozelo',
      targetArea: 'Panturrilhas, Tendão de Aquiles & Tornozelos',
      durationMins: 10,
      difficulty: 'Intermediário',
      exercises: [
        { name: 'Elevação de Panturrilha na Margem do Degrau', sets: '3x 15 repetições com descida lenta', description: 'Protege contra tendinite de aquiles e fáscia plantar.' },
        { name: 'Caminhada nos Calcanhares (Tibial Anterior)', sets: '3x 30 passos', description: 'Prevenção direta contra canelite (síndrome do estresse tibial).' },
        { name: 'Agachamento Sumô com Isometria', sets: '3x 12 repetições', description: 'Fortalecimento de adutores e estabilidade de quadril.' },
      ],
    },
    {
      id: 'r3',
      title: 'Mobilidade de Quadril & Alongamento Dinâmico',
      targetArea: 'Flexores de Quadril & Posteriores de Coxa',
      durationMins: 15,
      difficulty: 'Iniciante',
      exercises: [
        { name: 'Mobilidade 90/90 de Quadril', sets: '2x 10 rotações', description: 'Aumenta a amplitude da passada e solta o quadril.' },
        { name: 'Ajoelhado com Avanço do Quadril', sets: '3x 30 segundos cada lado', description: 'Alongamento profundo de psoas e flexores de quadril.' },
        { name: 'Pêndulo de Perna Dinâmico', sets: '2x 15 repetições cada perna', description: 'Solta posteriores e prepara a articulação para corridas rápidas.' },
      ],
    },
  ];

  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);

  return (
    <div className={`p-6 rounded-3xl border space-y-6 transition-colors ${
      isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
    }`}>
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
            isLight ? 'bg-orange-100 text-orange-700' : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
          }`}>
            TREINO CRUZADO & PREVENÇÃO
          </span>
        </div>
        <h2 className="text-xl font-black uppercase tracking-wide mt-1 flex items-center gap-2">
          Fortalecimento & Mobilidade do Corredor
          <Shield className="w-5 h-5 text-emerald-500" />
        </h2>
        <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Ninguém chega longe só correndo! Pratique estes blocos curtos de 10-15 minutos nos dias de descanso para blindar articulações.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {routines.map((routine) => {
          const isSelected = activeRoutineId === routine.id;

          return (
            <div
              key={routine.id}
              className={`p-5 rounded-2xl border space-y-3 font-mono flex flex-col justify-between transition-all ${
                isSelected
                  ? isLight
                    ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-300'
                    : 'bg-slate-950 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                  : isLight
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/30">
                    ⏱️ {routine.durationMins} MINUTOS
                  </span>
                  <span className="text-slate-400 uppercase">{routine.difficulty}</span>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                  {routine.title}
                </h3>
                <p className="text-[11px] text-slate-400">{routine.targetArea}</p>

                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {routine.exercises.map((ex, idx) => (
                    <div key={idx} className="text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span>• {ex.name}</span>
                        <span className="text-[10px] text-cyan-500">{ex.sets}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        {ex.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setActiveRoutineId(isSelected ? null : routine.id)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold font-mono uppercase flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 text-white'
                    : isLight
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {isSelected ? (
                  <>
                    <CheckCircle className="w-4 h-4" /> CONCLUÍDO! (+100 XP)
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> INICIAR SESSÃO
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
