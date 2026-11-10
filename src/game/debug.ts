import * as THREE from 'three';
import { VEHICLE_SPECS, VehicleSpec, VehicleSpecKey, LANE_WIDTH } from './constants';
import { createGameMaterial } from './materials';
import { patchObjectHierarchy } from './curve';

export interface ModelValidationResult {
  specId: string;
  name: string;
  passed: boolean;
  expected: { length: number; width: number; height: number };
  measured: { length: number; width: number; height: number };
  deviationsPct: { length: number; width: number; height: number };
  minY: number;
  centerX: number;
  centerZ: number;
  warnings: string[];
}

/**
 * Computes the physical THREE.Box3 of a vehicle/prop model in its local root space,
 * ignoring blob shadow planes and debug helper overlays.
 */
export function computePhysicalBoundingBox(root: THREE.Object3D): THREE.Box3 {
  const savedPos = root.position.clone();
  const savedRot = root.rotation.clone();
  const savedScale = root.scale.clone();

  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();

  root.traverse((child) => {
    if (
      child.userData?.isBlobShadow ||
      child.userData?.isDebugHelper ||
      child.parent?.userData?.isDebugHelper
    ) {
      return;
    }
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }
      if (mesh.geometry.boundingBox) {
        meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        box.union(meshBox);
      }
    }
  });

  root.position.copy(savedPos);
  root.rotation.copy(savedRot);
  root.scale.copy(savedScale);
  root.updateMatrixWorld(true);

  return box;
}

/**
 * 5. ALIGNMENT VALIDATION
 * Computes THREE.Box3 bounding box and logs a warning if:
 * - min.y is not approximately 0 (tolerance 0.05m)
 * - length / width / height deviate more than 5% from VEHICLE_SPECS
 * - box center X or Z is not approximately 0 (tolerance 0.05m)
 * - width exceeds 2.6m (for 3.5m lane width)
 */
export function validateModelAlignment(
  model: THREE.Group,
  specKey: VehicleSpecKey | string,
  customSpec?: { id?: string; name?: string; length: number; width: number; height: number }
): ModelValidationResult {
  const spec: VehicleSpec | { id: string; name: string; length: number; width: number; height: number } =
    customSpec
      ? {
          id: customSpec.id || specKey,
          name: customSpec.name || specKey,
          length: customSpec.length,
          width: customSpec.width,
          height: customSpec.height
        }
      : VEHICLE_SPECS[specKey as VehicleSpecKey] || VEHICLE_SPECS.car;

  const box = computePhysicalBoundingBox(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  if (box.isEmpty()) {
    const emptyResult: ModelValidationResult = {
      specId: spec.id,
      name: spec.name,
      passed: false,
      expected: { length: spec.length, width: spec.width, height: spec.height },
      measured: { length: 0, width: 0, height: 0 },
      deviationsPct: { length: 100, width: 100, height: 100 },
      minY: 0,
      centerX: 0,
      centerZ: 0,
      warnings: [`[${spec.name}] Empty bounding box (no meshes found)`]
    };
    console.warn(emptyResult.warnings[0]);
    model.userData.validationResult = emptyResult;
    return emptyResult;
  }

  box.getSize(size);
  box.getCenter(center);

  const lengthDev = Math.abs(size.z - spec.length) / spec.length;
  const widthDev = Math.abs(size.x - spec.width) / spec.width;
  const heightDev = Math.abs(size.y - spec.height) / spec.height;

  const warnings: string[] = [];

  if (Math.abs(box.min.y) > 0.05) {
    warnings.push(
      `[${spec.name}] min.y = ${box.min.y.toFixed(3)}m (expected ~0.00m ground contact)`
    );
  }
  if (lengthDev > 0.05) {
    warnings.push(
      `[${spec.name}] length (Z) = ${size.z.toFixed(2)}m deviates ${(lengthDev * 100).toFixed(1)}% from spec ${spec.length}m`
    );
  }
  if (widthDev > 0.05) {
    warnings.push(
      `[${spec.name}] width (X) = ${size.x.toFixed(2)}m deviates ${(widthDev * 100).toFixed(1)}% from spec ${spec.width}m`
    );
  }
  if (heightDev > 0.05) {
    warnings.push(
      `[${spec.name}] height (Y) = ${size.y.toFixed(2)}m deviates ${(heightDev * 100).toFixed(1)}% from spec ${spec.height}m`
    );
  }
  if (Math.abs(center.x) > 0.05) {
    warnings.push(
      `[${spec.name}] center.x = ${center.x.toFixed(3)}m (expected ~0.00m symmetric X center)`
    );
  }
  if (Math.abs(center.z) > 0.05) {
    warnings.push(
      `[${spec.name}] center.z = ${center.z.toFixed(3)}m (expected ~0.00m footprint Z center)`
    );
  }
  if (size.x > 2.6) {
    warnings.push(
      `[${spec.name}] width ${size.x.toFixed(2)}m exceeds 2.6m limit for ${LANE_WIDTH}m lane`
    );
  }

  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`⚠️ MODEL VALIDATION WARNING: ${w}`));
  }

  const result: ModelValidationResult = {
    specId: spec.id,
    name: spec.name,
    passed: warnings.length === 0,
    expected: { length: spec.length, width: spec.width, height: spec.height },
    measured: {
      length: Number(size.z.toFixed(3)),
      width: Number(size.x.toFixed(3)),
      height: Number(size.y.toFixed(3))
    },
    deviationsPct: {
      length: Number((lengthDev * 100).toFixed(2)),
      width: Number((widthDev * 100).toFixed(2)),
      height: Number((heightDev * 100).toFixed(2))
    },
    minY: Number(box.min.y.toFixed(3)),
    centerX: Number(center.x.toFixed(3)),
    centerZ: Number(center.z.toFixed(3)),
    warnings
  };

  model.userData.validationResult = result;
  model.userData.physicalBox = box.clone();
  return result;
}

/**
 * Attaches a toggleable Debug Overlay (Box3Helper + AxesHelper + Forward -Z Indicator)
 * to a vehicle or prop root group.
 */
export function attachDebugHelpers(model: THREE.Group, visible: boolean = false): THREE.Group {
  let existing = model.children.find((c) => c.userData?.isDebugHelper) as THREE.Group | undefined;
  if (existing) {
    existing.visible = visible;
    return existing;
  }

  const box = model.userData.physicalBox || computePhysicalBoundingBox(model);
  const helperGroup = new THREE.Group();
  helperGroup.name = 'VehicleDebugHelper';
  helperGroup.userData.isDebugHelper = true;
  helperGroup.visible = visible;

  // 1. Wireframe Bounding Box (Green if valid, Red if warning)
  const isPassed = model.userData.validationResult?.passed !== false;
  const boxHelper = new THREE.Box3Helper(box, new THREE.Color(isPassed ? 0x22c55e : 0xef4444));
  boxHelper.userData.isDebugHelper = true;
  helperGroup.add(boxHelper);

  // 2. Coordinate Axes Helper at ground origin (0, 0, 0)
  // Red = +X (Right), Green = +Y (Up), Blue = +Z (Back)
  const axes = new THREE.AxesHelper(Math.max(box.max.z, 1.5) * 1.25);
  axes.position.set(0, 0.02, 0);
  axes.userData.isDebugHelper = true;
  helperGroup.add(axes);

  // 3. Cyan Forward (-Z) Direction Arrow so facing direction is unmistakable
  const forwardArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0.05, 0),
    Math.max(box.max.z, 1.2) + 0.6,
    0x06b6d4,
    0.35,
    0.22
  );
  forwardArrow.userData.isDebugHelper = true;
  helperGroup.add(forwardArrow);

  patchObjectHierarchy(helperGroup);
  model.add(helperGroup);
  model.userData.debugHelperGroup = helperGroup;
  return helperGroup;
}

/**
 * Toggles visibility of BoxHelpers and AxesHelpers on all vehicles in a scene or array.
 */
export function setSceneDebugHelpersVisible(scene: THREE.Scene, visible: boolean): void {
  scene.traverse((obj) => {
    if (obj.userData?.isVehicleRoot && obj instanceof THREE.Group) {
      const helper = attachDebugHelpers(obj, visible);
      helper.visible = visible;
    } else if (obj.userData?.isDebugHelper) {
      obj.visible = visible;
    }
  });
}

/**
 * Builds the "Model Showroom" inspection lineup containing every vehicle in VEHICLE_SPECS
 * lined up in a row on a ground grid at y = 0 with BoxHelpers and AxesHelpers visible.
 */
export function createModelShowroom(factories: {
  createCar: (color?: number) => THREE.Group;
  createSedan: (color?: number) => THREE.Group;
  createAmbulance: (color?: number) => THREE.Group;
  createAuto: (color?: number) => THREE.Group;
  createBus: (color?: number) => THREE.Group;
  createTruck: (color?: number) => THREE.Group;
  createBike: (color?: number) => THREE.Group;
  createPedestrian: (color?: number) => THREE.Group;
}): {
  showroomGroup: THREE.Group;
  models: { key: VehicleSpecKey; group: THREE.Group; x: number }[];
  validationResults: ModelValidationResult[];
} {
  const showroomGroup = new THREE.Group();
  showroomGroup.name = 'ModelShowroomGroup';

  // Showroom Ground Floor at y = -0.01 (so wheels at y = 0 sit cleanly on top)
  const floorGeo = new THREE.PlaneGeometry(46, 22);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = createGameMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.1
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -0.01, 0);
  showroomGroup.add(floor);

  // Showroom 1-meter Grid Helper at y = 0.002
  const grid = new THREE.GridHelper(44, 44, 0x38bdf8, 0x334155);
  grid.position.set(0, 0.002, 0);
  showroomGroup.add(grid);

  const entries: { key: VehicleSpecKey; build: () => THREE.Group }[] = [
    { key: 'car', build: () => factories.createCar() },
    { key: 'sedan', build: () => factories.createSedan() },
    { key: 'ambulance', build: () => factories.createAmbulance() },
    { key: 'auto', build: () => factories.createAuto() },
    { key: 'bus', build: () => factories.createBus() },
    { key: 'truck', build: () => factories.createTruck() },
    { key: 'bike', build: () => factories.createBike() },
    { key: 'pedestrian', build: () => factories.createPedestrian() }
  ];

  const spacing = 4.2;
  const startX = -((entries.length - 1) * spacing) / 2;
  const models: { key: VehicleSpecKey; group: THREE.Group; x: number }[] = [];
  const validationResults: ModelValidationResult[] = [];

  entries.forEach((entry, idx) => {
    const x = startX + idx * spacing;
    const model = entry.build();
    const res = validateModelAlignment(model, entry.key);
    validationResults.push(res);

    attachDebugHelpers(model, true);
    model.position.set(x, 0, 0);
    model.rotation.set(0, 0, 0); // Facing -Z by default
    showroomGroup.add(model);

    // 3.5m Lane Width Reference Strips under each vehicle slot
    const laneStripGeo = new THREE.PlaneGeometry(LANE_WIDTH, 11.0);
    laneStripGeo.rotateX(-Math.PI / 2);
    const laneStripMat = createGameMaterial({
      kind: 'basic',
      color: idx % 2 === 0 ? 0x0f172a : 0x172554,
      transparent: true,
      opacity: 0.45
    });
    const laneStrip = new THREE.Mesh(laneStripGeo, laneStripMat);
    laneStrip.position.set(x, 0.001, 0);
    showroomGroup.add(laneStrip);

    models.push({ key: entry.key, group: model, x });
  });

  patchObjectHierarchy(showroomGroup);
  return { showroomGroup, models, validationResults };
}

