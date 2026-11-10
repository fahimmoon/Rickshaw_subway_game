import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TextureCache } from './textures';
import { createGameMaterial, createBlobShadow } from './materials';
import { patchObjectHierarchy } from './curve';
import {
  ROAD_Y,
  DECK_Y,
  DECK_THICKNESS,
  RAMP_LENGTH,
  RAIL_HEIGHT,
  BUS_ROOF_HEIGHT,
  BUS_RAMP_LENGTH,
  BUS_RAMP_LOW_OFFSET_Z,
  BUS_RAMP_HIGH_OFFSET_Z,
  GAME_CONFIG
} from './config';
import {
  VEHICLE_SPECS,
  PROP_SPECS,
  LOW_POLY_PALETTE,
  LANE_WIDTH
} from './constants';
import {
  placePart,
  createWheel,
  createCar,
  createSedan,
  createAmbulance,
  createAuto,
  createBus,
  createTruck,
  createBike,
  createPedestrianModel
} from './vehicles';
import { validateModelAlignment } from './debug';
import { smoothstep01, normalizeRampLanes } from './terrain';

export type CarType = 'HATCHBACK' | 'SEDAN' | 'SUV';

const _box3 = new THREE.Box3();

/**
 * Normalizes a procedural model's child geometries so its exact lowest base point sits at y = 0,
 * and centers X and Z at 0, then attaches a curve-patched soft blob shadow at y = 0.01 if requested.
 */
export function normalizeModelBase(
  root: THREE.Group,
  addShadow: boolean = false,
  shadowW: number = 1.6,
  shadowL: number = 2.4
): THREE.Group {
  root.updateMatrixWorld(true);
  _box3.makeEmpty();

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (
      mesh.isMesh &&
      !mesh.userData?.isBlobShadow &&
      !mesh.userData?.isDebugHelper &&
      !mesh.userData?.ignoreBaseNormalize
    ) {
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }
      if (mesh.geometry.boundingBox) {
        const b = mesh.geometry.boundingBox.clone();
        b.applyMatrix4(mesh.matrixWorld);
        _box3.union(b);
      }
    }
  });

  if (!_box3.isEmpty()) {
    const center = _box3.getCenter(new THREE.Vector3());
    const dx = -center.x;
    const dy = -_box3.min.y;
    const dz = -center.z;
    if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4 || Math.abs(dz) > 1e-4) {
      for (const child of root.children) {
        if (!child.userData?.isBlobShadow && !child.userData?.isDebugHelper) {
          child.position.x += dx;
          child.position.y += dy;
          child.position.z += dz;
        }
      }
    }
  }

  if (addShadow) {
    const hasExistingShadow = root.children.some((c) => c.userData?.isBlobShadow);
    if (!hasExistingShadow) {
      const shadow = createBlobShadow(shadowW, shadowL, 0.42);
      shadow.position.set(0, 0.01, 0);
      root.add(shadow);
      root.userData.groundShadow = shadow;
    }
  }

  patchObjectHierarchy(root);
  root.updateMatrixWorld(true);
  return root;
}

// ============================================================================
// UNIFIED VEHICLE BUILDERS (Delegated to VEHICLE_SPECS factories in vehicles.ts)
// ============================================================================

const SKIN_COLOR_MAP: Record<string, number> = {
  badshahi: 0x15803d,
  karachi: 0x0284c7,
  peshawar: 0xb91c1c,
  cyber: 0x7c3aed
};

let _carPaletteIdx = 0;
let _sedanPaletteIdx = 0;
let _busPaletteIdx = 0;
let _truckPaletteIdx = 0;
let _bikePaletteIdx = 0;

/**
 * 1. Auto-Rickshaw (2.6m x 1.3m x 1.7m, facing -Z)
 */
export function createDetailedRickshaw(skin: string = 'badshahi'): THREE.Group {
  const col = SKIN_COLOR_MAP[skin] ?? LOW_POLY_PALETTE.autoGreen;
  return createAuto(col);
}

/**
 * 2. Traffic Cars: Hatchback (3.8 x 1.7 x 1.5), Sedan (4.5 x 1.8 x 1.45), Ambulance (5.2 x 2.0 x 2.4)
 */
export function createTrafficCar(type: CarType = 'SEDAN'): THREE.Group {
  let group: THREE.Group;
  if (type === 'HATCHBACK') {
    const col = LOW_POLY_PALETTE.cars[_carPaletteIdx++ % LOW_POLY_PALETTE.cars.length];
    group = createCar(col);
  } else if (type === 'SUV') {
    group = createAmbulance();
  } else {
    const col = LOW_POLY_PALETTE.sedans[_sedanPaletteIdx++ % LOW_POLY_PALETTE.sedans.length];
    group = createSedan(col);
  }

  const spec =
    type === 'HATCHBACK'
      ? VEHICLE_SPECS.car
      : type === 'SUV'
      ? VEHICLE_SPECS.ambulance
      : VEHICLE_SPECS.sedan;

  group.userData.carType = type;
  group.userData.width = spec.width;
  group.userData.length = spec.length;
  group.userData.height = spec.height;
  group.userData.speed = 0;
  group.userData.targetLaneX = 0;
  group.userData.laneChangeTimer = 0;
  group.userData.honkTimer = 0;
  return group;
}

/**
 * 3. City Bus (10.0m x 2.5m x 3.2m, facing -Z)
 */
export function createTransportBus(isMetro = false): THREE.Group {
  const col = isMetro
    ? 0xdc2626
    : LOW_POLY_PALETTE.buses[_busPaletteIdx++ % LOW_POLY_PALETTE.buses.length];
  return createBus(col);
}

/**
 * 4. Bus with Climbable Rear Roof Ramp
 */
export function createBusWithRamp(isMetro = false): THREE.Group {
  const busGroup = createTransportBus(isMetro);
  busGroup.userData.hasRamp = true;
  busGroup.userData.roofHeight = BUS_ROOF_HEIGHT;
  busGroup.userData.rampLowOffsetZ = BUS_RAMP_LOW_OFFSET_Z;
  busGroup.userData.rampHighOffsetZ = BUS_RAMP_HIGH_OFFSET_Z;

  const rampMat = createGameMaterial({
    color: 0xf59e0b,
    flatShading: true,
    metalness: 0.4,
    roughness: 0.5
  });

  const rampWidth = 2.2;
  const rampRun = BUS_RAMP_LENGTH;
  const rampRise = BUS_ROOF_HEIGHT - ROAD_Y;
  const slabLen = Math.hypot(rampRun, rampRise);
  const rampAngle = Math.atan2(rampRise, rampRun);
  const rampCenterZ = (BUS_RAMP_LOW_OFFSET_Z + BUS_RAMP_HIGH_OFFSET_Z) * 0.5;
  const rampCenterY = ROAD_Y + rampRise * 0.5;

  const rampGeo = new THREE.BoxGeometry(rampWidth, 0.16, slabLen);
  const ramp = new THREE.Mesh(rampGeo, rampMat);
  ramp.rotation.x = rampAngle;
  ramp.position.set(0, rampCenterY, rampCenterZ);
  ramp.userData.ignoreBaseNormalize = true;
  ramp.userData.isDebugHelper = true; // Excluded from base bus spec box check
  busGroup.add(ramp);

  // Directional chevrons pointing toward -Z
  const chevronMat = createGameMaterial({
    color: 0xef4444,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.6
  });
  [-slabLen * 0.3, 0, slabLen * 0.3].forEach((cz) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(rampWidth * 0.8, 0.04, 0.22), chevronMat);
    bar.position.set(0, 0.1, cz);
    bar.userData.isDebugHelper = true;
    ramp.add(bar);
  });

  patchObjectHierarchy(busGroup);
  return busGroup;
}

/**
 * 5. Highway Cargo Truck (8.0m x 2.4m x 3.2m, facing -Z)
 */
export function createBedfordTruck(): THREE.Group {
  const col = LOW_POLY_PALETTE.trucks[_truckPaletteIdx++ % LOW_POLY_PALETTE.trucks.length];
  return createTruck(col);
}

export function createDecoratedTruck(): THREE.Group {
  return createTruck(0x0284c7);
}

/**
 * 6. Ambulance / Emergency Van (5.2m x 2.0m x 2.4m, facing -Z)
 */
export function createSuzukiBolan(): THREE.Group {
  return createAmbulance();
}

/**
 * 7. Motorcycle (2.0m x 0.8m x 1.1m, facing -Z)
 */
export function createCivilianMotorbike(): THREE.Group {
  const col = LOW_POLY_PALETTE.bikes[_bikePaletteIdx++ % LOW_POLY_PALETTE.bikes.length];
  const bike = createBike(col);
  bike.userData.isMotorbike = true;
  bike.userData.isBike = true;
  bike.userData.speed = 0;
  bike.userData.targetLaneX = 0;
  return bike;
}

export function createPlayerMotorbike(): THREE.Group {
  return createBike(0xdc2626);
}

export function createPoliceMotorbike(): THREE.Group {
  return createBike(0xf8fafc);
}

export function createChingchi(): THREE.Group {
  return createAuto(0xfacc15);
}

export function createTractor(): THREE.Group {
  return createTruck(0xb91c1c);
}

export function createTonga(): THREE.Group {
  return createAuto(0x991b1b);
}

export function createSpiderManMesh(): THREE.Group {
  return createCar(0xe11d48);
}

export function createIronManMesh(): THREE.Group {
  return createSedan(0xd97706);
}

export function createCaptainAmericaMesh(): THREE.Group {
  return createAmbulance();
}

export function createThorMesh(): THREE.Group {
  return createTruck(0x1e293b);
}

export function createHulkMesh(): THREE.Group {
  return createTruck(0x15803d);
}

/**
 * 8. Pedestrians (0.5m x 0.3m x 1.7m, grounded at y = 0, facing -Z)
 */
export function createPedestrian(shirtColor = 0x2563eb): THREE.Group {
  const ped = createPedestrianModel(shirtColor);
  ped.userData.walkPhase = Math.random() * Math.PI * 2;
  return ped;
}

export function createCrossingPedestrian(shirtColor = 0x059669): THREE.Group {
  const ped = createPedestrianModel(shirtColor);
  ped.userData.isCrossingPed = true;
  ped.userData.crossDir = Math.random() < 0.5 ? 1 : -1;
  ped.userData.crossSpeed = 2.4 + Math.random() * 1.2;
  ped.userData.walkPhase = Math.random() * Math.PI;
  return ped;
}

// ============================================================================
// HIGHWAY PATROL CAR & OFFICER (Built to VEHICLE_SPECS standards)
// ============================================================================

export function createHighwayPatrolCar(side: 'left' | 'right' = 'left'): THREE.Group {
  const root = createSedan(0xf8fafc);
  const spec = VEHICLE_SPECS.sedan;

  // Add Red & Blue Police Lightbar centered on roof
  const redLightMat = createGameMaterial({
    color: 0xff0022,
    emissive: 0xff0022,
    emissiveIntensity: 2.0,
    flatShading: true
  });
  const blueLightMat = createGameMaterial({
    color: 0x0044ff,
    emissive: 0x0044ff,
    emissiveIntensity: 2.0,
    flatShading: true
  });

  const redLight = placePart(
    new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.22), redLightMat),
    { x: -0.24, y: spec.height - 0.05, z: 0 }
  );
  redLight.userData.isPoliceLight = true;
  redLight.userData.lightColor = 'red';

  const blueLight = placePart(
    new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.22), blueLightMat),
    { x: +0.24, y: spec.height - 0.05, z: 0 }
  );
  blueLight.userData.isPoliceLight = true;
  blueLight.userData.lightColor = 'blue';

  const bodyGroup = (root.userData.bodyGroup as THREE.Group) || root;
  bodyGroup.add(redLight, blueLight);

  root.userData.isHighwayPatrol = true;
  root.userData.side = side;
  patchObjectHierarchy(root);
  return root;
}

export function createPoliceOfficer(): THREE.Group {
  return createPedestrianModel(0x854d0e);
}

// ============================================================================
// PROPS, BUILDINGS, TREES & STREET FURNITURE (Grounded at y = 0, Centered X/Z)
// ============================================================================

/**
 * Fruit Cart (Thela): 2.0m (L along Z) x 1.5m (W along X) x 1.8m (H along Y)
 * Symmetrical, grounded at y = 0, facing -Z.
 */
export function createFruitCart(): THREE.Group {
  const spec = PROP_SPECS.fruitCart;
  const { width: W, length: L, height: H } = spec;
  const wheelR = 0.28;
  const wheelW = 0.12;

  const group = new THREE.Group();
  group.name = 'Prop_fruitCart';

  // 4 symmetrical wheels at y = wheelR so tires touch y = 0
  const wx = W / 2 - wheelW / 2;
  const wz = L * 0.32;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(placePart(createWheel(wheelR, wheelW), { x: sx * wx, y: wheelR, z: sz * wz }));
    }
  }

  const woodMat = createGameMaterial({ color: 0x78350f, flatShading: true, roughness: 0.85 });
  const canopyMat = createGameMaterial({ color: 0xd97706, flatShading: true, roughness: 0.75 });
  const fruitMat = createGameMaterial({ color: 0xf59e0b, flatShading: true, roughness: 0.4 });
  const melonMat = createGameMaterial({ color: 0x15803d, flatShading: true, roughness: 0.45 });

  // Flatbed platform spanning exact W x L
  const bedY = wheelR + 0.42;
  const bed = placePart(new THREE.Mesh(new THREE.BoxGeometry(W, 0.14, L), woodMat), {
    x: 0,
    y: bedY,
    z: 0
  });
  group.add(bed);

  // 4 corner posts supporting shade awning at top = H (1.80m)
  const roofH = 0.12;
  const postH = H - roofH - bedY;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = placePart(
        new THREE.Mesh(new THREE.BoxGeometry(0.06, postH, 0.06), woodMat),
        { x: sx * (W * 0.44), y: bedY + postH / 2, z: sz * (L * 0.44) }
      );
      group.add(post);
    }
  }

  const roof = placePart(
    new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, roofH, L * 0.94), canopyMat),
    { x: 0, y: H - roofH / 2, z: 0 }
  );
  group.add(roof);

  // Symmetrical fruit mounds on flatbed
  const mangoes = placePart(
    new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, 0.24, L * 0.36), fruitMat),
    { x: 0, y: bedY + 0.19, z: -L * 0.22 }
  );
  const melons = placePart(
    new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, 0.26, L * 0.36), melonMat),
    { x: 0, y: bedY + 0.20, z: +L * 0.22 }
  );
  group.add(mangoes, melons);

  const shadow = createBlobShadow(W * 0.95, L * 0.95, 0.4);
  shadow.position.set(0, 0.01, 0);
  group.add(shadow);

  patchObjectHierarchy(group);
  validateModelAlignment(group, 'fruitCart', {
    id: 'fruitCart',
    name: 'Fruit Cart',
    length: L,
    width: W,
    height: H
  });
  return group;
}

/**
 * Palm Tree: Grounded at y = 0, centered on X and Z, sized from PROP_SPECS.tree (2.8 x 2.8 x 6.5m)
 */
let _sharedPalmTrunkGeo: THREE.BufferGeometry | null = null;
let _sharedPalmLeavesGeo: THREE.BufferGeometry | null = null;
let _sharedPalmTrunkMat: THREE.Material | null = null;
let _sharedPalmLeafMat: THREE.Material | null = null;

export function createPalmTree(): THREE.Group {
  const spec = PROP_SPECS.tree;
  if (!_sharedPalmTrunkGeo) {
    const planter = new THREE.BoxGeometry(0.9, 0.30, 0.9);
    planter.translate(0, 0.15, 0);
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, spec.height - 0.6, 8);
    trunk.translate(0, 0.30 + (spec.height - 0.6) / 2, 0);
    _sharedPalmTrunkGeo = mergeGeometries([planter, trunk], false);
    planter.dispose();
    trunk.dispose();
    _sharedPalmTrunkMat = createGameMaterial({ color: 0x78350f, flatShading: true, roughness: 0.9 });
  }

  if (!_sharedPalmLeavesGeo) {
    const crownParts: THREE.BufferGeometry[] = [];
    // Symmetrical 4-way & diagonal low-poly frond canopy spanning spec.width x spec.length and reaching spec.height
    const span = spec.width;
    const b1 = new THREE.BoxGeometry(span, 0.55, 0.85);
    b1.translate(0, spec.height - 0.45, 0);
    const b2 = new THREE.BoxGeometry(0.85, 0.55, span);
    b2.translate(0, spec.height - 0.45, 0);
    const topCap = new THREE.BoxGeometry(span * 0.55, 0.35, span * 0.55);
    topCap.translate(0, spec.height - 0.175, 0);
    crownParts.push(b1, b2, topCap);
    _sharedPalmLeavesGeo = mergeGeometries(crownParts, false);
    crownParts.forEach((g) => g.dispose());
    _sharedPalmLeafMat = createGameMaterial({ color: 0x16a34a, flatShading: true, roughness: 0.55 });
  }

  const group = new THREE.Group();
  group.name = 'Prop_tree';
  group.add(
    new THREE.Mesh(_sharedPalmTrunkGeo, _sharedPalmTrunkMat!),
    new THREE.Mesh(_sharedPalmLeavesGeo, _sharedPalmLeafMat!)
  );

  const shadow = createBlobShadow(1.6, 1.6, 0.38);
  shadow.position.set(0, 0.01, 0);
  group.add(shadow);

  patchObjectHierarchy(group);
  return group;
}

/**
 * Low-Poly City Building with Open Ground-Floor Street Shops:
 * - Centered at (0, 0) in X and Z
 * - Grounded at y = 0
 * - Sized from PROP_SPECS (10m length along Z x 12m width along X)
 * - Features open ground-floor bazaar shop bays with warm interior lighting,
 *   rolled-up shutters, stocked display counters, shopkeepers, and glowing "OPEN" neon signs.
 */
export function createCityBuilding(styleIdx = 0): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Prop_building';

  const style = Math.abs(styleIdx) % LOW_POLY_PALETTE.buildings.length;
  const width = 12.0;  // X
  const length = 10.0; // Z
  const heights = [15.0, 18.0, 21.0, 16.5, 24.0, 19.5];
  const height = heights[style % heights.length];

  const wallColor = LOW_POLY_PALETTE.buildings[style];
  const awningColors = [0xdc2626, 0x0284c7, 0x16a34a, 0xd97706, 0x7c3aed, 0x0d9488];
  const neonSignColors = [0x22c55e, 0xfacc15, 0x38bdf8, 0xf43f5e, 0xa855f7, 0x10b981];

  const wallMat = createGameMaterial({ color: wallColor, flatShading: true, roughness: 0.75 });
  const trimMat = createGameMaterial({ color: 0x334155, flatShading: true, roughness: 0.6 });
  const winMat = createGameMaterial({ color: LOW_POLY_PALETTE.windowDarkBlue, flatShading: true, roughness: 0.25 });
  const awningMat = createGameMaterial({ color: awningColors[style], flatShading: true, roughness: 0.65 });
  const shopInteriorMat = createGameMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.75,
    flatShading: true
  });
  const counterMat = createGameMaterial({ color: 0x78350f, flatShading: true, roughness: 0.8 });
  const neonSignMat = createGameMaterial({
    color: neonSignColors[style],
    emissive: neonSignColors[style],
    emissiveIntensity: 1.1,
    flatShading: true
  });

  // Main building block centered on X = 0, Z = 0, base at y = 0
  const bodyH = height - 0.5;
  const body = placePart(new THREE.Mesh(new THREE.BoxGeometry(width, bodyH, length), wallMat), {
    x: 0,
    y: bodyH / 2,
    z: 0
  });
  group.add(body);

  // Roof parapet cap reaching exact `height`
  const parapet = placePart(
    new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, length), trimMat),
    { x: 0, y: height - 0.25, z: 0 }
  );
  group.add(parapet);

  // Open Ground-Floor Storefront Bays (mirrored on -Z and +Z faces so center remains (0, 0))
  const shopGeos: THREE.BufferGeometry[] = [];
  const counterGeos: THREE.BufferGeometry[] = [];
  const signGeos: THREE.BufferGeometry[] = [];

  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const bayX = sx * 3.1;
      const faceZ = sz * (length / 2);
      // Warm lit open shop interior bay (y = 0.15m to 3.05m)
      const bay = new THREE.BoxGeometry(4.4, 2.9, 0.08);
      bay.translate(bayX, 1.60, faceZ);
      shopGeos.push(bay);

      // Display counter & merchandise shelf at bottom of open shop
      const counter = new THREE.BoxGeometry(4.2, 0.85, 0.24);
      counter.translate(bayX, 0.425, faceZ);
      counterGeos.push(counter);

      // Rolled-up shutter housing & glowing "OPEN" fascia sign board above shop bay
      const signBoard = new THREE.BoxGeometry(3.8, 0.48, 0.18);
      signBoard.translate(bayX, 3.85, faceZ);
      signGeos.push(signBoard);
    }
  }

  group.add(
    new THREE.Mesh(mergeGeometries(shopGeos, false), shopInteriorMat),
    new THREE.Mesh(mergeGeometries(counterGeos, false), counterMat),
    new THREE.Mesh(mergeGeometries(signGeos, false), neonSignMat)
  );
  shopGeos.forEach((g) => g.dispose());
  counterGeos.forEach((g) => g.dispose());
  signGeos.forEach((g) => g.dispose());

  // Symmetrical ground-floor shop awning
  const awning = placePart(
    new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 0.30, length * 0.98), awningMat),
    { x: 0, y: 3.35, z: 0 }
  );
  group.add(awning);

  // Symmetrical window bands, Karachi Saddar / Burns Road projecting Jharoka balconies, & clamped split-AC units
  const winGeos: THREE.BufferGeometry[] = [];
  const balconyGeos: THREE.BufferGeometry[] = [];
  const acUnitGeos: THREE.BufferGeometry[] = [];

  for (let y = 5.4; y < height - 1.8; y += 3.2) {
    const band = new THREE.BoxGeometry(width + 0.04, 1.2, length * 0.80);
    band.translate(0, y, 0);
    winGeos.push(band);

    // Symmetrical Karachi Jharoka Balconies on -X and +X faces
    for (const sx of [-1, 1]) {
      const bal = new THREE.BoxGeometry(0.32, 0.55, 3.6);
      bal.translate(sx * (width / 2 + 0.14), y - 0.42, 0);
      balconyGeos.push(bal);

      // Symmetrical Clamped Split-AC Outdoor Condenser Units on -Z and +Z faces
      for (const sz of [-1, 1]) {
        const ac = new THREE.BoxGeometry(0.75, 0.52, 0.28);
        ac.translate(sx * 4.2, y + 0.35, sz * (length / 2 + 0.12));
        acUnitGeos.push(ac);
      }
    }
  }
  if (winGeos.length > 0) {
    const mergedWins = mergeGeometries(winGeos, false);
    winGeos.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(mergedWins, winMat));
  }
  if (balconyGeos.length > 0) {
    const mergedBal = mergeGeometries(balconyGeos, false);
    balconyGeos.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(mergedBal, counterMat));
  }
  if (acUnitGeos.length > 0) {
    const mergedAc = mergeGeometries(acUnitGeos, false);
    acUnitGeos.forEach((g) => g.dispose());
    const acMat = createGameMaterial({ color: 0xe2e8f0, flatShading: true, roughness: 0.7 });
    group.add(new THREE.Mesh(mergedAc, acMat));
  }

  // Symmetrical Karachi Rooftop Blue Water Tanks & Vertical Neon Bazaar Signboards
  const tankMat = createGameMaterial({ color: 0x0284c7, flatShading: true, roughness: 0.45 });
  for (const sx of [-1, 1]) {
    // Rooftop water tanks (inset within parapet height or symmetrical)
    group.add(
      placePart(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.48, 8), tankMat), {
        x: sx * 3.4,
        y: height - 0.24,
        z: 0
      })
    );
    // Vertical neon bazaar signboards on building corners
    group.add(
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.75), neonSignMat), {
        x: sx * (width / 2 + 0.08),
        y: 6.8,
        z: 0
      })
    );
  }

  patchObjectHierarchy(group);
  return group;
}

/**
 * Open 24/7 Roadside Karak Chai Dhaba Stall:
 * Grounded at y = 0, centered at (0, 0), 4.0m (L) x 4.5m (W) x 3.4m (H).
 * Includes open counter, steaming brass tea samovar, Dhabawala vendor, seated customers on charpais,
 * warm hanging lanterns, and a glowing "OPEN • CHAI" sign.
 */
export function createModularDhaba(variant = 0): THREE.Group {
  const spec = PROP_SPECS.shopStall;
  const { width: W, length: L, height: H } = spec;
  const group = new THREE.Group();
  group.name = 'Prop_dhaba';

  const woodMat = createGameMaterial({ color: 0x78350f, flatShading: true, roughness: 0.85 });
  const slabMat = createGameMaterial({ color: 0x475569, flatShading: true, roughness: 0.9 });
  const canopyColors = [0x15803d, 0xb91c1c, 0x0284c7, 0xd97706];
  const roofMat = createGameMaterial({ color: canopyColors[Math.abs(variant) % 4], flatShading: true, roughness: 0.75 });
  const brassMat = createGameMaterial({ color: 0xfacc15, flatShading: true, metalness: 0.6, roughness: 0.3 });
  const lanternMat = createGameMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.1,
    flatShading: true
  });
  const openSignMat = createGameMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 1.0,
    flatShading: true
  });
  const vendorShirtMat = createGameMaterial({ color: 0xe11d48, flatShading: true, roughness: 0.7 });
  const skinMat = createGameMaterial({ color: 0xd97706, flatShading: true, roughness: 0.7 });

  // Ground floor slab at y = 0
  const slabH = 0.14;
  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(W, slabH, L), slabMat), {
      x: 0,
      y: slabH / 2,
      z: 0
    })
  );

  // 4 symmetrical corner posts reaching from slab up to canopy roof
  const roofH = 0.40;
  const postH = H - slabH - roofH;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(
        placePart(new THREE.Mesh(new THREE.BoxGeometry(0.14, postH, 0.14), woodMat), {
          x: sx * (W * 0.44),
          y: slabH + postH / 2,
          z: sz * (L * 0.44)
        })
      );
    }
  }

  // Symmetrical pitched/stepped canopy roof reaching exact H = 3.4m
  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(W, roofH, L), roofMat), {
      x: 0,
      y: H - roofH / 2,
      z: 0
    })
  );

  // Glowing "OPEN • KARAK CHAI" sign fascia boards on front & back of roof
  for (const sz of [-1, 1]) {
    group.add(
      placePart(new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, 0.28, 0.08), openSignMat), {
        x: 0,
        y: H - roofH / 2,
        z: sz * (L / 2 - 0.04)
      })
    );
  }

  // Central Chai Counter + Brass Tea Samovar + Dhabawala Chai Master at (0, _, 0)
  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.82, 0.9), woodMat), {
      x: 0,
      y: slabH + 0.41,
      z: 0
    }),
    // Brass Chai Kettle / Samovar
    placePart(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.46, 8), brassMat), {
      x: 0,
      y: slabH + 0.82 + 0.23,
      z: 0
    }),
    // Chai Master torso & head
    placePart(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.26), vendorShirtMat), {
      x: 0,
      y: slabH + 1.10,
      z: 0
    }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), skinMat), {
      x: 0,
      y: slabH + 1.50,
      z: 0
    }),
    // Warm hanging lantern under center of roof
    placePart(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.36), lanternMat), {
      x: 0,
      y: H - roofH - 0.16,
      z: 0
    })
  );

  // Symmetrical wooden charpai benches & seated customers on left (-X) and right (+X)
  for (const sx of [-1, 1]) {
    group.add(
      placePart(new THREE.Mesh(new THREE.BoxGeometry(W * 0.28, 0.46, L * 0.65), woodMat), {
        x: sx * (W * 0.30),
        y: slabH + 0.23,
        z: 0
      }),
      // Seated customer enjoying chai
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.50, 0.30), roofMat), {
        x: sx * (W * 0.30),
        y: slabH + 0.46 + 0.25,
        z: 0
      }),
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), skinMat), {
        x: sx * (W * 0.30),
        y: slabH + 0.46 + 0.61,
        z: 0
      })
    );
  }

  group.userData.isOpenRoadsideShop = true;
  group.userData.shopType = 'DHABA';
  patchObjectHierarchy(group);
  return group;
}

/**
 * Open Burns Road Biryani, Seekh Kebab & VIP Banarsi Paan Kiosk:
 * Grounded at y = 0, centered at (0, 0), with a giant copper Biryani Deg cauldron
 * on a glowing charcoal burner, chilled Pakola & Rooh Afza bottle shelves,
 * shopkeeper, and glowing neon "OPEN • BIRYANI & PAAN" fascia sign.
 */
export function createModularPaanShop(variant = 0): THREE.Group {
  const spec = PROP_SPECS.shopStall;
  const { width: W, length: L, height: H } = spec;
  const group = new THREE.Group();
  group.name = 'Prop_paan_shop';

  const woodMat = createGameMaterial({ color: 0x5c2d0c, flatShading: true, roughness: 0.85 });
  const slabMat = createGameMaterial({ color: 0x334155, flatShading: true, roughness: 0.9 });
  const canopyColors = [0x0d9488, 0x9333ea, 0xe11d48, 0x0284c7];
  const roofMat = createGameMaterial({
    color: canopyColors[Math.abs(variant) % 4],
    flatShading: true,
    roughness: 0.7
  });
  const copperDegMat = createGameMaterial({
    color: 0xd97706,
    flatShading: true,
    metalness: 0.65,
    roughness: 0.28
  });
  const redClothMat = createGameMaterial({ color: 0xdc2626, flatShading: true, roughness: 0.8 });
  const neonMat = createGameMaterial({
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.15,
    flatShading: true
  });
  const coalGlowMat = createGameMaterial({
    color: 0xf97316,
    emissive: 0xef4444,
    emissiveIntensity: 1.2,
    flatShading: true
  });
  const bottleGreenMat = createGameMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 0.5,
    flatShading: true
  });
  const skinMat = createGameMaterial({ color: 0xc68642, flatShading: true, roughness: 0.7 });

  const slabH = 0.14;
  const roofH = 0.40;
  const postH = H - slabH - roofH;

  // Base floor slab at y = 0
  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(W, slabH, L), slabMat), {
      x: 0,
      y: slabH / 2,
      z: 0
    })
  );

  // 4 corner posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(
        placePart(new THREE.Mesh(new THREE.BoxGeometry(0.14, postH, 0.14), woodMat), {
          x: sx * (W * 0.44),
          y: slabH + postH / 2,
          z: sz * (L * 0.44)
        })
      );
    }
  }

  // Canopy roof reaching exact H = 3.4m
  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(W, roofH, L), roofMat), {
      x: 0,
      y: H - roofH / 2,
      z: 0
    })
  );

  // Glowing Neon Fascia Boards on front & back
  for (const sz of [-1, 1]) {
    group.add(
      placePart(new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, 0.30, 0.08), neonMat), {
        x: 0,
        y: H - roofH / 2,
        z: sz * (L / 2 - 0.04)
      })
    );
  }

  // Central Counter + Giant Copper Biryani Deg wrapped in Red Cloth + Glowing Coal Grill
  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.82, 0.95), woodMat), {
      x: 0,
      y: slabH + 0.41,
      z: 0
    }),
    // Glowing coal fire bed
    placePart(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.10, 0.55), coalGlowMat), {
      x: 0,
      y: slabH + 0.87,
      z: 0
    }),
    // Giant Copper Biryani Deg Cauldron
    placePart(new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), copperDegMat), {
      x: 0,
      y: slabH + 1.15,
      z: 0
    }),
    // Red cloth collar around Deg neck
    placePart(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 8), redClothMat), {
      x: 0,
      y: slabH + 1.42,
      z: 0
    }),
    // Vendor behind counter
    placePart(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.26), redClothMat), {
      x: 0,
      y: slabH + 1.10,
      z: 0.32
    }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), skinMat), {
      x: 0,
      y: slabH + 1.50,
      z: 0.32
    })
  );

  // Symmetrical Chilled Drink & Paan Display Racks on Left (-X) and Right (+X)
  for (const sx of [-1, 1]) {
    group.add(
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.35, 0.75), woodMat), {
        x: sx * (W * 0.32),
        y: slabH + 0.675,
        z: 0
      }),
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.62), bottleGreenMat), {
        x: sx * (W * 0.32),
        y: slabH + 1.05,
        z: 0
      })
    );
  }

  group.userData.isOpenRoadsideShop = true;
  group.userData.shopType = 'PAAN_SHOP';
  patchObjectHierarchy(group);
  return group;
}

/**
 * Festive Karachi Street Overhead Fairy-Light & Bunting Garland:
 * Spans across the road at y = 5.4m between streetlamps, adding warm glowing bulbs
 * and colorful triangular jhandiyan flags.
 */
export function createFestiveLightGarland(roadW = 12): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Prop_festive_garland';

  const wireMat = createGameMaterial({ color: 0x1e293b, flatShading: true });
  const bulbColors = [0xfef08a, 0x22c55e, 0xf43f5e, 0x38bdf8, 0xfacc15];

  const spanW = roadW + 2.2;
  const cable = new THREE.Mesh(new THREE.BoxGeometry(spanW, 0.04, 0.04), wireMat);
  cable.position.set(0, 5.45, 0);
  group.add(cable);

  const bulbGeo = new THREE.SphereGeometry(0.14, 6, 6);
  const flagGeo = new THREE.ConeGeometry(0.18, 0.34, 4);

  for (let i = -5; i <= 5; i++) {
    const xPos = (i / 5) * (roadW * 0.46);
    const sagY = 5.42 - (1 - (i / 5) * (i / 5)) * 0.38;
    const cHex = bulbColors[Math.abs(i) % bulbColors.length];
    const bMat = createGameMaterial({
      color: cHex,
      emissive: cHex,
      emissiveIntensity: 1.15,
      flatShading: true
    });
    const bulb = new THREE.Mesh(bulbGeo, bMat);
    bulb.position.set(xPos, sagY, 0);
    group.add(bulb);

    if (i % 2 === 0) {
      const flag = new THREE.Mesh(flagGeo, bMat);
      flag.rotation.x = Math.PI;
      flag.position.set(xPos, sagY - 0.22, 0);
      group.add(flag);
    }
  }

  patchObjectHierarchy(group);
  return group;
}

/**
 * Road Construction Barrier / Hurdle: 0.6m (L) x 2.4m (W) x 1.05m (H), grounded at y = 0
 */
export function createRoadHurdle(): THREE.Group {
  const spec = PROP_SPECS.hurdle;
  const { width: W, length: L, height: H } = spec;
  const group = new THREE.Group();
  group.name = 'Prop_hurdle';

  const orangeMat = createGameMaterial({ color: 0xf97316, flatShading: true, roughness: 0.4 });
  const whiteMat = createGameMaterial({ color: 0xf8fafc, flatShading: true, roughness: 0.4 });
  const darkMat = createGameMaterial({ color: 0x1e293b, flatShading: true, roughness: 0.8 });

  // Symmetrical base feet at y = 0 spanning exact L = 0.6m
  for (const sx of [-1, 1]) {
    group.add(
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, L), darkMat), {
        x: sx * (W * 0.42),
        y: 0.04,
        z: 0
      }),
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.10, H - 0.08, 0.10), darkMat), {
        x: sx * (W * 0.42),
        y: 0.08 + (H - 0.08) / 2,
        z: 0
      })
    );
  }

  // Horizontal reflective barrier boards spanning exact W = 2.4m, top at H = 1.05m
  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(W, 0.26, 0.14), orangeMat), {
      x: 0,
      y: H - 0.13,
      z: 0
    }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.27, 0.15), whiteMat), {
      x: 0,
      y: H - 0.13,
      z: 0
    })
  );

  const shadow = createBlobShadow(W * 0.95, L * 0.95, 0.38);
  shadow.position.set(0, 0.01, 0);
  group.add(shadow);

  patchObjectHierarchy(group);
  return group;
}

/**
 * Sahiwal Cow: Grounded at y = 0, centered at (0, 0), facing -Z, 2.1m (L) x 0.85m (W) x 1.45m (H)
 */
export function createSahiwalCow(): THREE.Group {
  const spec = PROP_SPECS.cow;
  const { width: W, length: L, height: H } = spec;
  const root = new THREE.Group();
  root.name = 'Prop_cow';

  const hideMat = createGameMaterial({ color: 0x9a3412, flatShading: true, roughness: 0.8 });
  const darkMat = createGameMaterial({ color: 0x1e293b, flatShading: true, roughness: 0.6 });

  // 4 symmetrical legs grounded at y = 0
  const legH = 0.65;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      root.add(
        placePart(new THREE.Mesh(new THREE.BoxGeometry(0.14, legH, 0.14), hideMat), {
          x: sx * (W * 0.34),
          y: legH / 2,
          z: sz * (L * 0.28)
        })
      );
    }
  }

  // Body & Head facing -Z
  const bodyH = 0.58;
  root.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, L * 0.76), hideMat), {
      x: 0,
      y: legH + bodyH / 2,
      z: L * 0.12
    }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(W * 0.56, H - (legH + bodyH * 0.4), L * 0.28), hideMat), {
      x: 0,
      y: H - (H - (legH + bodyH * 0.4)) / 2,
      z: -L / 2 + (L * 0.28) / 2
    }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(W * 0.62, 0.12, 0.10), darkMat), {
      x: 0,
      y: H - 0.06,
      z: -L * 0.36
    })
  );

  const shadow = createBlobShadow(W * 0.95, L * 0.95, 0.4);
  shadow.position.set(0, 0.01, 0);
  root.add(shadow);

  patchObjectHierarchy(root);
  return root;
}

/**
 * Stray Cat: Grounded at y = 0, centered at (0, 0), facing -Z
 */
export function createStrayCat(): THREE.Group {
  const root = new THREE.Group();
  const gingerMat = createGameMaterial({ color: 0xea580c, flatShading: true, roughness: 0.7 });

  const legs: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = placePart(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.05), gingerMat), {
        x: sx * 0.08,
        y: 0.09,
        z: sz * 0.18
      });
      root.add(leg);
      legs.push(leg);
    }
  }
  root.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.52), gingerMat), {
      x: 0,
      y: 0.24,
      z: 0
    }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, 0.20), gingerMat), {
      x: 0,
      y: 0.34,
      z: -0.28
    })
  );
  const tail = placePart(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), gingerMat), {
    x: 0,
    y: 0.34,
    z: 0.26
  });
  root.add(tail);

  root.userData.legs = legs;
  root.userData.tail = tail;
  root.userData.isCat = true;
  root.userData.crossDir = Math.random() < 0.5 ? 1 : -1;
  root.userData.crossSpeed = 4.2 + Math.random() * 2.0;
  root.userData.runPhase = Math.random() * Math.PI;

  const shadow = createBlobShadow(0.3, 0.55, 0.35);
  shadow.position.set(0, 0.01, 0);
  root.add(shadow);

  patchObjectHierarchy(root);
  return root;
}

export function createElectricTransmissionTower(): THREE.Group {
  const group = new THREE.Group();
  const steelMat = createGameMaterial({ color: 0x334155, flatShading: true, metalness: 0.6, roughness: 0.4 });
  const height = 14.0;
  const baseW = 2.4;

  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(baseW, 0.24, baseW), steelMat), { x: 0, y: 0.12, z: 0 }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(0.8, height, 0.8), steelMat), { x: 0, y: height / 2, z: 0 }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 0.4), steelMat), { x: 0, y: height - 2.0, z: 0 })
  );

  const beacon = placePart(
    new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), createGameMaterial({ kind: 'basic', color: 0xef4444 })),
    { x: 0, y: height + 0.15, z: 0 }
  );
  group.add(beacon);
  group.userData.beacon = beacon;

  const shadow = createBlobShadow(2.4, 2.4, 0.4);
  shadow.position.set(0, 0.01, 0);
  group.add(shadow);

  patchObjectHierarchy(group);
  return group;
}

let _sharedPuddleGeo: THREE.PlaneGeometry | null = null;
let _sharedPuddleMat: THREE.Material | null = null;

export function createPuddle(radiusX = 1.2, radiusZ = 2.0): THREE.Mesh {
  if (!_sharedPuddleGeo) {
    _sharedPuddleGeo = new THREE.PlaneGeometry(1, 1);
  }
  if (!_sharedPuddleMat) {
    _sharedPuddleMat = createGameMaterial({
      map: TextureCache.getPuddleSheen(),
      transparent: true,
      opacity: 0.85,
      roughness: 0.05,
      metalness: 0.3
    });
  }
  const mesh = new THREE.Mesh(_sharedPuddleGeo, _sharedPuddleMat);
  mesh.scale.set(radiusX * 2, radiusZ * 2, 1);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.022;
  mesh.frustumCulled = false;
  mesh.userData = { isPuddle: true };
  return mesh;
}

export function createOverheadStreetArch(roadWidth = GAME_CONFIG.ROAD_WIDTH): THREE.Group {
  const group = new THREE.Group();
  const pillarMat = createGameMaterial({ color: 0x1e293b, flatShading: true, metalness: 0.6 });
  const halfW = roadWidth / 2 + 0.8;
  const archHeight = 6.8;

  for (const px of [-halfW, halfW]) {
    group.add(
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.5, archHeight, 0.5), pillarMat), {
        x: px,
        y: archHeight / 2,
        z: 0
      }),
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), pillarMat), {
        x: px,
        y: 0.2,
        z: 0
      })
    );
  }

  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 2.2, 0.45, 0.45), pillarMat), {
      x: 0,
      y: archHeight,
      z: 0
    })
  );

  const bannerMat = createGameMaterial({
    kind: 'basic',
    map: TextureCache.getOverheadArchTexture(),
    side: THREE.DoubleSide
  });
  group.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(roadWidth * 0.88, 1.5, 0.14), bannerMat), {
      x: 0,
      y: archHeight - 0.75,
      z: 0
    })
  );

  patchObjectHierarchy(group);
  return group;
}

export function createBackgroundSkyline(side: number): THREE.Group {
  const group = new THREE.Group();
  const skyMat = createGameMaterial({
    color: 0x1e293b,
    flatShading: true,
    roughness: 0.9,
    curveMultiplier: 0.25
  });

  const baseZ = [-180, -110, -40, 30, 100];
  baseZ.forEach((bz, idx) => {
    const h = 24 + (idx % 3) * 8;
    const w = 14 + (idx % 2) * 6;
    group.add(
      placePart(new THREE.Mesh(new THREE.BoxGeometry(w, h, 22), skyMat), {
        x: side * 42.0,
        y: h / 2,
        z: bz
      })
    );
  });

  patchObjectHierarchy(group);
  return group;
}

export function createHydraulicPickup(): THREE.Group {
  const group = new THREE.Group();
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.8, 12),
    createGameMaterial({ color: 0xfacc15, flatShading: true, metalness: 0.7, roughness: 0.3 })
  );
  group.add(cylinder);
  patchObjectHierarchy(group);
  return group;
}

export function createCNGCylinderPickup(): THREE.Group {
  const group = new THREE.Group();
  const cngMat = createGameMaterial({ color: 0x15803d, flatShading: true, metalness: 0.5, roughness: 0.4 });
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.75, 12), cngMat);
  group.add(cylinder);
  patchObjectHierarchy(group);
  return group;
}

function makePartGeo(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.BufferGeometry {
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
    geo.applyMatrix4(m);
  }
  geo.translate(x, y, z);
  const nonIdx = geo.index ? geo.toNonIndexed() : geo;
  nonIdx.computeVertexNormals();
  return nonIdx;
}

export function createFlyoverStructure(
  deckLength: number = 90.0,
  requestedRampLanes: number[] = [0, 1]
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'FlyoverStructure';

  const rampLanes = normalizeRampLanes(requestedRampLanes);
  const openGroundLanes = [0, 1, 2].filter((l) => !rampLanes.includes(l));

  const roadW = GAME_CONFIG.ROAD_WIDTH;
  const deckW = roadW - 0.4;
  const deckMinX = -deckW * 0.5;
  const deckMaxX = deckW * 0.5;
  const rampLen = RAMP_LENGTH;
  const totalLen = rampLen * 2 + deckLength;
  const halfLane = LANE_WIDTH * 0.5; // 1.75m

  let minLane = 2;
  let maxLane = 0;
  for (const l of rampLanes) {
    if (l < minLane) minLane = l;
    if (l > maxLane) maxLane = l;
  }
  const rampMinX = GAME_CONFIG.LANES[minLane] - halfLane;
  const rampMaxX = GAME_CONFIG.LANES[maxLane] + halfLane;
  const rampW = rampMaxX - rampMinX;
  const rampCenterX = (rampMinX + rampMaxX) * 0.5;

  const asphaltTopMat = createGameMaterial({
    color: 0x334155,
    flatShading: true,
    roughness: 0.72,
    metalness: 0.15
  });
  const concreteBodyMat = createGameMaterial({
    color: 0x64748b,
    flatShading: true,
    roughness: 0.85
  });
  const undersideMat = createGameMaterial({
    color: 0x1e293b,
    flatShading: true,
    roughness: 0.92
  });
  const laneStripeMat = createGameMaterial({
    kind: 'basic',
    color: 0xfef08a
  });
  const chevronMat = createGameMaterial({
    color: 0xf59e0b,
    emissive: 0xb45309,
    emissiveIntensity: 0.65,
    roughness: 0.3
  });
  const gantryMat = createGameMaterial({
    color: 0x065f46,
    flatShading: true,
    metalness: 0.5,
    roughness: 0.4
  });

  const cleanGeo = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    const nonIdx = g.index ? g.toNonIndexed() : g;
    nonIdx.computeVertexNormals();
    if (nonIdx.attributes.uv) nonIdx.deleteAttribute('uv');
    return nonIdx;
  };

  const asphaltParts: THREE.BufferGeometry[] = [];
  const concreteParts: THREE.BufferGeometry[] = [];
  const undersideParts: THREE.BufferGeometry[] = [];
  const stripeParts: THREE.BufferGeometry[] = [];
  const chevronParts: THREE.BufferGeometry[] = [];
  const gantryParts: THREE.BufferGeometry[] = [];

  const rampSteps = 17;
  const stepZ = rampLen / rampSteps;

  // 1. ASCENDING RAMP
  for (let i = 0; i < rampSteps; i++) {
    const z0 = -i * stepZ;
    const z1 = -(i + 1) * stepZ;
    const zMid = (z0 + z1) * 0.5;
    const tMid = (i + 0.5) / rampSteps;
    const t0 = i / rampSteps;
    const t1 = (i + 1) / rampSteps;

    const y0 = ROAD_Y + smoothstep01(t0) * (DECK_Y - ROAD_Y);
    const y1 = ROAD_Y + smoothstep01(t1) * (DECK_Y - ROAD_Y);
    const yMid = ROAD_Y + smoothstep01(tMid) * (DECK_Y - ROAD_Y);
    const segAngle = Math.atan2(y1 - y0, stepZ);
    const segHyp = Math.hypot(stepZ, y1 - y0) + 0.04;

    const topGeo = new THREE.BoxGeometry(rampW, 0.06, segHyp);
    topGeo.rotateX(segAngle);
    topGeo.translate(rampCenterX, yMid + 0.004, zMid);
    asphaltParts.push(cleanGeo(topGeo));

    if (yMid > 0.08) {
      const wallH = yMid;
      const wallGeo = new THREE.BoxGeometry(rampW, wallH, stepZ + 0.02);
      wallGeo.translate(rampCenterX, wallH * 0.5, zMid);
      concreteParts.push(cleanGeo(wallGeo));
    }

    const railH = RAIL_HEIGHT;
    const railL = new THREE.BoxGeometry(0.32, railH, segHyp);
    railL.rotateX(segAngle);
    railL.translate(rampMinX + 0.16, yMid + railH * 0.5, zMid);
    concreteParts.push(cleanGeo(railL));

    const railR = new THREE.BoxGeometry(0.32, railH, segHyp);
    railR.rotateX(segAngle);
    railR.translate(rampMaxX - 0.16, yMid + railH * 0.5, zMid);
    concreteParts.push(cleanGeo(railR));

    if (i % 2 === 1) {
      for (const lIdx of rampLanes) {
        const lx = GAME_CONFIG.LANES[lIdx];
        const armLen = 0.95;
        const leftArm = new THREE.BoxGeometry(armLen, 0.04, 0.26);
        leftArm.rotateY(Math.PI * 0.2);
        leftArm.rotateX(segAngle);
        leftArm.translate(lx - 0.34, yMid + 0.04, zMid);
        chevronParts.push(cleanGeo(leftArm));

        const rightArm = new THREE.BoxGeometry(armLen, 0.04, 0.26);
        rightArm.rotateY(-Math.PI * 0.2);
        rightArm.rotateX(segAngle);
        rightArm.translate(lx + 0.34, yMid + 0.04, zMid);
        chevronParts.push(cleanGeo(rightArm));
      }
    }
  }

  // 2. FLAT ELEVATED DECK
  const deckZCenter = -rampLen - deckLength * 0.5;
  const exitTaperLen = Math.min(GAME_CONFIG.FLYOVER_EXIT_CLEAR_LEN, deckLength * 0.35);
  const straightDeckLen = deckLength - exitTaperLen;
  const straightDeckZCenter = -rampLen - straightDeckLen * 0.5;
  const taperStartZ = -rampLen - straightDeckLen;

  asphaltParts.push(
    cleanGeo(makePartGeo(new THREE.BoxGeometry(deckW, 0.06, deckLength + 0.2), 0, DECK_Y - 0.028, deckZCenter))
  );
  concreteParts.push(
    cleanGeo(
      makePartGeo(
        new THREE.BoxGeometry(deckW + 0.2, DECK_THICKNESS - 0.08, deckLength),
        0,
        DECK_Y - DECK_THICKNESS * 0.5,
        deckZCenter
      )
    )
  );
  undersideParts.push(
    cleanGeo(
      makePartGeo(
        new THREE.BoxGeometry(deckW, 0.06, deckLength),
        0,
        DECK_Y - DECK_THICKNESS + 0.03,
        deckZCenter
      )
    )
  );

  const railCenterY = DECK_Y + RAIL_HEIGHT * 0.5;
  concreteParts.push(
    cleanGeo(
      makePartGeo(
        new THREE.BoxGeometry(0.36, RAIL_HEIGHT, straightDeckLen),
        deckMinX + 0.18,
        railCenterY,
        straightDeckZCenter
      )
    ),
    cleanGeo(
      makePartGeo(
        new THREE.BoxGeometry(0.36, RAIL_HEIGHT, straightDeckLen),
        deckMaxX - 0.18,
        railCenterY,
        straightDeckZCenter
      )
    )
  );

  const taperSteps = 10;
  const taperStepZ = exitTaperLen / taperSteps;
  for (let i = 0; i < taperSteps; i++) {
    const tMid = smoothstep01((i + 0.5) / taperSteps);
    const tzMid = taperStartZ - (i + 0.5) * taperStepZ;
    const curMinX = deckMinX + (rampMinX - deckMinX) * tMid;
    const curMaxX = deckMaxX + (rampMaxX - deckMaxX) * tMid;

    concreteParts.push(
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.36, RAIL_HEIGHT, taperStepZ + 0.08), curMinX + 0.18, railCenterY, tzMid)),
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.36, RAIL_HEIGHT, taperStepZ + 0.08), curMaxX - 0.18, railCenterY, tzMid))
    );
  }

  for (let dz = -rampLen - 4; dz > taperStartZ + 2; dz -= 8) {
    stripeParts.push(
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.20, 0.02, 3.6), -halfLane, DECK_Y + 0.008, dz)),
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.20, 0.02, 3.6), +halfLane, DECK_Y + 0.008, dz))
    );
  }

  // 3. SUPPORT PILLARS AT ROAD EDGES AND LANE DIVIDERS (never inside lanes -3.5, 0, +3.5)
  const pillarPositions: { x: number; z: number; baseY: number }[] = [];
  const pillarH = DECK_Y - DECK_THICKNESS;
  const pierCapH = 0.36;
  const columnH = pillarH - pierCapH;
  const outerPillarX = roadW * 0.5 - 0.3;

  for (let pz = -rampLen - 6; pz >= -rampLen - deckLength + 6; pz -= GAME_CONFIG.FLYOVER_PILLAR_SPACING) {
    undersideParts.push(
      cleanGeo(makePartGeo(new THREE.BoxGeometry(deckW + 0.4, pierCapH, 1.2), 0, pillarH - pierCapH * 0.5, pz))
    );
    const pillarXs = [-outerPillarX, -halfLane, +halfLane, +outerPillarX];
    for (const px of pillarXs) {
      const colRadius = Math.abs(px) > 4 ? 0.36 : 0.20;
      concreteParts.push(
        cleanGeo(makePartGeo(new THREE.CylinderGeometry(colRadius, colRadius * 1.06, columnH, 8), px, columnH * 0.5, pz)),
        cleanGeo(makePartGeo(new THREE.BoxGeometry(colRadius * 2.2, 0.22, colRadius * 2.2), px, 0.11, pz))
      );
      pillarPositions.push({ x: px, z: pz, baseY: ROAD_Y });
    }
  }

  const medianXs: number[] = [];
  if (rampMinX > -roadW * 0.4) medianXs.push(rampMinX);
  if (rampMaxX < roadW * 0.4) medianXs.push(rampMaxX);
  for (const mx of medianXs) {
    concreteParts.push(
      cleanGeo(
        makePartGeo(
          new THREE.BoxGeometry(0.28, RAIL_HEIGHT * 0.9, deckLength),
          mx,
          ROAD_Y + RAIL_HEIGHT * 0.45,
          deckZCenter
        )
      )
    );
  }

  // 4. DESCENDING RAMP
  const downStartZ = -rampLen - deckLength;
  for (let i = 0; i < rampSteps; i++) {
    const z0 = downStartZ - i * stepZ;
    const z1 = downStartZ - (i + 1) * stepZ;
    const zMid = (z0 + z1) * 0.5;
    const t0 = 1 - i / rampSteps;
    const t1 = 1 - (i + 1) / rampSteps;
    const tMid = 1 - (i + 0.5) / rampSteps;

    const y0 = ROAD_Y + smoothstep01(t0) * (DECK_Y - ROAD_Y);
    const y1 = ROAD_Y + smoothstep01(t1) * (DECK_Y - ROAD_Y);
    const yMid = ROAD_Y + smoothstep01(tMid) * (DECK_Y - ROAD_Y);
    const segAngle = Math.atan2(y1 - y0, stepZ);
    const segHyp = Math.hypot(stepZ, y0 - y1) + 0.04;

    const topGeo = new THREE.BoxGeometry(rampW, 0.06, segHyp);
    topGeo.rotateX(segAngle);
    topGeo.translate(rampCenterX, yMid + 0.004, zMid);
    asphaltParts.push(cleanGeo(topGeo));

    if (yMid > 0.08) {
      const wallH = yMid;
      const wallGeo = new THREE.BoxGeometry(rampW, wallH, stepZ + 0.02);
      wallGeo.translate(rampCenterX, wallH * 0.5, zMid);
      concreteParts.push(cleanGeo(wallGeo));
    }

    const railL = new THREE.BoxGeometry(0.32, RAIL_HEIGHT, segHyp);
    railL.rotateX(segAngle);
    railL.translate(rampMinX + 0.16, yMid + RAIL_HEIGHT * 0.5, zMid);
    concreteParts.push(cleanGeo(railL));

    const railR = new THREE.BoxGeometry(0.32, RAIL_HEIGHT, segHyp);
    railR.rotateX(segAngle);
    railR.translate(rampMaxX - 0.16, yMid + RAIL_HEIGHT * 0.5, zMid);
    concreteParts.push(cleanGeo(railR));
  }

  // 5. ADVANCE GANTRY SIGN
  const gantryZ = GAME_CONFIG.FLYOVER_GANTRY_LEAD_DIST;
  const gantryH = 6.5;
  const gantryPostX = roadW * 0.5 + 0.6;
  gantryParts.push(
    cleanGeo(makePartGeo(new THREE.CylinderGeometry(0.20, 0.24, gantryH, 8), -gantryPostX, gantryH * 0.5, gantryZ)),
    cleanGeo(makePartGeo(new THREE.CylinderGeometry(0.20, 0.24, gantryH, 8), +gantryPostX, gantryH * 0.5, gantryZ)),
    cleanGeo(makePartGeo(new THREE.BoxGeometry(roadW + 1.6, 0.32, 0.32), 0, gantryH, gantryZ)),
    cleanGeo(makePartGeo(new THREE.BoxGeometry(rampW + 0.4, 1.25, 0.22), rampCenterX, gantryH - 0.64, gantryZ))
  );

  const addMergedMesh = (geos: THREE.BufferGeometry[], mat: THREE.Material, name: string) => {
    if (geos.length === 0) return;
    const merged = mergeGeometries(geos, false);
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = name;
    mesh.frustumCulled = false;
    root.add(mesh);
  };

  addMergedMesh(asphaltParts, asphaltTopMat, 'FlyoverAsphaltSurface');
  addMergedMesh(concreteParts, concreteBodyMat, 'FlyoverConcreteStructure');
  addMergedMesh(undersideParts, undersideMat, 'FlyoverUndersideCeiling');
  addMergedMesh(stripeParts, laneStripeMat, 'FlyoverLaneStripes');
  addMergedMesh(chevronParts, chevronMat, 'FlyoverChevrons');
  addMergedMesh(gantryParts, gantryMat, 'FlyoverGantrySign');

  const underShadowGeo = new THREE.PlaneGeometry(deckW + 0.4, totalLen);
  underShadowGeo.rotateX(-Math.PI / 2);
  underShadowGeo.translate(0, ROAD_Y + 0.012, -totalLen * 0.5);
  const underShadowMat = createGameMaterial({
    kind: 'basic',
    color: 0x020617,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  const underShadowMesh = new THREE.Mesh(underShadowGeo, underShadowMat);
  underShadowMesh.frustumCulled = false;
  underShadowMesh.userData.isBlobShadow = true;
  root.add(underShadowMesh);

  root.userData = {
    isFlyover: true,
    deckTopY: DECK_Y,
    deckLength,
    totalLength: totalLen,
    rampLanes,
    openGroundLanes,
    pillarPositions
  };

  patchObjectHierarchy(root);
  return root;
}

export function createFlyoverDeckChunk(length: number = 50.0): THREE.Group {
  return createFlyoverStructure(length, [0, 1, 2]);
}

export function createFlyoverRampChunk(length: number = 28.0, isAscending: boolean = true): THREE.Group {
  const root = new THREE.Group();
  root.userData.isFlyoverRamp = true;
  root.userData.isAscending = isAscending;
  root.userData.rampLength = length;
  patchObjectHierarchy(root);
  return root;
}

export function createShortcutSign(): THREE.Group {
  const root = new THREE.Group();
  const neonMat = createGameMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 1.8,
    flatShading: true
  });
  const boardMat = createGameMaterial({ color: 0x0f172a, flatShading: true, roughness: 0.6 });
  const pillarMat = createGameMaterial({ color: 0x1e293b, flatShading: true, metalness: 0.6 });

  const postX = GAME_CONFIG.ROAD_WIDTH * 0.5 + 0.6;
  [-postX, postX].forEach((px) => {
    root.add(
      placePart(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.4, 8), pillarMat), {
        x: px,
        y: 2.7,
        z: 0
      }),
      placePart(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), pillarMat), {
        x: px,
        y: 0.15,
        z: 0
      })
    );
  });

  root.add(
    placePart(new THREE.Mesh(new THREE.BoxGeometry(GAME_CONFIG.ROAD_WIDTH + 1.6, 0.3, 0.3), pillarMat), {
      x: 0,
      y: 5.4,
      z: 0
    }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.3, 0.22), boardMat), {
      x: 0,
      y: 4.7,
      z: 0
    }),
    placePart(new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 0.1), neonMat), {
      x: 0,
      y: 4.7,
      z: 0.14
    })
  );

  patchObjectHierarchy(root);
  return root;
}

export function createMysteryBox(): THREE.Group {
  const root = new THREE.Group();
  const goldMat = createGameMaterial({
    color: 0xf59e0b,
    flatShading: true,
    metalness: 0.85,
    roughness: 0.2,
    emissive: 0xd97706,
    emissiveIntensity: 0.5
  });
  const glowMat = createGameMaterial({
    color: 0x38bdf8,
    flatShading: true,
    emissive: 0x0284c7,
    emissiveIntensity: 1.8
  });

  root.add(
    new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), goldMat),
    new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), glowMat)
  );

  root.userData.isMysteryBox = true;
  root.userData.active = true;
  patchObjectHierarchy(root);
  return root;
}
