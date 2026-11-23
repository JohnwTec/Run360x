import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  DuelLapRecord,
  DuelRunnerRole,
  DuelSession,
  DuelStatus,
  LatLng,
  TrainingLevelId,
} from '../types';

const DUELS_COLLECTION = 'duels';

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function normalizeHeading(heading: number): number {
  if (!Number.isFinite(heading)) return 0;
  const mod = ((heading % 360) + 360) % 360;
  return clampNumber(mod, 0, 360, 0);
}

function normalizePace(paceMinKm: number): number {
  return Number(clampNumber(paceMinKm, 1.5, 30, 6.0).toFixed(2));
}

function toIsoString(ts: unknown): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString();
  }
  if (typeof ts === 'string' && ts.length > 0) {
    return ts;
  }
  return new Date().toISOString();
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `D-${suffix}`;
}

export function formatLapTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds - Math.floor(seconds)) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export function formatLapDelta(deltaSeconds: number): string {
  if (!Number.isFinite(deltaSeconds)) return '0.0s';
  if (Math.abs(deltaSeconds) < 0.05) return '0.0s';
  const sign = deltaSeconds < 0 ? '-' : '+';
  const abs = Math.abs(deltaSeconds);
  if (abs >= 60) {
    const m = Math.floor(abs / 60);
    const s = Math.floor(abs % 60);
    return `${sign}${m}:${String(s).padStart(2, '0')}`;
  }
  return `${sign}${abs.toFixed(1)}s`;
}

export function formatSeparationMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0 m';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

function mapDuelDoc(id: string, data: Record<string, unknown>): DuelSession {
  return {
    id,
    roomCode: String(data.roomCode || 'D-0000'),
    missionId: (String(data.missionId || 'nivel-2') as TrainingLevelId),
    missionTitle: String(data.missionTitle || 'Missão Tática'),
    targetDistanceKm: Number(data.targetDistanceKm || 5),
    lapDistanceMeters: Number(data.lapDistanceMeters || 500),
    status: (String(data.status || 'waiting') as DuelStatus),
    visibility: 'duel',
    hostId: String(data.hostId || ''),
    hostName: String(data.hostName || 'Corredor A'),
    hostAvatar: String(data.hostAvatar || '⚡'),
    hostLat: Number(data.hostLat ?? -23.55052),
    hostLng: Number(data.hostLng ?? -46.633308),
    hostHeading: Number(data.hostHeading ?? 0),
    hostDistanceMeters: Number(data.hostDistanceMeters ?? 0),
    hostPaceMinKm: Number(data.hostPaceMinKm ?? 6),
    hostCurrentLap: Number(data.hostCurrentLap ?? 1),
    hostElapsedSeconds: Number(data.hostElapsedSeconds ?? 0),
    guestId: String(data.guestId || ''),
    guestName: String(data.guestName || ''),
    guestAvatar: String(data.guestAvatar || ''),
    guestLat: Number(data.guestLat ?? -23.55052),
    guestLng: Number(data.guestLng ?? -46.633308),
    guestHeading: Number(data.guestHeading ?? 0),
    guestDistanceMeters: Number(data.guestDistanceMeters ?? 0),
    guestPaceMinKm: Number(data.guestPaceMinKm ?? 6),
    guestCurrentLap: Number(data.guestCurrentLap ?? 1),
    guestElapsedSeconds: Number(data.guestElapsedSeconds ?? 0),
    createdAtIso: toIsoString(data.createdAt),
    updatedAtIso: toIsoString(data.updatedAt),
  };
}

function mapLapDoc(id: string, data: Record<string, unknown>): DuelLapRecord {
  return {
    id,
    duelId: String(data.duelId || ''),
    runnerId: String(data.runnerId || ''),
    runnerRole: (data.runnerRole === 'guest' ? 'guest' : 'host') as DuelRunnerRole,
    runnerName: String(data.runnerName || 'Atleta'),
    lapNumber: Number(data.lapNumber || 1),
    lapDistanceMeters: Number(data.lapDistanceMeters || 500),
    lapTimeSeconds: Number(data.lapTimeSeconds || 0),
    cumulativeSeconds: Number(data.cumulativeSeconds || 0),
    lapPaceMinKm: Number(data.lapPaceMinKm || 6),
    recordedAtIso: toIsoString(data.recordedAt),
  };
}

export interface CreateDuelRoomInput {
  hostId: string;
  hostName: string;
  hostAvatar: string;
  missionId: TrainingLevelId;
  missionTitle: string;
  targetDistanceKm: number;
  lapDistanceMeters: number;
  startPos: LatLng;
  heading: number;
}

export async function createOnlineDuelRoom(input: CreateDuelRoomInput): Promise<DuelSession> {
  const roomCode = generateRoomCode();
  const duelId = `duel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `${DUELS_COLLECTION}/${duelId}`;

  const safeHostName = input.hostName.trim().slice(0, 80) || 'Corredor A';
  const safeAvatar = input.hostAvatar.trim().slice(0, 16) || '⚡';
  const safeLat = clampNumber(input.startPos.lat, -90, 90, -23.55052);
  const safeLng = clampNumber(input.startPos.lng, -180, 180, -46.633308);
  const safeHeading = normalizeHeading(input.heading);

  const payload = {
    roomCode,
    missionId: input.missionId,
    missionTitle: input.missionTitle.trim().slice(0, 100),
    targetDistanceKm: clampNumber(input.targetDistanceKm, 0.5, 100, 5),
    lapDistanceMeters: clampNumber(input.lapDistanceMeters, 100, 5000, 500),
    status: 'waiting' as DuelStatus,
    visibility: 'duel' as const,
    hostId: input.hostId,
    hostName: safeHostName,
    hostAvatar: safeAvatar,
    hostLat: safeLat,
    hostLng: safeLng,
    hostHeading: safeHeading,
    hostDistanceMeters: 0,
    hostPaceMinKm: 6.0,
    hostCurrentLap: 1,
    hostElapsedSeconds: 0,
    guestId: '',
    guestName: '',
    guestAvatar: '',
    guestLat: safeLat,
    guestLng: safeLng,
    guestHeading: safeHeading,
    guestDistanceMeters: 0,
    guestPaceMinKm: 6.0,
    guestCurrentLap: 1,
    guestElapsedSeconds: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, DUELS_COLLECTION, duelId), payload);
    return mapDuelDoc(duelId, {
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function findDuelByRoomCode(roomCodeInput: string): Promise<DuelSession | null> {
  const normalized = roomCodeInput.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!normalized) return null;

  try {
    const q = query(
      collection(db, DUELS_COLLECTION),
      where('visibility', '==', 'duel'),
      where('roomCode', '==', normalized),
      limit(5)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docs = snap.docs.map((d) => mapDuelDoc(d.id, d.data() as Record<string, unknown>));
    // Prefer an active or waiting room
    return docs.find((d) => d.status === 'waiting') || docs.find((d) => d.status === 'active') || docs[0];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, DUELS_COLLECTION);
    return null;
  }
}

export interface JoinDuelRoomInput {
  duelId: string;
  guestId: string;
  guestName: string;
  guestAvatar: string;
  startPos: LatLng;
  heading: number;
}

export async function joinOnlineDuelRoom(input: JoinDuelRoomInput): Promise<void> {
  const path = `${DUELS_COLLECTION}/${input.duelId}`;
  try {
    await updateDoc(doc(db, DUELS_COLLECTION, input.duelId), {
      guestId: input.guestId,
      guestName: input.guestName.trim().slice(0, 80) || 'Corredor B',
      guestAvatar: input.guestAvatar.trim().slice(0, 16) || '🔥',
      guestLat: clampNumber(input.startPos.lat, -90, 90, -23.55052),
      guestLng: clampNumber(input.startPos.lng, -180, 180, -46.633308),
      guestHeading: normalizeHeading(input.heading),
      status: 'active',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export interface SyncRunnerTelemetryInput {
  duelId: string;
  role: DuelRunnerRole;
  position: LatLng;
  heading: number;
  distanceMeters: number;
  paceMinKm: number;
  currentLap: number;
  elapsedSeconds: number;
  status?: DuelStatus;
}

export async function syncRunnerTelemetry(input: SyncRunnerTelemetryInput): Promise<void> {
  const path = `${DUELS_COLLECTION}/${input.duelId}`;
  const lat = clampNumber(input.position.lat, -90, 90, -23.55052);
  const lng = clampNumber(input.position.lng, -180, 180, -46.633308);
  const heading = normalizeHeading(input.heading);
  const distanceMeters = Number(clampNumber(input.distanceMeters, 0, 200000, 0).toFixed(1));
  const paceMinKm = normalizePace(input.paceMinKm);
  const currentLap = Math.round(clampNumber(input.currentLap, 1, 500, 1));
  const elapsedSeconds = Number(clampNumber(input.elapsedSeconds, 0, 86400, 0).toFixed(1));

  const updatePayload: Record<string, unknown> =
    input.role === 'host'
      ? {
          hostLat: lat,
          hostLng: lng,
          hostHeading: heading,
          hostDistanceMeters: distanceMeters,
          hostPaceMinKm: paceMinKm,
          hostCurrentLap: currentLap,
          hostElapsedSeconds: elapsedSeconds,
          updatedAt: serverTimestamp(),
        }
      : {
          guestLat: lat,
          guestLng: lng,
          guestHeading: heading,
          guestDistanceMeters: distanceMeters,
          guestPaceMinKm: paceMinKm,
          guestCurrentLap: currentLap,
          guestElapsedSeconds: elapsedSeconds,
          updatedAt: serverTimestamp(),
        };

  if (input.status) {
    updatePayload.status = input.status;
  }

  try {
    await updateDoc(doc(db, DUELS_COLLECTION, input.duelId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface RecordOnlineLapInput {
  duelId: string;
  runnerId: string;
  runnerRole: DuelRunnerRole;
  runnerName: string;
  lapNumber: number;
  lapDistanceMeters: number;
  lapTimeSeconds: number;
  cumulativeSeconds: number;
  lapPaceMinKm: number;
}

export async function recordOnlineLap(input: RecordOnlineLapInput): Promise<DuelLapRecord> {
  const lapId = `${input.runnerRole}_lap_${input.lapNumber}_${Date.now()}`;
  const path = `${DUELS_COLLECTION}/${input.duelId}/laps/${lapId}`;

  const safeLapTime = Number(clampNumber(input.lapTimeSeconds, 1, 36000, 60).toFixed(1));
  const safeCumulative = Number(clampNumber(input.cumulativeSeconds, safeLapTime, 86400, safeLapTime).toFixed(1));
  const safePace = normalizePace(input.lapPaceMinKm);

  const payload = {
    duelId: input.duelId,
    runnerId: input.runnerId,
    runnerRole: input.runnerRole,
    runnerName: input.runnerName.trim().slice(0, 80) || 'Corredor',
    lapNumber: Math.round(clampNumber(input.lapNumber, 1, 500, 1)),
    lapDistanceMeters: Math.round(clampNumber(input.lapDistanceMeters, 100, 5000, 500)),
    lapTimeSeconds: safeLapTime,
    cumulativeSeconds: safeCumulative,
    lapPaceMinKm: safePace,
    recordedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, DUELS_COLLECTION, input.duelId, 'laps', lapId), payload);
    return mapLapDoc(lapId, { ...payload, recordedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function deleteOnlineDuelRoom(duelId: string): Promise<void> {
  const path = `${DUELS_COLLECTION}/${duelId}`;
  try {
    await deleteDoc(doc(db, DUELS_COLLECTION, duelId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeOpenDuels(
  onUpdate: (duels: DuelSession[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, DUELS_COLLECTION),
    where('visibility', '==', 'duel'),
    limit(25)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapDuelDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, DUELS_COLLECTION);
      if (onError) onError(error);
    }
  );
}

export function subscribeDuelSession(
  duelId: string,
  onUpdate: (duel: DuelSession | null) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `${DUELS_COLLECTION}/${duelId}`;
  return onSnapshot(
    doc(db, DUELS_COLLECTION, duelId),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(mapDuelDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

export function subscribeDuelLaps(
  duelId: string,
  onUpdate: (laps: DuelLapRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `${DUELS_COLLECTION}/${duelId}/laps`;
  const q = query(
    collection(db, DUELS_COLLECTION, duelId, 'laps'),
    where('duelId', '==', duelId),
    limit(150)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const laps = snapshot.docs
        .map((d) => mapLapDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.lapNumber - b.lapNumber || a.cumulativeSeconds - b.cumulativeSeconds);
      onUpdate(laps);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}
