import React, { useState, useEffect, useRef } from 'react';
import { Key, MapPin, Zap, Shield, Play, User, Flame, Compass, Award, Sun, Moon, Bot, Sparkles, Activity, Trophy, Radio, Dumbbell, Watch, Bluetooth, Smartphone, Volume2, VolumeX, BellRing, CloudRain, Share2, Crown, Users, BarChart3, Camera, LayoutGrid, X, Swords, Box, Map as MapIcon, Columns2 } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { TrainingLevel, PathPoint, XPOrb, CombatZone, WorkoutStats, UserProfile, LatLng, WorkoutOption, WeatherData, AthleteGender, RunVenueType, LevelUpEvent } from './types';
import { TRAINING_LEVELS } from './data/trainingPrograms';
import { getRunVenueConfig } from './data/runVenues';
import { KeySetupModal } from './components/KeySetupModal';
import { TacticalMap } from './components/TacticalMap';
import { ThreeDRunningArena } from './components/ThreeDRunningArena';
import { PreRunSetupPanel } from './components/PreRunSetupPanel';
import { WorkoutHUD } from './components/WorkoutHUD';
import { DebriefingView } from './components/DebriefingView';
import { LevelSelector } from './components/LevelSelector';
import { ProfileStats } from './components/ProfileStats';
import { CoachChat } from './components/CoachChat';
import { OnboardingModal } from './components/OnboardingModal';
import { ShoeTracker } from './components/ShoeTracker';
import { PersonalRecordsWall } from './components/PersonalRecordsWall';
import { SkillTree } from './components/SkillTree';
import { CrossTrainingView } from './components/CrossTrainingView';
import { CooperTestModal } from './components/CooperTestModal';
import { CommunitySafetyModal } from './components/CommunitySafetyModal';
import { DeviceHubModal } from './components/DeviceHubModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { WeatherModal } from './components/WeatherModal';
import { AudioCoachSettingsModal } from './components/AudioCoachSettingsModal';
import { LocalPushNotification, LocalPushStatusSummary } from './components/LocalPushNotification';
import { SocialShareModal } from './components/SocialShareModal';
import { RankingsView } from './components/RankingsView';
import { CommunityView } from './components/CommunityView';
import { DeviceModeBar } from './components/DeviceModeBar';
import { SmartwatchShell } from './components/SmartwatchShell';
import { PerformanceAnalyticsDashboard } from './components/PerformanceAnalyticsDashboard';
import { DuelModeView } from './components/DuelModeView';
import { useDeviceMode } from './utils/deviceMode';
import { useCommunityTeams } from './utils/teamsStore';
import { initAuth, signInWithGoogle } from './firebase';
import { fetchLiveWeather } from './utils/weather';
import {
  generateNearbyOrbs,
  generateCombatZones,
  simulateNextPosition,
  calculateGhostPosition,
  calculateDistanceMeters,
} from './utils/geo';
import { AudioCoachSnapshot, tacticalAudio } from './utils/audio';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const HAS_VALID_KEY = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Auto-Pause Geolocation Velocity Thresholds
const AUTO_PAUSE_THRESHOLD_SECONDS = 30;
const STATIONARY_VELOCITY_MS = 0.5; // < 0.5 m/s (~1.8 km/h) treated as stationary
const AUTO_RESUME_VELOCITY_MS = 1.1; // >= 1.1 m/s (~4.0 km/h) auto-resumes workout
const AUTO_PAUSE_STORAGE_KEY = 'run360x_auto_pause_enabled';

export default function App() {
  const [activeTab, setActiveTab] = useState<'levels' | 'workout' | 'duel' | 'coach' | 'profile' | 'shoes' | 'records' | 'skills' | 'cross' | 'rankings' | 'community' | 'analytics'>('levels');
  const {
    preference: devicePreference,
    setPreference: setDevicePreference,
    detectedDevice,
    activeDevice,
    isManualOverride,
    viewportWidth,
  } = useDeviceMode();
  const [showMobileMoreSheet, setShowMobileMoreSheet] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const [showCooperModal, setShowCooperModal] = useState<boolean>(false);
  const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);
  const [showDeviceModal, setShowDeviceModal] = useState<boolean>(false);
  const [showPWAModal, setShowPWAModal] = useState<boolean>(false);
  const [liveWeather, setLiveWeather] = useState<WeatherData | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);
  const [showWeatherModal, setShowWeatherModal] = useState<boolean>(false);
  const [showAudioCoachModal, setShowAudioCoachModal] = useState<boolean>(false);
  const [showPushModal, setShowPushModal] = useState<boolean>(false);
  const [showSocialShareModal, setShowSocialShareModal] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<LocalPushStatusSummary | null>(null);
  const [audioCoachSnap, setAudioCoachSnap] = useState<AudioCoachSnapshot>(() => tacticalAudio.getSnapshot());
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [communityWorkoutToShare, setCommunityWorkoutToShare] = useState<WorkoutStats | null>(null);
  const [autoOpenCommunityCamera, setAutoOpenCommunityCamera] = useState<boolean>(false);
  const [autoOpenCreateTeam, setAutoOpenCreateTeam] = useState<boolean>(false);
  const [inspectTeamId, setInspectTeamId] = useState<string | null>(null);

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Atleta Alpha',
    age: 28,
    heightCm: 175,
    weightKg: 70,
    gender: 'masculino',
    registered: false,
    level: 1,
    xp: 250,
    totalDistanceKm: 12.4,
    conqueredSectors: ['Setor Parque Verde'],
    badges: [
      { id: 'b1', title: 'Explorador Urbano', description: 'Completou a primeira missão e limpou a Névoa do Mapa.', icon: '🧭', unlockedAt: '2026-07-20' },
      { id: 'b2', title: 'Caçador de Orbes', description: 'Coletou mais de 10 Orbes de Energia em campo.', icon: '⚡', unlockedAt: '2026-07-21' },
      { id: 'b3', title: 'Mestre do Fantasma', description: 'Ultrapassou o Corredor Fantasma em um tiro de corrida.', icon: '👻', unlockedAt: '2026-07-22' },
      { id: 'b4', title: 'Dominador de Setor', description: 'Reivindicou a custódia tática de 3 setores da cidade.', icon: '👑' },
    ],
    history: [],
    weeklyGoals: {
      targetKm: 25,
      targetSessions: 4,
    },
  });

  // Shared live Teams & Team Ranking store synced across Community and Rankings
  const communityTeams = useCommunityTeams(firebaseUser, userProfile);

  // Subscribe to Firebase Auth state for interconnected Community sync
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setFirebaseUser(user),
      () => setFirebaseUser(null)
    );
    return () => unsubscribe();
  }, []);

  // Load saved profile on mount
  useEffect(() => {
    const saved = localStorage.getItem('runlevel_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserProfile((prev) => ({ ...prev, ...parsed }));
        if (!parsed.registered || !parsed.name) {
          setShowOnboardingModal(true);
        }
      } catch (e) {
        setShowOnboardingModal(true);
      }
    } else {
      setShowOnboardingModal(true);
    }
  }, []);

  const handleSaveProfileData = (data: { name: string; email?: string; age: number; heightCm: number; weightKg: number; gender: AthleteGender }) => {
    const updated: UserProfile = {
      ...userProfile,
      name: data.name,
      email: data.email,
      age: data.age,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      gender: data.gender,
      registered: true,
    };
    setUserProfile(updated);
    localStorage.setItem('runlevel_profile', JSON.stringify(updated));
    setShowOnboardingModal(false);
  };

  const handleUpdateGender = (gender: AthleteGender) => {
    const updated: UserProfile = { ...userProfile, gender };
    setUserProfile(updated);
    localStorage.setItem('runlevel_profile', JSON.stringify(updated));
  };

  const handleUpdateAge = (age: number) => {
    const clampedAge = Math.min(90, Math.max(14, Math.round(age)));
    const updated: UserProfile = { ...userProfile, age: clampedAge };
    setUserProfile(updated);
    localStorage.setItem('runlevel_profile', JSON.stringify(updated));
  };

  // Selected Level, Running Venue & Active Workout State
  const [selectedLevel, setSelectedLevel] = useState<TrainingLevel>(TRAINING_LEVELS[0]);
  const [selectedWorkoutOption, setSelectedWorkoutOption] = useState<WorkoutOption | undefined>(TRAINING_LEVELS[0].workoutOptions[0]);
  const [selectedVenue, setSelectedVenue] = useState<RunVenueType>('track_400m');
  const [treadmillIncline, setTreadmillIncline] = useState<number>(1.0);
  const [elevationGainMeters, setElevationGainMeters] = useState<number>(0);
  const [workoutVisualMode, setWorkoutVisualMode] = useState<'3d_arena' | '3d_map' | 'split'>('3d_arena');
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Position & Path Tracking
  const [userPosition, setUserPosition] = useState<LatLng>({ lat: -23.561684, lng: -46.655981 }); // Default São Paulo Paulista
  const [userHeading, setUserHeading] = useState<number>(45);
  const [path, setPath] = useState<PathPoint[]>([]);

  // Simulation controls
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [isSimStationary, setIsSimStationary] = useState<boolean>(false);

  // Geolocation Velocity Auto-Pause State
  const [autoPauseEnabled, setAutoPauseEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem(AUTO_PAUSE_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  });
  const [isAutoPaused, setIsAutoPaused] = useState<boolean>(false);
  const [stationarySeconds, setStationarySeconds] = useState<number>(0);
  const [liveGeoVelocityMs, setLiveGeoVelocityMs] = useState<number | null>(null);

  // Workout Metrics
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState<number>(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [maxSpeedKmh, setMaxSpeedKmh] = useState<number>(0);
  const [currentPaceMinKm, setCurrentPaceMinKm] = useState<number>(6.0);
  const [batteryPercent, setBatteryPercent] = useState<number>(100);
  const [xpGained, setXpGained] = useState<number>(0);
  const [currentIntervalIndex, setCurrentIntervalIndex] = useState<number>(0);

  // Map Gamification Elements
  const [orbs, setOrbs] = useState<XPOrb[]>([]);
  const [combatZones, setCombatZones] = useState<CombatZone[]>([]);
  const [ghostPosition, setGhostPosition] = useState<LatLng>({ lat: -23.561684, lng: -46.655981 });
  const [ghostDistanceMeters, setGhostDistanceMeters] = useState<number>(0);
  const [ghostOvertaken, setGhostOvertaken] = useState<boolean>(false);
  const [fogClearedGrid, setFogClearedGrid] = useState<Set<string>>(new Set());
  const [isRecordSparks, setIsRecordSparks] = useState<boolean>(false);

  // Post-Workout Debriefing & Level Up State
  const [completedStats, setCompletedStats] = useState<WorkoutStats | null>(null);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);

  // Audio Coach Session Tracking Refs (prevent duplicate voice triggers inside 1s loop)
  const lastMilestoneStepRef = useRef<number>(0);
  const halfwayAnnouncedRef = useRef<boolean>(false);
  const targetReachedAnnouncedRef = useRef<boolean>(false);
  const lastPacePromptSecRef = useRef<number>(0);
  const lastPaceDriftPromptSecRef = useRef<number>(0);
  const enteredZoneStartDistRef = useRef<Map<string, number>>(new Map());
  const lastTrackLapRef = useRef<number>(0);
  const lastElevDistRef = useRef<number>(0);

  // Geolocation Velocity & Auto-Pause Refs (keep watchPosition stable across ticks)
  const stationarySinceMsRef = useRef<number | null>(null);
  const latestVelocityMsRef = useRef<number | null>(null);
  const lastGeoFixRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const userPositionRef = useRef<LatLng>(userPosition);
  const totalDistanceMetersRef = useRef<number>(totalDistanceMeters);
  const elapsedSecondsRef = useRef<number>(elapsedSeconds);
  const maxSpeedKmhRef = useRef<number>(maxSpeedKmh);
  const selectedLevelRef = useRef<TrainingLevel>(selectedLevel);
  const combatZonesRef = useRef<CombatZone[]>(combatZones);
  const isPausedRef = useRef<boolean>(isPaused);
  const isAutoPausedRef = useRef<boolean>(isAutoPaused);
  const autoPauseEnabledRef = useRef<boolean>(autoPauseEnabled);

  useEffect(() => { userPositionRef.current = userPosition; }, [userPosition]);
  useEffect(() => { totalDistanceMetersRef.current = totalDistanceMeters; }, [totalDistanceMeters]);
  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);
  useEffect(() => { maxSpeedKmhRef.current = maxSpeedKmh; }, [maxSpeedKmh]);
  useEffect(() => { selectedLevelRef.current = selectedLevel; }, [selectedLevel]);
  useEffect(() => { combatZonesRef.current = combatZones; }, [combatZones]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isAutoPausedRef.current = isAutoPaused; }, [isAutoPaused]);
  useEffect(() => { autoPauseEnabledRef.current = autoPauseEnabled; }, [autoPauseEnabled]);

  useEffect(() => {
    const unsub = tacticalAudio.subscribe(setAudioCoachSnap);
    return () => {
      unsub();
      tacticalAudio.stopAllSpeech();
    };
  }, []);

  // Weather Sync Function
  const refreshWeather = async () => {
    setIsWeatherLoading(true);
    try {
      const data = await fetchLiveWeather(userPosition);
      setLiveWeather(data);
    } catch (err) {
      console.warn('Erro ao atualizar clima:', err);
    } finally {
      setIsWeatherLoading(false);
    }
  };

  useEffect(() => {
    refreshWeather();
  }, [userPosition.lat, userPosition.lng]);

  // Attempt HTML5 Geolocation on mount if available
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPosition(loc);
          setGhostPosition(loc);
        },
        () => {
          // Keep default if permission denied
        }
      );
    }
  }, []);

  // Select mission from LevelSelector -> opens Pre-Run GPS Sync & 5-Venue Launchpad
  const handlePrepareMission = (level: TrainingLevel, selectedOption?: WorkoutOption) => {
    setSelectedLevel(level);
    if (selectedOption) setSelectedWorkoutOption(selectedOption);
    setCompletedStats(null);
    setIsWorkoutActive(false);
    setIsPaused(false);
    setActiveTab('workout');
  };

  // Start Workout Session (after GPS synchronization & venue selection)
  const handleStartWorkout = (
    level: TrainingLevel,
    selectedOption?: WorkoutOption,
    launchConfig?: { venue?: RunVenueType; useSimulation?: boolean; inclinePercent?: number }
  ) => {
    const activeVenue = launchConfig?.venue || selectedVenue;
    const venueCfg = getRunVenueConfig(activeVenue);
    setSelectedLevel(level);
    if (selectedOption) setSelectedWorkoutOption(selectedOption);
    setSelectedVenue(activeVenue);
    if (typeof launchConfig?.useSimulation === 'boolean') {
      setIsSimulating(launchConfig.useSimulation);
    }
    if (typeof launchConfig?.inclinePercent === 'number') {
      setTreadmillIncline(launchConfig.inclinePercent);
    }
    setElevationGainMeters(0);
    lastTrackLapRef.current = 0;
    lastElevDistRef.current = 0;

    setIsWorkoutActive(true);
    setIsPaused(false);
    setElapsedSeconds(0);
    setTotalDistanceMeters(0);
    setCurrentSpeedKmh(0);
    setMaxSpeedKmh(0);
    setCurrentPaceMinKm(level.intervals[0]?.targetPaceMinKm || 5.5);
    setBatteryPercent(100);
    setXpGained(selectedOption?.xpBonus || 0);
    setCurrentIntervalIndex(0);
    setCompletedStats(null);
    setGhostOvertaken(false);

    // Initial Path Point
    const initialPoint: PathPoint = {
      ...userPosition,
      timestamp: Date.now(),
      speedKmh: 0,
      paceMinKm: level.intervals[0]?.targetPaceMinKm || 5.5,
      phase: 'warmup',
    };
    setPath([initialPoint]);

    // Spawn nearby Orbs & Combat Zones around user
    setOrbs(generateNearbyOrbs(userPosition, 8));
    setCombatZones(generateCombatZones(userPosition));

    // Initial Fog of War clearance
    const initialTile = `${Math.floor(userPosition.lat * 1000)}_${Math.floor(userPosition.lng * 1000)}`;
    setFogClearedGrid(new Set([initialTile]));

    // Reset Audio Coach & Auto-Pause session trackers
    lastMilestoneStepRef.current = 0;
    halfwayAnnouncedRef.current = false;
    targetReachedAnnouncedRef.current = false;
    lastPacePromptSecRef.current = 0;
    lastPaceDriftPromptSecRef.current = 0;
    enteredZoneStartDistRef.current = new Map();
    stationarySinceMsRef.current = null;
    latestVelocityMsRef.current = null;
    lastGeoFixRef.current = null;
    setIsAutoPaused(false);
    setStationarySeconds(0);
    setLiveGeoVelocityMs(null);
    setIsSimStationary(false);

    setActiveTab('workout');
    tacticalAudio.announceSessionEvent('start', {
      codename: `${level.codename} (${venueCfg.label})`,
      targetPaceMinKm: level.intervals[0]?.targetPaceMinKm || 5.5,
    });
  };

  // Track Lap Announcements (400m / 200m) & Live Elevation Gain (Trail / Treadmill)
  useEffect(() => {
    if (!isWorkoutActive || isPaused) return;
    const venueCfg = getRunVenueConfig(selectedVenue);

    if (venueCfg.lapLengthMeters) {
      const completedLaps = Math.floor(totalDistanceMeters / venueCfg.lapLengthMeters);
      if (completedLaps > lastTrackLapRef.current) {
        lastTrackLapRef.current = completedLaps;
        tacticalAudio.playOrbCollectSound();
        tacticalAudio.speakTacticalCoach(
          `Volta ${completedLaps} concluída na ${venueCfg.label}! Excelente consistência, mantenha o ritmo!`,
          { category: 'milestone', priority: 'high' }
        );
      }
    }

    const deltaDist = totalDistanceMeters - lastElevDistRef.current;
    if (deltaDist > 0.5) {
      lastElevDistRef.current = totalDistanceMeters;
      if (selectedVenue === 'treadmill' && treadmillIncline > 0) {
        setElevationGainMeters((prev) => prev + deltaDist * (treadmillIncline / 100));
      } else if (selectedVenue === 'trail') {
        const slopeWave = Math.max(0.015, (Math.sin(totalDistanceMeters * 0.025) + 0.85) * 0.045);
        setElevationGainMeters((prev) => prev + deltaDist * slopeWave);
      } else if (selectedVenue === 'road_city') {
        setElevationGainMeters((prev) => prev + deltaDist * 0.008);
      }
    }
  }, [totalDistanceMeters, isWorkoutActive, isPaused, selectedVenue, treadmillIncline]);

  // Pause / Resume with Web Speech feedback
  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    setIsAutoPaused(false);
    stationarySinceMsRef.current = null;
    setStationarySeconds(0);
    if (!nextPaused && isSimStationary) {
      setIsSimStationary(false);
    }
    tacticalAudio.announceSessionEvent(nextPaused ? 'pause' : 'resume');
  };

  // Toggle Auto-Pause setting (persisted)
  const handleToggleAutoPause = () => {
    const next = !autoPauseEnabled;
    setAutoPauseEnabled(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTO_PAUSE_STORAGE_KEY, String(next));
    }
    if (!next) {
      stationarySinceMsRef.current = null;
      setStationarySeconds(0);
      setIsAutoPaused(false);
    }
  };

  // Toggle simulated stationary state (0 m/s) to test 30s Auto-Pause on desktop
  const handleToggleSimStationary = () => {
    const nextStationary = !isSimStationary;
    setIsSimStationary(nextStationary);
    if (nextStationary) {
      latestVelocityMsRef.current = 0;
      setLiveGeoVelocityMs(0);
      setCurrentSpeedKmh(0);
      if (!isPaused && !stationarySinceMsRef.current) {
        stationarySinceMsRef.current = Date.now();
      }
    } else {
      stationarySinceMsRef.current = null;
      setStationarySeconds(0);
      if (isPaused && isAutoPaused) {
        setIsPaused(false);
        setIsAutoPaused(false);
        tacticalAudio.announceSessionEvent('auto_resume');
      }
    }
  };

  // Workout Simulation / GPS Loop
  useEffect(() => {
    if (!isWorkoutActive || isPaused) return;

    const interval = setInterval(() => {
      const nextElapsed = elapsedSeconds + 1;
      setElapsedSeconds(nextElapsed);

      // Interval progression based on elapsedSeconds
      let activeIntervalIdx = currentIntervalIndex;
      if (selectedLevel.intervals.length > 1) {
        let cumulativeSec = 0;
        for (let i = 0; i < selectedLevel.intervals.length; i++) {
          cumulativeSec += selectedLevel.intervals[i].durationSeconds;
          if (nextElapsed < cumulativeSec) {
            activeIntervalIdx = i;
            break;
          }
          if (i === selectedLevel.intervals.length - 1) {
            activeIntervalIdx = i;
          }
        }
        if (activeIntervalIdx !== currentIntervalIndex) {
          setCurrentIntervalIndex(activeIntervalIdx);
          const nextInt = selectedLevel.intervals[activeIntervalIdx];
          if (nextInt) {
            tacticalAudio.announceSessionEvent('interval_change', {
              phaseLabel: nextInt.label,
              targetPaceMinKm: nextInt.targetPaceMinKm,
            });
          }
        }
      }

      // Current Interval phase
      const currentInterval =
        selectedLevel.intervals[activeIntervalIdx] ||
        selectedLevel.intervals[0] || { targetPaceMinKm: 5.5, type: 'jog', label: 'Corrida' };

      // Calculate realistic running speed around phase target pace with natural stride variation
      const baseTargetSpeedKmh =
        currentInterval.targetPaceMinKm > 0 ? 60 / currentInterval.targetPaceMinKm : 11;
      let baseSpeedKmh = baseTargetSpeedKmh;
      if (currentInterval.type === 'sprint') baseSpeedKmh = Math.max(baseTargetSpeedKmh, 15.5);
      else if (currentInterval.type === 'walk') baseSpeedKmh = Math.min(baseTargetSpeedKmh, 6.2);
      else if (currentInterval.type === 'warmup') baseSpeedKmh = Math.min(baseTargetSpeedKmh, 9.2);

      // Subtle cadence/terrain micro-variation so live pace bars reflect natural running fluctuations
      const strideWave = Math.sin(nextElapsed * 0.42) * 0.75 + Math.cos(nextElapsed * 0.19) * 0.45;
      const speedKmh = Math.max(4.5, Math.min(22, Number((baseSpeedKmh + strideWave).toFixed(2))));

      if (isSimulating) {
        if (isSimStationary) {
          // Runner is simulated as stationary (0 m/s)
          latestVelocityMsRef.current = 0;
          setLiveGeoVelocityMs(0);
          setCurrentSpeedKmh(0);
          return;
        }

        // Simulate movement
        const simRes = simulateNextPosition(userPosition, userHeading, speedKmh * simSpeedMultiplier, 1);
        const newPos = simRes.position;
        setUserPosition(newPos);
        setUserHeading(simRes.nextHeading);

        // Update live velocity telemetry from simulation
        const simVelocityMs = speedKmh / 3.6;
        latestVelocityMsRef.current = simVelocityMs;
        setLiveGeoVelocityMs(simVelocityMs);
        stationarySinceMsRef.current = null;
        if (stationarySeconds > 0) setStationarySeconds(0);

        // Distance delta & updated total
        const deltaMeters = calculateDistanceMeters(userPosition, newPos);
        const nextTotalDistance = totalDistanceMeters + deltaMeters;
        setTotalDistanceMeters(nextTotalDistance);

        // Instant pace
        const currentPace = 60 / speedKmh; // min/km
        setCurrentSpeedKmh(speedKmh);
        setCurrentPaceMinKm(currentPace);

        if (speedKmh > maxSpeedKmh) {
          setMaxSpeedKmh(speedKmh);
          if (speedKmh > 14) {
            setIsRecordSparks(true);
            tacticalAudio.playSparkSound();
          }
        } else {
          setIsRecordSparks(false);
        }

        // New Path point
        const newPoint: PathPoint = {
          ...newPos,
          timestamp: Date.now(),
          speedKmh,
          paceMinKm: currentPace,
          phase: currentInterval.type === 'sprint' ? 'sprint' : 'jog',
        };
        setPath((prev) => [...prev, newPoint]);

        // --- WEB SPEECH API: DISTANCE MILESTONE PROMPTS ---
        const audioSettings = tacticalAudio.getSettings();
        const stepMeters = audioSettings.milestoneStepMeters || 500;
        const targetMeters = (selectedLevel.targetDistanceKm || 3) * 1000;
        const currentStep = Math.floor(nextTotalDistance / stepMeters);

        if (!targetReachedAnnouncedRef.current && nextTotalDistance >= targetMeters) {
          targetReachedAnnouncedRef.current = true;
          lastMilestoneStepRef.current = currentStep;
          tacticalAudio.announceDistanceMilestone({
            distanceMeters: targetMeters,
            targetDistanceMeters: targetMeters,
            currentPaceMinKm: currentPace,
            elapsedSeconds: nextElapsed,
            isTargetReached: true,
          });
        } else if (
          !halfwayAnnouncedRef.current &&
          targetMeters >= 1000 &&
          nextTotalDistance >= targetMeters / 2
        ) {
          halfwayAnnouncedRef.current = true;
          if (currentStep > lastMilestoneStepRef.current) {
            lastMilestoneStepRef.current = currentStep;
          }
          tacticalAudio.announceDistanceMilestone({
            distanceMeters: Math.round(targetMeters / 2),
            targetDistanceMeters: targetMeters,
            currentPaceMinKm: currentPace,
            elapsedSeconds: nextElapsed,
            isHalfway: true,
          });
        } else if (currentStep > lastMilestoneStepRef.current && currentStep > 0) {
          lastMilestoneStepRef.current = currentStep;
          tacticalAudio.announceDistanceMilestone({
            distanceMeters: currentStep * stepMeters,
            targetDistanceMeters: targetMeters,
            currentPaceMinKm: currentPace,
            elapsedSeconds: nextElapsed,
          });
        }

        // --- WEB SPEECH API: PACE COACHING PROMPTS ---
        const paceInterval = Math.max(15, audioSettings.paceIntervalSeconds || 45);
        if (nextElapsed - lastPacePromptSecRef.current >= paceInterval) {
          lastPacePromptSecRef.current = nextElapsed;
          tacticalAudio.announcePaceUpdate({
            currentPaceMinKm: currentPace,
            targetPaceMinKm: currentInterval.targetPaceMinKm,
            speedKmh,
            totalDistanceMeters: nextTotalDistance,
            elapsedSeconds: nextElapsed,
            reason: 'periodic',
          });
        } else {
          // Pace drift alert if deviating significantly from target pace
          const paceDiff = currentPace - currentInterval.targetPaceMinKm;
          if (
            Math.abs(paceDiff) >= 0.7 &&
            nextElapsed >= 15 &&
            nextElapsed - lastPaceDriftPromptSecRef.current >= 60 &&
            nextElapsed - lastPacePromptSecRef.current >= 15
          ) {
            lastPaceDriftPromptSecRef.current = nextElapsed;
            tacticalAudio.announcePaceUpdate({
              currentPaceMinKm: currentPace,
              targetPaceMinKm: currentInterval.targetPaceMinKm,
              speedKmh,
              totalDistanceMeters: nextTotalDistance,
              elapsedSeconds: nextElapsed,
              reason: paceDiff > 0 ? 'drift_slow' : 'drift_fast',
            });
          }
        }

        // Check Orb Collection (< 25 meters distance) — pure state update
        let collectedOrbXp = 0;
        let orbCollected = false;
        const updatedOrbs = orbs.map((orb) => {
          if (!orb.collected && calculateDistanceMeters(newPos, orb.position) < 25) {
            orbCollected = true;
            collectedOrbXp += orb.xpValue;
            return { ...orb, collected: true };
          }
          return orb;
        });
        if (orbCollected) {
          setOrbs(updatedOrbs);
          tacticalAudio.playOrbCollectSound();
          setXpGained((xp) => xp + collectedOrbXp);
        }

        // --- WEB SPEECH API: COMBAT ZONE ALERTS (Approaching -> Entered -> Cleared) ---
        let zonesChanged = false;
        let clearedZoneXp = 0;
        const updatedZones = combatZones.map((zone) => {
          if (zone.cleared) return zone;

          const distToStart = calculateDistanceMeters(newPos, zone.startPoint);
          const distToEnd = calculateDistanceMeters(newPos, zone.endPoint);

          // 1) Approaching alert (< 140m)
          if (!zone.triggered && !zone.approached && distToStart < 140 && distToStart >= 45) {
            zonesChanged = true;
            tacticalAudio.announceCombatZoneAlert({
              phase: 'approaching',
              zoneTitle: zone.title,
              distanceToStartMeters: distToStart,
            });
            return { ...zone, approached: true };
          }

          // 2) Entering Combat Zone (< 45m)
          if (!zone.active && !zone.triggered && distToStart < 45) {
            zonesChanged = true;
            enteredZoneStartDistRef.current.set(zone.id, nextTotalDistance);
            tacticalAudio.announceCombatZoneAlert({
              phase: 'entered',
              zoneTitle: zone.title,
              description: zone.description,
            });
            return { ...zone, active: true, triggered: true, approached: true };
          }

          // 3) Clearing Combat Zone (reached endPoint < 50m OR covered 250m inside zone)
          if (zone.active) {
            const startDist = enteredZoneStartDistRef.current.get(zone.id) ?? nextTotalDistance;
            if (distToEnd < 50 || nextTotalDistance - startDist >= 250) {
              zonesChanged = true;
              clearedZoneXp += 200;
              tacticalAudio.announceCombatZoneAlert({
                phase: 'cleared',
                zoneTitle: zone.title,
              });
              return { ...zone, active: false, cleared: true };
            }
          }

          return zone;
        });
        if (zonesChanged) {
          setCombatZones(updatedZones);
          if (clearedZoneXp > 0) {
            setXpGained((xp) => xp + clearedZoneXp);
          }
        }

        // Clear Fog of War Tile
        const tileKey = `${Math.floor(newPos.lat * 1000)}_${Math.floor(newPos.lng * 1000)}`;
        setFogClearedGrid((prevSet) => new Set(prevSet).add(tileKey));

        // Update Ghost Runner
        const ghostRes = calculateGhostPosition(
          nextElapsed,
          path,
          currentInterval.targetPaceMinKm,
          path[0] || newPos
        );
        setGhostPosition(ghostRes.position);
        setGhostDistanceMeters(ghostRes.distanceMetersBehindOrAhead);

        if (!ghostOvertaken && ghostRes.distanceMetersBehindOrAhead > 20) {
          setGhostOvertaken(true);
          tacticalAudio.playGhostOvertakeSound();
          tacticalAudio.speakTacticalCoach('Você ultrapassou o Corredor Fantasma! Excelente trabalho!', {
            category: 'system',
            priority: 'high',
          });
        }

        // Battery Charge Management
        if (selectedLevel.id === 'nivel-5' || selectedLevel.id === 'nivel-4') {
          if (currentPace > currentInterval.targetPaceMinKm + 0.5) {
            setBatteryPercent((b) => Math.max(0, b - 1));
          } else {
            setBatteryPercent((b) => Math.min(100, b + 0.2));
          }
        }
      } else {
        // Real GPS mode: still deliver periodic pace reports on schedule
        const audioSettings = tacticalAudio.getSettings();
        const paceInterval = Math.max(15, audioSettings.paceIntervalSeconds || 45);
        if (nextElapsed - lastPacePromptSecRef.current >= paceInterval) {
          lastPacePromptSecRef.current = nextElapsed;
          tacticalAudio.announcePaceUpdate({
            currentPaceMinKm,
            targetPaceMinKm: currentInterval.targetPaceMinKm,
            speedKmh: currentSpeedKmh || 10,
            totalDistanceMeters,
            elapsedSeconds: nextElapsed,
            reason: 'periodic',
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isWorkoutActive, isPaused, userPosition, userHeading, isSimulating, isSimStationary, simSpeedMultiplier, elapsedSeconds, totalDistanceMeters, currentPaceMinKm, currentSpeedKmh, selectedLevel, currentIntervalIndex, path, maxSpeedKmh, ghostOvertaken, orbs, combatZones, stationarySeconds]);

  // Real HTML5 Geolocation velocity & position watcher (stays active during Auto-Pause so movement triggers Auto-Resume)
  useEffect(() => {
    if (!isWorkoutActive || isSimulating || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const nowTs = pos.timestamp || Date.now();
        const prevPos = userPositionRef.current;
        const deltaMeters = calculateDistanceMeters(prevPos, newPos);

        // Primary velocity from Geolocation API coords.speed (m/s)
        let velocityMs: number | null =
          typeof pos.coords.speed === 'number' && !Number.isNaN(pos.coords.speed) && pos.coords.speed >= 0
            ? pos.coords.speed
            : null;

        // Fallback velocity derived from consecutive GPS fixes when browser returns coords.speed === null
        if (velocityMs === null) {
          if (lastGeoFixRef.current) {
            const dtSec = (nowTs - lastGeoFixRef.current.timestamp) / 1000;
            if (dtSec >= 0.5) {
              const fixDelta = calculateDistanceMeters(lastGeoFixRef.current, newPos);
              const jitterFloor = Math.min(5, Math.max(2, (pos.coords.accuracy || 10) * 0.25));
              velocityMs = fixDelta < jitterFloor ? 0 : fixDelta / dtSec;
            } else {
              velocityMs = latestVelocityMsRef.current ?? 0;
            }
          } else {
            velocityMs = 0;
          }
        }

        lastGeoFixRef.current = { lat: newPos.lat, lng: newPos.lng, timestamp: nowTs };
        latestVelocityMsRef.current = velocityMs;
        setLiveGeoVelocityMs(velocityMs);

        // Auto-Pause / Auto-Resume velocity evaluation
        if (velocityMs < STATIONARY_VELOCITY_MS) {
          setCurrentSpeedKmh(0);
          if (!isPausedRef.current && autoPauseEnabledRef.current && stationarySinceMsRef.current === null) {
            stationarySinceMsRef.current = Date.now();
          }
          return;
        }

        // Runner is moving again (>= STATIONARY_VELOCITY_MS)
        stationarySinceMsRef.current = null;
        setStationarySeconds(0);

        // Auto-Resume if previously auto-paused and moving above resume hysteresis threshold
        if (isPausedRef.current) {
          if (isAutoPausedRef.current && autoPauseEnabledRef.current && velocityMs >= AUTO_RESUME_VELOCITY_MS) {
            setIsPaused(false);
            setIsAutoPaused(false);
            tacticalAudio.announceSessionEvent('auto_resume');
          }
          return;
        }

        if (deltaMeters < 2) return; // Ignore minor GPS jitter

        const nextTotalDistance = totalDistanceMetersRef.current + deltaMeters;
        const speedKmh = Math.min(35, Math.max(1.8, velocityMs * 3.6));
        const paceMinKm = 60 / speedKmh;

        setUserPosition(newPos);
        setTotalDistanceMeters(nextTotalDistance);
        setCurrentSpeedKmh(speedKmh);
        setCurrentPaceMinKm(paceMinKm);
        if (speedKmh > maxSpeedKmhRef.current) setMaxSpeedKmh(speedKmh);

        // Milestone announcements for Real GPS
        const audioSettings = tacticalAudio.getSettings();
        const stepMeters = audioSettings.milestoneStepMeters || 500;
        const targetMeters = (selectedLevelRef.current.targetDistanceKm || 3) * 1000;
        const currentStep = Math.floor(nextTotalDistance / stepMeters);

        if (!targetReachedAnnouncedRef.current && nextTotalDistance >= targetMeters) {
          targetReachedAnnouncedRef.current = true;
          lastMilestoneStepRef.current = currentStep;
          tacticalAudio.announceDistanceMilestone({
            distanceMeters: targetMeters,
            targetDistanceMeters: targetMeters,
            currentPaceMinKm: paceMinKm,
            elapsedSeconds: elapsedSecondsRef.current,
            isTargetReached: true,
          });
        } else if (
          !halfwayAnnouncedRef.current &&
          targetMeters >= 1000 &&
          nextTotalDistance >= targetMeters / 2
        ) {
          halfwayAnnouncedRef.current = true;
          if (currentStep > lastMilestoneStepRef.current) lastMilestoneStepRef.current = currentStep;
          tacticalAudio.announceDistanceMilestone({
            distanceMeters: Math.round(targetMeters / 2),
            targetDistanceMeters: targetMeters,
            currentPaceMinKm: paceMinKm,
            elapsedSeconds: elapsedSecondsRef.current,
            isHalfway: true,
          });
        } else if (currentStep > lastMilestoneStepRef.current && currentStep > 0) {
          lastMilestoneStepRef.current = currentStep;
          tacticalAudio.announceDistanceMilestone({
            distanceMeters: currentStep * stepMeters,
            targetDistanceMeters: targetMeters,
            currentPaceMinKm: paceMinKm,
            elapsedSeconds: elapsedSecondsRef.current,
          });
        }

        // Combat Zone proximity announcements for Real GPS
        let zonesChanged = false;
        const updatedZones = combatZonesRef.current.map((zone) => {
          if (zone.cleared) return zone;
          const distToStart = calculateDistanceMeters(newPos, zone.startPoint);
          const distToEnd = calculateDistanceMeters(newPos, zone.endPoint);

          if (!zone.triggered && !zone.approached && distToStart < 140 && distToStart >= 45) {
            zonesChanged = true;
            tacticalAudio.announceCombatZoneAlert({
              phase: 'approaching',
              zoneTitle: zone.title,
              distanceToStartMeters: distToStart,
            });
            return { ...zone, approached: true };
          }
          if (!zone.active && !zone.triggered && distToStart < 45) {
            zonesChanged = true;
            enteredZoneStartDistRef.current.set(zone.id, nextTotalDistance);
            tacticalAudio.announceCombatZoneAlert({
              phase: 'entered',
              zoneTitle: zone.title,
              description: zone.description,
            });
            return { ...zone, active: true, triggered: true, approached: true };
          }
          if (zone.active) {
            const startDist = enteredZoneStartDistRef.current.get(zone.id) ?? nextTotalDistance;
            if (distToEnd < 50 || nextTotalDistance - startDist >= 250) {
              zonesChanged = true;
              tacticalAudio.announceCombatZoneAlert({
                phase: 'cleared',
                zoneTitle: zone.title,
              });
              return { ...zone, active: false, cleared: true };
            }
          }
          return zone;
        });
        if (zonesChanged) setCombatZones(updatedZones);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isWorkoutActive, isSimulating]);

  // 1-second Stationary Velocity Watchdog -> Auto-Pauses when stationary > 30 seconds & announces via Audio Coach
  useEffect(() => {
    if (!isWorkoutActive || !autoPauseEnabled || isPaused) return;

    const watchdog = setInterval(() => {
      const velocityMs = latestVelocityMsRef.current;
      const isCurrentlyStationary = isSimulating
        ? isSimStationary
        : velocityMs === null || velocityMs < STATIONARY_VELOCITY_MS;

      if (!isCurrentlyStationary) {
        stationarySinceMsRef.current = null;
        setStationarySeconds(0);
        return;
      }

      if (stationarySinceMsRef.current === null) {
        stationarySinceMsRef.current = Date.now();
        setStationarySeconds(1);
        return;
      }

      const elapsedStationaryMs = Date.now() - stationarySinceMsRef.current;
      const elapsedStationarySec = Math.floor(elapsedStationaryMs / 1000);
      setStationarySeconds(elapsedStationarySec);

      // Strictly more than 30 seconds stationary triggers Auto-Pause
      if (elapsedStationaryMs > AUTO_PAUSE_THRESHOLD_SECONDS * 1000) {
        setIsPaused(true);
        setIsAutoPaused(true);
        setCurrentSpeedKmh(0);
        tacticalAudio.announceSessionEvent('auto_pause', {
          stationarySeconds: AUTO_PAUSE_THRESHOLD_SECONDS,
        });
      }
    }, 1000);

    return () => clearInterval(watchdog);
  }, [isWorkoutActive, autoPauseEnabled, isPaused, isSimulating, isSimStationary]);

  // Steer simulator manually
  const handleSteerSim = (dir: 'left' | 'right' | 'straight') => {
    if (dir === 'left') setUserHeading((prev) => (prev - 30 + 360) % 360);
    if (dir === 'right') setUserHeading((prev) => (prev + 30) % 360);
  };

  // Nitro burst speed
  const handleTriggerBurst = () => {
    setCurrentSpeedKmh(18);
    setCurrentPaceMinKm(60 / 18);
    setIsRecordSparks(true);
    tacticalAudio.playSparkSound();
    tacticalAudio.playOrbCollectSound();
    tacticalAudio.speakTacticalCoach('Explosão Nitro ativada! Velocidade máxima de 18 quilômetros por hora!', {
      category: 'pace',
      priority: 'high',
      interrupt: true,
    });
  };

  // Finish Workout Session and generate debriefing
  const handleFinishWorkout = () => {
    tacticalAudio.announceSessionEvent('finish');
    setIsWorkoutActive(false);

    const collectedCount = orbs.filter((o) => o.collected).length;
    const finalXp = xpGained + 300 + collectedCount * 50;
    const distMeters = Math.max(totalDistanceMeters, 1500);
    const durSeconds = Math.max(elapsedSeconds, 180);
    const weight = userProfile.weightKg || 70;
    const estimatedKcal = Math.round((distMeters / 1000) * 1.03 * weight);

    const venueCfg = getRunVenueConfig(selectedVenue);
    const finishedAtMs = Date.now();
    const stats: WorkoutStats = {
      id: `workout-${finishedAtMs}`,
      createdAtMs: finishedAtMs,
      date: new Date(finishedAtMs).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      timeOfDay: new Date(finishedAtMs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      levelId: selectedLevel.id,
      workoutMode: selectedWorkoutOption?.id || 'longao',
      workoutTitle: selectedWorkoutOption ? `${selectedLevel.title.split(' • ')[0]} - ${selectedWorkoutOption.title}` : selectedLevel.title,
      venueType: selectedVenue,
      venueLabel: venueCfg.label,
      lapsCompleted: venueCfg.lapLengthMeters ? Math.floor(distMeters / venueCfg.lapLengthMeters) : undefined,
      inclinePercent: selectedVenue === 'treadmill' ? treadmillIncline : undefined,
      elevationGainMeters: Math.round(elevationGainMeters),
      totalDistanceMeters: distMeters,
      durationSeconds: durSeconds,
      avgPaceMinKm: currentPaceMinKm,
      maxSpeedKmh: Math.max(maxSpeedKmh, 14.2),
      avgHeartRateBpm: 154,
      caloriesKcal: estimatedKcal,
      stepsCount: Math.round(distMeters * 1.35),
      xpGained: finalXp,
      orbsCollectedCount: collectedCount,
      ghostDefeated: ghostDistanceMeters >= 0,
      batteryRemainingPercent: Math.round(batteryPercent),
      sectorConquered: selectedLevel.conquestSectorName,
      strengthScore: Math.min(100, Math.round(75 + (distMeters / 1000) * 4)),
      speedScore: Math.min(100, Math.round(60 + maxSpeedKmh * 2)),
      agilityScore: Math.min(100, Math.round(70 + collectedCount * 6)),
      splits: [
        { kmNumber: 1, timeSeconds: 340, paceMinKm: 5.67 },
        { kmNumber: 2, timeSeconds: 320, paceMinKm: 5.33 },
      ],
      path,
    };

    const previousXp = userProfile.xp || 0;
    const previousLevel = Math.max(userProfile.level || 1, Math.floor(previousXp / 1000) + 1);
    const newXp = previousXp + finalXp;
    const newLevel = Math.floor(newXp / 1000) + 1;

    setLevelUpEvent(
      newLevel > previousLevel
        ? {
            previousLevel,
            newLevel,
            previousXp,
            newXp,
            xpGained: finalXp,
          }
        : null
    );
    setCompletedStats(stats);

    // Update Profile (including real Level Up progression & persistence)
    setUserProfile((prev) => {
      const updatedProfile: UserProfile = {
        ...prev,
        xp: newXp,
        level: newLevel,
        totalDistanceKm: prev.totalDistanceKm + stats.totalDistanceMeters / 1000,
        conqueredSectors: prev.conqueredSectors.includes(stats.sectorConquered!)
          ? prev.conqueredSectors
          : [...prev.conqueredSectors, stats.sectorConquered!],
        history: [stats, ...prev.history],
      };
      try {
        localStorage.setItem('runlevel_profile', JSON.stringify(updatedProfile));
      } catch {
        // ignore storage quota errors
      }
      return updatedProfile;
    });
  };

  const isLight = theme === 'light';
  const isSmartwatch = activeDevice === 'smartwatch';
  const isSmartphone = activeDevice === 'smartphone';
  const isTablet = activeDevice === 'tablet';
  const isDesktop = activeDevice === 'desktop';
  const isNativeTinyWatch = viewportWidth <= 320 && devicePreference === 'auto';
  const isSimulatedPhoneFrame = isSmartphone && isManualOverride && viewportWidth > 767;

  const openCommunityWithCamera = () => {
    setCompletedStats(null);
    setActiveTab('community');
    setAutoOpenCommunityCamera(true);
    setShowMobileMoreSheet(false);
  };

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950'
    }`}>
      {/* Adaptive Device Aesthetic Switcher (Hidden only on native tiny <=320px watches) */}
      {!isNativeTinyWatch && (
        <DeviceModeBar
          preference={devicePreference}
          activeDevice={activeDevice}
          detectedDevice={detectedDevice}
          onChangePreference={(pref) => {
            setDevicePreference(pref);
            setShowMobileMoreSheet(false);
          }}
          onOpenAnalytics={() => {
            setCompletedStats(null);
            setActiveTab('analytics');
          }}
          isAnalyticsActive={activeTab === 'analytics'}
          theme={theme}
        />
      )}

      {/* Key Setup / Integration Modal */}
      {showKeyModal && (
        <KeySetupModal
          apiKey={API_KEY}
          hasValidKey={HAS_VALID_KEY}
          onClose={() => setShowKeyModal(false)}
          onUseSimulationMode={() => {
            setIsSimulating(true);
            setShowKeyModal(false);
          }}
        />
      )}

      {/* SMARTWATCH DEDICATED SHELL */}
      {isSmartwatch ? (
        <SmartwatchShell
          userProfile={userProfile}
          selectedLevel={selectedLevel}
          isWorkoutActive={isWorkoutActive}
          isPaused={isPaused}
          elapsedSeconds={elapsedSeconds}
          totalDistanceMeters={totalDistanceMeters}
          currentPaceMinKm={currentPaceMinKm}
          currentSpeedKmh={currentSpeedKmh}
          ghostDistanceMeters={ghostDistanceMeters}
          userHeading={userHeading}
          xpGained={xpGained}
          batteryPercent={batteryPercent}
          weather={liveWeather}
          onStartWorkout={() => handleStartWorkout(selectedLevel, selectedWorkoutOption)}
          onTogglePause={handleTogglePause}
          onFinishWorkout={handleFinishWorkout}
          onExitWatchMode={(target) => setDevicePreference(target)}
          isNativeTinyScreen={isNativeTinyWatch}
          theme={theme}
        />
      ) : (
        <div
          className={
            isSimulatedPhoneFrame
              ? `max-w-[430px] mx-auto my-4 rounded-[36px] border-2 overflow-hidden shadow-2xl relative ${
                  isLight ? 'border-slate-300 bg-slate-50' : 'border-slate-700 bg-slate-950'
                }`
              : 'w-full'
          }
        >
          {/* SMARTPHONE COMPACT TOP APP BAR */}
          {isSmartphone ? (
            <header
              className={`sticky top-0 z-40 h-14 px-3 backdrop-blur-md border-b flex items-center justify-between gap-2 ${
                isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Compass className={`w-5 h-5 shrink-0 ${isLight ? 'text-orange-600' : 'text-cyan-400'}`} />
                <span className="font-black tracking-wider text-sm truncate">RUN360X</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {liveWeather && (
                  <button
                    type="button"
                    onClick={() => setShowWeatherModal(true)}
                    className={`min-h-[38px] px-2.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1 cursor-pointer ${
                      isLight ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-slate-950 border-slate-700 text-cyan-300'
                    }`}
                  >
                    <span>{liveWeather.condition.icon}</span>
                    <span>{liveWeather.temperatureC}°C</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={openCommunityWithCamera}
                  aria-label="Compartilhar conquista com câmera"
                  className={`min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center cursor-pointer ${
                    isLight ? 'bg-orange-500 text-white' : 'bg-cyan-400 text-slate-950'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label="Alternar tema"
                  className={`min-h-[38px] min-w-[38px] rounded-xl border flex items-center justify-center cursor-pointer ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-800 border-slate-700 text-amber-400'
                  }`}
                >
                  {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
              </div>
            </header>
          ) : (
            /* TABLET & COMPUTADOR EXPANDED HEADER */
            <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${
              isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-cyan-500/20'
            }`}>
              <div className="max-w-[1440px] mx-auto px-4 min-h-16 py-2 flex flex-wrap items-center justify-between gap-3">
                {/* Brand Logo */}
                <div className="flex items-center gap-3">
                  <div className={`relative p-2 rounded-xl border ${
                    isLight ? 'bg-orange-50 border-orange-200' : 'bg-slate-950 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                  }`}>
                    <Compass className={`w-5 h-5 ${isLight ? 'text-orange-600' : 'text-cyan-400'}`} />
                  </div>
                  <div>
                    <h1 className={`font-black tracking-wider uppercase text-sm leading-tight ${isLight ? 'text-slate-900' : 'text-cyan-400'}`}>
                      RUN360X
                    </h1>
                    <p className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isTablet ? 'Painel Tablet · Métricas & Radar' : 'Painel Expandido · Métricas & Gráficos'}
                    </p>
                  </div>
                </div>

                {/* Tablet Compact Horizontal Navigation (Desktop uses Persistent Left Sidebar) */}
                {isTablet && (
                  <nav className={`flex flex-wrap items-center gap-1 p-1 rounded-xl border ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}>
                    {[
                      { id: 'levels' as const, label: 'Missões', icon: <Flame className="w-3.5 h-3.5" /> },
                      { id: 'workout' as const, label: 'Mapa & HUD', icon: <Compass className="w-3.5 h-3.5" /> },
                      { id: 'duel' as const, label: 'Duelo 1v1', icon: <Swords className="w-3.5 h-3.5" /> },
                      { id: 'analytics' as const, label: 'Gráficos', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                      { id: 'community' as const, label: 'Comunidade', icon: <Users className="w-3.5 h-3.5" /> },
                      { id: 'rankings' as const, label: 'Rankings', icon: <Crown className="w-3.5 h-3.5" /> },
                      { id: 'records' as const, label: 'Recordes', icon: <Trophy className="w-3.5 h-3.5" /> },
                      { id: 'coach' as const, label: 'Coach AI', icon: <Bot className="w-3.5 h-3.5" /> },
                      { id: 'profile' as const, label: 'Atleta', icon: <User className="w-3.5 h-3.5" /> },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                          activeTab === item.id
                            ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-400 text-slate-950'
                            : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </nav>
                )}

                {/* Right Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowDeviceModal(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    title="Central de Conectividade de Dispositivos"
                  >
                    <Bluetooth className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden lg:inline">DISPOSITIVOS</span>
                  </button>

                  <button
                    onClick={() => setShowCooperModal(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                    title="Teste de Nivelamento Cooper (12 Min)"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">COOPER</span>
                  </button>

                  <button
                    onClick={() => setShowSafetyModal(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                    title="SOS & Live Tracking"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">SOS</span>
                  </button>

                  {liveWeather && (
                    <button
                      onClick={() => setShowWeatherModal(true)}
                      className={`px-2.5 py-1.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                        isLight
                          ? 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-800'
                          : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
                      }`}
                    >
                      <span>{liveWeather.condition.icon}</span>
                      <span>{liveWeather.temperatureC}°C</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowPushModal(true)}
                    className={`relative px-2.5 py-1.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                      pushStatus?.isHeavyRain || pushStatus?.hasActiveBanner
                        ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/60 text-rose-300'
                        : isLight
                          ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800'
                          : 'bg-slate-900 hover:bg-slate-800 border-cyan-500/35 text-cyan-300'
                    }`}
                    title="Alerta Local de Chuva T-15m"
                  >
                    {pushStatus?.isHeavyRain ? (
                      <CloudRain className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <BellRing className={`w-3.5 h-3.5 ${pushStatus?.enabled ? 'text-cyan-400' : 'text-slate-400'}`} />
                    )}
                    <span className="hidden xl:inline text-[10px]">
                      {pushStatus?.isHeavyRain ? 'CHUVA T-15M' : 'PUSH T-15M'}
                    </span>
                  </button>

                  <button
                    onClick={() => setShowOnboardingModal(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      userProfile.registered
                        ? isLight
                          ? 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700'
                          : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
                        : 'bg-rose-500 hover:bg-rose-600 text-white border-rose-400'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{userProfile.name ? userProfile.name.split(' ')[0] : 'Cadastrar'}</span>
                  </button>

                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={`p-2 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      isLight
                        ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-800'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
                    }`}
                    title="Alternar Tema"
                  >
                    {isLight ? <Moon className="w-4 h-4 text-slate-800" /> : <Sun className="w-4 h-4 text-amber-400" />}
                  </button>

                  <button
                    onClick={() => setShowKeyModal(true)}
                    className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono border transition cursor-pointer whitespace-nowrap ${
                      HAS_VALID_KEY
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                        : isLight ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{HAS_VALID_KEY ? 'MAPS' : 'CHAVE'}</span>
                  </button>
                </div>
              </div>
            </header>
          )}

          {/* MAIN WORKSPACE BODY (Adaptive: Desktop Sidebar + Expanded Canvas | Tablet 2-Col | Smartphone Single-Col) */}
          <div
            className={
              isDesktop
                ? 'max-w-[1440px] mx-auto px-4 py-6 flex items-start gap-6'
                : isTablet
                ? 'max-w-6xl mx-auto px-4 py-5'
                : 'px-3 py-4 pb-24'
            }
          >
            {/* Persistent Left Sidebar Navigation on Computador (Desktop Expanded Mode) */}
            {isDesktop && (
              <aside
                className={`w-60 shrink-0 sticky top-20 rounded-2xl border p-3 space-y-5 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">
                    Treino e Desempenho
                  </div>
                  {[
                    { id: 'analytics' as const, label: 'Métricas & Gráficos', icon: <BarChart3 className="w-4 h-4" /> },
                    { id: 'levels' as const, label: 'Missões Diárias', icon: <Flame className="w-4 h-4" /> },
                    { id: 'workout' as const, label: 'Mapa & Radar HUD', icon: <Compass className="w-4 h-4" /> },
                    { id: 'duel' as const, label: 'Modo Duelo 1v1', icon: <Swords className="w-4 h-4" /> },
                    { id: 'records' as const, label: 'Recordes (RP)', icon: <Trophy className="w-4 h-4" /> },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCompletedStats(null);
                        setActiveTab(item.id);
                      }}
                      className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer text-left ${
                        activeTab === item.id
                          ? isLight
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-cyan-400 text-slate-950 font-bold'
                          : isLight
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-1 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">
                    Clube e Competição
                  </div>
                  {[
                    { id: 'community' as const, label: 'Comunidade Interna', icon: <Users className="w-4 h-4" /> },
                    { id: 'rankings' as const, label: 'Rankings Oficiais', icon: <Crown className="w-4 h-4" /> },
                    { id: 'skills' as const, label: 'Habilidades', icon: <Zap className="w-4 h-4" /> },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCompletedStats(null);
                        setActiveTab(item.id);
                      }}
                      className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer text-left ${
                        activeTab === item.id
                          ? isLight
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-cyan-400 text-slate-950 font-bold'
                          : isLight
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-1 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">
                    Preparação & Perfil
                  </div>
                  {[
                    { id: 'cross' as const, label: 'Fortalecimento', icon: <Dumbbell className="w-4 h-4" /> },
                    { id: 'shoes' as const, label: 'Tênis & Rodagem', icon: <Shield className="w-4 h-4" /> },
                    { id: 'coach' as const, label: 'Coach AI', icon: <Bot className="w-4 h-4" /> },
                    { id: 'profile' as const, label: 'Perfil do Atleta', icon: <User className="w-4 h-4" /> },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCompletedStats(null);
                        setActiveTab(item.id);
                      }}
                      className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer text-left ${
                        activeTab === item.id
                          ? isLight
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-cyan-400 text-slate-950 font-bold'
                          : isLight
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={openCommunityWithCamera}
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      isLight
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-gradient-to-r from-cyan-400 to-emerald-400 hover:opacity-95 text-slate-950'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Postar com Câmera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPWAModal(true)}
                    className={`w-full min-h-[38px] px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-teal-300'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Instalar App PWA</span>
                  </button>
                </div>
              </aside>
            )}

            <main className="flex-1 min-w-0">
        {/* Render Debriefing when completed */}
        {completedStats ? (
          <DebriefingView
            stats={completedStats}
            level={selectedLevel}
            levelUpEvent={levelUpEvent}
            athleteName={userProfile.name}
            onClose={() => {
              setCompletedStats(null);
              setLevelUpEvent(null);
            }}
            onShareToCommunityCamera={(workoutStats) => {
              setCommunityWorkoutToShare(workoutStats);
              setCompletedStats(null);
              setLevelUpEvent(null);
              setActiveTab('community');
              setAutoOpenCommunityCamera(true);
            }}
            theme={theme}
          />
        ) : (
          <>
            {activeTab === 'levels' && (
              <LevelSelector
                onSelectLevel={handlePrepareMission}
                userLevel={userProfile.level}
                userXp={userProfile.xp}
                conqueredSectorsCount={userProfile.conqueredSectors.length}
                theme={theme}
              />
            )}

            {activeTab === 'workout' && (
              <div className={isSmartphone ? 'grid grid-cols-1 gap-4 items-start' : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'}>
                {/* Left Column: Interactive 3D Three.js Arena + 3D Local Tactical Map (7 cols) */}
                <div className={isSmartphone ? 'space-y-2.5 w-full' : 'lg:col-span-7 space-y-2.5 w-full sticky top-20'}>
                  {/* Visual Mode Switcher Bar */}
                  <div
                    className={`p-1.5 rounded-2xl border flex items-center justify-between gap-2 ${
                      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1 flex-1">
                      <button
                        type="button"
                        onClick={() => setWorkoutVisualMode('3d_arena')}
                        className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          workoutVisualMode === '3d_arena'
                            ? isLight
                              ? 'bg-orange-500 text-white'
                              : 'bg-cyan-500 text-slate-950'
                            : isLight
                              ? 'text-slate-600 hover:bg-slate-100'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Box className="w-3.5 h-3.5" />
                        <span>Cena 3D · {getRunVenueConfig(selectedVenue).shortLabel}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkoutVisualMode('3d_map')}
                        className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          workoutVisualMode === '3d_map'
                            ? isLight
                              ? 'bg-orange-500 text-white'
                              : 'bg-cyan-500 text-slate-950'
                            : isLight
                              ? 'text-slate-600 hover:bg-slate-100'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                        <span>Mapa 3D Local</span>
                      </button>

                      {!isSmartphone && (
                        <button
                          type="button"
                          onClick={() => setWorkoutVisualMode('split')}
                          className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer hidden sm:flex items-center gap-1.5 ${
                            workoutVisualMode === 'split'
                              ? isLight
                                ? 'bg-orange-500 text-white'
                                : 'bg-cyan-500 text-slate-950'
                              : isLight
                                ? 'text-slate-600 hover:bg-slate-100'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Columns2 className="w-3.5 h-3.5" />
                          <span>3D + Mapa</span>
                        </button>
                      )}
                    </div>

                    <span className="hidden md:inline text-[11px] font-mono text-slate-500 dark:text-slate-400 pr-2">
                      {getRunVenueConfig(selectedVenue).surfaceLabel}
                    </span>
                  </div>

                  {/* Viewport Canvas(es) */}
                  {workoutVisualMode === 'split' && !isSmartphone ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 h-[540px]">
                      <div className="h-full min-h-[260px]">
                        <ThreeDRunningArena
                          venue={selectedVenue}
                          isWorkoutActive={isWorkoutActive}
                          isPaused={isPaused}
                          speedKmh={currentSpeedKmh}
                          distanceMeters={totalDistanceMeters}
                          ghostDistanceMeters={ghostDistanceMeters}
                          inclinePercent={treadmillIncline}
                          elevationGainMeters={elevationGainMeters}
                          onChangeIncline={setTreadmillIncline}
                          theme={theme}
                        />
                      </div>
                      <div className="h-full min-h-[260px]">
                        <TacticalMap
                          apiKey={API_KEY}
                          hasValidKey={HAS_VALID_KEY}
                          userPosition={userPosition}
                          userHeading={userHeading}
                          path={path}
                          orbs={orbs}
                          combatZones={combatZones}
                          ghostPosition={ghostPosition}
                          ghostDistanceMeters={ghostDistanceMeters}
                          currentPhase={
                            selectedLevel.intervals[currentIntervalIndex]?.type === 'sprint' ? 'sprint' : 'jog'
                          }
                          isRecordSparks={isRecordSparks}
                          fogClearedGrid={fogClearedGrid}
                          theme={theme}
                        />
                      </div>
                    </div>
                  ) : workoutVisualMode === '3d_arena' ? (
                    <div className={isSmartphone ? 'h-[360px] w-full' : 'h-[480px] sm:h-[540px] w-full'}>
                      <ThreeDRunningArena
                        venue={selectedVenue}
                        isWorkoutActive={isWorkoutActive}
                        isPaused={isPaused}
                        speedKmh={currentSpeedKmh}
                        distanceMeters={totalDistanceMeters}
                        ghostDistanceMeters={ghostDistanceMeters}
                        inclinePercent={treadmillIncline}
                        elevationGainMeters={elevationGainMeters}
                        onChangeIncline={setTreadmillIncline}
                        theme={theme}
                      />
                    </div>
                  ) : (
                    <div className={isSmartphone ? 'h-[360px] w-full' : 'h-[480px] sm:h-[540px] w-full'}>
                      <TacticalMap
                        apiKey={API_KEY}
                        hasValidKey={HAS_VALID_KEY}
                        userPosition={userPosition}
                        userHeading={userHeading}
                        path={path}
                        orbs={orbs}
                        combatZones={combatZones}
                        ghostPosition={ghostPosition}
                        ghostDistanceMeters={ghostDistanceMeters}
                        currentPhase={
                          selectedLevel.intervals[currentIntervalIndex]?.type === 'sprint' ? 'sprint' : 'jog'
                        }
                        isRecordSparks={isRecordSparks}
                        fogClearedGrid={fogClearedGrid}
                        theme={theme}
                      />
                    </div>
                  )}
                </div>

                {/* Right Column: Pre-Run GPS Sync + 5-Venue Launchpad OR Live Workout HUD (5 cols) */}
                <div className={isSmartphone ? 'space-y-4' : 'lg:col-span-5 space-y-4'}>
                  {!isWorkoutActive ? (
                    <PreRunSetupPanel
                      selectedLevel={selectedLevel}
                      selectedWorkoutOption={selectedWorkoutOption}
                      onSelectWorkoutOption={(updatedLevel, opt) => {
                        setSelectedWorkoutOption(opt);
                        setSelectedLevel(updatedLevel);
                      }}
                      selectedVenue={selectedVenue}
                      onSelectVenue={(nextVenue) => {
                        setSelectedVenue(nextVenue);
                        // Show interactive 3D arena immediately when switching venues so athlete previews it live
                        if (workoutVisualMode === '3d_map' && (nextVenue === 'treadmill' || nextVenue === 'track_400m' || nextVenue === 'track_200m')) {
                          setWorkoutVisualMode('3d_arena');
                        }
                      }}
                      treadmillIncline={treadmillIncline}
                      onChangeTreadmillIncline={setTreadmillIncline}
                      userPosition={userPosition}
                      onGpsPositionResolved={(pos, useSim) => {
                        setUserPosition(pos);
                        setGhostPosition(pos);
                        setIsSimulating(useSim);
                      }}
                      onLaunchWorkout={({ venue, useSimulation, inclinePercent }) => {
                        handleStartWorkout(selectedLevel, selectedWorkoutOption, {
                          venue,
                          useSimulation,
                          inclinePercent,
                        });
                      }}
                      onOpenCoach={() => setActiveTab('coach')}
                      onOpenWeatherModal={() => setShowWeatherModal(true)}
                      onOpenAudioModal={() => setShowAudioCoachModal(true)}
                      onOpenPushModal={() => setShowPushModal(true)}
                      liveWeather={liveWeather}
                      audioCoachSnap={audioCoachSnap}
                      pushStatus={pushStatus}
                      userLevel={userProfile.level}
                      userXp={userProfile.xp}
                      athleteName={userProfile.name}
                      theme={theme}
                    />
                  ) : (
                    <WorkoutHUD
                      level={selectedLevel}
                      isActive={isWorkoutActive}
                      isPaused={isPaused}
                      elapsedSeconds={elapsedSeconds}
                      totalDistanceMeters={totalDistanceMeters}
                      currentPaceMinKm={currentPaceMinKm}
                      currentSpeedKmh={currentSpeedKmh}
                      maxSpeedKmh={maxSpeedKmh}
                      currentIntervalIndex={currentIntervalIndex}
                      ghostDistanceMeters={ghostDistanceMeters}
                      batteryPercent={batteryPercent}
                      xpGained={xpGained}
                      orbs={orbs}
                      combatZones={combatZones}
                      isSimulating={isSimulating}
                      simSpeedMultiplier={simSpeedMultiplier}
                      theme={theme}
                      userPosition={userPosition}
                      weatherData={liveWeather}
                      onRefreshWeather={refreshWeather}
                      autoPauseEnabled={autoPauseEnabled}
                      isAutoPaused={isAutoPaused}
                      stationarySeconds={stationarySeconds}
                      autoPauseThresholdSeconds={AUTO_PAUSE_THRESHOLD_SECONDS}
                      liveGeoVelocityMs={liveGeoVelocityMs}
                      isSimStationary={isSimStationary}
                      onToggleAutoPause={handleToggleAutoPause}
                      onToggleSimStationary={handleToggleSimStationary}
                      onTogglePause={handleTogglePause}
                      onFinishWorkout={handleFinishWorkout}
                      onToggleSimulating={() => {
                        stationarySinceMsRef.current = null;
                        setStationarySeconds(0);
                        setIsSimStationary(false);
                        setIsSimulating(!isSimulating);
                      }}
                      onChangeSimSpeed={(m) => setSimSpeedMultiplier(m)}
                      onSteerSim={handleSteerSim}
                      onTriggerBurst={handleTriggerBurst}
                      venue={selectedVenue}
                      inclinePercent={treadmillIncline}
                      elevationGainMeters={elevationGainMeters}
                      onChangeIncline={setTreadmillIncline}
                      athleteAge={userProfile.age || 28}
                      onUpdateAthleteAge={handleUpdateAge}
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'coach' && (
              <CoachChat
                userProfile={userProfile}
                selectedLevel={selectedLevel}
                selectedWorkoutOption={selectedWorkoutOption}
                userPosition={userPosition}
                theme={theme}
              />
            )}

            {activeTab === 'duel' && (
              <DuelModeView
                userProfile={userProfile}
                firebaseUser={firebaseUser}
                userPosition={userPosition}
                apiKey={API_KEY}
                hasValidKey={HAS_VALID_KEY}
                theme={theme}
                isSmartphone={isSmartphone}
                onSignInWithGoogle={async () => {
                  await signInWithGoogle();
                }}
                onDuelFinished={(xpEarned, distMeters) => {
                  setUserProfile((prev) => {
                    const updated: UserProfile = {
                      ...prev,
                      xp: prev.xp + xpEarned,
                      totalDistanceKm: Number((prev.totalDistanceKm + distMeters / 1000).toFixed(2)),
                    };
                    localStorage.setItem('runlevel_profile', JSON.stringify(updated));
                    return updated;
                  });
                }}
              />
            )}

            {activeTab === 'records' && <PersonalRecordsWall theme={theme} />}

            {activeTab === 'rankings' && (
              <RankingsView
                userProfile={userProfile}
                teamsStore={communityTeams}
                onUpdateGender={handleUpdateGender}
                onOpenCreateTeam={() => {
                  setActiveTab('community');
                  setAutoOpenCreateTeam(true);
                }}
                onManageTeam={(teamId) => {
                  setInspectTeamId(teamId);
                  setActiveTab('community');
                }}
                theme={theme}
              />
            )}

            {activeTab === 'community' && (
              <CommunityView
                userProfile={userProfile}
                firebaseUser={firebaseUser}
                teamsStore={communityTeams}
                initialWorkoutToShare={communityWorkoutToShare}
                autoOpenCamera={autoOpenCommunityCamera}
                onClearAutoOpen={() => setAutoOpenCommunityCamera(false)}
                autoOpenCreateTeam={autoOpenCreateTeam}
                onClearAutoOpenCreateTeam={() => setAutoOpenCreateTeam(false)}
                inspectTeamId={inspectTeamId}
                onClearInspectTeamId={() => setInspectTeamId(null)}
                theme={theme}
              />
            )}

            {activeTab === 'skills' && (
              <SkillTree
                userLevel={userProfile.level}
                userXp={userProfile.xp}
                theme={theme}
              />
            )}

            {activeTab === 'cross' && <CrossTrainingView theme={theme} />}

            {activeTab === 'shoes' && <ShoeTracker theme={theme} />}

            {activeTab === 'analytics' && (
              <PerformanceAnalyticsDashboard
                userProfile={userProfile}
                activeDevice={activeDevice}
                onStartNewMission={() => setActiveTab('levels')}
                onOpenCommunityCamera={openCommunityWithCamera}
                theme={theme}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileStats
                profile={userProfile}
                onEditProfile={() => setShowOnboardingModal(true)}
                onUpdateWeight={(newWeightKg) => {
                  const updated = { ...userProfile, weightKg: newWeightKg };
                  setUserProfile(updated);
                  localStorage.setItem('runlevel_profile', JSON.stringify(updated));
                }}
                onUpdateWeeklyGoals={(newGoals) => {
                  setUserProfile((prev) => {
                    const updated = { ...prev, weeklyGoals: newGoals };
                    try {
                      localStorage.setItem('runlevel_profile', JSON.stringify(updated));
                    } catch {
                      // Ignore storage quota errors
                    }
                    return updated;
                  });
                }}
                theme={theme}
              />
            )}
          </>
        )}
            </main>
          </div>

          {/* SMARTPHONE FIXED THUMB-ZONE BOTTOM NAVIGATION BAR */}
          {isSmartphone && (
            <>
              <nav
                aria-label="Navegação principal mobile"
                className={`${
                  isSimulatedPhoneFrame ? 'sticky bottom-0' : 'fixed bottom-0 left-0 right-0'
                } z-40 h-16 border-t backdrop-blur-md grid grid-cols-5 items-center px-1 ${
                  isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-950/95 border-slate-800'
                }`}
              >
                {[
                  { id: 'levels' as const, label: 'Missões', icon: <Flame className="w-5 h-5" /> },
                  { id: 'workout' as const, label: 'Corrida', icon: <Compass className="w-5 h-5" /> },
                  { id: 'community' as const, label: 'Social', icon: <Users className="w-5 h-5" /> },
                  { id: 'rankings' as const, label: 'Rankings', icon: <Crown className="w-5 h-5" /> },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setCompletedStats(null);
                        setActiveTab(tab.id);
                        setShowMobileMoreSheet(false);
                      }}
                      className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                        active
                          ? isLight
                            ? 'text-orange-600'
                            : 'text-cyan-400'
                          : isLight
                          ? 'text-slate-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {tab.icon}
                      <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowMobileMoreSheet((prev) => !prev)}
                  className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                    showMobileMoreSheet
                      ? isLight
                        ? 'text-orange-600'
                        : 'text-cyan-400'
                      : isLight
                      ? 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                >
                  <LayoutGrid className="w-5 h-5" />
                  <span className="text-[10px] font-semibold tracking-tight">Mais</span>
                </button>
              </nav>

              {/* Smartphone "Mais" Bottom Sheet Drawer */}
              {showMobileMoreSheet && (
                <div
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
                  onClick={() => setShowMobileMoreSheet(false)}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full max-w-[430px] rounded-t-3xl border-t p-5 space-y-4 shadow-2xl ${
                      isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                    }`}
                  >
                    <div className="w-10 h-1.5 rounded-full bg-slate-500/40 mx-auto" />
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">Menu do Atleta</h3>
                      <button
                        type="button"
                        onClick={() => setShowMobileMoreSheet(false)}
                        className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Duelo 1v1', icon: <Swords className="w-4 h-4" />, action: () => setActiveTab('duel') },
                        { label: 'Gráficos', icon: <BarChart3 className="w-4 h-4" />, action: () => setActiveTab('analytics') },
                        { label: 'Recordes', icon: <Trophy className="w-4 h-4" />, action: () => setActiveTab('records') },
                        { label: 'Perfil', icon: <User className="w-4 h-4" />, action: () => setActiveTab('profile') },
                        { label: 'Habilidades', icon: <Zap className="w-4 h-4" />, action: () => setActiveTab('skills') },
                        { label: 'Força', icon: <Dumbbell className="w-4 h-4" />, action: () => setActiveTab('cross') },
                        { label: 'Tênis', icon: <Shield className="w-4 h-4" />, action: () => setActiveTab('shoes') },
                        { label: 'Coach AI', icon: <Bot className="w-4 h-4" />, action: () => setActiveTab('coach') },
                        { label: 'Dispositivos', icon: <Bluetooth className="w-4 h-4" />, action: () => setShowDeviceModal(true) },
                        { label: 'Push Chuva', icon: <BellRing className="w-4 h-4" />, action: () => setShowPushModal(true) },
                        { label: 'Cooper', icon: <Activity className="w-4 h-4" />, action: () => setShowCooperModal(true) },
                        { label: 'SOS / Live', icon: <Radio className="w-4 h-4" />, action: () => setShowSafetyModal(true) },
                        { label: 'Instalar PWA', icon: <Smartphone className="w-4 h-4" />, action: () => setShowPWAModal(true) },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            item.action();
                            setShowMobileMoreSheet(false);
                          }}
                          className={`min-h-[58px] p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-[11px] font-semibold cursor-pointer transition ${
                            isLight
                              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                              : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200'
                          }`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Onboarding / Athlete Registration Login Modal */}
      {showOnboardingModal && (
        <OnboardingModal
          currentProfile={userProfile}
          onSaveProfile={handleSaveProfileData}
          onClose={() => setShowOnboardingModal(false)}
          isInitialSetup={!userProfile.registered}
          theme={theme}
        />
      )}

      {/* Cooper Test 12-Min Assessment Modal */}
      {showCooperModal && (
        <CooperTestModal
          currentProfile={userProfile}
          onConfirmLevel={(newLevelId, vdot, vo2max) => {
            const levelNum = newLevelId === 'nivel-5' ? 5 : newLevelId === 'nivel-4' ? 4 : newLevelId === 'nivel-3' ? 3 : newLevelId === 'nivel-2' ? 2 : 1;
            const updatedProfile = { ...userProfile, level: levelNum };
            setUserProfile(updatedProfile);
            localStorage.setItem('runlevel_profile', JSON.stringify(updatedProfile));
            setShowCooperModal(false);
          }}
          onClose={() => setShowCooperModal(false)}
          theme={theme}
        />
      )}

      {/* Community Safety & SOS Live Tracking Modal */}
      {showSafetyModal && (
        <CommunitySafetyModal
          onClose={() => setShowSafetyModal(false)}
          theme={theme}
        />
      )}

      {/* Central de Conectividade com Dispositivos e Equipamentos de Saúde */}
      {showDeviceModal && (
        <DeviceHubModal
          onClose={() => setShowDeviceModal(false)}
          theme={theme}
        />
      )}

      {/* Modal de Instalação Mobile PWA (Android & Apple iOS) */}
      {showPWAModal && (
        <PWAInstallModal
          isOpen={showPWAModal}
          onClose={() => setShowPWAModal(false)}
          theme={theme}
        />
      )}

      {/* Modal de Telemetria Meteorológica, Hidratação e Equipamentos */}
      {showWeatherModal && liveWeather && (
        <WeatherModal
          weather={liveWeather}
          isLoading={isWeatherLoading}
          onRefresh={refreshWeather}
          onClose={() => setShowWeatherModal(false)}
          theme={theme}
        />
      )}

      {/* Modal de Configuração do Audio Coach (Web Speech API) */}
      {showAudioCoachModal && (
        <AudioCoachSettingsModal
          onClose={() => setShowAudioCoachModal(false)}
          theme={theme}
          currentPaceMinKm={currentPaceMinKm}
          targetPaceMinKm={selectedLevel.intervals[currentIntervalIndex]?.targetPaceMinKm || 5.5}
          currentSpeedKmh={currentSpeedKmh || 11.5}
          totalDistanceMeters={totalDistanceMeters}
          elapsedSeconds={elapsedSeconds}
        />
      )}

      {/* Notificação Push Local: Monitor T-15 Minutos para Chuva Forte & Reagendamento */}
      <LocalPushNotification
        weather={liveWeather}
        missionTitle={
          selectedWorkoutOption
            ? `${selectedLevel.title.split(' • ')[0]} — ${selectedWorkoutOption.title}`
            : selectedLevel.title
        }
        isWorkoutActive={isWorkoutActive}
        isModalOpen={showPushModal}
        onCloseModal={() => setShowPushModal(false)}
        onStatusChange={setPushStatus}
        theme={theme}
      />

      {/* Central Global de Compartilhamento em Redes Sociais */}
      {showSocialShareModal && (
        <SocialShareModal
          payload={{
            kind: 'profile',
            badge: `ATLETA NÍVEL ${userProfile.level} • RUN360X`,
            title: userProfile.name || 'Atleta RUN360X',
            subtitle: `Missão atual: ${selectedLevel.codename} • ${userProfile.conqueredSectors.length} setores conquistados`,
            metrics: [
              { label: 'Distância Total', value: `${userProfile.totalDistanceKm.toFixed(1)} km` },
              { label: 'XP Acumulado', value: `${userProfile.xp} XP` },
              { label: 'Nível Tático', value: `LVL ${userProfile.level}` },
              { label: 'Setores', value: `${userProfile.conqueredSectors.length}` },
            ],
            defaultCaption:
              `🏃‍♂️ Treinando no RUN360X — Mapa Tático & Missões de Corrida! ⚡\n` +
              `👤 ${userProfile.name || 'Atleta RUN360X'} • Nível ${userProfile.level} (${userProfile.xp} XP)\n` +
              `📏 ${userProfile.totalDistanceKm.toFixed(1)} km acumulados • 🏆 ${userProfile.conqueredSectors.length} setores dominados\n\n` +
              `Venha correr comigo! #RUN360X #Corrida #Running #Treino`,
          }}
          onClose={() => setShowSocialShareModal(false)}
          theme={theme}
        />
      )}
    </div>
  );
}

