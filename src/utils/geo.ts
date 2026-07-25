import { LatLng, PathPoint, XPOrb, CombatZone, GhostPoint } from '../types';

// Haversine distance in meters
export function calculateDistanceMeters(p1: LatLng, p2: LatLng): number {
  const R = 6371000; // meters
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatPace(paceMinKm: number): string {
  if (!isFinite(paceMinKm) || paceMinKm <= 0 || paceMinKm > 20) return "--'--\"";
  const mins = Math.floor(paceMinKm);
  const secs = Math.round((paceMinKm - mins) * 60);
  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mins}'${paddedSecs}"`;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const padS = s < 10 ? `0${s}` : `${s}`;
  const padM = m < 10 ? `0${m}` : `${m}`;
  return `${padM}:${padS}`;
}

// Generate realistic nearby XP Orbs around a starting center location
export function generateNearbyOrbs(center: LatLng, count: number = 6): XPOrb[] {
  const orbs: XPOrb[] = [];
  const titles = [
    'Orbe Célula de Energia Alpha',
    'Orbe de Pulso Ciber-Acelerado',
    'Orbe de Nitro Tático',
    'Orbe Cache de XP Bairro',
    'Orbe Bateria Cadência Neon',
    'Orbe Núcleo de Sobrecarga',
  ];

  for (let i = 0; i < count; i++) {
    // Generate within ~150m to 400m
    const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
    const distanceMeters = 120 + Math.random() * 250;
    
    // 1 deg lat ~= 111,000 m
    const deltaLat = (distanceMeters * Math.cos(angle)) / 111000;
    const deltaLng = (distanceMeters * Math.sin(angle)) / (111000 * Math.cos((center.lat * Math.PI) / 180));

    orbs.push({
      id: `orb-${i}-${Date.now()}`,
      position: { lat: center.lat + deltaLat, lng: center.lng + deltaLng },
      xpValue: 150 + Math.floor(Math.random() * 100),
      title: titles[i % titles.length],
      collected: false,
    });
  }

  return orbs;
}

// Generate Combat Zone along route
export function generateCombatZones(center: LatLng): CombatZone[] {
  // Combat zone offset ~180m ahead
  const startOffsetLat = 0.0012;
  const startOffsetLng = 0.0008;

  return [
    {
      id: 'cz-1',
      title: 'ZONA DE COMBATE: TIRO DE 400M',
      description: 'Prepare-se! Mantenha ritmo acima de 12km/h durante esta reta.',
      startPoint: { lat: center.lat + startOffsetLat, lng: center.lng + startOffsetLng },
      endPoint: { lat: center.lat + startOffsetLat + 0.0025, lng: center.lng + startOffsetLng + 0.0018 },
      triggered: false,
      active: false,
    },
  ];
}

// Interpolate next point for simulation mode along a realistic running trajectory
export function simulateNextPosition(
  current: LatLng,
  headingDegrees: number,
  speedKmh: number,
  deltaTimeSec: number
): { position: LatLng; nextHeading: number } {
  const distanceMeters = (speedKmh / 3.6) * deltaTimeSec;
  
  // Slight random sway to feel like real GPS / running trajectory
  const sway = (Math.random() - 0.5) * 12; // +/- 6 degrees
  const finalHeading = headingDegrees + sway;
  const rad = (finalHeading * Math.PI) / 180;

  const deltaLat = (distanceMeters * Math.cos(rad)) / 111000;
  const deltaLng = (distanceMeters * Math.sin(rad)) / (111000 * Math.cos((current.lat * Math.PI) / 180));

  return {
    position: {
      lat: current.lat + deltaLat,
      lng: current.lng + deltaLng,
    },
    nextHeading: (finalHeading + 360) % 360,
  };
}

// Create synthetic Ghost Runner trajectory running slightly ahead or behind
export function calculateGhostPosition(
  elapsedSeconds: number,
  path: PathPoint[],
  targetPaceMinKm: number,
  startPos: LatLng
): { position: LatLng; distanceMetersBehindOrAhead: number } {
  // Target ghost speed in m/s
  const ghostSpeedMs = 1000 / (targetPaceMinKm * 60);
  const ghostTargetDistanceMeters = elapsedSeconds * ghostSpeedMs;

  if (path.length <= 1) {
    return { position: startPos, distanceMetersBehindOrAhead: 0 };
  }

  // Calculate runner total distance
  let runnerTotalDistanceMeters = 0;
  for (let i = 1; i < path.length; i++) {
    runnerTotalDistanceMeters += calculateDistanceMeters(path[i - 1], path[i]);
  }

  const diffMeters = runnerTotalDistanceMeters - ghostTargetDistanceMeters;

  // Compute ghost position along runner's path or projected ahead
  const lastPoint = path[path.length - 1];
  const secondLast = path.length > 1 ? path[path.length - 2] : startPos;

  const angle = Math.atan2(lastPoint.lng - secondLast.lng, lastPoint.lat - secondLast.lat);

  // Ghost offset position
  const ghostDistFromStart = Math.max(0, ghostTargetDistanceMeters);
  const deltaLat = (ghostDistFromStart * Math.cos(angle)) / 111000;
  const deltaLng = (ghostDistFromStart * Math.sin(angle)) / (111000 * Math.cos((startPos.lat * Math.PI) / 180));

  return {
    position: {
      lat: startPos.lat + deltaLat,
      lng: startPos.lng + deltaLng,
    },
    distanceMetersBehindOrAhead: diffMeters, // positive = runner ahead of ghost, negative = ghost ahead
  };
}
