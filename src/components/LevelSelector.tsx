import React, { useState } from 'react';
import { Play, Zap, MapPin, ChevronRight, X, Sparkles, Clock, Target, Gauge, Flame, Users, Search, Trophy } from 'lucide-react';
import { TrainingLevel, WorkoutOption, TrainingLevelId, WorkoutModeId } from '../types';
import { TRAINING_LEVELS } from '../data/trainingPrograms';
import { CommunityChallengesFeed, CommunityChallenge } from './CommunityChallengesFeed';

interface LevelSelectorProps {
  onSelectLevel: (level: TrainingLevel, selectedOption?: WorkoutOption) => void;
  userLevel: number;
  userXp: number;
  conqueredSectorsCount: number;
  theme?: 'dark' | 'light';
}

export const LevelSelector: React.FC<LevelSelectorProps> = ({
  onSelectLevel,
  userLevel,
  userXp,
  conqueredSectorsCount,
  theme = 'dark',
}) => {
  const [selectedLevelForModal, setSelectedLevelForModal] = useState<TrainingLevel | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'programs' | 'community'>('programs');

  const isLight = theme === 'light';

  const handleLaunchOption = (lvl: TrainingLevel, opt: WorkoutOption) => {
    // Clone level and set intervals & distance according to option
    const configuredLevel: TrainingLevel = {
      ...lvl,
      title: `${lvl.title} • ${opt.title}`,
      targetDistanceKm: opt.targetDistanceKm,
      intervals: opt.intervals,
    };
    setSelectedLevelForModal(null);
    onSelectLevel(configuredLevel, opt);
  };

  const handleLaunchCommunityEvent = (challenge: CommunityChallenge) => {
    // Extract first distance number
    const distMatch = challenge.distances.match(/(\d+)/);
    const distKm = distMatch ? parseInt(distMatch[1], 10) : 5;

    const levelId: TrainingLevelId = distKm >= 21 ? 'nivel-5' : distKm >= 10 ? 'nivel-4' : distKm >= 7 ? 'nivel-3' : distKm >= 5 ? 'nivel-2' : 'nivel-1';
    const modeId: WorkoutModeId = 'longao';

    const customLevel: TrainingLevel = {
      id: levelId,
      levelNumber: levelId === 'nivel-5' ? 5 : levelId === 'nivel-4' ? 4 : levelId === 'nivel-3' ? 3 : levelId === 'nivel-2' ? 2 : 1,
      title: challenge.title,
      codename: `DESAFIO COMUNITÁRIO: ${challenge.challengeType.toUpperCase()}`,
      badge: '🏆',
      description: challenge.description,
      focus: challenge.challengeType,
      targetDistanceKm: distKm,
      conquestSectorName: challenge.location,
      mapObjective: `Completar percurso oficial de ${distKm} KM em ${challenge.location}`,
      gamificationNote: `Ganhe +${challenge.xpReward} XP ao concluir este desafio da comunidade!`,
      intervals: [
        { label: 'Aquecimento Tático', durationSeconds: 300, targetPaceMinKm: 6.5, type: 'warmup' },
        { label: 'Ritmo Oficial do Desafio', durationSeconds: distKm * 300, targetPaceMinKm: 5.2, type: 'sprint' },
        { label: 'Desaquecimento', durationSeconds: 300, targetPaceMinKm: 7.0, type: 'walk' },
      ],
      workoutOptions: [
        {
          id: modeId,
          title: 'Percurso Principal',
          badge: '🏃',
          tagline: 'Desafio da Comunidade',
          description: challenge.description,
          targetDistanceKm: distKm,
          estimatedDurationMins: Math.round(distKm * 5.5),
          targetPaceMinKm: 5.5,
          xpBonus: challenge.xpReward,
          intervals: [
            { label: 'Ritmo de Prova', durationSeconds: distKm * 300, targetPaceMinKm: 5.5, type: 'sprint' },
          ],
        },
      ],
    };

    onSelectLevel(customLevel, customLevel.workoutOptions[0]);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Sub-tab Navigation Bar for Missões */}
      <div className={`p-2 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('programs')}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'programs'
                ? isLight
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>NÍVEIS DE TREINO DIÁRIO (1-5)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('community')}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'community'
                ? isLight
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-cyan-400" />
            <span>DESAFIOS DA COMUNIDADE (EVENTOS LOCAIS)</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-950 text-cyan-300 border border-cyan-500/40 animate-pulse">
              SEARCH GROUNDING
            </span>
          </button>
        </div>

        <span className="text-xs font-mono text-slate-400 hidden lg:inline px-3">
          LVL {userLevel} • {userXp} XP
        </span>
      </div>

      {activeSubTab === 'community' ? (
        <CommunityChallengesFeed
          theme={theme}
          onAcceptChallenge={handleLaunchCommunityEvent}
        />
      ) : (
        <>
          {/* Modal for Selecting 3 Workout Modalities */}
      {selectedLevelForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl transition-all border max-h-[90vh] overflow-y-auto ${
              isLight
                ? 'bg-white border-slate-200 text-slate-800'
                : 'bg-slate-900 border-cyan-500/30 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.2)]'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
              <div>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase ${
                  isLight ? 'bg-orange-100 text-orange-700 font-bold' : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                }`}>
                  {selectedLevelForModal.title}
                </span>
                <h2 className="text-xl sm:text-2xl font-black uppercase mt-1">
                  Selecione a Modalidade do Treino
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Escolha como deseja executar sua Missão Diária hoje
                </p>
              </div>

              <button
                onClick={() => setSelectedLevelForModal(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3 Workout Options Grid */}
            <div className="space-y-4">
              {selectedLevelForModal.workoutOptions.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => handleLaunchOption(selectedLevelForModal, opt)}
                  className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isLight
                      ? 'bg-slate-50 hover:bg-orange-50/60 border-slate-200 hover:border-orange-400 shadow-sm'
                      : 'bg-slate-950/80 hover:bg-slate-950 border-slate-800 hover:border-cyan-500/60 shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                      {opt.badge}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-base font-bold group-hover:text-orange-600 dark:group-hover:text-cyan-300 transition ${
                          isLight ? 'text-slate-900' : 'text-white'
                        }`}>
                          {opt.title}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold rounded-md border border-amber-500/20">
                          +{opt.xpBonus} XP
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                        {opt.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-orange-500 dark:text-cyan-400" />
                          <strong>{opt.targetDistanceKm} km</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          ~{opt.estimatedDurationMins} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5 text-emerald-500" />
                          Pace {opt.targetPaceMinKm.toFixed(1)} min/km
                        </span>
                      </div>
                    </div>
                  </div>

                  <button className={`w-full sm:w-auto px-5 py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 transition ${
                    isLight
                      ? 'bg-orange-500 group-hover:bg-orange-600 text-white shadow-md'
                      : 'bg-cyan-500 group-hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  }`}>
                    <Play className="w-4 h-4 fill-current" />
                    Iniciar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Motivational Athlete Mission Control Hero */}
      <div
        className={`p-6 rounded-3xl border space-y-5 transition-colors ${
          isLight
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <p
              className={`font-mono text-[11px] uppercase font-bold tracking-wider ${
                isLight ? 'text-orange-600' : 'text-cyan-400'
              }`}
            >
              Central de Performance · Pista 400m · Pista 200m · Esteira · Estrada · Trail
            </p>
            <h1 className={`text-2xl sm:text-3xl font-black tracking-tight uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Supere sua Melhor Marca Hoje
            </h1>
            <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Escolha seu programa diário, sincronize o GPS e decida o cenário 3D da sua corrida — do estádio olímpico de 400m às trilhas de montanha.
            </p>
          </div>

          {/* Athlete Progression Summary (Tabular Numerals) */}
          <div
            className={`w-full md:w-auto min-w-[260px] p-4 rounded-2xl border space-y-2.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-4 font-mono tabular-nums">
              <div>
                <span className={`text-[10px] uppercase block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Nível Atual
                </span>
                <span className={`text-lg font-black ${isLight ? 'text-orange-600' : 'text-cyan-400'}`}>
                  LVL {userLevel}
                </span>
              </div>
              <div className="text-right">
                <span className={`text-[10px] uppercase block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  XP · Setores
                </span>
                <span className="text-sm font-black text-amber-500">
                  {userXp} XP <span className="text-slate-500">·</span>{' '}
                  <span className="text-emerald-500">{conqueredSectorsCount}</span>
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isLight ? 'bg-orange-500' : 'bg-gradient-to-r from-cyan-400 to-teal-400'
                  }`}
                  style={{ width: `${Math.max(10, Math.min(100, Math.round(((userXp % 1000) / 1000) * 100)))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                <span>Progresso para LVL {userLevel + 1}</span>
                <span>{1000 - (userXp % 1000)} XP restantes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of the 4 Training Levels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TRAINING_LEVELS.map((lvl) => {
          return (
            <div
              key={lvl.id}
              className={`group relative rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between border ${
                isLight
                  ? 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-orange-400 shadow-md hover:shadow-xl'
                  : 'bg-slate-900 hover:bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 shadow-md hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-2xl p-2.5 rounded-2xl border ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      {lvl.badge}
                    </span>
                    <div>
                      <span className={`text-[10px] font-mono uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {lvl.title}
                      </span>
                      <h3
                        className={`text-lg font-bold tracking-wide transition ${
                          isLight
                            ? 'text-slate-900 group-hover:text-orange-600'
                            : 'text-white group-hover:text-cyan-300'
                        }`}
                      >
                        {lvl.codename}
                      </h3>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                      isLight
                        ? 'bg-orange-50 text-orange-600 border-orange-200'
                        : 'bg-cyan-950/60 text-cyan-400 border-cyan-500/30'
                    }`}
                  >
                    Até {lvl.targetDistanceKm} KM
                  </span>
                </div>

                <p className={`text-xs leading-relaxed mb-4 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {lvl.description}
                </p>

                {/* Gamified Map Component Notes */}
                <div className="space-y-2 mb-4 text-xs font-mono">
                  <div
                    className={`p-2.5 rounded-xl flex items-start gap-2 border ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-slate-950/60 border-slate-800 text-cyan-300'
                    }`}
                  >
                    <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? 'text-orange-500' : 'text-cyan-400'}`} />
                    <span>
                      <strong>No Mapa:</strong> {lvl.mapObjective}
                    </span>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl flex items-start gap-2 border ${
                      isLight
                        ? 'bg-amber-50/60 border-amber-200 text-amber-800'
                        : 'bg-slate-950/60 border-slate-800 text-amber-300'
                    }`}
                  >
                    <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Gamificação:</strong> {lvl.gamificationNote}
                    </span>
                  </div>
                </div>
              </div>

              {/* Start Daily Mission Button */}
              <button
                onClick={() => setSelectedLevelForModal(lvl)}
                className={`w-full py-3.5 font-bold font-mono rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer border shadow-sm ${
                  isLight
                    ? 'bg-slate-900 hover:bg-orange-600 text-white border-slate-800 hover:border-orange-500'
                    : 'bg-slate-800 group-hover:bg-gradient-to-r group-hover:from-cyan-500 group-hover:to-teal-500 group-hover:text-slate-950 text-slate-200 border-slate-700 group-hover:border-transparent'
                }`}
              >
                <Play className="w-4 h-4 fill-current" /> INICIAR MISSÃO DIÁRIA <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
};

