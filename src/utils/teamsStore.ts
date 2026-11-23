import { useCallback, useEffect, useMemo, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AddTeamMemberInput,
  CreateTeamInput,
  RankingAthlete,
  RunningTeam,
  TeamAccentColor,
  TeamMember,
  UserProfile,
} from '../types';
import { COMMUNITY_RANKING_ATHLETES, getAgeCategoryFromAge } from '../data/rankingsData';
import { db, handleFirestoreError, OperationType } from '../firebase';

const LOCAL_TEAMS_STORAGE_KEY = 'run360x_community_teams_v1';
const TEAMS_SYNC_EVENT = 'run360x_teams_updated';

export const TEAM_EMBLEMS = ['⚡', '🦅', '🔥', '🛡️', '🏔️', '🌊', '🦁', '🚀', '🧭', '🏆'];

export const TEAM_ACCENT_STYLES: Record<
  TeamAccentColor,
  {
    label: string;
    badgeBg: string;
    border: string;
    text: string;
    swatch: string;
  }
> = {
  cyan: {
    label: 'Ciano',
    badgeBg: 'bg-cyan-500/15',
    border: 'border-cyan-500/40',
    text: 'text-cyan-400',
    swatch: 'bg-cyan-400',
  },
  amber: {
    label: 'Ouro',
    badgeBg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    swatch: 'bg-amber-400',
  },
  emerald: {
    label: 'Esmeralda',
    badgeBg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    swatch: 'bg-emerald-400',
  },
  rose: {
    label: 'Carmim',
    badgeBg: 'bg-rose-500/15',
    border: 'border-rose-500/40',
    text: 'text-rose-400',
    swatch: 'bg-rose-400',
  },
  violet: {
    label: 'Violeta',
    badgeBg: 'bg-violet-500/15',
    border: 'border-violet-500/40',
    text: 'text-violet-400',
    swatch: 'bg-violet-400',
  },
  orange: {
    label: 'Laranja',
    badgeBg: 'bg-orange-500/15',
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    swatch: 'bg-orange-400',
  },
};

export function sanitizeFirestoreId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

export function sanitizeTeamTag(raw: string): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  return cleaned.length >= 2 ? cleaned : 'RUN';
}

export function computeTeamAggregates(members: TeamMember[]) {
  const safeMembers = members.length > 0 ? members : [];
  const memberCount = Math.max(1, safeMembers.length);
  const totalPoints = Math.round(safeMembers.reduce((sum, m) => sum + (m.totalPoints || 0), 0));
  const totalKm = Number(safeMembers.reduce((sum, m) => sum + (m.totalKm || 0), 0).toFixed(1));
  const monthlyPoints = Math.round(safeMembers.reduce((sum, m) => sum + (m.monthlyPoints || 0), 0));
  const monthlyKm = Number(safeMembers.reduce((sum, m) => sum + (m.monthlyKm || 0), 0).toFixed(1));
  const avgPaceRaw =
    safeMembers.length > 0
      ? safeMembers.reduce((sum, m) => sum + (m.avgPaceMinKm || 5.2), 0) / safeMembers.length
      : 5.2;
  const avgPaceMinKm = Number(Math.min(25, Math.max(2, avgPaceRaw)).toFixed(2));

  return {
    memberCount,
    totalPoints,
    totalKm,
    monthlyPoints,
    monthlyKm,
    avgPaceMinKm,
  };
}

function athleteToMember(
  athlete: RankingAthlete,
  teamId: string,
  role: 'capitao' | 'integrante',
  addedBy: string
): TeamMember {
  return {
    memberId: sanitizeFirestoreId(athlete.id, 'ath'),
    teamId,
    name: athlete.name.slice(0, 80),
    avatar: athlete.avatar.slice(0, 16),
    role,
    city: athlete.city.slice(0, 60),
    ageCategory: athlete.ageCategory,
    gender: athlete.gender,
    totalPoints: Math.round(athlete.totalPoints),
    totalKm: Number(athlete.totalKm.toFixed(1)),
    monthlyPoints: Math.round(athlete.monthlyPoints),
    monthlyKm: Number(athlete.monthlyKm.toFixed(1)),
    avgPaceMinKm: Number(athlete.avgPaceMinKm.toFixed(2)),
    addedBy,
    joinedAtIso: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  };
}

function buildStarterTeam(params: {
  id: string;
  name: string;
  tag: string;
  city: string;
  motto: string;
  emblem: string;
  accentColor: TeamAccentColor;
  athleteIds: string[];
}): RunningTeam {
  const matched = params.athleteIds
    .map((id) => COMMUNITY_RANKING_ATHLETES.find((a) => a.id === id))
    .filter((a): a is RankingAthlete => Boolean(a));

  const captain = matched[0] || COMMUNITY_RANKING_ATHLETES[0];
  const creatorId = `starter_${captain.id}`;
  const members: TeamMember[] = matched.map((ath, idx) =>
    athleteToMember(ath, params.id, idx === 0 ? 'capitao' : 'integrante', creatorId)
  );
  const agg = computeTeamAggregates(members);

  return {
    id: params.id,
    name: params.name,
    tag: params.tag,
    city: params.city,
    motto: params.motto,
    emblem: params.emblem,
    accentColor: params.accentColor,
    creatorId,
    creatorName: captain.name,
    ...agg,
    visibility: 'community',
    createdAtIso: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    updatedAtIso: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    members,
    isStarterTeam: true,
    isLocalOnly: true,
  };
}

// Curated community running clubs so the Team Ranking is immediately competitive
export const STARTER_COMMUNITY_TEAMS: RunningTeam[] = [
  buildStarterTeam({
    id: 'team-pelotao-aurora',
    name: 'Pelotão Aurora SP',
    tag: 'AUR',
    city: 'São Paulo, SP',
    motto: 'Constância no amanhecer, velocidade na linha de chegada.',
    emblem: '⚡',
    accentColor: 'cyan',
    athleteIds: ['rk-f30-1', 'rk-m30-2', 'rk-m40-2', 'rk-m50-1', 'rk-f50p-1'],
  }),
  buildStarterTeam({
    id: 'team-orla-velocidade',
    name: 'Orla Velocidade RJ',
    tag: 'ORL',
    city: 'Rio de Janeiro, RJ',
    motto: 'Sub-4 no asfalto quente e resistência em cada quilômetro.',
    emblem: '🌊',
    accentColor: 'amber',
    athleteIds: ['rk-m30-1', 'rk-f40-1', 'rk-m50p-2', 'rk-f20-1'],
  }),
  buildStarterTeam({
    id: 'team-montanha-sul',
    name: 'Escuderia Sul Runners',
    tag: 'SUL',
    city: 'Curitiba, PR',
    motto: 'Frio no rosto, batimento controlado e volume de elite.',
    emblem: '🏔️',
    accentColor: 'emerald',
    athleteIds: ['rk-m50p-1', 'rk-f30-3', 'rk-f40-3', 'rk-m20-2', 'rk-m50p-3'],
  }),
  buildStarterTeam({
    id: 'team-horizonte-mg',
    name: 'Horizonte Altitude MG',
    tag: 'ALT',
    city: 'Belo Horizonte, MG',
    motto: 'Subidas fortes formam pelotões imbatíveis.',
    emblem: '🦅',
    accentColor: 'orange',
    athleteIds: ['rk-m40-1', 'rk-f50-1', 'rk-f20-2', 'rk-f50p-3'],
  }),
  buildStarterTeam({
    id: 'team-ilha-sprint',
    name: 'Ilha Sprint Club',
    tag: 'ILH',
    city: 'Florianópolis, SC',
    motto: 'Ritmo leve nos longões, explosão nos intervalados.',
    emblem: '🔥',
    accentColor: 'rose',
    athleteIds: ['rk-m40-3', 'rk-f50-3', 'rk-f50p-2', 'rk-m20-1'],
  }),
  buildStarterTeam({
    id: 'team-planalto-pace',
    name: 'Planalto Pace Force',
    tag: 'PPF',
    city: 'Brasília, DF',
    motto: 'Retas infinitas, cadência precisa e espírito coletivo.',
    emblem: '🚀',
    accentColor: 'violet',
    athleteIds: ['rk-f30-2', 'rk-m50-2', 'rk-m30-3', 'rk-f40-2'],
  }),
];

function buildCurrentUserMember(
  userProfile: UserProfile,
  teamId: string,
  actorId: string
): TeamMember {
  const history = userProfile.history || [];
  const totalPoints = Math.max(0, Math.round(userProfile.xp || 0));
  const totalKm = Number((userProfile.totalDistanceKm || 0).toFixed(1));
  const historyMonthlyPoints = history.reduce((acc, h) => acc + (h.xpGained || 0), 0);
  const historyMonthlyKm = history.reduce((acc, h) => acc + (h.totalDistanceMeters || 0) / 1000, 0);
  const avgPace =
    history.length > 0
      ? history.reduce((acc, h) => acc + (h.avgPaceMinKm || 5.4), 0) / history.length
      : 5.4;

  return {
    memberId: sanitizeFirestoreId(actorId, 'cap'),
    teamId,
    name: (userProfile.name?.trim() || 'Atleta RUN360X').slice(0, 80),
    avatar: userProfile.gender === 'feminino' ? '🏃‍♀️' : '🏃‍♂️',
    role: 'capitao',
    city: 'Capitão · Radar Ativo',
    ageCategory: getAgeCategoryFromAge(userProfile.age),
    gender: userProfile.gender || 'masculino',
    totalPoints,
    totalKm,
    monthlyPoints: historyMonthlyPoints > 0 ? Math.round(historyMonthlyPoints) : Math.round(totalPoints * 0.45),
    monthlyKm: historyMonthlyKm > 0 ? Number(historyMonthlyKm.toFixed(1)) : Number((totalKm * 0.45).toFixed(1)),
    avgPaceMinKm: Number(Math.min(25, Math.max(2, avgPace)).toFixed(2)),
    addedBy: actorId,
    joinedAtIso: new Date().toISOString(),
  };
}

function readLocalTeams(): RunningTeam[] {
  try {
    const raw = localStorage.getItem(LOCAL_TEAMS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RunningTeam[]) : [];
  } catch {
    return [];
  }
}

function writeLocalTeams(teams: RunningTeam[]) {
  try {
    localStorage.setItem(LOCAL_TEAMS_STORAGE_KEY, JSON.stringify(teams));
    window.dispatchEvent(new Event(TEAMS_SYNC_EVENT));
  } catch {
    // Ignore storage quota issues
  }
}

export interface UseCommunityTeamsResult {
  teams: RunningTeam[];
  currentActorId: string;
  isLoadingCloud: boolean;
  isMutating: boolean;
  errorMessage: string | null;
  clearError: () => void;
  createTeam: (input: CreateTeamInput) => Promise<RunningTeam | null>;
  addMemberToTeam: (teamId: string, memberInput: AddTeamMemberInput) => Promise<boolean>;
  removeMemberFromTeam: (teamId: string, memberId: string) => Promise<boolean>;
  deleteTeam: (teamId: string) => Promise<boolean>;
  isTeamCreator: (team: RunningTeam) => boolean;
}

export function useCommunityTeams(
  firebaseUser: FirebaseUser | null,
  userProfile: UserProfile
): UseCommunityTeamsResult {
  const currentActorId = firebaseUser?.uid || 'local-athlete';
  const [cloudTeams, setCloudTeams] = useState<RunningTeam[]>([]);
  const [localTeams, setLocalTeams] = useState<RunningTeam[]>(() => readLocalTeams());
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep local teams synchronized across tabs/components
  useEffect(() => {
    const syncLocal = () => setLocalTeams(readLocalTeams());
    window.addEventListener(TEAMS_SYNC_EVENT, syncLocal);
    window.addEventListener('storage', syncLocal);
    return () => {
      window.removeEventListener(TEAMS_SYNC_EVENT, syncLocal);
      window.removeEventListener('storage', syncLocal);
    };
  }, []);

  // Real-time Firestore listener for community teams + their members subcollection
  useEffect(() => {
    if (!firebaseUser) {
      setCloudTeams([]);
      setIsLoadingCloud(false);
      return;
    }

    setIsLoadingCloud(true);
    setErrorMessage(null);

    const teamsQuery = query(
      collection(db, 'teams'),
      where('visibility', '==', 'community'),
      limit(40)
    );

    const unsubscribe = onSnapshot(
      teamsQuery,
      async (snapshot) => {
        try {
          const loaded: RunningTeam[] = await Promise.all(
            snapshot.docs.map(async (teamDoc) => {
              const data = teamDoc.data();
              const createdTs = data.createdAt as Timestamp | undefined;
              const updatedTs = data.updatedAt as Timestamp | undefined;

              let members: TeamMember[] = [];
              try {
                const membersQuery = query(
                  collection(db, 'teams', teamDoc.id, 'members'),
                  where('teamId', '==', teamDoc.id),
                  limit(50)
                );
                const memberSnap = await getDocs(membersQuery);
                members = memberSnap.docs.map((mDoc) => {
                  const m = mDoc.data();
                  const joinedTs = m.joinedAt as Timestamp | undefined;
                  return {
                    memberId: String(m.memberId || mDoc.id),
                    teamId: String(m.teamId || teamDoc.id),
                    name: String(m.name || 'Atleta'),
                    avatar: String(m.avatar || '🏃'),
                    role: m.role === 'capitao' ? 'capitao' : 'integrante',
                    city: String(m.city || ''),
                    ageCategory: m.ageCategory || '21-30',
                    gender: m.gender === 'feminino' ? 'feminino' : 'masculino',
                    totalPoints: Number(m.totalPoints || 0),
                    totalKm: Number(m.totalKm || 0),
                    monthlyPoints: Number(m.monthlyPoints || 0),
                    monthlyKm: Number(m.monthlyKm || 0),
                    avgPaceMinKm: Number(m.avgPaceMinKm || 5.2),
                    addedBy: String(m.addedBy || data.creatorId || ''),
                    joinedAtIso: joinedTs?.toDate ? joinedTs.toDate().toISOString() : new Date().toISOString(),
                  };
                });
                members.sort((a, b) => {
                  if (a.role === 'capitao' && b.role !== 'capitao') return -1;
                  if (b.role === 'capitao' && a.role !== 'capitao') return 1;
                  return b.totalPoints - a.totalPoints;
                });
              } catch (memberErr) {
                try {
                  handleFirestoreError(memberErr, OperationType.LIST, `teams/${teamDoc.id}/members`);
                } catch {
                  // Logged via structured handler
                }
              }

              return {
                id: teamDoc.id,
                name: String(data.name || 'Equipe'),
                tag: String(data.tag || 'RUN'),
                city: String(data.city || 'Brasil'),
                motto: String(data.motto || ''),
                emblem: String(data.emblem || '⚡'),
                accentColor: (data.accentColor as TeamAccentColor) || 'cyan',
                creatorId: String(data.creatorId || ''),
                creatorName: String(data.creatorName || 'Capitão'),
                memberCount: Number(data.memberCount || Math.max(1, members.length)),
                totalPoints: Number(data.totalPoints || 0),
                totalKm: Number(data.totalKm || 0),
                monthlyPoints: Number(data.monthlyPoints || 0),
                monthlyKm: Number(data.monthlyKm || 0),
                avgPaceMinKm: Number(data.avgPaceMinKm || 5.2),
                visibility: 'community',
                createdAtIso: createdTs?.toDate ? createdTs.toDate().toISOString() : new Date().toISOString(),
                updatedAtIso: updatedTs?.toDate ? updatedTs.toDate().toISOString() : new Date().toISOString(),
                members,
                isLocalOnly: false,
              };
            })
          );

          setCloudTeams(loaded);
        } finally {
          setIsLoadingCloud(false);
        }
      },
      (err) => {
        setIsLoadingCloud(false);
        setErrorMessage('Não foi possível sincronizar as equipes da nuvem agora.');
        try {
          handleFirestoreError(err, OperationType.LIST, 'teams');
        } catch {
          // Handled gracefully
        }
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  const teams = useMemo(() => {
    const merged = [...cloudTeams, ...localTeams, ...STARTER_COMMUNITY_TEAMS];
    const seen = new Set<string>();
    const unique: RunningTeam[] = [];
    for (const t of merged) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        unique.push(t);
      }
    }
    return unique;
  }, [cloudTeams, localTeams]);

  const isTeamCreator = useCallback(
    (team: RunningTeam): boolean => {
      if (team.isStarterTeam) return false;
      if (team.isLocalOnly) {
        return team.creatorId === 'local-athlete' || (Boolean(firebaseUser) && team.creatorId === firebaseUser?.uid);
      }
      return Boolean(firebaseUser) && team.creatorId === firebaseUser?.uid;
    },
    [firebaseUser]
  );

  const createTeam = useCallback(
    async (input: CreateTeamInput): Promise<RunningTeam | null> => {
      const cleanName = input.name.trim().slice(0, 60);
      const cleanTag = sanitizeTeamTag(input.tag);
      const cleanCity = (input.city.trim() || 'Brasil').slice(0, 60);
      const cleanMotto = input.motto.trim().slice(0, 140);
      const cleanEmblem = (input.emblem || '⚡').slice(0, 16);

      if (cleanName.length < 2) {
        setErrorMessage('Informe um nome de equipe com pelo menos 2 caracteres.');
        return null;
      }

      setIsMutating(true);
      setErrorMessage(null);

      try {
        const teamId = `team_${sanitizeFirestoreId(cleanTag.toLowerCase(), 't')}_${Date.now()}`;
        const creatorMember = buildCurrentUserMember(userProfile, teamId, currentActorId);
        const addedMembers: TeamMember[] = [creatorMember];
        const usedIds = new Set<string>([creatorMember.memberId]);

        for (const item of input.initialMembers.slice(0, 20)) {
          const mId = sanitizeFirestoreId(item.memberId || `mem_${item.name}_${Date.now()}`, 'mem');
          if (usedIds.has(mId)) continue;
          usedIds.add(mId);
          addedMembers.push({
            memberId: mId,
            teamId,
            name: item.name.trim().slice(0, 80) || 'Atleta',
            avatar: (item.avatar || (item.gender === 'feminino' ? '🏃‍♀️' : '🏃‍♂️')).slice(0, 16),
            role: 'integrante',
            city: (item.city?.trim() || cleanCity).slice(0, 60),
            ageCategory: item.ageCategory,
            gender: item.gender,
            totalPoints: Math.max(0, Math.round(item.totalPoints ?? 1200)),
            totalKm: Math.max(0, Number((item.totalKm ?? 45).toFixed(1))),
            monthlyPoints: Math.max(0, Math.round(item.monthlyPoints ?? 380)),
            monthlyKm: Math.max(0, Number((item.monthlyKm ?? 18).toFixed(1))),
            avgPaceMinKm: Number(Math.min(25, Math.max(2, item.avgPaceMinKm ?? 5.25)).toFixed(2)),
            addedBy: currentActorId,
            joinedAtIso: new Date().toISOString(),
          });
        }

        const agg = computeTeamAggregates(addedMembers);
        const nowIso = new Date().toISOString();
        const creatorName = (
          userProfile.name?.trim() ||
          firebaseUser?.displayName ||
          'Capitão RUN360X'
        ).slice(0, 80);

        const newTeam: RunningTeam = {
          id: teamId,
          name: cleanName,
          tag: cleanTag,
          city: cleanCity,
          motto: cleanMotto,
          emblem: cleanEmblem,
          accentColor: input.accentColor,
          creatorId: currentActorId,
          creatorName,
          ...agg,
          visibility: 'community',
          createdAtIso: nowIso,
          updatedAtIso: nowIso,
          members: addedMembers,
          isLocalOnly: !firebaseUser,
        };

        if (firebaseUser) {
          const batch = writeBatch(db);
          const teamRef = doc(db, 'teams', teamId);
          batch.set(teamRef, {
            name: newTeam.name,
            tag: newTeam.tag,
            city: newTeam.city,
            motto: newTeam.motto,
            emblem: newTeam.emblem,
            accentColor: newTeam.accentColor,
            creatorId: firebaseUser.uid,
            creatorName: newTeam.creatorName,
            memberCount: newTeam.memberCount,
            totalPoints: newTeam.totalPoints,
            totalKm: newTeam.totalKm,
            monthlyPoints: newTeam.monthlyPoints,
            monthlyKm: newTeam.monthlyKm,
            avgPaceMinKm: newTeam.avgPaceMinKm,
            visibility: 'community',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          for (const member of addedMembers) {
            const memberRef = doc(db, 'teams', teamId, 'members', member.memberId);
            batch.set(memberRef, {
              teamId,
              memberId: member.memberId,
              name: member.name,
              avatar: member.avatar,
              role: member.role,
              city: member.city,
              ageCategory: member.ageCategory,
              gender: member.gender,
              totalPoints: member.totalPoints,
              totalKm: member.totalKm,
              monthlyPoints: member.monthlyPoints,
              monthlyKm: member.monthlyKm,
              avgPaceMinKm: member.avgPaceMinKm,
              addedBy: firebaseUser.uid,
              joinedAt: serverTimestamp(),
            });
          }

          await batch.commit();
        } else {
          const updated = [newTeam, ...readLocalTeams()];
          writeLocalTeams(updated);
          setLocalTeams(updated);
        }

        return newTeam;
      } catch (err) {
        setErrorMessage('Não foi possível criar a equipe. Verifique sua conexão e tente novamente.');
        try {
          handleFirestoreError(err, OperationType.CREATE, 'teams');
        } catch {
          // Handled in UI
        }
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [currentActorId, firebaseUser, userProfile]
  );

  const addMemberToTeam = useCallback(
    async (teamId: string, memberInput: AddTeamMemberInput): Promise<boolean> => {
      const target = teams.find((t) => t.id === teamId);
      if (!target || !isTeamCreator(target)) {
        setErrorMessage('Apenas o criador da equipe pode adicionar novos integrantes.');
        return false;
      }

      if (target.members.length >= 50) {
        setErrorMessage('Esta equipe atingiu o limite máximo de 50 integrantes.');
        return false;
      }

      const cleanName = memberInput.name.trim().slice(0, 80);
      if (!cleanName) {
        setErrorMessage('Informe o nome do integrante para adicionar à equipe.');
        return false;
      }

      const memberId = sanitizeFirestoreId(
        memberInput.memberId || `mem_${cleanName.toLowerCase()}_${Date.now()}`,
        'mem'
      );

      if (target.members.some((m) => m.memberId === memberId)) {
        setErrorMessage('Este atleta já faz parte da equipe.');
        return false;
      }

      const newMember: TeamMember = {
        memberId,
        teamId,
        name: cleanName,
        avatar: (memberInput.avatar || (memberInput.gender === 'feminino' ? '🏃‍♀️' : '🏃‍♂️')).slice(0, 16),
        role: 'integrante',
        city: (memberInput.city?.trim() || target.city).slice(0, 60),
        ageCategory: memberInput.ageCategory,
        gender: memberInput.gender,
        totalPoints: Math.max(0, Math.round(memberInput.totalPoints ?? 1450)),
        totalKm: Math.max(0, Number((memberInput.totalKm ?? 52).toFixed(1))),
        monthlyPoints: Math.max(0, Math.round(memberInput.monthlyPoints ?? 420)),
        monthlyKm: Math.max(0, Number((memberInput.monthlyKm ?? 22).toFixed(1))),
        avgPaceMinKm: Number(Math.min(25, Math.max(2, memberInput.avgPaceMinKm ?? 5.2)).toFixed(2)),
        addedBy: currentActorId,
        joinedAtIso: new Date().toISOString(),
      };

      const nextMembers = [...target.members, newMember];
      const nextAgg = computeTeamAggregates(nextMembers);

      setIsMutating(true);
      setErrorMessage(null);

      try {
        if (!target.isLocalOnly && firebaseUser) {
          const batch = writeBatch(db);
          const memberRef = doc(db, 'teams', teamId, 'members', memberId);
          const teamRef = doc(db, 'teams', teamId);

          batch.set(memberRef, {
            teamId,
            memberId: newMember.memberId,
            name: newMember.name,
            avatar: newMember.avatar,
            role: newMember.role,
            city: newMember.city,
            ageCategory: newMember.ageCategory,
            gender: newMember.gender,
            totalPoints: newMember.totalPoints,
            totalKm: newMember.totalKm,
            monthlyPoints: newMember.monthlyPoints,
            monthlyKm: newMember.monthlyKm,
            avgPaceMinKm: newMember.avgPaceMinKm,
            addedBy: firebaseUser.uid,
            joinedAt: serverTimestamp(),
          });

          batch.update(teamRef, {
            ...nextAgg,
            updatedAt: serverTimestamp(),
          });

          await batch.commit();
        } else {
          const nextLocal = readLocalTeams().map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  ...nextAgg,
                  members: nextMembers,
                  updatedAtIso: new Date().toISOString(),
                }
              : t
          );
          writeLocalTeams(nextLocal);
          setLocalTeams(nextLocal);
        }
        return true;
      } catch (err) {
        setErrorMessage('Não foi possível adicionar o integrante agora.');
        try {
          handleFirestoreError(err, OperationType.WRITE, `teams/${teamId}/members/${memberId}`);
        } catch {
          // Handled
        }
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [currentActorId, firebaseUser, isTeamCreator, teams]
  );

  const removeMemberFromTeam = useCallback(
    async (teamId: string, memberId: string): Promise<boolean> => {
      const target = teams.find((t) => t.id === teamId);
      if (!target || !isTeamCreator(target)) {
        setErrorMessage('Apenas o criador da equipe pode remover integrantes.');
        return false;
      }

      const member = target.members.find((m) => m.memberId === memberId);
      if (!member) return false;
      if (member.role === 'capitao') {
        setErrorMessage('O capitão criador não pode ser removido da própria equipe.');
        return false;
      }

      const nextMembers = target.members.filter((m) => m.memberId !== memberId);
      const nextAgg = computeTeamAggregates(nextMembers);

      setIsMutating(true);
      setErrorMessage(null);

      try {
        if (!target.isLocalOnly && firebaseUser) {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'teams', teamId, 'members', memberId));
          batch.update(doc(db, 'teams', teamId), {
            ...nextAgg,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } else {
          const nextLocal = readLocalTeams().map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  ...nextAgg,
                  members: nextMembers,
                  updatedAtIso: new Date().toISOString(),
                }
              : t
          );
          writeLocalTeams(nextLocal);
          setLocalTeams(nextLocal);
        }
        return true;
      } catch (err) {
        setErrorMessage('Não foi possível remover o integrante agora.');
        try {
          handleFirestoreError(err, OperationType.DELETE, `teams/${teamId}/members/${memberId}`);
        } catch {
          // Handled
        }
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [firebaseUser, isTeamCreator, teams]
  );

  const deleteTeam = useCallback(
    async (teamId: string): Promise<boolean> => {
      const target = teams.find((t) => t.id === teamId);
      if (!target || !isTeamCreator(target)) {
        setErrorMessage('Apenas o criador pode excluir esta equipe.');
        return false;
      }

      setIsMutating(true);
      setErrorMessage(null);

      try {
        if (!target.isLocalOnly && firebaseUser) {
          const batch = writeBatch(db);
          for (const m of target.members) {
            batch.delete(doc(db, 'teams', teamId, 'members', m.memberId));
          }
          batch.delete(doc(db, 'teams', teamId));
          await batch.commit();
        } else {
          const nextLocal = readLocalTeams().filter((t) => t.id !== teamId);
          writeLocalTeams(nextLocal);
          setLocalTeams(nextLocal);
        }
        return true;
      } catch (err) {
        setErrorMessage('Não foi possível excluir a equipe agora.');
        try {
          handleFirestoreError(err, OperationType.DELETE, `teams/${teamId}`);
        } catch {
          // Handled
        }
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [firebaseUser, isTeamCreator, teams]
  );

  return {
    teams,
    currentActorId,
    isLoadingCloud,
    isMutating,
    errorMessage,
    clearError: () => setErrorMessage(null),
    createTeam,
    addMemberToTeam,
    removeMemberFromTeam,
    deleteTeam,
    isTeamCreator,
  };
}
