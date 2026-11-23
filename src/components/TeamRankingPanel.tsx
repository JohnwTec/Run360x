import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crown,
  FileBadge2,
  Medal,
  Plus,
  Route,
  Search,
  Shield,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { RunningTeam } from '../types';
import { formatPace } from '../utils/geo';
import { AGE_CATEGORIES } from '../data/rankingsData';
import { TEAM_ACCENT_STYLES } from '../utils/teamsStore';

export type TeamRankingSortMode = 'points' | 'km' | 'monthly' | 'avg-member';

interface TeamRankingPanelProps {
  teams: RunningTeam[];
  isTeamCreator: (team: RunningTeam) => boolean;
  onOpenCreateTeam?: () => void;
  onManageTeam?: (team: RunningTeam) => void;
  theme?: 'dark' | 'light';
}

const SORT_MODES: { id: TeamRankingSortMode; label: string }[] = [
  { id: 'points', label: 'Pontuação (XP)' },
  { id: 'km', label: 'Quilometragem (KM)' },
  { id: 'monthly', label: 'Mês Atual (XP)' },
  { id: 'avg-member', label: 'Média / Atleta' },
];

export const TeamRankingPanel: React.FC<TeamRankingPanelProps> = ({
  teams,
  isTeamCreator,
  onOpenCreateTeam,
  onManageTeam,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [sortMode, setSortMode] = useState<TeamRankingSortMode>('points');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const getScore = (team: RunningTeam): number => {
    if (sortMode === 'points') return team.totalPoints;
    if (sortMode === 'km') return team.totalKm;
    if (sortMode === 'monthly') return team.monthlyPoints;
    return Math.round(team.totalPoints / Math.max(1, team.memberCount));
  };

  const formatPrimaryMetric = (team: RunningTeam): { value: string; unit: string; sub: string } => {
    if (sortMode === 'points') {
      return {
        value: team.totalPoints.toLocaleString('pt-BR'),
        unit: 'XP',
        sub: `${team.totalKm.toFixed(1)} km acumulados`,
      };
    }
    if (sortMode === 'km') {
      return {
        value: team.totalKm.toFixed(1),
        unit: 'km',
        sub: `${team.totalPoints.toLocaleString('pt-BR')} XP acumulados`,
      };
    }
    if (sortMode === 'monthly') {
      return {
        value: team.monthlyPoints.toLocaleString('pt-BR'),
        unit: 'XP/mês',
        sub: `${team.monthlyKm.toFixed(1)} km no mês`,
      };
    }
    const perMember = Math.round(team.totalPoints / Math.max(1, team.memberCount));
    return {
      value: perMember.toLocaleString('pt-BR'),
      unit: 'XP/atleta',
      sub: `${(team.totalKm / Math.max(1, team.memberCount)).toFixed(1)} km por integrante`,
    };
  };

  const rankedTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? teams.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.tag.toLowerCase().includes(q) ||
            t.city.toLowerCase().includes(q) ||
            t.creatorName.toLowerCase().includes(q)
        )
      : [...teams];

    filtered.sort((a, b) => {
      const diff = getScore(b) - getScore(a);
      if (diff !== 0) return diff;
      return b.totalKm - a.totalKm;
    });

    return filtered;
  }, [teams, searchQuery, sortMode]);

  const top3 = rankedTeams.slice(0, 3);
  const myBestRankIdx = rankedTeams.findIndex((t) => isTeamCreator(t));
  const myBestTeam = myBestRankIdx >= 0 ? rankedTeams[myBestRankIdx] : null;

  return (
    <div className="space-y-6">
      {/* Controls & Search Header */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Classificação Coletiva Oficial</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{rankedTeams.length} equipes ativas</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black tracking-tight">
            Ranking de Equipes RUN360X
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metric Segmented Control */}
          <div
            className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}
          >
            {SORT_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSortMode(m.id)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  sortMode === m.id
                    ? isLight
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'bg-cyan-400 text-slate-950'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {onOpenCreateTeam && (
            <button
              type="button"
              onClick={onOpenCreateTeam}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                isLight
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Criar Equipe</span>
            </button>
          )}
        </div>
      </div>

      {/* Search + User Team Position Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar equipe por nome, sigla, cidade ou capitão..."
            className={`w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl border text-xs focus:outline-none ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 focus:border-orange-500'
                : 'bg-slate-900 border-slate-800 text-slate-100 focus:border-cyan-400'
            }`}
          />
        </div>

        {myBestTeam && (
          <div
            className={`px-4 py-2.5 rounded-xl border flex items-center gap-3 text-xs font-mono tabular-nums ${
              isLight
                ? 'bg-orange-50 border-orange-200 text-orange-950'
                : 'bg-cyan-950/50 border-cyan-500/35 text-cyan-100'
            }`}
          >
            <span className="font-black text-amber-400">#{myBestRankIdx + 1}</span>
            <span className="font-sans font-bold truncate max-w-[160px]">{myBestTeam.name}</span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>{formatPrimaryMetric(myBestTeam).value} {formatPrimaryMetric(myBestTeam).unit}</span>
          </div>
        )}
      </div>

      {/* Top 3 Team Podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((team, idx) => {
            const metric = formatPrimaryMetric(team);
            const accent = TEAM_ACCENT_STYLES[team.accentColor] || TEAM_ACCENT_STYLES.cyan;
            const isMine = isTeamCreator(team);
            const podiumLabels = [
              { medal: '🥇', rank: '1º Lugar', borderDark: 'border-amber-400/50', borderLight: 'border-amber-300' },
              { medal: '🥈', rank: '2º Lugar', borderDark: 'border-slate-500/50', borderLight: 'border-slate-300' },
              { medal: '🥉', rank: '3º Lugar', borderDark: 'border-orange-500/50', borderLight: 'border-orange-200' },
            ][idx];

            return (
              <div
                key={team.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition ${
                  isLight
                    ? `bg-white ${podiumLabels.borderLight}`
                    : `bg-slate-900 ${podiumLabels.borderDark}`
                } ${isMine ? 'ring-2 ring-cyan-400' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl shrink-0 ${accent.badgeBg} ${accent.border}`}
                    >
                      {team.emblem}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                        <span>{podiumLabels.medal}</span>
                        <span>{podiumLabels.rank}</span>
                        {isMine && (
                          <>
                            <span aria-hidden="true" className="text-slate-500">·</span>
                            <span className="text-cyan-400">Sua equipe</span>
                          </>
                        )}
                      </div>
                      <h4 className="font-black text-base truncate mt-0.5">
                        {team.name} <span className="font-mono text-xs text-slate-400">[{team.tag}]</span>
                      </h4>
                      <p className="text-xs text-slate-400 truncate">
                        {team.city} · Cap. {team.creatorName}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-400">Marca no Ranking</div>
                    <div className={`text-2xl font-black font-mono tabular-nums ${isLight ? 'text-orange-600' : 'text-cyan-300'}`}>
                      {metric.value}{' '}
                      <span className="text-xs font-semibold text-slate-400">{metric.unit}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">{metric.sub}</div>
                  </div>

                  <div className="text-right font-mono tabular-nums text-xs">
                    <div className="font-bold">{team.memberCount} atletas</div>
                    <div className="text-slate-400">{formatPace(team.avgPaceMinKm)} /km</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    {idx === 0 ? <Medal className="w-3.5 h-3.5 text-amber-400" /> : <FileBadge2 className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{idx === 0 ? 'Troféu + Certificado' : 'Certificado Pódio'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      onManageTeam
                        ? onManageTeam(team)
                        : setExpandedTeamId((prev) => (prev === team.id ? null : team.id))
                    }
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                      isLight
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-cyan-300 hover:bg-slate-800'
                    }`}
                  >
                    {isMine && onManageTeam ? 'Gerenciar' : 'Ver elenco'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Teams Leaderboard Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div
          className={`px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <span className="text-xs font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Classificação Geral de Equipes ({rankedTeams.length})</span>
          </span>
          <span className="text-xs text-slate-400">
            Clique em uma equipe para ver seus integrantes
          </span>
        </div>

        {rankedTeams.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-semibold">Nenhuma equipe encontrada para essa busca.</p>
            {onOpenCreateTeam && (
              <button
                type="button"
                onClick={onOpenCreateTeam}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeira Equipe</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr
                  className={`border-b font-mono uppercase text-[11px] ${
                    isLight
                      ? 'bg-slate-50/70 border-slate-200 text-slate-500'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}
                >
                  <th className="py-3 px-4">Pos</th>
                  <th className="py-3 px-4">Equipe</th>
                  <th className="py-3 px-4 text-right">Integrantes</th>
                  <th className="py-3 px-4 text-right">Pontuação Total</th>
                  <th className="py-3 px-4 text-right">Quilometragem</th>
                  <th className="py-3 px-4 text-right">Pace Médio</th>
                  <th className="py-3 px-4 text-right">Elenco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-mono tabular-nums">
                {rankedTeams.map((team, idx) => {
                  const pos = idx + 1;
                  const isMine = isTeamCreator(team);
                  const isExpanded = expandedTeamId === team.id;

                  return (
                    <React.Fragment key={team.id}>
                      <tr
                        className={`transition ${
                          isMine
                            ? isLight
                              ? 'bg-orange-50/80'
                              : 'bg-cyan-500/10'
                            : isLight
                            ? 'hover:bg-slate-50'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap font-black">
                          {pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`}
                        </td>

                        <td className="py-3.5 px-4 font-sans">
                          <div className="flex items-center gap-2.5 min-w-[200px]">
                            <span className="text-xl shrink-0">{team.emblem}</span>
                            <div className="min-w-0">
                              <div className="font-bold flex items-center gap-1.5 flex-wrap">
                                <span>{team.name}</span>
                                <span className="font-mono text-[11px] text-slate-400">[{team.tag}]</span>
                                {isMine && (
                                  <span className="text-[11px] font-semibold text-cyan-400">· Sua equipe</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {team.city} · Cap. {team.creatorName}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{team.memberCount}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-amber-400 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" />
                            <span>{team.totalPoints.toLocaleString('pt-BR')} XP</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-cyan-400 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Route className="w-3.5 h-3.5" />
                            <span>{team.totalKm.toFixed(1)} km</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {formatPace(team.avgPaceMinKm)} /km
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-sans">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTeamId((prev) => (prev === team.id ? null : team.id))
                            }
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                              isLight
                                ? 'text-slate-700 hover:bg-slate-200/70'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span>{isExpanded ? 'Ocultar' : 'Ver'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className={isLight ? 'bg-slate-50/70' : 'bg-slate-950/60'}>
                          <td colSpan={7} className="px-5 py-4 font-sans">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                              <div className="text-xs text-slate-400">
                                {team.motto ? `“${team.motto}”` : `Elenco oficial da equipe ${team.name}`}
                              </div>
                              {onManageTeam && (
                                <button
                                  type="button"
                                  onClick={() => onManageTeam(team)}
                                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    isMine
                                      ? isLight
                                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                                        : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                                      : isLight
                                      ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                  }`}
                                >
                                  {isMine ? 'Adicionar / Gerenciar Integrantes' : 'Abrir Detalhes da Equipe'}
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {team.members.map((member) => {
                                const ageShort =
                                  AGE_CATEGORIES.find((c) => c.id === member.ageCategory)?.shortLabel ||
                                  member.ageCategory;
                                return (
                                  <div
                                    key={member.memberId}
                                    className={`px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                                      isLight
                                        ? 'bg-white border-slate-200'
                                        : 'bg-slate-900 border-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-base shrink-0">{member.avatar}</span>
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold truncate flex items-center gap-1">
                                          <span>{member.name}</span>
                                          {member.role === 'capitao' && (
                                            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                                          )}
                                        </div>
                                        <div className="text-[11px] text-slate-400 truncate">
                                          {member.role === 'capitao' ? 'Capitão' : 'Integrante'} · {ageShort}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right font-mono tabular-nums text-[11px] shrink-0">
                                      <div className="font-bold text-amber-400">
                                        {member.totalPoints.toLocaleString('pt-BR')} XP
                                      </div>
                                      <div className="text-slate-400">{member.totalKm.toFixed(1)} km</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamRankingPanel;
