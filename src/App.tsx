import React, { useState, useEffect, useRef } from 'react';
import { Key, MapPin, Zap, Shield, Play, User, Flame, Compass, Award, Sun, Moon, Bot, Sparkles, Activity, Trophy, Radio, Dumbbell, Watch, Bluetooth, Smartphone } from 'lucide-react';
import { TrainingLevel, PathPoint, XPOrb, CombatZone, WorkoutStats, UserProfile, LatLng, WorkoutOption } from './types';
import { TRAINING_LEVELS } from './data/trainingPrograms';
import { KeySetupModal } from './components/KeySetupModal';
import { TacticalMap } from './components/TacticalMap';
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
import {
  generateNearbyOrbs,
  generateCombatZones,
  simulateNextPosition,
  calculateGhostPosition,
  calculateDistanceMeters,
} from './utils/geo';
import { tacticalAudio } from './utils/audio';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const HAS_VALID_KEY = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function App() {
  const [activeTab, setActiveTab] = useState<'levels' | 'workout' | 'coach' | 'profile' | 'shoes' | 'records' | 'skills' | 'cross'>('levels');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const [showCooperModal, setShowCooperModal] = useState<boolean>(false);
  const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);
  const [showDeviceModal, setShowDeviceModal] = useState<boolean>(false);
  const [showPWAModal, setShowPWAModal] = useState<boolean>(false);

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Atleta Alpha',
    age: 28,
    heightCm: 175,
    weightKg: 70,
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
  });

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

  const handleSaveProfileData = (data: { name: string; email?: string; age: number; heightCm: number; weightKg: number }) => {
    const updated: UserProfile = {
      ...userProfile,
      name: data.name,
      email: data.email,
      age: data.age,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      registered: true,
    };
    setUserProfile(updated);
    localStorage.setItem('runlevel_profile', JSON.stringify(updated));
    setShowOnboardingModal(false);
  };

  // Selected Level & Active Workout State
  const [selectedLevel, setSelectedLevel] = useState<TrainingLevel>(TRAINING_LEVELS[0]);
  const [selectedWorkoutOption, setSelectedWorkoutOption] = useState<WorkoutOption | undefined>(TRAINING_LEVELS[0].workoutOptions[0]);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Position & Path Tracking
  const [userPosition, setUserPosition] = useState<LatLng>({ lat: -23.561684, lng: -46.655981 }); // Default São Paulo Paulista
  const [userHeading, setUserHeading] = useState<number>(45);
  const [path, setPath] = useState<PathPoint[]>([]);

  // Simulation controls
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);

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

  // Post-Workout Debriefing State
  const [completedStats, setCompletedStats] = useState<WorkoutStats | null>(null);

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

  // Start Workout Session
  const handleStartWorkout = (level: TrainingLevel, selectedOption?: WorkoutOption) => {
    setSelectedLevel(level);
    if (selectedOption) setSelectedWorkoutOption(selectedOption);
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

    setActiveTab('workout');
    tacticalAudio.playIntervalStartSound();
    tacticalAudio.speakTacticalCoach(`Missão Diária iniciada: ${level.codename}. Mantenha o foco.`);
  };

  // Workout Simulation / GPS Loop
  useEffect(() => {
    if (!isWorkoutActive || isPaused) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);

      // Current Interval phase
      const currentInterval = selectedLevel.intervals[currentIntervalIndex] || selectedLevel.intervals[0] || { targetPaceMinKm: 5.5, type: 'jog' };

      // Calculate Target Speed for phase
      let speedKmh = 12; // default jog
      if (currentInterval.type === 'sprint') speedKmh = 16;
      else if (currentInterval.type === 'walk') speedKmh = 6;
      else if (currentInterval.type === 'warmup') speedKmh = 8.5;

      if (isSimulating) {
        // Simulate movement
        const simRes = simulateNextPosition(userPosition, userHeading, speedKmh * simSpeedMultiplier, 1);
        const newPos = simRes.position;
        setUserPosition(newPos);
        setUserHeading(simRes.nextHeading);

        // Distance delta
        const deltaMeters = calculateDistanceMeters(userPosition, newPos);
        setTotalDistanceMeters((prev) => prev + deltaMeters);

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

        // Check Orb Collection (< 25 meters distance)
        setOrbs((prevOrbs) =>
          prevOrbs.map((orb) => {
            if (!orb.collected && calculateDistanceMeters(newPos, orb.position) < 25) {
              tacticalAudio.playOrbCollectSound();
              setXpGained((xp) => xp + orb.xpValue);
              return { ...orb, collected: true };
            }
            return orb;
          })
        );

        // Check Combat Zones (< 40 meters)
        setCombatZones((prevZones) =>
          prevZones.map((zone) => {
            if (!zone.active && calculateDistanceMeters(newPos, zone.startPoint) < 40) {
              tacticalAudio.playCombatZoneAlertSound();
              tacticalAudio.speakTacticalCoach('Atenção! Entrando na Zona de Combate. Acelere o ritmo!');
              return { ...zone, active: true, triggered: true };
            }
            return zone;
          })
        );

        // Clear Fog of War Tile
        const tileKey = `${Math.floor(newPos.lat * 1000)}_${Math.floor(newPos.lng * 1000)}`;
        setFogClearedGrid((prevSet) => new Set(prevSet).add(tileKey));

        // Update Ghost Runner
        const ghostRes = calculateGhostPosition(
          elapsedSeconds,
          path,
          currentInterval.targetPaceMinKm,
          path[0] || newPos
        );
        setGhostPosition(ghostRes.position);
        setGhostDistanceMeters(ghostRes.distanceMetersBehindOrAhead);

        if (!ghostOvertaken && ghostRes.distanceMetersBehindOrAhead > 20) {
          setGhostOvertaken(true);
          tacticalAudio.playGhostOvertakeSound();
          tacticalAudio.speakTacticalCoach('Você ultrapassou o Corredor Fantasma! Excelente trabalho!');
        }

        // Battery Charge Management
        if (selectedLevel.id === 'nivel-5' || selectedLevel.id === 'nivel-4') {
          if (currentPace > currentInterval.targetPaceMinKm + 0.5) {
            setBatteryPercent((b) => Math.max(0, b - 1));
          } else {
            setBatteryPercent((b) => Math.min(100, b + 0.2));
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isWorkoutActive, isPaused, userPosition, userHeading, isSimulating, simSpeedMultiplier, elapsedSeconds, selectedLevel, currentIntervalIndex, path, maxSpeedKmh, ghostOvertaken]);

  // Steer simulator manually
  const handleSteerSim = (dir: 'left' | 'right' | 'straight') => {
    if (dir === 'left') setUserHeading((prev) => (prev - 30 + 360) % 360);
    if (dir === 'right') setUserHeading((prev) => (prev + 30) % 360);
  };

  // Nitro burst speed
  const handleTriggerBurst = () => {
    setCurrentSpeedKmh(18);
    setIsRecordSparks(true);
    tacticalAudio.playSparkSound();
    tacticalAudio.playOrbCollectSound();
  };

  // Finish Workout Session and generate debriefing
  const handleFinishWorkout = () => {
    setIsWorkoutActive(false);

    const collectedCount = orbs.filter((o) => o.collected).length;
    const finalXp = xpGained + 300 + collectedCount * 50;
    const distMeters = Math.max(totalDistanceMeters, 1500);
    const durSeconds = Math.max(elapsedSeconds, 180);
    const weight = userProfile.weightKg || 70;
    const estimatedKcal = Math.round((distMeters / 1000) * 1.03 * weight);

    const stats: WorkoutStats = {
      id: `workout-${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      timeOfDay: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      levelId: selectedLevel.id,
      workoutMode: selectedWorkoutOption?.id || 'longao',
      workoutTitle: selectedWorkoutOption ? `${selectedLevel.title.split(' • ')[0]} - ${selectedWorkoutOption.title}` : selectedLevel.title,
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

    setCompletedStats(stats);

    // Update Profile
    setUserProfile((prev) => ({
      ...prev,
      xp: prev.xp + finalXp,
      totalDistanceKm: prev.totalDistanceKm + stats.totalDistanceMeters / 1000,
      conqueredSectors: prev.conqueredSectors.includes(stats.sectorConquered!)
        ? prev.conqueredSectors
        : [...prev.conqueredSectors, stats.sectorConquered!],
      history: [stats, ...prev.history],
    }));
  };

  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950'
    }`}>
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

      {/* Main Tactical App Navbar */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${
        isLight ? 'bg-white/90 border-slate-200' : 'bg-slate-900/90 border-cyan-500/20'
      }`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className={`relative p-2 rounded-xl border ${
              isLight ? 'bg-orange-50 border-orange-200' : 'bg-slate-950 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
            }`}>
              <Compass className={`w-6 h-6 animate-spin-slow ${isLight ? 'text-orange-600' : 'text-cyan-400'}`} />
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping ${
                isLight ? 'bg-orange-500' : 'bg-cyan-400'
              }`} />
            </div>
            <div>
              <h1 className="font-black tracking-wider uppercase flex items-center gap-1.5 animate-neon-flicker text-cyan-400 drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]" style={{ fontFamily: 'Verdana, sans-serif', fontSize: '12px', lineHeight: '14px', textAlign: 'center' }}>
                RUN360X{' '}
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  isLight ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-cyan-950 border border-cyan-500/40 text-cyan-400'
                }`}>
                  {isLight ? 'LIGHT TACTICAL' : 'DARK NEON'}
                </span>
              </h1>
              <p className={`text-[10px] font-mono hidden sm:block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                MAPA DE REALIDADE AUMENTADA & MISSÕES DIÁRIAS
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className={`flex flex-wrap items-center gap-1 p-1 rounded-xl border ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            <button
              onClick={() => setActiveTab('levels')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'levels'
                  ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" /> MISSÕES
            </button>

            <button
              onClick={() => setActiveTab('workout')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'workout'
                  ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" /> MAPA & HUD
            </button>

            <button
              onClick={() => setActiveTab('records')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'records'
                  ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" /> RECORDES (RP)
            </button>

            <button
              onClick={() => setActiveTab('skills')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'skills'
                  ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> HABILIDADES
            </button>

            <button
              onClick={() => setActiveTab('cross')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'cross'
                  ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" /> FORTALECIMENTO
            </button>

            <button
              onClick={() => setActiveTab('shoes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'shoes'
                  ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> TÊNIS
            </button>

            <button
              onClick={() => setActiveTab('coach')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'coach'
                  ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" /> COACH AI
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'profile'
                  ? isLight ? 'bg-orange-500 text-white shadow-sm' : 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" /> ATLETA
            </button>
          </nav>

          {/* Right Controls: Install PWA App, Dispositivos, Cooper Test, SOS Safety, Theme Switcher, Login Registration & Key Modal */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPWAModal(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-teal-500/20 via-cyan-500/20 to-emerald-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30 cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Instalar App RUN360X no Android ou iPhone (PWA Nativo)"
            >
              <Smartphone className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
              <span className="inline">INSTALAR APP</span>
            </button>

            <button
              onClick={() => setShowDeviceModal(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Central de Conectividade de Dispositivos (Smartwatches, Fones de Ouvido, Sensores BLE)"
            >
              <Bluetooth className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="hidden lg:inline">DISPOSITIVOS</span>
            </button>

            <button
              onClick={() => setShowCooperModal(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 cursor-pointer flex items-center gap-1"
              title="Teste de Nivelamento Cooper (12 Min)"
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">TESTE COOPER</span>
            </button>

            <button
              onClick={() => setShowSafetyModal(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 cursor-pointer flex items-center gap-1"
              title="SOS & Live Tracking"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden xl:inline">SOS / LIVE</span>
            </button>
            <button
              onClick={() => setShowOnboardingModal(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                userProfile.registered
                  ? isLight
                    ? 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700'
                    : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
                  : 'bg-rose-500 hover:bg-rose-600 text-white border-rose-400 animate-pulse'
              }`}
              title="Cadastro e Métricas do Atleta (Nome, Idade, Altura, Peso)"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{userProfile.name ? userProfile.name.split(' ')[0] : 'Cadastrar'}</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isLight
                  ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-800'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
              }`}
              title="Alternar Tema (Dark Neon / Light Tactical)"
            >
              {isLight ? <Moon className="w-4 h-4 text-slate-800" /> : <Sun className="w-4 h-4 text-amber-400" />}
              <span className="hidden md:inline">{isLight ? 'Modo Escuro' : 'Modo Claro'}</span>
            </button>

            <button
              onClick={() => setShowKeyModal(true)}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono border transition cursor-pointer ${
                HAS_VALID_KEY
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : isLight ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{HAS_VALID_KEY ? 'MAPS: ATIVO' : 'CHAVE MAPS'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Render Debriefing when completed */}
        {completedStats ? (
          <DebriefingView
            stats={completedStats}
            level={selectedLevel}
            onClose={() => setCompletedStats(null)}
            theme={theme}
          />
        ) : (
          <>
            {activeTab === 'levels' && (
              <LevelSelector
                onSelectLevel={handleStartWorkout}
                userLevel={userProfile.level}
                userXp={userProfile.xp}
                conqueredSectorsCount={userProfile.conqueredSectors.length}
                theme={theme}
              />
            )}

            {activeTab === 'workout' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Tactical Map Canvas / Google Maps (7 cols) */}
                <div className="lg:col-span-7 h-[480px] sm:h-[580px] w-full sticky top-20">
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

                {/* Right Column: Workout HUD Dashboard (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {!isWorkoutActive ? (
                    <div className={`p-6 border rounded-3xl space-y-4 ${
                      isLight ? 'bg-white border-slate-200 text-slate-800 shadow-md' : 'bg-slate-900 border-slate-800 text-white'
                    }`}>
                      <div className={`flex items-center gap-2 text-xs font-mono font-bold ${
                        isLight ? 'text-orange-600' : 'text-cyan-400'
                      }`}>
                        <Play className="w-4 h-4 fill-current" />
                        <span>MISSÃO DIÁRIA PRONTA PARA ATIVAÇÃO</span>
                      </div>

                      <div>
                        <h2 className="text-xl font-black uppercase">{selectedLevel.title.split(' • ')[0]}: {selectedLevel.codename}</h2>
                        <p className={`text-xs leading-relaxed mt-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                          {selectedLevel.description}
                        </p>
                      </div>

                      {/* Sub-option Selection Bar */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span className={`text-[10px] font-mono uppercase font-bold block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Modalidade do Treino (3 Opções):
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedLevel.workoutOptions.map((opt) => {
                            const isSelected = selectedWorkoutOption?.id === opt.id || selectedLevel.title.includes(opt.title);
                            return (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  const baseLevel = TRAINING_LEVELS.find((l) => l.id === selectedLevel.id) || selectedLevel;
                                  setSelectedWorkoutOption(opt);
                                  setSelectedLevel({
                                    ...baseLevel,
                                    title: `${baseLevel.title} • ${opt.title}`,
                                    targetDistanceKm: opt.targetDistanceKm,
                                    intervals: opt.intervals,
                                  });
                                }}
                                className={`p-2 rounded-xl border text-left font-mono transition cursor-pointer flex flex-col items-center text-center justify-center gap-1 ${
                                  isSelected
                                    ? isLight
                                      ? 'bg-orange-50 border-orange-500 text-orange-800 ring-2 ring-orange-400/30'
                                      : 'bg-cyan-950/80 border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/30'
                                    : isLight
                                      ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                                }`}
                              >
                                <span className="text-xl">{opt.badge}</span>
                                <span className="text-[11px] font-bold leading-tight block">{opt.title.split(' ')[0]}</span>
                                <span className="text-[9px] opacity-75">{opt.targetDistanceKm} km</span>
                              </button>
                            );
                          })}
                        </div>

                        {selectedWorkoutOption && (
                          <div className={`p-3.5 rounded-2xl border text-xs font-mono space-y-2 ${
                            isLight ? 'bg-orange-50/60 border-orange-200 text-slate-800' : 'bg-slate-950/80 border-cyan-500/30 text-slate-200'
                          }`}>
                            <div className="flex items-center justify-between font-bold">
                              <span className={isLight ? 'text-orange-700' : 'text-cyan-300'}>
                                {selectedWorkoutOption.badge} {selectedWorkoutOption.title}
                              </span>
                              <span className="text-amber-500 font-mono">+{selectedWorkoutOption.xpBonus} XP</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                              {selectedWorkoutOption.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                              <span><strong>Distância:</strong> {selectedWorkoutOption.targetDistanceKm} km</span>
                              <span><strong>Duração Est.:</strong> ~{selectedWorkoutOption.estimatedDurationMins} min</span>
                              <span><strong>Pace Alvo:</strong> {selectedWorkoutOption.targetPaceMinKm.toFixed(1)} min/km</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          onClick={() => setActiveTab('coach')}
                          className={`px-4 py-3 font-bold rounded-2xl text-xs font-mono transition cursor-pointer flex items-center justify-center gap-1.5 border ${
                            isLight
                              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                              : 'bg-slate-950 hover:bg-slate-800 border-cyan-500/30 text-cyan-300'
                          }`}
                        >
                          <Bot className="w-4 h-4 text-cyan-400" />
                          <span>DÚVIDAS SOBRE O TREINO?</span>
                        </button>

                        <button
                          onClick={() => handleStartWorkout(selectedLevel, selectedWorkoutOption)}
                          className={`flex-1 py-3.5 font-bold rounded-2xl text-sm font-mono uppercase tracking-wider transition cursor-pointer shadow-md ${
                            isLight
                              ? 'bg-orange-500 hover:bg-orange-600 text-white'
                              : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                          }`}
                        >
                          ⚡ ATIVAR RADAR TÁTICO & INICIAR
                        </button>
                      </div>
                    </div>
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
                      onTogglePause={() => setIsPaused(!isPaused)}
                      onFinishWorkout={handleFinishWorkout}
                      onToggleSimulating={() => setIsSimulating(!isSimulating)}
                      onChangeSimSpeed={(m) => setSimSpeedMultiplier(m)}
                      onSteerSim={handleSteerSim}
                      onTriggerBurst={handleTriggerBurst}
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
                theme={theme}
              />
            )}

            {activeTab === 'records' && <PersonalRecordsWall theme={theme} />}

            {activeTab === 'skills' && (
              <SkillTree
                userLevel={userProfile.level}
                userXp={userProfile.xp}
                theme={theme}
              />
            )}

            {activeTab === 'cross' && <CrossTrainingView theme={theme} />}

            {activeTab === 'shoes' && <ShoeTracker theme={theme} />}

            {activeTab === 'profile' && (
              <ProfileStats
                profile={userProfile}
                onEditProfile={() => setShowOnboardingModal(true)}
                onUpdateWeight={(newWeightKg) => {
                  const updated = { ...userProfile, weightKg: newWeightKg };
                  setUserProfile(updated);
                  localStorage.setItem('runlevel_profile', JSON.stringify(updated));
                }}
                theme={theme}
              />
            )}
          </>
        )}
      </main>

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
    </div>
  );
}

