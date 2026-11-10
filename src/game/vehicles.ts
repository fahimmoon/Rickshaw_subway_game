import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VehicleId, MysteryVehicleId, RickshawSkin } from './config';
import {
  VEHICLE_SPECS,
  VehicleSpec,
  VehicleSpecKey,
  LOW_POLY_PALETTE
} from './constants';
import { createGameMaterial, createBlobShadow } from './materials';
import { patchObjectHierarchy } from './curve';
import { validateModelAlignment } from './debug';

export { VEHICLE_SPECS };

/**
 * 4. Helper: placePart(mesh, { x, y, z })
 * Positions any mesh or group using computed coordinates from VEHICLE_SPECS,
 * never magic hardcoded offsets.
 */
export function placePart<T extends THREE.Object3D>(
  part: T,
  pos: { x?: number; y?: number; z?: number }
): T {
  part.position.set(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
  return part;
}

/**
 * Helper to create a translated BoxGeometry for static geometry merging (low draw calls).
 */
function makeBoxGeo(
  width: number,
  height: number,
  depth: number,
  pos: { x?: number; y?: number; z?: number }
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(width, height, depth);
  geo.translate(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
  return geo;
}

/**
 * Helper to merge an array of BufferGeometries into a single flat-shaded low-poly Mesh.
 */
function buildMergedMesh(
  geos: THREE.BufferGeometry[],
  color: number,
  options?: {
    emissive?: number;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
  }
): THREE.Mesh {
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const mat = createGameMaterial({
    color,
    flatShading: true,
    roughness: options?.roughness ?? 0.55,
    metalness: options?.metalness ?? 0.15,
    ...(options?.emissive !== undefined
      ? { emissive: options.emissive, emissiveIntensity: options.emissiveIntensity ?? 0.9 }
      : {})
  });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// Cache wheel geometries by (radius, width) to avoid redundant allocations
const _wheelGeoCache = new Map<string, { tireGeo: THREE.BufferGeometry; hubGeo: THREE.BufferGeometry }>();
let _sharedTireMat: THREE.Material | null = null;
let _sharedHubMat: THREE.Material | null = null;

/**
 * 3. SHARED WHEEL FACTORY: createWheel(radius, width)
 * - Uses CylinderGeometry rotated in geometry space so the axle points along X.
 * - Includes a slightly smaller hubcap disc + spoke detail so wheel spin reads clearly.
 * - When placed at y = radius, the bottom of the tire touches the ground (y = 0) exactly.
 */
export function createWheel(radius: number, width: number): THREE.Group {
  const key = `${radius.toFixed(3)}_${width.toFixed(3)}`;
  let cached = _wheelGeoCache.get(key);

  if (!cached) {
    // 16 radial segments (multiple of 4) guarantees exact min.y = -radius at bottom vertex
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
    tireGeo.rotateZ(Math.PI / 2);

    const hubRadius = radius * 0.56;
    const hubPart1 = new THREE.CylinderGeometry(hubRadius, hubRadius, width + 0.012, 12);
    hubPart1.rotateZ(Math.PI / 2);

    // Crossbar lug detail on hubcap so wheel spin around X is visually obvious
    const spokeBar = new THREE.BoxGeometry(width + 0.02, hubRadius * 1.6, hubRadius * 0.32);
    const hubGeo = mergeGeometries([hubPart1, spokeBar], false);
    hubPart1.dispose();
    spokeBar.dispose();

    cached = { tireGeo, hubGeo };
    _wheelGeoCache.set(key, cached);
  }

  if (!_sharedTireMat) {
    _sharedTireMat = createGameMaterial({
      color: LOW_POLY_PALETTE.tireRubber,
      flatShading: true,
      roughness: 0.9,
      metalness: 0.05
    });
  }
  if (!_sharedHubMat) {
    _sharedHubMat = createGameMaterial({
      color: LOW_POLY_PALETTE.hubcapSilver,
      flatShading: true,
      roughness: 0.35,
      metalness: 0.65
    });
  }

  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'Wheel';

  const tireMesh = new THREE.Mesh(cached.tireGeo, _sharedTireMat);
  const hubMesh = new THREE.Mesh(cached.hubGeo, _sharedHubMat);
  tireMesh.castShadow = false;
  tireMesh.receiveShadow = false;
  hubMesh.castShadow = false;
  hubMesh.receiveShadow = false;

  wheelGroup.add(tireMesh, hubMesh);
  wheelGroup.userData.radius = radius;
  return wheelGroup;
}

/**
 * Shared setup for every vehicle root group:
 * - Root origin at (0, 0, 0) ground level, facing -Z
 * - Blob shadow at y = 0.01
 * - Symmetrical wheel placement from VEHICLE_SPECS
 * - Body group for suspension bounce
 */
function initVehicleRoot(spec: VehicleSpec): {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Group[];
} {
  const root = new THREE.Group();
  root.name = `Vehicle_${spec.id}`;
  root.userData.isVehicleRoot = true;
  root.userData.specId = spec.id;
  root.userData.wheelRadius = spec.wheelRadius;

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'BodyGroup';
  root.add(bodyGroup);
  root.userData.bodyGroup = bodyGroup;
  root.userData.suspensionPivot = bodyGroup;

  // Simple blob shadow under each vehicle at y = 0.01
  const shadow = createBlobShadow(spec.width * 0.92, spec.length * 0.92, 0.42);
  shadow.position.set(0, 0.01, 0);
  root.add(shadow);
  root.userData.groundShadow = shadow;

  const wheels: THREE.Group[] = [];
  root.userData.wheels = wheels;

  return { root, bodyGroup, wheels };
}

/**
 * Adds 4 symmetrical wheels (left/right mirrored on X, front/rear at fixed Z offsets)
 * with wheel center Y = spec.wheelRadius so tires touch y = 0 exactly.
 */
function addFourSymmetricWheels(
  root: THREE.Group,
  wheels: THREE.Group[],
  spec: VehicleSpec
): void {
  const { width: W, length: L, wheelRadius: R, wheelWidth: WW, wheelbaseRatio } = spec;
  const wheelX = W / 2 - WW / 2;
  const wheelZ = L * wheelbaseRatio;

  const positions = [
    { x: -wheelX, y: R, z: -wheelZ }, // Front-Left
    { x: +wheelX, y: R, z: -wheelZ }, // Front-Right
    { x: -wheelX, y: R, z: +wheelZ }, // Rear-Left
    { x: +wheelX, y: R, z: +wheelZ }  // Rear-Right
  ];

  for (const pos of positions) {
    const w = placePart(createWheel(R, WW), pos);
    root.add(w);
    wheels.push(w);
  }
}

/**
 * 1. CAR / HATCHBACK FACTORY: createCar(color)
 * Spec: 3.8m (L) x 1.7m (W) x 1.5m (H), wheelRadius = 0.35m, clearance = 0.20m
 */
export function createCar(color?: number): THREE.Group {
  const spec = VEHICLE_SPECS.car;
  const bodyColor = color ?? spec.defaultColor;
  const { width: W, length: L, height: H, wheelRadius: R, clearance: C } = spec;

  const { root, bodyGroup, wheels } = initVehicleRoot(spec);
  addFourSymmetricWheels(root, wheels, spec);

  const chassisBottom = R + C; // 0.55m
  const lowerH = 0.45;         // 0.55m -> 1.00m
  const lowerTop = chassisBottom + lowerH;
  const cabinH = H - lowerTop; // 0.50m (1.00m -> 1.50m = H)
  const cabinW = W * 0.86;
  const cabinL = L * 0.54;
  const cabinZ = L * 0.07;     // Shifted slightly back so front hood (-Z) is prominent

  const bodyGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const winGeos: THREE.BufferGeometry[] = [];
  const headGeos: THREE.BufferGeometry[] = [];
  const tailGeos: THREE.BufferGeometry[] = [];

  // Lower chassis & upper cabin
  bodyGeos.push(makeBoxGeo(W, lowerH, L, { x: 0, y: chassisBottom + lowerH / 2, z: 0 }));
  bodyGeos.push(makeBoxGeo(cabinW, cabinH, cabinL, { x: 0, y: lowerTop + cabinH / 2, z: cabinZ }));

  // Front & rear bumpers + front grille (flush within W and L)
  const bumperH = 0.14;
  const bumperD = 0.12;
  trimGeos.push(
    makeBoxGeo(W, bumperH, bumperD, { x: 0, y: chassisBottom + bumperH / 2, z: -L / 2 + bumperD / 2 }),
    makeBoxGeo(W, bumperH, bumperD, { x: 0, y: chassisBottom + bumperH / 2, z: +L / 2 - bumperD / 2 }),
    makeBoxGeo(W * 0.42, 0.14, 0.04, { x: 0, y: chassisBottom + 0.26, z: -L / 2 + 0.02 })
  );

  // Inset dark-blue windows (windshield at -Z, rear glass at +Z, side windows at ±X)
  const winH = cabinH * 0.72;
  const winY = lowerTop + cabinH * 0.52;
  winGeos.push(
    makeBoxGeo(cabinW * 0.88, winH, 0.04, { x: 0, y: winY, z: cabinZ - cabinL / 2 }),
    makeBoxGeo(cabinW * 0.86, winH, 0.04, { x: 0, y: winY, z: cabinZ + cabinL / 2 }),
    makeBoxGeo(cabinW + 0.02, winH, cabinL * 0.40, { x: 0, y: winY, z: cabinZ - cabinL * 0.20 }),
    makeBoxGeo(cabinW + 0.02, winH, cabinL * 0.38, { x: 0, y: winY, z: cabinZ + cabinL * 0.22 })
  );

  // Symmetrical headlights at front (-Z) and taillights at rear (+Z), flush with body
  const lightW = W * 0.18;
  const lightH = 0.13;
  const lightD = 0.04;
  const lightX = W * 0.34;
  const lightY = chassisBottom + 0.28;
  for (const side of [-1, 1]) {
    headGeos.push(makeBoxGeo(lightW, lightH, lightD, { x: side * lightX, y: lightY, z: -L / 2 + lightD / 2 }));
    tailGeos.push(makeBoxGeo(lightW, lightH, lightD, { x: side * lightX, y: lightY, z: +L / 2 - lightD / 2 }));
  }

  bodyGroup.add(
    buildMergedMesh(bodyGeos, bodyColor),
    buildMergedMesh(trimGeos, LOW_POLY_PALETTE.bumperDark, { roughness: 0.8 }),
    buildMergedMesh(winGeos, LOW_POLY_PALETTE.windowDarkBlue, { roughness: 0.2, metalness: 0.5 }),
    buildMergedMesh(headGeos, LOW_POLY_PALETTE.headlightWarm, { emissive: LOW_POLY_PALETTE.headlightWarm, emissiveIntensity: 0.9 }),
    buildMergedMesh(tailGeos, LOW_POLY_PALETTE.taillightRed, { emissive: LOW_POLY_PALETTE.taillightRed, emissiveIntensity: 0.85 })
  );

  patchObjectHierarchy(root);
  validateModelAlignment(root, 'car');
  return root;
}

/**
 * 2. SEDAN FACTORY: createSedan(color)
 * Spec: 4.5m (L) x 1.8m (W) x 1.45m (H), wheelRadius = 0.35m, clearance = 0.20m
 */
export function createSedan(color?: number): THREE.Group {
  const spec = VEHICLE_SPECS.sedan;
  const bodyColor = color ?? spec.defaultColor;
  const { width: W, length: L, height: H, wheelRadius: R, clearance: C } = spec;

  const { root, bodyGroup, wheels } = initVehicleRoot(spec);
  addFourSymmetricWheels(root, wheels, spec);

  const chassisBottom = R + C; // 0.55m
  const lowerH = 0.43;         // 0.55m -> 0.98m
  const lowerTop = chassisBottom + lowerH;
  const cabinH = H - lowerTop; // 0.47m (0.98m -> 1.45m = H)
  const cabinW = W * 0.86;
  const cabinL = L * 0.46;
  const cabinZ = L * 0.02;     // Three-box sedan profile: long hood at -Z, trunk at +Z

  const bodyGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const winGeos: THREE.BufferGeometry[] = [];
  const headGeos: THREE.BufferGeometry[] = [];
  const tailGeos: THREE.BufferGeometry[] = [];

  bodyGeos.push(
    makeBoxGeo(W, lowerH, L, { x: 0, y: chassisBottom + lowerH / 2, z: 0 }),
    makeBoxGeo(cabinW, cabinH, cabinL, { x: 0, y: lowerTop + cabinH / 2, z: cabinZ })
  );

  const bumperH = 0.14;
  const bumperD = 0.12;
  trimGeos.push(
    makeBoxGeo(W, bumperH, bumperD, { x: 0, y: chassisBottom + bumperH / 2, z: -L / 2 + bumperD / 2 }),
    makeBoxGeo(W, bumperH, bumperD, { x: 0, y: chassisBottom + bumperH / 2, z: +L / 2 - bumperD / 2 }),
    makeBoxGeo(W * 0.44, 0.14, 0.04, { x: 0, y: chassisBottom + 0.25, z: -L / 2 + 0.02 })
  );

  const winH = cabinH * 0.72;
  const winY = lowerTop + cabinH * 0.52;
  winGeos.push(
    makeBoxGeo(cabinW * 0.88, winH, 0.04, { x: 0, y: winY, z: cabinZ - cabinL / 2 }),
    makeBoxGeo(cabinW * 0.86, winH, 0.04, { x: 0, y: winY, z: cabinZ + cabinL / 2 }),
    makeBoxGeo(cabinW + 0.02, winH, cabinL * 0.42, { x: 0, y: winY, z: cabinZ - cabinL * 0.22 }),
    makeBoxGeo(cabinW + 0.02, winH, cabinL * 0.40, { x: 0, y: winY, z: cabinZ + cabinL * 0.22 })
  );

  const lightW = W * 0.19;
  const lightH = 0.12;
  const lightD = 0.04;
  const lightX = W * 0.34;
  const lightY = chassisBottom + 0.26;
  for (const side of [-1, 1]) {
    headGeos.push(makeBoxGeo(lightW, lightH, lightD, { x: side * lightX, y: lightY, z: -L / 2 + lightD / 2 }));
    tailGeos.push(makeBoxGeo(lightW, lightH, lightD, { x: side * lightX, y: lightY, z: +L / 2 - lightD / 2 }));
  }

  bodyGroup.add(
    buildMergedMesh(bodyGeos, bodyColor),
    buildMergedMesh(trimGeos, LOW_POLY_PALETTE.bumperDark, { roughness: 0.8 }),
    buildMergedMesh(winGeos, LOW_POLY_PALETTE.windowDarkBlue, { roughness: 0.2, metalness: 0.5 }),
    buildMergedMesh(headGeos, LOW_POLY_PALETTE.headlightWarm, { emissive: LOW_POLY_PALETTE.headlightWarm, emissiveIntensity: 0.9 }),
    buildMergedMesh(tailGeos, LOW_POLY_PALETTE.taillightRed, { emissive: LOW_POLY_PALETTE.taillightRed, emissiveIntensity: 0.85 })
  );

  patchObjectHierarchy(root);
  validateModelAlignment(root, 'sedan');
  return root;
}

/**
 * 3. AMBULANCE (VAN) FACTORY: createAmbulance(color)
 * Spec: 5.2m (L) x 2.0m (W) x 2.4m (H), wheelRadius = 0.45m, clearance = 0.20m
 * Ambulance specifics:
 * - White body
 * - Red stripe running the full length at a constant height
 * - Siren bars on the roof centered on X
 * - Red cross on the sides and back
 */
export function createAmbulance(color?: number): THREE.Group {
  const spec = VEHICLE_SPECS.ambulance;
  const bodyColor = color ?? LOW_POLY_PALETTE.ambulanceWhite;
  const { width: W, length: L, height: H, wheelRadius: R, clearance: C } = spec;

  const { root, bodyGroup, wheels } = initVehicleRoot(spec);
  addFourSymmetricWheels(root, wheels, spec);

  const chassisBottom = R + C; // 0.65m
  const lowerH = 0.60;         // 0.65m -> 1.25m
  const lowerTop = chassisBottom + lowerH;
  const sirenTotalH = 0.16;    // Top 0.16m reserved for roof siren bar (2.24m -> 2.40m = H)
  const vanBoxTop = H - sirenTotalH; // 2.24m
  const vanBoxH = vanBoxTop - lowerTop; // 0.99m
  const hoodL = L * 0.16;      // 0.832m front nose
  const vanBoxL = L - hoodL;   // 4.368m main cab + medical bay
  const vanBoxZ = hoodL / 2;   // Centered toward rear so front nose is at -L/2

  const whiteGeos: THREE.BufferGeometry[] = [];
  const redGeos: THREE.BufferGeometry[] = [];
  const blueSirenGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const winGeos: THREE.BufferGeometry[] = [];
  const headGeos: THREE.BufferGeometry[] = [];

  // White body: lower chassis (full L x W) + upper medical box/cab
  whiteGeos.push(
    makeBoxGeo(W, lowerH, L, { x: 0, y: chassisBottom + lowerH / 2, z: 0 }),
    makeBoxGeo(W * 0.96, vanBoxH, vanBoxL, { x: 0, y: lowerTop + vanBoxH / 2, z: vanBoxZ }),
    // Siren central white mount on roof centered on X
    makeBoxGeo(W * 0.56, 0.06, 0.28, { x: 0, y: vanBoxTop + 0.03, z: -L * 0.22 })
  );

  // Full-length red stripe running at a constant height (y = 1.12m) along sides & ends
  const stripeH = 0.18;
  const stripeY = chassisBottom + 0.46;
  redGeos.push(
    makeBoxGeo(W, stripeH, L, { x: 0, y: stripeY, z: 0 })
  );

  // Red Crosses on left side, right side, and rear doors
  const crossArmLong = 0.48;
  const crossArmShort = 0.15;
  const crossY = lowerTop + vanBoxH * 0.52;
  const sideCrossZ = L * 0.14;
  const sideCrossSpanX = W * 0.96 + 0.03;
  // Side crosses (spanning across X so visible on both -X and +X faces)
  redGeos.push(
    makeBoxGeo(sideCrossSpanX, crossArmLong, crossArmShort, { x: 0, y: crossY, z: sideCrossZ }),
    makeBoxGeo(sideCrossSpanX, crossArmShort, crossArmLong, { x: 0, y: crossY, z: sideCrossZ }),
    // Rear door cross (flush with +Z back face)
    makeBoxGeo(crossArmShort, crossArmLong, 0.04, { x: 0, y: crossY, z: +L / 2 - 0.02 }),
    makeBoxGeo(crossArmLong, crossArmShort, 0.04, { x: 0, y: crossY, z: +L / 2 - 0.02 })
  );

  // Roof Siren Bars centered on X (top reaches vanBoxTop + sirenTotalH = H = 2.40m exact)
  const sirenBarH = sirenTotalH - 0.06; // 0.10m
  const sirenBarY = vanBoxTop + 0.06 + sirenBarH / 2;
  const sirenZ = -L * 0.22;
  redGeos.push(
    makeBoxGeo(W * 0.24, sirenBarH, 0.24, { x: -W * 0.14, y: sirenBarY, z: sirenZ }),
    // Rear taillights flush at +Z
    makeBoxGeo(W * 0.16, 0.16, 0.04, { x: -W * 0.36, y: chassisBottom + 0.28, z: +L / 2 - 0.02 }),
    makeBoxGeo(W * 0.16, 0.16, 0.04, { x: +W * 0.36, y: chassisBottom + 0.28, z: +L / 2 - 0.02 })
  );
  blueSirenGeos.push(
    makeBoxGeo(W * 0.24, sirenBarH, 0.24, { x: +W * 0.14, y: sirenBarY, z: sirenZ })
  );

  // Bumpers & front grille
  const bumperH = 0.16;
  const bumperD = 0.12;
  trimGeos.push(
    makeBoxGeo(W, bumperH, bumperD, { x: 0, y: chassisBottom + bumperH / 2, z: -L / 2 + bumperD / 2 }),
    makeBoxGeo(W, bumperH, bumperD, { x: 0, y: chassisBottom + bumperH / 2, z: +L / 2 - bumperD / 2 }),
    makeBoxGeo(W * 0.45, 0.22, 0.04, { x: 0, y: chassisBottom + 0.30, z: -L / 2 + 0.02 })
  );

  // Dark-blue cab windshield (-Z), side cab windows, and rear door windows (+Z)
  const winH = vanBoxH * 0.52;
  const winY = lowerTop + vanBoxH * 0.58;
  const frontCabZ = vanBoxZ - vanBoxL / 2;
  winGeos.push(
    makeBoxGeo(W * 0.84, winH, 0.04, { x: 0, y: winY, z: frontCabZ }),
    makeBoxGeo(W * 0.96 + 0.02, winH, 0.82, { x: 0, y: winY, z: frontCabZ + 0.56 }),
    makeBoxGeo(W * 0.32, winH * 0.75, 0.04, { x: -W * 0.22, y: winY + 0.05, z: +L / 2 - 0.02 }),
    makeBoxGeo(W * 0.32, winH * 0.75, 0.04, { x: +W * 0.22, y: winY + 0.05, z: +L / 2 - 0.02 })
  );

  // Front headlights flush at -Z
  for (const side of [-1, 1]) {
    headGeos.push(
      makeBoxGeo(W * 0.18, 0.16, 0.04, { x: side * W * 0.35, y: chassisBottom + 0.30, z: -L / 2 + 0.02 })
    );
  }

  bodyGroup.add(
    buildMergedMesh(whiteGeos, bodyColor, { roughness: 0.45 }),
    buildMergedMesh(redGeos, LOW_POLY_PALETTE.ambulanceRed, {
      emissive: LOW_POLY_PALETTE.ambulanceRed,
      emissiveIntensity: 0.35
    }),
    buildMergedMesh(blueSirenGeos, LOW_POLY_PALETTE.sirenBlue, {
      emissive: LOW_POLY_PALETTE.sirenBlue,
      emissiveIntensity: 0.85
    }),
    buildMergedMesh(trimGeos, LOW_POLY_PALETTE.bumperDark, { roughness: 0.8 }),
    buildMergedMesh(winGeos, LOW_POLY_PALETTE.windowDarkBlue, { roughness: 0.2, metalness: 0.5 }),
    buildMergedMesh(headGeos, LOW_POLY_PALETTE.headlightWarm, {
      emissive: LOW_POLY_PALETTE.headlightWarm,
      emissiveIntensity: 0.9
    })
  );

  patchObjectHierarchy(root);
  validateModelAlignment(root, 'ambulance');
  return root;
}

/**
 * 4. AUTO-RICKSHAW FACTORY: createAuto(color)
 * Spec: 2.6m (L) x 1.3m (W) x 1.7m (H), wheelRadius = 0.26m, clearance = 0.16m
 * Iconic Indian/Pakistani 3-wheeled green-and-yellow auto-rickshaw.
 */
export function createAuto(color?: number): THREE.Group {
  const spec = VEHICLE_SPECS.auto;
  const lowerColor = color ?? LOW_POLY_PALETTE.autoGreen;
  const canopyColor = LOW_POLY_PALETTE.autoYellow;
  const { width: W, length: L, height: H, wheelRadius: R, wheelWidth: WW, clearance: C } = spec;

  const { root, bodyGroup, wheels } = initVehicleRoot(spec);

  // 3 symmetrical wheels: 1 centered front wheel (-Z), 2 mirrored rear wheels (+Z)
  const rearX = W / 2 - WW / 2;
  const wheelZ = L * spec.wheelbaseRatio;
  const wFront = placePart(createWheel(R, WW), { x: 0, y: R, z: -wheelZ });
  const wRearL = placePart(createWheel(R, WW), { x: -rearX, y: R, z: +wheelZ });
  const wRearR = placePart(createWheel(R, WW), { x: +rearX, y: R, z: +wheelZ });
  root.add(wFront, wRearL, wRearR);
  wheels.push(wFront, wRearL, wRearR);

  const chassisBottom = R + C; // 0.42m
  const tubH = 0.50;           // 0.42m -> 0.92m
  const tubTop = chassisBottom + tubH;
  const roofH = 0.16;          // Canopy roof top at H = 1.70m (1.54m -> 1.70m)
  const roofBottom = H - roofH;
  const pillarH = roofBottom - tubTop; // 0.62m

  const greenGeos: THREE.BufferGeometry[] = [];
  const yellowGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const winGeos: THREE.BufferGeometry[] = [];
  const headGeos: THREE.BufferGeometry[] = [];
  const tailGeos: THREE.BufferGeometry[] = [];

  // Green lower body tub (full L x W) + front driver apron shield
  greenGeos.push(
    makeBoxGeo(W, tubH, L, { x: 0, y: chassisBottom + tubH / 2, z: 0 }),
    makeBoxGeo(W * 0.88, pillarH, 0.22, { x: 0, y: tubTop + pillarH / 2, z: -L * 0.30 })
  );

  // Yellow canopy roof (top at H = 1.70m) + rear backrest + lower yellow side band
  const canopyL = L * 0.82;
  const canopyZ = L * 0.05;
  yellowGeos.push(
    makeBoxGeo(W * 0.96, roofH, canopyL, { x: 0, y: roofBottom + roofH / 2, z: canopyZ }),
    makeBoxGeo(W * 0.92, pillarH, 0.16, { x: 0, y: tubTop + pillarH / 2, z: +L / 2 - 0.12 }),
    makeBoxGeo(W, 0.12, L, { x: 0, y: chassisBottom + 0.08, z: 0 })
  );

  // Symmetrical roof support pillars, seat bench, bumpers
  const postX = W * 0.44;
  for (const side of [-1, 1]) {
    trimGeos.push(
      makeBoxGeo(0.05, pillarH, 0.05, { x: side * postX, y: tubTop + pillarH / 2, z: -L * 0.28 }),
      makeBoxGeo(0.05, pillarH, 0.05, { x: side * postX, y: tubTop + pillarH / 2, z: +L * 0.38 })
    );
  }
  trimGeos.push(
    makeBoxGeo(W * 0.84, 0.14, 0.55, { x: 0, y: tubTop + 0.07, z: +L * 0.18 }),
    makeBoxGeo(W, 0.10, 0.10, { x: 0, y: chassisBottom + 0.05, z: -L / 2 + 0.05 }),
    makeBoxGeo(W, 0.10, 0.10, { x: 0, y: chassisBottom + 0.05, z: +L / 2 - 0.05 })
  );

  // Inset dark-blue front windshield
  winGeos.push(
    makeBoxGeo(W * 0.76, pillarH * 0.72, 0.04, { x: 0, y: tubTop + pillarH * 0.54, z: -L * 0.30 - 0.10 })
  );

  // Central cyclops headlight + front indicators at -Z, taillights at +Z
  headGeos.push(
    makeBoxGeo(0.22, 0.20, 0.04, { x: 0, y: chassisBottom + 0.32, z: -L / 2 + 0.02 })
  );
  for (const side of [-1, 1]) {
    tailGeos.push(
      makeBoxGeo(0.20, 0.12, 0.04, { x: side * W * 0.34, y: chassisBottom + 0.28, z: +L / 2 - 0.02 })
    );
  }

  bodyGroup.add(
    buildMergedMesh(greenGeos, lowerColor),
    buildMergedMesh(yellowGeos, canopyColor),
    buildMergedMesh(trimGeos, LOW_POLY_PALETTE.bumperDark, { roughness: 0.8 }),
    buildMergedMesh(winGeos, LOW_POLY_PALETTE.windowDarkBlue, { roughness: 0.2, metalness: 0.5 }),
    buildMergedMesh(headGeos, LOW_POLY_PALETTE.headlightWarm, { emissive: LOW_POLY_PALETTE.headlightWarm, emissiveIntensity: 0.95 }),
    buildMergedMesh(tailGeos, LOW_POLY_PALETTE.taillightRed, { emissive: LOW_POLY_PALETTE.taillightRed, emissiveIntensity: 0.85 })
  );

  patchObjectHierarchy(root);
  validateModelAlignment(root, 'auto');
  return root;
}

/**
 * 5. BUS FACTORY: createBus(color)
 * Spec: 10.0m (L) x 2.5m (W) x 3.2m (H), wheelRadius = 0.50m, clearance = 0.20m
 */
export function createBus(color?: number): THREE.Group {
  const spec = VEHICLE_SPECS.bus;
  const bodyColor = color ?? spec.defaultColor;
  const { width: W, length: L, height: H, wheelRadius: R, clearance: C } = spec;

  const { root, bodyGroup, wheels } = initVehicleRoot(spec);
  addFourSymmetricWheels(root, wheels, spec);

  const chassisBottom = R + C; // 0.70m
  const acUnitH = 0.16;        // Roof AC unit at top (3.04m -> 3.20m = H)
  const mainBodyH = H - acUnitH - chassisBottom; // 2.34m (0.70m -> 3.04m)
  const mainTop = chassisBottom + mainBodyH;

  const bodyGeos: THREE.BufferGeometry[] = [];
  const stripeGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const winGeos: THREE.BufferGeometry[] = [];
  const headGeos: THREE.BufferGeometry[] = [];
  const tailGeos: THREE.BufferGeometry[] = [];

  bodyGeos.push(
    makeBoxGeo(W, mainBodyH, L, { x: 0, y: chassisBottom + mainBodyH / 2, z: 0 })
  );
  stripeGeos.push(
    makeBoxGeo(W, 0.24, L, { x: 0, y: chassisBottom + 0.85, z: 0 }),
    makeBoxGeo(W * 0.64, acUnitH, L * 0.45, { x: 0, y: mainTop + acUnitH / 2, z: 0 })
  );

  // Bumpers & front grille
  trimGeos.push(
    makeBoxGeo(W, 0.22, 0.16, { x: 0, y: chassisBottom + 0.11, z: -L / 2 + 0.08 }),
    makeBoxGeo(W, 0.22, 0.16, { x: 0, y: chassisBottom + 0.11, z: +L / 2 - 0.08 }),
    makeBoxGeo(W * 0.52, 0.32, 0.04, { x: 0, y: chassisBottom + 0.45, z: -L / 2 + 0.02 })
  );

  // Front panoramic windshield (-Z), rear window (+Z), and 6 symmetric side windows
  const winY = chassisBottom + mainBodyH * 0.66;
  const winH = 0.78;
  winGeos.push(
    makeBoxGeo(W * 0.88, 0.92, 0.04, { x: 0, y: winY, z: -L / 2 + 0.02 }),
    makeBoxGeo(W * 0.82, 0.72, 0.04, { x: 0, y: winY, z: +L / 2 - 0.02 })
  );
  const numSideWins = 6;
  const spanZ = L * 0.82;
  const stepZ = spanZ / numSideWins;
  for (let i = 0; i < numSideWins; i++) {
    const wz = -spanZ / 2 + stepZ * (i + 0.5);
    winGeos.push(makeBoxGeo(W, winH, stepZ * 0.76, { x: 0, y: winY, z: wz }));
  }

  for (const side of [-1, 1]) {
    headGeos.push(
      makeBoxGeo(0.36, 0.20, 0.04, { x: side * W * 0.36, y: chassisBottom + 0.42, z: -L / 2 + 0.02 })
    );
    tailGeos.push(
      makeBoxGeo(0.36, 0.22, 0.04, { x: side * W * 0.36, y: chassisBottom + 0.42, z: +L / 2 - 0.02 })
    );
  }
  // Illuminated destination board above windshield at -Z
  headGeos.push(
    makeBoxGeo(W * 0.56, 0.22, 0.04, { x: 0, y: mainTop - 0.22, z: -L / 2 + 0.02 })
  );

  bodyGroup.add(
    buildMergedMesh(bodyGeos, bodyColor),
    buildMergedMesh(stripeGeos, 0xfef3c7),
    buildMergedMesh(trimGeos, LOW_POLY_PALETTE.bumperDark, { roughness: 0.8 }),
    buildMergedMesh(winGeos, LOW_POLY_PALETTE.windowDarkBlue, { roughness: 0.2, metalness: 0.5 }),
    buildMergedMesh(headGeos, LOW_POLY_PALETTE.headlightWarm, { emissive: LOW_POLY_PALETTE.headlightWarm, emissiveIntensity: 0.9 }),
    buildMergedMesh(tailGeos, LOW_POLY_PALETTE.taillightRed, { emissive: LOW_POLY_PALETTE.taillightRed, emissiveIntensity: 0.85 })
  );

  patchObjectHierarchy(root);
  validateModelAlignment(root, 'bus');
  return root;
}

/**
 * 6. TRUCK FACTORY: createTruck(color)
 * Spec: 8.0m (L) x 2.4m (W) x 3.2m (H), wheelRadius = 0.50m, clearance = 0.20m
 */
export function createTruck(color?: number): THREE.Group {
  const spec = VEHICLE_SPECS.truck;
  const cabColor = color ?? spec.defaultColor;
  const { width: W, length: L, height: H, wheelRadius: R, clearance: C } = spec;

  const { root, bodyGroup, wheels } = initVehicleRoot(spec);
  addFourSymmetricWheels(root, wheels, spec);

  const chassisBottom = R + C; // 0.70m
  const frameH = 0.42;         // 0.70m -> 1.12m
  const frameTop = chassisBottom + frameH;
  const cargoH = H - frameTop; // 2.08m (1.12m -> 3.20m = H)

  const cabL = L * 0.28;       // 2.24m front cab at -Z
  const cabZ = -L / 2 + cabL / 2;
  const cargoL = L * 0.69;     // 5.52m rear cargo container at +Z
  const cargoZ = +L / 2 - cargoL / 2;

  const cabGeos: THREE.BufferGeometry[] = [];
  const cargoGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const winGeos: THREE.BufferGeometry[] = [];
  const headGeos: THREE.BufferGeometry[] = [];
  const tailGeos: THREE.BufferGeometry[] = [];

  // Front driver cab + luton crown peak reaching H = 3.20m
  const cabMainH = cargoH * 0.84;
  const crownH = cargoH - cabMainH;
  cabGeos.push(
    makeBoxGeo(W * 0.96, cabMainH, cabL, { x: 0, y: frameTop + cabMainH / 2, z: cabZ }),
    makeBoxGeo(W * 0.88, crownH, cabL * 0.65, { x: 0, y: frameTop + cabMainH + crownH / 2, z: cabZ + cabL * 0.1 })
  );

  // Rear cargo container reaching H = 3.20m and +L/2
  cargoGeos.push(
    makeBoxGeo(W, cargoH, cargoL, { x: 0, y: frameTop + cargoH / 2, z: cargoZ })
  );

  // Full-length steel chassis frame & bumpers spanning exact L x W
  trimGeos.push(
    makeBoxGeo(W, frameH, L, { x: 0, y: chassisBottom + frameH / 2, z: 0 }),
    makeBoxGeo(W * 0.54, 0.48, 0.04, { x: 0, y: frameTop + 0.34, z: -L / 2 + 0.02 })
  );

  // Cab windshield (-Z) and side windows
  const winY = frameTop + cabMainH * 0.68;
  const winH = 0.62;
  winGeos.push(
    makeBoxGeo(W * 0.84, winH, 0.04, { x: 0, y: winY, z: -L / 2 + 0.02 }),
    makeBoxGeo(W * 0.96 + 0.02, winH, cabL * 0.56, { x: 0, y: winY, z: cabZ })
  );

  for (const side of [-1, 1]) {
    headGeos.push(
      makeBoxGeo(0.34, 0.20, 0.04, { x: side * W * 0.35, y: chassisBottom + 0.24, z: -L / 2 + 0.02 })
    );
    tailGeos.push(
      makeBoxGeo(0.34, 0.20, 0.04, { x: side * W * 0.35, y: chassisBottom + 0.24, z: +L / 2 - 0.02 })
    );
  }

  bodyGroup.add(
    buildMergedMesh(cabGeos, cabColor),
    buildMergedMesh(cargoGeos, 0x15803d),
    buildMergedMesh(trimGeos, LOW_POLY_PALETTE.bumperDark, { roughness: 0.8 }),
    buildMergedMesh(winGeos, LOW_POLY_PALETTE.windowDarkBlue, { roughness: 0.2, metalness: 0.5 }),
    buildMergedMesh(headGeos, LOW_POLY_PALETTE.headlightWarm, { emissive: LOW_POLY_PALETTE.headlightWarm, emissiveIntensity: 0.9 }),
    buildMergedMesh(tailGeos, LOW_POLY_PALETTE.taillightRed, { emissive: LOW_POLY_PALETTE.taillightRed, emissiveIntensity: 0.85 })
  );

  patchObjectHierarchy(root);
  validateModelAlignment(root, 'truck');
  return root;
}

/**
 * 7. MOTORCYCLE FACTORY: createBike(color)
 * Spec: 2.0m (L) x 0.8m (W) x 1.1m (H), wheelRadius = 0.30m, clearance = 0.15m
 */
export function createBike(color?: number): THREE.Group {
  const spec = VEHICLE_SPECS.bike;
  const tankColor = color ?? spec.defaultColor;
  const { width: W, length: L, height: H, wheelRadius: R, wheelWidth: WW, clearance: C } = spec;

  const { root, bodyGroup, wheels } = initVehicleRoot(spec);

  // 2 inline wheels centered on X = 0, y = R, z = ±(L/2 - R) so outer tire edges hit ±L/2 exactly
  const wheelZ = L / 2 - R; // 0.70m (0.70 + 0.30 = 1.00m = L/2)
  const wFront = placePart(createWheel(R, WW), { x: 0, y: R, z: -wheelZ });
  const wRear = placePart(createWheel(R, WW), { x: 0, y: R, z: +wheelZ });
  root.add(wFront, wRear);
  wheels.push(wFront, wRear);

  const chassisBottom = R + C; // 0.45m
  const tankGeos: THREE.BufferGeometry[] = [];
  const trimGeos: THREE.BufferGeometry[] = [];
  const headGeos: THREE.BufferGeometry[] = [];
  const tailGeos: THREE.BufferGeometry[] = [];

  // Fuel tank, front cowl, rear tail fairing
  tankGeos.push(
    makeBoxGeo(0.28, 0.24, 0.52, { x: 0, y: chassisBottom + 0.32, z: -0.14 }),
    makeBoxGeo(0.24, 0.20, 0.22, { x: 0, y: chassisBottom + 0.40, z: -0.52 }),
    makeBoxGeo(0.24, 0.14, 0.42, { x: 0, y: chassisBottom + 0.26, z: +0.44 })
  );

  // Engine block, saddle seat, front forks, and full-width handlebars (spanning W = 0.8m, top at H = 1.1m)
  const barH = 0.08;
  const barY = H - barH / 2; // Top reaches H = 1.10m exact
  trimGeos.push(
    makeBoxGeo(0.24, 0.26, 0.44, { x: 0, y: chassisBottom + 0.13, z: -0.05 }),
    makeBoxGeo(0.26, 0.12, 0.54, { x: 0, y: chassisBottom + 0.28, z: +0.26 }),
    makeBoxGeo(0.18, 0.46, 0.10, { x: 0, y: chassisBottom + 0.28, z: -0.48 }),
    // Handlebar & grips spanning exact W = 0.80m and reaching H = 1.10m
    makeBoxGeo(W, barH, 0.08, { x: 0, y: barY, z: -0.44 }),
    // Footpegs mirrored on X
    makeBoxGeo(W * 0.72, 0.05, 0.06, { x: 0, y: chassisBottom + 0.04, z: +0.05 })
  );

  // Headlight at front (-Z) and taillight at rear (+Z)
  headGeos.push(makeBoxGeo(0.18, 0.14, 0.06, { x: 0, y: chassisBottom + 0.38, z: -0.64 }));
  tailGeos.push(makeBoxGeo(0.16, 0.10, 0.06, { x: 0, y: chassisBottom + 0.26, z: +0.66 }));

  bodyGroup.add(
    buildMergedMesh(tankGeos, tankColor),
    buildMergedMesh(trimGeos, LOW_POLY_PALETTE.bumperDark, { roughness: 0.75 }),
    buildMergedMesh(headGeos, LOW_POLY_PALETTE.headlightWarm, { emissive: LOW_POLY_PALETTE.headlightWarm, emissiveIntensity: 0.95 }),
    buildMergedMesh(tailGeos, LOW_POLY_PALETTE.taillightRed, { emissive: LOW_POLY_PALETTE.taillightRed, emissiveIntensity: 0.85 })
  );

  patchObjectHierarchy(root);
  validateModelAlignment(root, 'bike');
  return root;
}

/**
 * 8. PEDESTRIAN FACTORY: createPedestrianModel(color)
 * Spec: 0.5m (L / Z stride) x 0.3m (W / X width) x 1.7m (H / Y height)
 * Grounded at y = 0.00m, facing -Z.
 */
export function createPedestrianModel(color?: number): THREE.Group {
  const spec = VEHICLE_SPECS.pedestrian;
  const shirtColor = color ?? spec.defaultColor;
  const { width: W, length: L, height: H } = spec;

  const root = new THREE.Group();
  root.name = 'Vehicle_pedestrian';
  root.userData.isVehicleRoot = true;
  root.userData.specId = 'pedestrian';

  const shadow = createBlobShadow(W * 0.95, L * 0.95, 0.35);
  shadow.position.set(0, 0.01, 0);
  root.add(shadow);
  root.userData.groundShadow = shadow;

  const shoeH = 0.12;
  const legH = 0.64;     // 0.12 -> 0.76
  const torsoH = 0.62;   // 0.76 -> 1.38
  const headH = H - (shoeH + legH + torsoH); // 0.32 (1.38 -> 1.70 = H)

  const shirtGeos: THREE.BufferGeometry[] = [];
  const pantsGeos: THREE.BufferGeometry[] = [];
  const skinGeos: THREE.BufferGeometry[] = [];
  const darkGeos: THREE.BufferGeometry[] = [];

  // Walking stride spanning exact L = 0.50m along Z (front shoe toe at -L/2, rear shoe heel at +L/2)
  const shoeL = 0.24;
  const shoeW = W * 0.38;
  const legX = W * 0.24;
  const frontShoeZ = -L / 2 + shoeL / 2;
  const rearShoeZ = +L / 2 - shoeL / 2;

  darkGeos.push(
    makeBoxGeo(shoeW, shoeH, shoeL, { x: -legX, y: shoeH / 2, z: frontShoeZ }),
    makeBoxGeo(shoeW, shoeH, shoeL, { x: +legX, y: shoeH / 2, z: rearShoeZ }),
    // Hair cap at top of head reaching H = 1.70m exact
    makeBoxGeo(W * 0.68, 0.08, 0.22, { x: 0, y: H - 0.04, z: 0 })
  );

  pantsGeos.push(
    makeBoxGeo(shoeW, legH, 0.16, { x: -legX, y: shoeH + legH / 2, z: frontShoeZ * 0.45 }),
    makeBoxGeo(shoeW, legH, 0.16, { x: +legX, y: shoeH + legH / 2, z: rearShoeZ * 0.45 })
  );

  // Torso + arms spanning exact W = 0.30m on X
  shirtGeos.push(
    makeBoxGeo(W, torsoH, 0.22, { x: 0, y: shoeH + legH + torsoH / 2, z: 0 })
  );

  skinGeos.push(
    makeBoxGeo(W * 0.64, headH - 0.06, 0.20, { x: 0, y: shoeH + legH + torsoH + (headH - 0.06) / 2, z: 0 })
  );

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'BodyGroup';
  bodyGroup.add(
    buildMergedMesh(shirtGeos, shirtColor),
    buildMergedMesh(pantsGeos, LOW_POLY_PALETTE.pedestrianPants[0]),
    buildMergedMesh(skinGeos, 0xd97706),
    buildMergedMesh(darkGeos, LOW_POLY_PALETTE.tireRubber)
  );

  root.add(bodyGroup);
  root.userData.bodyGroup = bodyGroup;
  root.userData.suspensionPivot = bodyGroup;

  patchObjectHierarchy(root);
  validateModelAlignment(root, 'pedestrian');
  return root;
}

// ============================================================================
// PLAYABLE VEHICLE ROSTER & GARAGE STATE (Mapped cleanly to VEHICLE_SPECS)
// ============================================================================

export interface VehicleHitbox {
  width: number;
  length: number;
  height: number;
}

export type SpecialAbilityType =
  | 'TURBO_BOOST'
  | 'CORNER_DRIFT'
  | 'RAMMING_TORQUE'
  | 'GROUND_EFFECTS'
  | 'SUPERSONIC_RUSH'
  | 'HORN_BLAST'
  | 'CARGO_BUMP'
  | 'SMASH_ARMOR'
  | 'NARROW_DODGE'
  | 'WOBBLE_DRIFT'
  | 'GAMMA_SMASH'
  | 'TRACTOR_CRUSH'
  | 'HORSE_SPRINT';

export interface VehicleDef {
  id: VehicleId;
  specKey: VehicleSpecKey;
  name: string;
  tagline: string;
  description: string;
  price: number;
  unlockedByDefault: boolean;
  hitbox: VehicleHitbox;
  jumpImpulse: number;
  laneSpeed: number;
  speedMultiplier: number;
  specialAbility: SpecialAbilityType;
  abilityDescription: string;
  enginePitch: number;
  hornTone: number;
  defaultColor: number;
  stats: {
    speed: number;
    agility: number;
    jump: number;
    armor: number;
  };
}

export const PLAYABLE_VEHICLES: Record<string, VehicleDef> = {
  rickshaw: {
    id: 'rickshaw',
    specKey: 'auto',
    name: 'Sultan Auto-Rickshaw',
    tagline: '2.6m × 1.3m × 1.7m Tuk-Tuk',
    description: 'Authentic 3-wheeled Indian/Pakistani auto-rickshaw built to exact 2.6 × 1.3 × 1.7m scale with pressure horn blast.',
    price: 0,
    unlockedByDefault: true,
    hitbox: {
      width: VEHICLE_SPECS.auto.width,
      length: VEHICLE_SPECS.auto.length,
      height: VEHICLE_SPECS.auto.height
    },
    jumpImpulse: 13.8,
    laneSpeed: 24.0,
    speedMultiplier: 1.0,
    specialAbility: 'HORN_BLAST',
    abilityDescription: 'Loud horn scatters pedestrians & cattle for bonus points',
    enginePitch: 36,
    hornTone: 410,
    defaultColor: 0x15803d,
    stats: { speed: 3, agility: 5, jump: 4, armor: 2 }
  },
  tuner_car: {
    id: 'tuner_car',
    specKey: 'car',
    name: 'City Hatchback',
    tagline: '3.8m × 1.7m × 1.5m Compact',
    description: 'Nimble street hatchback built to exact 3.8 × 1.7 × 1.5m scale with 0.35m wheels and responsive lane handling.',
    price: 0,
    unlockedByDefault: true,
    hitbox: {
      width: VEHICLE_SPECS.car.width,
      length: VEHICLE_SPECS.car.length,
      height: VEHICLE_SPECS.car.height
    },
    jumpImpulse: 14.2,
    laneSpeed: 26.0,
    speedMultiplier: 1.05,
    specialAbility: 'TURBO_BOOST',
    abilityDescription: 'Responsive street handling and smooth turbo acceleration',
    enginePitch: 52,
    hornTone: 560,
    defaultColor: 0x0284c7,
    stats: { speed: 4, agility: 5, jump: 4, armor: 3 }
  },
  motorbike: {
    id: 'motorbike',
    specKey: 'bike',
    name: 'Street Motorcycle',
    tagline: '2.0m × 0.8m × 1.1m Striker',
    description: 'Ultra-narrow 0.8m profile two-wheeler built to exact 2.0 × 0.8 × 1.1m scale. Glides effortlessly through tight traffic gaps.',
    price: 150,
    unlockedByDefault: false,
    hitbox: {
      width: VEHICLE_SPECS.bike.width,
      length: VEHICLE_SPECS.bike.length,
      height: VEHICLE_SPECS.bike.height
    },
    jumpImpulse: 14.5,
    laneSpeed: 28.0,
    speedMultiplier: 1.06,
    specialAbility: 'NARROW_DODGE',
    abilityDescription: '0.8m narrow profile earns double Near-Miss combo bonuses',
    enginePitch: 58,
    hornTone: 520,
    defaultColor: 0xdc2626,
    stats: { speed: 5, agility: 5, jump: 4, armor: 1 }
  },
  honda_del_sol: {
    id: 'honda_del_sol',
    specKey: 'sedan',
    name: 'Executive Sedan',
    tagline: '4.5m × 1.8m × 1.45m Saloon',
    description: 'Sleek three-box street sedan built to exact 4.5 × 1.8 × 1.45m scale with low 1.45m roofline and high top speed.',
    price: 300,
    unlockedByDefault: false,
    hitbox: {
      width: VEHICLE_SPECS.sedan.width,
      length: VEHICLE_SPECS.sedan.length,
      height: VEHICLE_SPECS.sedan.height
    },
    jumpImpulse: 14.0,
    laneSpeed: 25.0,
    speedMultiplier: 1.10,
    specialAbility: 'CORNER_DRIFT',
    abilityDescription: 'Low 1.45m center of gravity stabilizes high-speed lane switches',
    enginePitch: 56,
    hornTone: 600,
    defaultColor: 0xe11d48,
    stats: { speed: 5, agility: 4, jump: 4, armor: 3 }
  },
  bolan: {
    id: 'bolan',
    specKey: 'ambulance',
    name: 'City Rescue Ambulance',
    tagline: '5.2m × 2.0m × 2.4m Emergency Van',
    description: 'Emergency rescue van with white body, full-length red stripe, roof siren bar, and side/rear red crosses (5.2 × 2.0 × 2.4m).',
    price: 450,
    unlockedByDefault: false,
    hitbox: {
      width: VEHICLE_SPECS.ambulance.width,
      length: VEHICLE_SPECS.ambulance.length,
      height: VEHICLE_SPECS.ambulance.height
    },
    jumpImpulse: 14.0,
    laneSpeed: 22.0,
    speedMultiplier: 1.08,
    specialAbility: 'CARGO_BUMP',
    abilityDescription: 'Reinforced van bumper smashes light road hurdles without shield loss',
    enginePitch: 44,
    hornTone: 460,
    defaultColor: 0xf8fafc,
    stats: { speed: 4, agility: 3, jump: 4, armor: 4 }
  },
  truck: {
    id: 'truck',
    specKey: 'truck',
    name: 'Highway Cargo Truck',
    tagline: '8.0m × 2.4m × 3.2m Heavy Hauler',
    description: 'Heavy Indian highway truck built to exact 8.0 × 2.4 × 3.2m scale with 0.50m wheels. Absorbs 1 fatal crash per run.',
    price: 750,
    unlockedByDefault: false,
    hitbox: {
      width: VEHICLE_SPECS.truck.width,
      length: VEHICLE_SPECS.truck.length,
      height: VEHICLE_SPECS.truck.height
    },
    jumpImpulse: 12.5,
    laneSpeed: 18.0,
    speedMultiplier: 1.02,
    specialAbility: 'SMASH_ARMOR',
    abilityDescription: 'Heavy steel chassis absorbs 1 fatal vehicle crash completely',
    enginePitch: 30,
    hornTone: 280,
    defaultColor: 0xd97706,
    stats: { speed: 3, agility: 2, jump: 2, armor: 5 }
  }
};

const SKIN_COLOR_MAP: Record<RickshawSkin, number> = {
  badshahi: 0x15803d,
  karachi: 0x0284c7,
  peshawar: 0xdc2626,
  cyber: 0x7c3aed,
  multan: 0x1d4ed8,
  swat: 0x059669
};

/**
 * Builds a vehicle THREE.Group for any playable VehicleId using the unified factory system.
 */
export function createPlayableVehicleById(
  vehicleId: VehicleId,
  colorOrSkin?: number | RickshawSkin
): THREE.Group {
  const def = PLAYABLE_VEHICLES[vehicleId] || PLAYABLE_VEHICLES.rickshaw;
  let col = def.defaultColor;
  if (typeof colorOrSkin === 'number') {
    col = colorOrSkin;
  } else if (typeof colorOrSkin === 'string' && SKIN_COLOR_MAP[colorOrSkin]) {
    if (vehicleId === 'rickshaw' || vehicleId === 'chingchi') {
      col = SKIN_COLOR_MAP[colorOrSkin];
    }
  }
  switch (def.specKey) {
    case 'auto':
      return createAuto(col);
    case 'car':
      return createCar(col);
    case 'sedan':
      return createSedan(col);
    case 'ambulance':
      return createAmbulance(col);
    case 'bus':
      return createBus(col);
    case 'truck':
      return createTruck(col);
    case 'bike':
      return createBike(col);
    default:
      return createAuto(col);
  }
}

export interface MysteryTransformationDef {
  id: MysteryVehicleId;
  name: string;
  tagline: string;
  duration: number;
  ability: SpecialAbilityType;
  description: string;
}

export const MYSTERY_TRANSFORMATIONS: Record<MysteryVehicleId, MysteryTransformationDef> = {
  hulk: {
    id: 'hulk',
    name: 'Armored Juggernaut Truck',
    tagline: 'Unstoppable Highway Crusher',
    duration: 10.0,
    ability: 'GAMMA_SMASH',
    description: 'Crush all oncoming traffic, buses, hurdles, and roadblocks in an unstoppable 10s rampage!'
  },
  tractor: {
    id: 'tractor',
    name: 'Millat Desi Tractor',
    tagline: 'Heavy Industrial Crusher',
    duration: 10.0,
    ability: 'TRACTOR_CRUSH',
    description: 'Plow through cars, fruit carts, and hurdles with unstoppable raw torque!'
  },
  tonga: {
    id: 'tonga',
    name: 'Shahi Tonga Horse-Cart',
    tagline: 'Royal Street Trotter',
    duration: 10.0,
    ability: 'HORSE_SPRINT',
    description: 'Gallop at blinding speeds while vacuuming coins from all lanes!'
  }
};

const STORAGE_UNLOCKED_KEY = 'rickshaw_unlocked_vehicles';
const STORAGE_SELECTED_KEY = 'rickshaw_selected_vehicle';

export function getUnlockedVehicles(): VehicleId[] {
  try {
    const saved = localStorage.getItem(STORAGE_UNLOCKED_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((id) => Boolean(PLAYABLE_VEHICLES[id]));
        if (!valid.includes('rickshaw')) valid.unshift('rickshaw');
        if (!valid.includes('tuner_car')) valid.push('tuner_car');
        return valid as VehicleId[];
      }
    }
  } catch {
    // fallback
  }
  return ['rickshaw', 'tuner_car'];
}

export function unlockVehicle(id: VehicleId): boolean {
  const current = getUnlockedVehicles();
  if (!current.includes(id)) {
    current.push(id);
    localStorage.setItem(STORAGE_UNLOCKED_KEY, JSON.stringify(current));
    return true;
  }
  return false;
}

export function getSelectedVehicle(): VehicleId {
  const saved = localStorage.getItem(STORAGE_SELECTED_KEY) as VehicleId | null;
  if (saved && PLAYABLE_VEHICLES[saved]) {
    return saved;
  }
  return 'rickshaw';
}

export function setSelectedVehicle(id: VehicleId): void {
  localStorage.setItem(STORAGE_SELECTED_KEY, id);
}
