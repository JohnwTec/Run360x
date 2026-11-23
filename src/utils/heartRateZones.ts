import { RunVenueType } from '../types';

export type HeartRateZoneId = 1 | 2 | 3 | 4 | 5;

export interface HeartRateZoneDef {
  id: HeartRateZoneId;
  code: string;
  name: string;
  shortDesc: string;
  minPct: number;
  maxPct: number;
  minBpm: number;
  maxBpm: number;
  barClass: string;
  textDarkClass: string;
  textLightClass: string;
  bgDarkClass: string;
  bgLightClass: string;
  borderDarkClass: string;
  borderLightClass: string;
}

export interface HeartRateTelemetry {
  athleteAge: number;
  maxHr: number;
  restingHr: number;
  currentBpm: number;
  pctMaxHr: number;
  activeZone: HeartRateZoneDef;
  zones: HeartRateZoneDef[];
  cue: string;
}

const ZONE_TEMPLATES: Array<{
  id: HeartRateZoneId;
  code: string;
  name: string;
  shortDesc: string;
  minPct: number;
  maxPct: number;
  barClass: string;
  textDarkClass: string;
  textLightClass: string;
  bgDarkClass: string;
  bgLightClass: string;
  borderDarkClass: string;
  borderLightClass: string;
}> = [
  {
    id: 1,
    code: 'Z1',
    name: 'Recuperação',
    shortDesc: 'Aquecimento leve e regeneração ativa',
    minPct: 50,
    maxPct: 60,
    barClass: 'bg-sky-400',
    textDarkClass: 'text-sky-300',
    textLightClass: 'text-sky-700',
    bgDarkClass: 'bg-sky-950/40',
    bgLightClass: 'bg-sky-50',
    borderDarkClass: 'border-sky-500/40',
    borderLightClass: 'border-sky-300',
  },
  {
    id: 2,
    code: 'Z2',
    name: 'Aeróbica',
    shortDesc: 'Resistência de base e eficiência metabólica',
    minPct: 60,
    maxPct: 70,
    barClass: 'bg-emerald-500',
    textDarkClass: 'text-emerald-300',
    textLightClass: 'text-emerald-700',
    bgDarkClass: 'bg-emerald-950/40',
    bgLightClass: 'bg-emerald-50',
    borderDarkClass: 'border-emerald-500/40',
    borderLightClass: 'border-emerald-300',
  },
  {
    id: 3,
    code: 'Z3',
    name: 'Tempo / Ritmo',
    shortDesc: 'Ritmo sustentado e capacidade aeróbica',
    minPct: 70,
    maxPct: 80,
    barClass: 'bg-cyan-400',
    textDarkClass: 'text-cyan-300',
    textLightClass: 'text-cyan-700',
    bgDarkClass: 'bg-cyan-950/40',
    bgLightClass: 'bg-cyan-50',
    borderDarkClass: 'border-cyan-500/40',
    borderLightClass: 'border-cyan-300',
  },
  {
    id: 4,
    code: 'Z4',
    name: 'Limiar Anaeróbico',
    shortDesc: 'Tolerância ao lactato e velocidade de prova',
    minPct: 80,
    maxPct: 90,
    barClass: 'bg-amber-500',
    textDarkClass: 'text-amber-300',
    textLightClass: 'text-amber-700',
    bgDarkClass: 'bg-amber-950/40',
    bgLightClass: 'bg-amber-50',
    borderDarkClass: 'border-amber-500/40',
    borderLightClass: 'border-amber-300',
  },
  {
    id: 5,
    code: 'Z5',
    name: 'VO2 Máx / Sprint',
    shortDesc: 'Potência máxima e tiros explosivos',
    minPct: 90,
    maxPct: 100,
    barClass: 'bg-rose-500',
    textDarkClass: 'text-rose-300',
    textLightClass: 'text-rose-700',
    bgDarkClass: 'bg-rose-950/40',
    bgLightClass: 'bg-rose-50',
    borderDarkClass: 'border-rose-500/40',
    borderLightClass: 'border-rose-300',
  },
];

/**
 * Computes physiological Max Heart Rate using the Tanaka equation (208 - 0.7 * age)
 * and builds the 5 personalized Heart Rate Zones (Z1-Z5).
 */
export function buildHeartRateZones(rawAge?: number): {
  athleteAge: number;
  maxHr: number;
  restingHr: number;
  zones: HeartRateZoneDef[];
} {
  const athleteAge = Math.min(90, Math.max(14, Math.round(rawAge || 28)));
  const maxHr = Math.round(208 - 0.7 * athleteAge);
  const restingHr = Math.min(68, Math.max(52, Math.round(54 + athleteAge * 0.14)));

  const zones: HeartRateZoneDef[] = ZONE_TEMPLATES.map((z) => ({
    ...z,
    minBpm: Math.round((maxHr * z.minPct) / 100),
    maxBpm: z.id === 5 ? maxHr : Math.round((maxHr * z.maxPct) / 100) - 1,
  }));

  return { athleteAge, maxHr, restingHr, zones };
}

/**
 * Estimates live heart rate dynamically from athlete age, current running pace (min/km),
 * speed, incline/terrain load, pause state, and mild cardiac drift over elapsed duration.
 */
export function computeHeartRateTelemetry(params: {
  athleteAge?: number;
  currentPaceMinKm: number;
  currentSpeedKmh: number;
  isPaused: boolean;
  elapsedSeconds: number;
  inclinePercent?: number;
  venue?: RunVenueType;
}): HeartRateTelemetry {
  const { athleteAge, maxHr, restingHr, zones } = buildHeartRateZones(params.athleteAge);
  const {
    currentPaceMinKm,
    currentSpeedKmh,
    isPaused,
    elapsedSeconds,
    inclinePercent = 0,
    venue = 'road_city',
  } = params;

  // Derive pace cleanly even if speed is temporarily zero or pace is extreme
  const effectivePace =
    isFinite(currentPaceMinKm) && currentPaceMinKm > 2.2 && currentPaceMinKm < 16
      ? currentPaceMinKm
      : currentSpeedKmh > 1.5
        ? 60 / currentSpeedKmh
        : 9.5;

  let pctMaxHr: number;

  if (isPaused || currentSpeedKmh < 0.8) {
    // Recovery heart rate during pause / standing still (~54% FC Máx)
    pctMaxHr = 54;
  } else {
    // Map pace (min/km) to cardiac intensity % of FC Máx:
    // 8:30/km (~7.0 km/h) -> ~57% (Z1)
    // 6:45/km (~8.9 km/h) -> ~66% (Z2)
    // 5:30/km (~10.9 km/h) -> ~76% (Z3)
    // 4:30/km (~13.3 km/h) -> ~86% (Z4)
    // 3:30/km (~17.1 km/h) -> ~96% (Z5)
    const speedFromPace = 60 / Math.max(2.5, effectivePace); // km/h
    const baseEffortPct = 36 + speedFromPace * 3.55;

    // Terrain / treadmill incline load (+0.85% FC Máx per 1% incline; trail +2.5% technical load)
    const inclineBoost = venue === 'treadmill' ? Math.max(0, inclinePercent) * 0.85 : 0;
    const terrainBoost = venue === 'trail' ? 2.6 : 0;

    // Subtle realistic cardiac drift during prolonged effort (up to +3.5% over 45 min)
    const driftBoost = Math.min(3.5, (elapsedSeconds / 2700) * 3.5);

    pctMaxHr = Math.min(99, Math.max(51, baseEffortPct + inclineBoost + terrainBoost + driftBoost));
  }

  const currentBpm = Math.min(maxHr, Math.max(restingHr + 18, Math.round((maxHr * pctMaxHr) / 100)));
  const normalizedPct = Math.min(100, Math.max(45, Math.round((currentBpm / maxHr) * 100)));

  let activeZone = zones[0];
  for (const z of zones) {
    if (normalizedPct >= z.minPct && (normalizedPct < z.maxPct || z.id === 5)) {
      activeZone = z;
      break;
    }
  }
  if (normalizedPct >= 90) activeZone = zones[4];

  const cues: Record<HeartRateZoneId, string> = {
    1: 'Zona leve de recuperação — ótima para aquecimento, trote solto ou volta à calma.',
    2: 'Zona aeróbica ideal — construindo resistência sustentável com baixo desgaste.',
    3: 'Ritmo constante de cruzeiro — ótimo equilíbrio entre velocidade e controle respiratório.',
    4: 'Limiar anaeróbico ativo — ritmo forte de prova, foque na respiração ritmada.',
    5: 'Esforço máximo VO2 — sustente em tiros curtos e prepare-se para recuperar.',
  };

  return {
    athleteAge,
    maxHr,
    restingHr,
    currentBpm,
    pctMaxHr: normalizedPct,
    activeZone,
    zones,
    cue: isPaused ? 'Frequência em desaceleração — aproveite a pausa para normalizar a respiração.' : cues[activeZone.id],
  };
}

export function formatZoneSeconds(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
