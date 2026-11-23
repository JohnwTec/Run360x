import React, { useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  Crown,
  FileBadge2,
  Flame,
  Medal,
  Route,
  Share2,
  Shield,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { AgeCategoryId, AthleteGender, RankingAthlete, UserProfile } from '../types';
import {
  AGE_CATEGORIES,
  COMMUNITY_RANKING_ATHLETES,
  getAgeCategoryFromAge,
  getAgeCategoryLabel,
  getGenderLabel,
} from '../data/rankingsData';
import { formatPace } from '../utils/geo';
import { SocialShareModal, SocialSharePayload } from './SocialShareModal';
import { TeamRankingPanel } from './TeamRankingPanel';
import { UseCommunityTeamsResult } from '../utils/teamsStore';

type RankingTab = 'pontuacao-geral' | 'km-geral' | 'mes-faixa' | 'ano-faixa' | 'equipes';
type GenderFilter = 'todos' | AthleteGender;
type AgeFilter = 'todas' | AgeCategoryId;
type PeriodMetric = 'points' | 'km';

interface RankingsViewProps {
  userProfile: UserProfile;
  teamsStore?: UseCommunityTeamsResult;
  onUpdateGender?: (gender: AthleteGender) => void;
  onOpenCreateTeam?: () => void;
  onManageTeam?: (teamId: string) => void;
  theme?: 'dark' | 'light';
}

export const RankingsView: React.FC<RankingsViewProps> = ({
  userProfile,
  teamsStore,
  onUpdateGender,
  onOpenCreateTeam,
  onManageTeam,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const userGender: AthleteGender = userProfile.gender || 'masculino';
  const userAgeCategory: AgeCategoryId = getAgeCategoryFromAge(userProfile.age);

  const [rankingTab, setRankingTab] = useState<RankingTab>('pontuacao-geral');
  const [overallGenderFilter, setOverallGenderFilter] = useState<GenderFilter>('todos');
  const [overallAgeFilter, setOverallAgeFilter] = useState<AgeFilter>('todas');

  const [categoryGender, setCategoryGender] = useState<AthleteGender>(userGender);
  const [selectedAgeCategory, setSelectedAgeCategory] = useState<AgeCategoryId>(userAgeCategory);
  const [periodMetric, setPeriodMetric] = useState<PeriodMetric>('points');

  const [showAwardsModal, setShowAwardsModal] = useState<boolean>(false);
  const [sharePayload, setSharePayload] = useState<SocialSharePayload | null>(null);

  const currentMonthLabel = useMemo(() => {
    const label = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, []);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentSemester = useMemo(() => (new Date().getMonth() < 6 ? '1º Semestre' : '2º Semestre'), []);

  // Build live RankingAthlete entry for the logged/local athlete and merge with community athletes
  const allAthletes: RankingAthlete[] = useMemo(() => {
    const now = new Date();
    const history = userProfile.history || [];

    const historyMonthlyPoints = history.reduce((acc, item) => acc + (item.xpGained || 0), 0);
    const historyMonthlyKm = history.reduce((acc, item) => acc + (item.totalDistanceMeters || 0) / 1000, 0);
    const avgPace =
      history.length > 0
        ? history.reduce((acc, item) => acc + (item.avgPaceMinKm || 5.5), 0) / history.length
        : 5.45;

    const totalPoints = Math.max(0, Math.round(userProfile.xp || 0));
    const totalKm = Number((userProfile.totalDistanceKm || 0).toFixed(1));

    const monthlyPoints =
      historyMonthlyPoints > 0 ? Math.round(historyMonthlyPoints) : Math.round(totalPoints * 0.45);
    const monthlyKm =
      historyMonthlyKm > 0 ? Number(historyMonthlyKm.toFixed(1)) : Number((totalKm * 0.45).toFixed(1));

    const yearlyPoints = Math.max(monthlyPoints, totalPoints);
    const yearlyKm = Math.max(monthlyKm, totalKm);

    const currentUserAthlete: RankingAthlete = {
      id: `current-user-${now.getFullYear()}`,
      name: userProfile.name?.trim() || 'Atleta Alpha',
      city: 'Você • Radar Ativo',
      age: userProfile.age || 28,
      gender: userGender,
      ageCategory: userAgeCategory,
      level: userProfile.level || 1,
      totalPoints,
      totalKm,
      monthlyPoints,
      monthlyKm,
      yearlyPoints,
      yearlyKm,
      avgPaceMinKm: Number(avgPace.toFixed(2)),
      avatar: userGender === 'feminino' ? '🏃‍♀️' : '🏃‍♂️',
      isCurrentUser: true,
    };

    return [...COMMUNITY_RANKING_ATHLETES, currentUserAthlete];
  }, [userProfile, userGender, userAgeCategory]);

  // Filter & sort athletes according to active ranking mode
  const rankedAthletes = useMemo(() => {
    let filtered = [...allAthletes];

    if (rankingTab === 'pontuacao-geral' || rankingTab === 'km-geral') {
      if (overallGenderFilter !== 'todos') {
        filtered = filtered.filter((a) => a.gender === overallGenderFilter);
      }
      if (overallAgeFilter !== 'todas') {
        filtered = filtered.filter((a) => a.ageCategory === overallAgeFilter);
      }
    } else {
      filtered = filtered.filter(
        (a) => a.gender === categoryGender && a.ageCategory === selectedAgeCategory
      );
    }

    const getSortValue = (athlete: RankingAthlete): number => {
      if (rankingTab === 'pontuacao-geral') return athlete.totalPoints;
      if (rankingTab === 'km-geral') return athlete.totalKm;
      if (rankingTab === 'mes-faixa') {
        return periodMetric === 'points' ? athlete.monthlyPoints : athlete.monthlyKm;
      }
      return periodMetric === 'points' ? athlete.yearlyPoints : athlete.yearlyKm;
    };

    filtered.sort((a, b) => {
      const diff = getSortValue(b) - getSortValue(a);
      if (diff !== 0) return diff;
      return b.totalPoints - a.totalPoints;
    });

    return filtered;
  }, [
    allAthletes,
    rankingTab,
    overallGenderFilter,
    overallAgeFilter,
    categoryGender,
    selectedAgeCategory,
    periodMetric,
  ]);

  const getPrimaryDisplay = (athlete: RankingAthlete) => {
    if (rankingTab === 'pontuacao-geral') {
      return {
        value: `${athlete.totalPoints.toLocaleString('pt-BR')} XP`,
        raw: athlete.totalPoints,
        unit: 'XP',
        secondary: `${athlete.totalKm.toFixed(1)} km`,
      };
    }
    if (rankingTab === 'km-geral') {
      return {
        value: `${athlete.totalKm.toFixed(1)} km`,
        raw: athlete.totalKm,
        unit: 'km',
        secondary: `${athlete.totalPoints.toLocaleString('pt-BR')} XP`,
      };
    }
    if (rankingTab === 'mes-faixa') {
      return periodMetric === 'points'
        ? {
            value: `${athlete.monthlyPoints.toLocaleString('pt-BR')} XP`,
            raw: athlete.monthlyPoints,
            unit: 'XP',
            secondary: `${athlete.monthlyKm.toFixed(1)} km no mês`,
          }
        : {
            value: `${athlete.monthlyKm.toFixed(1)} km`,
            raw: athlete.monthlyKm,
            unit: 'km',
            secondary: `${athlete.monthlyPoints.toLocaleString('pt-BR')} XP no mês`,
          };
    }
    return periodMetric === 'points'
      ? {
          value: `${athlete.yearlyPoints.toLocaleString('pt-BR')} XP`,
          raw: athlete.yearlyPoints,
          unit: 'XP',
          secondary: `${athlete.yearlyKm.toFixed(1)} km no ano`,
        }
      : {
          value: `${athlete.yearlyKm.toFixed(1)} km`,
          raw: athlete.yearlyKm,
          unit: 'km',
          secondary: `${athlete.yearlyPoints.toLocaleString('pt-BR')} XP no ano`,
        };
  };

  const currentUserRankIndex = rankedAthletes.findIndex((a) => a.isCurrentUser);
  const currentUserEntry = currentUserRankIndex >= 0 ? rankedAthletes[currentUserRankIndex] : null;
  const podiumTop3 = rankedAthletes.slice(0, 3);
  const thirdPlaceAthlete = rankedAthletes[2] || null;

  const rankingTitleMap: Record<RankingTab, { title: string; subtitle: string }> = {
    'pontuacao-geral': {
      title: 'Ranking Geral — Pontuação Adquirida (XP)',
      subtitle: 'Classificação acumulada por pontuação de treinos, orbes coletados e setores conquistados.',
    },
    'km-geral': {
      title: 'Ranking Geral — Quilometragem Alcançada (KM)',
      subtitle: 'Distância total acumulada pelos atletas em todas as missões oficiais do RUN360X.',
    },
    'mes-faixa': {
      title: `Melhores do Mês (${currentMonthLabel})`,
      subtitle: `Categoria ${getAgeCategoryLabel(selectedAgeCategory)} • ${getGenderLabel(categoryGender)}`,
    },
    'ano-faixa': {
      title: `Melhores do Ano (${currentYear})`,
      subtitle: `Categoria ${getAgeCategoryLabel(selectedAgeCategory)} • ${getGenderLabel(categoryGender)} — Elegível à Medalha + Certificado Anual`,
    },
    equipes: {
      title: 'Ranking Oficial de Equipes',
      subtitle: 'Classificação coletiva somando pontuação (XP) e quilometragem de todos os integrantes da equipe.',
    },
  };

  const handleQuickGenderChange = (nextGender: AthleteGender) => {
    setCategoryGender(nextGender);
    if (onUpdateGender) {
      onUpdateGender(nextGender);
    }
  };

  const handleOpenShareRanking = () => {
    const rankNum = currentUserRankIndex >= 0 ? `#${currentUserRankIndex + 1}` : 'Em disputa';
    const userPrimary = currentUserEntry ? getPrimaryDisplay(currentUserEntry) : null;
    const categorySummary = `${getAgeCategoryLabel(userAgeCategory)} • ${getGenderLabel(userGender)}`;

    setSharePayload({
      kind: 'profile',
      badge: `RANKING RUN360X • ${categorySummary.toUpperCase()}`,
      title: `${userProfile.name || 'Atleta RUN360X'} — ${rankNum}`,
      subtitle: `${rankingTitleMap[rankingTab].title}`,
      metrics: [
        { label: 'Posição Atual', value: rankNum },
        { label: 'Marca no Ranking', value: userPrimary ? userPrimary.value : `${userProfile.xp} XP` },
        { label: 'Faixa Etária', value: AGE_CATEGORIES.find((c) => c.id === userAgeCategory)?.shortLabel || '21 à 30' },
        { label: 'Categoria', value: getGenderLabel(userGender) },
      ],
      defaultCaption:
        `🏆 Estou na posição ${rankNum} no ${rankingTitleMap[rankingTab].title} do RUN360X!\n` +
        `👤 Categoria: ${categorySummary}\n` +
        `⚡ Marca atual: ${userPrimary ? userPrimary.value : `${userProfile.xp} XP`}\n` +
        `🎖️ Os melhores do semestre ganham Certificado Personalizado e os melhores do ano ganham Medalha Oficial + Certificado!\n\n` +
        `#RUN360X #RankingCorrida #Corrida #Running`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Official Awards Banner (Semestre & Ano) */}
      <div
        className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 ${
          isLight
            ? 'bg-gradient-to-br from-amber-50 via-white to-orange-50 border-orange-200 shadow-sm'
            : 'bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border-amber-500/35 shadow-[0_0_40px_rgba(245,158,11,0.12)]'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border ${
                  isLight
                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                }`}
              >
                <Crown className="w-3.5 h-3.5" /> RANKINGS OFICIAIS & PREMIAÇÃO RUN360X
              </span>
              <span
                className={`text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-lg border ${
                  isLight
                    ? 'bg-white text-slate-600 border-slate-200'
                    : 'bg-slate-950 text-cyan-300 border-cyan-500/30'
                }`}
              >
                5 Faixas Etárias • Masculino & Feminino
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase">
              Classificação Geral, Mensal e Anual
            </h2>
            <p className={`text-xs sm:text-sm font-mono leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Dispute o topo em Pontuação Geral, Quilometragem Geral e nos pódios do Mês e do Ano divididos por faixa etária (Até 20, 21 à 30, 31 à 40, 41 à 50 e 50+) nas categorias Masculino e Feminino.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowAwardsModal(true)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-2 border ${
                isLight
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>VER CERTIFICADO & MEDALHA</span>
            </button>

            <button
              type="button"
              onClick={handleOpenShareRanking}
              className={`px-4 py-2.5 rounded-2xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-2 border ${
                isLight
                  ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                  : 'bg-slate-950 hover:bg-slate-800 text-cyan-300 border-cyan-500/40'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>COMPARTILHAR POSIÇÃO</span>
            </button>
          </div>
        </div>

        {/* Premiação Oficial Cards: Semestre vs Ano */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-5 pt-5 border-t border-amber-500/20">
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              isLight
                ? 'bg-white/90 border-sky-200'
                : 'bg-slate-950/80 border-cyan-500/30'
            }`}
          >
            <div
              className={`p-3 rounded-2xl border shrink-0 ${
                isLight
                  ? 'bg-sky-50 border-sky-200 text-sky-600'
                  : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
              }`}
            >
              <FileBadge2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black font-mono uppercase tracking-wide">
                  Premiação Semestral ({currentSemester})
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isLight ? 'bg-sky-100 text-sky-700' : 'bg-cyan-500/20 text-cyan-300'
                  }`}
                >
                  MELHORES DO SEMESTRE
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Os melhores atletas do semestre em cada categoria e faixa etária ganharão{' '}
                <strong className={isLight ? 'text-sky-700' : 'text-cyan-300'}>
                  Certificado Personalizado Oficial
                </strong>{' '}
                com nome, colocação, pontuação e quilometragem conquistada.
              </p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              isLight
                ? 'bg-white/90 border-amber-300'
                : 'bg-slate-950/80 border-amber-500/40'
            }`}
          >
            <div
              className={`p-3 rounded-2xl border shrink-0 ${
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              <Medal className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black font-mono uppercase tracking-wide">
                  Premiação Anual ({currentYear})
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  MELHORES DO ANO
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Os campeões e melhores atletas do ano em cada faixa etária (Masculino e Feminino) ganharão{' '}
                <strong className={isLight ? 'text-amber-700' : 'text-amber-300'}>
                  Medalha Exclusiva + Certificado Personalizado
                </strong>{' '}
                de honra ao mérito esportivo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Ranking Mode Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            id: 'pontuacao-geral' as RankingTab,
            label: 'Pontuação Geral',
            desc: 'Total de XP adquirido',
            icon: <Zap className="w-4 h-4" />,
          },
          {
            id: 'km-geral' as RankingTab,
            label: 'Quilometragem Geral',
            desc: 'Total de KM alcançados',
            icon: <Route className="w-4 h-4" />,
          },
          {
            id: 'mes-faixa' as RankingTab,
            label: 'Melhores do Mês',
            desc: 'Por faixa etária & sexo',
            icon: <Calendar className="w-4 h-4" />,
          },
          {
            id: 'ano-faixa' as RankingTab,
            label: 'Melhores do Ano',
            desc: 'Medalha + Certificado',
            icon: <Trophy className="w-4 h-4" />,
          },
          {
            id: 'equipes' as RankingTab,
            label: 'Ranking de Equipes',
            desc: `${teamsStore?.teams.length || 0} equipes na disputa`,
            icon: <Shield className="w-4 h-4" />,
          },
        ].map((tab) => {
          const isActive = rankingTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRankingTab(tab.id)}
              className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-center gap-3 ${
                isActive
                  ? isLight
                    ? 'bg-orange-500 border-orange-500 text-white shadow-md'
                    : 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                  : isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl border shrink-0 ${
                  isActive
                    ? isLight
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-cyan-400 text-slate-950 border-cyan-300'
                    : isLight
                    ? 'bg-slate-100 border-slate-200 text-orange-600'
                    : 'bg-slate-950 border-slate-800 text-cyan-400'
                }`}
              >
                {tab.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black font-mono uppercase tracking-wide truncate">
                  {tab.label}
                </div>
                <div
                  className={`text-[11px] font-mono truncate ${
                    isActive
                      ? isLight
                        ? 'text-orange-100'
                        : 'text-cyan-300'
                      : isLight
                      ? 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                >
                  {tab.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Team Ranking View OR Individual Athlete Rankings */}
      {rankingTab === 'equipes' && teamsStore ? (
        <TeamRankingPanel
          teams={teamsStore.teams}
          isTeamCreator={teamsStore.isTeamCreator}
          onOpenCreateTeam={onOpenCreateTeam}
          onManageTeam={onManageTeam ? (team) => onManageTeam(team.id) : onOpenCreateTeam}
          theme={theme}
        />
      ) : (
      <>
      {/* Filters Panel: Gender (Masculino / Feminino) + Age Brackets (Até 20, 21 à 30, 31 à 40, 41 à 50, 50+) */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 space-y-4 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Gender Filter */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" /> Categoria por Gênero
            </span>
            <div className="flex flex-wrap gap-2">
              {(rankingTab === 'pontuacao-geral' || rankingTab === 'km-geral') && (
                <button
                  type="button"
                  onClick={() => setOverallGenderFilter('todos')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                    overallGenderFilter === 'todos'
                      ? isLight
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-cyan-500 border-cyan-400 text-slate-950'
                      : isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  Geral (Todos)
                </button>
              )}

              {(['masculino', 'feminino'] as AthleteGender[]).map((g) => {
                const isSelected =
                  rankingTab === 'pontuacao-geral' || rankingTab === 'km-geral'
                    ? overallGenderFilter === g
                    : categoryGender === g;

                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      if (rankingTab === 'pontuacao-geral' || rankingTab === 'km-geral') {
                        setOverallGenderFilter(g);
                      } else {
                        setCategoryGender(g);
                      }
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? g === 'feminino'
                          ? 'bg-fuchsia-500 border-fuchsia-400 text-white shadow-sm'
                          : isLight
                          ? 'bg-sky-600 border-sky-600 text-white shadow-sm'
                          : 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-sm'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>{g === 'feminino' ? '♀' : '♂'}</span>
                    <span>{getGenderLabel(g)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period metric toggle on Monthly / Annual tabs OR Athlete Profile Category Badge */}
          <div className="flex flex-wrap items-center gap-3">
            {(rankingTab === 'mes-faixa' || rankingTab === 'ano-faixa') && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Critério do Ranking
                </span>
                <div
                  className={`inline-flex p-1 rounded-xl border ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPeriodMetric('points')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      periodMetric === 'points'
                        ? isLight
                          ? 'bg-orange-500 text-white'
                          : 'bg-cyan-500 text-slate-950'
                        : isLight
                        ? 'text-slate-600'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Por Pontos (XP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodMetric('km')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      periodMetric === 'km'
                        ? isLight
                          ? 'bg-orange-500 text-white'
                          : 'bg-cyan-500 text-slate-950'
                        : isLight
                        ? 'text-slate-600'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Por Quilometragem (KM)
                  </button>
                </div>
              </div>
            )}

            {/* Quick Athlete Category Confirmation */}
            <div
              className={`px-3.5 py-2 rounded-2xl border text-xs font-mono flex items-center gap-3 ${
                isLight
                  ? 'bg-orange-50/70 border-orange-200 text-slate-800'
                  : 'bg-slate-950 border-cyan-500/25 text-slate-200'
              }`}
            >
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Sua Categoria Inscrita</span>
                <span className="font-bold">
                  {getAgeCategoryLabel(userAgeCategory)} • {getGenderLabel(userGender)}
                </span>
              </div>
              {onUpdateGender && (
                <button
                  type="button"
                  onClick={() => handleQuickGenderChange(userGender === 'masculino' ? 'feminino' : 'masculino')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                    isLight
                      ? 'bg-white border-orange-300 text-orange-700 hover:bg-orange-100'
                      : 'bg-slate-900 border-cyan-500/40 text-cyan-300 hover:bg-cyan-950'
                  }`}
                  title="Alternar seu gênero de competição nos rankings"
                >
                  Trocar ({userGender === 'masculino' ? 'Fem' : 'Masc'})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Age Bracket Selector (5 exact brackets) */}
        <div className="space-y-1.5 pt-3 border-t border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
            Faixa Etária
          </span>
          <div className="flex flex-wrap gap-2">
            {(rankingTab === 'pontuacao-geral' || rankingTab === 'km-geral') && (
              <button
                type="button"
                onClick={() => setOverallAgeFilter('todas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                  overallAgeFilter === 'todas'
                    ? isLight
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-amber-500 border-amber-400 text-slate-950'
                    : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                Todas as Faixas
              </button>
            )}

            {AGE_CATEGORIES.map((cat) => {
              const isSelected =
                rankingTab === 'pontuacao-geral' || rankingTab === 'km-geral'
                  ? overallAgeFilter === cat.id
                  : selectedAgeCategory === cat.id;
              const isUserBracket = cat.id === userAgeCategory;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (rankingTab === 'pontuacao-geral' || rankingTab === 'km-geral') {
                      setOverallAgeFilter(cat.id);
                    } else {
                      setSelectedAgeCategory(cat.id);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? isLight
                        ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                        : 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-[0_0_14px_rgba(6,182,212,0.3)]'
                      : isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span>{cat.label}</span>
                  {isUserBracket && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                        isSelected
                          ? 'bg-black/20 text-white'
                          : isLight
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}
                    >
                      VOCÊ
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Ranking Header + Current User Position Highlight */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-black uppercase tracking-wide flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>{rankingTitleMap[rankingTab].title}</span>
          </h3>
          <p className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {rankingTitleMap[rankingTab].subtitle}
          </p>
        </div>

        {currentUserEntry && (
          <div
            className={`px-4 py-2.5 rounded-2xl border flex items-center gap-4 text-xs font-mono ${
              isLight
                ? 'bg-orange-50 border-orange-300 text-orange-950'
                : 'bg-cyan-950/60 border-cyan-400/40 text-cyan-100'
            }`}
          >
            <div>
              <span className="text-[10px] uppercase opacity-75 block">Sua Posição</span>
              <span className="text-lg font-black text-amber-400">#{currentUserRankIndex + 1}</span>
            </div>
            <div className="h-7 w-px bg-current opacity-20" />
            <div>
              <span className="text-[10px] uppercase opacity-75 block">Sua Marca</span>
              <span className="font-bold">{getPrimaryDisplay(currentUserEntry).value}</span>
            </div>
            {thirdPlaceAthlete && currentUserRankIndex >= 3 && (
              <>
                <div className="h-7 w-px bg-current opacity-20 hidden sm:block" />
                <div className="hidden sm:block">
                  <span className="text-[10px] uppercase opacity-75 block">Para o Pódio (Top 3)</span>
                  <span className="font-bold text-emerald-400">
                    +
                    {Math.max(
                      1,
                      Math.round(
                        getPrimaryDisplay(thirdPlaceAthlete).raw -
                          getPrimaryDisplay(currentUserEntry).raw
                      )
                    ).toLocaleString('pt-BR')}{' '}
                    {getPrimaryDisplay(currentUserEntry).unit}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Top 3 Podium Cards */}
      {podiumTop3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {podiumTop3.map((athlete, idx) => {
            const metric = getPrimaryDisplay(athlete);
            const podiumConfig = [
              {
                rank: '1º LUGAR',
                medal: '🥇',
                accentDark: 'border-amber-400/60 bg-gradient-to-b from-amber-500/15 to-slate-900 shadow-[0_0_25px_rgba(245,158,11,0.18)]',
                accentLight: 'border-amber-300 bg-gradient-to-b from-amber-50 to-white shadow-sm',
                awardLabel:
                  rankingTab === 'ano-faixa'
                    ? 'Medalha + Certificado Anual'
                    : 'Zona Certificado Semestral',
              },
              {
                rank: '2º LUGAR',
                medal: '🥈',
                accentDark: 'border-slate-400/50 bg-gradient-to-b from-slate-400/10 to-slate-900',
                accentLight: 'border-slate-300 bg-gradient-to-b from-slate-50 to-white shadow-sm',
                awardLabel:
                  rankingTab === 'ano-faixa'
                    ? 'Medalha + Certificado Anual'
                    : 'Zona Certificado Semestral',
              },
              {
                rank: '3º LUGAR',
                medal: '🥉',
                accentDark: 'border-orange-500/50 bg-gradient-to-b from-orange-500/10 to-slate-900',
                accentLight: 'border-orange-200 bg-gradient-to-b from-orange-50/70 to-white shadow-sm',
                awardLabel:
                  rankingTab === 'ano-faixa'
                    ? 'Medalha + Certificado Anual'
                    : 'Zona Certificado Semestral',
              },
            ][idx];

            return (
              <div
                key={athlete.id}
                className={`rounded-3xl border p-5 flex flex-col justify-between gap-4 transition ${
                  isLight ? podiumConfig.accentLight : podiumConfig.accentDark
                } ${athlete.isCurrentUser ? 'ring-2 ring-cyan-400' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl shrink-0 ${
                        isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      {athlete.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-mono font-black text-amber-400">
                          {podiumConfig.medal} {podiumConfig.rank}
                        </span>
                        {athlete.isCurrentUser && (
                          <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950">
                            VOCÊ
                          </span>
                        )}
                      </div>
                      <h4 className="font-black text-base truncate mt-0.5">{athlete.name}</h4>
                      <p className={`text-[11px] font-mono truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {athlete.city} • {athlete.age} anos
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-2xl border flex items-center justify-between ${
                    isLight ? 'bg-white/90 border-slate-200' : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">Desempenho</span>
                    <span className={`text-xl font-black font-mono ${isLight ? 'text-orange-600' : 'text-cyan-300'}`}>
                      {metric.value}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] uppercase text-slate-400 block">Pace Médio</span>
                    <span className="text-xs font-bold">{formatPace(athlete.avgPaceMinKm)} /km</span>
                    <span className="text-[10px] text-slate-400 block">{metric.secondary}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-bold">
                  <span
                    className={`px-2 py-1 rounded-lg border ${
                      isLight
                        ? 'bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    {AGE_CATEGORIES.find((c) => c.id === athlete.ageCategory)?.shortLabel} •{' '}
                    {athlete.gender === 'feminino' ? 'Fem' : 'Masc'}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-lg flex items-center gap-1 ${
                      rankingTab === 'ano-faixa'
                        ? isLight
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-amber-500/20 text-amber-300'
                        : isLight
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-cyan-500/15 text-cyan-300'
                    }`}
                  >
                    {rankingTab === 'ano-faixa' ? <Medal className="w-3 h-3" /> : <FileBadge2 className="w-3 h-3" />}
                    <span>{podiumConfig.awardLabel}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div
        className={`rounded-3xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <span className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            Tabela Completa ({rankedAthletes.length} atletas)
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Top 3 garantem premiação oficial
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`text-[10px] font-mono uppercase tracking-wider border-b ${
                  isLight
                    ? 'bg-slate-50/70 border-slate-200 text-slate-500'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}
              >
                <th className="py-3 px-4">Pos</th>
                <th className="py-3 px-4">Atleta</th>
                <th className="py-3 px-4">Faixa Etária / Cat.</th>
                <th className="py-3 px-4 text-right">Pontuação</th>
                <th className="py-3 px-4 text-right">Quilometragem</th>
                <th className="py-3 px-4 text-right">Pace Médio</th>
                <th className="py-3 px-4 text-right">Premiação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/80 text-xs font-mono">
              {rankedAthletes.map((athlete, idx) => {
                const pos = idx + 1;
                const pointsVal =
                  rankingTab === 'mes-faixa'
                    ? athlete.monthlyPoints
                    : rankingTab === 'ano-faixa'
                    ? athlete.yearlyPoints
                    : athlete.totalPoints;
                const kmVal =
                  rankingTab === 'mes-faixa'
                    ? athlete.monthlyKm
                    : rankingTab === 'ano-faixa'
                    ? athlete.yearlyKm
                    : athlete.totalKm;

                return (
                  <tr
                    key={athlete.id}
                    className={`transition ${
                      athlete.isCurrentUser
                        ? isLight
                          ? 'bg-orange-50/90 font-bold'
                          : 'bg-cyan-500/15 font-bold'
                        : isLight
                        ? 'hover:bg-slate-50'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-black text-xs ${
                          pos === 1
                            ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                            : pos === 2
                            ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40'
                            : pos === 3
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : isLight
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-slate-950 text-slate-400'
                        }`}
                      >
                        {pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{athlete.avatar}</span>
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{athlete.name}</span>
                            {athlete.isCurrentUser && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-black">
                                VOCÊ
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {athlete.city} • {athlete.age} anos • LVL {athlete.level}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            isLight
                              ? 'bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-slate-950 border-slate-700 text-slate-200'
                          }`}
                        >
                          {AGE_CATEGORIES.find((c) => c.id === athlete.ageCategory)?.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            athlete.gender === 'feminino'
                              ? isLight
                                ? 'bg-fuchsia-100 text-fuchsia-700'
                                : 'bg-fuchsia-500/20 text-fuchsia-300'
                              : isLight
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {getGenderLabel(athlete.gender)}
                        </span>
                      </div>
                    </td>

                    <td
                      className={`py-3.5 px-4 text-right whitespace-nowrap font-bold ${
                        rankingTab === 'pontuacao-geral' ||
                        ((rankingTab === 'mes-faixa' || rankingTab === 'ano-faixa') &&
                          periodMetric === 'points')
                          ? isLight
                            ? 'text-orange-600'
                            : 'text-cyan-300'
                          : ''
                      }`}
                    >
                      {pointsVal.toLocaleString('pt-BR')} XP
                    </td>

                    <td
                      className={`py-3.5 px-4 text-right whitespace-nowrap font-bold ${
                        rankingTab === 'km-geral' ||
                        ((rankingTab === 'mes-faixa' || rankingTab === 'ano-faixa') &&
                          periodMetric === 'km')
                          ? isLight
                            ? 'text-orange-600'
                            : 'text-emerald-400'
                          : ''
                      }`}
                    >
                      {kmVal.toFixed(1)} km
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap text-slate-400">
                      {formatPace(athlete.avgPaceMinKm)} /km
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {pos <= 3 ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                            rankingTab === 'ano-faixa'
                              ? isLight
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-amber-500/20 text-amber-300'
                              : isLight
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-cyan-500/15 text-cyan-300'
                          }`}
                        >
                          {rankingTab === 'ano-faixa' ? (
                            <>
                              <Medal className="w-3 h-3" /> Medalha + Cert.
                            </>
                          ) : (
                            <>
                              <FileBadge2 className="w-3 h-3" /> Certificado
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Em disputa</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Interactive Modal Previewing the Semester Certificate & Annual Medal + Certificate */}
      {showAwardsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          onClick={() => setShowAwardsModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border p-6 space-y-6 shadow-2xl ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-slate-900 border-amber-500/40 text-slate-100 shadow-[0_0_50px_rgba(245,158,11,0.2)]'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" /> REGULAMENTO OFICIAL DE PREMIAÇÃO
                </span>
                <h3 className="text-xl sm:text-2xl font-black uppercase">
                  Certificado Semestral & Medalha Anual
                </h3>
                <p className={`text-xs font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Válido para todas as 5 faixas etárias (Até 20, 21 à 30, 31 à 40, 41 à 50 e 50+) nas categorias Masculino e Feminino.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAwardsModal(false)}
                aria-label="Fechar prévia de premiações"
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Visual Preview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Semester Certificate Mockup */}
              <div
                className={`rounded-2xl border-2 p-5 space-y-3 relative overflow-hidden ${
                  isLight
                    ? 'bg-gradient-to-br from-sky-50 via-white to-cyan-50 border-sky-300'
                    : 'bg-gradient-to-br from-slate-950 via-cyan-950/50 to-slate-900 border-cyan-400/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase text-cyan-400">
                    CERTIFICADO PERSONALIZADO • {currentSemester.toUpperCase()}
                  </span>
                  <FileBadge2 className="w-6 h-6 text-cyan-400" />
                </div>

                <div className="py-3 border-y border-cyan-500/25 space-y-1.5 text-center">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    CERTIFICAMOS QUE O(A) ATLETA
                  </div>
                  <div className="text-lg font-black uppercase tracking-wide">
                    {userProfile.name || 'Atleta Alpha'}
                  </div>
                  <div className="text-[11px] font-mono text-cyan-400 font-bold">
                    DESTAQUE DO SEMESTRE • {getAgeCategoryLabel(userAgeCategory)} ({getGenderLabel(userGender)})
                  </div>
                </div>

                <ul className={`text-[11px] font-mono space-y-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  <li>• Nome completo, faixa etária e categoria gravados</li>
                  <li>• Envio digital em alta resolução para o e-mail cadastrado</li>
                  <li>• Selo oficial RUN360X pronto para impressão e redes sociais</li>
                </ul>
              </div>

              {/* Annual Medal + Certificate Mockup */}
              <div
                className={`rounded-2xl border-2 p-5 space-y-3 relative overflow-hidden ${
                  isLight
                    ? 'bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-400'
                    : 'bg-gradient-to-br from-slate-950 via-amber-950/40 to-slate-900 border-amber-400/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase text-amber-400">
                    MEDALHA + CERTIFICADO • ANO {currentYear}
                  </span>
                  <Medal className="w-6 h-6 text-amber-400" />
                </div>

                <div className="py-3 border-y border-amber-500/30 space-y-1.5 text-center">
                  <div className="text-3xl">🏅</div>
                  <div className="text-lg font-black uppercase tracking-wide text-amber-400">
                    CAMPEÃO ANUAL {currentYear}
                  </div>
                  <div className="text-[11px] font-mono font-bold">
                    {userProfile.name || 'Atleta Alpha'} • {getAgeCategoryLabel(userAgeCategory)} ({getGenderLabel(userGender)})
                  </div>
                </div>

                <ul className={`text-[11px] font-mono space-y-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  <li>• Medalha Oficial RUN360X exclusiva para os melhores do ano</li>
                  <li>• Certificado Personalizado Anual de Honra ao Mérito</li>
                  <li>• Premiação dedicada por faixa etária (Masculino & Feminino)</li>
                </ul>
              </div>
            </div>

            {/* Categories Recap */}
            <div
              className={`p-4 rounded-2xl border text-xs font-mono space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="font-bold uppercase text-[11px] text-amber-400">
                Categorias Oficiais de Premiação (Masculino & Feminino):
              </div>
              <div className="flex flex-wrap gap-2">
                {AGE_CATEGORIES.map((c) => (
                  <span
                    key={c.id}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-700'
                        : 'bg-slate-900 border-slate-700 text-slate-200'
                    }`}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowAwardsModal(false)}
                className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                  isLight
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                }`}
              >
                ENTENDI, VOLTAR AOS RANKINGS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Social Share Modal */}
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

export default RankingsView;
