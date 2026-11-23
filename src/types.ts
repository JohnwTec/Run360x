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
  approached?: boolean;
  cleared?: boolean;
}

export interface GhostPoint extends LatLng {
  timeOffsetSec: number;
}

export interface KmSplit {
  kmNumber: number;
  timeSeconds: number;
  paceMinKm: number;
}

export type RunVenueType = 'track_400m' | 'track_200m' | 'treadmill' | 'road_city' | 'trail';

export type GpsSyncStatus = 'searching' | 'locked' | 'simulated' | 'indoor_ready' | 'error';

export interface RunVenueConfig {
  id: RunVenueType;
  label: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  surfaceLabel: string;
  lapLengthMeters: number | null;
  requiresOutdoorGps: boolean;
  supportsIncline: boolean;
  supportsElevation: boolean;
  defaultTargetSpeedKmh: number;
  accentHex: string;
  motivationQuote: string;
}

export interface LevelUpEvent {
  previousLevel: number;
  newLevel: number;
  previousXp: number;
  newXp: number;
  xpGained: number;
}

export interface WorkoutStats {
  id: string;
  createdAtMs?: number;
  date: string;
  timeOfDay: string;
  levelId: TrainingLevelId;
  workoutMode: WorkoutModeId;
  workoutTitle: string;
  venueType?: RunVenueType;
  venueLabel?: string;
  lapsCompleted?: number;
  inclinePercent?: number;
  elevationGainMeters?: number;
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

export type AthleteGender = 'masculino' | 'feminino';

export type AgeCategoryId = 'ate-20' | '21-30' | '31-40' | '41-50' | '50-plus';

export interface RankingAthlete {
  id: string;
  name: string;
  city: string;
  age: number;
  gender: AthleteGender;
  ageCategory: AgeCategoryId;
  level: number;
  totalPoints: number;
  totalKm: number;
  monthlyPoints: number;
  monthlyKm: number;
  yearlyPoints: number;
  yearlyKm: number;
  avgPaceMinKm: number;
  avatar: string;
  isCurrentUser?: boolean;
}

export interface WeeklyGoalConfig {
  targetKm: number;
  targetSessions: number;
  updatedAtIso?: string;
}

export interface UserProfile {
  name?: string;
  email?: string;
  age?: number;
  gender?: AthleteGender;
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
  weeklyGoals?: WeeklyGoalConfig;
}

export interface WeatherCondition {
  code: number;
  label: string;
  icon: string;
  isRain: boolean;
  isSnow: boolean;
  isThunder: boolean;
  isFog: boolean;
  isCloudy: boolean;
  isClear: boolean;
}

export interface HydrationPlan {
  status: string;
  volumePerInterval: string;
  intervalMinutes: number;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  electrolytesRecommendation: string;
  tip: string;
  dailyWaterTargetLiters: number;
}

export interface GearSuggestion {
  id: string;
  title: string;
  category: 'vestuario' | 'protecao' | 'calcado' | 'acessorio' | 'seguranca';
  icon: string;
  reason: string;
  importance: 'obrigatorio' | 'recomendado' | 'opcional';
}

export interface HourlyForecastPoint {
  time: string;
  temperatureC: number;
  precipitationMm: number;
  precipitationProbability: number;
  weatherCode: number;
}

export interface HeavyRainAssessment {
  isHeavyRain: boolean;
  severity: 'none' | 'moderate' | 'heavy' | 'storm';
  precipitationMm: number;
  precipitationProbability: number;
  weatherCode: number;
  conditionLabel: string;
  suggestedRescheduleIso: string;
  suggestedRescheduleLabel: string;
}

export interface ScheduledMissionConfig {
  enabled: boolean;
  scheduledAtIso: string; // local datetime-local format YYYY-MM-DDTHH:mm
  missionTitle: string;
  leadTimeMinutes: number; // default 15
  lastNotifiedForIso?: string | null;
}

export interface WeatherData {
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  precipitationMm: number;
  weatherCode: number;
  isDay: boolean;
  condition: WeatherCondition;
  hydration: HydrationPlan;
  gearSuggestions: GearSuggestion[];
  hourlyForecast?: HourlyForecastPoint[];
  locationName?: string;
  fetchedAt: string;
}

export type AudioCoachCategory = 'pace' | 'milestone' | 'combat_zone' | 'system';

export type AudioCoachPriority = 'low' | 'normal' | 'high' | 'critical';

export interface AudioCoachSettings {
  enabled: boolean;
  announcePace: boolean;
  announceMilestones: boolean;
  announceCombatZones: boolean;
  paceIntervalSeconds: number;
  milestoneStepMeters: 250 | 500 | 1000;
  rate: number;
  volume: number;
  voiceURI: string | null;
}

export interface AudioAnnouncement {
  id: string;
  category: AudioCoachCategory;
  priority: AudioCoachPriority;
  text: string;
  timestamp: number;
  spoken: boolean;
}

export type CommunityOverlayStyle = 'neon' | 'solar' | 'emerald' | 'crystal';

export type CommunityHudAnchor = 'top' | 'center' | 'bottom';

export interface CommunityPostMetrics {
  distanceKm: number;
  avgPaceMinKm: number;
  fastestKmPaceMinKm: number;
  avgSpeedKmh: number;
  durationSeconds: number;
  xpGained: number;
  achievementTitle: string;
  routeLine: string[]; // Normalized "x,y" points in [0..1] (max 48)
}

export interface CommunityPost extends CommunityPostMetrics {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorLevel: number;
  ageCategoryLabel: string;
  genderLabel: string;
  vibrantText: string;
  overlayStyle: CommunityOverlayStyle;
  hudAnchor: CommunityHudAnchor;
  photoDataUrl: string;
  visibility: 'community';
  kudosCount: number;
  commentsCount: number;
  createdAtIso: string;
  isLocalOnly?: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAtIso: string;
}

export type TeamAccentColor = 'cyan' | 'amber' | 'emerald' | 'rose' | 'violet' | 'orange';

export type TeamMemberRole = 'capitao' | 'integrante';

export interface TeamMember {
  memberId: string;
  teamId: string;
  name: string;
  avatar: string;
  role: TeamMemberRole;
  city: string;
  ageCategory: AgeCategoryId;
  gender: AthleteGender;
  totalPoints: number;
  totalKm: number;
  monthlyPoints: number;
  monthlyKm: number;
  avgPaceMinKm: number;
  addedBy: string;
  joinedAtIso: string;
}

export interface RunningTeam {
  id: string;
  name: string;
  tag: string;
  city: string;
  motto: string;
  emblem: string;
  accentColor: TeamAccentColor;
  creatorId: string;
  creatorName: string;
  memberCount: number;
  totalPoints: number;
  totalKm: number;
  monthlyPoints: number;
  monthlyKm: number;
  avgPaceMinKm: number;
  visibility: 'community';
  createdAtIso: string;
  updatedAtIso: string;
  members: TeamMember[];
  isStarterTeam?: boolean;
  isLocalOnly?: boolean;
}

export interface AddTeamMemberInput {
  memberId?: string;
  name: string;
  avatar?: string;
  city?: string;
  ageCategory: AgeCategoryId;
  gender: AthleteGender;
  totalPoints?: number;
  totalKm?: number;
  monthlyPoints?: number;
  monthlyKm?: number;
  avgPaceMinKm?: number;
}

export interface CreateTeamInput {
  name: string;
  tag: string;
  city: string;
  motto: string;
  emblem: string;
  accentColor: TeamAccentColor;
  initialMembers: AddTeamMemberInput[];
}

export type DuelStatus = 'waiting' | 'active' | 'finished';

export type DuelModeKind = 'online' | 'local';

export type DuelRunnerRole = 'host' | 'guest';

export interface DuelLapRecord {
  id: string;
  duelId: string;
  runnerId: string;
  runnerRole: DuelRunnerRole;
  runnerName: string;
  lapNumber: number;
  lapDistanceMeters: number;
  lapTimeSeconds: number;
  cumulativeSeconds: number;
  lapPaceMinKm: number;
  recordedAtIso: string;
}

export interface DuelSession {
  id: string;
  roomCode: string;
  missionId: TrainingLevelId;
  missionTitle: string;
  targetDistanceKm: number;
  lapDistanceMeters: number;
  status: DuelStatus;
  visibility: 'duel';
  hostId: string;
  hostName: string;
  hostAvatar: string;
  hostLat: number;
  hostLng: number;
  hostHeading: number;
  hostDistanceMeters: number;
  hostPaceMinKm: number;
  hostCurrentLap: number;
  hostElapsedSeconds: number;
  guestId: string;
  guestName: string;
  guestAvatar: string;
  guestLat: number;
  guestLng: number;
  guestHeading: number;
  guestDistanceMeters: number;
  guestPaceMinKm: number;
  guestCurrentLap: number;
  guestElapsedSeconds: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface DuelMapOpponent {
  name: string;
  avatar: string;
  position: LatLng;
  heading: number;
  trail: LatLng[];
  separationMeters: number; // direct GPS distance between both runners
  missionGapMeters: number; // positive = user ahead on mission, negative = rival ahead
  currentLap: number;
  paceMinKm: number;
  status: DuelStatus;
}

