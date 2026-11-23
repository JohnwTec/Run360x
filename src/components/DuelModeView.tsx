import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Swords,
  Play,
  Pause,
  Flag,
  Copy,
  Check,
  Users,
  Radio,
  Compass,
  Trophy,
  Zap,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  LogIn,
  Timer,
  Navigation,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  DuelLapRecord,
  DuelMapOpponent,
  DuelModeKind,
  DuelRunnerRole,
  DuelSession,
  LatLng,
  PathPoint,
  TrainingLevelId,
  UserProfile,
} from '../types';
import { TRAINING_LEVELS } from '../data/trainingPrograms';
import { TacticalMap } from './TacticalMap';
import {
  calculateDistanceMeters,
  formatPace,
  formatTime,
  simulateNextPosition,
} from '../utils/geo';
import {
  createOnlineDuelRoom,
  deleteOnlineDuelRoom,
  findDuelByRoomCode,
  formatLapDelta,
  formatLapTime,
  formatSeparationMeters,
  joinOnlineDuelRoom,
  recordOnlineLap,
  subscribeDuelLaps,
  subscribeDuelSession,
  subscribeOpenDuels,
  syncRunnerTelemetry,
} from '../utils/duelStore';

interface DuelModeViewProps {
  userProfile: UserProfile;
  firebaseUser: FirebaseUser | null;
  userPosition: LatLng;
  apiKey: string;
  hasValidKey: boolean;
  theme: 'dark' | 'light';
  isSmartphone?: boolean;
  onSignInWithGoogle: () => Promise<void>;
  onDuelFinished?: (xpEarned: number, distanceMeters: number) => void;
}

interface LocalRivalPreset {
  id: string;
  name: string;
  avatar: string;
  profileLabel: string;
  paceOffsetMinKm: number; // negative = faster than mission target
  variability: number;
  closingKick: number; // extra speed in later laps
}

const LOCAL_RIVAL_PRESETS: LocalRivalPreset[] = [
  {
    id: 'vento',
    name: 'Lucas "Vento" Silva',
    avatar: '⚡',
    profileLabel: 'Ritmo Constante (Pace da Missão)',
    paceOffsetMinKm: -0.05,
    variability: 0.14,
    closingKick: 0.04,
  },
  {
    id: 'turbo',
    name: 'Camila "Turbo" Rocha',
    avatar: '🔥',
    profileLabel: 'Ritmo Agressivo (-0\'20"/km)',
    paceOffsetMinKm: -0.35,
    variability: 0.22,
    closingKick: 0.12,
  },
  {
    id: 'diesel',
    name: 'Rafael "Diesel" Costa',
    avatar: '🛡️',
    profileLabel: 'Progressivo (Acelera nas Voltas Finais)',
    paceOffsetMinKm: 0.2,
    variability: 0.12,
    closingKick: 0.28,
  },
];

const LAP_DISTANCE_OPTIONS = [400, 500, 1000] as const;
const MAX_OPPONENT_TRAIL = 60;

export const DuelModeView: React.FC<DuelModeViewProps> = ({
  userProfile,
  firebaseUser,
  userPosition,
  apiKey,
  hasValidKey,
  theme,
  isSmartphone = false,
  onSignInWithGoogle,
  onDuelFinished,
}) => {
  const isLight = theme === 'light';

  // Lobby Configuration
  const [lobbyMode, setLobbyMode] = useState<DuelModeKind>('local');
  const [selectedMissionId, setSelectedMissionId] = useState<TrainingLevelId>('nivel-2');
  const [lapDistanceMeters, setLapDistanceMeters] = useState<number>(500);
  const [selectedRivalId, setSelectedRivalId] = useState<string>(LOCAL_RIVAL_PRESETS[0].id);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [isSubmittingLobby, setIsSubmittingLobby] = useState<boolean>(false);
  const [openRooms, setOpenRooms] = useState<DuelSession[]>([]);

  // Active Duel Session State
  const [activeMode, setActiveMode] = useState<DuelModeKind | null>(null);
  const [activeRole, setActiveRole] = useState<DuelRunnerRole>('host');
  const [activeDuelId, setActiveDuelId] = useState<string | null>(null);
  const [duelSession, setDuelSession] = useState<DuelSession | null>(null);
  const [laps, setLaps] = useState<DuelLapRecord[]>([]);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [arenaNotice, setArenaNotice] = useState<string | null>(null);
  const [xpAwardedForDuel, setXpAwardedForDuel] = useState<boolean>(false);

  // Live Local Runner Movement State (both Online & Local modes drive your live runner)
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [useRealGps, setUseRealGps] = useState<boolean>(false);
  const [simSpeedKmh, setSimSpeedKmh] = useState<number>(12.5);
  const [isNitroBurst, setIsNitroBurst] = useState<boolean>(false);
  const [myPos, setMyPos] = useState<LatLng>(userPosition);
  const [myHeading, setMyHeading] = useState<number>(35);
  const [myPath, setMyPath] = useState<PathPoint[]>([]);
  const [myDistanceMeters, setMyDistanceMeters] = useState<number>(0);
  const [myElapsedSeconds, setMyElapsedSeconds] = useState<number>(0);
  const [myCurrentLap, setMyCurrentLap] = useState<number>(1);
  const [myLastLapCumSec, setMyLastLapCumSec] = useState<number>(0);
  const [myLastLapDistM, setMyLastLapDistM] = useState<number>(0);
  const [myLivePaceMinKm, setMyLivePaceMinKm] = useState<number>(5.0);

  // Opponent live trail & Local Pacer state
  const [opponentTrail, setOpponentTrail] = useState<LatLng[]>([]);
  const [rivalPos, setRivalPos] = useState<LatLng>(userPosition);
  const [rivalHeading, setRivalHeading] = useState<number>(35);
  const [rivalDistanceMeters, setRivalDistanceMeters] = useState<number>(0);
  const [rivalCurrentLap, setRivalCurrentLap] = useState<number>(1);
  const [rivalLastLapCumSec, setRivalLastLapCumSec] = useState<number>(0);
  const [rivalLivePaceMinKm, setRivalLivePaceMinKm] = useState<number>(5.0);

  const myName = userProfile.name?.trim() || firebaseUser?.displayName?.trim() || 'Corredor RUN360X';
  const myAvatar = userProfile.gender === 'feminino' ? '🏃‍♀️' : '🏃';
  const myUid = firebaseUser?.uid || 'local-runner';

  const selectedMission = useMemo(
    () => TRAINING_LEVELS.find((l) => l.id === selectedMissionId) || TRAINING_LEVELS[1],
    [selectedMissionId]
  );

  const selectedRivalPreset = useMemo(
    () => LOCAL_RIVAL_PRESETS.find((r) => r.id === selectedRivalId) || LOCAL_RIVAL_PRESETS[0],
    [selectedRivalId]
  );

  // Refs to avoid stale closures inside 250ms simulation/telemetry ticks
  const myPosRef = useRef<LatLng>(myPos);
  const myHeadingRef = useRef<number>(myHeading);
  const myDistRef = useRef<number>(myDistanceMeters);
  const myElapsedRef = useRef<number>(myElapsedSeconds);
  const myLapRef = useRef<number>(myCurrentLap);
  const myLastLapCumRef = useRef<number>(myLastLapCumSec);
  const myLastLapDistRef = useRef<number>(myLastLapDistM);
  const myPaceRef = useRef<number>(myLivePaceMinKm);

  const rivalPosRef = useRef<LatLng>(rivalPos);
  const rivalHeadingRef = useRef<number>(rivalHeading);
  const rivalDistRef = useRef<number>(rivalDistanceMeters);
  const rivalLapRef = useRef<number>(rivalCurrentLap);
  const rivalLastLapCumRef = useRef<number>(rivalLastLapCumSec);
  const rivalPaceRef = useRef<number>(rivalLivePaceMinKm);

  const lastFirestoreSyncRef = useRef<number>(0);
  const fogClearedGridRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    myPosRef.current = myPos;
  }, [myPos]);
  useEffect(() => {
    myHeadingRef.current = myHeading;
  }, [myHeading]);
  useEffect(() => {
    myDistRef.current = myDistanceMeters;
  }, [myDistanceMeters]);
  useEffect(() => {
    myElapsedRef.current = myElapsedSeconds;
  }, [myElapsedSeconds]);
  useEffect(() => {
    myLapRef.current = myCurrentLap;
  }, [myCurrentLap]);
  useEffect(() => {
    myLastLapCumRef.current = myLastLapCumSec;
  }, [myLastLapCumSec]);
  useEffect(() => {
    myLastLapDistRef.current = myLastLapDistM;
  }, [myLastLapDistM]);
  useEffect(() => {
    myPaceRef.current = myLivePaceMinKm;
  }, [myLivePaceMinKm]);

  useEffect(() => {
    rivalPosRef.current = rivalPos;
  }, [rivalPos]);
  useEffect(() => {
    rivalHeadingRef.current = rivalHeading;
  }, [rivalHeading]);
  useEffect(() => {
    rivalDistRef.current = rivalDistanceMeters;
  }, [rivalDistanceMeters]);
  useEffect(() => {
    rivalLapRef.current = rivalCurrentLap;
  }, [rivalCurrentLap]);
  useEffect(() => {
    rivalLastLapCumRef.current = rivalLastLapCumSec;
  }, [rivalLastLapCumSec]);
  useEffect(() => {
    rivalPaceRef.current = rivalLivePaceMinKm;
  }, [rivalLivePaceMinKm]);

  // Subscribe to open online rooms while in lobby and signed in
  useEffect(() => {
    if (!firebaseUser || activeMode !== null) {
      return;
    }
    const unsub = subscribeOpenDuels((duels) => {
      setOpenRooms(duels.filter((d) => d.status !== 'finished'));
    });
    return () => unsub();
  }, [firebaseUser, activeMode]);

  // Subscribe to active online duel session & lap splits
  useEffect(() => {
    if (activeMode !== 'online' || !activeDuelId || !firebaseUser) {
      return;
    }

    const unsubDuel = subscribeDuelSession(activeDuelId, (updated) => {
      if (!updated) {
        setArenaNotice('A sala foi encerrada pelo anfitrião.');
        return;
      }
      setDuelSession(updated);

      // Update opponent trail when remote runner moves
      const remoteLat = activeRole === 'host' ? updated.guestLat : updated.hostLat;
      const remoteLng = activeRole === 'host' ? updated.guestLng : updated.hostLng;
      const hasRemote = activeRole === 'host' ? Boolean(updated.guestId) : Boolean(updated.hostId);

      if (hasRemote) {
        const nextRemotePos: LatLng = { lat: remoteLat, lng: remoteLng };
        setOpponentTrail((prev) => {
          const last = prev[prev.length - 1];
          if (last && calculateDistanceMeters(last, nextRemotePos) < 0.75) {
            return prev;
          }
          const next = [...prev, nextRemotePos];
          return next.length > MAX_OPPONENT_TRAIL ? next.slice(next.length - MAX_OPPONENT_TRAIL) : next;
        });
      }
    });

    const unsubLaps = subscribeDuelLaps(activeDuelId, (updatedLaps) => {
      setLaps(updatedLaps);
    });

    return () => {
      unsubDuel();
      unsubLaps();
    };
  }, [activeMode, activeDuelId, activeRole, firebaseUser]);

  // Helper to reset runner coordinates and telemetry for a fresh duel
  const resetArenaTelemetry = (startLatLng: LatLng) => {
    const initialHeading = 38;
    // Offset rival ~8 meters perpendicular so both markers and distance vector are distinct at start
    const rivalOffsetLat = startLatLng.lat + 0.00005;
    const rivalOffsetLng = startLatLng.lng + 0.00007;

    setMyPos(startLatLng);
    setMyHeading(initialHeading);
    setMyPath([
      {
        lat: startLatLng.lat,
        lng: startLatLng.lng,
        timestamp: Date.now(),
        speedKmh: 0,
        paceMinKm: 5.5,
        phase: 'jog',
      },
    ]);
    setMyDistanceMeters(0);
    setMyElapsedSeconds(0);
    setMyCurrentLap(1);
    setMyLastLapCumSec(0);
    setMyLastLapDistM(0);
    setMyLivePaceMinKm(5.0);

    const startRivalPos = { lat: rivalOffsetLat, lng: rivalOffsetLng };
    setRivalPos(startRivalPos);
    setRivalHeading(initialHeading);
    setOpponentTrail([startRivalPos]);
    setRivalDistanceMeters(0);
    setRivalCurrentLap(1);
    setRivalLastLapCumSec(0);
    setRivalLivePaceMinKm(5.0);

    setLaps([]);
    setIsRunning(false);
    setIsNitroBurst(false);
    setArenaNotice(null);
    setXpAwardedForDuel(false);
    fogClearedGridRef.current = new Set();
  };

  // Start Instant Local Live Duel (works immediately without requiring two physical devices)
  const handleStartLocalDuel = () => {
    setLobbyError(null);
    const startPos = { ...userPosition };
    resetArenaTelemetry(startPos);

    const duelId = `local_duel_${Date.now()}`;
    const missionTargetPace = selectedMission.workoutOptions[1]?.targetPaceMinKm || 5.2;
    const rivalBasePace = Math.max(3.2, missionTargetPace + selectedRivalPreset.paceOffsetMinKm);
    setRivalLivePaceMinKm(rivalBasePace);
    setSimSpeedKmh(Number((60 / missionTargetPace).toFixed(1)));

    const nowIso = new Date().toISOString();
    const localSession: DuelSession = {
      id: duelId,
      roomCode: 'LOCAL-1V1',
      missionId: selectedMission.id,
      missionTitle: `${selectedMission.title} (${selectedMission.codename})`,
      targetDistanceKm: selectedMission.targetDistanceKm,
      lapDistanceMeters,
      status: 'active',
      visibility: 'duel',
      hostId: myUid,
      hostName: myName,
      hostAvatar: myAvatar,
      hostLat: startPos.lat,
      hostLng: startPos.lng,
      hostHeading: 38,
      hostDistanceMeters: 0,
      hostPaceMinKm: missionTargetPace,
      hostCurrentLap: 1,
      hostElapsedSeconds: 0,
      guestId: `pacer_${selectedRivalPreset.id}`,
      guestName: selectedRivalPreset.name,
      guestAvatar: selectedRivalPreset.avatar,
      guestLat: startPos.lat + 0.00005,
      guestLng: startPos.lng + 0.00007,
      guestHeading: 38,
      guestDistanceMeters: 0,
      guestPaceMinKm: rivalBasePace,
      guestCurrentLap: 1,
      guestElapsedSeconds: 0,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    setActiveMode('local');
    setActiveRole('host');
    setActiveDuelId(duelId);
    setDuelSession(localSession);
    setIsRunning(true);
  };

  // Create Online Firestore Duel Room
  const handleCreateOnlineRoom = async () => {
    if (!firebaseUser) {
      setLobbyError('Faça login com Google para criar uma sala online em tempo real.');
      return;
    }
    setLobbyError(null);
    setIsSubmittingLobby(true);
    try {
      const startPos = { ...userPosition };
      const created = await createOnlineDuelRoom({
        hostId: firebaseUser.uid,
        hostName: myName,
        hostAvatar: myAvatar,
        missionId: selectedMission.id,
        missionTitle: `${selectedMission.title} (${selectedMission.codename})`,
        targetDistanceKm: selectedMission.targetDistanceKm,
        lapDistanceMeters,
        startPos,
        heading: 38,
      });

      resetArenaTelemetry(startPos);
      setActiveMode('online');
      setActiveRole('host');
      setActiveDuelId(created.id);
      setDuelSession(created);
    } catch {
      setLobbyError('Não foi possível criar a sala agora. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSubmittingLobby(false);
    }
  };

  // Join Online Firestore Duel Room (by room code or clicking an open room)
  const handleJoinOnlineRoom = async (roomTarget?: DuelSession) => {
    if (!firebaseUser) {
      setLobbyError('Faça login com Google para entrar em uma sala online.');
      return;
    }
    setLobbyError(null);
    setIsSubmittingLobby(true);

    try {
      const room = roomTarget || (await findDuelByRoomCode(joinCodeInput));
      if (!room) {
        setLobbyError('Sala não encontrada. Confira o código (ex: D-7A4K) e tente novamente.');
        return;
      }

      if (room.status === 'finished') {
        setLobbyError('Este duelo já foi finalizado. Escolha ou crie uma nova sala.');
        return;
      }

      const startPos = { ...userPosition };

      if (room.hostId === firebaseUser.uid) {
        // Rejoin own room as host
        resetArenaTelemetry({ lat: room.hostLat, lng: room.hostLng });
        setActiveMode('online');
        setActiveRole('host');
        setActiveDuelId(room.id);
        setDuelSession(room);
        return;
      }

      if (room.guestId && room.guestId !== firebaseUser.uid) {
        setLobbyError('Esta sala já possui 2 corredores ativos.');
        return;
      }

      if (!room.guestId) {
        await joinOnlineDuelRoom({
          duelId: room.id,
          guestId: firebaseUser.uid,
          guestName: myName,
          guestAvatar: myAvatar,
          startPos,
          heading: 38,
        });
      }

      resetArenaTelemetry(startPos);
      setActiveMode('online');
      setActiveRole('guest');
      setActiveDuelId(room.id);
      setDuelSession({ ...room, guestId: firebaseUser.uid, guestName: myName, status: 'active' });
      setIsRunning(true);
    } catch {
      setLobbyError('Erro ao entrar na sala de duelo. Tente novamente.');
    } finally {
      setIsSubmittingLobby(false);
    }
  };

  // Record a lap split for the current runner (auto on crossing lapDistanceMeters OR manual button)
  const recordMyLapSplit = async (
    lapNum: number,
    elapsedSec: number,
    lapDistActualM: number
  ) => {
    if (!duelSession) return;
    const lapTimeSec = Math.max(1.2, elapsedSec - myLastLapCumRef.current);
    const effectiveDistM = Math.max(100, lapDistActualM);
    const lapPace = Math.max(1.5, Math.min(30, (lapTimeSec / 60) / (effectiveDistM / 1000)));

    myLastLapCumRef.current = elapsedSec;
    myLastLapDistRef.current = myDistRef.current;
    myLapRef.current = lapNum + 1;
    setMyLastLapCumSec(elapsedSec);
    setMyLastLapDistM(myDistRef.current);
    setMyCurrentLap(lapNum + 1);

    const newLap: DuelLapRecord = {
      id: `${activeRole}_lap_${lapNum}_${Date.now()}`,
      duelId: duelSession.id,
      runnerId: myUid,
      runnerRole: activeRole,
      runnerName: myName,
      lapNumber: lapNum,
      lapDistanceMeters: duelSession.lapDistanceMeters,
      lapTimeSeconds: Number(lapTimeSec.toFixed(1)),
      cumulativeSeconds: Number(elapsedSec.toFixed(1)),
      lapPaceMinKm: Number(lapPace.toFixed(2)),
      recordedAtIso: new Date().toISOString(),
    };

    if (activeMode === 'online' && firebaseUser) {
      try {
        await recordOnlineLap({
          duelId: duelSession.id,
          runnerId: firebaseUser.uid,
          runnerRole: activeRole,
          runnerName: myName,
          lapNumber: lapNum,
          lapDistanceMeters: duelSession.lapDistanceMeters,
          lapTimeSeconds: newLap.lapTimeSeconds,
          cumulativeSeconds: newLap.cumulativeSeconds,
          lapPaceMinKm: newLap.lapPaceMinKm,
        });
      } catch {
        setArenaNotice('Falha temporária ao sincronizar volta na nuvem.');
      }
    } else {
      setLaps((prev) => [...prev, newLap]);
    }
  };

  // Manual "Marcar Volta" button handler
  const handleManualMarkLap = () => {
    if (!duelSession || duelSession.status === 'finished') return;
    if (myElapsedRef.current - myLastLapCumRef.current < 1.5) {
      setArenaNotice('Aguarde pelo menos 2 segundos para marcar uma nova volta.');
      return;
    }
    setArenaNotice(null);
    const distSinceLastLap = Math.max(
      duelSession.lapDistanceMeters,
      myDistRef.current - myLastLapDistRef.current
    );
    void recordMyLapSplit(myLapRef.current, myElapsedRef.current, distSinceLastLap);
  };

  // Finish the active duel
  const handleFinishDuel = async () => {
    if (!duelSession) return;
    setIsRunning(false);

    if (activeMode === 'online' && firebaseUser && duelSession.status !== 'finished') {
      await syncRunnerTelemetry({
        duelId: duelSession.id,
        role: activeRole,
        position: myPosRef.current,
        heading: myHeadingRef.current,
        distanceMeters: myDistRef.current,
        paceMinKm: myPaceRef.current,
        currentLap: myLapRef.current,
        elapsedSeconds: myElapsedRef.current,
        status: 'finished',
      });
    } else if (activeMode === 'local') {
      setDuelSession((prev) => (prev ? { ...prev, status: 'finished' } : prev));
    }

    if (!xpAwardedForDuel && onDuelFinished && myDistRef.current >= 50) {
      const xpBonus = Math.round(150 + (myDistRef.current / 1000) * 120);
      setXpAwardedForDuel(true);
      onDuelFinished(xpBonus, myDistRef.current);
    }
  };

  // Leave active duel & return to lobby
  const handleExitDuel = () => {
    setIsRunning(false);
    setActiveMode(null);
    setActiveDuelId(null);
    setDuelSession(null);
    setLaps([]);
    setOpponentTrail([]);
    setArenaNotice(null);
  };

  // Delete an open online room created by the current user
  const handleDeleteOpenRoom = async (duelId: string) => {
    await deleteOnlineDuelRoom(duelId);
  };

  // Copy room code
  const handleCopyRoomCode = async () => {
    if (!duelSession) return;
    try {
      await navigator.clipboard.writeText(duelSession.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setArenaNotice(`Código da sala: ${duelSession.roomCode}`);
    }
  };

  // Real Geolocation Watcher (when user toggles GPS Real)
  useEffect(() => {
    if (!isRunning || !useRealGps || !duelSession || duelSession.status === 'finished') {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setArenaNotice('GPS real indisponível neste navegador. Usando Simulador GPS.');
      setUseRealGps(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const nextPos: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const moved = calculateDistanceMeters(myPosRef.current, nextPos);
        if (moved >= 1.5 && moved < 80) {
          const newDist = myDistRef.current + moved;
          const speedKmh = pos.coords.speed && pos.coords.speed > 0.3 ? pos.coords.speed * 3.6 : 10;
          const paceMinKm = Math.max(2.0, Math.min(18, 60 / Math.max(3, speedKmh)));
          const heading =
            typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)
              ? pos.coords.heading
              : myHeadingRef.current;

          myPosRef.current = nextPos;
          myHeadingRef.current = heading;
          myDistRef.current = newDist;
          myPaceRef.current = paceMinKm;

          setMyPos(nextPos);
          setMyHeading(heading);
          setMyDistanceMeters(newDist);
          setMyLivePaceMinKm(paceMinKm);
          setMyPath((prev) => [
            ...prev.slice(-240),
            {
              lat: nextPos.lat,
              lng: nextPos.lng,
              timestamp: Date.now(),
              speedKmh,
              paceMinKm,
              phase: speedKmh >= 15 ? 'sprint' : 'jog',
            },
          ]);
        }
      },
      () => {
        setArenaNotice('Permissão de GPS negada. Alternando para Simulador GPS.');
        setUseRealGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isRunning, useRealGps, duelSession?.id, duelSession?.status]);

  // Main 250ms Real-Time Duel Loop (Clock + Sim Movement + Local Rival AI + Auto-Lap + Throttled Firestore Sync)
  useEffect(() => {
    if (!activeMode || !duelSession || !isRunning || duelSession.status === 'finished') {
      return;
    }

    const dtSec = 0.25;
    const intervalId = window.setInterval(() => {
      const nextElapsed = Number((myElapsedRef.current + dtSec).toFixed(2));
      myElapsedRef.current = nextElapsed;
      setMyElapsedSeconds(nextElapsed);

      // 1. Advance my runner if using Simulator GPS
      if (!useRealGps) {
        const effectiveSpeedKmh = isNitroBurst ? Math.min(22, simSpeedKmh + 4.5) : simSpeedKmh;
        const { position: nextPos, nextHeading } = simulateNextPosition(
          myPosRef.current,
          myHeadingRef.current,
          effectiveSpeedKmh,
          dtSec
        );
        const stepMeters = calculateDistanceMeters(myPosRef.current, nextPos);
        const nextDist = myDistRef.current + stepMeters;
        const paceMinKm = Math.max(2.0, Math.min(20, 60 / Math.max(3, effectiveSpeedKmh)));

        myPosRef.current = nextPos;
        myHeadingRef.current = nextHeading;
        myDistRef.current = nextDist;
        myPaceRef.current = paceMinKm;

        setMyPos(nextPos);
        setMyHeading(nextHeading);
        setMyDistanceMeters(nextDist);
        setMyLivePaceMinKm(paceMinKm);

        setMyPath((prev) => [
          ...prev.slice(-260),
          {
            lat: nextPos.lat,
            lng: nextPos.lng,
            timestamp: Date.now(),
            speedKmh: effectiveSpeedKmh,
            paceMinKm,
            phase: isNitroBurst || effectiveSpeedKmh >= 16 ? 'sprint' : 'jog',
          },
        ]);

        // Auto-lap trigger when crossing each multiple of lapDistanceMeters
        const expectedLapThreshold = myLapRef.current * duelSession.lapDistanceMeters;
        if (nextDist >= expectedLapThreshold) {
          void recordMyLapSplit(myLapRef.current, nextElapsed, duelSession.lapDistanceMeters);
        }
      } else {
        // Real GPS auto-lap check
        const expectedLapThreshold = myLapRef.current * duelSession.lapDistanceMeters;
        if (myDistRef.current >= expectedLapThreshold) {
          void recordMyLapSplit(myLapRef.current, nextElapsed, duelSession.lapDistanceMeters);
        }
      }

      // 2. If Local Mode: advance live AI Pacer Rival on the exact same mission
      if (activeMode === 'local') {
        const missionTargetPace = selectedMission.workoutOptions[1]?.targetPaceMinKm || 5.2;
        const lapKick = Math.min(0.45, (rivalLapRef.current - 1) * selectedRivalPreset.closingKick);
        const wave = Math.sin(nextElapsed / 7.5) * selectedRivalPreset.variability;
        const rivalPaceNow = Math.max(
          3.1,
          Math.min(12, missionTargetPace + selectedRivalPreset.paceOffsetMinKm - lapKick + wave)
        );
        const rivalSpeedKmh = 60 / rivalPaceNow;

        // Rival gently tracks general mission corridor with slight organic lateral drift
        const desiredCorridorHeading = (myHeadingRef.current + Math.sin(nextElapsed / 11) * 14 + 360) % 360;
        let angleDiff = ((desiredCorridorHeading - rivalHeadingRef.current + 540) % 360) - 180;
        const steeredHeading = (rivalHeadingRef.current + angleDiff * 0.14 + 360) % 360;

        const { position: nextRivalPos, nextHeading: updatedRivalHeading } = simulateNextPosition(
          rivalPosRef.current,
          steeredHeading,
          rivalSpeedKmh,
          dtSec
        );
        const rivalStepM = calculateDistanceMeters(rivalPosRef.current, nextRivalPos);
        const nextRivalDist = rivalDistRef.current + rivalStepM;

        rivalPosRef.current = nextRivalPos;
        rivalHeadingRef.current = updatedRivalHeading;
        rivalDistRef.current = nextRivalDist;
        rivalPaceRef.current = rivalPaceNow;

        setRivalPos(nextRivalPos);
        setRivalHeading(updatedRivalHeading);
        setRivalDistanceMeters(nextRivalDist);
        setRivalLivePaceMinKm(rivalPaceNow);

        setOpponentTrail((prev) => {
          const next = [...prev, nextRivalPos];
          return next.length > MAX_OPPONENT_TRAIL ? next.slice(next.length - MAX_OPPONENT_TRAIL) : next;
        });

        // Auto-lap trigger for local rival
        const rivalLapThreshold = rivalLapRef.current * duelSession.lapDistanceMeters;
        if (nextRivalDist >= rivalLapThreshold) {
          const completedLapNum = rivalLapRef.current;
          const lapTimeSec = Math.max(1.2, nextElapsed - rivalLastLapCumRef.current);
          const lapPace = Math.max(
            1.5,
            Math.min(30, (lapTimeSec / 60) / (duelSession.lapDistanceMeters / 1000))
          );

          rivalLastLapCumRef.current = nextElapsed;
          rivalLapRef.current = completedLapNum + 1;
          setRivalLastLapCumSec(nextElapsed);
          setRivalCurrentLap(completedLapNum + 1);

          const rivalLapRecord: DuelLapRecord = {
            id: `guest_lap_${completedLapNum}_${Date.now()}`,
            duelId: duelSession.id,
            runnerId: duelSession.guestId,
            runnerRole: 'guest',
            runnerName: duelSession.guestName,
            lapNumber: completedLapNum,
            lapDistanceMeters: duelSession.lapDistanceMeters,
            lapTimeSeconds: Number(lapTimeSec.toFixed(1)),
            cumulativeSeconds: Number(nextElapsed.toFixed(1)),
            lapPaceMinKm: Number(lapPace.toFixed(2)),
            recordedAtIso: new Date().toISOString(),
          };
          setLaps((prev) => [...prev, rivalLapRecord]);
        }

        // Check if either runner finished the target mission distance
        const targetMeters = duelSession.targetDistanceKm * 1000;
        if (myDistRef.current >= targetMeters || nextRivalDist >= targetMeters) {
          void handleFinishDuel();
        }
      }

      // 3. If Online Mode: throttled ~1000ms Firestore telemetry sync
      if (activeMode === 'online' && firebaseUser) {
        const nowMs = Date.now();
        const targetMeters = duelSession.targetDistanceKm * 1000;
        const reachedFinish = myDistRef.current >= targetMeters;

        if (reachedFinish || nowMs - lastFirestoreSyncRef.current >= 1000) {
          lastFirestoreSyncRef.current = nowMs;
          void syncRunnerTelemetry({
            duelId: duelSession.id,
            role: activeRole,
            position: myPosRef.current,
            heading: myHeadingRef.current,
            distanceMeters: myDistRef.current,
            paceMinKm: myPaceRef.current,
            currentLap: myLapRef.current,
            elapsedSeconds: nextElapsed,
            status: reachedFinish ? 'finished' : undefined,
          });
          if (reachedFinish) {
            void handleFinishDuel();
          }
        }
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [
    activeMode,
    duelSession?.id,
    duelSession?.status,
    duelSession?.lapDistanceMeters,
    duelSession?.targetDistanceKm,
    isRunning,
    useRealGps,
    simSpeedKmh,
    isNitroBurst,
    activeRole,
    firebaseUser,
    selectedMission,
    selectedRivalPreset,
  ]);

  // Derived Opponent Telemetry (unified across Online Firestore & Local Pacer)
  const opponentState = useMemo(() => {
    if (!duelSession) return null;

    if (activeMode === 'local') {
      const separation = calculateDistanceMeters(myPos, rivalPos);
      return {
        connected: true,
        name: duelSession.guestName,
        avatar: duelSession.guestAvatar || '⚡',
        position: rivalPos,
        heading: rivalHeading,
        distanceMeters: rivalDistanceMeters,
        paceMinKm: rivalLivePaceMinKm,
        currentLap: rivalCurrentLap,
        elapsedSeconds: myElapsedSeconds,
        separationMeters: separation,
        missionGapMeters: myDistanceMeters - rivalDistanceMeters,
      };
    }

    // Online mode
    const opponentIsGuest = activeRole === 'host';
    const oppId = opponentIsGuest ? duelSession.guestId : duelSession.hostId;
    if (!oppId) {
      return {
        connected: false,
        name: 'Aguardando adversário...',
        avatar: '⏳',
        position: myPos,
        heading: myHeading,
        distanceMeters: 0,
        paceMinKm: 6.0,
        currentLap: 1,
        elapsedSeconds: 0,
        separationMeters: 0,
        missionGapMeters: myDistanceMeters,
      };
    }

    const oppPos: LatLng = opponentIsGuest
      ? { lat: duelSession.guestLat, lng: duelSession.guestLng }
      : { lat: duelSession.hostLat, lng: duelSession.hostLng };
    const oppDist = opponentIsGuest ? duelSession.guestDistanceMeters : duelSession.hostDistanceMeters;

    return {
      connected: true,
      name: opponentIsGuest ? duelSession.guestName : duelSession.hostName,
      avatar: (opponentIsGuest ? duelSession.guestAvatar : duelSession.hostAvatar) || '🔥',
      position: oppPos,
      heading: opponentIsGuest ? duelSession.guestHeading : duelSession.hostHeading,
      distanceMeters: oppDist,
      paceMinKm: opponentIsGuest ? duelSession.guestPaceMinKm : duelSession.hostPaceMinKm,
      currentLap: opponentIsGuest ? duelSession.guestCurrentLap : duelSession.hostCurrentLap,
      elapsedSeconds: opponentIsGuest ? duelSession.guestElapsedSeconds : duelSession.hostElapsedSeconds,
      separationMeters: calculateDistanceMeters(myPos, oppPos),
      missionGapMeters: myDistanceMeters - oppDist,
    };
  }, [
    duelSession,
    activeMode,
    activeRole,
    myPos,
    myHeading,
    myDistanceMeters,
    myElapsedSeconds,
    rivalPos,
    rivalHeading,
    rivalDistanceMeters,
    rivalLivePaceMinKm,
    rivalCurrentLap,
  ]);

  const mapOpponentProp: DuelMapOpponent | null = useMemo(() => {
    if (!duelSession || !opponentState || !opponentState.connected) return null;
    return {
      name: opponentState.name,
      avatar: opponentState.avatar,
      position: opponentState.position,
      heading: opponentState.heading,
      trail: opponentTrail,
      separationMeters: opponentState.separationMeters,
      missionGapMeters: opponentState.missionGapMeters,
      currentLap: opponentState.currentLap,
      paceMinKm: opponentState.paceMinKm,
      status: duelSession.status,
    };
  }, [duelSession, opponentState, opponentTrail]);

  // Build unified Lap Comparison Table Rows
  const lapComparisonRows = useMemo(() => {
    const myRole: DuelRunnerRole = activeRole;
    const oppRole: DuelRunnerRole = activeRole === 'host' ? 'guest' : 'host';

    const myLapsMap = new Map<number, DuelLapRecord>();
    const oppLapsMap = new Map<number, DuelLapRecord>();

    laps.forEach((lap) => {
      if (lap.runnerRole === myRole && !myLapsMap.has(lap.lapNumber)) {
        myLapsMap.set(lap.lapNumber, lap);
      } else if (lap.runnerRole === oppRole && !oppLapsMap.has(lap.lapNumber)) {
        oppLapsMap.set(lap.lapNumber, lap);
      }
    });

    const maxLapNum = Math.max(
      0,
      ...Array.from(myLapsMap.keys()),
      ...Array.from(oppLapsMap.keys())
    );

    const rows: {
      lapNumber: number;
      myLap?: DuelLapRecord;
      oppLap?: DuelLapRecord;
      deltaSeconds: number | null; // negative = I was faster
    }[] = [];

    for (let i = 1; i <= maxLapNum; i++) {
      const myLap = myLapsMap.get(i);
      const oppLap = oppLapsMap.get(i);
      rows.push({
        lapNumber: i,
        myLap,
        oppLap,
        deltaSeconds:
          myLap && oppLap ? Number((myLap.lapTimeSeconds - oppLap.lapTimeSeconds).toFixed(1)) : null,
      });
    }

    // Best lap numbers
    let myBestLapNum: number | null = null;
    let myBestTime = Infinity;
    myLapsMap.forEach((lap, num) => {
      if (lap.lapTimeSeconds < myBestTime) {
        myBestTime = lap.lapTimeSeconds;
        myBestLapNum = num;
      }
    });

    let oppBestLapNum: number | null = null;
    let oppBestTime = Infinity;
    oppLapsMap.forEach((lap, num) => {
      if (lap.lapTimeSeconds < oppBestTime) {
        oppBestTime = lap.lapTimeSeconds;
        oppBestLapNum = num;
      }
    });

    return { rows, myBestLapNum, oppBestLapNum };
  }, [laps, activeRole]);

  // Surface styling tokens (matching light/dark system cleanly)
  const cardSurface = isLight
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-slate-900/90 border-slate-800 text-slate-100';
  const subtleSurface = isLight
    ? 'bg-slate-50 border-slate-200 text-slate-800'
    : 'bg-slate-950/70 border-slate-800 text-slate-200';

  // =========================================================================
  // RENDER 1: DUEL LOBBY (MISSION & ROOM SETUP)
  // =========================================================================
  if (!activeMode || !duelSession) {
    return (
      <div className="space-y-6">
        {/* Clean Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-orange-500">
              <Swords className="w-4 h-4" />
              <span>MODO DUELO 1v1 EM TEMPO REAL</span>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Compare voltas ao vivo na mesma missão
            </h2>
            <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Acompanhe a distância exata entre os dois corredores no mapa tático e dispute cada parcial de volta em tempo real.
            </p>
          </div>

          {/* Mode Toggle: Local Instant vs Online 2-Runner Room */}
          <div
            className={`inline-flex p-1 rounded-xl border self-start sm:self-auto ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setLobbyMode('local');
                setLobbyError(null);
              }}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                lobbyMode === 'local'
                  ? isLight
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-cyan-400 text-slate-950'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Duelo Instantâneo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLobbyMode('online');
                setLobbyError(null);
              }}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                lobbyMode === 'online'
                  ? isLight
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-cyan-400 text-slate-950'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Sala Online (2 Corredores)</span>
            </button>
          </div>
        </div>

        {/* Shared Mission & Lap Distance Configuration */}
        <div className={`grid grid-cols-1 ${isSmartphone ? 'gap-4' : 'lg:grid-cols-12 gap-6'}`}>
          <div className={`${isSmartphone ? '' : 'lg:col-span-7'} rounded-2xl border p-5 space-y-5 ${cardSurface}`}>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>1. Escolha a Missão do Duelo</span>
              </h3>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Os dois corredores disputam a mesma distância-alvo e parciais idênticos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TRAINING_LEVELS.map((level) => {
                const isSelected = level.id === selectedMissionId;
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setSelectedMissionId(level.id)}
                    className={`min-h-[72px] p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                      isSelected
                        ? isLight
                          ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500/40'
                          : 'bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-400/40'
                        : isLight
                        ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate">
                        Nível {level.levelNumber} · {level.title}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold tabular-nums shrink-0 ${
                          isSelected
                            ? isLight
                              ? 'text-orange-600'
                              : 'text-cyan-300'
                            : isLight
                            ? 'text-slate-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {level.targetDistanceKm} km
                      </span>
                    </div>
                    <span className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {level.codename} · {level.conquestSectorName}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Lap Split Distance Selector */}
            <div className={`pt-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'} space-y-2.5`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Distância de Cada Volta (Split)</span>
                <span className={`text-xs font-mono tabular-nums ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {Math.max(1, Math.round((selectedMission.targetDistanceKm * 1000) / lapDistanceMeters))} voltas na missão
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {LAP_DISTANCE_OPTIONS.map((meters) => {
                  const active = lapDistanceMeters === meters;
                  return (
                    <button
                      key={meters}
                      type="button"
                      onClick={() => setLapDistanceMeters(meters)}
                      className={`min-h-[44px] rounded-xl border font-mono text-xs font-bold tabular-nums transition cursor-pointer ${
                        active
                          ? isLight
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-orange-500 border-orange-400 text-slate-950'
                          : isLight
                          ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {meters === 1000 ? '1 km (1000m)' : `${meters} metros`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel: Launch Local Duel OR Create/Join Online Room */}
          <div className={`${isSmartphone ? '' : 'lg:col-span-5'} rounded-2xl border p-5 space-y-5 ${cardSurface}`}>
            {lobbyMode === 'local' ? (
              <>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Swords className="w-4 h-4 text-orange-500" />
                    <span>2. Selecione o Adversário ao Vivo</span>
                  </h3>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Ideal para iniciar imediatamente com GPS real ou simulador e testar a comparação de voltas em tempo real.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {LOCAL_RIVAL_PRESETS.map((rival) => {
                    const active = rival.id === selectedRivalId;
                    const basePace = selectedMission.workoutOptions[1]?.targetPaceMinKm || 5.2;
                    const estPace = Math.max(3.2, basePace + rival.paceOffsetMinKm);
                    return (
                      <button
                        key={rival.id}
                        type="button"
                        onClick={() => setSelectedRivalId(rival.id)}
                        className={`w-full min-h-[64px] p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                          active
                            ? isLight
                              ? 'bg-orange-50 border-orange-500'
                              : 'bg-orange-500/15 border-orange-400'
                            : isLight
                            ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl shrink-0">{rival.avatar}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{rival.name}</div>
                            <div className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              {rival.profileLabel}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <div className="text-xs font-bold tabular-nums">{formatPace(estPace)}</div>
                          <div className="text-[10px] opacity-60">pace alvo</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleStartLocalDuel}
                  className={`w-full min-h-[48px] px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                    isLight
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md'
                      : 'bg-gradient-to-r from-orange-500 to-amber-400 hover:opacity-95 text-slate-950 shadow-lg'
                  }`}
                >
                  <Swords className="w-4 h-4" />
                  <span>Iniciar Duelo 1v1 Agora</span>
                </button>
              </>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span>2. Sala Online em Tempo Real</span>
                  </h3>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Crie uma sala e envie o código para outro corredor acompanhar posição no mapa e tempos de volta ao vivo via nuvem.
                  </p>
                </div>

                {!firebaseUser ? (
                  <div className={`rounded-xl border p-4 space-y-3 ${subtleSurface}`}>
                    <p className="text-xs leading-relaxed">
                      Para sincronizar GPS e voltas entre dois corredores online em tempo real, conecte sua conta Google.
                    </p>
                    <button
                      type="button"
                      onClick={() => void onSignInWithGoogle()}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Conectar com Google</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Create Room */}
                    <button
                      type="button"
                      disabled={isSubmittingLobby}
                      onClick={() => void handleCreateOnlineRoom()}
                      className={`w-full min-h-[46px] px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                        isLight
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isSubmittingLobby ? 'Criando sala...' : 'Criar Sala Online de Duelo'}</span>
                    </button>

                    {/* Join by Room Code */}
                    <div className={`pt-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'} space-y-2`}>
                      <label className="text-xs font-bold block">Entrar com Código da Sala</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                          placeholder="Ex: D-7A4K"
                          maxLength={12}
                          className={`flex-1 min-h-[44px] px-3.5 rounded-xl border font-mono text-sm uppercase tracking-wider outline-none ${
                            isLight
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-orange-500'
                              : 'bg-slate-950 border-slate-700 text-white focus:border-cyan-400'
                          }`}
                        />
                        <button
                          type="button"
                          disabled={isSubmittingLobby || !joinCodeInput.trim()}
                          onClick={() => void handleJoinOnlineRoom()}
                          className={`min-h-[44px] px-4 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-40 ${
                            isLight
                              ? 'bg-slate-900 hover:bg-slate-800 text-white'
                              : 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                          }`}
                        >
                          Entrar
                        </button>
                      </div>
                    </div>

                    {/* Open Rooms List */}
                    <div className={`pt-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'} space-y-2.5`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold">Salas Abertas Agora</span>
                        <span className="font-mono text-[11px] opacity-70 tabular-nums">
                          {openRooms.length} {openRooms.length === 1 ? 'sala' : 'salas'}
                        </span>
                      </div>

                      {openRooms.length === 0 ? (
                        <div className={`rounded-xl border p-3.5 text-xs text-center ${subtleSurface}`}>
                          Nenhuma sala aguardando no momento. Crie a primeira acima ou use o Duelo Instantâneo.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                          {openRooms.map((room) => {
                            const isMyRoom = room.hostId === firebaseUser.uid;
                            return (
                              <div
                                key={room.id}
                                className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${subtleSurface}`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-xs font-bold">
                                    <span>{room.hostAvatar || '⚡'}</span>
                                    <span className="truncate">{room.hostName}</span>
                                    <span className="opacity-50">·</span>
                                    <span className="font-mono text-orange-500">{room.roomCode}</span>
                                  </div>
                                  <div className="text-[11px] opacity-70 truncate">
                                    {room.missionTitle} · Volta {room.lapDistanceMeters}m ·{' '}
                                    {room.status === 'waiting' ? 'Aguardando rival' : 'Em andamento'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isMyRoom && (
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteOpenRoom(room.id)}
                                      title="Excluir sala"
                                      className="min-h-[36px] min-w-[36px] rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/15 flex items-center justify-center cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isSubmittingLobby || (!isMyRoom && room.status !== 'waiting')}
                                    onClick={() => void handleJoinOnlineRoom(room)}
                                    className="min-h-[36px] px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer disabled:opacity-40"
                                  >
                                    {isMyRoom ? 'Reentrar' : 'Desafiar'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {lobbyError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-400 font-medium">
                {lobbyError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER 2: ACTIVE REAL-TIME 1v1 DUEL ARENA
  // =========================================================================
  const targetMeters = duelSession.targetDistanceKm * 1000;
  const myProgressPct = Math.min(100, (myDistanceMeters / targetMeters) * 100);
  const oppDistance = opponentState?.distanceMeters ?? 0;
  const oppProgressPct = Math.min(100, (oppDistance / targetMeters) * 100);
  const separationMeters = opponentState?.separationMeters ?? 0;
  const missionGapMeters = opponentState?.missionGapMeters ?? 0;
  const currentLapTimerSec = Math.max(0, myElapsedSeconds - myLastLapCumSec);
  const isFinished = duelSession.status === 'finished';
  const iWonDuel = myDistanceMeters >= oppDistance;

  return (
    <div className="space-y-4">
      {/* Top Arena Command Bar */}
      <div className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-orange-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-black truncate">{duelSession.missionTitle}</div>
              <div className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Meta {duelSession.targetDistanceKm} km · Volta {duelSession.lapDistanceMeters}m ·{' '}
                {isFinished
                  ? 'Finalizado'
                  : duelSession.status === 'waiting'
                  ? 'Aguardando adversário'
                  : 'Duelo ao vivo'}
              </div>
            </div>
          </div>

          {activeMode === 'online' && (
            <button
              type="button"
              onClick={() => void handleCopyRoomCode()}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isLight
                  ? 'bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100'
                  : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-200 hover:bg-cyan-900'
              }`}
              title="Copiar código da sala para enviar ao segundo corredor"
            >
              <span>SALA {duelSession.roomCode}</span>
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`font-mono text-lg font-black tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {formatTime(myElapsedSeconds)}
          </span>
          <button
            type="button"
            onClick={handleExitDuel}
            className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Waiting for Online Rival Banner */}
      {activeMode === 'online' && !opponentState?.connected && (
        <div
          className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isLight
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-amber-950/30 border-amber-500/40 text-amber-100'
          }`}
        >
          <div className="space-y-0.5">
            <div className="text-sm font-bold flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>Aguardando o 2º corredor entrar na sala {duelSession.roomCode}</span>
            </div>
            <p className="text-xs opacity-80">
              Envie o código acima para o outro atleta entrar na aba Modo Duelo. Você já pode aquecer ou iniciar sua telemetria.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleCopyRoomCode()}
            className="min-h-[40px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Código Copiado!' : 'Copiar Código'}</span>
          </button>
        </div>
      )}

      {/* Post-Duel Winner Banner */}
      {isFinished && (
        <div
          className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            iWonDuel
              ? isLight
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
              : isLight
              ? 'bg-orange-50 border-orange-300 text-orange-950'
              : 'bg-orange-950/35 border-orange-500/50 text-orange-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <Trophy className={`w-7 h-7 shrink-0 ${iWonDuel ? 'text-emerald-500' : 'text-orange-500'}`} />
            <div>
              <h3 className="text-base font-black">
                {iWonDuel ? 'Vitória no Duelo Tático!' : `Duelo Concluído — ${opponentState?.name} ficou à frente`}
              </h3>
              <p className="text-xs opacity-85 mt-0.5 font-mono tabular-nums">
                Distância final: {(myDistanceMeters / 1000).toFixed(2)} km vs {(oppDistance / 1000).toFixed(2)} km · Diferença:{' '}
                {missionGapMeters >= 0 ? '+' : '-'}
                {Math.round(Math.abs(missionGapMeters))} m · {lapComparisonRows.rows.length} voltas registradas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExitDuel}
            className="min-h-[42px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-cyan-400 dark:hover:bg-cyan-300 text-white dark:text-slate-950 font-bold text-xs cursor-pointer shrink-0"
          >
            Novo Duelo
          </button>
        </div>
      )}

      {arenaNotice && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-400 font-medium">
          {arenaNotice}
        </div>
      )}

      {/* Main Split Workspace: Tactical Map + Live Controls (7 cols) | Live Lap Comparison & Separation HUD (5 cols) */}
      <div className={isSmartphone ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'}>
        {/* LEFT COLUMN: TACTICAL MAP WITH LIVE DISTANCE VECTOR + RUNNER CONTROLS */}
        <div className={isSmartphone ? 'space-y-3' : 'lg:col-span-7 space-y-3'}>
          <div className={isSmartphone ? 'h-[380px]' : 'h-[520px]'}>
            <TacticalMap
              apiKey={apiKey}
              hasValidKey={hasValidKey}
              userPosition={myPos}
              userHeading={myHeading}
              path={myPath}
              orbs={[]}
              combatZones={[]}
              ghostPosition={myPos}
              ghostDistanceMeters={0}
              currentPhase={isNitroBurst || simSpeedKmh >= 16 ? 'sprint' : 'jog'}
              isRecordSparks={isNitroBurst}
              fogClearedGrid={fogClearedGridRef.current}
              theme={theme}
              duelOpponent={mapOpponentProp}
            />
          </div>

          {/* Live Movement & Lap Action Controls */}
          <div className={`rounded-2xl border p-4 space-y-3 ${cardSurface}`}>
            <div className="flex flex-wrap items-center gap-2">
              {!isFinished && (
                <button
                  type="button"
                  onClick={() => setIsRunning((prev) => !prev)}
                  className={`min-h-[44px] px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
                    isRunning
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : isLight
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                  }`}
                >
                  {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isRunning ? 'Pausar' : myElapsedSeconds > 0 ? 'Retomar' : 'Largada'}</span>
                </button>
              )}

              {!isFinished && (
                <button
                  type="button"
                  onClick={handleManualMarkLap}
                  className={`min-h-[44px] px-4 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                    isLight
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white'
                      : 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-400/60 text-orange-200'
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  <span>Marcar Volta #{myCurrentLap}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setUseRealGps((prev) => !prev)}
                className={`min-h-[44px] px-3.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  useRealGps
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
                    : isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-700'
                    : 'bg-slate-950 border-slate-700 text-slate-300'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{useRealGps ? 'GPS Real Ativo' : 'Simulador GPS'}</span>
              </button>

              {!isFinished && (
                <button
                  type="button"
                  onClick={() => void handleFinishDuel()}
                  className="min-h-[44px] px-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs transition cursor-pointer ml-auto"
                >
                  Encerrar Duelo
                </button>
              )}
            </div>

            {/* Simulator Pace & Direction Controls */}
            {!useRealGps && !isFinished && (
              <div
                className={`pt-3 border-t flex flex-wrap items-center justify-between gap-3 ${
                  isLight ? 'border-slate-200' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono opacity-70 mr-1">Ritmo Sim:</span>
                  {[
                    { label: '9 km/h', val: 9 },
                    { label: '12 km/h', val: 12 },
                    { label: '15 km/h', val: 15 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => {
                        setSimSpeedKmh(opt.val);
                        setIsNitroBurst(false);
                      }}
                      className={`min-h-[36px] px-2.5 rounded-lg border font-mono text-[11px] font-bold cursor-pointer transition ${
                        !isNitroBurst && Math.abs(simSpeedKmh - opt.val) < 1
                          ? isLight
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-cyan-400 border-cyan-400 text-slate-950'
                          : isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsNitroBurst((prev) => !prev)}
                    className={`min-h-[36px] px-2.5 rounded-lg border font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                      isNitroBurst
                        ? 'bg-orange-500 border-orange-400 text-slate-950'
                        : 'bg-orange-500/10 border-orange-500/40 text-orange-400 hover:bg-orange-500/20'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>Sprint</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMyHeading((h) => (h - 22 + 360) % 360)}
                    className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer ${subtleSurface}`}
                    title="Virar à esquerda"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Esq</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMyHeading((h) => (h + 22) % 360)}
                    className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer ${subtleSurface}`}
                    title="Virar à direita"
                  >
                    <span>Dir</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SEPARATION HUD + HEAD-TO-HEAD RUNNER CARDS + LIVE LAP COMPARISON TABLE */}
        <div className={isSmartphone ? 'space-y-4' : 'lg:col-span-5 space-y-4'}>
          {/* Separation & Advantage Metric Card */}
          <div className={`rounded-2xl border p-4 grid grid-cols-2 gap-3 ${cardSurface}`}>
            <div className={`rounded-xl border p-3 ${subtleSurface}`}>
              <div className="text-[11px] font-semibold opacity-70">Distância no Mapa</div>
              <div className="text-2xl font-mono font-black tabular-nums text-orange-500 mt-0.5">
                {opponentState?.connected ? formatSeparationMeters(separationMeters) : '--'}
              </div>
              <div className="text-[11px] opacity-65 mt-0.5">Separação GPS direta</div>
            </div>

            <div className={`rounded-xl border p-3 ${subtleSurface}`}>
              <div className="text-[11px] font-semibold opacity-70">Vantagem na Missão</div>
              <div
                className={`text-2xl font-mono font-black tabular-nums mt-0.5 ${
                  missionGapMeters > 2
                    ? 'text-emerald-500'
                    : missionGapMeters < -2
                    ? 'text-rose-500'
                    : isLight
                    ? 'text-slate-700'
                    : 'text-cyan-300'
                }`}
              >
                {opponentState?.connected
                  ? `${missionGapMeters >= 0 ? '+' : '-'}${Math.round(Math.abs(missionGapMeters))} m`
                  : '--'}
              </div>
              <div className="text-[11px] opacity-65 mt-0.5">
                {!opponentState?.connected
                  ? 'Aguardando rival'
                  : Math.abs(missionGapMeters) <= 2
                  ? 'Lado a lado'
                  : missionGapMeters > 0
                  ? 'Você está na frente'
                  : 'Rival na liderança'}
              </div>
            </div>
          </div>

          {/* Head-to-Head Runner Telemetry Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Corredor A (You) */}
            <div className={`rounded-2xl border p-3.5 space-y-2.5 ${cardSurface}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base">{myAvatar}</span>
                  <span className="text-xs font-bold truncate">{myName.split(' ')[0]}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-cyan-400 shrink-0">VOCÊ</span>
              </div>

              <div className="font-mono">
                <div className="text-xl font-black tabular-nums">
                  {(myDistanceMeters / 1000).toFixed(2)} <span className="text-xs font-normal opacity-70">km</span>
                </div>
                <div className="text-[11px] opacity-75 tabular-nums mt-0.5">
                  Pace {formatPace(myLivePaceMinKm)} · Volta {myCurrentLap}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono opacity-75 tabular-nums">
                  <span>Volta atual</span>
                  <span>{formatLapTime(currentLapTimerSec)}</span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${myProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Corredor B (Opponent) */}
            <div className={`rounded-2xl border p-3.5 space-y-2.5 ${cardSurface}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base">{opponentState?.avatar || '⏳'}</span>
                  <span className="text-xs font-bold truncate">
                    {opponentState?.connected ? opponentState.name.split(' ')[0] : 'Aguardando'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-orange-500 shrink-0">RIVAL</span>
              </div>

              <div className="font-mono">
                <div className="text-xl font-black tabular-nums">
                  {(oppDistance / 1000).toFixed(2)} <span className="text-xs font-normal opacity-70">km</span>
                </div>
                <div className="text-[11px] opacity-75 tabular-nums mt-0.5">
                  {opponentState?.connected
                    ? `Pace ${formatPace(opponentState.paceMinKm)} · Volta ${opponentState.currentLap}`
                    : 'Sem sinal GPS ainda'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono opacity-75 tabular-nums">
                  <span>Progresso</span>
                  <span>{Math.round(oppProgressPct)}%</span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                  <div
                    className="h-full bg-orange-500 transition-all duration-300"
                    style={{ width: `${oppProgressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Lap Comparison Table */}
          <div className={`rounded-2xl border overflow-hidden ${cardSurface}`}>
            <div
              className={`px-4 py-3 border-b flex items-center justify-between ${
                isLight ? 'border-slate-200 bg-slate-50/70' : 'border-slate-800 bg-slate-950/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold">Comparação de Voltas em Tempo Real</h3>
              </div>
              <span className="text-[11px] font-mono opacity-70 tabular-nums">
                {duelSession.lapDistanceMeters}m / volta
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className={`text-[11px] font-mono border-b ${
                      isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    <th className="py-2.5 px-3 font-semibold">Volta</th>
                    <th className="py-2.5 px-3 font-semibold">Você</th>
                    <th className="py-2.5 px-3 font-semibold">Rival</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Δ Tempo</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs tabular-nums divide-y divide-slate-200/60 dark:divide-slate-800/80">
                  {lapComparisonRows.rows.map((row) => {
                    const faster = row.deltaSeconds !== null && row.deltaSeconds < -0.05;
                    const slower = row.deltaSeconds !== null && row.deltaSeconds > 0.05;
                    const isMyBest = lapComparisonRows.myBestLapNum === row.lapNumber;
                    const isOppBest = lapComparisonRows.oppBestLapNum === row.lapNumber;

                    return (
                      <tr key={row.lapNumber} className="transition-colors">
                        <td className="py-2.5 px-3 font-bold">V{row.lapNumber}</td>
                        <td className="py-2.5 px-3">
                          {row.myLap ? (
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <span>{formatLapTime(row.myLap.lapTimeSeconds)}</span>
                              {isMyBest && (
                                <span title="Sua volta mais rápida">
                                  <Sparkles className="w-3 h-3 text-cyan-400" />
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="opacity-45">--:--</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.oppLap ? (
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <span>{formatLapTime(row.oppLap.lapTimeSeconds)}</span>
                              {isOppBest && (
                                <span title="Volta mais rápida do rival">
                                  <Sparkles className="w-3 h-3 text-orange-400" />
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="opacity-45">--:--</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          {row.deltaSeconds === null ? (
                            <span className="opacity-50 text-[11px]">Aguardando</span>
                          ) : (
                            <span
                              className={`inline-flex items-center justify-end gap-0.5 ${
                                faster
                                  ? 'text-emerald-500'
                                  : slower
                                  ? 'text-rose-500'
                                  : 'text-slate-400'
                              }`}
                            >
                              {faster && <ArrowDownRight className="w-3.5 h-3.5" />}
                              {slower && <ArrowUpRight className="w-3.5 h-3.5" />}
                              <span>{formatLapDelta(row.deltaSeconds)}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Active in-progress lap row */}
                  {!isFinished && (
                    <tr className={isLight ? 'bg-orange-50/50' : 'bg-cyan-950/20'}>
                      <td className="py-2.5 px-3 font-bold text-orange-500">V{myCurrentLap}*</td>
                      <td className="py-2.5 px-3 font-bold text-cyan-400">
                        {formatLapTime(currentLapTimerSec)}
                      </td>
                      <td className="py-2.5 px-3 opacity-80">
                        {opponentState?.connected ? `Volta ${opponentState.currentLap}` : '--'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[11px] font-semibold opacity-75">
                        Em curso
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {lapComparisonRows.rows.length === 0 && (
              <div className="px-4 py-3 text-[11px] opacity-70 border-t border-slate-200 dark:border-slate-800">
                Complete {duelSession.lapDistanceMeters}m ou toque em <strong>Marcar Volta</strong> para registrar e comparar o primeiro parcial.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
