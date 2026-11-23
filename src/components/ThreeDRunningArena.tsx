import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Layers,
  Mountain,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { RunVenueType } from '../types';
import { getRunVenueConfig } from '../data/runVenues';

export type ArenaCameraMode = 'chase' | 'aerial' | 'side';

interface ThreeDRunningArenaProps {
  venue: RunVenueType;
  isWorkoutActive: boolean;
  isPaused: boolean;
  speedKmh: number;
  distanceMeters: number;
  ghostDistanceMeters: number;
  inclinePercent: number;
  elevationGainMeters: number;
  onChangeIncline?: (next: number) => void;
  theme?: 'dark' | 'light';
}

interface RunnerRig {
  root: THREE.Group;
  torso: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  shadowDisc: THREE.Mesh;
}

interface OvalTrackSpec {
  straightHalf: number;
  curveRadius: number;
  totalPerimeter: number;
}

function sampleOvalPoint(
  spec: OvalTrackSpec,
  fraction: number,
  laneOffset: number,
  outPos: THREE.Vector3,
  outTangent: THREE.Vector3
) {
  const { straightHalf, curveRadius } = spec;
  const r = curveRadius + laneOffset;
  const straightLen = straightHalf * 2;
  const curveLen = Math.PI * r;
  const perimeter = straightLen * 2 + curveLen * 2;
  const s = (((fraction % 1) + 1) % 1) * perimeter;

  if (s < straightLen) {
    // Bottom straight (+X direction, z = +r)
    const x = -straightHalf + s;
    outPos.set(x, 0, r);
    outTangent.set(1, 0, 0);
  } else if (s < straightLen + curveLen) {
    // Right curve (counter-clockwise around (+straightHalf, 0))
    const u = (s - straightLen) / r; // 0 to PI
    const angle = Math.PI / 2 - u;
    outPos.set(straightHalf + Math.cos(angle) * r, 0, Math.sin(angle) * r);
    outTangent.set(Math.sin(angle), 0, -Math.cos(angle));
  } else if (s < straightLen * 2 + curveLen) {
    // Top straight (-X direction, z = -r)
    const d = s - (straightLen + curveLen);
    const x = straightHalf - d;
    outPos.set(x, 0, -r);
    outTangent.set(-1, 0, 0);
  } else {
    // Left curve (counter-clockwise around (-straightHalf, 0))
    const u = (s - (straightLen * 2 + curveLen)) / r; // 0 to PI
    const angle = -Math.PI / 2 - u;
    outPos.set(-straightHalf + Math.cos(angle) * r, 0, Math.sin(angle) * r);
    outTangent.set(Math.sin(angle), 0, -Math.cos(angle));
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.48)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createTrackCanvasTexture(
  laneCount: number,
  surfaceHex: string,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = surfaceHex;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle rubber tartan grain
  for (let i = 0; i < 4800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const alpha = 0.04 + Math.random() * 0.08;
    ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(15,15,20,${alpha})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Alternating subtle lane bands
  const laneH = 512 / laneCount;
  for (let i = 0; i < laneCount; i++) {
    if (i % 2 === 1) {
      ctx.fillStyle = accentHex;
      ctx.fillRect(0, i * laneH, 512, laneH);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(0, i * laneH, 512, 4);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(0, 508, 512, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createTurfTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const stripeCount = 12;
  const stripeW = 512 / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1f7a3e' : '#258c49';
    ctx.fillRect(i * stripeW, 0, stripeW, 512);
  }
  for (let i = 0; i < 3200; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 3);
  }
  // Subtle field lines
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 48, 440, 416);
  ctx.beginPath();
  ctx.moveTo(256, 48);
  ctx.lineTo(256, 464);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(256, 256, 56, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createTreadmillBeltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#181c22';
  ctx.fillRect(0, 0, 512, 512);

  // Textured diamond rubber grip lines
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 512; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Side safety rails markings
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(22, 0, 10, 512);
  ctx.fillRect(480, 0, 10, 512);

  // Center motion chevrons so speed is unmistakably visible
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (let y = 40; y < 512; y += 128) {
    ctx.beginPath();
    ctx.moveTo(196, y + 36);
    ctx.lineTo(256, y);
    ctx.lineTo(316, y + 36);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2.6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createRoadAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#252b34';
  ctx.fillRect(0, 0, 512, 512);

  // Asphalt aggregate speckle
  for (let i = 0; i < 6000; i++) {
    const shade = 25 + Math.floor(Math.random() * 45);
    ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 9})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  // Outer edge white lines
  ctx.fillStyle = 'rgba(241,245,249,0.85)';
  ctx.fillRect(36, 0, 10, 512);
  ctx.fillRect(466, 0, 10, 512);

  // Dedicated running / bike lane stripe in cyan
  ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
  ctx.fillRect(108, 0, 8, 512);

  // Center amber dashed line
  ctx.fillStyle = '#f59e0b';
  for (let y = 16; y < 512; y += 128) {
    ctx.fillRect(250, y, 12, 68);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBuildingFacadeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 512);

  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 6; col++) {
      const lit = (row * 7 + col * 13) % 5 !== 0;
      if (lit) {
        ctx.fillStyle = (row + col) % 3 === 0 ? '#bae6fd' : '#fde68a';
      } else {
        ctx.fillStyle = '#0f172a';
      }
      ctx.fillRect(16 + col * 38, 16 + row * 30, 24, 18);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createRunnerRig(
  shadowTex: THREE.CanvasTexture,
  options: { isGhost?: boolean; jerseyHex?: number; accentHex?: number } = {}
): RunnerRig {
  const isGhost = Boolean(options.isGhost);
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x67e8f9 : 0xd99b72,
    roughness: isGhost ? 0.25 : 0.65,
    metalness: isGhost ? 0.15 : 0.02,
    transparent: isGhost,
    opacity: isGhost ? 0.48 : 1,
  });

  const jerseyMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x22d3ee : options.jerseyHex ?? 0x0ea5e9,
    roughness: 0.72,
    metalness: 0.06,
    emissive: isGhost ? new THREE.Color(0x0891b2) : new THREE.Color(0x000000),
    emissiveIntensity: isGhost ? 0.55 : 0,
    transparent: isGhost,
    opacity: isGhost ? 0.52 : 1,
  });

  const shortsMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x0284c7 : 0x0f172a,
    roughness: 0.8,
    metalness: 0.05,
    transparent: isGhost,
    opacity: isGhost ? 0.45 : 1,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0xa5f3fc : options.accentHex ?? 0xf97316,
    roughness: 0.35,
    metalness: 0.12,
    transparent: isGhost,
    opacity: isGhost ? 0.55 : 1,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0xecfeff : 0x111827,
    roughness: 0.16,
    metalness: 0.85,
    transparent: isGhost,
    opacity: isGhost ? 0.65 : 1,
  });

  const torso = new THREE.Group();
  torso.position.set(0, 1.02, 0);
  root.add(torso);

  // Pelvis / Shorts
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.22, 12), shortsMat);
  pelvis.position.set(0, -0.05, 0);
  pelvis.castShadow = !isGhost;
  torso.add(pelvis);

  // Chest / Jersey
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.21), jerseyMat);
  chest.position.set(0, 0.26, 0);
  chest.castShadow = !isGhost;
  torso.add(chest);

  // Chest reflective stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.055, 0.22), shoeMat);
  stripe.position.set(0, 0.31, 0);
  torso.add(stripe);

  // Head + athletic visor
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 14), skinMat);
  head.position.set(0, 0.64, 0.01);
  head.castShadow = !isGhost;
  torso.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.12), visorMat);
  visor.position.set(0, 0.66, 0.1);
  torso.add(visor);

  // Arms (pivoted at shoulder)
  const makeArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.24, 0.44, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.22, 6, 8), skinMat);
    upper.position.set(0, -0.14, 0);
    upper.castShadow = !isGhost;
    pivot.add(upper);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 6, 8), skinMat);
    forearm.position.set(0, -0.28, 0.14);
    forearm.rotation.x = -Math.PI / 2.2;
    forearm.castShadow = !isGhost;
    pivot.add(forearm);
    return pivot;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torso.add(leftArm, rightArm);

  // Legs (pivoted at hip)
  const makeLeg = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.105, 0.92, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.34, 6, 8), shortsMat);
    thigh.position.set(0, -0.21, 0);
    thigh.castShadow = !isGhost;
    pivot.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.34, 6, 8), skinMat);
    shin.position.set(0, -0.61, -0.02);
    shin.castShadow = !isGhost;
    pivot.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.26), shoeMat);
    shoe.position.set(0, -0.87, 0.05);
    shoe.castShadow = !isGhost;
    pivot.add(shoe);

    return pivot;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  root.add(leftLeg, rightLeg);

  // Ground contact shadow disc
  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: isGhost ? 0.3 : 0.72,
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  return { root, torso, leftArm, rightArm, leftLeg, rightLeg, shadowDisc };
}

function animateRunnerStride(
  rig: RunnerRig,
  stridePhase: number,
  speedKmh: number,
  isRunning: boolean,
  inclineLean = 0
) {
  const amp = isRunning ? THREE.MathUtils.clamp(speedKmh / 14, 0.25, 1.05) : 0.05;
  const s = Math.sin(stridePhase);
  const c = Math.cos(stridePhase);

  rig.leftLeg.rotation.x = s * 0.72 * amp;
  rig.rightLeg.rotation.x = -s * 0.72 * amp;
  rig.leftArm.rotation.x = -s * 0.65 * amp;
  rig.rightArm.rotation.x = s * 0.65 * amp;

  const bounce = isRunning ? Math.abs(c) * 0.085 * amp : Math.sin(stridePhase * 0.4) * 0.015;
  rig.torso.position.y = 1.02 + bounce;
  rig.torso.rotation.x = (isRunning ? 0.14 + 0.08 * amp : 0.02) + inclineLean;
  rig.torso.rotation.y = s * 0.08 * amp;
}

function createStadiumLightTower(metalMat: THREE.Material, darkMat: THREE.Material, emissiveMat: THREE.Material): THREE.Group {
  const tower = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.4, 8), darkMat);
  base.position.y = 0.7;
  tower.add(base);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 16, 10), metalMat);
  mast.position.y = 9.0;
  tower.add(mast);

  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 0.45), metalMat);
  crossArm.position.set(0, 17.0, 0.2);
  tower.add(crossArm);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.85, 0.55), darkMat);
  housing.position.set(0, 18.0, 0.35);
  housing.rotation.x = 0.28;
  tower.add(housing);

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.45), emissiveMat);
  panel.position.set(0, 17.95, 0.66);
  panel.rotation.x = 0.28;
  tower.add(panel);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.8 })
  );
  beacon.position.set(0, 19.2, 0.2);
  tower.add(beacon);

  return tower;
}

function buildOvalTrackRibbonGeometry(
  spec: OvalTrackSpec,
  innerOffset: number,
  outerOffset: number,
  segments: number,
  bankAngleRad: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    sampleOvalPoint(spec, frac, 0, p, t);
    // Outward normal on XZ plane for counter-clockwise loop
    n.set(-t.z, 0, t.x).normalize();

    const isCurve = Math.abs(p.x) > spec.straightHalf - 0.1;
    const bankLift = isCurve ? Math.sin(bankAngleRad) * (outerOffset - innerOffset) : 0;

    const ix = p.x + n.x * innerOffset;
    const iz = p.z + n.z * innerOffset;
    const ox = p.x + n.x * outerOffset;
    const oz = p.z + n.z * outerOffset;

    positions.push(ix, 0.02, iz);
    positions.push(ox, 0.02 + bankLift, oz);

    const u = frac * 18;
    uvs.push(u, 0);
    uvs.push(u, 1);

    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Dynamic trail elevation field relative to the runner's current longitudinal position.
 * Responds in real time to accumulated elevationGainMeters (amplifying ridge relief & climb grade)
 * while keeping the runner centered vertically near y = 0 for stable shadow bounds & framing.
 */
function sampleTrailRelativeHeight(
  localZ: number,
  x: number,
  scrollZ: number,
  elevReliefScale: number,
  climbGrade: number
): number {
  const worldZ = localZ - scrollZ;
  const runnerWorldZ = -scrollZ;

  const hillAlong =
    (Math.sin(worldZ * 0.065) * 1.15 + Math.cos(worldZ * 0.029) * 0.72) * elevReliefScale;
  const runnerHillAlong =
    (Math.sin(runnerWorldZ * 0.065) * 1.15 + Math.cos(runnerWorldZ * 0.029) * 0.72) * elevReliefScale;

  const sideDist = Math.max(0, Math.abs(x) - 2.15);
  const sideRise =
    (Math.pow(sideDist, 1.12) * 0.44 +
      Math.sin(x * 0.38 + worldZ * 0.14) * 0.32 +
      Math.cos(x * 0.22 - worldZ * 0.09) * 0.22) *
    elevReliefScale;

  // Progressive uphill slope ahead (-Z rises, +Z drops) proportional to live route grade
  const slopeLift = THREE.MathUtils.clamp(-localZ * climbGrade, -6.5, 16.0);

  return hillAlong - runnerHillAlong + sideRise + slopeLift;
}

/**
 * Dynamic studio floor elevation field around the motorized treadmill.
 * Keeps a flat anchor pad directly beneath the treadmill chassis (zero clipping),
 * then smoothly morphs the surrounding floor mesh into a live elevation ramp & contour field
 * driven by configured inclinePercent (0%..15%) and accumulated elevationGainMeters.
 */
function sampleTreadmillGroundHeight(
  x: number,
  z: number,
  inclineRatio: number,
  elevGainNorm: number,
  scrollPhase: number
): number {
  const padDx = Math.max(0, Math.abs(x) - 1.38);
  const padDz = Math.max(0, Math.abs(z) - 2.25);
  const padDist = Math.hypot(padDx, padDz);
  const padBlend = smoothstep(0, 2.35, padDist);

  if (padBlend <= 0.0001) return 0;

  // Forward incline plane rising along -Z (facing direction of runner)
  const rampSlope = inclineRatio * 2.35 + elevGainNorm * 0.08;
  const directionalRamp = THREE.MathUtils.clamp(-z * rampSlope, -3.6, 8.2);

  // Flowing topographic contour waves synced to belt speed & incline intensity
  const waveAmp = 0.04 + inclineRatio * 3.8 + elevGainNorm * 0.55;
  const contourWave =
    (Math.sin(z * 0.34 - scrollPhase) * 0.42 +
      Math.cos(x * 0.28 + z * 0.19 - scrollPhase * 0.65) * 0.3) *
    waveAmp;

  // Lateral alpine-style studio flanks rising with incline & gained elevation
  const lateralRise =
    Math.max(0, Math.abs(x) - 3.4) * (0.03 + inclineRatio * 1.45 + elevGainNorm * 0.24);

  return (directionalRamp + contourWave + lateralRise) * padBlend;
}

export const ThreeDRunningArena: React.FC<ThreeDRunningArenaProps> = ({
  venue,
  isWorkoutActive,
  isPaused,
  speedKmh,
  distanceMeters,
  ghostDistanceMeters,
  inclinePercent,
  elevationGainMeters,
  onChangeIncline,
  theme = 'dark',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraMode, setCameraMode] = useState<ArenaCameraMode>('chase');
  const [dockExpanded, setDockExpanded] = useState<boolean>(true);
  const [showTopoMesh, setShowTopoMesh] = useState<boolean>(true);
  const [contextLost, setContextLost] = useState<boolean>(false);

  const liveRef = useRef({
    venue,
    isWorkoutActive,
    isPaused,
    speedKmh,
    distanceMeters,
    ghostDistanceMeters,
    inclinePercent,
    elevationGainMeters,
    cameraMode,
    showTopoMesh,
    theme,
  });

  useEffect(() => {
    liveRef.current = {
      venue,
      isWorkoutActive,
      isPaused,
      speedKmh,
      distanceMeters,
      ghostDistanceMeters,
      inclinePercent,
      elevationGainMeters,
      cameraMode,
      showTopoMesh,
      theme,
    };
  }, [
    venue,
    isWorkoutActive,
    isPaused,
    speedKmh,
    distanceMeters,
    ghostDistanceMeters,
    inclinePercent,
    elevationGainMeters,
    cameraMode,
    showTopoMesh,
    theme,
  ]);

  const venueConfig = getRunVenueConfig(venue);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL renderer before creating main renderer
    let isSoftwareGl = false;
    try {
      const probeCanvas = document.createElement('canvas');
      const probeGl =
        (probeCanvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
        (probeCanvas.getContext('webgl') as WebGLRenderingContext | null);
      if (probeGl) {
        const dbg = probeGl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          const rendererStr = String(probeGl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
          isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
        }
      }
    } catch {
      isSoftwareGl = false;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 260);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.72;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 320);
    camera.position.set(0, 4.2, 8.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.minDistance = 2.6;
    controls.maxDistance = 62;
    let userOrbiting = false;
    controls.addEventListener('start', () => {
      userOrbiting = true;
    });

    // Reusable lighting rig
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(22, 34, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 110;
    keyLight.shadow.camera.left = -28;
    keyLight.shadow.camera.right = 28;
    keyLight.shadow.camera.top = 28;
    keyLight.shadow.camera.bottom = -28;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x334155, 0.85);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-18, 14, -22);
    scene.add(rimLight);

    // Arena atmosphere by venue
    const isLightUi = theme === 'light';
    const skyColors: Record<RunVenueType, number> = {
      track_400m: isLightUi ? 0xbae6fd : 0x0b162a,
      track_200m: 0x0f172a,
      treadmill: isLightUi ? 0xdbeafe : 0x0f172a,
      road_city: isLightUi ? 0xfed7aa : 0x0b1326,
      trail: isLightUi ? 0xd9f99d : 0x0e1d1c,
    };
    const fogDensities: Record<RunVenueType, number> = {
      track_400m: 0.0055,
      track_200m: 0.008,
      treadmill: 0.018,
      road_city: 0.011,
      trail: 0.014,
    };

    const bgHex = skyColors[venue];
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, fogDensities[venue]);

    if (venue === 'trail') {
      keyLight.color.setHex(0xffdfa8);
      keyLight.intensity = 2.4;
      hemiLight.color.setHex(0xa7f3d0);
      hemiLight.groundColor.setHex(0x3f2e21);
    } else if (venue === 'treadmill') {
      keyLight.color.setHex(0xffffff);
      keyLight.intensity = 1.9;
      hemiLight.color.setHex(0x7dd3fc);
      hemiLight.groundColor.setHex(0x1e293b);
    } else if (venue === 'road_city') {
      keyLight.color.setHex(0xffd7a8);
      keyLight.intensity = 2.1;
      hemiLight.color.setHex(0x60a5fa);
      hemiLight.groundColor.setHex(0x1e293b);
    }

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const disposables: Array<{ dispose: () => void }> = [];
    const trackDisposable = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    const shadowTex = trackDisposable(createContactShadowTexture());
    const mainRunner = createRunnerRig(shadowTex, {
      jerseyHex: venue === 'track_400m' ? 0xe11d48 : venue === 'trail' ? 0x10b981 : 0x0ea5e9,
      accentHex: 0xf59e0b,
    });
    scene.add(mainRunner.root);

    let ghostRunner: RunnerRig | null = null;
    if (venue !== 'treadmill') {
      ghostRunner = createRunnerRig(shadowTex, { isGhost: true });
      scene.add(ghostRunner.root);
    }

    // Venue-specific references updated in loop
    let trackSpec: OvalTrackSpec | null = null;
    let treadmillBeltTex: THREE.CanvasTexture | null = null;
    let treadmillDeckPivot: THREE.Group | null = null;
    let treadmillGroundGeom: THREE.BufferGeometry | null = null;
    let treadmillBaseXZ: Float32Array | null = null;
    let treadmillGroundWireMesh: THREE.Mesh | null = null;
    let treadmillGroundWireMat: THREE.MeshBasicMaterial | null = null;
    let treadmillActuators: THREE.Mesh[] = [];
    let treadmillWallLightMat: THREE.MeshStandardMaterial | null = null;

    let roadTex: THREE.CanvasTexture | null = null;
    let roadBuildingsInst: THREE.InstancedMesh | null = null;
    let roadLampPostsInst: THREE.InstancedMesh | null = null;
    let roadLampHeadsInst: THREE.InstancedMesh | null = null;
    let roadItemSeeds: Array<{ x: number; z: number; h: number; w: number; d: number }> = [];
    let roadLampZ: number[] = [];

    let trailTreesTrunkInst: THREE.InstancedMesh | null = null;
    let trailTreesCrownInst: THREE.InstancedMesh | null = null;
    let trailTreesTopInst: THREE.InstancedMesh | null = null;
    let trailRocksInst: THREE.InstancedMesh | null = null;
    let trailTreeSeeds: Array<{ x: number; z: number; s: number }> = [];
    let trailRockSeeds: Array<{ x: number; z: number; s: number; rot: number }> = [];
    let trailGroundMesh: THREE.Mesh | null = null;
    let trailGroundGeom: THREE.BufferGeometry | null = null;
    let trailBaseXZ: Float32Array | null = null;
    let trailGroundWireMesh: THREE.Mesh | null = null;
    let trailGroundWireMat: THREE.MeshBasicMaterial | null = null;

    // ---------------------------------------------------------
    // BUILD VENUE 1 & 2: 400M OLYMPIC TRACK OR 200M INDOOR TRACK
    // ---------------------------------------------------------
    if (venue === 'track_400m' || venue === 'track_200m') {
      const is400 = venue === 'track_400m';
      trackSpec = is400
        ? { straightHalf: 22, curveRadius: 12.5, totalPerimeter: 400 }
        : { straightHalf: 11.5, curveRadius: 7.2, totalPerimeter: 200 };

      const trackWidth = is400 ? 6.4 : 4.6;
      const laneCount = is400 ? 8 : 6;
      const bankRad = is400 ? 0 : 0.17;

      // Exterior stadium ground apron
      const apronMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: is400 ? 0x1e293b : 0x172033, roughness: 0.9, metalness: 0.05 })
      );
      const apron = new THREE.Mesh(trackDisposable(new THREE.CircleGeometry(110, 48)), apronMat);
      apron.rotation.x = -Math.PI / 2;
      apron.position.y = -0.05;
      apron.receiveShadow = true;
      scene.add(apron);

      // Tartan Track Ribbon
      const trackTex = trackDisposable(
        createTrackCanvasTexture(
          laneCount,
          is400 ? '#b9382c' : '#1d5f8a',
          is400 ? 'rgba(255,255,255,0.06)' : 'rgba(56,189,248,0.09)'
        )
      );
      trackTex.anisotropy = maxAniso;
      const trackGeom = trackDisposable(buildOvalTrackRibbonGeometry(trackSpec, 0, trackWidth, 128, bankRad));
      const trackMat = trackDisposable(
        new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.82, metalness: 0.04 })
      );
      const trackMesh = new THREE.Mesh(trackGeom, trackMat);
      trackMesh.receiveShadow = true;
      scene.add(trackMesh);

      // Start / Finish Line across bottom straight
      const finishMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.05 })
      );
      const finishLine = new THREE.Mesh(
        trackDisposable(new THREE.BoxGeometry(0.42, 0.04, trackWidth)),
        finishMat
      );
      finishLine.position.set(0, 0.04, trackSpec.curveRadius + trackWidth / 2);
      scene.add(finishLine);

      // Inner turf / infield
      const infieldShape = new THREE.Shape();
      infieldShape.absarc(trackSpec.straightHalf, 0, trackSpec.curveRadius - 0.15, -Math.PI / 2, Math.PI / 2, false);
      infieldShape.absarc(-trackSpec.straightHalf, 0, trackSpec.curveRadius - 0.15, Math.PI / 2, (3 * Math.PI) / 2, false);
      const infieldGeom = trackDisposable(new THREE.ShapeGeometry(infieldShape, 36));
      infieldGeom.rotateX(-Math.PI / 2);
      const turfTex = trackDisposable(createTurfTexture());
      turfTex.wrapS = THREE.RepeatWrapping;
      turfTex.wrapT = THREE.RepeatWrapping;
      turfTex.repeat.set(0.05, 0.05);
      turfTex.anisotropy = maxAniso;

      const infieldMat = trackDisposable(
        new THREE.MeshStandardMaterial({
          map: is400 ? turfTex : undefined,
          color: is400 ? 0xffffff : 0x1e3a5f,
          roughness: 0.92,
          metalness: 0.02,
        })
      );
      const infieldMesh = new THREE.Mesh(infieldGeom, infieldMat);
      infieldMesh.position.y = 0.01;
      infieldMesh.receiveShadow = true;
      scene.add(infieldMesh);

      // Stadium stands along both straights (composite tiered steps)
      const concreteMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.08 })
      );
      const seatMat = trackDisposable(
        new THREE.MeshStandardMaterial({
          color: is400 ? 0x0284c7 : 0xe11d48,
          roughness: 0.52,
          metalness: 0.15,
        })
      );
      const standLen = trackSpec.straightHalf * 1.9;
      const standZ = trackSpec.curveRadius + trackWidth + 3.2;
      [-1, 1].forEach((side) => {
        const standGroup = new THREE.Group();
        for (let tier = 0; tier < 4; tier++) {
          const step = new THREE.Mesh(
            trackDisposable(new THREE.BoxGeometry(standLen, 0.85, 1.35)),
            tier % 2 === 0 ? concreteMat : seatMat
          );
          step.position.set(0, 0.45 + tier * 0.85, side * (standZ + tier * 1.25));
          step.castShadow = !isSoftwareGl;
          step.receiveShadow = true;
          standGroup.add(step);
        }
        scene.add(standGroup);
      });

      const steelMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.34, metalness: 0.78 })
      );
      const darkSteelMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.55 })
      );
      const lightEmissiveMat = trackDisposable(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xfff7ed,
          emissiveIntensity: 2.2,
          roughness: 0.2,
        })
      );

      if (is400) {
        // 4 Stadium Floodlight Towers at corners
        const towerCoords: Array<[number, number]> = [
          [-trackSpec.straightHalf - 10, -trackSpec.curveRadius - 10],
          [trackSpec.straightHalf + 10, -trackSpec.curveRadius - 10],
          [-trackSpec.straightHalf - 10, trackSpec.curveRadius + 10],
          [trackSpec.straightHalf + 10, trackSpec.curveRadius + 10],
        ];
        towerCoords.forEach(([tx, tz]) => {
          const tower = createStadiumLightTower(steelMat, darkSteelMat, lightEmissiveMat);
          tower.position.set(tx, 0, tz);
          tower.lookAt(0, 0, 0);
          scene.add(tower);
        });
      } else {
        // 200m Indoor Arena overhead steel arch trusses + LED bars
        const spanZ = trackSpec.curveRadius + trackWidth + 8;
        for (let i = -2; i <= 2; i++) {
          const xPos = i * 8.5;
          const archGroup = new THREE.Group();
          const leftPillar = new THREE.Mesh(trackDisposable(new THREE.BoxGeometry(0.6, 11.5, 0.6)), steelMat);
          leftPillar.position.set(xPos, 5.75, -spanZ);
          const rightPillar = new THREE.Mesh(trackDisposable(new THREE.BoxGeometry(0.6, 11.5, 0.6)), steelMat);
          rightPillar.position.set(xPos, 5.75, spanZ);
          const roofBeam = new THREE.Mesh(
            trackDisposable(new THREE.BoxGeometry(0.65, 0.7, spanZ * 2 + 1)),
            darkSteelMat
          );
          roofBeam.position.set(xPos, 11.5, 0);
          const ledStrip = new THREE.Mesh(
            trackDisposable(new THREE.BoxGeometry(0.32, 0.16, spanZ * 1.4)),
            lightEmissiveMat
          );
          ledStrip.position.set(xPos, 11.08, 0);
          archGroup.add(leftPillar, rightPillar, roofBeam, ledStrip);
          scene.add(archGroup);
        }
      }
    }

    // ---------------------------------------------------------
    // BUILD VENUE 3: STUDIO MOTORIZED TREADMILL (ESTEIRA)
    // ---------------------------------------------------------
    if (venue === 'treadmill') {
      // Dynamic segmented studio elevation floor mesh (responds to inclinePercent & elevationGainMeters)
      const floorSegs = 40;
      const dynamicFloorGeom = trackDisposable(new THREE.PlaneGeometry(42, 42, floorSegs, floorSegs));
      dynamicFloorGeom.rotateX(-Math.PI / 2);
      const floorPosAttr = dynamicFloorGeom.attributes.position as THREE.BufferAttribute;
      treadmillBaseXZ = new Float32Array(floorPosAttr.count * 2);
      const floorColors = new Float32Array(floorPosAttr.count * 3);
      for (let i = 0; i < floorPosAttr.count; i++) {
        treadmillBaseXZ[i * 2] = floorPosAttr.getX(i);
        treadmillBaseXZ[i * 2 + 1] = floorPosAttr.getZ(i);
        floorColors[i * 3] = 0.11;
        floorColors[i * 3 + 1] = 0.14;
        floorColors[i * 3 + 2] = 0.19;
      }
      dynamicFloorGeom.setAttribute('color', new THREE.BufferAttribute(floorColors, 3));
      treadmillGroundGeom = dynamicFloorGeom;

      const gymFloorMat = trackDisposable(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.78,
          metalness: 0.12,
        })
      );
      const gymFloor = new THREE.Mesh(dynamicFloorGeom, gymFloorMat);
      gymFloor.receiveShadow = true;
      scene.add(gymFloor);

      // Paired topographic contour wireframe sharing the dynamic floor BufferGeometry
      treadmillGroundWireMat = trackDisposable(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      treadmillGroundWireMesh = new THREE.Mesh(dynamicFloorGeom, treadmillGroundWireMat);
      treadmillGroundWireMesh.position.y = 0.015;
      scene.add(treadmillGroundWireMesh);

      // Subtle architectural backdrop walls (pushed behind dynamic horizon slope)
      const wallMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0x131b29, roughness: 0.88, metalness: 0.06 })
      );
      const backWall = new THREE.Mesh(trackDisposable(new THREE.PlaneGeometry(46, 18)), wallMat);
      backWall.position.set(0, 8.5, -18.5);
      scene.add(backWall);

      treadmillWallLightMat = trackDisposable(
        new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          emissive: 0x06b6d4,
          emissiveIntensity: 1.4,
          roughness: 0.25,
        })
      );
      const wallLightBar = new THREE.Mesh(
        trackDisposable(new THREE.BoxGeometry(12, 0.14, 0.1)),
        treadmillWallLightMat
      );
      wallLightBar.position.set(0, 4.2, -18.2);
      scene.add(wallLightBar);

      // Rubber protection mat under treadmill
      const matMesh = new THREE.Mesh(
        trackDisposable(new THREE.BoxGeometry(2.1, 0.03, 3.8)),
        trackDisposable(new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.94, metalness: 0.02 }))
      );
      matMesh.position.set(0, 0.015, 0);
      matMesh.receiveShadow = true;
      scene.add(matMesh);

      // Treadmill base frame (static on floor)
      const chassisMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.62 })
      );
      const chromeMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.2, metalness: 0.88 })
      );
      const darkRubberMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.88, metalness: 0.06 })
      );

      const baseFrame = new THREE.Mesh(trackDisposable(new THREE.BoxGeometry(1.36, 0.14, 2.75)), chassisMat);
      baseFrame.position.set(0, 0.1, 0.05);
      baseFrame.castShadow = !isSoftwareGl;
      scene.add(baseFrame);

      // Telescoping hydraulic incline actuators beneath front of treadmill deck
      const actuatorGeom = trackDisposable(new THREE.CylinderGeometry(0.055, 0.068, 1, 12));
      treadmillActuators = [-0.46, 0.46].map((ax) => {
        const piston = new THREE.Mesh(actuatorGeom, chromeMat);
        piston.position.set(ax, 0.14, -1.05);
        piston.scale.set(1, 0.12, 1);
        scene.add(piston);
        return piston;
      });

      // Tilting Deck Pivot at rear roller (z = +1.35)
      treadmillDeckPivot = new THREE.Group();
      treadmillDeckPivot.position.set(0, 0.22, 1.32);
      scene.add(treadmillDeckPivot);

      // Deck structural bed
      const deckBed = new THREE.Mesh(trackDisposable(new THREE.BoxGeometry(1.32, 0.14, 2.65)), chassisMat);
      deckBed.position.set(0, 0, -1.32);
      deckBed.castShadow = !isSoftwareGl;
      deckBed.receiveShadow = true;
      treadmillDeckPivot.add(deckBed);

      // Brushed metal side footrails
      [-0.62, 0.62].forEach((xRail) => {
        const rail = new THREE.Mesh(trackDisposable(new THREE.BoxGeometry(0.14, 0.18, 2.58)), chromeMat);
        rail.position.set(xRail, 0.03, -1.32);
        treadmillDeckPivot!.add(rail);
      });

      // Scrolling Running Belt
      treadmillBeltTex = trackDisposable(createTreadmillBeltTexture());
      treadmillBeltTex.anisotropy = maxAniso;
      const beltMat = trackDisposable(
        new THREE.MeshStandardMaterial({ map: treadmillBeltTex, roughness: 0.86, metalness: 0.04 })
      );
      const beltMesh = new THREE.Mesh(trackDisposable(new THREE.PlaneGeometry(1.06, 2.48)), beltMat);
      beltMesh.rotation.x = -Math.PI / 2;
      beltMesh.position.set(0, 0.082, -1.32);
      beltMesh.receiveShadow = true;
      treadmillDeckPivot.add(beltMesh);

      // Motor hood at front of deck
      const hood = new THREE.Mesh(trackDisposable(new THREE.BoxGeometry(1.34, 0.26, 0.48)), darkRubberMat);
      hood.position.set(0, 0.14, -2.55);
      hood.castShadow = !isSoftwareGl;
      treadmillDeckPivot.add(hood);

      // Twin upright console columns
      [-0.58, 0.58].forEach((xCol) => {
        const col = new THREE.Mesh(trackDisposable(new THREE.BoxGeometry(0.11, 1.48, 0.14)), chassisMat);
        col.position.set(xCol, 0.82, -2.35);
        col.rotation.x = 0.14;
        col.castShadow = !isSoftwareGl;
        treadmillDeckPivot!.add(col);

        // Ergonomic side handlebars
        const grip = new THREE.Mesh(trackDisposable(new THREE.CylinderGeometry(0.032, 0.032, 0.72, 10)), chromeMat);
        grip.rotation.x = Math.PI / 2;
        grip.position.set(xCol, 1.12, -1.98);
        treadmillDeckPivot!.add(grip);
      });

      // Telemetry LED Console
      const consoleBody = new THREE.Mesh(trackDisposable(new THREE.BoxGeometry(1.34, 0.42, 0.26)), darkRubberMat);
      consoleBody.position.set(0, 1.56, -2.24);
      consoleBody.rotation.x = -0.45;
      treadmillDeckPivot.add(consoleBody);

      const consoleScreen = new THREE.Mesh(
        trackDisposable(new THREE.PlaneGeometry(0.96, 0.26)),
        trackDisposable(
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            emissive: 0x06b6d4,
            emissiveIntensity: 0.9,
            roughness: 0.15,
            metalness: 0.3,
          })
        )
      );
      consoleScreen.position.set(0, 1.59, -2.1);
      consoleScreen.rotation.x = -0.45;
      treadmillDeckPivot.add(consoleScreen);

      // Reparent runner onto the tilting deck so incline raises the athlete naturally
      scene.remove(mainRunner.root);
      treadmillDeckPivot.add(mainRunner.root);
      mainRunner.root.position.set(0, 0.085, -1.28);
      mainRunner.root.rotation.y = Math.PI; // Facing front console (-Z)
    }

    // ---------------------------------------------------------
    // BUILD VENUE 4: URBAN ROAD / CITY BOULEVARD
    // ---------------------------------------------------------
    if (venue === 'road_city') {
      roadTex = trackDisposable(createRoadAsphaltTexture());
      roadTex.anisotropy = maxAniso;
      const roadMesh = new THREE.Mesh(
        trackDisposable(new THREE.PlaneGeometry(11, 180)),
        trackDisposable(new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.86, metalness: 0.05 }))
      );
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(0, 0, -40);
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      // Raised sidewalks on left and right
      const sidewalkMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, metalness: 0.05 })
      );
      [-7.8, 7.8].forEach((sx) => {
        const walk = new THREE.Mesh(trackDisposable(new THREE.BoxGeometry(4.6, 0.24, 180)), sidewalkMat);
        walk.position.set(sx, 0.12, -40);
        walk.receiveShadow = true;
        scene.add(walk);
      });

      // InstancedMesh urban buildings
      const buildingCount = 36;
      const facadeTex = trackDisposable(createBuildingFacadeTexture());
      facadeTex.anisotropy = maxAniso;
      const buildingMat = trackDisposable(
        new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.55, metalness: 0.25 })
      );
      roadBuildingsInst = new THREE.InstancedMesh(
        trackDisposable(new THREE.BoxGeometry(1, 1, 1)),
        buildingMat,
        buildingCount
      );
      roadBuildingsInst.castShadow = !isSoftwareGl;
      roadBuildingsInst.receiveShadow = true;
      roadItemSeeds = [];
      for (let i = 0; i < buildingCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const row = Math.floor(i / 2);
        const w = 5.5 + ((i * 7) % 5);
        const d = 6.5 + ((i * 11) % 5);
        const h = 8 + ((i * 17) % 22);
        roadItemSeeds.push({
          x: side * (13.8 + w * 0.5),
          z: -120 + row * 10,
          w,
          h,
          d,
        });
      }
      scene.add(roadBuildingsInst);

      // InstancedMesh streetlamps
      const lampCount = 24;
      const postMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.78 })
      );
      const lampGlowMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xf59e0b, emissiveIntensity: 1.8 })
      );
      roadLampPostsInst = new THREE.InstancedMesh(
        trackDisposable(new THREE.CylinderGeometry(0.08, 0.11, 5.8, 8)),
        postMat,
        lampCount
      );
      roadLampHeadsInst = new THREE.InstancedMesh(
        trackDisposable(new THREE.SphereGeometry(0.24, 10, 8)),
        lampGlowMat,
        lampCount
      );
      roadLampZ = [];
      for (let i = 0; i < lampCount; i++) {
        roadLampZ.push(-115 + Math.floor(i / 2) * 14);
      }
      scene.add(roadLampPostsInst, roadLampHeadsInst);

      mainRunner.root.position.set(-1.6, 0, 0);
      mainRunner.root.rotation.y = Math.PI; // Running toward -Z
    }

    // ---------------------------------------------------------
    // BUILD VENUE 5: MOUNTAIN & FOREST TRAIL
    // ---------------------------------------------------------
    if (venue === 'trail') {
      const segX = 36;
      const segZ = 60;
      const terrainGeom = trackDisposable(new THREE.PlaneGeometry(58, 126, segX, segZ));
      terrainGeom.rotateX(-Math.PI / 2);

      const posAttr = terrainGeom.attributes.position as THREE.BufferAttribute;
      trailBaseXZ = new Float32Array(posAttr.count * 2);
      const colors = new Float32Array(posAttr.count * 3);
      const col = new THREE.Color();

      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        // Shift base localZ so terrain spans from +35 behind runner to -91 ahead
        const z = posAttr.getZ(i) - 28;
        posAttr.setZ(i, z);
        trailBaseXZ[i * 2] = x;
        trailBaseXZ[i * 2 + 1] = z;

        const y = sampleTrailRelativeHeight(z, x, 0, 1.0, 0.03);
        posAttr.setY(i, y);

        if (Math.abs(x) < 2.2) {
          col.setHex(0x8d6342);
        } else if (Math.abs(x) < 5.2) {
          col.setHex(0x3f6d3f);
        } else if (y > 4.2) {
          col.setHex(0x525d69);
        } else {
          col.setHex(0x2d5333);
        }
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
      terrainGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      terrainGeom.computeVertexNormals();
      trailGroundGeom = terrainGeom;

      const terrainMat = trackDisposable(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 })
      );
      trailGroundMesh = new THREE.Mesh(terrainGeom, terrainMat);
      trailGroundMesh.receiveShadow = true;
      scene.add(trailGroundMesh);

      // Subtle dynamic topographic contour mesh sharing terrainGeom
      trailGroundWireMat = trackDisposable(
        new THREE.MeshBasicMaterial({
          color: 0x34d399,
          wireframe: true,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      trailGroundWireMesh = new THREE.Mesh(terrainGeom, trailGroundWireMat);
      trailGroundWireMesh.position.y = 0.025;
      scene.add(trailGroundWireMesh);

      // Instanced composite pine trees (trunk + 2 foliage cones)
      const treeCount = 64;
      const trunkMat = trackDisposable(new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.92 }));
      const foliageLowMat = trackDisposable(new THREE.MeshStandardMaterial({ color: 0x165032, roughness: 0.85 }));
      const foliageHighMat = trackDisposable(new THREE.MeshStandardMaterial({ color: 0x1e6b43, roughness: 0.82 }));

      trailTreesTrunkInst = new THREE.InstancedMesh(
        trackDisposable(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 7)),
        trunkMat,
        treeCount
      );
      trailTreesCrownInst = new THREE.InstancedMesh(
        trackDisposable(new THREE.ConeGeometry(1.45, 3.6, 8)),
        foliageLowMat,
        treeCount
      );
      trailTreesTopInst = new THREE.InstancedMesh(
        trackDisposable(new THREE.ConeGeometry(1.02, 2.8, 8)),
        foliageHighMat,
        treeCount
      );
      trailTreesTrunkInst.frustumCulled = false;
      trailTreesCrownInst.frustumCulled = false;
      trailTreesTopInst.frustumCulled = false;

      trailTreeSeeds = [];
      for (let i = 0; i < treeCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const distFromPath = 3.8 + ((i * 19) % 16);
        trailTreeSeeds.push({
          x: side * distFromPath,
          z: -86 + i * 2.1,
          s: 0.78 + ((i * 13) % 10) * 0.065,
        });
      }
      scene.add(trailTreesTrunkInst, trailTreesCrownInst, trailTreesTopInst);

      // Instanced trailside granite rocks
      const rockCount = 28;
      const rockMat = trackDisposable(
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.08 })
      );
      trailRocksInst = new THREE.InstancedMesh(
        trackDisposable(new THREE.DodecahedronGeometry(0.65, 0)),
        rockMat,
        rockCount
      );
      trailRocksInst.frustumCulled = false;
      trailRockSeeds = [];
      for (let i = 0; i < rockCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        trailRockSeeds.push({
          x: side * (2.6 + ((i * 7) % 6)),
          z: -82 + i * 4.4,
          s: 0.55 + ((i * 5) % 8) * 0.12,
          rot: (i * 1.1) % (Math.PI * 2),
        });
      }
      scene.add(trailRocksInst);

      mainRunner.root.rotation.y = Math.PI;
    }

    // Pre-allocated scratch math objects (zero per-frame heap allocations)
    const _runnerPos = new THREE.Vector3();
    const _runnerTan = new THREE.Vector3();
    const _ghostPos = new THREE.Vector3();
    const _ghostTan = new THREE.Vector3();
    const _camDesired = new THREE.Vector3();
    const _lookDesired = new THREE.Vector3();
    const _dummy = new THREE.Object3D();
    const _tmpColor = new THREE.Color();
    const _colorLow = new THREE.Color();
    const _colorMid = new THREE.Color();
    const _colorHigh = new THREE.Color();

    let stridePhase = 0;
    let visualDistance = liveRef.current.distanceMeters;
    let dampedElevationGain = liveRef.current.elevationGainMeters;
    let dampedInclinePercent = liveRef.current.inclinePercent;
    let treadmillWavePhase = 0;
    let lastTimeMs = performance.now();
    let disposed = false;
    let rafId = 0;
    let timerId = 0;

    // Software WebGL fence-synced pacing helper
    const gl = renderer.getContext();
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      if (!isSoftwareGl) {
        rafId = window.requestAnimationFrame(cb);
        return;
      }
      if (isWebGL2) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl.flush();
          const poll = () => {
            if (disposed) {
              gl.deleteSync(sync);
              return;
            }
            const status = gl.clientWaitSync(sync, 0, 0);
            if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
              gl.deleteSync(sync);
              timerId = window.setTimeout(cb, 80);
            } else {
              timerId = window.setTimeout(poll, 16);
            }
          };
          poll();
          return;
        }
      }
      timerId = window.setTimeout(cb, 80);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTimeMs) / 1000, 0.08);
      lastTimeMs = now;

      const st = liveRef.current;
      const isActivelyRunning = st.isWorkoutActive && !st.isPaused;
      // In pre-run preview mode, run a gentle athletic demo cruise so the 3D scene feels alive immediately
      const effectiveSpeedKmh = isActivelyRunning
        ? Math.max(st.speedKmh, 4.5)
        : st.isPaused
          ? 0
          : 7.2;
      const speedMs = effectiveSpeedKmh / 3.6;

      if (isActivelyRunning) {
        // Smoothly interpolate toward live GPS/workout distance while preserving responsiveness
        visualDistance += speedMs * dt;
        const deltaDist = st.distanceMeters - visualDistance;
        if (Math.abs(deltaDist) > 18) {
          visualDistance = st.distanceMeters;
        } else {
          visualDistance += deltaDist * (1 - Math.exp(-4 * dt));
        }
      } else if (!st.isPaused) {
        visualDistance += speedMs * dt * 0.55;
      }

      const cadenceRadPerSec = isActivelyRunning ? 4.5 + effectiveSpeedKmh * 0.55 : st.isPaused ? 0 : 6.4;
      stridePhase += dt * cadenceRadPerSec;

      // Smoothly damp live elevation gain & treadmill incline for fluid ground mesh deformation
      dampedElevationGain = THREE.MathUtils.damp(dampedElevationGain, st.elevationGainMeters, 3.2, dt);
      dampedInclinePercent = THREE.MathUtils.damp(dampedInclinePercent, st.inclinePercent, 5.2, dt);

      const runnerLeanBonus =
        venue === 'treadmill'
          ? (dampedInclinePercent / 15) * 0.18
          : venue === 'trail'
            ? THREE.MathUtils.clamp((dampedElevationGain / 180) * 0.16, 0, 0.18)
            : 0;

      animateRunnerStride(mainRunner, stridePhase, effectiveSpeedKmh, effectiveSpeedKmh > 0.3, runnerLeanBonus);
      if (ghostRunner) {
        animateRunnerStride(ghostRunner, stridePhase + 1.1, Math.max(effectiveSpeedKmh, 9), !st.isPaused, runnerLeanBonus * 0.7);
      }

      // -----------------------------------------------
      // UPDATE ENVIRONMENT & CAMERA TARGET BY VENUE
      // -----------------------------------------------
      if ((venue === 'track_400m' || venue === 'track_200m') && trackSpec) {
        const lapLen = trackSpec.totalPerimeter;
        const frac = (visualDistance % lapLen) / lapLen;
        const laneOffset = venue === 'track_400m' ? 1.85 : 1.35;
        sampleOvalPoint(trackSpec, frac, laneOffset, _runnerPos, _runnerTan);

        mainRunner.root.position.copy(_runnerPos);
        mainRunner.root.rotation.y = Math.atan2(_runnerTan.x, _runnerTan.z);

        if (ghostRunner) {
          const ghostDist = visualDistance - st.ghostDistanceMeters;
          const gFrac = (((ghostDist % lapLen) + lapLen) % lapLen) / lapLen;
          sampleOvalPoint(trackSpec, gFrac, laneOffset + 1.15, _ghostPos, _ghostTan);
          ghostRunner.root.position.copy(_ghostPos);
          ghostRunner.root.rotation.y = Math.atan2(_ghostTan.x, _ghostTan.z);
        }

        if (st.cameraMode === 'chase') {
          _camDesired.set(
            _runnerPos.x - _runnerTan.x * 6.5,
            3.4,
            _runnerPos.z - _runnerTan.z * 6.5
          );
          _lookDesired.set(_runnerPos.x + _runnerTan.x * 4, 1.3, _runnerPos.z + _runnerTan.z * 4);
        } else if (st.cameraMode === 'aerial') {
          _camDesired.set(0, venue === 'track_400m' ? 36 : 24, venue === 'track_400m' ? 32 : 21);
          _lookDesired.set(0, 0.5, 0);
        } else {
          // Lateral broadcast tracking
          _camDesired.set(
            _runnerPos.x - _runnerTan.z * 7.2,
            2.3,
            _runnerPos.z + _runnerTan.x * 7.2
          );
          _lookDesired.set(_runnerPos.x, 1.25, _runnerPos.z);
        }
      } else if (venue === 'treadmill' && treadmillDeckPivot && treadmillBeltTex) {
        // Scroll belt texture synced to speed
        treadmillBeltTex.offset.y -= speedMs * dt * 0.72;
        treadmillWavePhase += speedMs * dt * 0.9;

        // Smoothly tilt deck to match damped inclinePercent (0%..15%)
        const inclineRatio = dampedInclinePercent / 100;
        const targetPitch = -Math.atan(inclineRatio) * 1.25;
        treadmillDeckPivot.rotation.x = THREE.MathUtils.damp(treadmillDeckPivot.rotation.x, targetPitch, 6.5, dt);

        // Extend telescoping front hydraulic actuators to meet the lifted deck
        const frontLiftHeight = Math.max(0.12, 0.12 + Math.sin(-treadmillDeckPivot.rotation.x) * 2.35);
        for (let i = 0; i < treadmillActuators.length; i++) {
          const piston = treadmillActuators[i];
          piston.scale.set(1, frontLiftHeight, 1);
          piston.position.y = 0.08 + frontLiftHeight * 0.5;
        }

        // Dynamically deform the studio elevation ground mesh based on inclinePercent & elevationGainMeters
        if (treadmillGroundGeom && treadmillBaseXZ) {
          const posAttr = treadmillGroundGeom.attributes.position as THREE.BufferAttribute;
          const colorAttr = treadmillGroundGeom.attributes.color as THREE.BufferAttribute;
          const elevGainNorm = THREE.MathUtils.clamp(dampedElevationGain / 120, 0, 1.4);

          _colorLow.setHex(0x161f2e);
          _colorMid.setHex(dampedInclinePercent >= 7 ? 0xb45309 : 0x0e5a73);
          _colorHigh.setHex(dampedInclinePercent >= 10 ? 0xea580c : 0x10b981);

          for (let i = 0; i < posAttr.count; i++) {
            const bx = treadmillBaseXZ[i * 2];
            const bz = treadmillBaseXZ[i * 2 + 1];
            const y = sampleTreadmillGroundHeight(bx, bz, inclineRatio, elevGainNorm, treadmillWavePhase);
            posAttr.setY(i, y);

            const hNorm = THREE.MathUtils.clamp((y + 0.35) / 3.8, 0, 1);
            if (hNorm < 0.5) {
              _tmpColor.copy(_colorLow).lerp(_colorMid, hNorm * 2);
            } else {
              _tmpColor.copy(_colorMid).lerp(_colorHigh, (hNorm - 0.5) * 2);
            }
            colorAttr.setXYZ(i, _tmpColor.r, _tmpColor.g, _tmpColor.b);
          }
          posAttr.needsUpdate = true;
          colorAttr.needsUpdate = true;
          treadmillGroundGeom.computeVertexNormals();
        }

        if (treadmillGroundWireMesh && treadmillGroundWireMat) {
          treadmillGroundWireMesh.visible = st.showTopoMesh;
          const wireHue = THREE.MathUtils.clamp(dampedInclinePercent / 15, 0, 1);
          _colorLow.setHex(0x38bdf8);
          _colorHigh.setHex(0xf97316);
          treadmillGroundWireMat.color.copy(_colorLow).lerp(_colorHigh, wireHue);
          treadmillGroundWireMat.opacity = 0.14 + wireHue * 0.24;
        }

        if (treadmillWallLightMat) {
          const glowHue = THREE.MathUtils.clamp(dampedInclinePercent / 15, 0, 1);
          _colorLow.setHex(0x06b6d4);
          _colorHigh.setHex(0xf59e0b);
          treadmillWallLightMat.color.copy(_colorLow).lerp(_colorHigh, glowHue);
          treadmillWallLightMat.emissive.copy(treadmillWallLightMat.color);
        }

        if (st.cameraMode === 'chase') {
          _camDesired.set(2.1, 2.5 + inclineRatio * 1.4, 3.6);
          _lookDesired.set(0, 1.15 + inclineRatio * 1.1, -0.45);
        } else if (st.cameraMode === 'aerial') {
          _camDesired.set(3.4, 5.2 + inclineRatio * 1.8, 3.2);
          _lookDesired.set(0, 0.9, -0.6);
        } else {
          _camDesired.set(4.5, 1.85 + inclineRatio * 0.9, 0.2);
          _lookDesired.set(0, 1.15 + inclineRatio * 0.7, -0.25);
        }
      } else if (venue === 'road_city' && roadTex && roadBuildingsInst && roadLampPostsInst && roadLampHeadsInst) {
        roadTex.offset.y += speedMs * dt * 0.11;

        const spanZ = 180;
        const shiftZ = visualDistance % spanZ;

        for (let i = 0; i < roadItemSeeds.length; i++) {
          const b = roadItemSeeds[i];
          let z = b.z + shiftZ;
          while (z > 32) z -= spanZ;
          _dummy.position.set(b.x, b.h * 0.5, z);
          _dummy.scale.set(b.w, b.h, b.d);
          _dummy.rotation.set(0, 0, 0);
          _dummy.updateMatrix();
          roadBuildingsInst.setMatrixAt(i, _dummy.matrix);
        }
        roadBuildingsInst.instanceMatrix.needsUpdate = true;

        const lampSpan = 168;
        const lampShift = visualDistance % lampSpan;
        for (let i = 0; i < roadLampZ.length; i++) {
          const side = i % 2 === 0 ? -6.0 : 6.0;
          let z = roadLampZ[i] + lampShift;
          while (z > 32) z -= lampSpan;
          _dummy.position.set(side, 2.9, z);
          _dummy.scale.set(1, 1, 1);
          _dummy.rotation.set(0, 0, 0);
          _dummy.updateMatrix();
          roadLampPostsInst.setMatrixAt(i, _dummy.matrix);

          _dummy.position.set(side * 0.92, 5.85, z);
          _dummy.updateMatrix();
          roadLampHeadsInst.setMatrixAt(i, _dummy.matrix);
        }
        roadLampPostsInst.instanceMatrix.needsUpdate = true;
        roadLampHeadsInst.instanceMatrix.needsUpdate = true;

        if (ghostRunner) {
          const ghostZ = THREE.MathUtils.clamp(-st.ghostDistanceMeters * 0.22, -26, 14);
          ghostRunner.root.position.set(1.4, 0, ghostZ);
          ghostRunner.root.rotation.y = Math.PI;
        }

        if (st.cameraMode === 'chase') {
          _camDesired.set(-1.3, 3.2, 6.2);
          _lookDesired.set(-0.6, 1.35, -14);
        } else if (st.cameraMode === 'aerial') {
          _camDesired.set(0, 14.5, 11.5);
          _lookDesired.set(0, 0.5, -14);
        } else {
          _camDesired.set(5.4, 2.35, 1.2);
          _lookDesired.set(-1.2, 1.2, -3.5);
        }
      } else if (
        venue === 'trail' &&
        trailTreesTrunkInst &&
        trailTreesCrownInst &&
        trailTreesTopInst &&
        trailRocksInst
      ) {
        const loopZ = 124;
        const scrollZ = visualDistance % loopZ;

        // Elevation gain dynamically amplifies ridge relief & climbs the forward terrain grade
        const elevReliefScale = 1.0 + THREE.MathUtils.clamp(dampedElevationGain / 85, 0, 1.45);
        const liveWaveGrade = Math.max(0, Math.sin(visualDistance * 0.025)) * 0.055;
        const climbGrade = THREE.MathUtils.clamp(
          0.02 + (dampedElevationGain / 190) * 0.145 + liveWaveGrade,
          0.02,
          0.22
        );

        // Dynamically deform the entire trail terrain mesh + topographic altitude vertex colors
        if (trailGroundGeom && trailBaseXZ) {
          const posAttr = trailGroundGeom.attributes.position as THREE.BufferAttribute;
          const colorAttr = trailGroundGeom.attributes.color as THREE.BufferAttribute;
          const altBoost = THREE.MathUtils.clamp(dampedElevationGain / 160, 0, 1);

          for (let i = 0; i < posAttr.count; i++) {
            const bx = trailBaseXZ[i * 2];
            const bz = trailBaseXZ[i * 2 + 1];
            const y = sampleTrailRelativeHeight(bz, bx, scrollZ, elevReliefScale, climbGrade);
            posAttr.setY(i, y);

            const absX = Math.abs(bx);
            if (absX < 2.15) {
              // Dirt singletrack shifts warmer toward rocky highland terracotta as elevation rises
              _colorLow.setHex(0x8d6342);
              _colorHigh.setHex(0xa8643e);
              _tmpColor.copy(_colorLow).lerp(_colorHigh, altBoost);
            } else if (absX < 5.0) {
              _colorLow.setHex(0x3f6d3f);
              _colorHigh.setHex(0x6c7a49);
              _tmpColor.copy(_colorLow).lerp(_colorHigh, THREE.MathUtils.clamp(y / 9, 0, 1));
            } else if (y > 9.2) {
              // High alpine snow-dusted granite peaks on steep climbs
              _colorLow.setHex(0x7c8a99);
              _colorHigh.setHex(0xdbe4ee);
              _tmpColor.copy(_colorLow).lerp(_colorHigh, THREE.MathUtils.clamp((y - 9.2) / 5.5, 0, 1));
            } else if (y > 4.0) {
              // Granite mountain face
              _colorLow.setHex(0x3d5c3b);
              _colorHigh.setHex(0x5f6b78);
              _tmpColor.copy(_colorLow).lerp(_colorHigh, THREE.MathUtils.clamp((y - 4.0) / 5.2, 0, 1));
            } else {
              _tmpColor.setHex(0x2d5333);
            }
            colorAttr.setXYZ(i, _tmpColor.r, _tmpColor.g, _tmpColor.b);
          }
          posAttr.needsUpdate = true;
          colorAttr.needsUpdate = true;
          trailGroundGeom.computeVertexNormals();
        }

        if (trailGroundWireMesh && trailGroundWireMat) {
          trailGroundWireMesh.visible = st.showTopoMesh;
          const elevHue = THREE.MathUtils.clamp(dampedElevationGain / 150, 0, 1);
          _colorLow.setHex(0x34d399);
          _colorHigh.setHex(0xfbbf24);
          trailGroundWireMat.color.copy(_colorLow).lerp(_colorHigh, elevHue);
          trailGroundWireMat.opacity = 0.08 + elevHue * 0.16;
        }

        const runnerY = sampleTrailRelativeHeight(0, 0, scrollZ, elevReliefScale, climbGrade);
        const aheadY = sampleTrailRelativeHeight(-2.5, 0, scrollZ, elevReliefScale, climbGrade);
        const slopePitch = Math.atan2(aheadY - runnerY, 2.5);

        mainRunner.root.position.set(0, runnerY, 0);
        mainRunner.root.rotation.x = THREE.MathUtils.clamp(-slopePitch * 0.55, -0.32, 0.32);

        for (let i = 0; i < trailTreeSeeds.length; i++) {
          const t = trailTreeSeeds[i];
          let z = t.z + scrollZ;
          while (z > 32) z -= loopZ;
          const groundY = sampleTrailRelativeHeight(z, t.x, scrollZ, elevReliefScale, climbGrade);
          _dummy.rotation.set(0, 0, 0);

          _dummy.position.set(t.x, groundY + 1.0 * t.s, z);
          _dummy.scale.set(t.s, t.s, t.s);
          _dummy.updateMatrix();
          trailTreesTrunkInst.setMatrixAt(i, _dummy.matrix);

          _dummy.position.set(t.x, groundY + 3.2 * t.s, z);
          _dummy.updateMatrix();
          trailTreesCrownInst.setMatrixAt(i, _dummy.matrix);

          _dummy.position.set(t.x, groundY + 5.1 * t.s, z);
          _dummy.updateMatrix();
          trailTreesTopInst.setMatrixAt(i, _dummy.matrix);
        }
        trailTreesTrunkInst.instanceMatrix.needsUpdate = true;
        trailTreesCrownInst.instanceMatrix.needsUpdate = true;
        trailTreesTopInst.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < trailRockSeeds.length; i++) {
          const r = trailRockSeeds[i];
          let z = r.z + scrollZ;
          while (z > 32) z -= loopZ;
          const groundY = sampleTrailRelativeHeight(z, r.x, scrollZ, elevReliefScale, climbGrade);
          _dummy.position.set(r.x, groundY + 0.35 * r.s, z);
          _dummy.scale.set(r.s * 1.2, r.s * 0.8, r.s);
          _dummy.rotation.set(0.2, r.rot, 0.15);
          _dummy.updateMatrix();
          trailRocksInst.setMatrixAt(i, _dummy.matrix);
        }
        trailRocksInst.instanceMatrix.needsUpdate = true;

        if (ghostRunner) {
          const gZ = THREE.MathUtils.clamp(-st.ghostDistanceMeters * 0.2, -22, 12);
          const gY = sampleTrailRelativeHeight(gZ, 1.2, scrollZ, elevReliefScale, climbGrade);
          ghostRunner.root.position.set(1.2, gY, gZ);
          ghostRunner.root.rotation.y = Math.PI;
        }

        const aheadLookY = sampleTrailRelativeHeight(-10, 0, scrollZ, elevReliefScale, climbGrade);
        if (st.cameraMode === 'chase') {
          _camDesired.set(0.5, runnerY + 3.1, 6.2);
          _lookDesired.set(0, aheadLookY * 0.55 + 1.35, -10);
        } else if (st.cameraMode === 'aerial') {
          _camDesired.set(0, runnerY + 14.2, 12.0);
          _lookDesired.set(0, aheadLookY * 0.45 + 0.6, -12);
        } else {
          _camDesired.set(5.8, runnerY + 2.4, 1.4);
          _lookDesired.set(0, runnerY + 1.2 + climbGrade * 3.5, -3.5);
        }
      }

      if (!userOrbiting) {
        const damp = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(_camDesired, damp);
        controls.target.lerp(_lookDesired, damp);
      }
      controls.update();

      renderer.render(scene, camera);
      afterDraw(tick);
    };

    tick();

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      for (const entry of entries) {
        const w = Math.max(Math.floor(entry.contentRect.width), 320);
        const h = Math.max(Math.floor(entry.contentRect.height), 260);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
      disposables.forEach((d) => d.dispose());
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [venue, theme]);

  const lapLen = venueConfig.lapLengthMeters;
  const currentLap = lapLen ? Math.floor(distanceMeters / lapLen) + 1 : null;
  const lapProgressM = lapLen ? Math.round(distanceMeters % lapLen) : null;
  const isLight = theme === 'light';

  return (
    <div
      className={`relative w-full h-full rounded-3xl overflow-hidden border select-none ${
        isLight ? 'border-slate-300 bg-slate-900' : 'border-slate-800 bg-slate-950'
      }`}
    >
      {/* Dedicated Isolated WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Graceful WebGL Context Loss Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950 text-slate-200 p-6 text-center">
          <p className="text-sm font-bold uppercase tracking-wide">Reiniciando motor gráfico 3D...</p>
          <p className="text-xs text-slate-400 mt-1">A telemetria do seu treino continua ativa em segundo plano.</p>
        </div>
      )}

      {/* Compact Top-Left Venue & Live Lap/Elevation Readout (Solid high-contrast surface, zero backdrop-filter over WebGL) */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5 max-w-[78%]">
        <div className="bg-slate-950/90 border border-slate-700/80 text-white px-3 py-2 rounded-xl shadow-md">
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
            <span>CENA 3D INTERATIVA</span>
            <span className="text-slate-500">·</span>
            <span className="text-white">{venueConfig.label}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-[11px] font-mono tabular-nums text-slate-300">
            <span>{speedKmh.toFixed(1)} km/h</span>
            <span className="text-slate-600">·</span>
            <span>{(distanceMeters / 1000).toFixed(2)} km</span>
            {lapLen && currentLap !== null && lapProgressM !== null && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-300 font-bold">
                  Volta {currentLap} ({lapProgressM}m/{lapLen}m)
                </span>
              </>
            )}
            {venue === 'treadmill' && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-300 font-bold">Inclinação {inclinePercent.toFixed(1)}%</span>
                <span className="text-slate-600">·</span>
                <span className="text-cyan-300 font-bold">+{Math.round(elevationGainMeters)}m</span>
              </>
            )}
            {venue === 'trail' && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <Mountain className="w-3 h-3" /> +{Math.round(elevationGainMeters)}m
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-amber-300 font-bold">
                  Relevo {(1 + Math.min(1.45, elevationGainMeters / 85)).toFixed(1)}x
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (Solid surface, no backdrop-filter over WebGL) */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-slate-950/92 border border-slate-700/90 rounded-2xl px-2.5 py-2 text-white shadow-lg flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDockExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wide text-slate-200 hover:text-cyan-300 px-1.5 py-1 rounded-lg cursor-pointer transition"
            title="Expandir ou recolher controles 3D"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Controles 3D</span>
            {dockExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {dockExpanded && (
            <>
              <div className="h-4 w-px bg-slate-700 hidden sm:block" />

              {/* 3 Camera Presets */}
              <div className="flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-slate-400 mr-0.5 hidden sm:block" />
                {(
                  [
                    { id: 'chase', label: 'Perseguição' },
                    { id: 'aerial', label: 'Aérea' },
                    { id: 'side', label: 'Lateral' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraMode(cam.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                      cameraMode === cam.id
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              {/* Dynamic Topographic Mesh Toggle (Trail & Treadmill) */}
              {(venue === 'trail' || venue === 'treadmill') && (
                <>
                  <div className="h-4 w-px bg-slate-700 hidden sm:block" />
                  <button
                    type="button"
                    onClick={() => setShowTopoMesh((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      showTopoMesh
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                    title="Alternar sobreposição de malha topográfica dinâmica"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Malha Topo</span>
                  </button>
                </>
              )}

              {/* Live Incline Control for Treadmill */}
              {venue === 'treadmill' && onChangeIncline && (
                <>
                  <div className="h-4 w-px bg-slate-700 hidden sm:block" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase text-amber-300 font-bold">Inclinação</span>
                    <button
                      type="button"
                      onClick={() => onChangeIncline(Math.max(0, Number((inclinePercent - 0.5).toFixed(1))))}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer"
                      aria-label="Diminuir inclinação"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-mono font-black tabular-nums min-w-[40px] text-center">
                      {inclinePercent.toFixed(1)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => onChangeIncline(Math.min(15, Number((inclinePercent + 0.5).toFixed(1))))}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer"
                      aria-label="Aumentar inclinação"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Reset camera orbit button */}
        <button
          type="button"
          onClick={() => setCameraMode((prev) => (prev === 'chase' ? 'aerial' : 'chase'))}
          className="pointer-events-auto bg-slate-950/92 border border-slate-700/90 hover:border-cyan-400 text-slate-200 hover:text-cyan-300 p-2 rounded-xl shadow-lg transition cursor-pointer"
          title="Alternar ângulo rápido"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
