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
import { smoothstep01, normalizeRampLanes } from './terrain';

export type CarType = 'HATCHBACK' | 'SEDAN' | 'SUV';

const _box3 = new THREE.Box3();

/**
 * Normalizes a procedural model's child geometries so its exact lowest base point sits at y = 0,
 * then attaches a curve-patched soft blob shadow at y = 0.02 if requested.
 */
export function normalizeModelBase(
  root: THREE.Group,
  addShadow: boolean = false,
  shadowW: number = 1.8,
  shadowL: number = 2.6
): THREE.Group {
  root.updateMatrixWorld(true);
  _box3.makeEmpty();

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && !mesh.userData?.isBlobShadow && !mesh.userData?.ignoreBaseNormalize) {
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

  if (!_box3.isEmpty() && Math.abs(_box3.min.y) > 1e-4) {
    const dy = -_box3.min.y;
    for (const child of root.children) {
      if (!child.userData?.isBlobShadow) {
        child.position.y += dy;
      }
    }
  }

  if (addShadow) {
    const hasExistingShadow = root.children.some((c) => c.userData?.isBlobShadow);
    if (!hasExistingShadow) {
      const shadow = createBlobShadow(shadowW, shadowL, 0.44);
      root.add(shadow);
      root.userData.groundShadow = shadow;
    }
  }

  patchObjectHierarchy(root);
  root.updateMatrixWorld(true);
  return root;
}

// Helper for realistic car wheels with alloy rims and brake discs
function createCarWheel(radius: number, width: number): THREE.Group {
  const wGroup = new THREE.Group();
  const rubberMat = createGameMaterial({ color: 0x111827, roughness: 0.9 });
  const alloyMat = createGameMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
  const discMat = createGameMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });

  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), rubberMat);
  tire.rotation.z = Math.PI / 2;
  wGroup.add(tire);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width * 1.05, 12), alloyMat);
  rim.rotation.z = Math.PI / 2;
  wGroup.add(rim);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, width * 0.9, 10), discMat);
  disc.rotation.z = Math.PI / 2;
  wGroup.add(disc);

  // Spring coil visual on wheel (visible when Jump Boost is active)
  const springMat = createGameMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.8 });
  const springCoil = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.55, 0.04, 6, 12), springMat);
  springCoil.rotation.x = Math.PI / 2;
  springCoil.position.y = -radius * 0.25;
  springCoil.visible = false;
  springCoil.userData.ignoreBaseNormalize = true;
  wGroup.add(springCoil);
  wGroup.userData.springCoil = springCoil;

  return wGroup;
}

// Helper to create an authentic Pakistani Auto-Rickshaw Wheel with rim bolts and curved mudguard
function createRickshawWheel(
  radius: number,
  width: number,
  rubberMat: THREE.Material,
  rimMat: THREE.Material,
  hubMat: THREE.Material
): THREE.Group {
  const wGroup = new THREE.Group();

  // Tire cylinder rotated so rolling axis is X (spins around X)
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), rubberMat);
  tire.rotation.z = Math.PI / 2;
  wGroup.add(tire);

  // Deep-dish steel rim with chrome lip
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 1.04, 14), rimMat);
  rim.rotation.z = Math.PI / 2;
  wGroup.add(rim);

  // Center axle hub with acorn nut detail
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, width * 1.15, 8), hubMat);
  hub.rotation.z = Math.PI / 2;
  wGroup.add(hub);

  // Jump Boost spring visual attachment point
  const springMat = createGameMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.8 });
  const springCoil = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.52, 0.035, 6, 12), springMat);
  springCoil.rotation.x = Math.PI / 2;
  springCoil.position.y = -radius * 0.25;
  springCoil.visible = false;
  springCoil.userData.ignoreBaseNormalize = true;
  wGroup.add(springCoil);

  return wGroup;
}

// 1. Realistic Pakistani Auto Rickshaw (Bajaj / Qingqi RE Style) with Authentic Truck Art & Animation Rig
export function createDetailedRickshaw(skinId: string = 'badshahi'): THREE.Group {
  const root = new THREE.Group();
  root.name = `AutoRickshaw_${skinId}`;

  // Suspension bounce pivot group for responsive physics oscillation
  const group = new THREE.Group();
  group.name = 'SuspensionPivot';
  root.add(group);
  root.userData.suspensionPivot = group;

  // Authentic cultural truck-art palette
  let bodyColor = 0x059669;      // Rickshaw Emerald Green
  let trimColor = 0xf59e0b;      // Mustard Gold / Amber
  let canopyColor = 0x14532d;    // Dark Forest Green Canvas
  let velvetColor = 0xb91c1c;    // Crimson Velvet Upholstery

  if (skinId === 'karachi') {
    bodyColor = 0x0284c7;        // Karachi Arabian Sea Blue
    trimColor = 0x06b6d4;        // Cyan Chamak-Patti
    canopyColor = 0x0f172a;      // Midnight Navy Canvas
    velvetColor = 0x1e3a8a;      // Royal Blue Velvet
  } else if (skinId === 'peshawar') {
    bodyColor = 0xdc2626;        // Khyber Crimson
    trimColor = 0xf97316;        // Saffron Orange
    canopyColor = 0x7f1d1d;      // Maroon Canvas
    velvetColor = 0x991b1b;      // Dark Crimson Velvet
  } else if (skinId === 'cyber') {
    bodyColor = 0x7c3aed;        // Cyber Neon Violet
    trimColor = 0xfacc15;        // Electric Yellow
    canopyColor = 0x2e1065;      // Deep Ultraviolet
    velvetColor = 0x4c1d95;      // Neon Indigo
  }

  // Curve-patched shared materials
  const bodyArtMat = createGameMaterial({
    color: bodyColor,
    metalness: 0.35,
    roughness: 0.32,
    map: TextureCache.getTruckArt(false, skinId)
  });
  const trimArtMat = createGameMaterial({
    color: trimColor,
    metalness: 0.38,
    roughness: 0.35,
    map: TextureCache.getTruckArt(true, skinId)
  });
  const rearArtMat = createGameMaterial({
    color: 0xffffff,
    metalness: 0.25,
    roughness: 0.4,
    map: TextureCache.getRickshawRearArt(skinId)
  });
  const chassisSteelMat = createGameMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.4 });
  const chromeMat = createGameMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.12 });
  const goldBrassMat = createGameMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.25 });
  const rubberMat = createGameMaterial({ color: 0x18181b, roughness: 0.92 });
  const rimMat = createGameMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.28 });
  const canopyMat = createGameMaterial({ color: canopyColor, roughness: 0.82 });
  const velvetMat = createGameMaterial({ color: velvetColor, roughness: 0.65 });
  const glassMat = createGameMaterial({
    kind: 'physical',
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    transmission: 0.6
  });

  // Geometry dimensions from config
  const chassisW = GAME_CONFIG.RICKSHAW_CHASSIS_WIDTH || 1.38;
  const chassisL = GAME_CONFIG.RICKSHAW_CHASSIS_LENGTH || 2.38;
  const frontR = GAME_CONFIG.RICKSHAW_WHEEL_FRONT_R || 0.28;
  const frontW = GAME_CONFIG.RICKSHAW_WHEEL_FRONT_W || 0.16;
  const rearR = GAME_CONFIG.RICKSHAW_WHEEL_REAR_R || 0.32;
  const rearW = GAME_CONFIG.RICKSHAW_WHEEL_REAR_W || 0.20;
  const rearTrack = GAME_CONFIG.RICKSHAW_REAR_TRACK || 1.16;

  // 1. Lower Chassis Tubular Subframe & Steel Footboards
  const subframe = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.94, 0.14, chassisL * 0.86), chassisSteelMat);
  subframe.position.set(0, 0.36, 0.15);
  group.add(subframe);

  // Driver Floorboard with anti-slip grooves
  const driverFloor = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.85, 0.06, 0.68), chassisSteelMat);
  driverFloor.position.set(0, 0.38, -0.48);
  group.add(driverFloor);

  // Front Heavy Chrome Bumper Guard Bar
  const frontBumper = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, chassisW * 0.88, 12), chromeMat);
  frontBumper.rotation.z = Math.PI / 2;
  frontBumper.position.set(0, 0.36, -1.22);
  group.add(frontBumper);

  // 2. Wheels Configuration: ONE Front Wheel, TWO Rear Wheels
  // Front Wheel Assembly attached to an animated Steer Group
  const frontSteerGroup = new THREE.Group();
  frontSteerGroup.position.set(0, frontR, -1.02);
  group.add(frontSteerGroup);
  root.userData.frontSteerGroup = frontSteerGroup;

  const frontWheel = createRickshawWheel(frontR, frontW, rubberMat, rimMat, goldBrassMat);
  frontWheel.position.set(0, 0, 0);
  frontSteerGroup.add(frontWheel);

  // Prominent Curved Front Mudguard wrapping front wheel
  const frontFender = new THREE.Mesh(
    new THREE.CylinderGeometry(frontR * 1.14, frontR * 1.14, frontW * 1.25, 18, 1, false, 0, Math.PI),
    trimArtMat
  );
  frontFender.rotation.z = Math.PI / 2;
  frontFender.rotation.y = Math.PI;
  frontFender.position.set(0, frontR * 0.18, 0);
  frontSteerGroup.add(frontFender);

  // Chrome Telescopic Fork Struts connecting wheel axle to handlebar stem
  [-frontW * 0.82, frontW * 0.82].forEach((fx) => {
    const forkTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.68, 8), chromeMat);
    forkTube.position.set(fx, 0.32, 0.02);
    forkTube.rotation.x = -0.16;
    frontSteerGroup.add(forkTube);
  });

  // Two Rear Wheels with wider stance and curved rear fenders
  const rearLeftWheel = createRickshawWheel(rearR, rearW, rubberMat, rimMat, goldBrassMat);
  rearLeftWheel.position.set(-rearTrack * 0.5, rearR, 0.68);
  group.add(rearLeftWheel);

  const rearRightWheel = createRickshawWheel(rearR, rearW, rubberMat, rimMat, goldBrassMat);
  rearRightWheel.position.set(rearTrack * 0.5, rearR, 0.68);
  group.add(rearRightWheel);

  // Rear Wheel Curved Mudguards
  [-1, 1].forEach((side) => {
    const rearFender = new THREE.Mesh(
      new THREE.CylinderGeometry(rearR * 1.15, rearR * 1.15, rearW * 1.28, 16, 1, false, 0, Math.PI),
      bodyArtMat
    );
    rearFender.rotation.z = Math.PI / 2;
    rearFender.position.set(side * rearTrack * 0.5, rearR * 1.12, 0.68);
    group.add(rearFender);

    // Rubber Mudflap at rear of fender
    const mudflap = new THREE.Mesh(new THREE.BoxGeometry(rearW * 1.2, 0.22, 0.03), rubberMat);
    mudflap.position.set(side * rearTrack * 0.5, rearR * 0.65, 0.68 + rearR * 1.05);
    group.add(mudflap);
  });

  root.userData.wheels = [frontWheel, rearLeftWheel, rearRightWheel];

  // 3. Front Cabin: Tapered Aerodynamic Cowling & Chrome Center Headlight
  // Nose apron tapers smoothly toward front wheel
  const noseApron = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.68, 0.85, 16, 1, false, 0, Math.PI), bodyArtMat);
  noseApron.position.set(0, 0.82, -0.66);
  noseApron.rotation.y = Math.PI;
  group.add(noseApron);

  const noseTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.69, 0.16, 16, 1, false, 0, Math.PI), trimArtMat);
  noseTrim.position.set(0, 0.78, -0.66);
  noseTrim.rotation.y = Math.PI;
  group.add(noseTrim);

  // Single Centered Iconic Round Headlight
  const headlightBucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.22, 16), chromeMat);
  headlightBucket.rotation.x = Math.PI / 2;
  headlightBucket.position.set(0, 0.88, -1.06);
  group.add(headlightBucket);

  const headlightLensMat = createGameMaterial({
    kind: 'standard',
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 0.95,
    roughness: 0.12
  });
  const headlightLens = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), headlightLensMat);
  headlightLens.rotation.x = -Math.PI / 2;
  headlightLens.position.set(0, 0.88, -1.16);
  group.add(headlightLens);
  root.userData.headlightMat = headlightLensMat;

  // Front Amber Indicator Bullet Lights
  const blinkerLeftMat = createGameMaterial({
    kind: 'standard',
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.15
  });
  const blinkerRightMat = createGameMaterial({
    kind: 'standard',
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.15
  });

  const frontIndL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), blinkerLeftMat);
  frontIndL.position.set(-0.42, 0.86, -0.96);
  group.add(frontIndL);

  const frontIndR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), blinkerRightMat);
  frontIndR.position.set(0.42, 0.86, -0.96);
  group.add(frontIndR);

  // 4. Curved Windshield with Chrome Frame & Wiper
  const windshieldFrame = new THREE.Group();
  windshieldFrame.position.set(0, 1.34, -0.42);
  windshieldFrame.rotation.x = -0.24;

  const glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(chassisW * 0.84, 0.72), glassMat);
  windshieldFrame.add(glassMesh);

  // Tubular chrome border pillars
  [-chassisW * 0.42, chassisW * 0.42].forEach((px) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.76, 8), chromeMat);
    pillar.position.set(px, 0, 0);
    windshieldFrame.add(pillar);
  });
  const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, chassisW * 0.84, 8), chromeMat);
  topBar.rotation.z = Math.PI / 2;
  topBar.position.set(0, 0.36, 0);
  windshieldFrame.add(topBar);

  // Single Central Chrome Windshield Wiper
  const wiperArm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.38, 0.015), chromeMat);
  wiperArm.position.set(0.08, 0.05, 0.02);
  wiperArm.rotation.z = 0.32;
  windshieldFrame.add(wiperArm);
  group.add(windshieldFrame);

  // 5. Driver Area: Handlebars, Side-view Mirrors, Dashboard & Low-Poly Driver
  const handlebarAssembly = new THREE.Group();
  handlebarAssembly.position.set(0, 1.08, -0.56);
  group.add(handlebarAssembly);
  root.userData.handlebar = handlebarAssembly;

  // Steering Column & Riser Bar
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.32, 8), chromeMat);
  column.rotation.x = 0.22;
  column.position.set(0, -0.12, 0.04);
  handlebarAssembly.add(column);

  // Curved Handlebar Grip Bar
  const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.74, 10), chromeMat);
  barMesh.rotation.z = Math.PI / 2;
  handlebarAssembly.add(barMesh);

  // Rubber Grips
  [-0.34, 0.34].forEach((gx) => {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.12, 8), rubberMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(gx, 0, 0);
    handlebarAssembly.add(grip);
  });

  // Dual Chrome Oval Side-View Mirrors
  [-0.42, 0.42].forEach((mx) => {
    const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), chromeMat);
    mirrorStem.position.set(mx, 0.12, 0.05);
    mirrorStem.rotation.z = mx > 0 ? -0.35 : 0.35;
    handlebarAssembly.add(mirrorStem);

    const mirrorHead = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12), chromeMat);
    mirrorHead.rotation.x = Math.PI / 2;
    mirrorHead.position.set(mx * 1.18, 0.22, 0.07);
    handlebarAssembly.add(mirrorHead);

    const mirrorReflect = new THREE.Mesh(new THREE.CircleGeometry(0.068, 12), glassMat);
    mirrorReflect.position.set(mx * 1.18, 0.22, 0.085);
    handlebarAssembly.add(mirrorReflect);
  });

  // Small Instrument Meter / Speedometer pod
  const meterPod = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.06, 12), chassisSteelMat);
  meterPod.rotation.x = 0.4;
  meterPod.position.set(0, 0.05, -0.04);
  handlebarAssembly.add(meterPod);

  // Driver Padded Velvet Seat
  const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.48, 0.18, 0.38), velvetMat);
  driverSeat.position.set(0, 0.58, -0.16);
  group.add(driverSeat);

  // Stylized Low-Poly Driver Silhouette with Sindhi/Lahori Cap (Topi)
  const driverGroup = new THREE.Group();
  driverGroup.position.set(0, 0.68, -0.18);

  const driverTorso = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.48, 0.24),
    createGameMaterial({ color: 0x334155, roughness: 0.7 })
  );
  driverTorso.position.set(0, 0.24, 0);
  driverGroup.add(driverTorso);

  const driverHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.125, 10, 8),
    createGameMaterial({ color: 0xd97706, roughness: 0.6 })
  );
  driverHead.position.set(0, 0.54, 0);
  driverGroup.add(driverHead);

  const driverTopi = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.07, 10),
    createGameMaterial({ color: 0xfacc15, metalness: 0.4, roughness: 0.35 })
  );
  driverTopi.position.set(0, 0.63, 0);
  driverGroup.add(driverTopi);

  group.add(driverGroup);

  // 6. Open Passenger Section: Curved Side Frame, Tubular Rails & Bench Seat
  // Passenger Tub & Side Panels (Lower half solid, Upper half completely open)
  const passengerTub = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.98, 0.62, chassisL * 0.52), bodyArtMat);
  passengerTub.position.set(0, 0.74, 0.54);
  group.add(passengerTub);

  // Yellow Chamak-Patti Midline Belt Trim
  const beltTrim = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 1.01, 0.12, chassisL * 0.53), trimArtMat);
  beltTrim.position.set(0, 0.88, 0.54);
  group.add(beltTrim);

  // Welded Chrome Side Entryway Tubular Rails (NO solid doors!)
  [-1, 1].forEach((side) => {
    // Curved entryway arch rail
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * (chassisW * 0.49), 0.45, -0.28),
      new THREE.Vector3(side * (chassisW * 0.51), 1.05, -0.25),
      new THREE.Vector3(side * (chassisW * 0.51), 1.35, 0.02),
      new THREE.Vector3(side * (chassisW * 0.51), 1.05, 0.28),
      new THREE.Vector3(side * (chassisW * 0.49), 0.45, 0.28)
    ]);
    const railGeo = new THREE.TubeGeometry(railCurve, 12, 0.022, 6, false);
    const sideRail = new THREE.Mesh(railGeo, chromeMat);
    group.add(sideRail);

    // Rolled-up canvas side rain curtain strap
    const curtainRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), canopyMat);
    curtainRoll.rotation.x = Math.PI / 2;
    curtainRoll.position.set(side * (chassisW * 0.48), 1.52, 0.12);
    group.add(curtainRoll);
  });

  // Plush Velvet Passenger Bench Seat & Backrest
  const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.88, 0.22, 0.48), velvetMat);
  benchSeat.position.set(0, 0.64, 0.68);
  group.add(benchSeat);

  const benchBackrest = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.88, 0.42, 0.12), velvetMat);
  benchBackrest.position.set(0, 0.96, 0.94);
  group.add(benchBackrest);

  // 7. Domed Canopy Roof with Rain Gutters & Rear Overhang
  // Curved roof profile extruded along Z
  const roofShape = new THREE.Shape();
  const rHalfW = chassisW * 0.54;
  const rApex = 0.28;
  roofShape.moveTo(-rHalfW, 0);
  roofShape.quadraticCurveTo(0, rApex, rHalfW, 0);
  roofShape.lineTo(rHalfW, -0.06);
  roofShape.quadraticCurveTo(0, rApex - 0.06, -rHalfW, -0.06);
  roofShape.closePath();

  const roofLength = chassisL * 0.88;
  const roofExtrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: roofLength,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2
  };
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, roofExtrudeSettings);
  roofGeo.translate(0, 0, -roofLength * 0.55);

  const roofMesh = new THREE.Mesh(roofGeo, canopyMat);
  roofMesh.position.set(0, 1.68, 0.18);
  group.add(roofMesh);

  // Chrome Luggage Carrier Rack on Roof Top
  const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.72, 0.08, roofLength * 0.58), chromeMat);
  rackFrame.position.set(0, 1.94, 0.32);
  group.add(rackFrame);

  // Rear Roof Rain Gutter Lip
  const gutterLip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, chassisW * 1.04, 8), trimArtMat);
  gutterLip.rotation.z = Math.PI / 2;
  gutterLip.position.set(0, 1.66, 0.18 + roofLength * 0.45);
  group.add(gutterLip);

  // Hanging Paranda Tassels along Rear Roof Edge (Animated swinging in lane shifts!)
  const tasselGroup = new THREE.Group();
  tasselGroup.position.set(0, 1.64, 0.18 + roofLength * 0.46);
  group.add(tasselGroup);
  root.userData.tasselGroup = tasselGroup;

  const tasselMatRed = createGameMaterial({ color: 0xef4444, roughness: 0.5 });
  const tasselMatGold = createGameMaterial({ color: 0xfacc15, roughness: 0.5 });
  const tasselCount = 8;
  const tasselSpan = chassisW * 0.82;
  for (let i = 0; i < tasselCount; i++) {
    const tx = -tasselSpan * 0.5 + (i / (tasselCount - 1)) * tasselSpan;
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, 0, 0);

    const stringTube = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 4), chromeMat);
    stringTube.position.set(0, -0.04, 0);
    tGroup.add(stringTube);

    const bell = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.14, 6),
      i % 2 === 0 ? tasselMatRed : tasselMatGold
    );
    bell.rotation.x = Math.PI;
    bell.position.set(0, -0.14, 0);
    tGroup.add(bell);

    tasselGroup.add(tGroup);
  }

  // 8. Rear End: Framed Truck-Art Medallion Panel, Engine Hood, Vent Grille & Exhaust
  // Engine bay cover (slanted wedge at the rear)
  const engineCover = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.88, 0.44, 0.38), bodyArtMat);
  engineCover.position.set(0, 0.52, 1.06);
  group.add(engineCover);

  // Engine Cooling Vent Grille (dark horizontal louvers)
  const ventGrilleMat = createGameMaterial({ color: 0x0f172a, roughness: 0.9 });
  for (let v = 0; v < 4; v++) {
    const louver = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.52, 0.024, 0.02), ventGrilleMat);
    louver.position.set(0, 0.42 + v * 0.065, 1.26);
    group.add(louver);
  }

  // Framed Rear Slogan & Truck-Art Painting Panel (Centered and highly visible from chase camera!)
  const rearPaintingPlane = new THREE.Mesh(new THREE.PlaneGeometry(chassisW * 0.84, 0.62), rearArtMat);
  rearPaintingPlane.position.set(0, 1.18, 1.07);
  group.add(rearPaintingPlane);

  // Dual Tail Lights & Brake Light Clusters
  const tailLightMat = createGameMaterial({
    kind: 'standard',
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.85
  });
  root.userData.brakeMat = tailLightMat;

  [-chassisW * 0.42, chassisW * 0.42].forEach((tx) => {
    // Red tail/brake lamp
    const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), tailLightMat);
    tailLamp.position.set(tx, 0.82, 1.08);
    group.add(tailLamp);

    // Amber rear indicator lamp
    const indRear = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, 0.06),
      tx < 0 ? blinkerLeftMat : blinkerRightMat
    );
    indRear.position.set(tx, 0.94, 1.08);
    group.add(indRear);
  });

  root.userData.leftBlinkerMat = blinkerLeftMat;
  root.userData.rightBlinkerMat = blinkerRightMat;

  // Rear Heavy Bumper Bar with Chamak-Patti Chevron Texture
  const rearBumperMat = createGameMaterial({
    map: TextureCache.getBumperArt(),
    roughness: 0.45
  });
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 1.02, 0.24, 0.12), rearBumperMat);
  rearBumper.position.set(0, 0.38, 1.28);
  group.add(rearBumper);

  // Hanging Brass/Chrome Chains under rear bumper
  for (let c = -chassisW * 0.38; c <= chassisW * 0.38; c += 0.16) {
    const chainLink = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.18, 6), chromeMat);
    chainLink.position.set(c, 0.22, 1.28);
    group.add(chainLink);
  }

  // Exhaust Tailpipe & Smoke Emitter
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.42, 8), chassisSteelMat);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(-chassisW * 0.34, 0.26, 1.24);
  group.add(exhaust);

  const exhaustPoint = new THREE.Object3D();
  exhaustPoint.position.set(-chassisW * 0.34, 0.26, 1.46);
  group.add(exhaustPoint);
  root.userData.exhaustEmitter = exhaustPoint;

  // 9. Jetpack Attachment Visual (for Sky Flight Powerup)
  const jetpackGroup = new THREE.Group();
  const rocketMat = createGameMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.2 });
  const fireMat = createGameMaterial({ kind: 'basic', color: 0xf97316 });
  [-0.48, 0.48].forEach((jx) => {
    const rocket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.85, 12), rocketMat);
    rocket.position.set(jx, 1.38, 1.08);
    jetpackGroup.add(rocket);

    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52, 8), fireMat);
    fire.rotation.x = Math.PI;
    fire.position.set(jx, 0.85, 1.08);
    jetpackGroup.add(fire);
  });
  jetpackGroup.visible = false;
  jetpackGroup.userData.ignoreBaseNormalize = true;
  group.add(jetpackGroup);
  root.userData.jetpackVisual = jetpackGroup;

  return normalizeModelBase(root, true, 1.75, 2.65);
}

// 2. Realistic Local Traffic Cars (Hatchback, Sedan, SUV)
export function createTrafficCar(type: CarType = 'HATCHBACK'): THREE.Group {
  const group = new THREE.Group();

  let bodyW = 2.1;
  let bodyL = 4.4;
  let bodyH = 1.45;
  let wheelRadius = 0.36;

  let paintColors: number[];
  if (type === 'HATCHBACK') {
    paintColors = [0xe11d48, 0x2563eb, 0xfacc15, 0xf8fafc, 0x16a34a];
    bodyW = 1.95;
    bodyL = 3.9;
    bodyH = 1.4;
  } else if (type === 'SEDAN') {
    paintColors = [0x334155, 0x1e293b, 0xf8fafc, 0x94a3b8, 0x0284c7];
    bodyW = 2.1;
    bodyL = 4.7;
    bodyH = 1.42;
  } else {
    paintColors = [0x0f172a, 0x475569, 0xb91c1c, 0x15803d, 0xf8fafc];
    bodyW = 2.25;
    bodyL = 4.8;
    bodyH = 1.75;
    wheelRadius = 0.42;
  }

  const paintColor = paintColors[Math.floor(Math.random() * paintColors.length)];
  const paintMat = createGameMaterial({
    color: paintColor,
    metalness: 0.6,
    roughness: 0.25
  });
  const darkPlasticMat = createGameMaterial({ color: 0x0f172a, roughness: 0.8 });
  const glassMat = createGameMaterial({
    kind: 'physical',
    color: 0x0f172a,
    roughness: 0.1,
    transparent: true,
    opacity: 0.6
  });

  // Lower Main Chassis Body
  const lowerH = bodyH * 0.55;
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(bodyW, lowerH, bodyL), paintMat);
  lowerBody.position.y = wheelRadius + lowerH * 0.5;
  group.add(lowerBody);

  // Front Radiator Grille
  const grilleMat = createGameMaterial({ map: TextureCache.getCarGrille(), roughness: 0.4 });
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(bodyW * 0.7, lowerH * 0.45), grilleMat);
  grille.position.set(0, wheelRadius + lowerH * 0.45, -bodyL * 0.5 - 0.02);
  group.add(grille);

  // Working Headlights
  const headlampMat = createGameMaterial({
    map: TextureCache.getHeadlampLens(),
    emissive: 0xfef08a,
    emissiveIntensity: 0.7
  });
  [-bodyW * 0.38, bodyW * 0.38].forEach((hx) => {
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), headlampMat);
    lamp.position.set(hx, wheelRadius + lowerH * 0.55, -bodyL * 0.5 - 0.02);
    group.add(lamp);
  });

  // Working Brake Lights
  const brakeMat = createGameMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.85
  });
  [-bodyW * 0.38, bodyW * 0.38].forEach((bx) => {
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), brakeMat);
    brake.position.set(bx, wheelRadius + lowerH * 0.55, bodyL * 0.5 + 0.02);
    group.add(brake);
  });

  // Turn Blinkers
  const leftBlinkerMat = createGameMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.05
  });
  const rightBlinkerMat = createGameMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.05
  });

  const frontLeftBlinker = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), leftBlinkerMat);
  frontLeftBlinker.position.set(-bodyW * 0.44, wheelRadius + lowerH * 0.55, -bodyL * 0.5 - 0.025);
  group.add(frontLeftBlinker);

  const frontRightBlinker = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), rightBlinkerMat);
  frontRightBlinker.position.set(bodyW * 0.44, wheelRadius + lowerH * 0.55, -bodyL * 0.5 - 0.025);
  group.add(frontRightBlinker);

  const rearLeftBlinker = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.08), leftBlinkerMat);
  rearLeftBlinker.position.set(-bodyW * 0.44, wheelRadius + lowerH * 0.55, bodyL * 0.5 + 0.025);
  group.add(rearLeftBlinker);

  const rearRightBlinker = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.08), rightBlinkerMat);
  rearRightBlinker.position.set(bodyW * 0.44, wheelRadius + lowerH * 0.55, bodyL * 0.5 + 0.025);
  group.add(rearRightBlinker);

  // Cabin Greenhouse
  const cabinW = bodyW * 0.88;
  const cabinL = type === 'SEDAN' ? bodyL * 0.55 : type === 'HATCHBACK' ? bodyL * 0.6 : bodyL * 0.65;
  const cabinH = bodyH * 0.45;
  const cabinZ = type === 'SEDAN' ? 0.2 : 0.35;

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH, cabinL), paintMat);
  cabin.position.set(0, wheelRadius + lowerH + cabinH * 0.5, cabinZ);
  group.add(cabin);

  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(cabinW * 0.9, cabinH * 0.85), glassMat);
  frontGlass.rotation.x = -0.35;
  frontGlass.position.set(0, wheelRadius + lowerH + cabinH * 0.45, cabinZ - cabinL * 0.5);
  group.add(frontGlass);

  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(cabinW * 0.9, cabinH * 0.8), glassMat);
  rearGlass.rotation.x = 0.35;
  rearGlass.position.set(0, wheelRadius + lowerH + cabinH * 0.45, cabinZ + cabinL * 0.5);
  group.add(rearGlass);

  if (type === 'SUV') {
    const railMat = createGameMaterial({ color: 0x94a3b8, metalness: 0.9 });
    [-cabinW * 0.45, cabinW * 0.45].forEach((rx) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, cabinL * 0.9), railMat);
      rail.position.set(rx, wheelRadius + lowerH + cabinH + 0.04, cabinZ);
      group.add(rail);
    });
  }

  const wheels: THREE.Group[] = [];
  [-bodyW * 0.48, bodyW * 0.48].forEach((wx) => {
    [-bodyL * 0.32, bodyL * 0.32].forEach((wz) => {
      const w = createCarWheel(wheelRadius, 0.24);
      w.position.set(wx, wheelRadius, wz);
      group.add(w);
      wheels.push(w);
    });
  });

  [-bodyW * 0.52, bodyW * 0.52].forEach((mx) => {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), darkPlasticMat);
    mirror.position.set(mx, wheelRadius + lowerH + 0.1, cabinZ - cabinL * 0.45);
    group.add(mirror);
  });

  group.userData = {
    carType: type,
    wheels: wheels,
    width: bodyW,
    length: bodyL,
    height: bodyH,
    speed: 0,
    targetLaneX: 0,
    laneChangeTimer: 0,
    honkTimer: 0,
    leftBlinkerMat,
    rightBlinkerMat,
    brakeMat
  };

  return normalizeModelBase(group, true, bodyW * 1.05, bodyL * 1.02);
}

// 3. High-Voltage Electric Transmission Tower (Pylon with Ground Base Plate at ROAD_Y = 0)
export function createElectricTransmissionTower(): THREE.Group {
  const group = new THREE.Group();
  const steelMat = createGameMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.25
  });
  const footMat = createGameMaterial({ color: 0x475569, roughness: 0.7 });

  const height = 16.0;
  const baseW = 3.6;
  const topW = 0.8;

  // Heavy Concrete Base Plate / Footing Pad sitting flush on the road at ROAD_Y = 0
  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(baseW + 0.8, 0.22, baseW + 0.8), footMat);
  basePlate.position.set(0, 0.11, 0);
  group.add(basePlate);

  const legGeo = new THREE.CylinderGeometry(0.1, 0.16, height, 8);

  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const legX = sx * (baseW + topW) * 0.25;
    const legZ = sz * (baseW + topW) * 0.25;

    const leg = new THREE.Mesh(legGeo, steelMat);
    leg.position.set(legX, height * 0.5 + 0.15, legZ);
    leg.rotation.z = -sx * 0.08;
    leg.rotation.x = sz * 0.08;
    group.add(leg);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), footMat);
    foot.position.set(sx * baseW * 0.5, 0.175, sz * baseW * 0.5);
    group.add(foot);
  });

  for (let y = 2.4; y < height; y += 2.2) {
    const w = baseW - (baseW - topW) * (y / height);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.09), steelMat);
    bar.position.set(0, y, 0);
    group.add(bar);

    const diagGeo = new THREE.CylinderGeometry(0.04, 0.04, w * 1.4, 6);
    const diag1 = new THREE.Mesh(diagGeo, steelMat);
    diag1.position.set(0, y - 1.1, 0);
    diag1.rotation.z = 0.7;
    group.add(diag1);
  }

  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.24, 0.45), steelMat);
  arm1.position.set(0, height - 3.2, 0);
  group.add(arm1);

  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 0.45), steelMat);
  arm2.position.set(0, height - 1.3, 0);
  group.add(arm2);

  const insMat = createGameMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.5,
    roughness: 0.1
  });
  [-3.2, -1.8, 1.8, 3.2].forEach((ix) => {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.1, 8), insMat);
    ins.position.set(ix, height - 3.8, 0);
    group.add(ins);
  });

  const signMat = createGameMaterial({
    kind: 'basic',
    map: TextureCache.getShopSign('⚡ DANGER: 500,000V ⚡', '#facc15', '#b91c1c'),
    side: THREE.DoubleSide
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), signMat);
  sign.position.set(0, 3.2, 1.4);
  group.add(sign);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 12, 12),
    createGameMaterial({ kind: 'basic', color: 0xef4444 })
  );
  beacon.position.set(0, height + 0.25, 0);
  group.add(beacon);
  group.userData.beacon = beacon;

  const sparkMat = createGameMaterial({ kind: 'line', color: 0x38bdf8 });
  const sparkPoints = [];
  for (let p = 0; p < 8; p++) {
    sparkPoints.push(new THREE.Vector3((p - 3.5) * 0.4, 0, (Math.random() - 0.5) * 0.4));
  }
  const sparkGeo = new THREE.BufferGeometry().setFromPoints(sparkPoints);
  const sparkLine = new THREE.Line(sparkGeo, sparkMat);
  sparkLine.position.set(0, height - 3.2, 0);
  group.add(sparkLine);
  group.userData.sparkLine = sparkLine;

  return normalizeModelBase(group, true, 4.2, 4.2);
}

// 4. Pakistani Metro / Super Saloon Bus (Lahore Metro Speedo & Overloaded Coach)
export function createTransportBus(isMetro = false): THREE.Group {
  const group = new THREE.Group();

  const length = 9.2;
  const width = 2.45;
  const height = 2.45;

  const chromeMat = createGameMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  const darkSteelMat = createGameMaterial({ color: 0x1e293b, roughness: 0.85 });
  const darkGlassMat = createGameMaterial({
    kind: 'physical',
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.65
  });
  const wheelRubberMat = createGameMaterial({ color: 0x18181b, roughness: 0.94 });
  const rimMat = createGameMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.25 });

  if (isMetro) {
    // -------------------------------------------------------------
    // LAHORE METRO "SPEEDO" BUS (Streamlined Red & White Low-Floor)
    // -------------------------------------------------------------
    const metroRedMat = createGameMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.25 });
    const metroWhiteMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.15 });

    // Lower chassis & aerodynamic skirt
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(width, 0.45, length), darkSteelMat);
    skirt.position.set(0, 0.4, 0);
    group.add(skirt);

    // Main bus body shell with curved upper edges
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height - 0.3, length), metroRedMat);
    body.position.set(0, height * 0.5 + 0.35, 0);
    group.add(body);

    // Distinct White Center Belt & Wave Livery
    const whiteLivery = new THREE.Mesh(new THREE.BoxGeometry(width * 1.01, 0.45, length * 0.98), metroWhiteMat);
    whiteLivery.position.set(0, 1.25, 0);
    group.add(whiteLivery);

    // Panoramic Curved Front Windshield
    const frontShield = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 1.05, 0.15), darkGlassMat);
    frontShield.position.set(0, 1.65, -length * 0.5 - 0.02);
    frontShield.rotation.x = 0.12;
    group.add(frontShield);

    // Front Destination LED Display ("LAHORE METRO • GAJJUMATA")
    const ledSignMat = createGameMaterial({
      kind: 'basic',
      map: TextureCache.getShopSign('LAHORE METRO • SPEEDO', '#facc15', '#0f172a')
    });
    const ledSign = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.78, 0.35), ledSignMat);
    ledSign.position.set(0, height + 0.18, -length * 0.5 - 0.06);
    group.add(ledSign);

    // Streamlined Continuous Panoramic Side Tint Windows
    [-width * 0.5 - 0.015, width * 0.5 + 0.015].forEach((wx) => {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, length * 0.82), darkGlassMat);
      sideGlass.position.set(wx, 1.82, -0.15);
      group.add(sideGlass);

      // Bi-fold Passenger Doors with chrome vertical handles
      [-1.8, 2.2].forEach((dz) => {
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.75, 1.1), darkSteelMat);
        doorFrame.position.set(wx, 1.25, dz);
        group.add(doorFrame);

        const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), chromeMat);
        doorHandle.position.set(wx * 1.02, 1.2, dz);
        group.add(doorHandle);
      });
    });

    // Aerodynamic Dual Roof AC Units on Top
    [-1.2, 1.6].forEach((az) => {
      const acUnit = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.72, 0.28, 1.8),
        createGameMaterial({ color: 0xf1f5f9, roughness: 0.5 })
      );
      acUnit.position.set(0, height + 0.44, az);
      group.add(acUnit);
    });

    // Dual Aero Side-View Mirrors
    [-width * 0.52, width * 0.52].forEach((mx) => {
      const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), darkSteelMat);
      mirrorStem.position.set(mx, 1.75, -length * 0.5 + 0.2);
      mirrorStem.rotation.z = mx > 0 ? -0.4 : 0.4;
      group.add(mirrorStem);

      const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.16), metroRedMat);
      mirrorHead.position.set(mx * 1.15, 1.75, -length * 0.5 + 0.2);
      group.add(mirrorHead);
    });

    // Rear Window, High-Mounted Brake Light Bar & Tail Lights
    const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.75, 0.65), darkGlassMat);
    rearGlass.position.set(0, 1.75, length * 0.5 + 0.02);
    group.add(rearGlass);

    const brakeBarMat = createGameMaterial({ kind: 'standard', color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.2 });
    const brakeBar = new THREE.Mesh(new THREE.BoxGeometry(width * 0.45, 0.08, 0.06), brakeBarMat);
    brakeBar.position.set(0, height + 0.15, length * 0.5 + 0.02);
    group.add(brakeBar);

  } else {
    // -------------------------------------------------------------------
    // SUPER SALOON / OVERLOADED COACH (Colorful Truck-Art Highway Cruiser)
    // -------------------------------------------------------------------
    const coachBodyMat = createGameMaterial({
      color: 0x0284c7, // Vibrant Royal Blue
      roughness: 0.35,
      metalness: 0.3,
      map: TextureCache.getTruckArt(false, 'karachi')
    });
    const yellowTrimMat = createGameMaterial({
      color: 0xf59e0b,
      metalness: 0.35,
      roughness: 0.35,
      map: TextureCache.getTruckArt(true, 'karachi')
    });

    // High ground-clearance rugged chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, length), darkSteelMat);
    chassis.position.set(0, 0.45, 0);
    group.add(chassis);

    // Main Bus Body with vibrant truck art panels
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height - 0.2, length), coachBodyMat);
    body.position.set(0, height * 0.5 + 0.4, 0);
    group.add(body);

    // Chamak-Patti Midline Belt Trim
    const belt = new THREE.Mesh(new THREE.BoxGeometry(width * 1.015, 0.24, length * 1.005), yellowTrimMat);
    belt.position.set(0, 1.35, 0);
    group.add(belt);

    // Heavily Overloaded Rooftop Luggage Carrier (Sacks, trunks, crates & spare tire)
    const rackMat = createGameMaterial({ color: 0x334155, roughness: 0.85 });
    const rack = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.25, length * 0.78), rackMat);
    rack.position.set(0, height + 0.48, -0.2);
    group.add(rack);

    // Bundled luggage parcels & jute sacks tied with rope
    const luggageColors = [0x78350f, 0x0284c7, 0xd97706, 0x15803d, 0xb91c1c];
    for (let lz = -length * 0.32; lz <= length * 0.32; lz += 0.85) {
      [-width * 0.22, width * 0.22].forEach((lx, i) => {
        const bundle = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.42, 0.65),
          createGameMaterial({ color: luggageColors[(Math.abs(Math.round(lz * 10)) + i) % luggageColors.length] })
        );
        bundle.position.set(lx, height + 0.75, lz);
        group.add(bundle);
      });
    }

    // Spare Bus Tire tied atop front roof rack
    const spareTire = createCarWheel(0.44, 0.22);
    spareTire.rotation.x = Math.PI / 2;
    spareTire.position.set(0, height + 0.65, -length * 0.32);
    group.add(spareTire);

    // Hanging Paranda Tassels under rear luggage rack lip
    const tasselMatRed = createGameMaterial({ color: 0xef4444 });
    const tasselMatGold = createGameMaterial({ color: 0xfacc15 });
    for (let tx = -width * 0.38; tx <= width * 0.38; tx += 0.16) {
      const tassel = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.16, 6),
        Math.abs(tx) % 0.32 < 0.16 ? tasselMatRed : tasselMatGold
      );
      tassel.rotation.x = Math.PI;
      tassel.position.set(tx, height + 0.36, length * 0.5 + 0.05);
      group.add(tassel);
    }

    // Conductor figure leaning out of the rear side door
    const conductorGroup = new THREE.Group();
    conductorGroup.position.set(width * 0.52, 1.15, length * 0.32);

    const cTorso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.45, 0.22), createGameMaterial({ color: 0xf59e0b }));
    conductorGroup.add(cTorso);

    const cHead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), createGameMaterial({ color: 0xd97706 }));
    cHead.position.set(0, 0.32, 0);
    conductorGroup.add(cHead);

    const cArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.38, 0.09), createGameMaterial({ color: 0xf59e0b }));
    cArm.position.set(0.12, 0.1, 0.08);
    cArm.rotation.z = -0.45;
    conductorGroup.add(cArm);
    group.add(conductorGroup);

    // Handwritten Route Board atop front windshield
    const routeSignMat = createGameMaterial({
      kind: 'basic',
      map: TextureCache.getShopSign('SUPER SALOON • LAHORE - PESHAWAR', '#facc15', '#b91c1c')
    });
    const routeBoard = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.85, 0.38), routeSignMat);
    routeBoard.position.set(0, height + 0.22, -length * 0.5 - 0.02);
    group.add(routeBoard);

    // Heavy Chrome Front Bullbar & Dual Fog Lamps
    const bullbar = new THREE.Mesh(new THREE.BoxGeometry(width * 0.95, 0.42, 0.16), chromeMat);
    bullbar.position.set(0, 0.65, -length * 0.5 - 0.08);
    group.add(bullbar);

    [-0.55, 0.55].forEach((lx) => {
      const fogLamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10),
        createGameMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.2 })
      );
      fogLamp.rotation.x = Math.PI / 2;
      fogLamp.position.set(lx, 0.65, -length * 0.5 - 0.14);
      group.add(fogLamp);
    });

    // Iconic Framed Tailboard Truck-Art Painting on Rear
    const tailboardPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.84, 1.25),
      createGameMaterial({ kind: 'basic', map: TextureCache.getBedfordTailboardArt() })
    );
    tailboardPlane.position.set(0, 1.62, length * 0.5 + 0.02);
    group.add(tailboardPlane);
  }

  // Common Wheels (4 Heavy Coach Wheels with authentic rims)
  const wheels: THREE.Group[] = [];
  [-width * 0.5 + 0.12, width * 0.5 - 0.12].forEach((wx) => {
    [-length * 0.5 + 1.6, length * 0.5 - 1.6].forEach((wz) => {
      const w = createRickshawWheel(0.48, 0.26, wheelRubberMat, rimMat, chromeMat);
      w.position.set(wx, 0.48, wz);
      group.add(w);
      wheels.push(w);
    });
  });
  group.userData.wheels = wheels;

  return normalizeModelBase(group, true, width * 1.08, length * 1.02);
}

// 5. Pakistani Fruit Cart (Thela - Wooden Handcart with Mangoes, Melons, Balance Scale & Vendor)
export function createFruitCart(): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createGameMaterial({ color: 0x78350f, roughness: 0.88 });
  const darkWoodMat = createGameMaterial({ color: 0x451a03, roughness: 0.92 });
  const ironMat = createGameMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.6 });
  const brassMat = createGameMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
  const mangoMat = createGameMaterial({ color: 0xf59e0b, roughness: 0.35 });
  const waterMelonMat = createGameMaterial({ color: 0x15803d, roughness: 0.45 });
  const melonStripeMat = createGameMaterial({ color: 0x14532d, roughness: 0.45 });
  const skinMat = createGameMaterial({ color: 0xd97706, roughness: 0.65 });
  const vendorShirtMat = createGameMaterial({ color: 0x0284c7, roughness: 0.8 });
  const whiteCapMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.6 });

  // Main Slatted Wooden Flatbed
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.14, 1.45), woodMat);
  bed.position.y = 0.86;
  group.add(bed);

  // Raised Side Retaining Lips (prevents fruit from rolling off)
  const lipFront = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.12, 0.06), darkWoodMat);
  lipFront.position.set(0, 0.97, -0.7);
  group.add(lipFront);

  const lipBack = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.12, 0.06), darkWoodMat);
  lipBack.position.set(0, 0.97, 0.7);
  group.add(lipBack);

  const lipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 1.45), darkWoodMat);
  lipLeft.position.set(-1.15, 0.97, 0);
  group.add(lipLeft);

  const lipRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 1.45), darkWoodMat);
  lipRight.position.set(1.15, 0.97, 0);
  group.add(lipRight);

  // 4 Structural Ground Legs / Rest Stands
  [[-0.98, -0.58], [0.98, -0.58], [-0.98, 0.58], [0.98, 0.58]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.86, 6), darkWoodMat);
    leg.position.set(lx, 0.43, lz);
    group.add(leg);
  });

  // Long Front Timber Pushing Handles (Hatta)
  [-0.55, 0.55].forEach((hx) => {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 6), woodMat);
    handle.rotation.x = 0.35;
    handle.position.set(hx, 0.95, -0.98);
    group.add(handle);
  });

  // Two Authentic Large 16-Spoke Cart Wheels with Iron Rims
  [-1.12, 1.12].forEach((wx) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, 0.52, 0);

    const ironRim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.07, 24), ironMat);
    ironRim.rotation.z = Math.PI / 2;
    wheelGroup.add(ironRim);

    const woodHub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), darkWoodMat);
    woodHub.rotation.z = Math.PI / 2;
    wheelGroup.add(woodHub);

    // 16 Wooden Spokes
    const spokes = 8;
    for (let s = 0; s < spokes; s++) {
      const angle = (s / spokes) * Math.PI;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.98, 4), woodMat);
      spoke.rotation.x = angle;
      wheelGroup.add(spoke);
    }

    group.add(wheelGroup);
  });

  // Pyramids of Golden Chaunsa Mangoes & Striped Watermelons
  for (let x = -0.75; x <= 0.75; x += 0.36) {
    for (let z = -0.42; z <= 0.42; z += 0.38) {
      const isMelon = (Math.abs(x) + Math.abs(z)) % 0.7 > 0.3;
      if (isMelon) {
        const melon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), waterMelonMat);
        melon.scale.set(1.0, 0.85, 1.2);
        melon.position.set(x, 1.06, z);
        group.add(melon);
      } else {
        const mango = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mangoMat);
        mango.scale.set(0.9, 1.2, 0.8);
        mango.rotation.z = 0.25;
        mango.position.set(x, 1.02, z);
        group.add(mango);
      }
    }
  }

  // Slatted Wooden Fruit Crates
  const crateMat = createGameMaterial({ map: TextureCache.getFruitBoxTexture(), roughness: 0.8 });
  const crateL = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.32, 0.44), crateMat);
  crateL.position.set(-0.55, 1.12, 0.05);
  group.add(crateL);

  const crateR = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.32, 0.44), crateMat);
  crateR.position.set(0.55, 1.12, -0.05);
  group.add(crateR);

  // Hanging Brass Balance Weighing Scale (Tarazu) with pan
  const scalePost = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.65, 6), brassMat);
  scalePost.position.set(0.85, 1.28, 0.45);
  group.add(scalePost);

  const scaleBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 6), brassMat);
  scaleBeam.rotation.z = Math.PI / 2;
  scaleBeam.position.set(0.85, 1.58, 0.45);
  group.add(scaleBeam);

  const scalePan = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.04, 0.05, 10), brassMat);
  scalePan.position.set(0.72, 1.38, 0.45);
  group.add(scalePan);

  // Vendor Figure (wearing blue kameez and white prayer cap)
  const vendorTorso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.58, 0.24), vendorShirtMat);
  vendorTorso.position.set(0, 1.42, 1.05);
  group.add(vendorTorso);

  const vendorHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), skinMat);
  vendorHead.position.set(0, 1.78, 1.05);
  group.add(vendorHead);

  const vendorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.06, 12), whiteCapMat);
  vendorCap.position.set(0, 1.88, 1.05);
  group.add(vendorCap);

  return normalizeModelBase(group, true, 2.4, 1.6);
}

// 6. Lahore Police Motorbike (Punjab Traffic Warden Honda 125 Patrol Bike)
export function createPoliceMotorbike(): THREE.Group {
  const group = new THREE.Group();

  const whiteMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.1 });
  const blueMat = createGameMaterial({ color: 0x1d4ed8, roughness: 0.35 });
  const chromeMat = createGameMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  const glassMat = createGameMaterial({
    kind: 'physical',
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
    roughness: 0.1
  });
  const darkSteelMat = createGameMaterial({ color: 0x1e293b, roughness: 0.85 });
  const seatMat = createGameMaterial({ color: 0x111827, roughness: 0.85 });
  const engineMat = createGameMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.35 });
  const khakiMat = createGameMaterial({ color: 0x854d0e, roughness: 0.8 });
  const skinMat = createGameMaterial({ color: 0xd97706, roughness: 0.65 });
  const neonYellowMat = createGameMaterial({
    color: 0xccff00,
    emissive: 0x88cc00,
    emissiveIntensity: 0.25,
    roughness: 0.4
  });

  // White fuel tank with blue Punjab Police crest stripe
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.68, 12), whiteMat);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 0.84, -0.16);
  group.add(tank);

  const tankStripe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.45), blueMat);
  tankStripe.position.set(0, 0.85, -0.16);
  group.add(tankStripe);

  // Black textured stepped seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.78), seatMat);
  seat.position.set(0, 0.82, 0.44);
  group.add(seat);

  // Finned 125cc Engine Block & Chrome Exhaust
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.46), engineMat);
  engine.position.set(0, 0.45, 0.04);
  group.add(engine);

  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.95, 10), chromeMat);
  muffler.rotation.x = Math.PI / 2;
  muffler.position.set(0.24, 0.28, 0.52);
  group.add(muffler);

  // Spoke Wheels with Chrome Rims
  const frontW = createSpokeMotorbikeWheel(0.35, 0.12);
  frontW.position.set(0, 0.35, -0.84);
  group.add(frontW);

  const rearW = createSpokeMotorbikeWheel(0.35, 0.13);
  rearW.position.set(0, 0.35, 0.8);
  group.add(rearW);

  // White Front Aerodynamic Patrol Fairing
  const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.48, 0.3), whiteMat);
  fairing.position.set(0, 1.05, -0.72);
  group.add(fairing);

  // Tall Windscreen
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.44), glassMat);
  screen.position.set(0, 1.34, -0.74);
  screen.rotation.x = -0.28;
  group.add(screen);

  // High-power front headlight
  const headlight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.1, 14),
    createGameMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.0 })
  );
  headlight.rotation.x = Math.PI / 2;
  headlight.position.set(0, 0.96, -0.88);
  group.add(headlight);

  // Chrome handlebars with mirrors
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 8), chromeMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.08, -0.58);
  group.add(handlebar);

  // Uniformed Punjab Traffic Warden Rider
  const officer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.32), khakiMat);
  officer.position.set(0, 1.12, 0.15);
  officer.rotation.x = 0.18;
  group.add(officer);

  // High-visibility neon-yellow cross vest
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.32, 0.34), neonYellowMat);
  vest.position.set(0, 1.15, 0.15);
  vest.rotation.x = 0.18;
  group.add(vest);

  // Warden Head with White Police Helmet
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), skinMat);
  head.position.set(0, 1.54, 0.05);
  group.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), whiteMat);
  helmet.position.set(0, 1.58, 0.05);
  group.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.15), darkSteelMat);
  visor.position.set(0, 1.56, -0.1);
  group.add(visor);

  // Dual High-Intensity Strobes (Red Left, Blue Right)
  const redStrobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 8),
    createGameMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.8 })
  );
  redStrobe.position.set(-0.32, 1.25, -0.62);
  group.add(redStrobe);

  const blueStrobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 8),
    createGameMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 1.8 })
  );
  blueStrobe.position.set(0.32, 1.25, -0.62);
  group.add(blueStrobe);

  // Rear Emergency Telescopic Beacon Pole with Blue Flashing Strobe
  const beaconPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 6), chromeMat);
  beaconPole.position.set(0.24, 1.18, 0.82);
  group.add(beaconPole);

  const rearBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8),
    createGameMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 1.8 })
  );
  rearBeacon.position.set(0.24, 1.58, 0.82);
  group.add(rearBeacon);

  group.userData.redStrobe = redStrobe;
  group.userData.blueStrobe = blueStrobe;
  return normalizeModelBase(group, true, 1.1, 2.1);
}

// Helper for authentic Pakistani motorcycle wire-spoke wheels with chrome rim & hub
function createSpokeMotorbikeWheel(radius: number, width: number): THREE.Group {
  const wGroup = new THREE.Group();
  const rubberMat = createGameMaterial({ color: 0x18181b, roughness: 0.94 });
  const chromeMat = createGameMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  const hubMat = createGameMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
  const spokeMat = createGameMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });

  // Outer narrow tread tire
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), rubberMat);
  tire.rotation.z = Math.PI / 2;
  wGroup.add(tire);

  // Chrome deep rim
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, width * 1.04, 16), chromeMat);
  rim.rotation.z = Math.PI / 2;
  wGroup.add(rim);

  // Center axle drum hub
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, width * 1.15, 10), hubMat);
  hub.rotation.z = Math.PI / 2;
  wGroup.add(hub);

  // Cross wire spokes disc
  const spokesCount = 8;
  for (let i = 0; i < spokesCount; i++) {
    const angle = (i / spokesCount) * Math.PI;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, radius * 1.5, 4), spokeMat);
    spoke.rotation.x = angle;
    wGroup.add(spoke);
  }

  return wGroup;
}

// 6b. Authentic Pakistani 70cc / 125cc Civilian Commuter Motorbike in Traffic
export function createCivilianMotorbike(): THREE.Group {
  const group = new THREE.Group();
  const bikeColors = [0xdc2626, 0x0f172a, 0x1d4ed8, 0x15803d];
  const tankColor = bikeColors[Math.floor(Math.random() * bikeColors.length)];

  const tankMat = createGameMaterial({ color: tankColor, roughness: 0.28, metalness: 0.45 });
  const chromeMat = createGameMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  const engineMat = createGameMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.35 });
  const seatMat = createGameMaterial({ color: 0x111827, roughness: 0.85 });
  const skinMat = createGameMaterial({ color: 0xd4a373, roughness: 0.65 });
  const shirtMat = createGameMaterial({ color: 0x0284c7, roughness: 0.8 });
  const darkSteelMat = createGameMaterial({ color: 0x1e293b, roughness: 0.85 });

  // Tubular backbone frame
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 8), darkSteelMat);
  frame.rotation.x = 0.35;
  frame.position.set(0, 0.65, 0.05);
  group.add(frame);

  // Teardrop Pakistani CD70 Fuel Tank with chrome side wing badges
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.68, 12), tankMat);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 0.84, -0.16);
  group.add(tank);

  // Chrome gas cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), chromeMat);
  cap.position.set(0, 0.96, -0.26);
  group.add(cap);

  // Contoured stepped dual seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.78), seatMat);
  seat.position.set(0, 0.82, 0.44);
  group.add(seat);

  // Rear chrome grab rail / carrier
  const grabRail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.35), chromeMat);
  grabRail.position.set(0, 0.88, 0.84);
  group.add(grabRail);

  // 4-Stroke 70cc Finned Engine Block with cooling ribs & spark plug
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.42), engineMat);
  engine.position.set(0, 0.45, 0.04);
  group.add(engine);

  // Swept-back Chrome Exhaust Header Pipe & Long Tapered Silencer
  const exhaustHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.55, 8), chromeMat);
  exhaustHeader.rotation.x = 0.5;
  exhaustHeader.position.set(0.18, 0.38, -0.06);
  group.add(exhaustHeader);

  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.85, 10), chromeMat);
  muffler.rotation.x = Math.PI / 2;
  muffler.position.set(0.22, 0.26, 0.52);
  group.add(muffler);

  // Spoke Wheels & Mudguards (Front and Rear)
  const frontW = createSpokeMotorbikeWheel(0.34, 0.11);
  frontW.position.set(0, 0.34, -0.82);
  group.add(frontW);

  const frontFender = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.14, 16, 1, false, 0, Math.PI),
    chromeMat
  );
  frontFender.rotation.z = Math.PI / 2;
  frontFender.rotation.y = Math.PI;
  frontFender.position.set(0, 0.38, -0.82);
  group.add(frontFender);

  // Telescopic front fork suspension
  [-0.11, 0.11].forEach((fx) => {
    const forkTube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 8), chromeMat);
    forkTube.position.set(fx, 0.65, -0.72);
    forkTube.rotation.x = -0.26;
    group.add(forkTube);
  });

  const rearW = createSpokeMotorbikeWheel(0.34, 0.12);
  rearW.position.set(0, 0.34, 0.78);
  group.add(rearW);

  const rearFender = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.15, 16, 1, false, 0, Math.PI),
    tankMat
  );
  rearFender.rotation.z = Math.PI / 2;
  rearFender.position.set(0, 0.42, 0.78);
  group.add(rearFender);

  // Chrome Handlebars with riser & black rubber grips
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 8), chromeMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, 1.06, -0.58);
  group.add(handle);

  [-0.32, 0.32].forEach((gx) => {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 6), seatMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(gx, 1.06, -0.58);
    group.add(grip);
  });

  // Single round chrome headlight
  const headlight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.09, 14),
    createGameMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.85 })
  );
  headlight.rotation.x = Math.PI / 2;
  headlight.position.set(0, 0.92, -0.82);
  group.add(headlight);

  // Rear rectangular red tail lamp with brake support
  const tailLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.06),
    createGameMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.85 })
  );
  tailLight.position.set(0, 0.78, 0.96);
  group.add(tailLight);

  // Pakistani Commuter Rider in Shalwar Kameez
  const riderTorso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.54, 0.24), shirtMat);
  riderTorso.position.set(0, 1.24, 0.24);
  riderTorso.rotation.x = 0.26;
  group.add(riderTorso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), skinMat);
  head.position.set(0, 1.62, 0.14);
  group.add(head);

  const helmetOrCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.08, 10),
    createGameMaterial({ color: 0xfacc15, roughness: 0.4 })
  );
  helmetOrCap.position.set(0, 1.72, 0.14);
  group.add(helmetOrCap);

  // Blinkers
  const leftBlinkerMat = createGameMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.1 });
  const rightBlinkerMat = createGameMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.1 });

  [-0.22, 0.22].forEach((bx) => {
    const mat = bx < 0 ? leftBlinkerMat : rightBlinkerMat;
    const fInd = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), mat);
    fInd.position.set(bx, 0.95, -0.68);
    group.add(fInd);

    const rInd = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), mat);
    rInd.position.set(bx, 0.78, 0.94);
    group.add(rInd);
  });

  group.userData = {
    isMotorbike: true,
    isBike: true,
    wheels: [frontW, rearW],
    speed: 0,
    targetLaneX: 0,
    leftBlinkerMat,
    rightBlinkerMat,
    brakeMat: tailLight.material as THREE.Material
  };

  return normalizeModelBase(group, true, 0.95, 1.9);
}

// 7. Ambient Walking Pedestrians (Living World on Sidewalks)
export function createPedestrian(shirtColor = 0x0284c7): THREE.Group {
  const group = new THREE.Group();
  const skinMat = createGameMaterial({ color: 0xd4a373, roughness: 0.7 });
  const shirtMat = createGameMaterial({ color: shirtColor, roughness: 0.8 });
  const pantsMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.85 });
  const hairMat = createGameMaterial({ color: 0x1e293b, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.22), shirtMat);
  torso.position.y = 1.025;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), skinMat);
  head.position.y = 1.45;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), hairMat);
  hair.position.set(0, 1.49, -0.02);
  group.add(hair);

  // Legs with exact base at y = 0 (height 0.75, center at 0.375)
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.16), pantsMat);
  leftLeg.position.set(-0.1, 0.375, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.16), pantsMat);
  rightLeg.position.set(0.1, 0.375, 0);
  group.add(rightLeg);

  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.walkPhase = Math.random() * Math.PI * 2;
  return normalizeModelBase(group, true, 0.75, 0.75);
}

// 8. Roadside Puddles with Sky & Light Sheen (Shared geometry & material)
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

/**
 * Helper to create a positioned/rotated BufferGeometry for static building merging.
 */
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

// 9. Merged Multilevel Pakistani City Buildings (Body + Balconies + Brackets + ACs + Awning Poles + Rooftop merged from ground up)
export function createCityBuilding(styleIdx = 0): THREE.Group {
  const group = new THREE.Group();
  const width = 13.5;
  const depth = 10.0;
  const style = styleIdx % 5;

  let height = 16.5;
  let facadeMat: THREE.MeshStandardMaterial;

  if (style === 0) {
    height = 19.0;
    facadeMat = createGameMaterial({
      map: TextureCache.getHeritageMughalFacade(),
      roughness: 0.65,
      bumpScale: 0.08
    });
  } else if (style === 1) {
    height = 25.0;
    facadeMat = createGameMaterial({
      map: TextureCache.getPlaza(),
      roughness: 0.18,
      metalness: 0.4
    });
  } else if (style === 2) {
    height = 17.5;
    facadeMat = createGameMaterial({
      map: TextureCache.getBrick(),
      roughness: 0.72
    });
  } else if (style === 3) {
    height = 15.0;
    facadeMat = createGameMaterial({
      color: 0x9a3412,
      roughness: 0.6
    });
  } else {
    height = 21.5;
    facadeMat = createGameMaterial({
      color: 0x0d9488,
      roughness: 0.5
    });
  }

  // Main Building Block (base at y = 0, front wall at z = 0)
  const blockGeo = makePartGeo(new THREE.BoxGeometry(width, height, depth), 0, height / 2, -depth / 2);
  const block = new THREE.Mesh(blockGeo, facadeMat);
  block.frustumCulled = false;
  group.add(block);

  // Merge all metal/stone trim parts (Storefront frame, Awning support poles reaching y=0, Balconies flush to wall + support brackets, ACs + brackets, Rooftop structures) into ONE merged geometry!
  const trimGeos: THREE.BufferGeometry[] = [];

  // Ground Storefront frame flush to z = 0
  trimGeos.push(makePartGeo(new THREE.BoxGeometry(width * 0.94, 3.5, 0.24), 0, 1.75, 0.12));

  // Awning support poles reaching all the way to the ground (y = 0 to y = 3.5)
  [-width * 0.44, 0, width * 0.44].forEach((px) => {
    trimGeos.push(makePartGeo(new THREE.CylinderGeometry(0.06, 0.07, 3.5, 6), px, 1.75, 1.45));
  });

  // Upper Balconies & AC Units flush to facade (z = 0) with structural support brackets
  for (let y = 7.0; y < height - 2.0; y += 3.6) {
    for (let x = -width / 2 + 2.0; x < width / 2 - 1.2; x += 3.2) {
      // Balcony slab & railing flush with front wall (z = 0 to +0.62)
      trimGeos.push(makePartGeo(new THREE.BoxGeometry(2.0, 0.45, 0.62), x, y - 0.7, 0.31));
      // Two triangular/angled support corbel brackets under each balcony flush to wall
      trimGeos.push(makePartGeo(new THREE.BoxGeometry(0.14, 0.45, 0.55), x - 0.75, y - 1.05, 0.25));
      trimGeos.push(makePartGeo(new THREE.BoxGeometry(0.14, 0.45, 0.55), x + 0.75, y - 1.05, 0.25));

      // Outdoor AC Compressor Unit + wall mounting bracket flush to z = 0
      trimGeos.push(makePartGeo(new THREE.BoxGeometry(0.75, 0.5, 0.44), x + 1.0, y + 0.35, 0.22));
      trimGeos.push(makePartGeo(new THREE.BoxGeometry(0.70, 0.12, 0.42), x + 1.0, y + 0.05, 0.21));
    }
  }

  // Rooftop Water Tank + Base Stand flush on roof (y = height)
  trimGeos.push(makePartGeo(new THREE.CylinderGeometry(1.0, 1.0, 1.9, 12), width * 0.34, height + 0.95, -depth * 0.6));

  // Architectural Rooftop Features by Style
  if (style === 0) {
    trimGeos.push(makePartGeo(new THREE.CylinderGeometry(1.6, 1.8, 0.6, 12), 0, height + 0.3, -depth * 0.4));
    trimGeos.push(
      makePartGeo(new THREE.SphereGeometry(1.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, height + 0.6, -depth * 0.4)
    );
    trimGeos.push(makePartGeo(new THREE.CylinderGeometry(0.04, 0.12, 1.2, 6), 0, height + 2.4, -depth * 0.4));
  } else if (style === 1) {
    trimGeos.push(makePartGeo(new THREE.CylinderGeometry(0.08, 0.35, 6.5, 6), 0, height + 3.25, -depth * 0.4));
  } else {
    [-3.2, 3.2].forEach((tx) => {
      trimGeos.push(makePartGeo(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6), tx, height + 1.4, -depth * 0.2));
    });
  }

  // Clean UVs before merging trimGeos
  for (const g of trimGeos) {
    if (g.attributes.uv) g.deleteAttribute('uv');
  }
  const mergedTrimGeo = mergeGeometries(trimGeos, false);
  trimGeos.forEach((g) => g.dispose());
  const trimMat = createGameMaterial({ color: 0xe2e8f0, metalness: 0.45, roughness: 0.5 });
  const mergedTrimMesh = new THREE.Mesh(mergedTrimGeo, trimMat);
  mergedTrimMesh.frustumCulled = false;
  group.add(mergedTrimMesh);

  // Striped Fabric Awning over storefront supported by the awning poles
  const awningColors = [0xdc2626, 0x0284c7, 0x16a34a, 0xd97706, 0x7c3aed];
  const awningMat = createGameMaterial({
    color: awningColors[style],
    roughness: 0.75
  });
  const awning = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 0.2, 1.6), awningMat);
  awning.rotation.x = 0.22;
  awning.position.set(0, 3.6, 0.78);
  group.add(awning);

  // Authentic Urdu & English Shopfront Signboard mounted flush to facade with brackets
  const signConfigs = [
    { main: 'BADSHAHI HERITAGE SWEETS', sub: 'شاہی مٹھائیاں و فالودہ' },
    { main: 'NATIONAL COMMERCE TOWER', sub: 'قومی تجارتی بینک پاکستان' },
    { main: 'ANARKALI SILK & TEXTILES', sub: 'انارکلی بنارسی ریشم و کڑھائی' },
    { main: 'QUETTA CHAI & TIKKA DHABA', sub: 'کوئٹہ کڑک چائے و شنواری کباب' },
    { main: 'PUNJAB PHARMACY & GENERAL', sub: 'پنجاب میڈیکل و جنرل سٹور' }
  ];
  const cfg = signConfigs[style];
  const signMat = createGameMaterial({
    kind: 'basic',
    map: TextureCache.getShopSign(cfg.main, cfg.sub)
  });
  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 1.3, 0.16), signMat);
  signMesh.position.set(0, 4.55, 0.08);
  group.add(signMesh);

  if (style >= 2) {
    // Rooftop Neon Commercial Billboard mounted on the merged truss posts
    const bbMat = createGameMaterial({
      kind: 'basic',
      map: TextureCache.getNeonBillboard('5G SUPER SPEED PAKISTAN', 'TUK-TUK 4G FAST')
    });
    const bbMesh = new THREE.Mesh(new THREE.BoxGeometry(8.0, 2.5, 0.18), bbMat);
    bbMesh.position.set(0, height + 1.5, -depth * 0.2);
    group.add(bbMesh);
  }

  return normalizeModelBase(group, false);
}

// 9b. Ceremonial Road Arch Banner ("Welcome to Lahore / Dekh Magar Pyar Se") with Pillars reaching ground
export function createOverheadStreetArch(roadWidth = 14.0): THREE.Group {
  const group = new THREE.Group();
  const pillarMat = createGameMaterial({ color: 0x1e293b, metalness: 0.85 });
  const beamMat = createGameMaterial({ color: 0x334155, metalness: 0.8 });
  const lampMat = createGameMaterial({ kind: 'basic', color: 0xfef08a });

  const halfW = roadWidth / 2 + 0.9;
  const archHeight = 6.8;

  // Left & Right Support Columns anchored at y = 0
  [-halfW, halfW].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, archHeight, 0.5), pillarMat);
    post.position.set(px, archHeight / 2, 0);
    group.add(post);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.9), pillarMat);
    base.position.set(px, 0.225, 0);
    group.add(base);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), lampMat);
    lamp.position.set(px, archHeight + 0.3, 0);
    group.add(lamp);
  });

  // Cross Beam Structure
  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 2.2, 0.45, 0.45), beamMat);
  crossBeam.position.set(0, archHeight, 0);
  group.add(crossBeam);

  // Arched Banner Sign attached to crossBeam
  const bannerMat = createGameMaterial({
    kind: 'basic',
    map: TextureCache.getOverheadArchTexture(),
    side: THREE.DoubleSide
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(roadWidth * 0.88, 1.6, 0.14), bannerMat);
  banner.position.set(0, archHeight - 0.7, 0);
  group.add(banner);

  return normalizeModelBase(group, false);
}

// 9c. Atmospheric Background Skyline (Parallax strip attached to sky group, not chunks)
export function createBackgroundSkyline(side: number): THREE.Group {
  const group = new THREE.Group();
  const skyMat = createGameMaterial({
    color: 0x1e293b,
    roughness: 0.9,
    curveMultiplier: 0.25
  });

  const baseZ = [-180, -110, -40, 30, 100];
  baseZ.forEach((bz, idx) => {
    const h = 26 + (idx % 3) * 10;
    const w = 14 + (idx % 2) * 8;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 24), skyMat);
    b.position.set(side * 42.0, h / 2, bz);
    group.add(b);

    if (idx % 2 === 1) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.4, 14, 8), skyMat);
      spire.position.set(side * 42.0, h + 7, bz);
      group.add(spire);
    }
  });

  return normalizeModelBase(group, false);
}

// 9d. High-Performance Hydraulic Suspension Jump Pickup
export function createHydraulicPickup(): THREE.Group {
  const group = new THREE.Group();
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.8, 12),
    createGameMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.25 })
  );
  group.add(cylinder);

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1.1, 10),
    createGameMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.1 })
  );
  rod.position.y = 0.2;
  group.add(rod);

  const coilMat = createGameMaterial({ color: 0x22c55e, metalness: 0.8 });
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12), coilMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.25 + i * 0.12;
    group.add(ring);
  }
  patchObjectHierarchy(group);
  return group;
}

// 9e. Authentic Pakistani Green CNG Cylinder Pickup
export function createCNGCylinderPickup(): THREE.Group {
  const group = new THREE.Group();
  const cngMat = createGameMaterial({ color: 0x15803d, metalness: 0.5, roughness: 0.4 });
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.75, 14), cngMat);
  group.add(cylinder);
  patchObjectHierarchy(group);
  return group;
}

// 10. Palm Tree (Pre-merged shared trunk + planter and 7-leaf geometries)
let _sharedPalmTrunkGeo: THREE.BufferGeometry | null = null;
let _sharedPalmLeavesGeo: THREE.BufferGeometry | null = null;
let _sharedPalmTrunkMat: THREE.Material | null = null;
let _sharedPalmLeafMat: THREE.Material | null = null;

export function createPalmTree(): THREE.Group {
  if (!_sharedPalmTrunkGeo) {
    const trunkPart = new THREE.CylinderGeometry(0.18, 0.28, 5.8, 8);
    trunkPart.translate(0, 2.9, 0);
    const planterPart = new THREE.CylinderGeometry(0.48, 0.52, 0.32, 8);
    planterPart.translate(0, 0.16, 0);
    _sharedPalmTrunkGeo = mergeGeometries([trunkPart, planterPart], false);
    trunkPart.dispose();
    planterPart.dispose();
    _sharedPalmTrunkMat = createGameMaterial({ color: 0x78350f, roughness: 0.9 });
  }

  if (!_sharedPalmLeavesGeo) {
    const leafParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leafPart = new THREE.PlaneGeometry(1.2, 3.0);
      leafPart.rotateX(0.55);
      leafPart.rotateY(angle);
      leafPart.translate(Math.cos(angle) * 1.3, 5.6, Math.sin(angle) * 1.3);
      leafParts.push(leafPart);
    }
    _sharedPalmLeavesGeo = mergeGeometries(leafParts, false);
    leafParts.forEach((g) => g.dispose());
    _sharedPalmLeafMat = createGameMaterial({ color: 0x16a34a, roughness: 0.4, side: THREE.DoubleSide });
  }

  const group = new THREE.Group();
  const trunk = new THREE.Mesh(_sharedPalmTrunkGeo, _sharedPalmTrunkMat);
  const leaves = new THREE.Mesh(_sharedPalmLeavesGeo, _sharedPalmLeafMat);
  group.add(trunk);
  group.add(leaves);
  return normalizeModelBase(group, true, 1.4, 1.4);
}

// 11. Standalone Traditional Roadside Dhaba with Wooden Takhts (with 4 legs reaching y = 0), Posts reaching y = 0, & Counter
export function createModularDhaba(variant = 0): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createGameMaterial({ color: 0x78350f, roughness: 0.85 });
  const bambooMat = createGameMaterial({ color: 0xd97706, roughness: 0.75 });
  const copperMat = createGameMaterial({ color: 0xb45309, metalness: 0.9, roughness: 0.2 });
  const canopyColors = [0x15803d, 0xb91c1c, 0x0284c7, 0xd97706];

  // Ground floor slab at y = 0
  const floorSlab = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.12, 4.0),
    createGameMaterial({ color: 0x475569, roughness: 0.9 })
  );
  floorSlab.position.set(0, 0.06, 0);
  group.add(floorSlab);

  // Wooden Open-Air Staked Hut Roof resting on the 4 corner posts (posts reach y = 0 to y = 3.6)
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.6, 1.4, 4),
    createGameMaterial({ color: canopyColors[variant % 4], roughness: 0.8 })
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 4.2;
  group.add(roof);

  // 4 Bamboo Corner Support Posts reaching from y = 0 to y = 3.6
  [[-2.2, -1.8], [2.2, -1.8], [-2.2, 1.8], [2.2, 1.8]].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 3.6, 6), bambooMat);
    post.position.set(px, 1.8, pz);
    group.add(post);
  });

  // Authentic Urdu / Punjabi Dhaba Signboard attached between front posts
  const dhabaSigns = [
    { main: 'MIAN JI DAAL ROTI DHABA', sub: 'دیسی گھی کی دال اور گرما گرم تندوری روٹی' },
    { main: 'KHYBER SHINWARI TIKKA', sub: 'دنبہ کڑاہی اور پشاوری چپلی کباب' },
    { main: 'BABA CHAI & PARATHA', sub: 'دودھ پتی چائے اور لچھے دار پراٹھا' },
    { main: 'BALOCHI SAJJI HOUSE', sub: 'اصلی کوئٹہ سجی اور چکن کڑاہی' }
  ];
  const sInfo = dhabaSigns[variant % 4];
  const signMesh = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.1, 0.12),
    createGameMaterial({
      kind: 'basic',
      map: TextureCache.getShopSign(sInfo.main, sInfo.sub, '#fef08a', '#1e293b')
    })
  );
  signMesh.position.set(0, 3.1, 1.8);
  group.add(signMesh);

  // Traditional Wooden Takht / Charpai Bench with 4 wooden legs reaching y = 0
  const takht = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 1.4), woodMat);
  takht.position.set(-0.6, 0.46, 0);
  group.add(takht);

  [[-1.65, -0.55], [0.45, -0.55], [-1.65, 0.55], [0.45, 0.55]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.46, 6), woodMat);
    leg.position.set(lx, 0.23, lz);
    group.add(leg);
  });

  // Wooden Counter Table reaching y = 0 for the Samovar Kettle & Tray (so nothing floats!)
  const counterTable = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.88, 1.8), woodMat);
  counterTable.position.set(1.4, 0.44, 0);
  group.add(counterTable);

  // Big Copper Chai Samovar / Boiling Kettle resting on Counter Table (base at 0.88)
  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.75, 12), copperMat);
  kettle.position.set(1.4, 0.88 + 0.375, 0.4);
  group.add(kettle);

  // Chai Tray resting on Counter Table
  const tray = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.04, 12),
    createGameMaterial({ color: 0xe2e8f0, metalness: 0.9 })
  );
  tray.position.set(1.4, 0.90, -0.45);
  group.add(tray);

  return normalizeModelBase(group, false);
}

// 12. Local Kiosk / Paan & Cold Drinks Stall (anchored at y = 0)
export function createModularPaanShop(variant = 0): THREE.Group {
  const group = new THREE.Group();
  const metalMat = createGameMaterial({ color: 0x334155, roughness: 0.5 });

  // Compact Kiosk Booth sitting on y = 0
  const booth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 1.8), metalMat);
  booth.position.y = 1.4;
  group.add(booth);

  // Service counter + support brackets
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.14, 0.5),
    createGameMaterial({ color: 0xf59e0b, roughness: 0.3 })
  );
  counter.position.set(0, 1.1, 0.95);
  group.add(counter);

  const paanSigns = [
    { main: 'SHAHI PAAN & CHAI CORNER', sub: 'میٹھا پان اور راجہ جانی پان' },
    { main: 'LAHORE NIMKO & COLD DRINKS', sub: 'ٹھنڈا مشروب اور تازہ جوس' },
    { main: 'MULTAN SOHAN HALWA', sub: 'اصلی حافظ کا سوہن حلوہ' },
    { main: 'AL-MADINA CELLULAR & EASYPAISA', sub: 'ایزی پیسہ اور موبائل بیلنس' }
  ];
  const pInfo = paanSigns[variant % 4];
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.7, 0.1),
    createGameMaterial({
      kind: 'basic',
      map: TextureCache.getShopSign(pInfo.main, pInfo.sub, '#fbbf24', '#0f172a')
    })
  );
  sign.position.set(0, 2.5, 0.92);
  group.add(sign);

  return normalizeModelBase(group, false);
}

// 13. Iconic Pakistani Bedford "Chamak Patti" Rocket Truck
export function createBedfordTruck(): THREE.Group {
  const root = new THREE.Group();
  const steelMat = createGameMaterial({ color: 0x1e293b, roughness: 0.7 });
  const redMat = createGameMaterial({ color: 0xb91c1c, metalness: 0.3, roughness: 0.4 });
  const yellowMat = createGameMaterial({ color: 0xf59e0b, metalness: 0.2, roughness: 0.4 });
  const greenMat = createGameMaterial({ color: 0x059669, metalness: 0.2, roughness: 0.4 });
  const chromeMat = createGameMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.08 });
  const brassMat = createGameMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2 });
  const wheelRubberMat = createGameMaterial({ color: 0x18181b, roughness: 0.94 });
  const rimMat = createGameMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.25 });
  const darkGlassMat = createGameMaterial({
    kind: 'physical',
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.65
  });

  // Heavy I-Beam chassis rails
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.45, 8.2), steelMat);
  chassis.position.y = 0.85;
  root.add(chassis);

  // 6 Heavy Dual-Rim Truck Wheels
  const wheelFL = createRickshawWheel(0.65, 0.34, wheelRubberMat, rimMat, chromeMat);
  wheelFL.position.set(-1.18, 0.65, -2.6);
  root.add(wheelFL);

  const wheelFR = createRickshawWheel(0.65, 0.34, wheelRubberMat, rimMat, chromeMat);
  wheelFR.position.set(1.18, 0.65, -2.6);
  root.add(wheelFR);

  const wheelRL1 = createRickshawWheel(0.68, 0.38, wheelRubberMat, rimMat, chromeMat);
  wheelRL1.position.set(-1.22, 0.68, 1.6);
  root.add(wheelRL1);

  const wheelRR1 = createRickshawWheel(0.68, 0.38, wheelRubberMat, rimMat, chromeMat);
  wheelRR1.position.set(1.22, 0.68, 1.6);
  root.add(wheelRR1);

  const wheelRL2 = createRickshawWheel(0.68, 0.38, wheelRubberMat, rimMat, chromeMat);
  wheelRL2.position.set(-1.22, 0.68, 2.9);
  root.add(wheelRL2);

  const wheelRR2 = createRickshawWheel(0.68, 0.38, wheelRubberMat, rimMat, chromeMat);
  wheelRR2.position.set(1.22, 0.68, 2.9);
  root.add(wheelRR2);

  root.userData.wheels = [wheelFL, wheelFR, wheelRL1, wheelRR1, wheelRL2, wheelRR2];

  // Bedford TJ Cab (Curved classic British-Pakistani cab with rounded shoulder)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.2), redMat);
  cab.position.set(0, 1.85, -2.4);
  root.add(cab);

  // Windshield visor / brow awning
  const cabVisor = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.12, 0.3), yellowMat);
  cabVisor.position.set(0, 2.65, -3.42);
  cabVisor.rotation.x = 0.2;
  root.add(cabVisor);

  // Split Two-Piece Flat Glass Windshield with central divider
  const windshieldL = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.72), darkGlassMat);
  windshieldL.position.set(-0.56, 2.15, -3.51);
  root.add(windshieldL);

  const windshieldR = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.72), darkGlassMat);
  windshieldR.position.set(0.56, 2.15, -3.51);
  root.add(windshieldR);

  const divider = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 0.05), chromeMat);
  divider.position.set(0, 2.15, -3.51);
  root.add(divider);

  // Tapered Alligator Hood (Bonnet)
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.15, 1.6, 16), yellowMat);
  hood.rotation.x = Math.PI / 2;
  hood.position.set(0, 1.65, -3.7);
  root.add(hood);

  // Chrome vertical grille ribs
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.85, 0.12), chromeMat);
  grille.position.set(0, 1.5, -4.52);
  root.add(grille);

  // Carved Wooden Crown ("Taj") atop Cab
  const crownGeo = new THREE.BoxGeometry(2.42, 1.1, 0.22);
  const crownMat = createGameMaterial({
    map: TextureCache.getBedfordCrownArt(),
    roughness: 0.35
  });
  const crown = new THREE.Mesh(crownGeo, crownMat);
  crown.position.set(0, 3.2, -2.2);
  root.add(crown);

  // Twin Long Brass Air Horns mounted atop the cab roof
  [-0.6, 0.6].forEach((hx) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.75, 10), brassMat);
    horn.rotation.x = -Math.PI / 2;
    horn.position.set(hx, 2.8, -2.8);
    root.add(horn);
  });

  // Massive Wooden High-Sided Cargo Body with painted panel slats
  const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.3, 5.0), greenMat);
  cargoBox.position.set(0, 2.2, 1.2);
  root.add(cargoBox);

  // Top extension side rails (wood planks)
  const topRailL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 5.0), yellowMat);
  topRailL.position.set(-1.26, 3.45, 1.2);
  root.add(topRailL);

  const topRailR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 5.0), yellowMat);
  topRailR.position.set(1.26, 3.45, 1.2);
  root.add(topRailR);

  // Chamak-patti reflective side strips in alternating amber and red
  const stripAmberMat = createGameMaterial({ color: 0xf59e0b, roughness: 0.4 });
  const stripRedMat = createGameMaterial({ color: 0xef4444, roughness: 0.4 });
  for (let s = -1.3; s <= 1.3; s += 2.6) {
    for (let h = 1.3; h <= 3.1; h += 0.45) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.16, 4.95),
        h % 0.9 === 0 ? stripAmberMat : stripRedMat
      );
      strip.position.set(s, h, 1.2);
      root.add(strip);
    }
  }

  // Authentic Framed Rear Tailboard Art Painting
  const tailboardGeo = new THREE.PlaneGeometry(2.52, 1.95);
  const tailboardMat = createGameMaterial({ kind: 'basic', map: TextureCache.getBedfordTailboardArt() });
  const tailboard = new THREE.Mesh(tailboardGeo, tailboardMat);
  tailboard.position.set(0, 2.05, 3.72);
  root.add(tailboard);

  // Rear Heavy Mudflaps with painted warning
  [-0.92, 0.92].forEach((mx) => {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.05), steelMat);
    flap.position.set(mx, 0.48, 3.65);
    root.add(flap);
  });

  // Hanging Brass/Steel Jangla Chains that chime and sway
  for (let cx = -1.0; cx <= 1.0; cx += 0.25) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.45, 6), chromeMat);
    chain.position.set(cx, 0.6, 3.7);
    root.add(chain);
  }

  // Heavy Front Chrome Bullbar with towing hooks
  const bullbar = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.35, 0.25), chromeMat);
  bullbar.position.set(0, 0.75, -4.55);
  root.add(bullbar);

  const bullbarUpL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), chromeMat);
  bullbarUpL.position.set(-0.85, 1.0, -4.55);
  root.add(bullbarUpL);

  const bullbarUpR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), chromeMat);
  bullbarUpR.position.set(0.85, 1.0, -4.55);
  root.add(bullbarUpR);

  // Headlamps & Fog Lights
  const glowMat = createGameMaterial({ kind: 'basic', color: 0xfef08a });
  [-0.9, 0.9].forEach((lx) => {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 12), brassMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(lx, 1.35, -4.5);
    root.add(lamp);

    const lightGlow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), glowMat);
    lightGlow.position.set(lx, 1.35, -4.56);
    root.add(lightGlow);
  });

  // High-mounted side mirrors
  [-1.35, 1.35].forEach((mx) => {
    const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), chromeMat);
    mirrorStem.rotation.z = (mx > 0 ? -1 : 1) * 0.45;
    mirrorStem.position.set(mx * 0.92, 2.1, -3.2);
    root.add(mirrorStem);

    const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.16), steelMat);
    mirrorHead.position.set(mx, 2.2, -3.2);
    root.add(mirrorHead);
  });

  return normalizeModelBase(root, true, 2.7, 8.6);
}

// 14. Cultural Street Hazard: Pakistani Sahiwal Zebu Cow
export function createSahiwalCow(): THREE.Group {
  const root = new THREE.Group();
  const hideMat = createGameMaterial({ color: 0x9a3412, roughness: 0.85 });
  const hornMat = createGameMaterial({ color: 0x1e293b, roughness: 0.4 });
  const bellMat = createGameMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.7, 2.0, 12), hideMat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 1.25, 0);
  root.add(body);

  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), hideMat);
  hump.scale.set(0.7, 1.1, 0.9);
  hump.position.set(0, 1.85, -0.45);
  root.add(hump);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.85, 10), hideMat);
  neck.rotation.x = -0.55;
  neck.position.set(0, 1.55, -1.05);
  root.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.75), hideMat);
  head.position.set(0, 1.7, -1.5);
  root.add(head);

  [-0.22, 0.22].forEach((hx) => {
    const horn = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 12, Math.PI * 0.7), hornMat);
    horn.rotation.y = hx > 0 ? 0.3 : -0.3;
    horn.rotation.x = -0.4;
    horn.position.set(hx, 2.0, -1.45);
    root.add(horn);
  });

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.06, 8, 16),
    createGameMaterial({ color: 0xef4444 })
  );
  collar.rotation.x = 0.9;
  collar.position.set(0, 1.35, -0.9);
  root.add(collar);

  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 8), bellMat);
  bell.rotation.x = Math.PI;
  bell.position.set(0, 0.9, -0.95);
  root.add(bell);

  const legPositions = [
    [-0.38, -0.65],
    [0.38, -0.65],
    [-0.38, 0.65],
    [0.38, 0.65]
  ];
  legPositions.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 1.05, 8), hideMat);
    leg.position.set(lx, 0.525, lz);
    root.add(leg);

    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 8), hornMat);
    hoof.position.set(lx, 0.08, lz);
    root.add(hoof);
  });

  return normalizeModelBase(root, true, 1.6, 2.5);
}

// 19. Pakistani Bus with Incline Roof Jump Ramp
// Follows the canonical ramp convention in config.ts:
// - Low end at zLow = +BUS_RAMP_LOW_OFFSET_Z (+9.4m, y = 0.0m, reached first by player traveling toward -Z)
// - High end at zHigh = +BUS_RAMP_HIGH_OFFSET_Z (+4.2m, y = 2.8m, meeting the bus roof)
// - Positive rotation.x (+atan2(rise, run)) tilts the ramp surface UP toward -Z
// - Directional V-chevrons on the ramp point toward -Z (away from camera, in the direction of travel)
export function createBusWithRamp(isMetro = false): THREE.Group {
  const busGroup = createTransportBus(isMetro);
  busGroup.userData.hasRamp = true;
  busGroup.userData.roofHeight = BUS_ROOF_HEIGHT;
  busGroup.userData.rampLowOffsetZ = BUS_RAMP_LOW_OFFSET_Z;
  busGroup.userData.rampHighOffsetZ = BUS_RAMP_HIGH_OFFSET_Z;

  const rampMat = createGameMaterial({
    color: 0xf59e0b,
    metalness: 0.55,
    roughness: 0.4
  });

  const rampWidth = 2.2;
  const rampRun = BUS_RAMP_LENGTH; // 5.2m horizontal run from +9.4m to +4.2m
  const rampRise = BUS_ROOF_HEIGHT - ROAD_Y; // 2.8m vertical rise
  const slabLen = Math.hypot(rampRun, rampRise);
  const rampAngle = Math.atan2(rampRise, rampRun); // POSITIVE +0.494 rad tilts +Z end DOWN to ground (y=0) and -Z end UP to roof (y=2.8)!
  const rampCenterZ = (BUS_RAMP_LOW_OFFSET_Z + BUS_RAMP_HIGH_OFFSET_Z) * 0.5; // +6.8m
  const rampCenterY = ROAD_Y + rampRise * 0.5; // 1.4m

  const rampGeo = new THREE.BoxGeometry(rampWidth, 0.18, slabLen);
  const ramp = new THREE.Mesh(rampGeo, rampMat);
  ramp.rotation.x = rampAngle;
  ramp.position.set(0, rampCenterY, rampCenterZ);
  ramp.userData.ignoreBaseNormalize = true;
  busGroup.add(ramp);

  // Solid side support gussets under the ramp so it looks anchored to the road & bus rear
  const supportMat = createGameMaterial({ color: 0x334155, roughness: 0.8 });
  [-rampWidth * 0.45, rampWidth * 0.45].forEach((sx) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, rampRise * 0.5, 0.24), supportMat);
    post.position.set(sx, rampRise * 0.25, rampCenterZ - 0.8);
    post.userData.ignoreBaseNormalize = true;
    busGroup.add(post);
  });

  // Directional V-Chevrons on the ramp surface pointing toward -Z (direction of travel)
  const chevronRedMat = createGameMaterial({
    color: 0xef4444,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.65,
    roughness: 0.3
  });
  const chevronDarkMat = createGameMaterial({ kind: 'basic', color: 0x0f172a });

  const chevronPositions = [-slabLen * 0.34, -slabLen * 0.11, slabLen * 0.12, slabLen * 0.35];
  chevronPositions.forEach((cz, idx) => {
    const mat = idx % 2 === 0 ? chevronRedMat : chevronDarkMat;
    const armLen = rampWidth * 0.46;
    // Left arm of V-chevron: angled from outer-left (+z) to center-tip (-z)
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.03, 0.18), mat);
    leftArm.position.set(-armLen * 0.38, 0.105, cz);
    leftArm.rotation.y = Math.PI * 0.2;
    ramp.add(leftArm);

    // Right arm of V-chevron: angled from outer-right (+z) to center-tip (-z)
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.03, 0.18), mat);
    rightArm.position.set(armLen * 0.38, 0.105, cz);
    rightArm.rotation.y = -Math.PI * 0.2;
    ramp.add(rightArm);
  });

  patchObjectHierarchy(busGroup);
  return busGroup;
}

// 20. Lahore / Karachi Street Cat (Crossing the road)
export function createStrayCat(): THREE.Group {
  const root = new THREE.Group();
  const gingerFurMat = createGameMaterial({ color: 0xea580c, roughness: 0.7 });
  const whiteMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.8 });
  const noseMat = createGameMaterial({ color: 0xf43f5e });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.6), gingerFurMat);
  body.position.set(0, 0.26, 0);
  root.add(body);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), whiteMat);
  chest.position.set(0, 0.24, -0.2);
  root.add(chest);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), gingerFurMat);
  head.position.set(0, 0.38, -0.38);
  root.add(head);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), noseMat);
  nose.position.set(0, 0.35, -0.5);
  root.add(nose);

  [-0.08, 0.08].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), gingerFurMat);
    ear.rotation.y = Math.PI / 4;
    ear.position.set(ex, 0.52, -0.36);
    root.add(ear);
  });

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.45, 6), gingerFurMat);
  tail.rotation.x = 0.8;
  tail.position.set(0, 0.38, 0.38);
  root.add(tail);
  root.userData.tail = tail;

  const legs: THREE.Mesh[] = [];
  [[-0.08, -0.18], [0.08, -0.18], [-0.08, 0.18], [0.08, 0.18]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.24, 6), whiteMat);
    leg.position.set(lx, 0.12, lz);
    root.add(leg);
    legs.push(leg);
  });
  root.userData.legs = legs;

  root.userData.isCat = true;
  root.userData.crossDir = Math.random() < 0.5 ? 1 : -1;
  root.userData.crossSpeed = 4.2 + Math.random() * 2.0;
  root.userData.runPhase = Math.random() * Math.PI;

  return normalizeModelBase(root, true, 0.65, 0.85);
}

// 21. Crossing Pedestrian in Pakistani Shalwar Kameez & Kurta
export function createCrossingPedestrian(shirtColor: number = 0x059669): THREE.Group {
  const root = new THREE.Group();
  const kurtaMat = createGameMaterial({ color: shirtColor, roughness: 0.8 });
  const shalwarMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.85 });
  const skinMat = createGameMaterial({ color: 0xd97706, roughness: 0.6 });
  const hairMat = createGameMaterial({ color: 0x0f172a, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), kurtaMat);
  torso.position.set(0, 1.25, 0);
  root.add(torso);

  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.3), kurtaMat);
  flap.position.set(0, 0.8, 0);
  root.add(flap);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), skinMat);
  head.position.set(0, 1.78, 0);
  root.add(head);

  const topi = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 12), hairMat);
  topi.position.set(0, 1.9, 0);
  root.add(topi);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), kurtaMat);
  leftArm.position.set(-0.35, 1.2, 0);
  root.add(leftArm);
  root.userData.leftArm = leftArm;

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), kurtaMat);
  rightArm.position.set(0.35, 1.2, 0);
  root.add(rightArm);
  root.userData.rightArm = rightArm;

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.18), shalwarMat);
  leftLeg.position.set(-0.16, 0.425, 0);
  root.add(leftLeg);
  root.userData.leftLeg = leftLeg;

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.18), shalwarMat);
  rightLeg.position.set(0.16, 0.425, 0);
  root.add(rightLeg);
  root.userData.rightLeg = rightLeg;

  root.userData.isCrossingPed = true;
  root.userData.crossDir = Math.random() < 0.5 ? 1 : -1;
  root.userData.crossSpeed = 2.4 + Math.random() * 1.2;
  root.userData.walkPhase = Math.random() * Math.PI;

  return normalizeModelBase(root, true, 0.8, 0.8);
}

// =========================================================================
// HIGHWAY PATROL POLICE CAR (White/Green, Red/Blue Lightbar)
// =========================================================================
export function createHighwayPatrolCar(side: 'left' | 'right' = 'left'): THREE.Group {
  const root = new THREE.Group();

  const whiteBodyMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.1 });
  const greenStripeMat = createGameMaterial({ color: 0x14532d, roughness: 0.35 });
  const darkGlassMat = createGameMaterial({
    kind: 'physical',
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.7
  });
  const blackTrimMat = createGameMaterial({ color: 0x1e293b, roughness: 0.85 });
  const chromeMat = createGameMaterial({ color: 0xf1f5f9, roughness: 0.1, metalness: 0.95 });
  const wheelRubberMat = createGameMaterial({ color: 0x18181b, roughness: 0.94 });
  const rimMat = createGameMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.25 });

  // Main Cruiser Lower Body
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.55, 3.9), whiteBodyMat);
  chassis.position.set(0, 0.52, 0);
  root.add(chassis);

  // Distinctive Punjab Police / Highway Patrol Dark Green Lower Livery Stripe
  const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 3.8), greenStripeMat);
  stripeL.position.set(-0.92, 0.52, 0);
  root.add(stripeL);

  const stripeR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 3.8), greenStripeMat);
  stripeR.position.set(0.92, 0.52, 0);
  root.add(stripeR);

  // Hood (Bonnet) Slope
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 1.3), whiteBodyMat);
  hood.position.set(0, 0.78, -1.25);
  root.add(hood);

  // Trunk Deck
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 0.95), whiteBodyMat);
  trunk.position.set(0, 0.78, 1.4);
  root.add(trunk);

  // Cabin Greenhouse / Pillars
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.58, 1.85), darkGlassMat);
  cabin.position.set(0, 1.08, -0.05);
  root.add(cabin);

  // Aerodynamic White Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.08, 1.75), whiteBodyMat);
  roof.position.set(0, 1.38, -0.05);
  root.add(roof);

  // Sloped Windshields (Front & Rear)
  const frontWindshield = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.62), darkGlassMat);
  frontWindshield.rotation.x = -0.42;
  frontWindshield.position.set(0, 1.05, -0.98);
  root.add(frontWindshield);

  const rearWindshield = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.58), darkGlassMat);
  rearWindshield.rotation.x = 0.38;
  rearWindshield.position.set(0, 1.05, 0.88);
  root.add(rearWindshield);

  // Low-profile LED Emergency Lightbar Base
  const lightbarBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.26), blackTrimMat);
  lightbarBase.position.set(0, 1.43, -0.05);
  root.add(lightbarBase);

  // Dual High-Intensity Strobes (Red on Left/Driver, Blue on Right/Passenger)
  const redLightMat = createGameMaterial({
    color: 0xff0022,
    emissive: 0xff0022,
    emissiveIntensity: 2.2,
    roughness: 0.15
  });
  const blueLightMat = createGameMaterial({
    color: 0x0044ff,
    emissive: 0x0044ff,
    emissiveIntensity: 2.2,
    roughness: 0.15
  });

  const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.22), redLightMat);
  redLight.position.set(-0.32, 1.5, -0.05);
  redLight.userData.isPoliceLight = true;
  redLight.userData.lightColor = 'red';
  root.add(redLight);

  const blueLight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.22), blueLightMat);
  blueLight.position.set(0.32, 1.5, -0.05);
  blueLight.userData.isPoliceLight = true;
  blueLight.userData.lightColor = 'blue';
  root.add(blueLight);

  // Chrome Central Siren Horn
  const sirenSpeaker = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8), chromeMat);
  sirenSpeaker.rotation.x = Math.PI / 2;
  sirenSpeaker.position.set(0, 1.5, -0.05);
  root.add(sirenSpeaker);

  // Headlights & Push Bumper (Bullbar / Nudge Bar)
  const headLightMat = createGameMaterial({ color: 0xfffbeb, emissive: 0xffedd5, emissiveIntensity: 1.6 });
  [-0.68, 0.68].forEach((hx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headLightMat);
    hl.position.set(hx, 0.62, -1.95);
    root.add(hl);
  });

  // Heavy Highway Patrol Push Bumper
  const pushBumper = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.14), blackTrimMat);
  pushBumper.position.set(0, 0.48, -2.02);
  root.add(pushBumper);

  [-0.45, 0.45].forEach((nx) => {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.16), blackTrimMat);
    upright.position.set(nx, 0.54, -2.03);
    root.add(upright);
  });

  // Rear Taillights & Trunk Antenna
  const tailLightMat = createGameMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.9 });
  [-0.68, 0.68].forEach((tx) => {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), tailLightMat);
    tl.position.set(tx, 0.62, 1.95);
    root.add(tl);
  });

  // Long Trunk Radio Whip Antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.95, 6), chromeMat);
  antenna.position.set(-0.7, 1.3, 1.65);
  antenna.rotation.z = -0.08;
  root.add(antenna);

  // Side View Mirrors
  [-0.96, 0.96].forEach((mx) => {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), blackTrimMat);
    mirror.position.set(mx, 0.92, -0.75);
    root.add(mirror);
  });

  // 4 Cruiser Wheels with Chrome Hubcaps
  const wheelPositions = [
    [-0.92, 0.34, -1.18],
    [0.92, 0.34, -1.18],
    [-0.92, 0.34, 1.18],
    [0.92, 0.34, 1.18]
  ];
  for (const pos of wheelPositions) {
    const wheel = createRickshawWheel(0.34, 0.22, wheelRubberMat, rimMat, chromeMat);
    wheel.position.set(pos[0], pos[1], pos[2]);
    root.add(wheel);
  }

  root.userData.isHighwayPatrol = true;
  root.userData.side = side;
  return normalizeModelBase(root, true, 1.95, 4.0);
}

// =========================================================================
// PUNJAB POLICE TRAFFIC WARDEN / OFFICER
// =========================================================================
export function createPoliceOfficer(): THREE.Group {
  const root = new THREE.Group();

  const khakiMat = createGameMaterial({ color: 0x854d0e, roughness: 0.8 });
  const darkKhakiMat = createGameMaterial({ color: 0x713f12, roughness: 0.85 });
  const blackMat = createGameMaterial({ color: 0x0f172a, roughness: 0.75 });
  const skinMat = createGameMaterial({ color: 0xd97706, roughness: 0.65 });
  const whiteMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.5 });
  const goldMat = createGameMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
  const neonYellowMat = createGameMaterial({
    color: 0xccff00,
    emissive: 0x88cc00,
    emissiveIntensity: 0.25,
    roughness: 0.4
  });

  // Polished Black Combat Boots
  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.3), blackMat);
  leftBoot.position.set(-0.16, 0.11, 0.05);
  root.add(leftBoot);

  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.3), blackMat);
  rightBoot.position.set(0.16, 0.11, 0.05);
  root.add(rightBoot);

  // Left Leg (animated walk cycle pivot)
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.75, 0.16), darkKhakiMat);
  leftLeg.position.set(-0.16, 0.52, 0);
  root.add(leftLeg);
  root.userData.leftLeg = leftLeg;

  // Right Leg (animated walk cycle pivot)
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.75, 0.16), darkKhakiMat);
  rightLeg.position.set(0.16, 0.52, 0);
  root.add(rightLeg);
  root.userData.rightLeg = rightLeg;

  // Torso / Khaki Uniform Shirt
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.28), khakiMat);
  torso.position.set(0, 1.15, 0);
  root.add(torso);

  // High-Visibility Neon-Yellow Reflective Cross Sash (Punjab Warden Standard)
  const sashDiagonal = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.3), neonYellowMat);
  sashDiagonal.rotation.z = -0.42;
  sashDiagonal.position.set(0, 1.16, 0.02);
  root.add(sashDiagonal);

  // Utility Duty Belt with Brass Buckle & Holster
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.3), blackMat);
  belt.position.set(0, 0.88, 0);
  root.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.32), goldMat);
  buckle.position.set(0, 0.88, 0);
  root.add(buckle);

  const holster = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), blackMat);
  holster.position.set(-0.24, 0.82, 0);
  root.add(holster);

  // Gold Chest Badge
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), goldMat);
  badge.position.set(0.12, 1.25, 0.15);
  root.add(badge);

  // Head with Moustache
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
  head.position.set(0, 1.62, 0);
  root.add(head);

  const moustache = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.03), blackMat);
  moustache.position.set(0, 1.58, 0.15);
  root.add(moustache);

  // Traffic Warden Peaked Cap with Gold Emblem & Black Visor
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.11, 14), whiteMat);
  cap.position.set(0, 1.74, 0);
  root.add(cap);

  const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.182, 0.03, 14), blackMat);
  capBand.position.set(0, 1.71, 0);
  root.add(capBand);

  const capEmblem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), goldMat);
  capEmblem.position.set(0, 1.74, 0.19);
  root.add(capEmblem);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.15), blackMat);
  visor.position.set(0, 1.7, 0.14);
  root.add(visor);

  // Left Arm (Neutral swing)
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.58, 0.13), khakiMat);
  leftArm.position.set(-0.32, 1.15, 0);
  root.add(leftArm);
  root.userData.leftArm = leftArm;

  // Right Arm (Animated pointing challan pose) holding Challan Book
  const rightArm = new THREE.Group();
  rightArm.position.set(0.32, 1.44, 0);

  const rightArmSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.58, 0.13), khakiMat);
  rightArmSleeve.position.set(0, -0.29, 0);
  rightArm.add(rightArmSleeve);

  const challanBook = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.22, 0.04),
    createGameMaterial({ color: 0xef4444, roughness: 0.5 })
  );
  challanBook.position.set(0, -0.58, 0.08);
  rightArm.add(challanBook);

  root.add(rightArm);
  root.userData.rightArm = rightArm;

  return normalizeModelBase(root, true, 0.8, 0.8);
}

// =========================================================================
// SUZUKI BOLAN "DABBA" VAN (Iconic Pakistani High-Roof Microvan)
// =========================================================================
export function createSuzukiBolan(): THREE.Group {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  root.userData.suspensionPivot = pivot;

  const whiteMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.35 });
  const darkGlassMat = createGameMaterial({
    kind: 'physical',
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.7
  });
  const chromeMat = createGameMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  const blackPlasticMat = createGameMaterial({ color: 0x1e293b, roughness: 0.85 });
  const redTailMat = createGameMaterial({ color: 0xdc2626, emissive: 0x991b1b, emissiveIntensity: 0.8, roughness: 0.3 });
  const amberTurnMat = createGameMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6, roughness: 0.3 });
  const tarpMat = createGameMaterial({ color: 0x0284c7, roughness: 0.85 });
  const ropeMat = createGameMaterial({ color: 0xd97706, roughness: 0.9 });
  const wheelRubberMat = createGameMaterial({ color: 0x18181b, roughness: 0.94 });
  const rimMat = createGameMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.25 });

  // Main Cab-over Microvan Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.58, 1.38, 3.25), whiteMat);
  body.position.set(0, 0.98, 0);
  pivot.add(body);

  // High-Roof Curved Crown Extension
  const highRoof = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.22, 3.15), whiteMat);
  highRoof.position.set(0, 1.76, 0);
  pivot.add(highRoof);

  // Flat Front Face / Cab-over Nose
  const frontFace = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.6, 0.1), whiteMat);
  frontFace.position.set(0, 0.65, -1.62);
  pivot.add(frontFace);

  // Black Ribbed Radiator Grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.05), blackPlasticMat);
  grille.position.set(0, 0.62, -1.67);
  pivot.add(grille);

  // Authentic Twin Round Headlights with chrome bezels
  const headlampMat = createGameMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.9 });
  [-0.58, 0.58].forEach((hx) => {
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 14), chromeMat);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(hx, 0.65, -1.66);
    pivot.add(bezel);

    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 12), headlampMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(hx, 0.65, -1.67);
    pivot.add(lamp);
  });

  // Flat Forward Windshield with rubber seal
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.58, 0.08), darkGlassMat);
  windshield.position.set(0, 1.28, -1.58);
  windshield.rotation.x = 0.12;
  pivot.add(windshield);

  // Side Passenger Windows & Sliding Door Rail
  const sideWindowL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 2.3), darkGlassMat);
  sideWindowL.position.set(-0.8, 1.28, 0.12);
  pivot.add(sideWindowL);

  const sideWindowR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 2.3), darkGlassMat);
  sideWindowR.position.set(0.8, 1.28, 0.12);
  pivot.add(sideWindowR);

  // Side Sliding Door Recessed Rail Indentation
  const doorRailL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 1.8), blackPlasticMat);
  doorRailL.position.set(-0.8, 0.88, 0.35);
  pivot.add(doorRailL);

  // Rear Trunk Hatch Window
  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.52, 0.06), darkGlassMat);
  rearWindow.position.set(0, 1.28, 1.63);
  pivot.add(rearWindow);

  // Black Utility Front & Rear Bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 0.18), blackPlasticMat);
  frontBumper.position.set(0, 0.38, -1.66);
  pivot.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.2, 0.16), blackPlasticMat);
  rearBumper.position.set(0, 0.38, 1.66);
  pivot.add(rearBumper);

  // Rooftop Luggage Carrier with Blue Tarp-Covered Bundles & Tied Ropes
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.14, 2.3), blackPlasticMat);
  rack.position.set(0, 1.94, 0.15);
  pivot.add(rack);

  // Tarp-wrapped heavy luggage load
  const luggageTarp = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.42, 1.85), tarpMat);
  luggageTarp.position.set(0, 2.18, 0.15);
  pivot.add(luggageTarp);

  // Tie-down ropes criss-crossing the tarp
  for (let rz = -0.6; rz <= 0.6; rz += 0.4) {
    const rope = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.44, 0.04), ropeMat);
    rope.position.set(0, 2.18, 0.15 + rz);
    pivot.add(rope);
  }

  // Rear Vertical Multi-Lens Taillight Clusters (Red Brake + Amber Blinker + White Reverse)
  [-0.68, 0.68].forEach((tx) => {
    const tailBrake = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.06), redTailMat);
    tailBrake.position.set(tx, 0.78, 1.64);
    pivot.add(tailBrake);

    const tailTurn = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.06), amberTurnMat);
    tailTurn.position.set(tx, 0.58, 1.64);
    pivot.add(tailTurn);
  });

  // Authentic Pakistani Yellow Provincial License Plate
  const plateMat = createGameMaterial({ color: 0xfacc15, roughness: 0.4 });
  const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.03), plateMat);
  rearPlate.position.set(0, 0.48, 1.66);
  pivot.add(rearPlate);

  // 4 Microvan Wheels with Realistic Hubs
  const wheels: THREE.Group[] = [];
  const wheelPositions = [
    [-0.78, 0.32, -1.02],
    [0.78, 0.32, -1.02],
    [-0.78, 0.32, 1.02],
    [0.78, 0.32, 1.02]
  ];
  for (const pos of wheelPositions) {
    const wheel = createRickshawWheel(0.32, 0.2, wheelRubberMat, rimMat, chromeMat);
    wheel.position.set(pos[0], pos[1], pos[2]);
    pivot.add(wheel);
    wheels.push(wheel);
  }
  root.userData.wheels = wheels;

  return normalizeModelBase(root, true, 1.8, 3.4);
}

// =========================================================================
// DECORATED BEDFORD SHAHZORE TRUCK
// =========================================================================
export function createDecoratedTruck(): THREE.Group {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  root.userData.suspensionPivot = pivot;

  const cabMat = createGameMaterial({ color: 0x0284c7, roughness: 0.4 });
  const tajMat = createGameMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.3 });
  const woodMat = createGameMaterial({ color: 0x78350f, roughness: 0.8 });
  const bumperMat = createGameMaterial({ color: 0xd97706, roughness: 0.3 });

  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 1.6), cabMat);
  cab.position.set(0, 1.3, -1.2);
  pivot.add(cab);

  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 4), tajMat);
  crown.rotation.y = Math.PI / 4;
  crown.position.set(0, 2.4, -1.2);
  pivot.add(crown);

  const cargoBed = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 3.2), woodMat);
  cargoBed.position.set(0, 1.4, 1.1);
  pivot.add(cargoBed);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.3), bumperMat);
  bumper.position.set(0, 0.5, -2.1);
  pivot.add(bumper);

  const wheels: THREE.Group[] = [];
  const wheelPositions = [
    [-1.05, 0.45, -1.2],
    [1.05, 0.45, -1.2],
    [-1.08, 0.45, 0.7],
    [1.08, 0.45, 0.7],
    [-1.08, 0.45, 1.8],
    [1.08, 0.45, 1.8]
  ];
  for (const pos of wheelPositions) {
    const wheel = createCarWheel(0.45, 0.3);
    wheel.position.set(pos[0], pos[1], pos[2]);
    pivot.add(wheel);
    wheels.push(wheel);
  }
  root.userData.wheels = wheels;

  return normalizeModelBase(root, true, 2.5, 4.4);
}

// =========================================================================
// PLAYER MOTORBIKE (Authentic Pakistani CD70 Rebel)
// =========================================================================
export function createPlayerMotorbike(): THREE.Group {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  root.userData.suspensionPivot = pivot;

  const redTankMat = createGameMaterial({ color: 0xdc2626, metalness: 0.5, roughness: 0.28 });
  const chromeMat = createGameMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  const blackSeatMat = createGameMaterial({ color: 0x111827, roughness: 0.85 });
  const engineMat = createGameMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.35 });
  const darkSteelMat = createGameMaterial({ color: 0x1e293b, roughness: 0.85 });

  // Tubular backbone motorcycle chassis
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 1.25, 8), darkSteelMat);
  frame.rotation.x = 0.35;
  frame.position.set(0, 0.65, 0.05);
  pivot.add(frame);

  // Sculpted Teardrop Fuel Tank with Gold/White Pakistani Wing Graphic Trim
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.68, 14), redTankMat);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 0.84, -0.16);
  pivot.add(tank);

  const tankTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.06, 0.45),
    createGameMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3 })
  );
  tankTrim.position.set(0, 0.84, -0.16);
  pivot.add(tankTrim);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), chromeMat);
  cap.position.set(0, 0.96, -0.26);
  pivot.add(cap);

  // Contoured stepped dual seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.78), blackSeatMat);
  seat.position.set(0, 0.82, 0.44);
  pivot.add(seat);

  // Rear chrome grab rail / carrier
  const grabRail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.35), chromeMat);
  grabRail.position.set(0, 0.88, 0.84);
  pivot.add(grabRail);

  // 4-Stroke 70cc Finned Engine Block with cooling fins & crankcase
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.42), engineMat);
  engine.position.set(0, 0.45, 0.04);
  pivot.add(engine);

  // Chrome Swept-back Exhaust Header & Long Tapered Silencer
  const exhaustHeader = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.55, 8), chromeMat);
  exhaustHeader.rotation.x = 0.5;
  exhaustHeader.position.set(0.18, 0.38, -0.06);
  pivot.add(exhaustHeader);

  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.85, 10), chromeMat);
  muffler.rotation.x = Math.PI / 2;
  muffler.position.set(0.22, 0.26, 0.52);
  pivot.add(muffler);

  const exhaustPoint = new THREE.Object3D();
  exhaustPoint.position.set(0.22, 0.26, 0.96);
  pivot.add(exhaustPoint);
  root.userData.exhaustEmitter = exhaustPoint;

  // Front & Rear Wire-Spoke Wheels with Chrome Fenders
  const frontWheel = createSpokeMotorbikeWheel(0.34, 0.11);
  frontWheel.position.set(0, 0.34, -0.82);
  pivot.add(frontWheel);

  const frontFender = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.14, 16, 1, false, 0, Math.PI),
    chromeMat
  );
  frontFender.rotation.z = Math.PI / 2;
  frontFender.rotation.y = Math.PI;
  frontFender.position.set(0, 0.38, -0.82);
  pivot.add(frontFender);

  [-0.11, 0.11].forEach((fx) => {
    const forkTube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 8), chromeMat);
    forkTube.position.set(fx, 0.65, -0.72);
    forkTube.rotation.x = -0.26;
    pivot.add(forkTube);
  });

  const rearWheel = createSpokeMotorbikeWheel(0.34, 0.12);
  rearWheel.position.set(0, 0.34, 0.78);
  pivot.add(rearWheel);

  const rearFender = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.15, 16, 1, false, 0, Math.PI),
    redTankMat
  );
  rearFender.rotation.z = Math.PI / 2;
  rearFender.position.set(0, 0.42, 0.78);
  pivot.add(rearFender);

  root.userData.wheels = [frontWheel, rearWheel];

  // Chrome Handlebars with rubber grips & dual round chrome mirrors
  const handlebars = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 8), chromeMat);
  handlebars.rotation.z = Math.PI / 2;
  handlebars.position.set(0, 1.08, -0.58);
  pivot.add(handlebars);

  [-0.34, 0.34].forEach((gx) => {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 6), blackSeatMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(gx, 1.08, -0.58);
    pivot.add(grip);

    const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), chromeMat);
    mirror.position.set(gx * 1.15, 1.25, -0.52);
    pivot.add(mirror);
  });

  // Single Round Headlight with chrome bezel
  const headlightMat = createGameMaterial({
    kind: 'standard',
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 0.95
  });
  const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 14), headlightMat);
  headlight.rotation.x = Math.PI / 2;
  headlight.position.set(0, 0.94, -0.84);
  pivot.add(headlight);
  root.userData.headlightMat = headlightMat;

  // Tail Light
  const tailLightMat = createGameMaterial({
    kind: 'standard',
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.9
  });
  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), tailLightMat);
  tailLight.position.set(0, 0.78, 0.96);
  pivot.add(tailLight);
  root.userData.brakeMat = tailLightMat;

  // Jetpack Visual
  const jetpackGroup = new THREE.Group();
  const rocketMat = createGameMaterial({ color: 0x0284c7, metalness: 0.85 });
  const fireMat = createGameMaterial({ kind: 'basic', color: 0xf97316 });
  [-0.26, 0.26].forEach((jx) => {
    const rocket = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.8, 12), rocketMat);
    rocket.position.set(jx, 1.15, 0.65);
    jetpackGroup.add(rocket);

    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 8), fireMat);
    fire.rotation.x = Math.PI;
    fire.position.set(jx, 0.7, 0.65);
    jetpackGroup.add(fire);
  });
  jetpackGroup.visible = false;
  jetpackGroup.userData.ignoreBaseNormalize = true;
  pivot.add(jetpackGroup);
  root.userData.jetpackVisual = jetpackGroup;

  return normalizeModelBase(root, true, 1.0, 2.0);
}

// =========================================================================
// CHINGCHI RICKSHAW (Pakistani Motorcycle-Pulled Passenger Carriage)
// =========================================================================
export function createChingchi(): THREE.Group {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  root.userData.suspensionPivot = pivot;

  const yellowMat = createGameMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.4 });
  const greenCanopyMat = createGameMaterial({ color: 0x15803d, roughness: 0.8 });
  const frameMat = createGameMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.3 });
  const chromeMat = createGameMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  const velvetSeatMat = createGameMaterial({ color: 0xb91c1c, roughness: 0.65 });
  const rubberMat = createGameMaterial({ color: 0x18181b, roughness: 0.94 });
  const rimMat = createGameMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.28 });
  const goldBrassMat = createGameMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.25 });

  // 1. Front Motorcycle Puller Section
  const bikeFront = createPlayerMotorbike();
  bikeFront.position.set(0, 0, -0.92);
  pivot.add(bikeFront);

  // 2. Heavy-Duty Articulated Tow Hitch & Gooseneck Coupler
  const hitchH = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.65, 8), frameMat);
  hitchH.rotation.x = Math.PI / 2;
  hitchH.position.set(0, 0.52, -0.28);
  pivot.add(hitchH);

  const hitchArch = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 12, Math.PI), chromeMat);
  hitchArch.rotation.y = Math.PI / 2;
  hitchArch.position.set(0, 0.65, -0.05);
  pivot.add(hitchArch);

  // 3. Passenger Carriage Body with Chamak-Patti Yellow Paint & Flower Trim
  const carriageW = 1.56;
  const carriageL = 1.88;
  const carriageH = 0.72;

  const carriage = new THREE.Mesh(new THREE.BoxGeometry(carriageW, carriageH, carriageL), yellowMat);
  carriage.position.set(0, 0.74, 0.88);
  pivot.add(carriage);

  const carriageTrim = new THREE.Mesh(
    new THREE.BoxGeometry(carriageW * 1.02, 0.14, carriageL * 1.01),
    createGameMaterial({ color: 0x059669, metalness: 0.3, roughness: 0.35 })
  );
  carriageTrim.position.set(0, 0.88, 0.88);
  pivot.add(carriageTrim);

  // Rear Steps & Chrome Grab Bars for Passengers
  const stepBoard = new THREE.Mesh(new THREE.BoxGeometry(carriageW * 0.78, 0.06, 0.26), frameMat);
  stepBoard.position.set(0, 0.32, 1.88);
  pivot.add(stepBoard);

  // 4. Passenger Seating (Dual Face-to-Face Padded Velvet Benches)
  [-0.48, 0.48].forEach((bz) => {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(carriageW * 0.85, 0.18, 0.42), velvetSeatMat);
    bench.position.set(0, 0.68, 0.88 + bz);
    pivot.add(bench);
  });

  // 5. Arched Canopy Awning with Overhang & Luggage Roof Carrier
  const roofShape = new THREE.Shape();
  const cHalfW = carriageW * 0.54;
  roofShape.moveTo(-cHalfW, 0);
  roofShape.quadraticCurveTo(0, 0.22, cHalfW, 0);
  roofShape.lineTo(cHalfW, -0.06);
  roofShape.quadraticCurveTo(0, 0.16, -cHalfW, -0.06);
  roofShape.closePath();

  const cExtrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: carriageL * 1.06,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2
  };
  const cRoofGeo = new THREE.ExtrudeGeometry(roofShape, cExtrudeSettings);
  cRoofGeo.translate(0, 0, -carriageL * 0.53);

  const canopyMesh = new THREE.Mesh(cRoofGeo, greenCanopyMat);
  canopyMesh.position.set(0, 1.76, 0.88);
  pivot.add(canopyMesh);

  // Chrome Carrier Basket atop Canopy
  const roofCarrier = new THREE.Mesh(new THREE.BoxGeometry(carriageW * 0.78, 0.08, carriageL * 0.72), chromeMat);
  roofCarrier.position.set(0, 1.98, 0.88);
  pivot.add(roofCarrier);

  // Tubular Chrome Support Pillars (6 sturdy welded frame posts)
  const pillarX = carriageW * 0.48;
  const pillarZ = [0.02, 0.88, 1.76];
  pillarZ.forEach((pz) => {
    [-pillarX, pillarX].forEach((px) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.02, 8), chromeMat);
      pillar.position.set(px, 1.25, pz);
      pivot.add(pillar);
    });
  });

  // Hanging Paranda Tassels under rear canopy edge
  const tasselGroup = new THREE.Group();
  tasselGroup.position.set(0, 1.72, 1.84);
  pivot.add(tasselGroup);

  const tasselMatRed = createGameMaterial({ color: 0xef4444, roughness: 0.5 });
  const tasselMatGold = createGameMaterial({ color: 0xfacc15, roughness: 0.5 });
  for (let i = 0; i < 7; i++) {
    const tx = -carriageW * 0.42 + (i / 6) * carriageW * 0.84;
    const tMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.12, 6),
      i % 2 === 0 ? tasselMatRed : tasselMatGold
    );
    tMesh.rotation.x = Math.PI;
    tMesh.position.set(tx, -0.06, 0);
    tasselGroup.add(tMesh);
  }

  // 6. Rear Heavy Carriage Wheels with Wide Track & Mudguards
  const wheelL = createRickshawWheel(0.35, 0.2, rubberMat, rimMat, goldBrassMat);
  wheelL.position.set(-carriageW * 0.55, 0.35, 0.94);
  pivot.add(wheelL);

  const wheelR = createRickshawWheel(0.35, 0.2, rubberMat, rimMat, goldBrassMat);
  wheelR.position.set(carriageW * 0.55, 0.35, 0.94);
  pivot.add(wheelR);

  // Curved carriage mudguards
  [-1, 1].forEach((side) => {
    const fender = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.24, 16, 1, false, 0, Math.PI),
      yellowMat
    );
    fender.rotation.z = Math.PI / 2;
    fender.position.set(side * carriageW * 0.55, 0.46, 0.94);
    pivot.add(fender);
  });

  // Tail Lights & Chamak-Patti Rear Banner
  const tailLightMat = createGameMaterial({
    kind: 'standard',
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.9
  });
  [-carriageW * 0.42, carriageW * 0.42].forEach((tx) => {
    const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), tailLightMat);
    tailLamp.position.set(tx, 0.78, 1.83);
    pivot.add(tailLamp);
  });

  const rearBanner = new THREE.Mesh(
    new THREE.PlaneGeometry(carriageW * 0.75, 0.32),
    createGameMaterial({ map: TextureCache.getBumperArt(), roughness: 0.5 })
  );
  rearBanner.position.set(0, 0.82, 1.83);
  pivot.add(rearBanner);

  root.userData.wheels = [wheelL, wheelR];
  root.userData.brakeMat = tailLightMat;

  return normalizeModelBase(root, true, 1.85, 3.2);
}

// =========================================================================
// MILLAT DESI TRACTOR (Mystery Transformation)
// =========================================================================
export function createTractor(): THREE.Group {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  root.userData.suspensionPivot = pivot;

  const redMat = createGameMaterial({ color: 0xb91c1c, roughness: 0.4 });
  const chromeMat = createGameMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 2.2), redMat);
  hood.position.set(0, 0.95, -0.6);
  pivot.add(hood);

  const fenderL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 1.4), redMat);
  fenderL.position.set(-0.85, 1.1, 0.9);
  pivot.add(fenderL);

  const fenderR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 1.4), redMat);
  fenderR.position.set(0.85, 1.1, 0.9);
  pivot.add(fenderR);

  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8), chromeMat);
  chimney.position.set(0.38, 1.7, -1.1);
  pivot.add(chimney);

  const rearWheelL = createCarWheel(0.72, 0.45);
  rearWheelL.position.set(-0.9, 0.72, 0.9);
  pivot.add(rearWheelL);

  const rearWheelR = createCarWheel(0.72, 0.45);
  rearWheelR.position.set(0.9, 0.72, 0.9);
  pivot.add(rearWheelR);

  const frontWheelL = createCarWheel(0.4, 0.25);
  frontWheelL.position.set(-0.68, 0.4, -1.35);
  pivot.add(frontWheelL);

  const frontWheelR = createCarWheel(0.4, 0.25);
  frontWheelR.position.set(0.68, 0.4, -1.35);
  pivot.add(frontWheelR);

  root.userData.wheels = [rearWheelL, rearWheelR, frontWheelL, frontWheelR];
  return normalizeModelBase(root, true, 2.2, 3.4);
}

// =========================================================================
// SHAHI TONGA HORSE-CART (Authentic Lahore Imperial Carriage)
// =========================================================================
export function createTonga(): THREE.Group {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  root.userData.suspensionPivot = pivot;

  const royalRedMat = createGameMaterial({ color: 0x991b1b, roughness: 0.45 });
  const goldVelvetMat = createGameMaterial({ color: 0xd97706, roughness: 0.35 });
  const woodMat = createGameMaterial({ color: 0x78350f, roughness: 0.85 });
  const darkWoodMat = createGameMaterial({ color: 0x451a03, roughness: 0.9 });
  const horseMat = createGameMaterial({ color: 0x5a2d0c, roughness: 0.75 });
  const maneMat = createGameMaterial({ color: 0x1c1917, roughness: 0.9 });
  const brassMat = createGameMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
  const ironMat = createGameMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.7 });
  const leatherMat = createGameMaterial({ color: 0x292524, roughness: 0.8 });

  // -----------------------------------------------------------------
  // HORSE ANATOMY (Muscular draft horse with harness & blinkers)
  // -----------------------------------------------------------------
  const horseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.45, 12), horseMat);
  horseBody.rotation.x = Math.PI / 2;
  horseBody.position.set(0, 0.98, -1.6);
  pivot.add(horseBody);

  // Muscular arched neck
  const horseNeck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.65, 0.45), horseMat);
  horseNeck.position.set(0, 1.4, -2.15);
  horseNeck.rotation.x = 0.42;
  pivot.add(horseNeck);

  // Chiseled Horse Head with Muzzle
  const horseHead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.52), horseMat);
  horseHead.position.set(0, 1.62, -2.42);
  horseHead.rotation.x = -0.15;
  pivot.add(horseHead);

  // Black Mane strip along neck
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.12), maneMat);
  mane.position.set(0, 1.52, -2.12);
  mane.rotation.x = 0.42;
  pivot.add(mane);

  // Horse Ears
  [-0.1, 0.1].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), horseMat);
    ear.position.set(ex, 1.84, -2.32);
    pivot.add(ear);
  });

  // Leather Bridle & Blinder Cups
  [-0.14, 0.14].forEach((bx) => {
    const blinker = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.08), leatherMat);
    blinker.position.set(bx, 1.64, -2.46);
    pivot.add(blinker);
  });

  // 4 Slender Hoofed Horse Legs reaching exact y = 0
  [[-0.18, -2.15], [0.18, -2.15], [-0.18, -1.12], [0.18, -1.12]].forEach(([lx, lz]) => {
    const hLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.72, 8), horseMat);
    hLeg.position.set(lx, 0.36, lz);
    pivot.add(hLeg);

    // Black Hoof
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.08, 8), darkWoodMat);
    hoof.position.set(lx, 0.04, lz);
    pivot.add(hoof);
  });

  // Dual Wooden Shafts (Bam) connecting horse to carriage
  [-0.45, 0.45].forEach((sx) => {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.8, 6), woodMat);
    shaft.rotation.x = 0.12;
    shaft.position.set(sx, 0.85, -0.65);
    pivot.add(shaft);
  });

  // -----------------------------------------------------------------
  // CARRIAGE (Tonga Passenger Tub & Driver Box)
  // -----------------------------------------------------------------
  // Ornate Wooden Tub Body
  const carriageTub = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.52, 1.45), woodMat);
  carriageTub.position.set(0, 0.82, 0.4);
  pivot.add(carriageTub);

  // Curved Velvet-padded passenger bench & high backrest
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.16, 0.48), goldVelvetMat);
  bench.position.set(0, 0.98, 0.65);
  pivot.add(bench);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.42, 0.12), royalRedMat);
  backrest.position.set(0, 1.25, 0.98);
  pivot.add(backrest);

  // Driver Kochwan front perch seat
  const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.38), darkWoodMat);
  driverSeat.position.set(0, 1.05, -0.08);
  pivot.add(driverSeat);

  // Four Slender Brass Canopy Support Pillars
  [[-0.68, -0.15], [0.68, -0.15], [-0.68, 0.95], [0.68, 0.95]].forEach(([cx, cz]) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 8), brassMat);
    pillar.position.set(cx, 1.55, cz);
    pivot.add(pillar);
  });

  // Royal Red Fabric Canopy Roof with scalloped gold fringe
  const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.12, 1.35), royalRedMat);
  canopyRoof.position.set(0, 2.08, 0.4);
  pivot.add(canopyRoof);

  const canopyFringe = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.1, 1.37), goldVelvetMat);
  canopyFringe.position.set(0, 2.02, 0.4);
  pivot.add(canopyFringe);

  // Brass Carriage Lantern Lamps on each side
  [-0.82, 0.82].forEach((lx) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), brassMat);
    lamp.position.set(lx, 1.25, 0.25);
    pivot.add(lamp);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      createGameMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.2 })
    );
    glow.position.set(lx, 1.25, 0.25);
    pivot.add(glow);
  });

  // -----------------------------------------------------------------
  // TWO OVERSIZED ARTILLERY-STYLE WOODEN WHEELS (Huge 1.4m diameter)
  // -----------------------------------------------------------------
  const wheels: THREE.Group[] = [];
  [-0.92, 0.92].forEach((wx) => {
    const wGroup = new THREE.Group();
    wGroup.position.set(wx, 0.72, 0.42);

    const ironTire = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 28), ironMat);
    ironTire.rotation.z = Math.PI / 2;
    wGroup.add(ironTire);

    const woodRim = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.07, 24), darkWoodMat);
    woodRim.rotation.z = Math.PI / 2;
    wGroup.add(woodRim);

    const brassHub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 12), brassMat);
    brassHub.rotation.z = Math.PI / 2;
    wGroup.add(brassHub);

    // 14 Wooden Spokes
    const spokes = 7;
    for (let s = 0; s < spokes; s++) {
      const angle = (s / spokes) * Math.PI;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.32, 6), woodMat);
      spoke.rotation.x = angle;
      wGroup.add(spoke);
    }

    pivot.add(wGroup);
    wheels.push(wGroup);
  });

  root.userData.wheels = wheels;
  return normalizeModelBase(root, true, 1.9, 3.8);
}

// =========================================================================
// PHASE 2: SOLID MERGED FLYOVER STRUCTURE (Continuous Smoothstep Ramp + Deck + Pillars + Retaining Walls)
// =========================================================================
export function createFlyoverStructure(
  deckLength: number = 90.0,
  requestedRampLanes: number[] = [0, 1]
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'FlyoverStructure';

  const rampLanes = normalizeRampLanes(requestedRampLanes);
  const openGroundLanes = [0, 1, 2].filter((l) => !rampLanes.includes(l));

  const roadW = GAME_CONFIG.ROAD_WIDTH; // 14.0m
  const deckW = roadW - 0.4;            // 13.6m
  const deckMinX = -deckW * 0.5;        // -6.8m
  const deckMaxX = deckW * 0.5;         // +6.8m
  const rampLen = RAMP_LENGTH;          // 34.0m
  const totalLen = rampLen * 2 + deckLength;

  // Determine entrance & exit ramp X bounds from rampLanes (1 or 2 contiguous lanes)
  let minLane = 2;
  let maxLane = 0;
  for (const l of rampLanes) {
    if (l < minLane) minLane = l;
    if (l > maxLane) maxLane = l;
  }
  const rampMinX = GAME_CONFIG.LANES[minLane] - 2.0;
  const rampMaxX = GAME_CONFIG.LANES[maxLane] + 2.0;
  const rampW = rampMaxX - rampMinX;
  const rampCenterX = (rampMinX + rampMaxX) * 0.5;

  // Shared curved materials via createGameMaterial()
  const asphaltTopMat = createGameMaterial({
    color: 0x334155,
    roughness: 0.72,
    metalness: 0.15
  });
  const concreteBodyMat = createGameMaterial({
    color: 0x64748b,
    roughness: 0.85
  });
  const undersideMat = createGameMaterial({
    color: 0x1e293b,
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
  const stepZ = rampLen / rampSteps; // 2.0m per smoothstep slice

  // 1. ASCENDING RAMP (local z from 0 down to -rampLen):
  // Solid retaining walls reaching ROAD_Y = 0 (no see-through gaps!), smoothstep asphalt top, and guard rails
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
    const segAngle = Math.atan2(y1 - y0, stepZ); // Positive X rotation (+atan2(rise, run)) tilts +Z end DOWN toward y0 and -Z end UP toward y1!
    const segHyp = Math.hypot(stepZ, y1 - y0) + 0.04;

    // Smoothstep Asphalt Top Surface (offset +0.004 to prevent z-fighting)
    const topGeo = new THREE.BoxGeometry(rampW, 0.06, segHyp);
    topGeo.rotateX(segAngle);
    topGeo.translate(rampCenterX, yMid + 0.004, zMid);
    asphaltParts.push(cleanGeo(topGeo));

    // Solid Retaining Wall Fill from ROAD_Y (0) up to yMid (no see-through gap under ramp)
    if (yMid > 0.08) {
      const wallH = yMid;
      const wallGeo = new THREE.BoxGeometry(rampW, wallH, stepZ + 0.02);
      wallGeo.translate(rampCenterX, wallH * 0.5, zMid);
      concreteParts.push(cleanGeo(wallGeo));
    }

    // Left & Right Guard Rails along ascending ramp
    const railH = RAIL_HEIGHT;
    const railL = new THREE.BoxGeometry(0.36, railH, segHyp);
    railL.rotateX(segAngle);
    railL.translate(rampMinX + 0.18, yMid + railH * 0.5, zMid);
    concreteParts.push(cleanGeo(railL));

    const railR = new THREE.BoxGeometry(0.36, railH, segHyp);
    railR.rotateX(segAngle);
    railR.translate(rampMaxX - 0.18, yMid + railH * 0.5, zMid);
    concreteParts.push(cleanGeo(railR));

    // Reflective stripe on ramp guard rails
    if (i % 2 === 0) {
      const refL = new THREE.BoxGeometry(0.4, 0.12, segHyp * 0.8);
      refL.rotateX(segAngle);
      refL.translate(rampMinX + 0.18, yMid + railH * 0.65, zMid);
      stripeParts.push(cleanGeo(refL));

      const refR = new THREE.BoxGeometry(0.4, 0.12, segHyp * 0.8);
      refR.rotateX(segAngle);
      refR.translate(rampMaxX - 0.18, yMid + railH * 0.65, zMid);
      stripeParts.push(cleanGeo(refR));
    }

    // Directional V-Chevron Arrows on the ascending ramp surface pointing toward -Z (direction of travel)
    if (i % 2 === 1) {
      for (const lIdx of rampLanes) {
        const lx = GAME_CONFIG.LANES[lIdx];
        const armLen = 1.05;
        const leftArm = new THREE.BoxGeometry(armLen, 0.04, 0.28);
        leftArm.rotateY(Math.PI * 0.2);
        leftArm.rotateX(segAngle);
        leftArm.translate(lx - 0.38, yMid + 0.04, zMid);
        chevronParts.push(cleanGeo(leftArm));

        const rightArm = new THREE.BoxGeometry(armLen, 0.04, 0.28);
        rightArm.rotateY(-Math.PI * 0.2);
        rightArm.rotateX(segAngle);
        rightArm.translate(lx + 0.38, yMid + 0.04, zMid);
        chevronParts.push(cleanGeo(rightArm));
      }
    }
  }

  // 2. FLAT ELEVATED DECK (local z from -rampLen down to -(rampLen + deckLength)):
  const deckZCenter = -rampLen - deckLength * 0.5;
  const exitTaperLen = Math.min(GAME_CONFIG.FLYOVER_EXIT_CLEAR_LEN, deckLength * 0.35);
  const straightDeckLen = deckLength - exitTaperLen;
  const straightDeckZCenter = -rampLen - straightDeckLen * 0.5;
  const taperStartZ = -rampLen - straightDeckLen;

  // Asphalt road surface on top of deck at exact DECK_Y = 5.8 (+0.002 offset)
  asphaltParts.push(
    cleanGeo(makePartGeo(new THREE.BoxGeometry(deckW, 0.06, deckLength + 0.2), 0, DECK_Y - 0.028, deckZCenter))
  );

  // Structural concrete deck slab (thickness DECK_THICKNESS = 0.6)
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

  // Darker concrete underside ceiling at exact DECK_Y - DECK_THICKNESS (5.2m clearance!)
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

  // Continuous Left & Right Concrete Guard Rails on main flat deck
  const railCenterY = DECK_Y + RAIL_HEIGHT * 0.5;
  concreteParts.push(
    cleanGeo(
      makePartGeo(
        new THREE.BoxGeometry(0.42, RAIL_HEIGHT, straightDeckLen),
        deckMinX + 0.21,
        railCenterY,
        straightDeckZCenter
      )
    ),
    cleanGeo(
      makePartGeo(
        new THREE.BoxGeometry(0.42, RAIL_HEIGHT, straightDeckLen),
        deckMaxX - 0.21,
        railCenterY,
        straightDeckZCenter
      )
    )
  );

  // Smoothly tapered exit guard rails over the 20m clear zone guiding player into rampLanes
  const taperSteps = 10;
  const taperStepZ = exitTaperLen / taperSteps;
  for (let i = 0; i < taperSteps; i++) {
    const tMid = smoothstep01((i + 0.5) / taperSteps);
    const tzMid = taperStartZ - (i + 0.5) * taperStepZ;
    const curMinX = deckMinX + (rampMinX - deckMinX) * tMid;
    const curMaxX = deckMaxX + (rampMaxX - deckMaxX) * tMid;

    concreteParts.push(
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.42, RAIL_HEIGHT, taperStepZ + 0.08), curMinX + 0.21, railCenterY, tzMid)),
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.42, RAIL_HEIGHT, taperStepZ + 0.08), curMaxX - 0.21, railCenterY, tzMid))
    );
    if (i % 2 === 0) {
      stripeParts.push(
        cleanGeo(
          makePartGeo(
            new THREE.BoxGeometry(0.46, 0.14, taperStepZ * 0.75),
            curMinX + 0.21,
            DECK_Y + RAIL_HEIGHT * 0.65,
            tzMid
          )
        ),
        cleanGeo(
          makePartGeo(
            new THREE.BoxGeometry(0.46, 0.14, taperStepZ * 0.75),
            curMaxX - 0.21,
            DECK_Y + RAIL_HEIGHT * 0.65,
            tzMid
          )
        )
      );
    }
  }

  // Reflective safety stripes on straight deck guard rails + dashed lane markings on deck asphalt
  for (let dz = -rampLen - 4; dz > taperStartZ + 2; dz -= 8) {
    stripeParts.push(
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.46, 0.14, 3.6), deckMinX + 0.21, DECK_Y + RAIL_HEIGHT * 0.65, dz)),
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.46, 0.14, 3.6), deckMaxX - 0.21, DECK_Y + RAIL_HEIGHT * 0.65, dz)),
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.22, 0.02, 3.8), -2.0, DECK_Y + 0.008, dz)),
      cleanGeo(makePartGeo(new THREE.BoxGeometry(0.22, 0.02, 3.8), 2.0, DECK_Y + 0.008, dz))
    );
  }

  // 3. SUPPORT PILLARS & PIER CAPS EVERY ~18 UNITS:
  // Placed ONLY at outer road edges (x = -6.6, +6.6) and inter-lane dividers (x = -2.0, +2.0) — NEVER inside a drivable lane (-4, 0, +4)!
  const pillarPositions: { x: number; z: number; baseY: number }[] = [];
  const pillarH = DECK_Y - DECK_THICKNESS; // 5.2m clear height under deck!
  const pierCapH = 0.36;
  const columnH = pillarH - pierCapH;     // 4.84m clear under pier cap!

  for (let pz = -rampLen - 6; pz >= -rampLen - deckLength + 6; pz -= GAME_CONFIG.FLYOVER_PILLAR_SPACING) {
    // Cross-beam (pier cap) spanning under the deck
    undersideParts.push(
      cleanGeo(makePartGeo(new THREE.BoxGeometry(deckW + 0.6, pierCapH, 1.3), 0, pillarH - pierCapH * 0.5, pz))
    );

    // Pillars at outer road edges (-6.6, +6.6) and lane divider lines (-2.0, +2.0)
    const pillarXs = [-6.6, -2.0, 2.0, 6.6];
    for (const px of pillarXs) {
      const colRadius = Math.abs(px) > 5 ? 0.42 : 0.26; // Slimmer divider columns so lanes (-4, 0, +4) have wide clearance
      concreteParts.push(
        cleanGeo(makePartGeo(new THREE.CylinderGeometry(colRadius, colRadius * 1.08, columnH, 10), px, columnH * 0.5, pz)),
        cleanGeo(makePartGeo(new THREE.BoxGeometry(colRadius * 2.5, 0.24, colRadius * 2.5), px, 0.12, pz))
      );
      pillarPositions.push({ x: px, z: pz, baseY: ROAD_Y });
    }
  }

  // 3B. GROUND-LEVEL MEDIAN BARRIER (separating openGroundLanes from the closed rampLanes column on level 0)
  const medianXs: number[] = [];
  if (rampMinX > -5.5) medianXs.push(rampMinX);
  if (rampMaxX < 5.5) medianXs.push(rampMaxX);
  for (const mx of medianXs) {
    concreteParts.push(
      cleanGeo(
        makePartGeo(
          new THREE.BoxGeometry(0.32, RAIL_HEIGHT * 0.9, deckLength),
          mx,
          ROAD_Y + RAIL_HEIGHT * 0.45,
          deckZCenter
        )
      )
    );
  }

  // 4. DESCENDING RAMP (local z from -(rampLen + deckLength) down to -totalLen):
  // Uses the exact same `rampLanes` width `[rampMinX, rampMaxX]` as the ascending ramp so `openGroundLanes` stay 100% open!
  const downStartZ = -rampLen - deckLength;
  for (let i = 0; i < rampSteps; i++) {
    const z0 = downStartZ - i * stepZ;
    const z1 = downStartZ - (i + 1) * stepZ;
    const zMid = (z0 + z1) * 0.5;
    // Progress from 1 (top of down-ramp) down to 0 (bottom of down-ramp at ROAD_Y)
    const t0 = 1 - i / rampSteps;
    const t1 = 1 - (i + 1) / rampSteps;
    const tMid = 1 - (i + 0.5) / rampSteps;

    const y0 = ROAD_Y + smoothstep01(t0) * (DECK_Y - ROAD_Y);
    const y1 = ROAD_Y + smoothstep01(t1) * (DECK_Y - ROAD_Y);
    const yMid = ROAD_Y + smoothstep01(tMid) * (DECK_Y - ROAD_Y);
    const segAngle = Math.atan2(y1 - y0, stepZ); // Negative X rotation tilts nose DOWN toward -Z
    const segHyp = Math.hypot(stepZ, y0 - y1) + 0.04;

    const topGeo = new THREE.BoxGeometry(rampW, 0.06, segHyp);
    topGeo.rotateX(segAngle);
    topGeo.translate(rampCenterX, yMid + 0.004, zMid);
    asphaltParts.push(cleanGeo(topGeo));

    // Solid retaining wall under descending ramp reaching ROAD_Y = 0 (only under rampLanes!)
    if (yMid > 0.08) {
      const wallH = yMid;
      const wallGeo = new THREE.BoxGeometry(rampW, wallH, stepZ + 0.02);
      wallGeo.translate(rampCenterX, wallH * 0.5, zMid);
      concreteParts.push(cleanGeo(wallGeo));
    }

    // Left & Right Guard Rails on descending ramp
    const railL = new THREE.BoxGeometry(0.36, RAIL_HEIGHT, segHyp);
    railL.rotateX(segAngle);
    railL.translate(rampMinX + 0.18, yMid + RAIL_HEIGHT * 0.5, zMid);
    concreteParts.push(cleanGeo(railL));

    const railR = new THREE.BoxGeometry(0.36, RAIL_HEIGHT, segHyp);
    railR.rotateX(segAngle);
    railR.translate(rampMaxX - 0.18, yMid + RAIL_HEIGHT * 0.5, zMid);
    concreteParts.push(cleanGeo(railR));

    if (i % 2 === 0) {
      const refL = new THREE.BoxGeometry(0.4, 0.12, segHyp * 0.8);
      refL.rotateX(segAngle);
      refL.translate(rampMinX + 0.18, yMid + RAIL_HEIGHT * 0.65, zMid);
      stripeParts.push(cleanGeo(refL));

      const refR = new THREE.BoxGeometry(0.4, 0.12, segHyp * 0.8);
      refR.rotateX(segAngle);
      refR.translate(rampMaxX - 0.18, yMid + RAIL_HEIGHT * 0.65, zMid);
      stripeParts.push(cleanGeo(refR));
    }

    // Directional V-Chevron Arrows on the descending ramp surface pointing toward -Z (direction of travel)
    if (i % 3 === 1) {
      for (const lIdx of rampLanes) {
        const lx = GAME_CONFIG.LANES[lIdx];
        const armLen = 1.05;
        const leftArm = new THREE.BoxGeometry(armLen, 0.04, 0.26);
        leftArm.rotateY(Math.PI * 0.2);
        leftArm.rotateX(segAngle);
        leftArm.translate(lx - 0.38, yMid + 0.04, zMid);
        chevronParts.push(cleanGeo(leftArm));

        const rightArm = new THREE.BoxGeometry(armLen, 0.04, 0.26);
        rightArm.rotateY(-Math.PI * 0.2);
        rightArm.rotateX(segAngle);
        rightArm.translate(lx + 0.38, yMid + 0.04, zMid);
        chevronParts.push(cleanGeo(rightArm));
      }
    }
  }

  // 5. "FLYOVER" ADVANCE GANTRY SIGN (placed +24m before ramp entrance so player has ~1s to choose lane, pillars reaching ROAD_Y = 0)
  const gantryZ = GAME_CONFIG.FLYOVER_GANTRY_LEAD_DIST;
  const gantryH = 6.5;
  gantryParts.push(
    cleanGeo(makePartGeo(new THREE.CylinderGeometry(0.22, 0.26, gantryH, 8), -6.8, gantryH * 0.5, gantryZ)),
    cleanGeo(makePartGeo(new THREE.CylinderGeometry(0.22, 0.26, gantryH, 8), 6.8, gantryH * 0.5, gantryZ)),
    cleanGeo(makePartGeo(new THREE.BoxGeometry(0.75, 0.3, 0.75), -6.8, 0.15, gantryZ)),
    cleanGeo(makePartGeo(new THREE.BoxGeometry(0.75, 0.3, 0.75), 6.8, 0.15, gantryZ)),
    cleanGeo(makePartGeo(new THREE.BoxGeometry(14.0, 0.35, 0.35), 0, gantryH, gantryZ)),
    cleanGeo(makePartGeo(new THREE.BoxGeometry(rampW + 0.6, 1.35, 0.24), rampCenterX, gantryH - 0.68, gantryZ))
  );
  // Glowing chevron arrows on gantry board showing exact entrance ramp lanes
  for (const lIdx of rampLanes) {
    const lx = GAME_CONFIG.LANES[lIdx];
    chevronParts.push(
      cleanGeo(makePartGeo(new THREE.BoxGeometry(1.25, 0.58, 0.3), lx, gantryH - 0.68, gantryZ))
    );
  }

  // Merge by material (~6 draw calls total for the entire flyover!)
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

  // 6. Soft dark blob shadow strip on the ground road beneath the deck
  const underShadowGeo = new THREE.PlaneGeometry(deckW + 0.8, totalLen);
  underShadowGeo.rotateX(-Math.PI / 2);
  underShadowGeo.translate(0, ROAD_Y + 0.012, -totalLen * 0.5);
  const underShadowMat = createGameMaterial({
    kind: 'basic',
    color: 0x020617,
    transparent: true,
    opacity: 0.48,
    depthWrite: false
  });
  const underShadowMesh = new THREE.Mesh(underShadowGeo, underShadowMat);
  underShadowMesh.name = 'FlyoverRoadShadowStrip';
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

// =========================================================================
// SHORTCUT SIGN & MYSTERY BOX (Shortcut sign has full support gantry pillars reaching y = 0)
// =========================================================================
export function createShortcutSign(): THREE.Group {
  const root = new THREE.Group();

  const neonMat = createGameMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 1.8,
    roughness: 0.2
  });
  const boardMat = createGameMaterial({ color: 0x0f172a, roughness: 0.6 });
  const pillarMat = createGameMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });

  // Support pillars reaching the ground (y = 0 to y = 5.4) so the sign never floats in mid-air!
  [-6.8, 6.8].forEach((px) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 5.4, 8), pillarMat);
    post.position.set(px, 2.7, 0);
    root.add(post);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.7), pillarMat);
    base.position.set(px, 0.175, 0);
    root.add(base);
  });

  // Overhead horizontal crossbar
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.3, 0.3), pillarMat);
  crossbar.position.set(0, 5.4, 0);
  root.add(crossbar);

  const board = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.4, 0.22), boardMat);
  board.position.set(0, 4.7, 0);
  root.add(board);

  const neonText = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.0, 0.1), neonMat);
  neonText.position.set(0, 4.7, 0.14);
  root.add(neonText);

  return normalizeModelBase(root, false);
}

export function createMysteryBox(): THREE.Group {
  const root = new THREE.Group();

  const goldMat = createGameMaterial({
    color: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0xd97706,
    emissiveIntensity: 0.6
  });
  const glowMat = createGameMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 2.0,
    roughness: 0.1
  });

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), goldMat);
  box.position.set(0, 0, 0);
  root.add(box);

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), glowMat);
  core.position.set(0, 0, 0);
  root.add(core);

  root.userData.isMysteryBox = true;
  root.userData.active = true;
  patchObjectHierarchy(root);
  return root;
}

/**
 * Creates an authentic Pakistani road construction barrier / hurdle with warning chevrons,
 * reflective tape, hazard flags, and safety cones.
 */
export function createRoadHurdle(): THREE.Group {
  const group = new THREE.Group();

  const orangeMat = createGameMaterial({ color: 0xf97316, roughness: 0.35 });
  const whiteMat = createGameMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const legMat = createGameMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.5 });
  const redFlagMat = createGameMaterial({ color: 0xef4444, roughness: 0.4 });

  // Main Heavy Horizontal Barrier Beam
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 0.14), orangeMat);
  bar.position.y = 0.52;
  group.add(bar);

  // Reflective White Diagonal Chevrons along barrier
  for (let x = -0.95; x <= 0.95; x += 0.38) {
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.15), whiteMat);
    chevron.position.set(x, 0.52, 0);
    chevron.rotation.z = 0.45;
    group.add(chevron);
  }

  // Steel A-frame legs on both sides
  [-1.05, 1.05].forEach((px) => {
    // Front slanted leg
    const legF = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.72, 6), legMat);
    legF.rotation.x = 0.28;
    legF.position.set(px, 0.32, 0.1);
    group.add(legF);

    // Rear slanted leg
    const legB = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.72, 6), legMat);
    legB.rotation.x = -0.28;
    legB.position.set(px, 0.32, -0.1);
    group.add(legB);

    // Ground Foot basepads sitting flush at y = 0
    const footF = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.18), legMat);
    footF.position.set(px, 0.03, 0.2);
    group.add(footF);

    const footB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.18), legMat);
    footB.position.set(px, 0.03, -0.2);
    group.add(footB);

    // Warning Red Triangular Hazard Flags fluttering on posts
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), legMat);
    flagPole.position.set(px, 0.82, 0);
    group.add(flagPole);

    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 3), redFlagMat);
    flag.rotation.z = Math.PI / 2;
    flag.position.set(px > 0 ? px + 0.1 : px - 0.1, 0.94, 0);
    group.add(flag);
  });

  // Dual Orange Traffic Cones with White Reflective Collars placed at base
  [-0.55, 0.55].forEach((cx) => {
    const coneBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.32), orangeMat);
    coneBase.position.set(cx, 0.025, 0.28);
    group.add(coneBase);

    const coneBody = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.44, 12), orangeMat);
    coneBody.position.set(cx, 0.24, 0.28);
    group.add(coneBody);

    const coneStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 12), whiteMat);
    coneStripe.position.set(cx, 0.24, 0.28);
    group.add(coneStripe);
  });

  return normalizeModelBase(group, true, 2.5, 0.7);
}
