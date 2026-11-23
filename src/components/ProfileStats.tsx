import React, { useEffect, useState } from 'react';
import { UserProfile, WeeklyGoalConfig, WorkoutStats } from '../types';
import { Trophy, Shield, MapPin, Zap, Flame, Award, Calendar, User, Scale, Ruler, Edit2, Sparkles, Share2 } from 'lucide-react';
import { formatPace, formatTime } from '../utils/geo';
import { SocialShareModal, SocialSharePayload } from './SocialShareModal';
import { WeeklyGoalsConfig } from './WeeklyGoalsConfig';

interface ProfileStatsProps {
  profile: UserProfile;
  onEditProfile?: () => void;
  onUpdateWeight?: (newWeightKg: number) => void;
  onUpdateWeeklyGoals?: (newGoals: WeeklyGoalConfig) => void;
  theme?: 'dark' | 'light';
}

export const ProfileStats: React.FC<ProfileStatsProps> = ({
  profile,
  onEditProfile,
  onUpdateWeight,
  onUpdateWeeklyGoals,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  // Weight edit states
  const [isEditingWeight, setIsEditingWeight] = useState<boolean>(false);
  const [newWeightInput, setNewWeightInput] = useState<number | ''>(profile.weightKg || 70);
  const [weightUpdatedMessage, setWeightUpdatedMessage] = useState<boolean>(false);
  const [sharePayload, setSharePayload] = useState<SocialSharePayload | null>(null);

  const openProfileShare = () => {
    setSharePayload({
      kind: 'profile',
      badge: `ATLETA NÍVEL ${profile.level} • RUN360X`,
      title: profile.name || 'Atleta RUN360X',
      subtitle: `${profile.conqueredSectors.length} setores dominados • ${profile.badges.filter((b) => b.unlockedAt).length} insígnias desbloqueadas`,
      metrics: [
        { label: 'Distância Total', value: `${profile.totalDistanceKm.toFixed(1)} km` },
        { label: 'Experiência', value: `${profile.xp} XP` },
        { label: 'Nível Tático', value: `LVL ${profile.level}` },
        { label: 'Setores', value: `${profile.conqueredSectors.length}` },
      ],
      defaultCaption:
        `🏃‍♂️ Meu perfil de atleta no RUN360X!\n` +
        `⚡ Nível ${profile.level} • ${profile.xp} XP acumulados\n` +
        `📏 ${profile.totalDistanceKm.toFixed(1)} km percorridos • 🏆 ${profile.conqueredSectors.length} setores dominados\n\n` +
        `Bora correr e conquistar novos setores juntos! #RUN360X #Corrida #Running #Atleta`,
    });
  };

  const openMissionShare = (h: WorkoutStats) => {
    setSharePayload({
      kind: 'workout',
      badge: 'HISTÓRICO DE MISSÃO • RUN360X',
      title: h.workoutTitle || h.sectorConquered || 'Corrida Tática',
      subtitle: `${h.date} • Setor: ${h.sectorConquered || 'Urbano'}`,
      metrics: [
        { label: 'Distância', value: `${(h.totalDistanceMeters / 1000).toFixed(2)} km` },
        { label: 'Pace Médio', value: formatPace(h.avgPaceMinKm) },
        { label: 'Duração', value: formatTime(h.durationSeconds) },
        { label: 'XP Ganho', value: `+${h.xpGained} XP` },
      ],
      defaultCaption:
        `🔥 Treino concluído no RUN360X!\n` +
        `📍 ${h.sectorConquered || h.workoutTitle}\n` +
        `📏 ${(h.totalDistanceMeters / 1000).toFixed(2)} km • ⏱️ Pace ${formatPace(h.avgPaceMinKm)}/km • ⏳ ${formatTime(h.durationSeconds)}\n` +
        `🏆 +${h.xpGained} XP acumulados!\n\n` +
        `#RUN360X #Corrida #Treino #Running`,
    });
  };

  // Sync state if profile changes
  useEffect(() => {
    setNewWeightInput(profile.weightKg || 70);
  }, [profile.weightKg]);

  const handleSaveWeight = () => {
    const val = Number(newWeightInput);
    if (val && val >= 30 && val <= 300) {
      if (onUpdateWeight) {
        onUpdateWeight(val);
      }
      setIsEditingWeight(false);
      setWeightUpdatedMessage(true);
      setTimeout(() => setWeightUpdatedMessage(false), 4000);
    }
  };

  // IMC Calculation
  const heightM = profile.heightCm ? profile.heightCm / 100 : 0;
  const imc = heightM > 0 && profile.weightKg ? (profile.weightKg / (heightM * heightM)).toFixed(1) : null;

  return (
    <div className="space-y-6 font-sans">
      {/* Profile Overview Card */}
      <div className={`p-6 border rounded-3xl space-y-4 transition-colors ${
        isLight ? 'bg-white border-slate-200 text-slate-800 shadow-sm' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black ${
              isLight
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
            }`}>
              🏃
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  isLight ? 'bg-orange-100 text-orange-700' : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                }`}>
                  ATLETA CADASTRADO
                </span>
              </div>
              <h2 className="text-xl font-black tracking-wide mt-1">
                {profile.name || 'Atleta RunLevel'}
              </h2>
              <p className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                LVL {profile.level} • {profile.xp} XP Acumulados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex gap-2 text-center flex-1 sm:flex-initial">
              <div className={`flex-1 sm:flex-initial p-3 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Km Totais</span>
                <span className="text-lg font-black font-mono text-cyan-500">{profile.totalDistanceKm.toFixed(1)}</span>
              </div>
              <div className={`flex-1 sm:flex-initial p-3 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">Setores</span>
                <span className="text-lg font-black font-mono text-emerald-500">{profile.conqueredSectors.length}</span>
              </div>
            </div>

            <button
              onClick={openProfileShare}
              className={`p-3 rounded-2xl border font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                isLight
                  ? 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700'
                  : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
              }`}
              title="Compartilhar perfil nas redes sociais"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>

            {onEditProfile && (
              <button
                onClick={onEditProfile}
                className={`p-3 rounded-2xl border font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-cyan-400'
                }`}
                title="Editar dados cadastrais do atleta"
              >
                <Edit2 className="w-4 h-4" />
                <span className="hidden sm:inline">Editar Perfil</span>
              </button>
            )}
          </div>
        </div>

        {/* Physical Bio Metrics Bar */}
        <div className={`p-4 rounded-2xl border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Idade</span>
            <span className="text-sm font-bold text-cyan-500">{profile.age ? `${profile.age} anos` : 'Não informado'}</span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Altura</span>
            <span className="text-sm font-bold text-amber-500">{profile.heightCm ? `${profile.heightCm} cm` : 'Não informado'}</span>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 block uppercase">Peso Corporal</span>
              <button
                onClick={() => setIsEditingWeight(!isEditingWeight)}
                className="text-[10px] text-emerald-500 hover:underline cursor-pointer flex items-center gap-0.5"
                title="Editar Peso"
              >
                <Edit2 className="w-3 h-3" />
                <span>{isEditingWeight ? 'Fechar' : 'Editar'}</span>
              </button>
            </div>

            {!isEditingWeight ? (
              <span className="text-sm font-bold text-emerald-500 block mt-0.5">
                {profile.weightKg ? `${profile.weightKg} kg` : 'Não informado'}
              </span>
            ) : (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  value={newWeightInput}
                  onChange={(e) => setNewWeightInput(e.target.value === '' ? '' : Number(e.target.value))}
                  min="30"
                  max="300"
                  className={`w-16 px-1.5 py-0.5 rounded text-xs font-mono border ${
                    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                  }`}
                />
                <button
                  onClick={handleSaveWeight}
                  className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                >
                  Ok
                </button>
              </div>
            )}
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block uppercase">IMC Corporal</span>
            <span className="text-sm font-bold text-purple-500">{imc ? `${imc}` : '--'}</span>
          </div>
        </div>

        {/* PROMPT SEMANAL: SOLICITAÇÃO DE ATUALIZAÇÃO DE PESO */}
        <div className={`p-4 rounded-2xl border space-y-3 font-mono transition-all ${
          isLight
            ? 'bg-amber-50/80 border-amber-200 text-slate-800'
            : 'bg-slate-950 border-amber-500/40 text-slate-200 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-500 animate-pulse" />
              <span className="text-xs font-bold uppercase text-amber-600 dark:text-amber-400">
                SOLICITAÇÃO SEMANAL DE PESO
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
              RECALIBRAÇÃO ATIVA
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Deseja atualizar seu peso corporal hoje (atualmente <strong>{profile.weightKg || 70} kg</strong>) para recalibrar o gasto calórico e as metas físicas?
          </p>

          {weightUpdatedMessage && (
            <p className="text-xs font-bold text-emerald-500 flex items-center gap-1">
              ✅ Peso corporal atualizado com sucesso para {profile.weightKg} kg!
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <input
                type="number"
                value={newWeightInput}
                onChange={(e) => setNewWeightInput(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 72"
                min="30"
                max="300"
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono w-28 focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                    : 'bg-slate-900 border-slate-700 text-white focus:border-amber-400'
                }`}
              />
              <span className="text-xs font-bold text-slate-400">kg</span>
            </div>

            <button
              onClick={handleSaveWeight}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
            >
              Confirmar Novo Peso
            </button>
          </div>
        </div>

        {/* Level & XP Progress Bar */}
        {(() => {
          const currentLevel = profile.level || 1;
          const nextLevel = currentLevel + 1;
          // Thresholds
          const baseXP = (currentLevel - 1) * 1000;
          const targetXP = currentLevel * 1000;
          const currentXP = profile.xp || 0;
          const xpNeeded = Math.max(0, targetXP - currentXP);
          const progressPercent = Math.min(
            100,
            Math.max(0, Math.round(((currentXP - baseXP) / (targetXP - baseXP)) * 100))
          );

          const levelTitles: { [key: number]: string } = {
            1: 'Corredor Iniciante (Exploração Urbana)',
            2: 'Dominador de Bairros (Consistência)',
            3: 'Velocista de Elite (Circuito de Elite)',
            4: 'Maratonista Lendário (Odisseia 42K)',
          };

          return (
            <div className={`p-4.5 rounded-2xl border space-y-2.5 font-mono relative overflow-hidden transition-all ${
              isLight
                ? 'bg-orange-50/80 border-orange-200 text-slate-800 shadow-sm'
                : 'bg-slate-950 border-cyan-500/40 text-slate-200 shadow-[0_0_20px_rgba(6,182,212,0.1)]'
            }`}>
              {/* Background ambient particle aura */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs relative z-10">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(6,182,212,0.6)] animate-pulse'
                  }`}>
                    <Zap className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-bold uppercase tracking-wide text-xs flex items-center gap-1.5">
                    PROGRESSO DE NÍVEL:
                    <span className={isLight ? 'text-orange-600 font-extrabold' : 'text-cyan-400 font-extrabold'}>LEVEL {currentLevel}</span>
                    <span className="opacity-60">➔</span>
                    <span className={isLight ? 'text-orange-700 font-extrabold' : 'text-cyan-300 font-extrabold'}>LEVEL {nextLevel}</span>
                  </span>
                </div>

                <div className="text-[11px] font-bold text-right flex items-center gap-1.5 justify-end">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
                  <span className={isLight ? 'text-orange-600' : 'text-cyan-400'}>{currentXP}</span> / <span className="text-slate-400">{targetXP} XP</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] ${isLight ? 'bg-orange-100 text-orange-800' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'}`}>
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Progress Bar Track & Particle Animation Layer */}
              <div className="relative pt-1 pb-1">
                {/* Particle sparks floating above track */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                  <div
                    className="absolute top-0 w-1.5 h-1.5 bg-cyan-300 rounded-full animate-bounce shadow-[0_0_8px_#22d3ee]"
                    style={{ left: `${Math.max(5, Math.min(95, progressPercent - 2))}%`, animationDuration: '1.2s' }}
                  />
                  <div
                    className="absolute bottom-0 w-1 h-1 bg-amber-400 rounded-full animate-ping shadow-[0_0_6px_#fbbf24]"
                    style={{ left: `${Math.max(8, Math.min(92, progressPercent - 8))}%`, animationDuration: '2s' }}
                  />
                  <div
                    className="absolute top-1/2 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]"
                    style={{ left: `${Math.max(2, Math.min(98, progressPercent / 2))}%` }}
                  />
                </div>

                <div className={`w-full h-4 rounded-full p-0.5 overflow-hidden border relative z-10 ${
                  isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div
                    className={`h-full rounded-full transition-all duration-1000 relative overflow-hidden ${
                      isLight
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 shadow-sm'
                        : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  >
                    {/* Shimmer sweep effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.6)_50%,transparent_100%)] animate-shimmer"
                         style={{ backgroundSize: '200% 100%' }} />

                    {/* Glowing particle flare at leading tip */}
                    {progressPercent > 2 && (
                      <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_12px_#ffffff] animate-pulse" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5 relative z-10">
                <span className="truncate max-w-[220px] sm:max-w-none">
                  Próximo Título: <strong className={isLight ? 'text-slate-800' : 'text-slate-200'}>{levelTitles[nextLevel] || `Nível ${nextLevel}`}</strong>
                </span>
                <span className="font-bold text-amber-500 shrink-0 flex items-center gap-1">
                  {xpNeeded > 0 ? (
                    <>
                      <Flame className="w-3 h-3 text-amber-500 animate-pulse" />
                      <span>+{xpNeeded} XP para subir de nível!</span>
                    </>
                  ) : (
                    '🎉 Pronto para o Próximo Nível!'
                  )}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Configuração de Metas Semanais (com progresso visual baseado no histórico) */}
      <WeeklyGoalsConfig
        history={profile.history}
        totalDistanceKm={profile.totalDistanceKm}
        weeklyGoals={profile.weeklyGoals}
        onSaveWeeklyGoals={(newGoals) => {
          if (onUpdateWeeklyGoals) {
            onUpdateWeeklyGoals(newGoals);
          }
        }}
        theme={theme}
      />

      {/* Conquered Sectors Section */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
        <h3 className="text-sm font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400" /> Setores Mapeados & Dominados
        </h3>

        {profile.conqueredSectors.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono italic">
            Nenhum setor conquistado ainda. Complete o Nível 1 ou Nível 2 para dominar territórios na sua cidade!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.conqueredSectors.map((sector) => (
              <div key={sector} className="p-3 bg-slate-950/80 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                <span className="text-xl">🏆</span>
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 uppercase block">SETOR SOB CUSTÓDIA</span>
                  <p className="text-xs font-bold text-white">{sector}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Badges Collection */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" /> Insígnias & Conquistas Táticas
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {profile.badges.map((b) => (
            <div
              key={b.id}
              className={`p-3.5 rounded-2xl border flex flex-col items-center text-center gap-2 transition ${
                b.unlockedAt
                  ? 'bg-slate-950 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-600 opacity-60'
              }`}
            >
              <span className="text-3xl">{b.icon}</span>
              <div>
                <h4 className="text-xs font-bold font-mono">{b.title}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mission Log / History */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" /> Histórico de Missões
        </h3>

        {profile.history.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono italic">
            Nenhuma missão registrada no log de navegação.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.history.map((h) => (
              <div key={h.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono text-slate-400">{h.date}</span>
                  <h4 className="text-sm font-bold text-white">{h.sectorConquered}</h4>
                  <p className="text-xs text-cyan-400 font-mono">
                    {(h.totalDistanceMeters / 1000).toFixed(2)} km • Pace {formatPace(h.avgPaceMinKm)} • {formatTime(h.durationSeconds)}
                  </p>
                </div>

                <div className="text-right flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-500/30">
                    +{h.xpGained} XP
                  </span>
                  <button
                    type="button"
                    onClick={() => openMissionShare(h)}
                    className="p-2 rounded-lg border border-cyan-500/30 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 transition cursor-pointer"
                    title="Compartilhar esta missão nas redes sociais"
                    aria-label="Compartilhar missão"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {sharePayload && (
        <SocialShareModal
          payload={sharePayload}
          onClose={() => setSharePayload(null)}
          theme={theme}
        />
      )}
    </div>
  );
};
