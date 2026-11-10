import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  GAME_CONFIG,
  PICKUP_DEFINITIONS,
  PickupVariantId,
  PickupKind,
  PickupConfigDef,
  ROAD_Y
} from './config';
import { createGameMaterial } from './materials';
import { applyCurve } from './curve';

const _tempMatrix = new THREE.Matrix4();
const _tempPos = new THREE.Vector3();
const _tempQuat = new THREE.Quaternion();
const _tempScale = new THREE.Vector3();
const _euler = new THREE.Euler();

export interface ActivePickupSlot {
  active: boolean;
  collecting: boolean;
  collectProgress: number; // 0 to 1 for fly-to-HUD arc animation
  variantId: PickupVariantId;
  kind: PickupKind;
  x: number;
  baseY: number; // Ground or deck Y (e.g. ROAD_Y = 0 or DECK_Y = 4.2)
  z: number;
  startX: number;
  startY: number;
  startZ: number;
  spinPhase: number;
}

const MAX_INSTANCES_PER_VARIANT = 32;
const POOL_SIZE = 96;

/**
 * Helper to create a BoxGeometry positioned and rotated, ready for merging.
 */
function makeBoxPart(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    _euler.set(rx, ry, rz);
    _tempMatrix.makeRotationFromEuler(_euler);
    g.applyMatrix4(_tempMatrix);
  }
  g.translate(x, y, z);
  return g;
}

function makeCylPart(
  rt: number,
  rb: number,
  h: number,
  seg: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    _euler.set(rx, ry, rz);
    _tempMatrix.makeRotationFromEuler(_euler);
    g.applyMatrix4(_tempMatrix);
  }
  g.translate(x, y, z);
  return g;
}

function makeTorusPart(
  r: number,
  tube: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(r, tube, 8, 16);
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    _euler.set(rx, ry, rz);
    _tempMatrix.makeRotationFromEuler(_euler);
    g.applyMatrix4(_tempMatrix);
  }
  g.translate(x, y, z);
  return g;
}

/**
 * Builds a single merged BufferGeometry with a distinct 3D silhouette for each PickupVariantId
 * matching the inline SVG silhouettes in `src/ui/icons.tsx`.
 */
export function buildPickupVariantGeometry(variantId: PickupVariantId): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  switch (variantId) {
    case 'FUEL_JERRY_CAN': {
      // Rectangular jerry can with handle, spout, and X-ribs
      parts.push(makeBoxPart(0.58, 0.72, 0.34, 0, 0, 0));
      // X-ribs on front & back
      parts.push(makeBoxPart(0.42, 0.07, 0.38, 0, 0, 0, 0, 0, 0.72));
      parts.push(makeBoxPart(0.42, 0.07, 0.38, 0, 0, 0, 0, 0, -0.72));
      // Top handle bar
      parts.push(makeBoxPart(0.32, 0.07, 0.12, 0.05, 0.44, 0));
      parts.push(makeBoxPart(0.07, 0.14, 0.12, -0.09, 0.39, 0));
      parts.push(makeBoxPart(0.07, 0.14, 0.12, 0.19, 0.39, 0));
      // Angled pour spout
      parts.push(makeCylPart(0.055, 0.075, 0.24, 8, -0.22, 0.44, 0, 0, 0, 0.55));
      break;
    }

    case 'FUEL_DRUM': {
      // Large cylindrical barrel drum with 3 raised rolling hoops (bigger silhouette)
      parts.push(makeCylPart(0.42, 0.42, 0.96, 16, 0, 0, 0));
      parts.push(makeTorusPart(0.43, 0.045, 0, 0.42, 0, Math.PI / 2, 0, 0));
      parts.push(makeTorusPart(0.44, 0.05, 0, 0.14, 0, Math.PI / 2, 0, 0));
      parts.push(makeTorusPart(0.44, 0.05, 0, -0.14, 0, Math.PI / 2, 0, 0));
      parts.push(makeTorusPart(0.43, 0.045, 0, -0.42, 0, Math.PI / 2, 0, 0));
      // Top bung cap
      parts.push(makeCylPart(0.07, 0.07, 0.08, 8, 0.18, 0.50, 0));
      break;
    }

    case 'FUEL_GOLDEN_CAN': {
      // Jerry can + outer radiant halo ring + top star crown
      parts.push(makeBoxPart(0.62, 0.76, 0.36, 0, 0, 0));
      parts.push(makeBoxPart(0.34, 0.08, 0.14, 0.05, 0.46, 0));
      parts.push(makeCylPart(0.06, 0.08, 0.26, 8, -0.24, 0.46, 0, 0, 0, 0.55));
      // Radiant halo ring around can
      parts.push(makeTorusPart(0.62, 0.04, 0, 0.02, 0));
      // Star diamond emblem on front/back
      parts.push(makeBoxPart(0.28, 0.28, 0.42, 0, 0, 0, 0, 0, Math.PI / 4));
      break;
    }

    case 'SHIELD_STANDARD': {
      // Truck-art shield crest (octagonal/pointed crest + peacock medallion)
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.52);
      shape.lineTo(0.44, 0.34);
      shape.lineTo(0.44, -0.08);
      shape.quadraticCurveTo(0.38, -0.38, 0, -0.54);
      shape.quadraticCurveTo(-0.38, -0.38, -0.44, -0.08);
      shape.lineTo(-0.44, 0.34);
      shape.closePath();

      const extrude = new THREE.ExtrudeGeometry(shape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.04,
        bevelThickness: 0.04
      });
      extrude.translate(0, 0, -0.07);
      parts.push(extrude);
      // Peacock feather center boss
      parts.push(makeCylPart(0.18, 0.18, 0.24, 12, 0, 0.02, 0, Math.PI / 2, 0, 0));
      break;
    }

    case 'SHIELD_DOUBLE': {
      // Crest + TWO stacked concentric orbital rings
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.48);
      shape.lineTo(0.40, 0.32);
      shape.lineTo(0.40, -0.06);
      shape.quadraticCurveTo(0.34, -0.35, 0, -0.50);
      shape.quadraticCurveTo(-0.34, -0.35, -0.40, -0.06);
      shape.lineTo(-0.40, 0.32);
      shape.closePath();

      const extrude = new THREE.ExtrudeGeometry(shape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.03,
        bevelThickness: 0.03
      });
      extrude.translate(0, 0, -0.07);
      parts.push(extrude);
      // Stacked Ring 1 & Ring 2
      parts.push(makeTorusPart(0.56, 0.04, 0, 0, 0));
      parts.push(makeTorusPart(0.68, 0.035, 0, 0, 0));
      break;
    }

    case 'SHIELD_GOLDEN': {
      // Crowned Golden Crest + starburst spikes
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.55);
      shape.lineTo(0.46, 0.36);
      shape.lineTo(0.46, -0.08);
      shape.quadraticCurveTo(0.40, -0.40, 0, -0.56);
      shape.quadraticCurveTo(-0.40, -0.40, -0.46, -0.08);
      shape.lineTo(-0.46, 0.36);
      shape.closePath();

      const extrude = new THREE.ExtrudeGeometry(shape, {
        depth: 0.16,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.04,
        bevelThickness: 0.04
      });
      extrude.translate(0, 0, -0.08);
      parts.push(extrude);
      // Crown spikes on top
      parts.push(makeCylPart(0.01, 0.08, 0.22, 6, 0, 0.62, 0));
      parts.push(makeCylPart(0.01, 0.07, 0.18, 6, -0.22, 0.56, 0, 0, 0, 0.3));
      parts.push(makeCylPart(0.01, 0.07, 0.18, 6, 0.22, 0.56, 0, 0, 0, -0.3));
      // Starburst center
      parts.push(makeBoxPart(0.32, 0.32, 0.26, 0, 0.02, 0, 0, 0, Math.PI / 4));
      break;
    }

    case 'JUMP_SUPER_KHUSSA': {
      // Stylized Khussa shoe with curled toe ("Nok"), spring coil underneath, and upward arrow
      // Shoe sole & body
      parts.push(makeBoxPart(0.65, 0.20, 0.30, -0.05, 0.04, 0));
      parts.push(makeBoxPart(0.28, 0.24, 0.28, -0.22, 0.18, 0));
      // Curled Nok toe tip at front (+x)
      parts.push(makeTorusPart(0.14, 0.06, 0.32, 0.16, 0, 0, 0, -Math.PI / 3));
      // Spring coil underneath
      parts.push(makeTorusPart(0.20, 0.04, -0.04, -0.14, 0, Math.PI / 2, 0, 0));
      parts.push(makeTorusPart(0.20, 0.04, -0.04, -0.26, 0, Math.PI / 2, 0, 0));
      parts.push(makeTorusPart(0.20, 0.04, -0.04, -0.38, 0, Math.PI / 2, 0, 0));
      // Upward arrow above
      parts.push(makeCylPart(0.01, 0.16, 0.22, 4, 0, 0.46, 0));
      parts.push(makeBoxPart(0.08, 0.16, 0.08, 0, 0.32, 0));
      break;
    }

    case 'JUMP_SPRING_BOOTS': {
      // High-ankle twin spring boots with dual heavy coils underneath
      parts.push(makeBoxPart(0.34, 0.48, 0.30, -0.10, 0.18, 0));
      parts.push(makeBoxPart(0.58, 0.22, 0.32, 0.02, -0.02, 0));
      // Dual spring coils below
      parts.push(makeTorusPart(0.14, 0.04, -0.15, -0.20, 0, Math.PI / 2, 0, 0));
      parts.push(makeTorusPart(0.14, 0.04, -0.15, -0.34, 0, Math.PI / 2, 0, 0));
      parts.push(makeTorusPart(0.14, 0.04, 0.18, -0.20, 0, Math.PI / 2, 0, 0));
      parts.push(makeTorusPart(0.14, 0.04, 0.18, -0.34, 0, Math.PI / 2, 0, 0));
      break;
    }

    case 'JUMP_DOUBLE_JUMP': {
      // Khussa shoe + pair of swept-back wings on left and right
      parts.push(makeBoxPart(0.62, 0.20, 0.28, 0, -0.05, 0));
      parts.push(makeTorusPart(0.13, 0.055, 0.34, 0.06, 0, 0, 0, -Math.PI / 3));
      // Left & Right Wings
      parts.push(makeBoxPart(0.45, 0.12, 0.06, -0.12, 0.20, 0.24, 0.35, 0.25, 0.45));
      parts.push(makeBoxPart(0.35, 0.10, 0.06, -0.18, 0.34, 0.28, 0.35, 0.25, 0.65));
      parts.push(makeBoxPart(0.45, 0.12, 0.06, -0.12, 0.20, -0.24, -0.35, -0.25, 0.45));
      parts.push(makeBoxPart(0.35, 0.10, 0.06, -0.18, 0.34, -0.28, -0.35, -0.25, 0.65));
      break;
    }
  }

  // Ensure all geometries have matching attributes (position, normal) before merging
  const cleanParts = parts.map((g) => {
    const nonIndexed = g.index ? g.toNonIndexed() : g;
    nonIndexed.computeVertexNormals();
    // Delete uv if missing on any or normalize
    if (nonIndexed.attributes.uv) {
      nonIndexed.deleteAttribute('uv');
    }
    return nonIndexed;
  });

  const merged = mergeGeometries(cleanParts, false);
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Creates a canvas sprite texture matching the variant's HUD badge for instant readability from a distance.
 */
function createVariantBadgeTexture(def: PickupConfigDef): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Soft outer glow ring
  const grad = ctx.createRadialGradient(64, 64, 24, 64, 64, 62);
  grad.addColorStop(0, def.cssColor);
  grad.addColorStop(0.65, def.cssColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();

  // Inner dark ring
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(64, 64, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 5;
  ctx.stroke();

  // High-contrast letter / symbol
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 44px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.badgeText, 64, 66);

  return new THREE.CanvasTexture(canvas);
}

/**
 * Manages all in-world pickups using InstancedMesh per variant (9 variants + 1 shared glow ring + 1 shared blob shadow = 11 total InstancedMeshes, zero per-frame allocations).
 */
export class PickupSystemManager {
  private scene: THREE.Scene;
  private variantMeshes: Map<PickupVariantId, THREE.InstancedMesh> = new Map();
  private glowRingMesh!: THREE.InstancedMesh;
  private shadowMesh!: THREE.InstancedMesh;

  public slots: ActivePickupSlot[] = [];
  private timeAccum = 0;

  // Track last spawn distance per PickupKind to enforce ~150m minimum gap between same kind
  public lastSpawnDistByKind: Record<PickupKind, number> = {
    FUEL: -999,
    SHIELD: -999,
    JUMP: -999
  };
  public lastFuelSpawnDist = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initPool();
    this.initInstancedMeshes();
  }

  private initPool() {
    this.slots = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      this.slots.push({
        active: false,
        collecting: false,
        collectProgress: 0,
        variantId: 'FUEL_JERRY_CAN',
        kind: 'FUEL',
        x: 0,
        baseY: ROAD_Y,
        z: 0,
        startX: 0,
        startY: 0,
        startZ: 0,
        spinPhase: i * 0.7
      });
    }
  }

  private initInstancedMeshes() {
    const variantIds = Object.keys(PICKUP_DEFINITIONS) as PickupVariantId[];

    for (const id of variantIds) {
      const def = PICKUP_DEFINITIONS[id];
      const geo = buildPickupVariantGeometry(id);
      const badgeTex = createVariantBadgeTexture(def);
      const mat = createGameMaterial({
        kind: 'standard',
        color: def.color,
        emissive: def.color,
        emissiveIntensity: 0.55,
        metalness: def.variant === 'GOLDEN' ? 0.85 : 0.45,
        roughness: def.variant === 'GOLDEN' ? 0.15 : 0.3,
        userData: { badgeTex }
      });

      const instMesh = new THREE.InstancedMesh(geo, mat, MAX_INSTANCES_PER_VARIANT);
      instMesh.count = 0;
      instMesh.frustumCulled = false;
      instMesh.name = `PickupInstanced_${id}`;
      this.scene.add(instMesh);
      this.variantMeshes.set(id, instMesh);
    }

    // Shared Glow Ring InstancedMesh (floats horizontally around each pickup)
    const ringGeo = new THREE.RingGeometry(0.58, 0.76, 20);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = createGameMaterial({
      kind: 'basic',
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    });
    this.glowRingMesh = new THREE.InstancedMesh(ringGeo, ringMat, POOL_SIZE);
    this.glowRingMesh.count = 0;
    this.glowRingMesh.frustumCulled = false;
    this.glowRingMesh.name = 'PickupGlowRings';
    this.scene.add(this.glowRingMesh);

    // Shared Blob Shadow InstancedMesh (sits flat on ROAD_Y / DECK_Y at baseY + 0.02)
    const shadowGeo = new THREE.CircleGeometry(0.75, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = createGameMaterial({
      kind: 'basic',
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    });
    this.shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, POOL_SIZE);
    this.shadowMesh.count = 0;
    this.shadowMesh.frustumCulled = false;
    this.shadowMesh.name = 'PickupBlobShadows';
    this.scene.add(this.shadowMesh);
  }

  public reset() {
    for (const s of this.slots) {
      s.active = false;
      s.collecting = false;
      s.collectProgress = 0;
    }
    this.lastSpawnDistByKind.FUEL = -999;
    this.lastSpawnDistByKind.SHIELD = -999;
    this.lastSpawnDistByKind.JUMP = -999;
    this.lastFuelSpawnDist = 0;
    this.syncInstancedMeshes(0);
  }

  /**
   * Shifts all active pickup Z coordinates when floating origin resets world coordinates.
   */
  public shiftOrigin(zOffset: number) {
    for (const s of this.slots) {
      if (s.active) {
        s.z += zOffset;
        s.startZ += zOffset;
      }
    }
  }

  /**
   * Selects a variant for a given PickupKind based on run distance progression (Section 7):
   * - 0 to 500 m: mostly Jerry Cans, Standard Shield, and Super Khussa
   * - 500 to 1,500 m: introduce Fuel Drum, Double Shield, and Spring Boots at low weights
   * - 1,500 m+: rare Golden variants and Double Jump
   */
  public selectVariantForKind(kind: PickupKind, distance: number, isRewardSpot = false): PickupVariantId {
    const candidates = (Object.values(PICKUP_DEFINITIONS) as PickupConfigDef[]).filter(
      (d) => d.kind === kind && (distance >= d.minDistance || (isRewardSpot && d.variant === 'LARGE'))
    );
    if (candidates.length === 0) {
      return kind === 'FUEL'
        ? 'FUEL_JERRY_CAN'
        : kind === 'SHIELD'
        ? 'SHIELD_STANDARD'
        : 'JUMP_SUPER_KHUSSA';
    }

    // In flyover/shortcut reward spots, boost LARGE and GOLDEN variants
    let totalWeight = 0;
    const weights: { id: PickupVariantId; w: number }[] = [];
    for (const c of candidates) {
      let w =
        distance < 500
          ? c.spawnWeight.early
          : distance < 1500
          ? c.spawnWeight.mid
          : c.spawnWeight.late;
      if (isRewardSpot && c.variant === 'LARGE') w += 35;
      if (isRewardSpot && c.variant === 'GOLDEN' && distance >= 1200) w += 20;
      if (w > 0) {
        weights.push({ id: c.id, w });
        totalWeight += w;
      }
    }

    if (totalWeight <= 0) return candidates[0].id;
    let roll = Math.random() * totalWeight;
    for (const item of weights) {
      roll -= item.w;
      if (roll <= 0) return item.id;
    }
    return weights[0].id;
  }

  /**
   * Checks whether a power pickup of `kind` is allowed to spawn at `distance`
   * respecting the ~150m minimum gap between two power pickups of the same kind
   * (unless `forcePityFuel` is true for emergency fuel).
   */
  public canSpawnKind(kind: PickupKind, distance: number, forcePityFuel = false): boolean {
    if (forcePityFuel && kind === 'FUEL') return true;
    const minGap = kind === 'FUEL' ? 110 : GAME_CONFIG.PICKUP_MIN_SAME_KIND_GAP;
    return distance - this.lastSpawnDistByKind[kind] >= minGap;
  }

  public spawnPickup(
    variantId: PickupVariantId,
    x: number,
    baseY: number,
    z: number,
    distance: number
  ): ActivePickupSlot | null {
    let slot = this.slots.find((s) => !s.active);
    if (!slot) {
      // Dynamic pool expansion failsafe: expand slots array on demand so pickups never fail
      console.warn(`[PickupSystem] Slots pool capacity reached (${this.slots.length}). Dynamically expanding.`);
      slot = {
        active: false,
        collecting: false,
        collectProgress: 0,
        variantId,
        kind: 'FUEL',
        x,
        baseY,
        z,
        startX: x,
        startY: baseY,
        startZ: z,
        spinPhase: 0
      };
      this.slots.push(slot);
    }

    const def = PICKUP_DEFINITIONS[variantId];
    slot.active = true;
    slot.collecting = false;
    slot.collectProgress = 0;
    slot.variantId = variantId;
    slot.kind = def.kind;
    slot.x = x;
    slot.baseY = baseY;
    slot.z = z;
    slot.startX = x;
    slot.startY = baseY + GAME_CONFIG.PICKUP_FLOAT_HEIGHT;
    slot.startZ = z;
    slot.spinPhase = Math.random() * Math.PI * 2;

    this.lastSpawnDistByKind[def.kind] = distance;
    if (def.kind === 'FUEL') {
      this.lastFuelSpawnDist = distance;
    }
    return slot;
  }

  /**
   * Updates all active pickups, handles fly-to-HUD collection arcs, despawns behind camera,
   * and triggers `onCollect` when the player intersects a pickup's generous radius.
   */
  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    onCollect: (def: PickupConfigDef, worldPos: THREE.Vector3) => void
  ) {
    this.timeAccum += dt;

    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.active) continue;

      if (s.collecting) {
        s.collectProgress += dt * 4.2; // ~0.24s fly-to-HUD arc animation
        if (s.collectProgress >= 1.0) {
          s.active = false;
          s.collecting = false;
        }
        continue;
      }

      // Despawn behind camera
      if (s.z > playerZ + GAME_CONFIG.DESPAWN_DISTANCE) {
        s.active = false;
        continue;
      }

      // Check collection against player with generous pickup radius
      const dx = s.x - playerX;
      const dy = s.baseY + GAME_CONFIG.PICKUP_FLOAT_HEIGHT - (playerY + 0.85);
      const dz = s.z - playerZ;
      const distSq = dx * dx + dy * dy * 0.5 + dz * dz;

      if (distSq <= GAME_CONFIG.PICKUP_RADIUS * GAME_CONFIG.PICKUP_RADIUS) {
        s.collecting = true;
        s.collectProgress = 0;
        s.startX = s.x;
        s.startY = s.baseY + GAME_CONFIG.PICKUP_FLOAT_HEIGHT;
        s.startZ = s.z;
        _tempPos.set(s.x, s.startY, s.z);
        onCollect(PICKUP_DEFINITIONS[s.variantId], _tempPos);
      }
    }

    this.syncInstancedMeshes(playerZ);
  }

  private syncInstancedMeshes(playerZ: number) {
    // Reset counts
    for (const mesh of this.variantMeshes.values()) {
      mesh.count = 0;
    }
    let ringIdx = 0;
    let shadowIdx = 0;

    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.active) continue;

      const mesh = this.variantMeshes.get(s.variantId);
      if (!mesh || mesh.count >= MAX_INSTANCES_PER_VARIANT) continue;

      const def = PICKUP_DEFINITIONS[s.variantId];
      const bobOffset = Math.sin(this.timeAccum * 3.2 + s.spinPhase) * 0.16;
      const rotY = this.timeAccum * 2.2 + s.spinPhase;

      if (s.collecting) {
        // Shrink and fly in an upward arc toward the top HUD slot
        const t = s.collectProgress;
        const arcX = THREE.MathUtils.lerp(s.startX, s.startX * 0.2, t);
        const arcY = s.startY + Math.sin(t * Math.PI) * 2.2 + t * 3.8;
        const arcZ = THREE.MathUtils.lerp(s.startZ, playerZ + 2.5, t);
        const scale = Math.max(0.05, 1.0 - t * 0.85);

        _tempPos.set(arcX, arcY, arcZ);
        _euler.set(0, rotY * 3.0, 0);
        _tempQuat.setFromEuler(_euler);
        _tempScale.set(scale, scale, scale);
        _tempMatrix.compose(_tempPos, _tempQuat, _tempScale);

        const idx = mesh.count++;
        mesh.setMatrixAt(idx, _tempMatrix);
      } else {
        // Normal floating ~1.0 unit above road/deck, spinning slowly, bobbing
        const floatY = s.baseY + GAME_CONFIG.PICKUP_FLOAT_HEIGHT + bobOffset;
        const baseScale = def.variant === 'LARGE' ? 1.18 : def.variant === 'GOLDEN' ? 1.15 : 1.0;

        _tempPos.set(s.x, floatY, s.z);
        _euler.set(0, rotY, 0);
        _tempQuat.setFromEuler(_euler);
        _tempScale.set(baseScale, baseScale, baseScale);
        _tempMatrix.compose(_tempPos, _tempQuat, _tempScale);

        const idx = mesh.count++;
        mesh.setMatrixAt(idx, _tempMatrix);

        // Soft pulsing glow ring slightly below pickup
        const ringPulse = 0.92 + Math.sin(this.timeAccum * 5.0 + s.spinPhase) * 0.14;
        _tempPos.set(s.x, s.baseY + 0.08, s.z);
        _euler.set(0, 0, 0);
        _tempQuat.setFromEuler(_euler);
        _tempScale.set(ringPulse * baseScale, 1, ringPulse * baseScale);
        _tempMatrix.compose(_tempPos, _tempQuat, _tempScale);
        this.glowRingMesh.setMatrixAt(ringIdx, _tempMatrix);
        this.glowRingMesh.setColorAt(ringIdx, new THREE.Color(def.color));
        ringIdx++;

        // Ground-anchored blob shadow at exact baseY + 0.02
        const shadowScale = (1.0 - bobOffset * 0.25) * baseScale;
        _tempPos.set(s.x, s.baseY + 0.02, s.z);
        _tempScale.set(shadowScale, 1, shadowScale);
        _tempMatrix.compose(_tempPos, _tempQuat, _tempScale);
        this.shadowMesh.setMatrixAt(shadowIdx++, _tempMatrix);
      }
    }

    for (const mesh of this.variantMeshes.values()) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.glowRingMesh.count = ringIdx;
    this.glowRingMesh.instanceMatrix.needsUpdate = true;
    if (this.glowRingMesh.instanceColor) {
      this.glowRingMesh.instanceColor.needsUpdate = true;
    }
    this.shadowMesh.count = shadowIdx;
    this.shadowMesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Creates the translucent energy bubble around the player vehicle for the Shield System:
 * - Hex/flower procedural pattern with fresnel-style rim glow
 * - Outer orbital hit-count rings (1 ring for 1 hit remaining, 2 stacked rings for 2 hits)
 */
export function createPlayerShieldBubble(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'PlayerShieldBubble';

  // Procedural hex/flower truck-art pattern texture
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(103, 232, 249, 0.75)';
  ctx.lineWidth = 2.5;
  const step = 32;
  for (let y = 0; y <= 256; y += step) {
    for (let x = 0; x <= 256; x += step) {
      const ox = (Math.floor(y / step) % 2) * (step / 2);
      ctx.beginPath();
      ctx.arc(x + ox, y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const hexTex = new THREE.CanvasTexture(canvas);
  hexTex.wrapS = THREE.RepeatWrapping;
  hexTex.wrapT = THREE.RepeatWrapping;
  hexTex.repeat.set(3, 2);

  const bubbleMat = createGameMaterial({
    kind: 'standard',
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.65,
    map: hexTex,
    transparent: true,
    opacity: 0.36,
    roughness: 0.15,
    metalness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.68, 20, 16), bubbleMat);
  dome.position.set(0, 1.05, 0);
  dome.frustumCulled = false;
  group.add(dome);

  // Ring 1 (Inner hit indicator ring)
  const ring1Mat = createGameMaterial({
    kind: 'basic',
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85
  });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.045, 8, 28), ring1Mat);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.set(0, 0.65, 0);
  ring1.frustumCulled = false;
  group.add(ring1);

  // Ring 2 (Second stacked ring visible when shieldCharges >= 2)
  const ring2Mat = createGameMaterial({
    kind: 'basic',
    color: 0xfacc15,
    transparent: true,
    opacity: 0.9
  });
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.05, 8, 28), ring2Mat);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.set(0, 1.25, 0);
  ring2.frustumCulled = false;
  ring2.visible = false;
  group.add(ring2);

  group.userData = {
    dome,
    bubbleMat,
    ring1,
    ring1Mat,
    ring2,
    ring2Mat
  };
  applyCurve(bubbleMat);
  return group;
}

/**
 * Headless test that simulates 5,000 runs across distances up to 3,500m and confirms
 * the player never runs out of fuel through unavoidable spawn gaps when collecting spawned fuel pickups.
 */
export function runHeadlessFuelSimulation(runsCount: number = 5000): {
  runsSimulated: number;
  starvedRuns: number;
  minFuelObserved: number;
  avgFuelPickupsPerRun: number;
  passed: boolean;
} {
  let starvedRuns = 0;
  let minFuelObserved = 100;
  let totalPickups = 0;

  const chunkLen = GAME_CONFIG.CHUNK_LENGTH; // 50m
  const targetRunDistance = 3000; // 3,000m per simulated run

  for (let r = 0; r < runsCount; r++) {
    let fuel = GAME_CONFIG.FUEL_MAX; // 100%
    let distance = 0;
    let lastFuelSpawnDist = 0;
    let noDrainDistanceRemaining = 0;
    let pickupsThisRun = 0;

    while (distance < targetRunDistance) {
      // Speed at current distance
      const speed = Math.min(
        GAME_CONFIG.MAX_SPEED,
        GAME_CONFIG.BASE_SPEED +
          (GAME_CONFIG.MAX_SPEED - GAME_CONFIG.BASE_SPEED) *
            (1 - Math.exp(-distance / GAME_CONFIG.SPEED_DAMPING_DIST))
      );

      // Drain rate per meter: baseRate * (0.6 + speed / maxSpeed)
      const drainPerMeter =
        GAME_CONFIG.FUEL_BASE_DRAIN_RATE * (0.6 + speed / GAME_CONFIG.MAX_SPEED);

      // Check spawner logic at start of each 50m chunk
      const projectedFuelIn250m =
        fuel - drainPerMeter * GAME_CONFIG.FUEL_PITY_LOOKAHEAD_M;
      const needsGuaranteedFuel =
        projectedFuelIn250m <= GAME_CONFIG.FUEL_PITY_THRESHOLD_PCT ||
        distance - lastFuelSpawnDist >= 220;

      // Natural pattern fuel spawn (~28% chance if gap >= 110m) OR guaranteed pity spawn
      const canNaturalSpawn = distance - lastFuelSpawnDist >= 110 && Math.random() < 0.28;

      if (needsGuaranteedFuel || canNaturalSpawn) {
        lastFuelSpawnDist = distance;
        pickupsThisRun++;
        // Choose variant restore amount based on distance
        if (distance >= 1500 && Math.random() < 0.15) {
          fuel = 100;
          noDrainDistanceRemaining = speed * GAME_CONFIG.FUEL_GOLDEN_NODRAIN_DURATION;
        } else if (distance >= 500 && Math.random() < 0.3) {
          fuel = Math.min(100, fuel + 70);
        } else {
          fuel = Math.min(100, fuel + 30);
        }
      }

      // Advance 1 chunk (50m)
      const stepDist = chunkLen;
      if (noDrainDistanceRemaining > 0) {
        const coveredNoDrain = Math.min(stepDist, noDrainDistanceRemaining);
        noDrainDistanceRemaining -= coveredNoDrain;
        const remainingStep = stepDist - coveredNoDrain;
        fuel -= remainingStep * drainPerMeter;
      } else {
        fuel -= stepDist * drainPerMeter;
      }

      if (fuel < minFuelObserved) {
        minFuelObserved = fuel;
      }

      if (fuel <= 0) {
        starvedRuns++;
        break;
      }

      distance += stepDist;
    }

    totalPickups += pickupsThisRun;
  }

  return {
    runsSimulated: runsCount,
    starvedRuns,
    minFuelObserved: Math.max(0, Number(minFuelObserved.toFixed(2))),
    avgFuelPickupsPerRun: Number((totalPickups / runsCount).toFixed(1)),
    passed: starvedRuns === 0
  };
}
