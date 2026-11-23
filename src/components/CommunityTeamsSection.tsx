import React, { useMemo, useState } from 'react';
import {
  Check,
  Crown,
  Loader2,
  Lock,
  Plus,
  Route,
  Search,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  AddTeamMemberInput,
  AgeCategoryId,
  AthleteGender,
  CreateTeamInput,
  RankingAthlete,
  RunningTeam,
  TeamAccentColor,
} from '../types';
import {
  AGE_CATEGORIES,
  COMMUNITY_RANKING_ATHLETES,
  getAgeCategoryLabel,
  getGenderLabel,
} from '../data/rankingsData';
import { formatPace } from '../utils/geo';
import {
  sanitizeTeamTag,
  TEAM_ACCENT_STYLES,
  TEAM_EMBLEMS,
} from '../utils/teamsStore';

interface CommunityTeamsSectionProps {
  teams: RunningTeam[];
  isMutating: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  isTeamCreator: (team: RunningTeam) => boolean;
  onCreateTeam: (input: CreateTeamInput) => Promise<RunningTeam | null>;
  onAddMember: (teamId: string, member: AddTeamMemberInput) => Promise<boolean>;
  onRemoveMember: (teamId: string, memberId: string) => Promise<boolean>;
  onDeleteTeam: (teamId: string) => Promise<boolean>;
  creatorDisplayName: string;
  externalOpenCreate?: boolean;
  onClearExternalOpenCreate?: () => void;
  externalInspectTeamId?: string | null;
  onClearExternalInspectTeamId?: () => void;
  theme?: 'dark' | 'light';
}

const ACCENT_KEYS: TeamAccentColor[] = ['cyan', 'amber', 'emerald', 'orange', 'rose', 'violet'];

function athleteToAddInput(athlete: RankingAthlete): AddTeamMemberInput {
  return {
    memberId: athlete.id,
    name: athlete.name,
    avatar: athlete.avatar,
    city: athlete.city,
    ageCategory: athlete.ageCategory,
    gender: athlete.gender,
    totalPoints: athlete.totalPoints,
    totalKm: athlete.totalKm,
    monthlyPoints: athlete.monthlyPoints,
    monthlyKm: athlete.monthlyKm,
    avgPaceMinKm: athlete.avgPaceMinKm,
  };
}

export const CommunityTeamsSection: React.FC<CommunityTeamsSectionProps> = ({
  teams,
  isMutating,
  errorMessage,
  onClearError,
  isTeamCreator,
  onCreateTeam,
  onAddMember,
  onRemoveMember,
  onDeleteTeam,
  creatorDisplayName,
  externalOpenCreate = false,
  onClearExternalOpenCreate,
  externalInspectTeamId = null,
  onClearExternalInspectTeamId,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [scopeFilter, setScopeFilter] = useState<'todas' | 'minhas'>('todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(externalOpenCreate);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(externalInspectTeamId);

  // Sync external triggers
  React.useEffect(() => {
    if (externalOpenCreate) {
      setShowCreateModal(true);
      if (onClearExternalOpenCreate) onClearExternalOpenCreate();
    }
  }, [externalOpenCreate, onClearExternalOpenCreate]);

  React.useEffect(() => {
    if (externalInspectTeamId) {
      setSelectedTeamId(externalInspectTeamId);
      if (onClearExternalInspectTeamId) onClearExternalInspectTeamId();
    }
  }, [externalInspectTeamId, onClearExternalInspectTeamId]);

  // Create team form state
  const [teamName, setTeamName] = useState<string>('');
  const [teamTag, setTeamTag] = useState<string>('');
  const [teamCity, setTeamCity] = useState<string>('São Paulo, SP');
  const [teamMotto, setTeamMotto] = useState<string>('');
  const [teamEmblem, setTeamEmblem] = useState<string>('⚡');
  const [teamAccent, setTeamAccent] = useState<TeamAccentColor>('cyan');
  const [draftMembers, setDraftMembers] = useState<AddTeamMemberInput[]>([]);
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Custom invitee inline form (used both in create modal and roster manager)
  const [customName, setCustomName] = useState<string>('');
  const [customCity, setCustomCity] = useState<string>('');
  const [customAgeCat, setCustomAgeCat] = useState<AgeCategoryId>('21-30');
  const [customGender, setCustomGender] = useState<AthleteGender>('masculino');

  // Roster modal state
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [confirmDeleteTeamId, setConfirmDeleteTeamId] = useState<string | null>(null);
  const [rosterFeedback, setRosterFeedback] = useState<string | null>(null);

  const selectedTeam = useMemo(
    () => (selectedTeamId ? teams.find((t) => t.id === selectedTeamId) || null : null),
    [teams, selectedTeamId]
  );

  const visibleTeams = useMemo(() => {
    let list = [...teams];
    if (scopeFilter === 'minhas') {
      list = list.filter((t) => isTeamCreator(t));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.tag.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.creatorName.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const aMine = isTeamCreator(a) ? 1 : 0;
      const bMine = isTeamCreator(b) ? 1 : 0;
      if (aMine !== bMine) return bMine - aMine;
      return b.totalPoints - a.totalPoints;
    });
    return list;
  }, [teams, scopeFilter, searchQuery, isTeamCreator]);

  const myTeamsCount = useMemo(
    () => teams.filter((t) => isTeamCreator(t)).length,
    [teams, isTeamCreator]
  );

  const filteredCatalogForCreate = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const list = q
      ? COMMUNITY_RANKING_ATHLETES.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.city.toLowerCase().includes(q) ||
            getAgeCategoryLabel(a.ageCategory).toLowerCase().includes(q)
        )
      : COMMUNITY_RANKING_ATHLETES;
    return list.slice(0, 12);
  }, [catalogSearch]);

  const filteredCatalogForRoster = useMemo(() => {
    if (!selectedTeam) return [];
    const existingIds = new Set(selectedTeam.members.map((m) => m.memberId));
    const q = rosterSearch.trim().toLowerCase();
    return COMMUNITY_RANKING_ATHLETES.filter((a) => {
      if (existingIds.has(a.id)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        getAgeCategoryLabel(a.ageCategory).toLowerCase().includes(q)
      );
    }).slice(0, 10);
  }, [selectedTeam, rosterSearch]);

  const toggleDraftAthlete = (athlete: RankingAthlete) => {
    const exists = draftMembers.some((m) => m.memberId === athlete.id);
    if (exists) {
      setDraftMembers((prev) => prev.filter((m) => m.memberId !== athlete.id));
    } else {
      if (draftMembers.length >= 20) return;
      setDraftMembers((prev) => [...prev, athleteToAddInput(athlete)]);
    }
  };

  const handleAddCustomToDraft = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    setDraftMembers((prev) => [
      ...prev,
      {
        memberId: `convidado_${Date.now()}_${prev.length}`,
        name: trimmed,
        avatar: customGender === 'feminino' ? '🏃‍♀️' : '🏃‍♂️',
        city: customCity.trim() || teamCity.trim() || 'Brasil',
        ageCategory: customAgeCat,
        gender: customGender,
        totalPoints: 1850,
        totalKm: 74.5,
        monthlyPoints: 520,
        monthlyKm: 26.0,
        avgPaceMinKm: 5.15,
      },
    ]);
    setCustomName('');
    setCustomCity('');
  };

  const handleSubmitCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await onCreateTeam({
      name: teamName,
      tag: teamTag || sanitizeTeamTag(teamName),
      city: teamCity,
      motto: teamMotto,
      emblem: teamEmblem,
      accentColor: teamAccent,
      initialMembers: draftMembers,
    });
    if (created) {
      setTeamName('');
      setTeamTag('');
      setTeamMotto('');
      setDraftMembers([]);
      setShowCreateModal(false);
      setSelectedTeamId(created.id);
      setRosterFeedback('Equipe criada! Você é o capitão e pode adicionar ou remover integrantes quando quiser.');
    }
  };

  const handleAddCustomMemberToExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    const trimmed = customName.trim();
    if (!trimmed) return;

    const ok = await onAddMember(selectedTeam.id, {
      name: trimmed,
      avatar: customGender === 'feminino' ? '🏃‍♀️' : '🏃‍♂️',
      city: customCity.trim() || selectedTeam.city,
      ageCategory: customAgeCat,
      gender: customGender,
      totalPoints: 1850,
      totalKm: 74.5,
      monthlyPoints: 520,
      monthlyKm: 26.0,
      avgPaceMinKm: 5.15,
    });

    if (ok) {
      setCustomName('');
      setCustomCity('');
      setRosterFeedback(`${trimmed} foi adicionado(a) à equipe e já soma pontos no Ranking de Equipes.`);
    }
  };

  const handleAddCatalogMemberToExisting = async (athlete: RankingAthlete) => {
    if (!selectedTeam) return;
    const ok = await onAddMember(selectedTeam.id, athleteToAddInput(athlete));
    if (ok) {
      setRosterFeedback(`${athlete.name} entrou para a equipe ${selectedTeam.name}!`);
    }
  };

  const handleRemoveExistingMember = async (memberId: string, memberName: string) => {
    if (!selectedTeam) return;
    const ok = await onRemoveMember(selectedTeam.id, memberId);
    if (ok) {
      setRosterFeedback(`${memberName} foi removido(a) da equipe.`);
    }
  };

  const handleConfirmDeleteTeam = async (teamId: string) => {
    const ok = await onDeleteTeam(teamId);
    if (ok) {
      setConfirmDeleteTeamId(null);
      setSelectedTeamId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Equipes da Comunidade</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{teams.length} equipes</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{myTeamsCount} criadas por você</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black tracking-tight">
            Crie sua Equipe e Monte seu Elenco
          </h3>
          <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            O criador da equipe adiciona e gerencia os integrantes. Todos os pontos (XP) e quilômetros somam diretamente no Ranking de Equipes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onClearError();
            setShowCreateModal(true);
          }}
          className={`min-h-[46px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shrink-0 whitespace-nowrap ${
            isLight
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gradient-to-r from-cyan-400 to-emerald-400 hover:opacity-95 text-slate-950'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Criar Nova Equipe</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-300 flex items-center justify-between gap-2">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={onClearError}
            className="text-rose-200 hover:text-white cursor-pointer"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          className={`inline-flex items-center gap-1 p-1 rounded-xl border self-start ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}
        >
          {(
            [
              { id: 'todas', label: `Todas (${teams.length})` },
              { id: 'minhas', label: `Criadas por Mim (${myTeamsCount})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScopeFilter(item.id)}
              className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                scopeFilter === item.id
                  ? isLight
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'bg-cyan-400 text-slate-950'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por nome, sigla ou cidade..."
            className={`w-full min-h-[40px] pl-10 pr-4 py-2 rounded-xl border text-xs focus:outline-none ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 focus:border-orange-500'
                : 'bg-slate-900 border-slate-800 text-slate-100 focus:border-cyan-400'
            }`}
          />
        </div>
      </div>

      {/* Teams Grid */}
      {visibleTeams.length === 0 ? (
        <div
          className={`rounded-2xl border p-10 text-center space-y-3 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}
        >
          <p className="text-sm font-bold">
            {scopeFilter === 'minhas'
              ? 'Você ainda não criou nenhuma equipe.'
              : 'Nenhuma equipe encontrada para este filtro.'}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Crie sua equipe agora, adicione corredores da comunidade ou convidados e dispute o topo do Ranking de Equipes.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Minha Equipe</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleTeams.map((team) => {
            const accent = TEAM_ACCENT_STYLES[team.accentColor] || TEAM_ACCENT_STYLES.cyan;
            const creator = isTeamCreator(team);

            return (
              <article
                key={team.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 transition ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                } ${creator ? 'ring-1 ring-cyan-400/50' : ''}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl shrink-0 ${accent.badgeBg} ${accent.border}`}
                      >
                        {team.emblem}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span className={`font-mono font-bold ${accent.text}`}>[{team.tag}]</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{team.city}</span>
                          {creator && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-400 font-semibold">Você é o criador</span>
                            </>
                          )}
                        </div>
                        <h4 className="text-base font-black truncate mt-0.5">{team.name}</h4>
                        <p className="text-xs text-slate-400 truncate">
                          Capitão: {team.creatorName}
                        </p>
                      </div>
                    </div>
                  </div>

                  {team.motto && (
                    <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      “{team.motto}”
                    </p>
                  )}

                  {/* Compact Tabular Metrics Strip */}
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-800 font-mono tabular-nums">
                    <div>
                      <div className="text-[11px] font-sans text-slate-400">Integrantes</div>
                      <div className="text-sm font-black mt-0.5">{team.memberCount}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-sans text-slate-400">XP Total</div>
                      <div className="text-sm font-black text-amber-400 mt-0.5">
                        {team.totalPoints.toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-sans text-slate-400">KM Total</div>
                      <div className="text-sm font-black text-cyan-400 mt-0.5">
                        {team.totalKm.toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-sans text-slate-400">Pace Médio</div>
                      <div className="text-sm font-black mt-0.5">
                        {formatPace(team.avgPaceMinKm)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Members Preview + Creator Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
                    <div className="flex -space-x-1.5 shrink-0">
                      {team.members.slice(0, 4).map((m) => (
                        <span
                          key={m.memberId}
                          title={m.name}
                          className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs ${
                            isLight ? 'bg-slate-100 border-white' : 'bg-slate-800 border-slate-900'
                          }`}
                        >
                          {m.avatar}
                        </span>
                      ))}
                    </div>
                    {team.members.length > 4 && (
                      <span className="font-mono text-[11px]">+{team.members.length - 4}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRosterFeedback(null);
                      setConfirmDeleteTeamId(null);
                      setSelectedTeamId(team.id);
                    }}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                      creator
                        ? isLight
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                        : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {creator ? <UserPlus className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    <span>{creator ? 'Adicionar Integrantes' : 'Ver Elenco'}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* CREATE TEAM MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
            }`}
          >
            <div
              className={`sticky top-0 z-10 px-5 py-4 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div>
                <h3 className="text-lg font-black">Criar Nova Equipe na Comunidade</h3>
                <p className="text-xs text-slate-400">
                  Você entrará como Capitão ({creatorDisplayName}) e poderá adicionar integrantes agora ou depois.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Fechar modal"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center hover:bg-slate-800/40 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreateTeam} className="p-5 space-y-6">
              {/* Identity Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-6 space-y-1.5">
                  <label className="text-xs font-semibold block">Nome da Equipe *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Ex: Pelotão Vento Norte"
                    className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-orange-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-400'
                    }`}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold block">Sigla *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={6}
                    value={teamTag}
                    onChange={(e) => setTeamTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="PVN"
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl border text-sm font-mono uppercase focus:outline-none ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-orange-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-400'
                    }`}
                  />
                </div>

                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-semibold block">Cidade / Base *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    value={teamCity}
                    onChange={(e) => setTeamCity(e.target.value)}
                    placeholder="Ex: São Paulo, SP"
                    className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-orange-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-400'
                    }`}
                  />
                </div>

                <div className="sm:col-span-12 space-y-1.5">
                  <label className="text-xs font-semibold block">Lema da Equipe (opcional)</label>
                  <input
                    type="text"
                    maxLength={140}
                    value={teamMotto}
                    onChange={(e) => setTeamMotto(e.target.value)}
                    placeholder="Ex: Treino forte em grupo, superação a cada quilômetro."
                    className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-orange-500'
                        : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>

              {/* Emblem & Color Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold block">Emblema do Escudo</span>
                  <div className="flex flex-wrap gap-1.5">
                    {TEAM_EMBLEMS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setTeamEmblem(em)}
                        className={`w-10 h-10 rounded-xl border text-lg flex items-center justify-center transition cursor-pointer ${
                          teamEmblem === em
                            ? isLight
                              ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-400/30'
                              : 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/30'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            : 'bg-slate-950 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold block">Cor da Equipe</span>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_KEYS.map((colorKey) => {
                      const style = TEAM_ACCENT_STYLES[colorKey];
                      return (
                        <button
                          key={colorKey}
                          type="button"
                          onClick={() => setTeamAccent(colorKey)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                            teamAccent === colorKey
                              ? `${style.badgeBg} ${style.border} ${style.text}`
                              : isLight
                              ? 'bg-slate-50 border-slate-200 text-slate-700'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${style.swatch}`} />
                          <span>{style.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Add Initial Members by Creator */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-cyan-400" />
                      <span>Adicionar Integrantes ({draftMembers.length + 1} com você)</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Selecione corredores da comunidade ou cadastre convidados diretamente pelo nome.
                    </p>
                  </div>
                </div>

                {/* Selected Draft Members List */}
                <div className="flex flex-wrap gap-2">
                  <div
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                      isLight
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-amber-500/10 border-amber-500/35 text-amber-300'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>{creatorDisplayName} (Capitão)</span>
                  </div>

                  {draftMembers.map((m) => (
                    <div
                      key={m.memberId || m.name}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                        isLight
                          ? 'bg-slate-100 border-slate-200 text-slate-800'
                          : 'bg-slate-950 border-slate-700 text-slate-200'
                      }`}
                    >
                      <span>{m.avatar || '🏃'}</span>
                      <span>{m.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftMembers((prev) =>
                            prev.filter((item) => (item.memberId || item.name) !== (m.memberId || m.name))
                          )
                        }
                        aria-label={`Remover ${m.name}`}
                        className="text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Custom Invitee Inline */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-3 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="text-xs font-semibold">Convidar Integrante por Nome</div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      maxLength={80}
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Nome do corredor(a)"
                      className={`sm:col-span-5 min-h-[40px] px-3 py-1.5 rounded-xl border text-xs focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-slate-900 border-slate-700 text-slate-100'
                      }`}
                    />
                    <select
                      value={customAgeCat}
                      onChange={(e) => setCustomAgeCat(e.target.value as AgeCategoryId)}
                      className={`sm:col-span-3 min-h-[40px] px-2.5 py-1.5 rounded-xl border text-xs focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-slate-900 border-slate-700 text-slate-100'
                      }`}
                    >
                      {AGE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={customGender}
                      onChange={(e) => setCustomGender(e.target.value as AthleteGender)}
                      className={`sm:col-span-2 min-h-[40px] px-2.5 py-1.5 rounded-xl border text-xs focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-slate-900 border-slate-700 text-slate-100'
                      }`}
                    >
                      <option value="masculino">Masc</option>
                      <option value="feminino">Fem</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddCustomToDraft}
                      disabled={!customName.trim()}
                      className={`sm:col-span-2 min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-40 whitespace-nowrap ${
                        isLight
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                      }`}
                    >
                      + Incluir
                    </button>
                  </div>
                </div>

                {/* Community Athletes Directory Picker */}
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Buscar atletas da comunidade para convocar..."
                      className={`w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl border text-xs focus:outline-none ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900'
                          : 'bg-slate-950 border-slate-800 text-slate-100'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {filteredCatalogForCreate.map((ath) => {
                      const picked = draftMembers.some((m) => m.memberId === ath.id);
                      return (
                        <button
                          key={ath.id}
                          type="button"
                          onClick={() => toggleDraftAthlete(ath)}
                          className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                            picked
                              ? isLight
                                ? 'bg-orange-50 border-orange-400'
                                : 'bg-cyan-500/15 border-cyan-400'
                              : isLight
                              ? 'bg-white border-slate-200 hover:bg-slate-50'
                              : 'bg-slate-950 border-slate-800 hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{ath.avatar}</span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">{ath.name}</div>
                              <div className="text-[11px] text-slate-400 truncate font-mono tabular-nums">
                                {ath.city} · {ath.totalPoints.toLocaleString('pt-BR')} XP
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-xs font-bold shrink-0 flex items-center gap-1 ${
                              picked ? 'text-emerald-400' : 'text-cyan-400'
                            }`}
                          >
                            {picked ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Submit Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-950 border-slate-700 text-slate-300'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isMutating || teamName.trim().length < 2}
                  className={`min-h-[44px] px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                    isLight
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                  }`}
                >
                  {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  <span>Criar Equipe ({draftMembers.length + 1} integrantes)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEAM ROSTER & CREATOR MEMBER MANAGEMENT MODAL */}
      {selectedTeam && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setSelectedTeamId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
            }`}
          >
            {/* Header */}
            <div
              className={`sticky top-0 z-10 px-5 py-4 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0">{selectedTeam.emblem}</span>
                <div className="min-w-0">
                  <h3 className="text-lg font-black truncate">
                    {selectedTeam.name}{' '}
                    <span className="font-mono text-xs text-slate-400">[{selectedTeam.tag}]</span>
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedTeam.city} · Criador: {selectedTeam.creatorName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeamId(null)}
                aria-label="Fechar elenco"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center hover:bg-slate-800/40 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Team Aggregate KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="text-[11px] font-sans text-slate-400">Integrantes</div>
                  <div className="text-lg font-black mt-0.5">{selectedTeam.memberCount}</div>
                </div>
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="text-[11px] font-sans text-slate-400">Pontuação Total</div>
                  <div className="text-lg font-black text-amber-400 mt-0.5">
                    {selectedTeam.totalPoints.toLocaleString('pt-BR')} XP
                  </div>
                </div>
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="text-[11px] font-sans text-slate-400">Quilometragem</div>
                  <div className="text-lg font-black text-cyan-400 mt-0.5">
                    {selectedTeam.totalKm.toFixed(1)} km
                  </div>
                </div>
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="text-[11px] font-sans text-slate-400">Pace Médio</div>
                  <div className="text-lg font-black mt-0.5">
                    {formatPace(selectedTeam.avgPaceMinKm)} /km
                  </div>
                </div>
              </div>

              {rosterFeedback && (
                <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-400">
                  {rosterFeedback}
                </div>
              )}

              {/* Current Roster List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400">
                  Integrantes da Equipe ({selectedTeam.members.length})
                </h4>
                <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  {selectedTeam.members.map((member) => {
                    const creator = isTeamCreator(selectedTeam);
                    return (
                      <div
                        key={member.memberId}
                        className={`px-4 py-3 flex items-center justify-between gap-3 ${
                          isLight ? 'bg-white' : 'bg-slate-950/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl shrink-0">{member.avatar}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{member.name}</span>
                              {member.role === 'capitao' && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                                  <Crown className="w-3.5 h-3.5" />
                                  <span>Capitão</span>
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">
                              {getAgeCategoryLabel(member.ageCategory)} · {getGenderLabel(member.gender)}
                              {member.city ? ` · ${member.city}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right font-mono tabular-nums text-xs">
                            <div className="font-bold text-amber-400 flex items-center justify-end gap-1">
                              <Zap className="w-3 h-3" />
                              <span>{member.totalPoints.toLocaleString('pt-BR')} XP</span>
                            </div>
                            <div className="text-slate-400 flex items-center justify-end gap-1">
                              <Route className="w-3 h-3" />
                              <span>{member.totalKm.toFixed(1)} km</span>
                            </div>
                          </div>

                          {creator && member.role !== 'capitao' && (
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => handleRemoveExistingMember(member.memberId, member.name)}
                              aria-label={`Remover ${member.name}`}
                              title="Remover integrante da equipe"
                              className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Creator-Only Member Addition Controls */}
              {isTeamCreator(selectedTeam) ? (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4 text-cyan-400" />
                        <span>Adicionar Novos Integrantes (Exclusivo do Criador)</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Adicione atletas da comunidade ou cadastre um novo corredor pelo nome.
                      </p>
                    </div>
                  </div>

                  {/* Quick Add by Name */}
                  <form
                    onSubmit={handleAddCustomMemberToExisting}
                    className={`p-3.5 rounded-2xl border space-y-2.5 ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Adicionar por Nome</div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="text"
                        maxLength={80}
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Nome do novo integrante"
                        className={`sm:col-span-5 min-h-[40px] px-3 py-1.5 rounded-xl border text-xs focus:outline-none ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-slate-900 border-slate-700 text-slate-100'
                        }`}
                      />
                      <select
                        value={customAgeCat}
                        onChange={(e) => setCustomAgeCat(e.target.value as AgeCategoryId)}
                        className={`sm:col-span-3 min-h-[40px] px-2.5 py-1.5 rounded-xl border text-xs focus:outline-none ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-slate-900 border-slate-700 text-slate-100'
                        }`}
                      >
                        {AGE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={customGender}
                        onChange={(e) => setCustomGender(e.target.value as AthleteGender)}
                        className={`sm:col-span-2 min-h-[40px] px-2.5 py-1.5 rounded-xl border text-xs focus:outline-none ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-slate-900 border-slate-700 text-slate-100'
                        }`}
                      >
                        <option value="masculino">Masc</option>
                        <option value="feminino">Fem</option>
                      </select>
                      <button
                        type="submit"
                        disabled={isMutating || !customName.trim()}
                        className={`sm:col-span-2 min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-40 whitespace-nowrap ${
                          isLight
                            ? 'bg-orange-500 hover:bg-orange-600 text-white'
                            : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                        }`}
                      >
                        Adicionar
                      </button>
                    </div>
                  </form>

                  {/* Search & Add from Community Athletes */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        placeholder="Buscar corredores da comunidade para adicionar..."
                        className={`w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl border text-xs focus:outline-none ${
                          isLight
                            ? 'bg-slate-50 border-slate-300 text-slate-900'
                            : 'bg-slate-950 border-slate-800 text-slate-100'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {filteredCatalogForRoster.map((ath) => (
                        <div
                          key={ath.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                            isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{ath.avatar}</span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">{ath.name}</div>
                              <div className="text-[11px] text-slate-400 truncate font-mono tabular-nums">
                                {ath.totalPoints.toLocaleString('pt-BR')} XP · {ath.totalKm.toFixed(0)} km
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={() => handleAddCatalogMemberToExisting(ath)}
                            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                              isLight
                                ? 'bg-orange-100 hover:bg-orange-200 text-orange-800'
                                : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300'
                            }`}
                          >
                            + Adicionar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delete Team Danger Action (Two-step inline confirmation) */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">
                      Gestão exclusiva do criador da equipe
                    </span>
                    {confirmDeleteTeamId === selectedTeam.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTeamId(null)}
                          className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => handleConfirmDeleteTeam(selectedTeam.id)}
                          className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white cursor-pointer"
                        >
                          Confirmar Exclusão
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTeamId(selectedTeam.id)}
                        className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir Equipe</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-600'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <Lock className="w-4 h-4 shrink-0 text-slate-400" />
                  <span>
                    Somente o criador da equipe (<strong>{selectedTeam.creatorName}</strong>) pode adicionar ou remover integrantes.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityTeamsSection;
