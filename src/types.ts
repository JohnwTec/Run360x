export type TrainingLevelId = 'nivel-1' | 'nivel-2' | 'nivel-3' | 'nivel-4' | 'nivel-5';

export type WorkoutModeId = 'longao' | 'tempo' | 'intervalado';

export interface WorkoutOption {
  id: WorkoutModeId;
  title: string;
  badge: string;
  tagline: string;
  description: string;
  targetDistanceKm: number;
  estimatedDurationMins: number;
  targetPaceMinKm: number;
  xpBonus: number;
  intervals: {
    type: 'warmup' | 'run' | 'walk' | 'sprint' | 'cooldown';
    durationSeconds: number;
    distanceMeters?: number;
    label: string;
    targetPaceMinKm: number;
  }[];
}

export interface TrainingLevel {
  id: TrainingLevelId;
  levelNumber: number;
  title: string;
  codename: string;
  badge: string;
  description: string;
  focus: string;
  mapObjective: string;
  gamificationNote: string;
  targetDistanceKm: number;
  conquestSectorName: string;
  workoutOptions: WorkoutOption[];
  intervals: {
    type: 'warmup' | 'run' | 'walk' | 'sprint' | 'cooldown';
    durationSeconds: number;
    distanceMeters?: number;
    label: string;
    targetPaceMinKm: number;
  }[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PathPoint extends LatLng {
  timestamp: number;
  speedKmh: number;
  paceMinKm: number;
  phase: 'warmup' | 'jog' | 'sprint' | 'cooldown';
  isRecordSparks?: boolean;
  elevationMeters?: number;
}

export interface ConqueredSegment {
  id: string;
  name: string;
  distanceMeters: number;
  avgPaceMinKm: number;
  elevationGainMeters: number;
  neonColor: string; // e.g. '#ff00aa', '#00ff88', '#ffee00', '#00f0ff'
  glowColor: string;
  badgeTitle: string;
  xpBonus: number;
  coordinates: LatLng[];
  isPR?: boolean;
  topSpeedKmH?: number;
  runnersOvertaken?: number;
  cadenceAvg?: number;
  effortRating?: string;
}

export interface XPOrb {
  id: string;
  position: LatLng;
  xpValue: number;
  title: string;
  collected: boolean;
}

export interface CombatZone {
  id: string;
  title: string;
  description: string;
  startPoint: LatLng;
  endPoint: LatLng;
  triggered: boolean;
  active: boolean;
}

export interface GhostPoint extends LatLng {
  timeOffsetSec: number;
}

export interface KmSplit {
  kmNumber: number;
  timeSeconds: number;
  paceMinKm: number;
}

export interface WorkoutStats {
  id: string;
  date: string;
  timeOfDay: string;
  levelId: TrainingLevelId;
  workoutMode: WorkoutModeId;
  workoutTitle: string;
  totalDistanceMeters: number;
  durationSeconds: number;
  avgPaceMinKm: number;
  maxSpeedKmh: number;
  avgHeartRateBpm: number;
  caloriesKcal: number;
  stepsCount: number;
  xpGained: number;
  orbsCollectedCount: number;
  ghostDefeated: boolean;
  batteryRemainingPercent: number;
  sectorConquered?: string;
  strengthScore: number;
  speedScore: number;
  agilityScore: number;
  splits: KmSplit[];
  path: PathPoint[];
}

export type DeviceCategory = 'watch' | 'headphones' | 'health_sensor';

export interface ConnectedDevice {
  id: string;
  name: string;
  category: DeviceCategory;
  brand: string; // e.g. Garmin, Apple, Polar, Stryd, Bose, AirPods
  status: 'connected' | 'connecting' | 'disconnected';
  batteryLevel?: number;
  lastSync?: string;
  metricsProvided: string[]; // e.g. ['HeartRate', 'SpO2', 'Cadence', 'Watts']
  connectionType: 'Bluetooth LE' | 'HealthKit' | 'ANT+' | 'Web API';
}

export interface UserProfile {
  name?: string;
  email?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  registered?: boolean;
  level: number;
  xp: number;
  totalDistanceKm: number;
  conqueredSectors: string[];
  badges: {
    id: string;
    title: string;
    description: string;
    unlockedAt?: string;
    icon: string;
  }[];
  history: WorkoutStats[];
  connectedDevices?: ConnectedDevice[];
}

