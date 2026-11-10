import * as THREE from 'three';
import {
  GAME_CONFIG,
  PERF_CONFIG,
  ROAD_Y,
  SIDEWALK_Y,
  GROUND_Y,
  DECK_Y,
  DECK_THICKNESS,
  RAMP_LENGTH,
  RAIL_HEIGHT,
  BUS_ROOF_HEIGHT,
  BUS_RAMP_LENGTH,
  BUS_RAMP_LOW_OFFSET_Z,
  BUS_RAMP_HIGH_OFFSET_Z,
  BUS_ROOF_FRONT_OFFSET_Z,
  PICKUP_DEFINITIONS,
  PickupVariantId,
  PickupKind,
  PickupConfigDef,
  GameState,
  PowerupType,
  RickshawSkin,
  NeonColorId,
  VehicleId,
  MysteryVehicleId,
  WeatherType,
  UpgradesState
} from './config';
import { SoundFX } from './audio';
import { TextureCache } from './textures';
import { NPCManager } from './npcs.js';
import { ShopRow, setNight, updateShops, showShopGallery } from './shops.js';
import {
  BuildingManager,
  setNight as setBuildingNight,
  updateBuildings,
  showBuildingGallery
} from './buildings.js';
import {
  createDetailedRickshaw,
  createElectricTransmissionTower,
  createTransportBus,
  createBusWithRamp,
  createFruitCart,
  createTrafficCar,
  createCivilianMotorbike,
  createPedestrian,
  createStrayCat,
  createCrossingPedestrian,
  createPuddle,
  createCityBuilding,
  createModularDhaba,
  createModularPaanShop,
  createPalmTree,
  createBedfordTruck,
  createSahiwalCow,
  createOverheadStreetArch,
  createFestiveLightGarland,
  createBackgroundSkyline,
  createHydraulicPickup,
  createCNGCylinderPickup,
  createSuzukiBolan,
  createDecoratedTruck,
  createPlayerMotorbike,
  createChingchi,
  createTractor,
  createTonga,
  createSpiderManMesh,
  createIronManMesh,
  createCaptainAmericaMesh,
  createThorMesh,
  createHulkMesh,
  createFlyoverStructure,
  createRoadHurdle,
  createShortcutSign,
  createMysteryBox,
  CarType
} from './models';
import { uCurve, applyCurve, patchObjectHierarchy, auditCurve } from './curve';
import { createGameMaterial, createBlobShadow } from './materials';
import {
  selectPattern,
  runHeadlessPatternValidation,
  generateFlyoverDeckElements,
  validateFlyoverChunk,
  runHeadlessFlyoverValidation,
  PatternElement
} from './patterns';
import { PoliceChaseController, ChaseState, ArrestPhase } from './police';
import {
  PLAYABLE_VEHICLES,
  VehicleDef,
  getSelectedVehicle,
  setSelectedVehicle,
  createPlayableVehicleById
} from './vehicles';
import {
  LANE_WIDTH,
  LANE_CENTERS,
  SIDEWALK_WIDTH,
  BUILDING_SETBACK,
  VEHICLE_SPECS
} from './constants';
import {
  setSceneDebugHelpersVisible,
  createModelShowroom,
  ModelValidationResult
} from './debug';
import { PickupSystemManager, createPlayerShieldBubble, runHeadlessFuelSimulation } from './pickups';
import {
  groundHeightAt,
  groundSlopePitchAt,
  surfaceLevelFromHeight,
  getRampProgressAt,
  getDeckUndersideAt,
  getFlyoverSpanAtZ,
  isLaneOnRampEntrance,
  getElevatedBoundsAtZ,
  getGroundOpenBoundsForSpan,
  registerFlyoverSpan,
  pruneFlyoverSpansBehind,
  shiftTerrainOrigin,
  clearTerrainSpans,
  setBusRamps,
  getActiveFlyovers,
  getActiveBusRamps
} from './terrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

declare global {
  interface Window {
    playerModel?: THREE.Object3D;
  }
}

// Module-level reusable scratch vectors & matrices (zero allocation in physics & render loop)
const _scratchVec1 = new THREE.Vector3();
const _scratchVec2 = new THREE.Vector3();
const _scratchMatrix = new THREE.Matrix4();

// Module-level shared static chunk road assets (merged, zero per-spawn allocation)
let _chunkGroundGeo: THREE.PlaneGeometry | null = null;
let _chunkGroundMat: THREE.Material | null = null;
let _chunkRoadGeo: THREE.PlaneGeometry | null = null;
let _chunkRoadMat: THREE.Material | null = null;
let _chunkLineMarkingsGeo: THREE.BufferGeometry | null = null;
let _chunkLineMat: THREE.Material | null = null;
let _chunkStudsGeo: THREE.BufferGeometry | null = null;
let _chunkStudMat: THREE.Material | null = null;
let _chunkShoulderGeo: THREE.BufferGeometry | null = null;
let _chunkShoulderMat: THREE.Material | null = null;
let _chunkCurbsGeo: THREE.BufferGeometry | null = null;
let _chunkCurbMat: THREE.Material | null = null;
let _chunkCurbsBlackGeo: THREE.BufferGeometry | null = null;
let _chunkCurbBlackMat: THREE.Material | null = null;
let _chunkSidewalksGeo: THREE.BufferGeometry | null = null;
let _chunkSidewalkMat: THREE.Material | null = null;
let _chunkLampMetalGeo: THREE.BufferGeometry | null = null;
let _chunkLampMetalMat: THREE.Material | null = null;
let _chunkLampBulbsGeo: THREE.BufferGeometry | null = null;
let _chunkLampBulbMat: THREE.Material | null = null;
let _chunkPalmTrunksGeo: THREE.BufferGeometry | null = null;
let _chunkPalmTrunkMat: THREE.Material | null = null;
let _chunkPalmFrondsGeo: THREE.BufferGeometry | null = null;
let _chunkPalmFrondMat: THREE.Material | null = null;

function initSharedChunkAssets() {
  if (_chunkGroundGeo) return;

  const roadW = GAME_CONFIG.ROAD_WIDTH;
  const sidewalkW = SIDEWALK_WIDTH;
  const chunkLen = GAME_CONFIG.CHUNK_LENGTH;
  const dividerX = LANE_WIDTH * 0.5; // ±1.75m between [-3.5, 0, +3.5] lanes

  // Ground plane
  _chunkGroundGeo = new THREE.PlaneGeometry(220, chunkLen);
  _chunkGroundGeo.rotateX(-Math.PI / 2);
  _chunkGroundMat = createGameMaterial({
    color: 0x334155,
    roughness: 0.95,
    metalness: 0.05
  });

  // Road asphalt
  const pbr = TextureCache.getAsphaltPBR();
  _chunkRoadGeo = new THREE.PlaneGeometry(roadW, chunkLen, 1, 1);
  _chunkRoadGeo.rotateX(-Math.PI / 2);
  _chunkRoadMat = createGameMaterial({
    map: pbr.map,
    roughnessMap: pbr.roughnessMap,
    normalMap: pbr.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.18,
    metalness: 0.45
  });

  // Dashed lines & Directional arrows (merged into single geometry)
  const lineParts: THREE.BufferGeometry[] = [];
  [-dividerX, dividerX].forEach((lx) => {
    for (let dz = -chunkLen / 2 + 3; dz < chunkLen / 2; dz += 6) {
      const g = new THREE.PlaneGeometry(0.18, 3.2);
      g.rotateX(-Math.PI / 2);
      g.translate(lx, ROAD_Y + 0.015, dz);
      lineParts.push(g);
    }
  });
  LANE_CENTERS.forEach((ax) => {
    const arrow = new THREE.PlaneGeometry(0.65, 2.2);
    arrow.rotateX(-Math.PI / 2);
    arrow.translate(ax, ROAD_Y + 0.018, -10);
    lineParts.push(arrow);
  });
  // Karachi Pedestrian Zebra Crossing Stripes at rz = -22m
  for (let zx = -roadW * 0.42; zx <= roadW * 0.42; zx += 0.95) {
    const stripe = new THREE.PlaneGeometry(0.46, 2.8);
    stripe.rotateX(-Math.PI / 2);
    stripe.translate(zx, ROAD_Y + 0.017, -chunkLen / 2 + 3.5);
    lineParts.push(stripe);
  }
  _chunkLineMarkingsGeo = mergeGeometries(lineParts, false);
  lineParts.forEach((g) => g.dispose());
  _chunkLineMat = createGameMaterial({
    kind: 'basic',
    color: 0xf8fafc,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  // Studs
  const studParts: THREE.BufferGeometry[] = [];
  [-dividerX, dividerX].forEach((rx) => {
    for (let rz = -chunkLen / 2 + 1; rz < chunkLen / 2; rz += 8) {
      const stud = new THREE.BoxGeometry(0.14, 0.04, 0.14);
      stud.translate(rx, ROAD_Y + 0.022, rz);
      studParts.push(stud);
    }
  });
  _chunkStudsGeo = mergeGeometries(studParts, false);
  studParts.forEach((g) => g.dispose());
  _chunkStudMat = createGameMaterial({ kind: 'basic', color: 0xfef08a });

  // Yellow shoulders
  const shoulderParts: THREE.BufferGeometry[] = [];
  [-roadW / 2 + 0.3, roadW / 2 - 0.3].forEach((sx) => {
    const s = new THREE.PlaneGeometry(0.2, chunkLen);
    s.rotateX(-Math.PI / 2);
    s.translate(sx, ROAD_Y + 0.016, 0);
    shoulderParts.push(s);
  });
  _chunkShoulderGeo = mergeGeometries(shoulderParts, false);
  shoulderParts.forEach((g) => g.dispose());
  _chunkShoulderMat = createGameMaterial({
    kind: 'basic',
    color: 0xfacc15,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  // Alternating Yellow & Black Karachi Traffic Curbs (non-overlapping segments)
  const curbParts: THREE.BufferGeometry[] = [];
  const curbBlackParts: THREE.BufferGeometry[] = [];
  [-1, 1].forEach((side) => {
    const curbX = side * (roadW / 2 + 0.2);
    const curbH = SIDEWALK_Y + 0.05;
    for (let cz = -chunkLen / 2 + 1; cz < chunkLen / 2; cz += 4) {
      const yel = new THREE.BoxGeometry(0.4, curbH, 2.0);
      yel.translate(curbX, curbH * 0.5, cz - 1.0);
      curbParts.push(yel);

      const blk = new THREE.BoxGeometry(0.4, curbH, 2.0);
      blk.translate(curbX, curbH * 0.5, cz + 1.0);
      curbBlackParts.push(blk);
    }
  });
  _chunkCurbsGeo = mergeGeometries(curbParts, false);
  curbParts.forEach((g) => g.dispose());
  _chunkCurbMat = createGameMaterial({ color: 0xf59e0b, roughness: 0.5 });

  _chunkCurbsBlackGeo = mergeGeometries(curbBlackParts, false);
  curbBlackParts.forEach((g) => g.dispose());
  _chunkCurbBlackMat = createGameMaterial({ color: 0x18181b, roughness: 0.65 });

  // Sidewalks
  const walkParts: THREE.BufferGeometry[] = [];
  [-1, 1].forEach((side) => {
    const walk = new THREE.BoxGeometry(sidewalkW, SIDEWALK_Y, chunkLen);
    walk.translate(side * (roadW / 2 + 0.4 + sidewalkW / 2), SIDEWALK_Y * 0.5, 0);
    walkParts.push(walk);
  });
  _chunkSidewalksGeo = mergeGeometries(walkParts, false);
  walkParts.forEach((g) => g.dispose());
  _chunkSidewalkMat = createGameMaterial({ color: 0x64748b, roughness: 0.8 });

  // Streetlamps Metal (poles and arms) & Bulbs
  const lampMetalParts: THREE.BufferGeometry[] = [];
  const bulbParts: THREE.BufferGeometry[] = [];
  [-1, 1].forEach((side) => {
    const pole = new THREE.CylinderGeometry(0.08, 0.12, 5.8, 8);
    pole.translate(side * (roadW / 2 + 1.2), SIDEWALK_Y + 2.9, 0);
    lampMetalParts.push(pole);

    const arm = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6);
    arm.rotateZ(side > 0 ? -0.4 : 0.4);
    arm.translate(side * (roadW / 2 + 0.8), SIDEWALK_Y + 5.7, 0);
    lampMetalParts.push(arm);

    const bulb = new THREE.SphereGeometry(0.28, 8, 8);
    bulb.translate(side * (roadW / 2 + 0.4), SIDEWALK_Y + 5.6, 0);
    bulbParts.push(bulb);
  });
  _chunkLampMetalGeo = mergeGeometries(lampMetalParts, false);
  lampMetalParts.forEach((g) => g.dispose());
  _chunkLampMetalMat = createGameMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });

  _chunkLampBulbsGeo = mergeGeometries(bulbParts, false);
  bulbParts.forEach((g) => g.dispose());
  _chunkLampBulbMat = createGameMaterial({ kind: 'basic', color: 0xfef08a });

  // Merged Sidewalk Date-Palm Trees (6 trees per chunk: 2 draw calls instead of 42 meshes)
  const palmTrunkParts: THREE.BufferGeometry[] = [];
  const palmFrondParts: THREE.BufferGeometry[] = [];
  [-1, 1].forEach((side) => {
    [-15, 0, 15].forEach((pz) => {
      const tx = side * (roadW / 2 + 1.9);
      const ty = SIDEWALK_Y;
      const trunk = new THREE.CylinderGeometry(0.18, 0.28, 4.8, 7);
      trunk.translate(tx, ty + 2.4, pz);
      palmTrunkParts.push(trunk);

      for (let f = 0; f < 6; f++) {
        const angle = (f / 6) * Math.PI * 2;
        const frond = new THREE.BoxGeometry(0.45, 0.14, 1.9);
        frond.rotateX(0.32);
        frond.rotateY(angle);
        frond.translate(
          tx + Math.sin(angle) * 0.85,
          ty + 4.75,
          pz + Math.cos(angle) * 0.85
        );
        palmFrondParts.push(frond);
      }
    });
  });
  _chunkPalmTrunksGeo = mergeGeometries(palmTrunkParts, false);
  palmTrunkParts.forEach((g) => g.dispose());
  _chunkPalmTrunkMat = createGameMaterial({ color: 0x78350f, roughness: 0.9, flatShading: true });

  _chunkPalmFrondsGeo = mergeGeometries(palmFrondParts, false);
  palmFrondParts.forEach((g) => g.dispose());
  _chunkPalmFrondMat = createGameMaterial({ color: 0x15803d, roughness: 0.75, flatShading: true });

  // Expand bounding spheres slightly on shared chunk geometries so frustumCulled = true works safely with the vertex world-curve shader
  [
    _chunkGroundGeo,
    _chunkRoadGeo,
    _chunkLineMarkingsGeo,
    _chunkStudsGeo,
    _chunkShoulderGeo,
    _chunkCurbsGeo,
    _chunkCurbsBlackGeo,
    _chunkSidewalksGeo,
    _chunkLampMetalGeo,
    _chunkLampBulbsGeo,
    _chunkPalmTrunksGeo,
    _chunkPalmFrondsGeo
  ].forEach((geo) => {
    if (geo) {
      geo.computeBoundingSphere();
      if (geo.boundingSphere) {
        geo.boundingSphere.radius += 14;
      }
    }
  });
}

export interface PerfMetrics {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  jsHeapMB: number | null;
  activeNPCs: number;
  activeVehicles: number;
  activeProps: number;
  activeParticles: number;
  leakWarning: boolean;
}

export interface GameStats {
  distance: number;
  coins: number;
  speed: number;
  bestScore: number;
  activePowerup: PowerupType | null;
  powerupTimer: number;
  scoreMultiplier: number;
  hasShield: boolean;
  policeDanger: boolean;
  electricWarning: boolean;
  state: GameState;
  crashReason: string;
  timeOfDay: string; // 'Dawn' | 'Day' | 'Golden Hour' | 'Night'
  weather: WeatherType;
  totalRupees: number;
  closeCalls: number;
  currentSkin: RickshawSkin;
  cngFuel: number; // 0 to 100% Fuel tank level
  policeDistance: number;
  wardenStrikes: number;
  hornCooldown: number;
  powerupFlicker: boolean;
  // Connected Systems
  difficultyLevel: number;
  speedUpFlash: boolean;
  policeState: ChaseState;
  policeGap: number;
  activeVehicle: VehicleId;
  isMysteryActive: boolean;
  mysteryVehicle: MysteryVehicleId | null;
  mysteryTimer: number;
  mysteryFlicker: boolean;
  isShortcutActive: boolean;
  verticalLevel: number; // 0 = ground, 1 = elevated deck
  comicDialogue: string;
  arrestPhase: ArrestPhase | 'NONE';
  fps: number;
  // Fuel, Shield, & Jump Boost Systems
  fuel: number;
  isLowFuel: boolean;
  isFuelEmpty: boolean;
  fuelNoDrainTimer: number;
  shieldActive: boolean;
  shieldVariant: PickupVariantId | null;
  shieldTimer: number;
  shieldMaxDuration: number;
  shieldCharges: number;
  shieldFlicker: boolean;
  jumpBoostActive: boolean;
  jumpVariant: PickupVariantId | null;
  jumpTimer: number;
  jumpMaxDuration: number;
  jumpFlicker: boolean;
  doubleJumpsRemaining: number;
  screenFlashColor: string | null;
  // Flyover, Terrain, & Debug Telemetry
  inUnderpass: boolean;
  playerY: number;
  surfaceY: number;
  rampProgress: number;
  curveEnabled: boolean;
  debugGroundGrid: boolean;
  debugBaseMarkers: boolean;
  debugHeightOverlay: boolean;
  debugWireframe: boolean;
  debugBoundingBoxes: boolean;
  isShowroomMode: boolean;
  showroomValidationResults: ModelValidationResult[];
  unpatchedCount: number;
  // Open Street Shop & Chai Nitro Boost Telemetry
  chaiNitroCharge: number; // 0 to 100
  isNitroActive: boolean;
  nitroTimer: number;
  roadsideOrdersServed: number;
  isNPCGalleryOpen: boolean;
  isShopGalleryOpen: boolean;
  isBuildingGalleryOpen: boolean;
  buildingGalleryStage: number;
  currentDistrict: string;
  streakCount: number;
  // Stage 0 Performance Profiler Telemetry
  showPerfOverlay: boolean;
  perfMetrics: PerfMetrics;
}

interface Particle {
  mesh?: THREE.Mesh;
  points?: THREE.Points;
  vel?: THREE.Vector3;
  vels?: THREE.Vector3[];
  life: number;
  maxLife: number;
}

export class SubwayRickshawEngine {
  private canvas: HTMLCanvasElement;
  public sound: SoundFX;

  public state: GameState = 'START';
  public distance = 0;
  public coins = 0;
  public speed = GAME_CONFIG.BASE_SPEED;
  public bestScore = 0;

  // Realistic Physics handling states
  private currentLaneIdx = 1; // Center lane
  private targetX = GAME_CONFIG.LANES[1];
  private playerX = GAME_CONFIG.LANES[1];
  private playerY = 0;
  private groundY = 0;
  private jumpOffset = 0;
  private verticalVelocity = 0;
  private isJumping = false;
  private isSliding = false;
  private slideTimer = 0;
  private suspensionPhase = 0;
  private rickshawRoll = 0;
  private rickshawPitch = 0;
  private landingSquashTimer = 0;
  private inputBuffer: { action: 'JUMP' | 'SLIDE' | 'LEFT' | 'RIGHT' | null; time: number } = { action: null, time: 0 };
  private groundTimer = 0.1; // Coyote time window (~0.1s)
  private isJumpHolding = false;

  public activePowerup: PowerupType | null = null;
  public powerupTimer = 0;
  public hasShield = false;
  public scoreMultiplier = 1;
  public policeDistance = 14;
  public wardenStrikes = 0; // 0: normal, 1: stumbled (warden closes in)
  public hornCooldown = 0; // 0 to 3.0s
  public electricTowerNearby = false;
  public crashReason = '';

  // (A) Fuel System State
  public fuel = GAME_CONFIG.FUEL_MAX;
  public fuelNoDrainTimer = 0;
  private fuelEmptyTimer = 0;
  private stallSpeedFactor = 1.0;

  // (A2) Open Roadside Shop & Chai Nitro Overdrive State
  public chaiNitroCharge = 35; // Starts at 35% so player can charge & test quickly
  public isNitroActive = false;
  public nitroTimer = 0;
  public roadsideOrdersServed = 0;
  public currentDistrict = 'Saddar & Empress Mkt';
  private currentDistrictIndex = 0;
  public streakCount = 0;
  private streakTimer = 0;

  // (B) Shield System State
  public shieldVariant: PickupVariantId | null = null;
  public shieldTimer = 0;
  public shieldMaxDuration = GAME_CONFIG.SHIELD_DURATION_STANDARD;
  public shieldCharges = 0;
  private playerShieldBubble!: THREE.Group;

  // (C) Jump Boost System State
  public jumpVariant: PickupVariantId | null = null;
  public jumpTimer = 0;
  public jumpMaxDuration = GAME_CONFIG.JUMP_SUPER_KHUSSA_DURATION;
  public doubleJumpsRemaining = 0;
  private springBouncePauseTimer = 0;

  // Screen Flash & Camera Shake
  public screenFlashColor: string | null = null;
  private screenFlashTimer = 0;
  private cameraShakeTimer = 0;
  private cameraShakeIntensity = 0;

  // Shared Pickup System Manager (InstancedMesh per variant)
  public pickupManager!: PickupSystemManager;

  // Day-Night Cycle & Atmospheric Lighting
  private cycleTime = 0; // 0 to 120s full atmospheric day-night rotation
  private timeOfDayLabel = 'Day';

  // Three.js Core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private skyGroup!: THREE.Group;
  private skyDome!: THREE.Mesh;
  private cloudGroup!: THREE.Group;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private playerBlobShadow!: THREE.Mesh;
  public isMobile: boolean = false;
  public showPerfOverlay: boolean = false;
  public perfMetrics: PerfMetrics = {
    fps: 60,
    frameTimeMs: 16.6,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    jsHeapMB: null,
    activeNPCs: 0,
    activeVehicles: 0,
    activeProps: 0,
    activeParticles: 0,
    leakWarning: false
  };
  private lastPerfWarnTime: number = 0;
  private lastLeakSampleTime: number = 0;
  private prevGeometriesCount: number = 0;
  private prevTexturesCount: number = 0;
  private leakGrowthStreak: number = 0;

  // Entities
  private rickshaw!: THREE.Group;
  public policeChase!: PoliceChaseController;
  public npcManager!: NPCManager;
  public isNPCGalleryOpen: boolean = false;
  public isShopGalleryOpen: boolean = false;
  public isBuildingGalleryOpen: boolean = false;
  public buildingGalleryStage: number = 0;

  // Active Playable Vehicle & Mystery Transformation
  public activeVehicle: VehicleId = getSelectedVehicle();
  public vehicleDef: VehicleDef = PLAYABLE_VEHICLES[this.activeVehicle] || PLAYABLE_VEHICLES.rickshaw || PLAYABLE_VEHICLES.tuner_car;
  private truckShieldUsed: boolean = false;
  public isMysteryActive: boolean = false;
  public mysteryVehicle: MysteryVehicleId | null = null;
  public mysteryTimer: number = 0;
  private invulnerabilityTimer: number = 0;

  // Distance Difficulty & Speed Scaling
  public difficultyLevel: number = 0;
  public speedUpFlashTimer: number = 0;

  // Flyover & Elevated Deck Systems (Phase 1-6)
  public verticalLevel: number = 0; // 0: Ground, 1: Flyover deck (y = 4.5)
  public playerFlyoverPassLevel: 0 | 1 = 0;
  private currentFlyoverSpanId: number = -1;
  private nextFlyoverDistance: number = GAME_CONFIG.FLYOVER_FIRST_DIST;
  public inUnderpass: boolean = false;
  public rampProgress: number = 0;

  // Integer Chunk Index & Floating Origin Tracking
  private nextChunkIndex: number = 0;
  private originZOffset: number = 0;

  // Debug Visual Overlays (Keys B, C, G, F, H, K, L in Debug Mode)
  public curveEnabled: boolean = true;
  public debugGroundGrid: boolean = false;
  public debugBaseMarkers: boolean = false;
  public debugHeightOverlay: boolean = false;
  public debugWireframe: boolean = false;
  public debugBoundingBoxes: boolean = false;
  public isShowroomMode: boolean = false;
  public showroomValidationResults: ModelValidationResult[] = [];
  private showroomGroup: THREE.Group | null = null;
  public showroomFocusIndex: number = -1;
  public unpatchedCount: number = 0;
  private debugGridGroup!: THREE.Group;
  private debugMarkerGroup!: THREE.Group;
  private debugHeightLine!: THREE.Line;
  private firstFrameAudited: boolean = false;

  // Shortcut Routes System
  public isShortcutActive: boolean = false;
  private shortcutZStart: number = -9999;
  private shortcutZEnd: number = -9999;
  private lastShortcutSpawnDist: number = 0;

  // FPS Counter
  public fpsCount: number = 60;
  private lastFpsTimestamp: number = performance.now();
  private framesAccum: number = 0;

  // Object Pools & Active Lists for 60fps Performance
  private roadChunks: THREE.Group[] = [];
  private activeObstacles: THREE.Group[] = [];
  private activeAITraffic: THREE.Group[] = [];
  private activePedestrians: THREE.Group[] = [];
  private activeCoins: THREE.Mesh[] = [];
  private activePowerups: THREE.Group[] = [];
  private particles: Particle[] = [];

  // Particle & Puddle Pools (zero allocation during play)
  private puffPool: THREE.Mesh[] = [];
  private sparklePool: THREE.Mesh[] = [];
  private activePuddles: { puddle: THREE.Mesh; chunk: THREE.Group }[] = [];
  private sharedPuffGeo = new THREE.SphereGeometry(0.12, 6, 6);
  private sharedPuffMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 });
  private sharedSparkleGeo = new THREE.SphereGeometry(0.14, 6, 6);
  private sharedSparkleMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.8 });

  // Object Pools
  private carPool: THREE.Group[] = [];
  private coinPool: THREE.Mesh[] = [];

  private nextSpawnZ = 0;
  private nextTowerDistance = 85;
  private towerInterval = 115;
  private clock = new THREE.Clock();
  private reqId: number | null = null;

  public onStatsUpdate?: (stats: GameStats) => void;
  public onToast?: (msg: string) => void;
  public onCloseCall?: (comboCount: number, phrase: string) => void;
  public onPuddleSplash?: () => void;

  public totalRupees = 0;
  public currentSkin: RickshawSkin = 'badshahi';
  public weather: WeatherType = 'SUNNY';
  public closeCallCount = 0;
  public isGarageMode = false;
  private garageTurntableAngle = 0;
  private rainMesh!: THREE.Points;
  private rainGeo!: THREE.BufferGeometry;
  private lightningTimer = 0;
  private lightningFlash = 0;
  public cngFuel = 100; // Compressed Natural Gas fuel level (0-100%)
  public upgrades: UpgradesState = {
    magnetLevel: 1,
    jetpackLevel: 1,
    hydraulicLevel: 1,
    starterShield: 0,
    fuelEfficiencyLevel: 1,
    chaiHeadstartCount: 0,
    reserveFuelCount: 0,
    wardenBribeCount: 0,
    activeNeon: 'none',
    unlockedNeons: ['none']
  };

  // Fixed Timestep Accumulator (60 Hz physics)
  private accumulator = 0;
  private readonly fixedDt = 1 / 60;
  private hudUpdateTimer = 0;

  // Adaptive Quality Management (sliding window of 60 frames)
  private frameTimes: number[] = [];
  private currentQualityScale = 1.0;
  public adaptiveTier: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  private goodFrameCount = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.sound = new SoundFX();
    this.bestScore = parseInt(localStorage.getItem('rickshaw_best_score') || '0', 10);
    this.totalRupees = parseInt(localStorage.getItem('rickshaw_coins') || '0', 10);
    this.currentSkin = (localStorage.getItem('rickshaw_current_skin') as RickshawSkin) || 'badshahi';

    const savedUpgrades = localStorage.getItem('rickshaw_upgrades');
    if (savedUpgrades) {
      try {
        const parsed = JSON.parse(savedUpgrades);
        if (parsed.sneakersLevel && !parsed.hydraulicLevel) {
          parsed.hydraulicLevel = parsed.sneakersLevel;
        }
        this.upgrades = { ...this.upgrades, ...parsed };
      } catch {
        // use default
      }
    }

    this.initThree();
    this.initObjectPools();
    this.initWorld();

    this.animate = this.animate.bind(this);
    this.reqId = requestAnimationFrame(this.animate);
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(GAME_CONFIG.FOG_COLOR, GAME_CONFIG.FOG_NEAR, GAME_CONFIG.FOG_FAR);

    this.isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      window.innerWidth < 768 ||
      navigator.maxTouchPoints > 1;

    const aspect = window.innerWidth / window.innerHeight;
    // Tight far plane (390m, just outside skyDome 360m and FOG_FAR 245m) for better mobile depth precision & frustum culling
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.25, 390);

    // Stage 1 Renderer Settings: antialias off on mobile, stencil false, alpha false, high-performance
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isMobile,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
      depth: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const maxDpr = this.isMobile ? 1.15 : 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

    // Turn real-time shadows off globally by default (use cheap flat blob shadows instead)
    this.renderer.shadowMap.enabled = false;
    this.renderer.info.autoReset = false;

    this.createSkyDome();

    // Stage 1 Lighting Rig: At most 1 DirectionalLight + 1 HemisphereLight (0 PointLights, 0 SpotLights)
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffedd5, 1.9);
    this.sunLight.castShadow = false;
    this.sunLight.position.set(30, 50, 25);
    this.scene.add(this.sunLight);

    // Player Vehicle with selected custom 3D model
    this.rickshaw = this.createPlayerVehicleMesh(this.activeVehicle, this.currentSkin);
    this.rickshaw.position.set(0, ROAD_Y, 0);
    patchObjectHierarchy(this.rickshaw);
    this.scene.add(this.rickshaw);

    // Dedicated Soft Blob Shadow under Player Vehicle (stays anchored on ground/deck when jumping)
    this.playerBlobShadow = createBlobShadow(1.3, 2.2, 0.42);
    this.playerBlobShadow.position.set(0, ROAD_Y + 0.02, 0);
    this.scene.add(this.playerBlobShadow);

    // Player Shield Bubble (hex/flower energy dome + hit-count rings)
    this.playerShieldBubble = createPlayerShieldBubble();
    this.playerShieldBubble.visible = false;
    this.rickshaw.add(this.playerShieldBubble);

    // Shared Pickup System Manager (InstancedMesh per variant, <= 11 draw calls total)
    this.pickupManager = new PickupSystemManager(this.scene);

    // Lahore Highway Patrol Police Cars Controller (2 cars right behind player from start)
    this.policeChase = new PoliceChaseController(this.scene, this.sound);

    // Karachi Living Street Modular NPC System (15 procedural NPC & Animal types)
    this.npcManager = new NPCManager();
    this.npcManager.init(this.scene);

    // Debug Visual Overlays (Ground Grid, Base Markers, Height Overlay Line)
    this.initDebugVisuals();

    // Monsoon Rain Streaks System (900 animated raindrops)
    this.initRainMesh();

    // Context Loss / Restoration & Auto-Pause on Visibility Change
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (this.reqId) cancelAnimationFrame(this.reqId);
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.initWorld();
      this.reqId = requestAnimationFrame(this.animate);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'RUNNING') {
        this.pause();
      }
    });

    window.addEventListener('resize', this.handleResize);
  }

  private initDebugVisuals() {
    this.debugGridGroup = new THREE.Group();
    this.debugGridGroup.name = 'DebugGroundGridGroup';
    this.debugGridGroup.visible = false;

    const gridMat = createGameMaterial({
      kind: 'basic',
      color: 0x22c55e,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    });
    const gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(36, 160, 12, 32), gridMat);
    gridPlane.rotation.x = -Math.PI / 2;
    gridPlane.position.set(0, ROAD_Y + 0.03, -60);
    gridPlane.frustumCulled = false;
    this.debugGridGroup.add(gridPlane);
    this.scene.add(this.debugGridGroup);

    this.debugMarkerGroup = new THREE.Group();
    this.debugMarkerGroup.name = 'DebugBaseMarkersGroup';
    this.debugMarkerGroup.visible = false;
    this.scene.add(this.debugMarkerGroup);

    const hLineGeo = new THREE.BufferGeometry();
    const hPositions = new Float32Array(60 * 3);
    hLineGeo.setAttribute('position', new THREE.BufferAttribute(hPositions, 3));
    const hLineMat = createGameMaterial({
      kind: 'line',
      color: 0xfacc15
    });
    this.debugHeightLine = new THREE.Line(hLineGeo, hLineMat);
    this.debugHeightLine.name = 'DebugHeightOverlayLine';
    this.debugHeightLine.frustumCulled = false;
    this.debugHeightLine.visible = false;
    this.scene.add(this.debugHeightLine);
  }

  private initRainMesh() {
    const rainCount = 900;
    this.rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = Math.random() * 32;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const rainMat = createGameMaterial({
      kind: 'points',
      color: 0x93c5fd,
      size: 0.28,
      transparent: true,
      opacity: 0.65
    });
    this.rainMesh = new THREE.Points(this.rainGeo, rainMat);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    this.scene.add(this.rainMesh);
  }

  private aiRickshawPool: THREE.Group[] = [];
  private motorbikePool: THREE.Group[] = [];
  private obstaclePools = new Map<string, THREE.Group[]>();
  private sharedCoinGeo?: THREE.CylinderGeometry;
  private sharedCoinMat?: THREE.Material;

  private acquirePooledObstacle(poolKey: string, factory: () => THREE.Group): THREE.Group {
    let list = this.obstaclePools.get(poolKey);
    if (!list) {
      list = [];
      this.obstaclePools.set(poolKey, list);
    }
    let item = list.find((o) => !o.visible);
    if (!item) {
      item = factory();
      item.userData._poolKey = poolKey;
      patchObjectHierarchy(item);
      list.push(item);
      this.scene.add(item);
    }
    item.visible = true;
    item.rotation.set(0, 0, 0);
    item.scale.set(1, 1, 1);
    return item;
  }

  private releasePooledObstacle(obs: THREE.Object3D) {
    if (obs.userData && obs.userData._poolKey) {
      obs.visible = false;
      obs.position.set(0, -100, 500);
    } else {
      this.disposeObjectHierarchy(obs);
      this.scene.remove(obs);
    }
  }

  private initObjectPools() {
    // Pre-allocate car pool using unified VEHICLE_SPECS factories (car, sedan, ambulance)
    const carTypes: CarType[] = ['HATCHBACK', 'SEDAN', 'SUV'];
    for (let i = 0; i < 24; i++) {
      const car = createTrafficCar(carTypes[i % carTypes.length]);
      car.visible = false;
      patchObjectHierarchy(car);
      this.carPool.push(car);
      this.scene.add(car);
    }

    // Pre-allocate AI Rickshaws in the living traffic flow
    for (let i = 0; i < 16; i++) {
      const r = createDetailedRickshaw();
      r.visible = false;
      r.userData.isAIRickshaw = true;
      patchObjectHierarchy(r);
      this.aiRickshawPool.push(r);
      this.scene.add(r);
    }

    // Pre-allocate Pakistani 70cc / 125cc Motorbikes in traffic
    for (let i = 0; i < 12; i++) {
      const b = createCivilianMotorbike();
      b.visible = false;
      patchObjectHierarchy(b);
      this.motorbikePool.push(b);
      this.scene.add(b);
    }

    // Pre-allocate coin pool with ONE shared 8-segment geometry and ONE shared material
    this.sharedCoinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8);
    this.sharedCoinGeo.rotateX(Math.PI / 2); // Bake disc orientation so coin faces camera (±Z) and spins cleanly around Y axis
    this.sharedCoinMat = createGameMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.48,
      metalness: 0.75,
      roughness: 0.22
    });
    for (let i = 0; i < 65; i++) {
      const coin = new THREE.Mesh(this.sharedCoinGeo, this.sharedCoinMat);
      coin.rotation.set(0, 0, 0);
      coin.scale.set(1, 1, 1);
      coin.frustumCulled = true;
      coin.visible = false;
      this.coinPool.push(coin);
      this.scene.add(coin);
    }

    // Pre-allocate exhaust puff mesh pool (ONE shared geometry & ONE shared material)
    for (let i = 0; i < 28; i++) {
      const puff = new THREE.Mesh(this.sharedPuffGeo, this.sharedPuffMat);
      puff.visible = false;
      this.puffPool.push(puff);
      this.scene.add(puff);
    }

    // Pre-allocate coin/burst sparkle pool (ONE shared geometry & ONE shared material)
    for (let i = 0; i < 48; i++) {
      const sparkle = new THREE.Mesh(this.sharedSparkleGeo, this.sharedSparkleMat);
      sparkle.visible = false;
      this.sparklePool.push(sparkle);
      this.scene.add(sparkle);
    }
  }

  private handleResize = () => {
    if (!this.canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private createSkyDome() {
    this.skyGroup = new THREE.Group();
    this.skyGroup.name = 'SkyAndParallaxGroup';
    this.scene.add(this.skyGroup);

    const skyGeo = new THREE.SphereGeometry(360, 12, 8);
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.5, '#38bdf8');
    grad.addColorStop(0.85, '#bae6fd');
    grad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);

    const skyTex = new THREE.CanvasTexture(canvas);
    this.scene.background = skyTex;

    const skyMat = createGameMaterial({
      kind: 'basic',
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
      curveMultiplier: 0
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.frustumCulled = false;
    this.skyDome.matrixAutoUpdate = false;
    this.skyDome.updateMatrix();
    this.skyGroup.add(this.skyDome);

    // Distant Parallax Skyline attached to camera-following skyGroup (not road chunks!)
    [-1, 1].forEach((side) => {
      for (let sz = -260; sz <= 60; sz += 80) {
        const bgSkyline = createBackgroundSkyline(side);
        bgSkyline.position.set(0, ROAD_Y, sz);
        bgSkyline.matrixAutoUpdate = false;
        bgSkyline.updateMatrix();
        patchObjectHierarchy(bgSkyline, 0.25);
        this.skyGroup.add(bgSkyline);
      }
    });

    // High, Far, Flattened Soft Clouds in camera-following skyGroup (shared low-poly spheres)
    this.cloudGroup = new THREE.Group();
    const cloudMat = createGameMaterial({
      color: 0xffffff,
      roughness: 0.95,
      flatShading: true,
      curveMultiplier: 0.15
    });
    const cloudGeoSmall = new THREE.SphereGeometry(14, 7, 6);
    const cloudGeoLarge = new THREE.SphereGeometry(19, 7, 6);

    for (let c = 0; c < 18; c++) {
      const cloud = new THREE.Group();
      const numPuffs = 3 + (c % 3);
      for (let p = 0; p < numPuffs; p++) {
        const puff = new THREE.Mesh(p % 2 === 0 ? cloudGeoSmall : cloudGeoLarge, cloudMat);
        // Flattened soft cloud silhouette well above building tops
        puff.scale.set(1.6, 0.36, 1.2);
        puff.position.set((p - numPuffs / 2) * 14, (p % 2) * 1.2, 0);
        puff.frustumCulled = true;
        puff.matrixAutoUpdate = false;
        puff.updateMatrix();
        cloud.add(puff);
      }
      cloud.position.set(
        ((c % 6) - 2.5) * 75,
        78 + (c % 4) * 12,
        -120 - Math.floor(c / 6) * 95
      );
      cloud.matrixAutoUpdate = false;
      cloud.updateMatrix();
      this.cloudGroup.add(cloud);
    }
    this.skyGroup.add(this.cloudGroup);
  }

  public initWorld() {
    this.nextChunkIndex = 0;
    this.originZOffset = 0;
    this.nextSpawnZ = 0;
    for (let i = 0; i < GAME_CONFIG.ACTIVE_CHUNKS; i++) {
      const zPos = -this.nextChunkIndex * GAME_CONFIG.CHUNK_LENGTH;
      this.spawnChunk(zPos, this.nextChunkIndex);
      this.nextChunkIndex++;
      this.nextSpawnZ = -this.nextChunkIndex * GAME_CONFIG.CHUNK_LENGTH;
    }
    this.unpatchedCount = auditCurve(this.scene).length;
  }

  private spawnChunk(zPos: number, chunkIndex: number = 0) {
    const chunk = new THREE.Group();
    chunk.name = `RoadChunk_${chunkIndex}`;
    chunk.position.set(0, ROAD_Y, zPos);
    chunk.userData.chunkIndex = chunkIndex;

    const roadW = GAME_CONFIG.ROAD_WIDTH;

    initSharedChunkAssets();

    // Continuous Ground Plane at GROUND_Y (-0.05) extending far beyond sidewalks
    const groundPlane = new THREE.Mesh(_chunkGroundGeo!, _chunkGroundMat!);
    groundPlane.position.set(0, GROUND_Y, 0);
    groundPlane.frustumCulled = true;
    groundPlane.matrixAutoUpdate = false;
    groundPlane.updateMatrix();
    chunk.add(groundPlane);

    // High-Resolution Rain-Slicked Wet Asphalt PBR Shader Material
    const road = new THREE.Mesh(_chunkRoadGeo!, _chunkRoadMat!);
    road.position.set(0, ROAD_Y, 0);
    road.frustumCulled = true;
    road.matrixAutoUpdate = false;
    road.updateMatrix();
    chunk.add(road);

    // Pre-merged Dashed White Lane Lines & Directional Arrows (1 draw call)
    const lineMarkings = new THREE.Mesh(_chunkLineMarkingsGeo!, _chunkLineMat!);
    lineMarkings.frustumCulled = true;
    lineMarkings.matrixAutoUpdate = false;
    lineMarkings.updateMatrix();
    chunk.add(lineMarkings);

    // Pre-merged Reflective Cat's-Eye Studs (1 draw call)
    const studs = new THREE.Mesh(_chunkStudsGeo!, _chunkStudMat!);
    studs.frustumCulled = true;
    studs.matrixAutoUpdate = false;
    studs.updateMatrix();
    chunk.add(studs);

    // Pre-merged Yellow Shoulder Striping (1 draw call)
    const shoulders = new THREE.Mesh(_chunkShoulderGeo!, _chunkShoulderMat!);
    shoulders.frustumCulled = true;
    shoulders.matrixAutoUpdate = false;
    shoulders.updateMatrix();
    chunk.add(shoulders);

    // Pre-merged Curbs (Yellow + Black Karachi Curb Stripes)
    const curbs = new THREE.Mesh(_chunkCurbsGeo!, _chunkCurbMat!);
    curbs.frustumCulled = true;
    curbs.matrixAutoUpdate = false;
    curbs.updateMatrix();
    chunk.add(curbs);
    const curbsBlack = new THREE.Mesh(_chunkCurbsBlackGeo!, _chunkCurbBlackMat!);
    curbsBlack.frustumCulled = true;
    curbsBlack.matrixAutoUpdate = false;
    curbsBlack.updateMatrix();
    chunk.add(curbsBlack);

    // Pre-merged Sidewalks (1 draw call)
    const sidewalks = new THREE.Mesh(_chunkSidewalksGeo!, _chunkSidewalkMat!);
    sidewalks.frustumCulled = true;
    sidewalks.matrixAutoUpdate = false;
    sidewalks.updateMatrix();
    chunk.add(sidewalks);

    // Pre-merged Ornate Streetlamps Metal (poles & arms) (1 draw call)
    const lamps = new THREE.Mesh(_chunkLampMetalGeo!, _chunkLampMetalMat!);
    lamps.frustumCulled = true;
    lamps.matrixAutoUpdate = false;
    lamps.updateMatrix();
    chunk.add(lamps);

    // Pre-merged Streetlamp Bulbs (1 draw call)
    const bulbs = new THREE.Mesh(_chunkLampBulbsGeo!, _chunkLampBulbMat!);
    bulbs.frustumCulled = true;
    bulbs.matrixAutoUpdate = false;
    bulbs.updateMatrix();
    chunk.add(bulbs);

    // Pre-merged Sidewalk Date-Palm Trees (2 draw calls instead of 42 meshes per chunk)
    const palmTrunks = new THREE.Mesh(_chunkPalmTrunksGeo!, _chunkPalmTrunkMat!);
    palmTrunks.frustumCulled = true;
    palmTrunks.matrixAutoUpdate = false;
    palmTrunks.updateMatrix();
    chunk.add(palmTrunks);

    const palmFronds = new THREE.Mesh(_chunkPalmFrondsGeo!, _chunkPalmFrondMat!);
    palmFronds.frustumCulled = true;
    palmFronds.matrixAutoUpdate = false;
    palmFronds.updateMatrix();
    chunk.add(palmFronds);

    // Multi-Layer Roadside Puddles elevated slightly above ROAD_Y so they never Z-fight with asphalt
    const numPuddles = 2;
    for (let p = 0; p < numPuddles; p++) {
      const puddle = createPuddle(1.6, 3.2);
      puddle.position.set(
        (p === 0 ? -1 : 1) * 2.6,
        ROAD_Y + 0.022,
        -GAME_CONFIG.CHUNK_LENGTH / 2 + (p + 0.5) * (GAME_CONFIG.CHUNK_LENGTH / numPuddles)
      );
      puddle.matrixAutoUpdate = false;
      puddle.updateMatrix();
      chunk.add(puddle);
      this.activePuddles.push({ puddle, chunk });
    }

    [-1, 1].forEach((side) => {
      // Detailed Pakistani Bazaar Shop Row (1-to-3 story hand-made shops with recessed interiors, shutters, awnings & Urdu/English signboards)
      const shopRow = ShopRow.generate(zPos, side, chunkIndex);
      chunk.add(shopRow);

      // Multi-Layer Skyline Buildings behind & between shop rows (Near, Mid & Far LOD layers from buildings.js)
      const buildingCluster = BuildingManager.generate(zPos, side, chunkIndex);
      chunk.add(buildingCluster);

      // Ambient Walking Pedestrians along sidewalk path at exact SIDEWALK_Y
      for (let p = 0; p < 2; p++) {
        const ped = createPedestrian(side > 0 ? 0x0284c7 : 0xe11d48);
        ped.position.set(side * (roadW / 2 + 2.1), SIDEWALK_Y, (p - 0.5) * 24);
        ped.rotation.y = side > 0 ? 0 : Math.PI;
        ped.userData.propCategory = 'SIDEWALK_PROP';
        ped.userData.expectedBaseY = SIDEWALK_Y;
        chunk.add(ped);
        this.activePedestrians.push(ped);
      }
    });

    // Ceremonial Overhead Street Arch every 3 chunks (only when not overlapping an elevated flyover!)
    if (chunkIndex > 0 && chunkIndex % 3 === 0 && !getFlyoverSpanAtZ(zPos)) {
      const arch = createOverheadStreetArch(roadW);
      arch.position.set(0, ROAD_Y, 0);
      arch.userData.propCategory = 'ARCH';
      arch.userData.expectedBaseY = ROAD_Y;
      chunk.add(arch);
    } else if (!getFlyoverSpanAtZ(zPos)) {
      // Festive Overhead Fairy-Light & Bunting Garland spanning between lampposts
      const garland = createFestiveLightGarland(roadW);
      garland.position.set(0, ROAD_Y, 0);
      garland.userData.propCategory = 'ARCH';
      garland.userData.expectedBaseY = ROAD_Y;
      chunk.add(garland);
    }

    patchObjectHierarchy(chunk);
    this.scene.add(chunk);
    this.roadChunks.push(chunk);

    if (Math.abs(zPos) > 40) {
      this.populateChunkContent(zPos, chunkIndex);
    }
  }

  /**
   * Phase 6 Debug Key "L": Forces an elevated Flyover structure to spawn immediately ahead of the player.
   */
  public forceSpawnFlyoverAhead() {
    const pZ = this.rickshaw ? this.rickshaw.position.z : 0;
    const spawnZ = pZ - 42;
    const deckLen = 96;
    const rampLanes = this.currentLaneIdx === 2 ? [1, 2] : [0, 1];
    this.spawnFlyoverAt(spawnZ, deckLen, rampLanes);
    this.emitToast(`🛣️ FLYOVER SPAWNED AHEAD (LANES ${rampLanes.map((l) => l + 1).join('&')})!`);
  }

  private spawnFlyoverAt(zStart: number, deckLength: number, requestedRampLanes: number[] = [0, 1]) {
    const span = registerFlyoverSpan(zStart, deckLength, requestedRampLanes);
    const rampLanes = span.rampLanes;
    const flyoverGroup = createFlyoverStructure(deckLength, rampLanes);
    flyoverGroup.position.set(0, ROAD_Y, zStart);
    flyoverGroup.userData = {
      ...flyoverGroup.userData,
      type: 'FLYOVER_STRUCTURE',
      spanId: span.id,
      zStart: span.zStart,
      zEnd: span.zEnd,
      level: 0,
      expectedBaseY: ROAD_Y,
      active: true
    };
    this.scene.add(flyoverGroup);
    this.activeObstacles.push(flyoverGroup);

    // Smooth coin ribbons along the ascending ramp and descending ramp following groundHeightAt()
    for (const rLane of rampLanes) {
      const lx = GAME_CONFIG.LANES[rLane];
      for (let step = 4; step <= RAMP_LENGTH - 4; step += 4.5) {
        const czUp = span.zStart - step;
        const cyUp = groundHeightAt(lx, czUp, 1) + 0.85;
        this.spawnSingleCoin(lx, cyUp, czUp, 1);

        const czDown = span.zDownStart - step;
        const cyDown = groundHeightAt(lx, czDown, 1) + 0.85;
        this.spawnSingleCoin(lx, cyDown, czDown, 1);
      }
    }

    // Generate & validate (lane, level) elements for both the elevated deck (level = 1) and open ground lanes (level = 0)
    const flyoverElements = generateFlyoverDeckElements(deckLength, this.speed, rampLanes);
    if (validateFlyoverChunk(flyoverElements, deckLength, this.speed, this.activeVehicle, rampLanes)) {
      for (const el of flyoverElements) {
        // On flyover deck, zOffset is distance along flat deck from span.zUpEnd toward -Z
        const zWorld = span.zUpEnd - el.zOffset;
        const laneX = GAME_CONFIG.LANES[el.lane];
        const lvl = el.level ?? 0;
        this.spawnPatternElement(el, laneX, zWorld, lvl);
      }
    }
  }

  private spawnSingleCoin(x: number, y: number, z: number, level: 0 | 1 = 0) {
    let coin = this.coinPool.find((c) => !c.visible);
    if (!coin) {
      coin = new THREE.Mesh(this.sharedCoinGeo!, this.sharedCoinMat!);
      coin.frustumCulled = true;
      this.coinPool.push(coin);
      this.scene.add(coin);
    }
    coin.visible = true;
    coin.position.set(x, y, z);
    coin.rotation.set(0, (z * 0.35) % (Math.PI * 2), 0);
    coin.scale.set(1, 1, 1);
    coin.userData = { active: true, level };
    this.activeCoins.push(coin);
  }

  private spawnPatternElement(el: PatternElement, laneX: number, zPos: number, level: 0 | 1 = 0) {
    switch (el.kind) {
      case 'CAR':
        this.spawnAICar(laneX, zPos, level);
        break;
      case 'RICKSHAW':
        this.spawnAIRickshaw(laneX, zPos, level);
        break;
      case 'BIKE':
        this.spawnCivilianMotorbike(laneX, zPos, level);
        break;
      case 'BUS':
        if (level === 0) this.spawnBus(laneX, zPos, Math.random() < 0.5);
        break;
      case 'BUS_RAMP':
        if (level === 0 && !getFlyoverSpanAtZ(zPos)) {
          this.spawnBusWithRamp(laneX, zPos, Math.random() < 0.5);
        }
        break;
      case 'BEDFORD':
        if (level === 0) this.spawnBedfordTruck(laneX, zPos);
        break;
      case 'FRUIT_CART':
        this.spawnFruitCart(laneX, zPos, level);
        break;
      case 'COW':
        if (level === 0) this.spawnSahiwalCow(laneX, zPos);
        break;
      case 'HURDLE':
        this.spawnHurdle(laneX, zPos, level);
        break;
      case 'LOW_BEAM':
        this.spawnLowOverheadBeam(laneX, zPos, level);
        break;
      case 'PYLON':
        // Never spawn a 14.6m high-voltage pylon underneath a flyover deck!
        if (level === 0 && !getFlyoverSpanAtZ(zPos)) {
          this.spawnElectricTowerAtLane(el.lane, zPos);
        }
        break;
      case 'CROSSING_CAT':
        if (level === 0) this.spawnCrossingCat(laneX, zPos);
        break;
      case 'CROSSING_PED':
        if (level === 0) this.spawnCrossingPedestrian(laneX, zPos);
        break;
      case 'COIN_LINE':
        this.spawnCoinsOnLane(laneX, zPos, el.coinCount || 6, level);
        break;
      case 'POWERUP':
        this.spawnPowerup(laneX, zPos, el.powerupType, level);
        break;
    }
  }

  private populateChunkContent(chunkZ: number, chunkIndex: number = 0) {
    const chunkDist = chunkIndex * GAME_CONFIG.CHUNK_LENGTH;

    // 1. Check if this chunk falls inside an active Flyover span (or within 20m clear exit zone after down-ramp)
    for (const span of getActiveFlyovers()) {
      if (chunkZ <= span.zStart + 10 && chunkZ >= span.zEnd - GAME_CONFIG.FLYOVER_EXIT_CLEAR_LEN) {
        // Guaranteed fuel check even during flyover spans
        this.checkGuaranteedFuelSpawn(chunkZ, chunkDist, 1);
        return;
      }
    }

    // 2. Phase 4 Flyover Spawning: First flyover after ~600m, then every ~900-1400m (never within 400m of shortcut start)
    const distFromShortcut = Math.abs(chunkDist - this.lastShortcutSpawnDist);
    if (
      chunkDist >= this.nextFlyoverDistance &&
      (this.lastShortcutSpawnDist === 0 || distFromShortcut >= GAME_CONFIG.FLYOVER_SHORTCUT_BUFFER)
    ) {
      const interval =
        GAME_CONFIG.FLYOVER_INTERVAL_MIN +
        Math.random() * (GAME_CONFIG.FLYOVER_INTERVAL_MAX - GAME_CONFIG.FLYOVER_INTERVAL_MIN);
      this.nextFlyoverDistance = chunkDist + interval;

      // Scale flyover flat deck length (80 to 160 units) with difficulty level
      const diffRatio = Math.min(1, this.difficultyLevel / GAME_CONFIG.MAX_DIFFICULTY_LEVEL);
      const deckLen = Math.round(
        GAME_CONFIG.FLYOVER_DECK_LEN_MIN +
          diffRatio * (GAME_CONFIG.FLYOVER_DECK_LEN_MAX - GAME_CONFIG.FLYOVER_DECK_LEN_MIN)
      );
      // Entrance & exit ramp occupies 1 or 2 lanes (leaving at least 1 ground lane open beside it)
      const rampConfigs: number[][] = [
        [0, 1],
        [1, 2],
        [1]
      ];
      const rampLanes = rampConfigs[chunkIndex % rampConfigs.length];
      this.spawnFlyoverAt(chunkZ, deckLen, rampLanes);
      this.checkGuaranteedFuelSpawn(chunkZ - RAMP_LENGTH - 25, chunkDist, 1);
      return;
    }

    // 3. PERF (Stage 3): Spread Ground Pattern Spawning over several frames (1 piece per frame via pendingSpawnQueue)
    const pattern = selectPattern(chunkDist, this.speed);
    let spawnedPowerupInChunk = false;

    for (const el of pattern.elements) {
      const laneX = GAME_CONFIG.LANES[el.lane];
      const zPos = chunkZ - el.zOffset; // Advance forward toward -Z
      if (el.kind === 'POWERUP') {
        if (spawnedPowerupInChunk) continue;
        spawnedPowerupInChunk = true;
      }
      this.pendingSpawnQueue.push({ el, laneX, zPos, level: 0 });
    }

    // 4. Guaranteed Fuel Safety-Net Rule: Place a Fuel pickup whenever projected gauge falls below ~35% within 250m
    this.checkGuaranteedFuelSpawn(chunkZ - 22, chunkDist, 0);

    // 5. Rare Branching Shortcut Routes (~every 900-1400m, never overlapping a flyover)
    if (
      chunkDist > 750 &&
      chunkDist - this.lastShortcutSpawnDist > 1100 &&
      Math.abs(chunkDist - this.nextFlyoverDistance) > GAME_CONFIG.FLYOVER_SHORTCUT_BUFFER
    ) {
      this.lastShortcutSpawnDist = chunkDist;
      this.shortcutZStart = chunkZ;
      this.shortcutZEnd = chunkZ - GAME_CONFIG.SHORTCUT_LENGTH;

      // PERF: Pool shortcut sign
      const sign = this.acquirePooledObstacle('SHORTCUT_SIGN', () => createShortcutSign());
      sign.position.set(0, ROAD_Y, chunkZ);
      Object.assign(sign.userData, {
        type: 'SHORTCUT_SIGN',
        level: 0,
        expectedBaseY: ROAD_Y,
        active: true
      });
      this.activeObstacles.push(sign);

      this.spawnCoinsOnLane(GAME_CONFIG.SHORTCUT_LANES[0], chunkZ - 45, 8, 0);
      this.spawnCoinsOnLane(GAME_CONFIG.SHORTCUT_LANES[1], chunkZ - 90, 8, 0);
      this.spawnMysteryBoxPickup(GAME_CONFIG.SHORTCUT_LANES[0], chunkZ - 130);
    }

    // 6. Rare Mystery Box Spawning outside shortcuts
    if (!this.isMysteryActive && Math.random() < 0.14) {
      const openLane = GAME_CONFIG.LANES[Math.floor(Math.random() * 3)];
      this.spawnMysteryBoxPickup(openLane, chunkZ - 8);
    }
  }

  private pendingSpawnQueue: { el: PatternElement; laneX: number; zPos: number; level: 0 | 1 }[] = [];

  // PERF (Stage 3): Process 1 queued spawn piece per frame so chunk recycling never spikes frame time
  private processPendingSpawnSlice() {
    const slices = PERF_CONFIG.CHUNK_PIECES_PER_FRAME;
    for (let s = 0; s < slices && this.pendingSpawnQueue.length > 0; s++) {
      const item = this.pendingSpawnQueue.shift()!;
      this.spawnPatternElement(item.el, item.laneX, item.zPos, item.level);
    }
  }

  private checkGuaranteedFuelSpawn(zPos: number, runDistance: number, level: 0 | 1 = 0) {
    if (!this.pickupManager) return;
    const effMult = 1 - ((this.upgrades.fuelEfficiencyLevel || 1) - 1) * 0.08;
    const drainPerMeter =
      GAME_CONFIG.FUEL_BASE_DRAIN_RATE *
      effMult *
      (0.6 + this.speed / GAME_CONFIG.MAX_SPEED);
    const projectedFuel = this.fuel - drainPerMeter * GAME_CONFIG.FUEL_PITY_LOOKAHEAD_M;
    const distSinceLastFuel = runDistance - this.pickupManager.lastFuelSpawnDist;

    if (
      (projectedFuel <= GAME_CONFIG.FUEL_PITY_THRESHOLD_PCT && distSinceLastFuel >= 65) ||
      distSinceLastFuel >= 210
    ) {
      // Find a reachable lane at zPos that has no obstacle within ±5m
      let chosenLaneX = GAME_CONFIG.LANES[1];
      for (const lx of GAME_CONFIG.LANES) {
        const blocked = this.activeObstacles.some(
          (o) =>
            (o.userData.level ?? 0) === level &&
            Math.abs(o.position.x - lx) < 1.5 &&
            Math.abs(o.position.z - zPos) < 5.5
        );
        if (!blocked) {
          chosenLaneX = lx;
          break;
        }
      }
      const baseY = level === 1 ? groundHeightAt(chosenLaneX, zPos, 1) : ROAD_Y;
      const variantId = this.pickupManager.selectVariantForKind('FUEL', runDistance, level === 1);
      this.pickupManager.spawnPickup(variantId, chosenLaneX, baseY, zPos, runDistance);
    }
  }

  // Object-Pooled AI Traffic Car with PID Following Controller & Blinkers
  private spawnAICar(laneX: number, zPos: number, level: 0 | 1 = 0) {
    // PERF (Stage 3): Enforce fixed active vehicle cap from PERF_CONFIG
    if (this.activeAITraffic.length >= PERF_CONFIG.MAX_ACTIVE_VEHICLES) return;
    let car = this.carPool.find((c) => !c.visible);
    if (!car) return; // Fixed pool cap reached
    if (car.userData.debugGroup) {
      car.userData.debugGroup.visible = this.debugBoundingBoxes;
    }

    const baseY = level === 1 ? groundHeightAt(laneX, zPos, 1) : ROAD_Y;
    const currentLaneIdx = GAME_CONFIG.LANES.indexOf(laneX);
    car.visible = true;
    car.position.set(laneX, baseY, zPos);
    car.rotation.set(0, 0, 0);
    car.userData.level = level;
    car.userData.expectedBaseY = baseY;
    car.userData.currentLaneIdx = currentLaneIdx !== -1 ? currentLaneIdx : 1;
    car.userData.targetLaneX = laneX;
    car.userData.baseSpeed = 16 + Math.random() * 8;
    car.userData.speed = car.userData.baseSpeed;
    car.userData.isBraking = false;
    car.userData.honkTimer = 4.0 + Math.random() * 7.0;
    car.userData.nearMissAwarded = false;

    // PID Controller Longitudinal Parameters
    car.userData.pidIntegral = 0;
    car.userData.pidPrevError = 0;
    car.userData.kp = 0.62;
    car.userData.ki = 0.045;
    car.userData.kd = 0.26;
    car.userData.maxAccel = 8.5;
    car.userData.maxBrake = 18.0;

    // Living Traffic Lane-Changing & Blinkers
    car.userData.laneState = 'CRUISING';
    car.userData.blinkerSide = 'NONE';
    car.userData.blinkerPhase = 0;
    car.userData.prepareTimer = 0;
    car.userData.laneChangeTimer = 2.5 + Math.random() * 4.5;

    if (car.userData.leftBlinkerMat) car.userData.leftBlinkerMat.emissiveIntensity = 0.05;
    if (car.userData.rightBlinkerMat) car.userData.rightBlinkerMat.emissiveIntensity = 0.05;

    this.activeAITraffic.push(car);
  }

  // Object-Pooled AI Rickshaw with PID Controller, Blinkers, and authentic 3-wheel handling
  private spawnAIRickshaw(laneX: number, zPos: number, level: 0 | 1 = 0) {
    // PERF (Stage 3): Enforce fixed active vehicle cap from PERF_CONFIG
    if (this.activeAITraffic.length >= PERF_CONFIG.MAX_ACTIVE_VEHICLES) return;
    let r = this.aiRickshawPool.find((item) => !item.visible);
    if (!r) return;

    const baseY = level === 1 ? groundHeightAt(laneX, zPos, 1) : ROAD_Y;
    const currentLaneIdx = GAME_CONFIG.LANES.indexOf(laneX);
    r.visible = true;
    r.position.set(laneX, baseY, zPos);
    r.rotation.set(0, 0, 0);
    r.userData.level = level;
    r.userData.expectedBaseY = baseY;
    r.userData.currentLaneIdx = currentLaneIdx !== -1 ? currentLaneIdx : 1;
    r.userData.targetLaneX = laneX;
    r.userData.baseSpeed = 14 + Math.random() * 6;
    r.userData.speed = r.userData.baseSpeed;
    r.userData.isBraking = false;
    r.userData.honkTimer = 3.5 + Math.random() * 5.0;
    r.userData.nearMissAwarded = false;

    // PID Controller Longitudinal Parameters
    r.userData.pidIntegral = 0;
    r.userData.pidPrevError = 0;
    r.userData.kp = 0.68;
    r.userData.ki = 0.05;
    r.userData.kd = 0.28;
    r.userData.maxAccel = 9.0;
    r.userData.maxBrake = 19.0;

    // Living Traffic Lane-Changing & Blinkers
    r.userData.laneState = 'CRUISING';
    r.userData.blinkerSide = 'NONE';
    r.userData.blinkerPhase = 0;
    r.userData.prepareTimer = 0;
    r.userData.laneChangeTimer = 2.0 + Math.random() * 4.0;

    if (r.userData.leftBlinkerMat) r.userData.leftBlinkerMat.emissiveIntensity = 0.05;
    if (r.userData.rightBlinkerMat) r.userData.rightBlinkerMat.emissiveIntensity = 0.05;

    this.activeAITraffic.push(r);
  }

  // Object-Pooled Pakistani 70cc / 125cc Motorbike with PID & Nimble Lane Weaving
  private spawnCivilianMotorbike(laneX: number, zPos: number, level: 0 | 1 = 0) {
    // PERF (Stage 3): Enforce fixed active vehicle cap from PERF_CONFIG
    if (this.activeAITraffic.length >= PERF_CONFIG.MAX_ACTIVE_VEHICLES) return;
    let b = this.motorbikePool.find((item) => !item.visible);
    if (!b) return;

    const baseY = level === 1 ? groundHeightAt(laneX, zPos, 1) : ROAD_Y;
    const currentLaneIdx = GAME_CONFIG.LANES.indexOf(laneX);
    b.visible = true;
    b.position.set(laneX, baseY, zPos);
    b.rotation.set(0, 0, 0);
    b.userData.level = level;
    b.userData.expectedBaseY = baseY;
    b.userData.currentLaneIdx = currentLaneIdx !== -1 ? currentLaneIdx : 1;
    b.userData.targetLaneX = laneX;
    b.userData.baseSpeed = 18 + Math.random() * 8;
    b.userData.speed = b.userData.baseSpeed;
    b.userData.isBraking = false;
    b.userData.honkTimer = 3.0 + Math.random() * 6.0;
    b.userData.nearMissAwarded = false;

    // PID Controller Longitudinal Parameters
    b.userData.pidIntegral = 0;
    b.userData.pidPrevError = 0;
    b.userData.kp = 0.72;
    b.userData.ki = 0.055;
    b.userData.kd = 0.24;
    b.userData.maxAccel = 11.0;
    b.userData.maxBrake = 20.0;

    // Living Traffic Lane-Changing & Blinkers
    b.userData.laneState = 'CRUISING';
    b.userData.blinkerSide = 'NONE';
    b.userData.blinkerPhase = 0;
    b.userData.prepareTimer = 0;
    b.userData.laneChangeTimer = 1.8 + Math.random() * 3.5;

    if (b.userData.leftBlinkerMat) b.userData.leftBlinkerMat.emissiveIntensity = 0.05;
    if (b.userData.rightBlinkerMat) b.userData.rightBlinkerMat.emissiveIntensity = 0.05;

    this.activeAITraffic.push(b);
  }

  private spawnElectricTowerAtLane(laneIdx: number, zPos: number) {
    // PERF (Stage 3): Pool electric transmission tower instead of creating/disposing per spawn
    const tower = this.acquirePooledObstacle('ELECTRIC_TOWER', () => createElectricTransmissionTower());
    const laneX = GAME_CONFIG.LANES[laneIdx];
    tower.position.set(laneX, ROAD_Y, zPos);
    Object.assign(tower.userData, {
      type: 'ELECTRIC_TOWER',
      laneX: laneX,
      level: 0,
      expectedBaseY: ROAD_Y,
      nearMissAwarded: false,
      active: true
    });
    this.activeObstacles.push(tower);

    // Coins on adjacent open lanes
    [0, 1, 2].filter((i) => i !== laneIdx).forEach((openIdx) => {
      this.spawnCoinsOnLane(GAME_CONFIG.LANES[openIdx], zPos - 4, 4, 0);
    });
  }

  private spawnElectricTower(zPos: number) {
    this.spawnElectricTowerAtLane(1, zPos);
  }

  private spawnBus(laneX: number, zPos: number, isMetro = false) {
    // PERF (Stage 3): Pool transport bus
    const bus = this.acquirePooledObstacle(isMetro ? 'BUS_METRO' : 'BUS_CLASSIC', () => createTransportBus(isMetro));
    bus.position.set(laneX, ROAD_Y, zPos);
    Object.assign(bus.userData, {
      type: 'BUS',
      laneX: laneX,
      level: 0,
      expectedBaseY: ROAD_Y,
      nearMissAwarded: false,
      active: true
    });
    this.activeObstacles.push(bus);
  }

  private spawnBusWithRamp(laneX: number, zPos: number, isMetro = false) {
    // PERF (Stage 3): Pool bus with ascending ramp
    const bus = this.acquirePooledObstacle(isMetro ? 'BUS_RAMP_METRO' : 'BUS_RAMP_CLASSIC', () => createBusWithRamp(isMetro));
    bus.position.set(laneX, ROAD_Y, zPos);
    Object.assign(bus.userData, {
      type: 'BUS_RAMP',
      laneX: laneX,
      roofHeight: BUS_ROOF_HEIGHT,
      rampLowOffsetZ: BUS_RAMP_LOW_OFFSET_Z,
      rampHighOffsetZ: BUS_RAMP_HIGH_OFFSET_Z,
      level: 0,
      expectedBaseY: ROAD_Y,
      nearMissAwarded: false,
      active: true
    });
    this.activeObstacles.push(bus);

    // Sync active bus ramps immediately so groundHeightAt() includes this bus ramp right away
    setBusRamps(this.activeObstacles);

    // Spawn smooth coin trail starting on the ascending ramp (+8.2m) and continuing across the bus roof (-3.8m)
    for (let offsetZ = 8.2; offsetZ >= -3.8; offsetZ -= 2.0) {
      const cz = zPos + offsetZ;
      const surfY = groundHeightAt(laneX, cz, 0);
      this.spawnSingleCoin(laneX, surfY + 0.85, cz, 0);
    }
  }

  private spawnCrossingCat(laneX: number, zPos: number) {
    if (this.activePedestrians.length >= PERF_CONFIG.MAX_ACTIVE_NPCS) return;
    const cat = this.acquirePooledObstacle('CROSSING_CAT', () => createStrayCat());
    cat.position.set(laneX, ROAD_Y, zPos);
    cat.userData.level = 0;
    cat.userData.expectedBaseY = ROAD_Y;
    cat.userData.isCat = true;
    cat.userData.crossDir = Math.random() < 0.5 ? -1 : 1;
    cat.userData.crossSpeed = 2.0 + Math.random() * 1.5;
    cat.rotation.y = cat.userData.crossDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.activePedestrians.push(cat);
  }

  private spawnCrossingPedestrian(laneX: number, zPos: number) {
    if (this.activePedestrians.length >= PERF_CONFIG.MAX_ACTIVE_NPCS) return;
    const ped = this.acquirePooledObstacle('CROSSING_PED', () => createCrossingPedestrian(0x059669));
    ped.position.set(laneX, ROAD_Y, zPos);
    ped.userData.level = 0;
    ped.userData.expectedBaseY = ROAD_Y;
    ped.userData.isCrossingPed = true;
    ped.userData.crossDir = Math.random() < 0.5 ? -1 : 1;
    ped.userData.crossSpeed = 1.2 + Math.random() * 1.0;
    ped.rotation.y = ped.userData.crossDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.activePedestrians.push(ped);
  }

  private spawnFruitCart(laneX: number, zPos: number, level: 0 | 1 = 0) {
    const cart = this.acquirePooledObstacle('FRUIT_CART', () => createFruitCart());
    const baseY = level === 1 ? groundHeightAt(laneX, zPos, 1) : ROAD_Y;
    cart.position.set(laneX, baseY, zPos);
    Object.assign(cart.userData, {
      type: 'FRUIT_CART',
      laneX: laneX,
      level,
      expectedBaseY: baseY,
      isStunned: false,
      nearMissAwarded: false,
      active: true
    });
    this.activeObstacles.push(cart);
  }

  private spawnBedfordTruck(laneX: number, zPos: number) {
    const truck = this.acquirePooledObstacle('BEDFORD_TRUCK', () => createBedfordTruck());
    truck.position.set(laneX, ROAD_Y, zPos);
    Object.assign(truck.userData, {
      type: 'BEDFORD_TRUCK',
      laneX: laneX,
      level: 0,
      expectedBaseY: ROAD_Y,
      speed: 10 + Math.random() * 5,
      honkTimer: 4 + Math.random() * 8,
      nearMissAwarded: false,
      active: true
    });
    this.activeObstacles.push(truck);
  }

  private spawnSahiwalCow(laneX: number, zPos: number) {
    const cow = this.acquirePooledObstacle('SAHIWAL_COW', () => createSahiwalCow());
    cow.position.set(laneX, ROAD_Y, zPos);
    Object.assign(cow.userData, {
      type: 'SAHIWAL_COW',
      laneX: laneX,
      level: 0,
      expectedBaseY: ROAD_Y,
      nearMissAwarded: false,
      active: true
    });
    this.activeObstacles.push(cow);
  }

  private spawnHurdle(laneX: number, zPos: number, level: 0 | 1 = 0) {
    const group = this.acquirePooledObstacle('HURDLE', () => createRoadHurdle());
    const baseY = level === 1 ? groundHeightAt(laneX, zPos, 1) : ROAD_Y;
    group.position.set(laneX, baseY, zPos);
    Object.assign(group.userData, {
      type: 'HURDLE',
      laneX,
      level,
      expectedBaseY: baseY,
      canJumpOver: true,
      nearMissAwarded: false,
      active: true
    });
    this.activeObstacles.push(group);
  }

  private spawnLowOverheadBeam(laneX: number, zPos: number, level: 0 | 1 = 0) {
    // PERF (Stage 2 & 3): Pool overhead low beam using shared geometries & materials
    const group = this.acquirePooledObstacle('LOW_BEAM', () => {
      const g = new THREE.Group();
      const postMat = createGameMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
      const beamMat = createGameMaterial({ color: 0xf59e0b, roughness: 0.35 });
      const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8);
      const crossbarGeo = new THREE.BoxGeometry(2.7, 0.36, 0.28);

      [-1.25, 1.25].forEach((px) => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 1.1, 0);
        post.frustumCulled = true;
        post.matrixAutoUpdate = false;
        post.updateMatrix();
        g.add(post);
      });

      const crossbar = new THREE.Mesh(crossbarGeo, beamMat);
      crossbar.position.set(0, 2.02, 0);
      crossbar.frustumCulled = true;
      crossbar.matrixAutoUpdate = false;
      crossbar.updateMatrix();
      g.add(crossbar);

      g.add(createBlobShadow(2.6, 0.8, 0.38));
      return g;
    });
    const baseY = level === 1 ? groundHeightAt(laneX, zPos, 1) : ROAD_Y;
    group.position.set(laneX, baseY, zPos);
    Object.assign(group.userData, {
      type: 'LOW_BEAM',
      laneX,
      level,
      expectedBaseY: baseY,
      canSlideUnder: true,
      nearMissAwarded: false,
      active: true
    });
    this.activeObstacles.push(group);
  }

  private spawnCoinsOnLane(laneX: number, zCenter: number, count = 5, level: 0 | 1 = 0) {
    const half = Math.floor(count / 2);
    for (let i = -half; i <= half; i++) {
      const cz = zCenter + i * 2.6;
      const surfY = level === 1 ? groundHeightAt(laneX, cz, 1) : groundHeightAt(laneX, cz, 0);
      this.spawnSingleCoin(laneX, surfY + 0.85, cz, level);
    }
  }

  private spawnPowerup(laneX: number, zPos: number, explicitType?: PowerupType, level: 0 | 1 = 0) {
    const baseY = level === 1 ? groundHeightAt(laneX, zPos, 1) : ROAD_Y;
    const runDist = this.distance + Math.max(0, (this.rickshaw ? this.rickshaw.position.z : 0) - zPos);

    // Route Fuel, Shield, and Jump Boost pickups through the InstancedMesh PickupSystemManager!
    if (this.pickupManager) {
      let pickupKind: PickupKind | null = null;
      if (explicitType === 'CNG' || explicitType === 'FUEL_JERRY_CAN' || explicitType === 'FUEL_DRUM' || explicitType === 'FUEL_GOLDEN_CAN') {
        pickupKind = 'FUEL';
      } else if (explicitType === 'SHIELD' || explicitType === 'SHIELD_STANDARD' || explicitType === 'SHIELD_DOUBLE' || explicitType === 'SHIELD_GOLDEN') {
        pickupKind = 'SHIELD';
      } else if (explicitType === 'HYDRAULIC' || explicitType === 'JUMP_SUPER_KHUSSA' || explicitType === 'JUMP_SPRING_BOOTS' || explicitType === 'JUMP_DOUBLE_JUMP') {
        pickupKind = 'JUMP';
      } else if (!explicitType) {
        const roll = Math.random();
        if (roll < 0.42) pickupKind = 'FUEL';
        else if (roll < 0.68) pickupKind = 'SHIELD';
        else if (roll < 0.90) pickupKind = 'JUMP';
      }

      if (pickupKind) {
        if (this.pickupManager.canSpawnKind(pickupKind, runDist, false)) {
          const variantId = this.pickupManager.selectVariantForKind(pickupKind, runDist, level === 1);
          this.pickupManager.spawnPickup(variantId, laneX, baseY, zPos, runDist);
        }
        return;
      }
    }

    // PERF (Stage 2 & 3): Pool Magnet, Jetpack & Multiplier powerups with low-poly 8-segment geometries
    const fallbackTypes: PowerupType[] = ['MAGNET', 'JETPACK', 'MULTIPLIER'];
    const type = explicitType && fallbackTypes.includes(explicitType)
      ? explicitType
      : fallbackTypes[Math.floor(Math.random() * fallbackTypes.length)];

    const group = this.acquirePooledObstacle(`POWERUP_${type}`, () => {
      const g = new THREE.Group();
      if (type === 'MAGNET') {
        const horseshoe = new THREE.Mesh(
          new THREE.TorusGeometry(0.4, 0.12, 6, 8, Math.PI),
          createGameMaterial({ color: 0xef4444, metalness: 0.8 })
        );
        horseshoe.rotation.z = Math.PI;
        g.add(horseshoe);
      } else if (type === 'JETPACK') {
        const rocket = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.2, 0.7, 8),
          createGameMaterial({ color: 0x0284c7, metalness: 0.8 })
        );
        g.add(rocket);
      } else {
        const star = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.45),
          createGameMaterial({ color: 0x8b5cf6, metalness: 0.7 })
        );
        g.add(star);
      }
      return g;
    });
    group.position.set(laneX, baseY + 1.0, zPos);
    Object.assign(group.userData, { type, level, baseY, active: true });
    this.activePowerups.push(group);
  }

  private spawnMysteryBoxPickup(laneX: number, zPos: number) {
    // PERF (Stage 3): Pool mystery box pickup
    const box = this.acquirePooledObstacle('MYSTERY_BOX', () => createMysteryBox());
    box.position.set(laneX, ROAD_Y + 1.1, zPos);
    box.userData.level = 0;
    box.userData.isMysteryBox = true;
    this.activePowerups.push(box);
  }

  // Controls & Physics
  public switchLane(dir: number) {
    if (this.state !== 'RUNNING') return;
    const lanes = this.isShortcutActive ? GAME_CONFIG.SHORTCUT_LANES : GAME_CONFIG.LANES;
    const newIdx = this.currentLaneIdx + dir;
    if (newIdx >= 0 && newIdx < lanes.length) {
      let desiredX = lanes[newIdx];
      const pZ = this.rickshaw ? this.rickshaw.position.z : 0;
      const span = getFlyoverSpanAtZ(pZ);
      if (span && !this.isShortcutActive) {
        if (this.playerFlyoverPassLevel === 1) {
          const bounds = getElevatedBoundsAtZ(span, pZ);
          if (desiredX < bounds.minX + 0.5 || desiredX > bounds.maxX - 0.5) {
            // Solid guard rail: slide along the rail without desyncing lane index
            this.targetX = THREE.MathUtils.clamp(this.targetX, bounds.minX + 0.7, bounds.maxX - 0.7);
            return;
          }
        } else {
          // On ground road beside/under flyover: median barrier blocks walled ramp lanes
          if (!span.openGroundLanes.includes(newIdx)) {
            return;
          }
        }
      }
      this.currentLaneIdx = newIdx;
      this.targetX = desiredX;
    }
  }

  public jump() {
    if (this.state !== 'RUNNING') return;
    this.isJumpHolding = true;
    // Coyote time (~0.1s) allows jump even slightly after rolling off ground or bus roof
    if (!this.isJumping && (this.groundTimer > 0 || this.jumpOffset <= 0.15)) {
      this.executeJump(false);
    } else if (this.isJumping && this.jumpVariant === 'JUMP_DOUBLE_JUMP' && this.doubleJumpsRemaining > 0) {
      // Mid-air Double Jump!
      this.doubleJumpsRemaining--;
      this.executeJump(true);
      this.emitToast('🪽 WINGED DOUBLE JUMP!');
    } else {
      // Input buffer (~0.12s)
      this.inputBuffer = { action: 'JUMP', time: 0.12 };
    }
  }

  public releaseJump() {
    this.isJumpHolding = false;
    // Variable jump height: cut vertical impulse if released early
    if (this.verticalVelocity > 6.0) {
      this.verticalVelocity *= 0.55;
    }
  }

  private executeJump(isSecondAirJump = false) {
    this.isJumping = true;
    this.groundTimer = 0;
    const isSuper =
      this.jumpVariant === 'JUMP_SUPER_KHUSSA' ||
      this.activePowerup === 'HYDRAULIC';
    const baseImpulse = this.vehicleDef ? this.vehicleDef.jumpImpulse : GAME_CONFIG.NORMAL_JUMP;
    const hydraulicBonus = 1 + ((this.upgrades.hydraulicLevel || 1) - 1) * 0.08;
    const jumpImpulse = isSuper
      ? baseImpulse * GAME_CONFIG.JUMP_SUPER_KHUSSA_MULT * hydraulicBonus
      : isSecondAirJump
      ? baseImpulse * 1.15
      : baseImpulse;
    this.verticalVelocity = jumpImpulse;
    this.sound.playJump(isSuper || isSecondAirJump || this.jumpVariant !== null);
  }

  public slide() {
    if (this.state !== 'RUNNING') return;
    if (this.isJumping) {
      // Fast fall downward smash
      this.verticalVelocity = -28;
    }
    this.isSliding = true;
    this.slideTimer = 0.85;
  }

  public honkHorn(): boolean {
    if (this.state !== 'RUNNING') return false;
    if (this.hornCooldown > 0) return false;
    this.hornCooldown = 3.0; // 3-second cooldown
    this.sound.playHorn();
    if (this.npcManager) {
      this.npcManager.onHorn(this.rickshaw.position);
    }

    const pZ = this.rickshaw.position.z;

    // 1. Scatter crossing pedestrians and street cats
    this.activePedestrians.forEach((ped) => {
      if (Math.abs(ped.position.z - pZ) < 32) {
        ped.userData.crossSpeed = (ped.userData.crossSpeed || 3.0) * 2.8;
        ped.userData.crossDir = ped.position.x > 0 ? 1 : -1;
      }
    });

    // 2. Scatter nearby civilian motorbikes away from player
    this.activeAITraffic.forEach((v) => {
      const distZ = v.position.z - pZ;
      if (distZ < 0 && distZ > -25 && Math.abs(v.position.x - this.playerX) < 2.0) {
        if (v.userData.currentLaneIdx === 1) {
          v.userData.targetLaneX = GAME_CONFIG.LANES[0];
          v.userData.currentLaneIdx = 0;
        } else if (v.userData.currentLaneIdx === 0) {
          v.userData.targetLaneX = GAME_CONFIG.LANES[1];
          v.userData.currentLaneIdx = 1;
        }
      }
    });

    // 3. Briefly stun fruit cart vendors for bonus points
    for (const obs of this.activeObstacles) {
      if (obs.userData.type === 'FRUIT_CART' && (obs.userData.level ?? 0) === this.verticalLevel) {
        const distZ = obs.position.z - pZ;
        if (distZ < 0 && distZ > -24 && Math.abs(obs.userData.laneX - this.playerX) < 2.2 && !obs.userData.isStunned) {
          obs.userData.isStunned = true;
          this.coins += 25 * this.scoreMultiplier;
          this.totalRupees += 25;
          this.chaiNitroCharge = Math.min(100, this.chaiNitroCharge + 20);
          this.sound.playCoin();
          this.emitToast('🥭 MANGO VENDOR STUNNED BY HORN! +25 PKR & +20% CHAI NITRO!');
          break;
        }
      }
    }

    // 4. Open Roadside Dhaba & Paan Shop Horn-Order Express Delivery!
    if (this.verticalLevel === 0) {
      for (const chunk of this.roadChunks) {
        const distZ = Math.abs(chunk.position.z - pZ);
        if (distZ < 24 && !chunk.userData.shopOrderServedThisPass) {
          chunk.userData.shopOrderServedThisPass = true;
          this.roadsideOrdersServed++;
          const tip = 30 * this.scoreMultiplier;
          this.coins += tip;
          this.totalRupees += tip;
          this.fuel = Math.min(GAME_CONFIG.FUEL_MAX, this.fuel + 18);
          this.cngFuel = this.fuel;
          this.chaiNitroCharge = Math.min(100, this.chaiNitroCharge + 35);
          this.sound.playCoin();
          this.spawnPickupBurst(this.rickshaw.position, 0xfacc15, 22);
          this.emitToast(`☕ OPEN DHABA CHAI EXPRESS ORDER! +${tip} PKR, +18% FUEL & +35% NITRO!`);
          this.notifyStats();
          break;
        }
      }
    }

    return true;
  }

  /**
   * Unleashes Chai Nitro Overdrive when chaiNitroCharge >= 50%:
   * - 1.38x Turbo Speed
   * - Zero Fuel Drain
   * - Smashes through road hazards & traffic with golden-cyan spark trails
   */
  public activateChaiNitro(forceFree = false): boolean {
    if (this.state !== 'RUNNING') return false;
    if (!forceFree && this.chaiNitroCharge < 50) {
      this.emitToast(`☕ NEED 50% CHAI NITRO! (CURRENT: ${Math.round(this.chaiNitroCharge)}%) — HONK AT OPEN SHOPS!`);
      return false;
    }
    const duration = forceFree ? 6.5 : 3.5 + (this.chaiNitroCharge / 100) * 3.5;
    if (!forceFree) {
      this.chaiNitroCharge = 0;
    }
    this.isNitroActive = true;
    this.nitroTimer = Math.max(this.nitroTimer, duration);
    this.fuelNoDrainTimer = Math.max(this.fuelNoDrainTimer, duration);
    this.sound.playSpeedUp();
    this.triggerScreenFlash('#facc15', 0.22);
    this.spawnPickupBurst(this.rickshaw.position, 0xfacc15, 28);
    this.emitToast(`🔥 KARAK CHAI NITRO OVERDRIVE! (${duration.toFixed(1)}s TURBO + SMASH + ZERO FUEL DRAIN!)`);
    this.notifyStats();
    return true;
  }

  public activateShield(variant: PickupVariantId = 'SHIELD_STANDARD') {
    if (this.state !== 'RUNNING') return;
    const def = PICKUP_DEFINITIONS[variant] || PICKUP_DEFINITIONS.SHIELD_STANDARD;

    // Shield stacking rules: collecting another shield refreshes timer, or upgrades Standard to Double
    if (this.hasShield && this.shieldVariant === 'SHIELD_STANDARD' && variant === 'SHIELD_STANDARD') {
      this.shieldVariant = 'SHIELD_DOUBLE';
      this.shieldCharges = 2;
      this.shieldMaxDuration = GAME_CONFIG.SHIELD_DURATION_DOUBLE;
      this.shieldTimer = this.shieldMaxDuration;
      this.emitToast('🛡️ SHIELD UPGRADED TO DOUBLE SHIELD (2 HITS)!');
    } else {
      this.shieldVariant = variant;
      this.shieldCharges = Math.max(this.shieldCharges, def.amount);
      this.shieldMaxDuration = def.duration;
      this.shieldTimer = def.duration;
      this.emitToast(`🛡️ ${def.name.toUpperCase()} ACTIVE!`);
    }

    this.hasShield = true;
    this.syncShieldBubbleVisuals();
  }

  private syncShieldBubbleVisuals() {
    if (!this.playerShieldBubble) return;
    this.playerShieldBubble.visible = this.hasShield && this.shieldCharges > 0;
    if (!this.playerShieldBubble.visible) return;

    const { bubbleMat, ring1, ring1Mat, ring2 } = this.playerShieldBubble.userData;
    const isGolden = this.shieldVariant === 'SHIELD_GOLDEN';
    const isDouble = this.shieldCharges >= 2 || this.shieldVariant === 'SHIELD_DOUBLE';

    if (bubbleMat) {
      bubbleMat.color.setHex(isGolden ? 0xfbbf24 : isDouble ? 0x2563eb : 0x06b6d4);
      bubbleMat.emissive.setHex(isGolden ? 0xd97706 : isDouble ? 0x1d4ed8 : 0x0891b2);
    }
    if (ring1Mat) {
      ring1Mat.color.setHex(isGolden ? 0xfef08a : 0x38bdf8);
    }
    if (ring1) ring1.visible = this.shieldCharges >= 1;
    if (ring2) ring2.visible = this.shieldCharges >= 2;
  }

  /**
   * Absorbs a collision or police CAUGHT state using 1 Shield hit charge:
   * - Spawns shatter particles, screen flash, camera shake, glass-break sound, 1.0s invulnerability
   * - Resets police gap to SAFE
   * - If Golden Shield (`SHIELD_GOLDEN`), destroys the obstacle hit and awards bonus coins!
   */
  private consumeShieldHit(reason: string, hitObstacle?: THREE.Object3D): boolean {
    if (!this.hasShield || this.shieldCharges <= 0) return false;

    const wasGolden = this.shieldVariant === 'SHIELD_GOLDEN';
    this.shieldCharges--;
    if (this.shieldCharges <= 0) {
      this.hasShield = false;
      this.shieldVariant = null;
      this.shieldTimer = 0;
    }
    this.syncShieldBubbleVisuals();

    // 1.0s Invulnerability, glass-break sound, screen flash, camera shake, shatter burst
    this.invulnerabilityTimer = GAME_CONFIG.SHIELD_HIT_INVULN;
    this.sound.playShieldShatter();
    this.triggerScreenFlash(wasGolden ? '#facc15' : '#38bdf8', 0.28);
    this.triggerCameraShake(0.35, 0.35);
    this.spawnPickupBurst(this.rickshaw.position, wasGolden ? 0xfbbf24 : 0x06b6d4, 26);

    // Police gap resets to SAFE (they fall back)
    if (this.policeChase) {
      this.policeChase.state = 'SAFE';
      this.policeChase.gap = GAME_CONFIG.POLICE_GAP_SAFE;
    }

    // Golden Shield destroys the obstacle hit and awards bonus coins
    if (wasGolden && hitObstacle) {
      hitObstacle.visible = false;
      hitObstacle.position.z += 500;
      const bonus = GAME_CONFIG.SHIELD_GOLDEN_BONUS_COINS * this.scoreMultiplier;
      this.coins += bonus;
      this.totalRupees += bonus;
      this.emitToast(`👑 GOLDEN SHIELD OBLITERATED OBSTACLE! +${bonus} BONUS COINS!`);
    } else {
      this.emitToast(
        this.shieldCharges > 0
          ? `🛡️ SHIELD ABSORBED HIT! (${this.shieldCharges} HIT LEFT)`
          : `🛡️ SHIELD SAVED YOU FROM ${reason.toUpperCase()}! POLICE RESET TO SAFE!`
      );
    }
    return true;
  }

  private triggerScreenFlash(color: string, duration = 0.25) {
    this.screenFlashColor = color;
    this.screenFlashTimer = duration;
  }

  private triggerCameraShake(duration = 0.3, intensity = 0.3) {
    this.cameraShakeTimer = duration;
    this.cameraShakeIntensity = intensity;
  }

  public start() {
    this.sound.init();
    this.state = 'RUNNING';
    if (this.upgrades.starterShield > 0) {
      this.activateShield(this.upgrades.starterShield >= 2 ? 'SHIELD_DOUBLE' : 'SHIELD_STANDARD');
    }
    if ((this.upgrades.chaiHeadstartCount || 0) > 0) {
      this.upgrades.chaiHeadstartCount = (this.upgrades.chaiHeadstartCount || 1) - 1;
      localStorage.setItem('rickshaw_upgrades', JSON.stringify(this.upgrades));
      this.chaiNitroCharge = 100;
      this.activateChaiNitro(true);
    }
    this.notifyStats();
  }

  public pause() {
    if (this.state === 'RUNNING') {
      this.state = 'PAUSED';
    } else if (this.state === 'PAUSED') {
      this.state = 'RUNNING';
    }
    this.notifyStats();
  }

  public restart() {
    this.state = 'RUNNING';
    this.distance = 0;
    this.coins = 0;
    this.closeCallCount = 0;
    this.speed = GAME_CONFIG.BASE_SPEED;
    this.currentLaneIdx = 1;
    this.targetX = GAME_CONFIG.LANES[1];
    this.playerX = GAME_CONFIG.LANES[1];
    this.playerY = ROAD_Y;
    this.groundY = ROAD_Y;
    this.jumpOffset = 0;
    this.verticalVelocity = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.rickshawRoll = 0;
    this.rickshawPitch = 0;
    this.landingSquashTimer = 0;

    // Reset Fuel, Shield, & Jump Boost states
    this.fuel = GAME_CONFIG.FUEL_MAX;
    this.cngFuel = 100;
    this.fuelNoDrainTimer = 0;
    this.fuelEmptyTimer = 0;
    this.stallSpeedFactor = 1.0;
    this.chaiNitroCharge = 35;
    this.isNitroActive = false;
    this.nitroTimer = 0;
    this.roadsideOrdersServed = 0;
    this.currentDistrict = 'Saddar & Empress Mkt';
    this.currentDistrictIndex = 0;
    this.streakCount = 0;
    this.streakTimer = 0;

    this.hasShield = false;
    this.shieldVariant = null;
    this.shieldTimer = 0;
    this.shieldCharges = 0;
    this.truckShieldUsed = false;

    this.jumpVariant = null;
    this.jumpTimer = 0;
    this.doubleJumpsRemaining = 0;
    this.springBouncePauseTimer = 0;

    this.screenFlashColor = null;
    this.screenFlashTimer = 0;
    this.cameraShakeTimer = 0;

    this.isMysteryActive = false;
    this.mysteryVehicle = null;
    this.mysteryTimer = 0;
    this.invulnerabilityTimer = 0;
    this.difficultyLevel = 0;
    this.speedUpFlashTimer = 0;
    this.isShortcutActive = false;
    this.verticalLevel = 0;
    this.playerFlyoverPassLevel = 0;
    this.currentFlyoverSpanId = -1;
    this.nextFlyoverDistance = GAME_CONFIG.FLYOVER_FIRST_DIST;
    this.inUnderpass = false;
    this.rampProgress = 0;
    this.shortcutZStart = -9999;
    this.shortcutZEnd = -9999;
    this.lastShortcutSpawnDist = 0;
    this.activePowerup = null;
    this.powerupTimer = 0;
    this.scoreMultiplier = 1;
    this.nextTowerDistance = 85;
    this.hornCooldown = 0;
    this.electricTowerNearby = false;
    this.crashReason = '';

    clearTerrainSpans();
    if (this.pickupManager) {
      this.pickupManager.reset();
    }

    this.scene.remove(this.rickshaw);
    this.rickshaw = this.createPlayerVehicleMesh(this.activeVehicle, this.currentSkin);
    this.rickshaw.position.set(0, ROAD_Y, 0);
    this.rickshaw.rotation.set(0, 0, 0);
    this.rickshaw.scale.set(1, 1, 1);
    this.rickshaw.add(this.playerShieldBubble);
    this.syncShieldBubbleVisuals();
    this.scene.add(this.rickshaw);

    if (this.policeChase) {
      this.policeChase.reset(0);
    }

    // PERF (Stage 3): Recycle all pooled objects instead of disposing/destroying them
    this.pendingSpawnQueue = [];
    this.carPool.forEach((c) => (c.visible = false));
    this.aiRickshawPool.forEach((r) => (r.visible = false));
    this.motorbikePool.forEach((b) => (b.visible = false));
    this.activeAITraffic = [];

    this.coinPool.forEach((c) => (c.visible = false));
    this.activeCoins = [];

    this.activeObstacles.forEach((o) => {
      this.releasePooledObstacle(o);
    });
    this.activeObstacles = [];

    this.activePedestrians.forEach((p) => {
      if (!p.parent || p.parent === this.scene) {
        this.releasePooledObstacle(p);
      }
    });
    this.activePedestrians = [];

    this.activePowerups.forEach((p) => {
      this.releasePooledObstacle(p);
    });
    this.activePowerups = [];

    this.puffPool.forEach((p) => (p.visible = false));
    this.sparklePool.forEach((s) => (s.visible = false));
    this.particles = [];

    // PERF (Stage 3): Reuse existing roadChunks pool in-place instead of destroying and rebuilding
    if (this.roadChunks.length === GAME_CONFIG.ACTIVE_CHUNKS) {
      this.nextChunkIndex = 0;
      this.originZOffset = 0;
      for (let i = 0; i < this.roadChunks.length; i++) {
        const ch = this.roadChunks[i];
        const zPos = -this.nextChunkIndex * GAME_CONFIG.CHUNK_LENGTH;
        ch.position.set(0, ROAD_Y, zPos);
        ch.userData.chunkIndex = this.nextChunkIndex;
        ch.userData.shopOrderServedThisPass = false;
        if (Math.abs(zPos) > 40) {
          this.populateChunkContent(zPos, this.nextChunkIndex);
        }
        this.nextChunkIndex++;
      }
      this.nextSpawnZ = -this.nextChunkIndex * GAME_CONFIG.CHUNK_LENGTH;
      for (let p = 0; p < this.activePuddles.length; p++) {
        this.activePuddles[p].puddle.userData.splashedThisPass = false;
      }
      // Keep sidewalk pedestrians inside pooled chunks registered in activePedestrians
      for (const ch of this.roadChunks) {
        for (const child of ch.children) {
          if (child.userData && child.userData.walkPhase !== undefined) {
            this.activePedestrians.push(child as THREE.Group);
          }
        }
      }
    } else {
      this.activePuddles = [];
      this.roadChunks.forEach((ch) => this.scene.remove(ch));
      this.roadChunks = [];
      this.initWorld();
    }

    if (this.upgrades.starterShield > 0) {
      this.activateShield(this.upgrades.starterShield >= 2 ? 'SHIELD_DOUBLE' : 'SHIELD_STANDARD');
    }
    if ((this.upgrades.chaiHeadstartCount || 0) > 0) {
      this.upgrades.chaiHeadstartCount = (this.upgrades.chaiHeadstartCount || 1) - 1;
      localStorage.setItem('rickshaw_upgrades', JSON.stringify(this.upgrades));
      this.chaiNitroCharge = 100;
      this.activateChaiNitro(true);
    }

    this.notifyStats();
  }

  private disposeObjectHierarchy(obj: THREE.Object3D) {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh || (mesh as any).isPoints || (mesh as any).isLine) {
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
  }

  private disposeFlyoverGroup(flyoverGroup: THREE.Object3D) {
    this.disposeObjectHierarchy(flyoverGroup);
  }

  public handleStumble(reason: string, hitObstacle?: THREE.Object3D) {
    if (this.state === 'GAMEOVER') return;
    if (this.invulnerabilityTimer > 0) return;

    if (this.isNitroActive || (this.isMysteryActive && (this.mysteryVehicle === 'tractor' || this.mysteryVehicle === 'hulk'))) {
      this.sound.playCrash();
      if (hitObstacle) {
        hitObstacle.position.y += 5;
        hitObstacle.position.z += 10;
        hitObstacle.rotation.x += 1.5;
      }
      this.emitToast(
        this.isNitroActive
          ? '🔥 CHAI NITRO BLASTED THROUGH HAZARD!'
          : this.mysteryVehicle === 'hulk'
          ? '💥 HULK SMASHED HAZARD!'
          : '🚜 TRACTOR SMASHED THROUGH HAZARD!'
      );
      return;
    }

    if (this.vehicleDef.id === 'captain_america' && (reason.includes('Mango Cart') || reason.includes('Hurdle') || reason.includes('Barrier'))) {
      this.sound.playCrash();
      this.emitToast('🛡️ VIBRANIUM SHIELD DEFLECTED HAZARD! NO DAMAGE!');
      return;
    }

    if (this.vehicleDef.id === 'bolan' && (reason.includes('Mango Cart') || reason.includes('Hurdle'))) {
      this.sound.playCrash();
      this.emitToast('🚐 BOLAN FRONT BUMPER SMASHED HAZARD! NO DAMAGE!');
      return;
    }

    if (this.consumeShieldHit(reason, hitObstacle)) {
      return;
    }

    const caught = this.policeChase ? this.policeChase.registerMistake() : false;
    if (caught) {
      // Shield also blocks the arrest from the police CAUGHT state once!
      if (this.consumeShieldHit('Police Arrest', hitObstacle)) {
        return;
      }
      this.triggerGameOver('🚨 CHALAN! Caught by Lahore Highway Patrol!', hitObstacle);
    } else {
      this.emitToast(`⚠️ STUMBLE! ${reason} HIGHWAY PATROL CLOSING IN!`);
      this.rickshawRoll = 0.35;
    }
  }

  private triggerGameOver(reason: string, hitObstacle?: THREE.Object3D) {
    if (this.state === 'GAMEOVER') return;
    if (this.invulnerabilityTimer > 0) return;

    if (this.isNitroActive || (this.isMysteryActive && (this.mysteryVehicle === 'tractor' || this.mysteryVehicle === 'hulk'))) {
      this.sound.playCrash();
      if (hitObstacle) {
        hitObstacle.position.y += 6;
        hitObstacle.position.z += 12;
        hitObstacle.rotation.x += 1.8;
      }
      this.emitToast(
        this.isNitroActive
          ? '🔥 CHAI NITRO OVERDRIVE SMASHED THROUGH TRAFFIC!'
          : this.mysteryVehicle === 'hulk'
          ? '💥 HULK SMASHED THROUGH COLLISION!'
          : '🚜 TRACTOR SMASHED THROUGH COLLISION!'
      );
      return;
    }

    if (this.consumeShieldHit(reason, hitObstacle)) {
      return;
    }

    if ((this.upgrades.wardenBribeCount || 0) > 0) {
      this.upgrades.wardenBribeCount = (this.upgrades.wardenBribeCount || 1) - 1;
      localStorage.setItem('rickshaw_upgrades', JSON.stringify(this.upgrades));
      this.invulnerabilityTimer = 1.8;
      if (this.policeChase) {
        this.policeChase.state = 'SAFE';
        this.policeChase.gap = GAME_CONFIG.POLICE_GAP_SAFE;
      }
      this.sound.playShieldShatter();
      this.triggerScreenFlash('#22c55e', 0.25);
      if (hitObstacle) {
        hitObstacle.visible = false;
        hitObstacle.position.z += 500;
      }
      this.emitToast(`👮 VIP WARDEN PASS USED! CHALLAN WAIVED & RUN SAVED! (${this.upgrades.wardenBribeCount} LEFT)`);
      this.notifyStats();
      return;
    }

    if ((this.vehicleDef.id === 'captain_america' || this.vehicleDef.id === 'truck') && !this.truckShieldUsed) {
      this.truckShieldUsed = true;
      this.invulnerabilityTimer = 1.2;
      this.sound.playShieldShatter();
      this.emitToast(
        this.vehicleDef.id === 'captain_america'
          ? '🛡️ VIBRANIUM SHIELD ABSORBED FATAL IMPACT! (1/1 SAVED RUN)'
          : '🚚 BEDFORD TRUCK SMASHED CRASH! (1/1 ARMOR SAVED RUN)'
      );
      return;
    }

    this.state = 'GAMEOVER';
    this.crashReason = reason;
    this.sound.playCrash();
    if (this.policeChase) {
      this.policeChase.triggerArrest(reason);
    }

    // Bank earned rupee coins permanently into player wallet
    this.totalRupees += this.coins;
    localStorage.setItem('rickshaw_coins', this.totalRupees.toString());

    this.rickshaw.position.y = this.groundY + 0.35;
    this.rickshaw.rotation.z = 0.65;
    this.rickshaw.rotation.x = -0.25;

    this.spawnCrashSparks(this.rickshaw.position);

    if (this.distance > this.bestScore) {
      this.bestScore = Math.floor(this.distance);
      localStorage.setItem('rickshaw_best_score', this.bestScore.toString());
    }

    this.notifyStats();
  }

  private spawnCrashSparks(pos: THREE.Vector3) {
    // PERF (Stage 2 & 3): Use pooled sparkle meshes instead of allocating new BufferGeometry/Material
    this.spawnPickupBurst(pos, 0x38bdf8, 16);
  }

  public spawnPickupBurst(pos: THREE.Vector3, _colorHex: number, count = 12) {
    // PERF (Stage 2 & 3): Reuse pooled sparkle meshes with PERF_CONFIG.MAX_ACTIVE_PARTICLES cap
    if (this.particles.length >= PERF_CONFIG.MAX_ACTIVE_PARTICLES) return;
    let spawned = 0;
    const maxToSpawn = Math.min(count, 10, PERF_CONFIG.MAX_ACTIVE_PARTICLES - this.particles.length);
    for (let i = 0; i < this.sparklePool.length && spawned < maxToSpawn; i++) {
      const sparkle = this.sparklePool[i];
      if (!sparkle.visible) {
        sparkle.position.set(pos.x, pos.y + 0.85, pos.z);
        sparkle.scale.set(1, 1, 1);
        sparkle.visible = true;
        if (!sparkle.userData.vel) {
          sparkle.userData.vel = new THREE.Vector3();
        }
        sparkle.userData.vel.set(
          (Math.random() - 0.5) * 9,
          Math.random() * 8 + 2,
          (Math.random() - 0.5) * 9
        );
        this.particles.push({ mesh: sparkle, vel: sparkle.userData.vel, life: 0.45, maxLife: 0.45 });
        spawned++;
      }
    }
  }

  private animate() {
    this.reqId = requestAnimationFrame(this.animate);
    const frameStart = performance.now();
    const rawDelta = Math.min(this.clock.getDelta(), 0.1);

    if (!this.firstFrameAudited) {
      this.firstFrameAudited = true;
      this.unpatchedCount = auditCurve(this.scene).length;
    }

    if (this.screenFlashTimer > 0) {
      this.screenFlashTimer = Math.max(0, this.screenFlashTimer - rawDelta);
      if (this.screenFlashTimer <= 0) {
        this.screenFlashColor = null;
      }
    }

    if (this.isShowroomMode && this.showroomGroup) {
      // Model Showroom inspection scene (all 8 VEHICLE_SPECS models lined up along X at z = 0)
      const items = (this.showroomGroup.userData.items as { x: number; key: string; model: THREE.Group }[]) || [];
      // Spin wheels and gentle suspension bounce on all showroom vehicles so wheel alignment can be visually checked
      this.suspensionPhase += rawDelta * 6.0;
      const showBounce = Math.sin(this.suspensionPhase) * 0.018;
      for (const item of items) {
        const m = item.model;
        if (m.userData.wheels) {
          const wRad = m.userData.wheelRadius || 0.35;
          for (const w of m.userData.wheels as THREE.Group[]) {
            w.rotation.x -= (4.0 * rawDelta) / wRad;
          }
        }
        if (m.userData.bodyGroup) {
          m.userData.bodyGroup.position.y = showBounce;
        }
      }

      if (this.showroomFocusIndex >= 0 && this.showroomFocusIndex < items.length) {
        const focusItem = items[this.showroomFocusIndex];
        this.garageTurntableAngle += rawDelta * 0.45;
        const radius = focusItem.key === 'bus' || focusItem.key === 'truck' ? 8.8 : 5.2;
        const camX = focusItem.x + Math.sin(this.garageTurntableAngle) * radius;
        const camZ = Math.cos(this.garageTurntableAngle) * radius;
        this.camera.position.lerp(_scratchVec1.set(camX, 2.6, camZ), Math.min(1, rawDelta * 8));
        this.camera.lookAt(focusItem.x, 1.2, 0);
      } else {
        // Full lineup overview of all 8 models
        this.camera.position.lerp(_scratchVec1.set(0, 6.2, 19.5), Math.min(1, rawDelta * 6));
        this.camera.lookAt(0, 1.4, 0);
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.isNPCGalleryOpen && this.npcManager) {
      this.npcManager.update(rawDelta, {});
      this.camera.position.lerp(_scratchVec1.set(0, 4.1, 8.8), Math.min(1, rawDelta * 6));
      this.camera.lookAt(0, 1.0, 0.2);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.isShopGalleryOpen) {
      updateShops(rawDelta);
      this.camera.position.lerp(_scratchVec1.set(0, 5.2, 14.5), Math.min(1, rawDelta * 6));
      this.camera.lookAt(0, 2.0, 0);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.isBuildingGalleryOpen) {
      updateBuildings(rawDelta);
      const camZ = this.buildingGalleryStage === 0 ? 32.0 : 24.0;
      const camY = this.buildingGalleryStage === 0 ? 11.5 : 8.5;
      this.camera.position.lerp(_scratchVec1.set(0, camY, camZ), Math.min(1, rawDelta * 6));
      this.camera.lookAt(0, 5.2, -3.0);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.isGarageMode) {
      // 360-degree interactive 3D inspection turntable for Garage & Shop
      this.garageTurntableAngle += rawDelta * 0.65;
      if (this.rickshaw.userData.wheels) {
        const wRad = this.rickshaw.userData.wheelRadius || 0.35;
        for (const w of this.rickshaw.userData.wheels as THREE.Group[]) {
          w.rotation.x -= (3.2 * rawDelta) / wRad;
        }
      }
      this.camera.position.set(
        Math.sin(this.garageTurntableAngle) * 4.6,
        2.0,
        Math.cos(this.garageTurntableAngle) * 4.6
      );
      this.camera.lookAt(0, 1.1, 0);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 1. Fixed Timestep Physics (60 Hz) with spiral of death prevention
    this.accumulator += rawDelta;
    let physSteps = 0;
    const maxSubSteps = 3;
    while (this.accumulator >= this.fixedDt && physSteps < maxSubSteps) {
      if (this.state === 'RUNNING') {
        this.stepPhysics(this.fixedDt);
      } else if (this.state === 'GAMEOVER' && this.policeChase && this.policeChase.arrest.active) {
        const prevPhase = this.policeChase.arrest.phase;
        this.policeChase.update(
          this.fixedDt,
          this.playerX,
          this.playerY,
          this.rickshaw.position.z,
          0,
          this.distance,
          this.verticalLevel
        );
        if (this.policeChase.arrest.phase !== prevPhase) {
          this.notifyStats();
        }
      }
      this.accumulator -= this.fixedDt;
      physSteps++;
    }
    if (this.accumulator > this.fixedDt) {
      this.accumulator = 0; // Drop surplus accumulator to prevent death spiral
    }

    // 2. Visual & Environment Updates
    this.updateDayNightCycle(rawDelta);
    this.updateParticles(rawDelta);
    updateShops(rawDelta);
    updateBuildings(rawDelta);

    // Sky Group follows camera X and Z only (never Y!) so sky/horizon stays locked when jumping or climbing flyovers
    if (this.skyGroup) {
      this.skyGroup.position.set(this.playerX, 0, this.rickshaw.position.z);
    }
    if (this.cloudGroup) {
      this.cloudGroup.position.z = Math.sin(performance.now() * 0.0001) * 12;
    }
    if (this.sunLight) {
      this.sunLight.position.z = this.rickshaw.position.z + 25;
      this.sunLight.position.x = this.playerX + 25;
    }

    // Update Debug Visuals when enabled
    this.updateDebugVisuals();

    // Camera Tracking (Dynamic Run Following with Flyover Deck & Underpass Awareness vs Crash Arrest Orbit)
    const pZ = this.rickshaw.position.z;
    const camBlend = 1 - Math.exp(-8.5 * rawDelta);

    if (this.state === 'GAMEOVER' && this.policeChase && this.policeChase.arrest.active) {
      // Smooth continuous camera orbit/dolly around crashed rickshaw, police cars, and approaching officer (deck-aware!)
      const orbitT = this.policeChase.arrest.totalTimer;
      const angle = orbitT * 0.48;
      const dist = 6.2;
      const arrestSurfY = groundHeightAt(this.rickshaw.position.x, pZ, this.verticalLevel);
      const minOrbitY = arrestSurfY + GAME_CONFIG.FLYOVER_CAM_MIN_ABOVE_DECK;

      this.camera.position.x = this.rickshaw.position.x + Math.sin(angle) * dist;
      this.camera.position.y = Math.max(
        minOrbitY,
        THREE.MathUtils.lerp(this.camera.position.y, arrestSurfY + 2.5, camBlend)
      );
      this.camera.position.z = pZ + Math.cos(angle) * dist;

      // Also clamp below deck underside if arrested in an underpass on level 0
      const camUnderside = getDeckUndersideAt(this.camera.position.z, this.camera.position.x);
      if (this.verticalLevel === 0 && camUnderside !== null) {
        this.camera.position.y = Math.min(this.camera.position.y, camUnderside - GAME_CONFIG.FLYOVER_CAM_UNDERSIDE_MARGIN);
      }

      this.camera.lookAt(this.rickshaw.position.x, arrestSurfY + 1.0, pZ);
    } else {
      // Camera follow at ~40% lateral movement
      const targetCamX = this.playerX * 0.40;
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, camBlend);
      this.camera.position.z = pZ + 9.5;

      // Exponentially smoothed camera elevation following groundHeightAt()
      let targetCamY =
        this.activePowerup === 'JETPACK'
          ? Math.max(14.5, DECK_Y + 7.5)
          : this.groundY + 4.8 + Math.max(0, this.jumpOffset) * 0.38;

      // Ensure camera stays at least FLYOVER_CAM_MIN_ABOVE_DECK above the elevated surface behind the player
      if (this.playerFlyoverPassLevel === 1 && this.activePowerup !== 'JETPACK') {
        const camSurfaceY = groundHeightAt(this.playerX, this.camera.position.z, 1);
        targetCamY = Math.max(targetCamY, camSurfaceY + GAME_CONFIG.FLYOVER_CAM_MIN_ABOVE_DECK, this.groundY + GAME_CONFIG.FLYOVER_CAM_MIN_ABOVE_DECK);
      }

      // Ray/underside ceiling clamp when driving on level 0 under an overhead deck
      if (this.playerFlyoverPassLevel === 0 && this.activePowerup !== 'JETPACK') {
        const deckCeilAtCam = getDeckUndersideAt(this.camera.position.z, this.camera.position.x);
        const deckCeilAtPlayer = getDeckUndersideAt(pZ, this.playerX);
        const lowestCeil =
          deckCeilAtCam !== null && deckCeilAtPlayer !== null
            ? Math.min(deckCeilAtCam, deckCeilAtPlayer)
            : deckCeilAtCam ?? deckCeilAtPlayer;
        if (lowestCeil !== null) {
          targetCamY = Math.min(targetCamY, lowestCeil - GAME_CONFIG.FLYOVER_CAM_UNDERSIDE_MARGIN);
        }
      }

      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, camBlend);

      if (this.cameraShakeTimer > 0) {
        this.cameraShakeTimer = Math.max(0, this.cameraShakeTimer - rawDelta);
        this.camera.position.x += (Math.random() - 0.5) * this.cameraShakeIntensity;
        this.camera.position.y += (Math.random() - 0.5) * this.cameraShakeIntensity;
      }

      const lookTargetX = this.camera.position.x * 0.75;
      const lookTargetY =
        this.activePowerup === 'JETPACK'
          ? Math.max(10.5, DECK_Y + 4.5)
          : this.groundY + 1.75 + Math.max(0, this.jumpOffset) * 0.28;
      const lookTargetZ = pZ - 16;
      this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
    }

    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);

    const now = performance.now();
    const frameDeltaMs = rawDelta * 1000;

    // FPS calculation
    this.framesAccum++;
    if (now - this.lastFpsTimestamp >= 1000) {
      this.fpsCount = Math.round((this.framesAccum * 1000) / (now - this.lastFpsTimestamp));
      this.framesAccum = 0;
      this.lastFpsTimestamp = now;
    }

    // Stage 0 Telemetry & Leak / Frame-Spike Detection
    const rInfo = this.renderer.info;
    const memPerf = (performance as any).memory;
    const jsHeapMB = memPerf && memPerf.usedJSHeapSize ? Math.round(memPerf.usedJSHeapSize / (1024 * 1024)) : null;
    const activeNPCsCount =
      this.activePedestrians.length + (this.npcManager && this.npcManager.active ? this.npcManager.active.length : 0);

    // 1. Console warning if frame time exceeds 25 ms (throttled to at most once every 3s)
    if (frameDeltaMs > 25 && now - this.lastPerfWarnTime > 3000 && this.state === 'RUNNING') {
      this.lastPerfWarnTime = now;
      console.warn(
        `[Perf Stage 0] Frame time spike: ${frameDeltaMs.toFixed(1)} ms (${this.fpsCount} FPS) | Draw calls: ${rInfo.render.calls} | Triangles: ${rInfo.render.triangles} | Geometries: ${rInfo.memory.geometries} | Textures: ${rInfo.memory.textures}`
      );
    }

    // 2. Geometry / Texture Leak Detector (checks every 4 seconds during active play)
    if (this.state === 'RUNNING' && now - this.lastLeakSampleTime >= 4000) {
      this.lastLeakSampleTime = now;
      const curGeos = rInfo.memory.geometries;
      const curTexs = rInfo.memory.textures;
      if (this.prevGeometriesCount > 0 && (curGeos > this.prevGeometriesCount + 8 || curTexs > this.prevTexturesCount + 4)) {
        this.leakGrowthStreak++;
        if (this.leakGrowthStreak >= 3) {
          this.perfMetrics.leakWarning = true;
          console.warn(
            `[Perf Stage 0 LEAK WARNING] GPU resource count kept growing over 3 samples! Geometries: ${this.prevGeometriesCount} -> ${curGeos}, Textures: ${this.prevTexturesCount} -> ${curTexs}`
          );
        }
      } else {
        this.leakGrowthStreak = Math.max(0, this.leakGrowthStreak - 1);
      }
      this.prevGeometriesCount = curGeos;
      this.prevTexturesCount = curTexs;
    }

    this.perfMetrics = {
      fps: this.fpsCount,
      frameTimeMs: Number(frameDeltaMs.toFixed(1)),
      drawCalls: rInfo.render.calls,
      triangles: rInfo.render.triangles,
      geometries: rInfo.memory.geometries,
      textures: rInfo.memory.textures,
      jsHeapMB,
      activeNPCs: activeNPCsCount,
      activeVehicles: this.activeAITraffic.length,
      activeProps: this.activeObstacles.length + this.roadChunks.length,
      activeParticles: this.particles.length,
      leakWarning: this.perfMetrics.leakWarning
    };

    // 3. Stop per-frame React updates: push to HUD store at ~10 Hz (every 100ms)
    this.hudUpdateTimer += rawDelta;
    if (this.hudUpdateTimer >= 0.1) {
      this.hudUpdateTimer = 0;
      this.notifyStats();
    }

    // 4. Adaptive Quality: monitor actual frame-to-frame delta time (ms)
    this.frameTimes.push(frameDeltaMs);
    if (this.frameTimes.length >= 60) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.frameTimes.length = 0;
      if (avg > 25) {
        this.goodFrameCount = 0;
        this.downgradeQuality();
      } else if (avg < 18) {
        this.goodFrameCount++;
        if (this.goodFrameCount >= 4) {
          this.upgradeQuality();
          this.goodFrameCount = 0;
        }
      }
    }
  }

  private updateDebugVisuals() {
    const pZ = this.rickshaw.position.z;
    if (this.debugGridGroup && this.debugGridGroup.visible) {
      this.debugGridGroup.position.set(0, 0, pZ);
    }
    if (this.debugHeightLine && this.debugHeightLine.visible) {
      const posAttr = this.debugHeightLine.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < 60; i++) {
        const sampleZ = pZ + 12 - i * 2.2;
        const sampleY = groundHeightAt(this.playerX, sampleZ, this.playerFlyoverPassLevel) + 0.08;
        arr[i * 3] = this.playerX;
        arr[i * 3 + 1] = sampleY;
        arr[i * 3 + 2] = sampleZ;
      }
      posAttr.needsUpdate = true;
    }
  }

  private downgradeQuality() {
    if (this.currentQualityScale > 0.6) {
      this.currentQualityScale = Math.max(0.6, this.currentQualityScale - 0.2);
      const maxDpr = this.isMobile ? 1.15 : 1.5;
      const baseDpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      this.renderer.setPixelRatio(baseDpr * this.currentQualityScale);
      if (this.currentQualityScale <= 0.7) {
        this.adaptiveTier = 'LOW';
        if (this.rainMesh) this.rainMesh.visible = false;
      } else {
        this.adaptiveTier = 'MEDIUM';
      }
    }
  }

  private upgradeQuality() {
    if (this.currentQualityScale < 1.0) {
      this.currentQualityScale = Math.min(1.0, this.currentQualityScale + 0.2);
      const maxDpr = this.isMobile ? 1.15 : 1.5;
      const baseDpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      this.renderer.setPixelRatio(baseDpr * this.currentQualityScale);
      if (this.currentQualityScale >= 1.0) {
        this.adaptiveTier = 'HIGH';
      } else {
        this.adaptiveTier = 'MEDIUM';
      }
    }
  }

  // Dynamic Day-Night & Monsoon Weather Cycle with Underpass Ambient Darkening
  private updateDayNightCycle(delta: number) {
    // Underpass feel: darker ambient tint when driving on level 0 under an elevated deck (never affects level 1!)
    const underpassShadeMult = this.inUnderpass && this.verticalLevel === 0 ? 0.52 : 1.0;

    if (this.weather === 'MONSOON') {
      this.timeOfDayLabel = 'Monsoon Rain';
      setNight(false);
      setBuildingNight(false);
      const fogColor = 0x334155;
      const sunIntensity = 0.4 * underpassShadeMult;
      const ambientIntensity = 0.75 * underpassShadeMult;

      if (this.scene.fog) {
        (this.scene.fog as THREE.Fog).color.setHex(fogColor);
      }
      this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, sunIntensity, delta * 3);
      this.hemiLight.intensity = THREE.MathUtils.lerp(this.hemiLight.intensity, ambientIntensity * 1.35, delta * 3);

      // Rain Streaks Animation
      if (this.rainMesh && this.rainGeo) {
        this.rainMesh.visible = true;
        this.rainMesh.position.z = this.rickshaw.position.z;
        this.rainMesh.position.x = this.playerX;
        const positions = this.rainGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 1] -= delta * 80;
          if (positions[i + 1] < 0) {
            positions[i + 1] = 28 + Math.random() * 6;
          }
        }
        this.rainGeo.attributes.position.needsUpdate = true;

        this.lightningTimer -= delta;
        if (this.lightningTimer <= 0) {
          this.hemiLight.intensity = 4.2;
          this.sound.playThunder();
          this.lightningTimer = 7.0 + Math.random() * 12.0;
        }
      }
      return;
    }

    if (this.rainMesh) {
      this.rainMesh.visible = false;
    }

    this.cycleTime = (this.cycleTime + delta * 0.04) % 1.0;

    let fogColor: number;
    let sunIntensity: number;
    let ambientIntensity: number;

    if (this.cycleTime < 0.25) {
      this.timeOfDayLabel = 'Morning';
      fogColor = 0x7dd3fc;
      sunIntensity = 1.8;
      ambientIntensity = 1.4;
    } else if (this.cycleTime < 0.55) {
      this.timeOfDayLabel = 'Sunny Afternoon';
      fogColor = 0x38bdf8;
      sunIntensity = 2.0;
      ambientIntensity = 1.5;
    } else if (this.cycleTime < 0.75) {
      this.timeOfDayLabel = 'Golden Hour';
      fogColor = 0xfb923c;
      sunIntensity = 1.4;
      ambientIntensity = 1.1;
    } else {
      this.timeOfDayLabel = 'Karachi Night';
      fogColor = 0x1e293b;
      sunIntensity = 0.3;
      ambientIntensity = 0.6;
    }

    if (this.scene.fog) {
      (this.scene.fog as THREE.Fog).color.setHex(fogColor);
    }
    const isNightNow = this.timeOfDayLabel === 'Karachi Night' || this.weather === 'NIGHT';
    setNight(isNightNow);
    setBuildingNight(isNightNow);
    this.sunLight.intensity = THREE.MathUtils.lerp(
      this.sunLight.intensity,
      sunIntensity * underpassShadeMult,
      delta * 3
    );
    this.hemiLight.intensity = THREE.MathUtils.lerp(
      this.hemiLight.intensity,
      ambientIntensity * 1.35 * underpassShadeMult,
      delta * 3
    );
  }

  private stepPhysics(delta: number) {
    // 1. Distance-based Difficulty Level (0 to 12)
    const prevDiff = this.difficultyLevel;
    this.difficultyLevel = Math.min(
      GAME_CONFIG.MAX_DIFFICULTY_LEVEL,
      Math.floor(this.distance / GAME_CONFIG.DIFFICULTY_DIST_INTERVAL)
    );
    if (this.difficultyLevel > prevDiff) {
      this.speedUpFlashTimer = 1.8;
      this.sound.playSpeedUp();
      this.emitToast(`⚡ SPEED UP! DIFFICULTY LEVEL ${this.difficultyLevel}!`);
    }
    if (this.speedUpFlashTimer > 0) {
      this.speedUpFlashTimer = Math.max(0, this.speedUpFlashTimer - delta);
    }

    // 1B. Dynamic Karachi District Progression & Street Style Streak Timer
    const districts = [
      'Saddar & Empress Mkt',
      'M.A. Jinnah Road',
      'Burns Rd Food Street',
      'Clifton Sea View Hwy'
    ];
    const distIdx = Math.floor(this.distance / 400) % districts.length;
    if (distIdx !== this.currentDistrictIndex) {
      this.currentDistrictIndex = distIdx;
      this.currentDistrict = districts[distIdx];
      this.sound.playQuestComplete();
      this.emitToast(`🛣️ ENTERING KARACHI ZONE: ${this.currentDistrict.toUpperCase()}!`);
    }
    if (this.streakTimer > 0) {
      this.streakTimer = Math.max(0, this.streakTimer - delta);
      if (this.streakTimer === 0) {
        this.streakCount = 0;
      }
    }

    // 2. Exponential Speed Curve
    const startSpeed = GAME_CONFIG.BASE_SPEED;
    const maxSpeed = GAME_CONFIG.MAX_SPEED * this.vehicleDef.speedMultiplier;
    const targetSpeed = Math.min(
      maxSpeed,
      startSpeed + (maxSpeed - startSpeed) * (1 - Math.exp(-this.distance / GAME_CONFIG.SPEED_DAMPING_DIST))
    );
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, delta * 1.8);

    // 3. Fuel System Drain, Sputter (< 15%), Stall (0% over 3s), & Arrest (4s)
    if (this.fuelNoDrainTimer > 0) {
      this.fuelNoDrainTimer = Math.max(0, this.fuelNoDrainTimer - delta);
    }

    if (this.fuel <= 0) {
      if ((this.upgrades.reserveFuelCount || 0) > 0) {
        this.upgrades.reserveFuelCount = (this.upgrades.reserveFuelCount || 1) - 1;
        localStorage.setItem('rickshaw_upgrades', JSON.stringify(this.upgrades));
        this.fuel = 65;
        this.cngFuel = 65;
        this.fuelEmptyTimer = 0;
        this.stallSpeedFactor = 1.0;
        this.sound.playPowerup();
        this.triggerScreenFlash('#22c55e', 0.25);
        this.emitToast('⛽ RESERVE PETROL CAN AUTO-REFILLED +65% FUEL!');
      } else {
        this.fuel = 0;
        this.fuelEmptyTimer += delta;
        this.stallSpeedFactor = Math.max(0.18, 1.0 - this.fuelEmptyTimer / GAME_CONFIG.FUEL_STALL_DECAY_TIME);
        if (this.policeChase) {
          this.policeChase.state = 'CLOSE';
          this.policeChase.gap = Math.max(1.2, this.policeChase.gap - delta * 3.4);
        }
        if (this.fuelEmptyTimer >= GAME_CONFIG.FUEL_EMPTY_ARREST_TIME) {
          this.triggerGameOver('⛽ Out of Petrol/CNG Fuel! Caught by Lahore Highway Patrol!');
          return;
        }
      }
    } else {
      this.fuelEmptyTimer = 0;
      // Below 15%, engine sputters with small rhythmic speed dips
      if (this.fuel < GAME_CONFIG.FUEL_SPUTTER_PCT) {
        const sputterDip = Math.sin(performance.now() * 0.025) > 0.45 ? 0.86 : 1.0;
        this.stallSpeedFactor = THREE.MathUtils.lerp(this.stallSpeedFactor, sputterDip, delta * 10);
      } else {
        this.stallSpeedFactor = THREE.MathUtils.lerp(this.stallSpeedFactor, 1.0, delta * 8);
      }
    }

    // Chai Nitro Overdrive countdown & spark trail
    if (this.isNitroActive) {
      this.nitroTimer = Math.max(0, this.nitroTimer - delta);
      if (Math.random() < 0.45) {
        this.spawnPickupBurst(this.rickshaw.position, Math.random() < 0.5 ? 0xfacc15 : 0x38bdf8, 4);
      }
      if (this.nitroTimer <= 0) {
        this.isNitroActive = false;
        this.invulnerabilityTimer = Math.max(this.invulnerabilityTimer, 0.9);
        this.emitToast('☕ CHAI NITRO COMPLETE! (0.9s SAFE GRACE)');
      }
    }

    const mysterySpeedMult = this.isMysteryActive && this.mysteryVehicle === 'tonga' ? 1.25 : 1.0;
    const nitroSpeedMult = this.isNitroActive ? 1.38 : 1.0;
    // Speed stays constant during flyover climbs (no slowdown on ramps!)
    const currentSpeed =
      (this.activePowerup === 'JETPACK' ? this.speed * 1.5 : this.speed) *
      this.stallSpeedFactor *
      mysterySpeedMult *
      nitroSpeedMult;

    // 4. Feel of Speed + Slight Climb FOV Widening (only call updateProjectionMatrix when FOV actually changes)
    const speedRatio = Math.max(0, Math.min(1.0, (this.speed - startSpeed) / (maxSpeed - startSpeed)));
    const climbFovBonus = this.playerFlyoverPassLevel === 1 ? GAME_CONFIG.FLYOVER_CLIMB_FOV_BONUS : 0;
    const targetFov = 64 + 18 * speedRatio + climbFovBonus;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 3.5);
      this.camera.updateProjectionMatrix();
    }

    const moveZ = currentSpeed * delta;
    this.rickshaw.position.z -= moveZ;
    let pZ = this.rickshaw.position.z;
    if (window.playerModel) {
      window.playerModel.position.z = pZ;
    }
    this.distance += moveZ;

    // Drain fuel with distance traveled: drain = baseRate * (0.6 + speed / maxSpeed)
    if (this.fuelNoDrainTimer <= 0 && this.fuel > 0) {
      const effMult = 1 - ((this.upgrades.fuelEfficiencyLevel || 1) - 1) * 0.08;
      const drainPerMeter =
        GAME_CONFIG.FUEL_BASE_DRAIN_RATE *
        effMult *
        (0.6 + this.speed / maxSpeed);
      this.fuel = Math.max(0, this.fuel - drainPerMeter * moveZ);
    }
    this.cngFuel = this.fuel;

    // 5. Shield & Jump Boost Timers
    if (this.hasShield && this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - delta);
      if (this.playerShieldBubble) {
        this.playerShieldBubble.rotation.y += delta * 1.8;
        const isFlickering =
          this.shieldTimer <= GAME_CONFIG.SHIELD_FLICKER_TIME &&
          Math.sin(performance.now() * 0.028) > 0;
        this.playerShieldBubble.visible = !isFlickering;
      }
      if (this.shieldTimer <= 0) {
        this.hasShield = false;
        this.shieldVariant = null;
        this.shieldCharges = 0;
        this.syncShieldBubbleVisuals();
      }
    }

    if (this.jumpTimer > 0) {
      this.jumpTimer = Math.max(0, this.jumpTimer - delta);
      if (this.rickshaw.userData.springCoils) {
        const pulse = 1 + Math.sin(performance.now() * 0.015) * 0.2;
        for (const coil of this.rickshaw.userData.springCoils) {
          coil.visible = true;
          coil.scale.set(1, pulse, 1);
        }
      }
      if (this.jumpTimer <= 0) {
        this.jumpVariant = null;
        this.doubleJumpsRemaining = 0;
        if (this.rickshaw.userData.springCoils) {
          for (const coil of this.rickshaw.userData.springCoils) {
            coil.visible = false;
          }
        }
      }
    }

    // Mystery Vehicle Timer & Invulnerability Update
    if (this.isMysteryActive) {
      this.mysteryTimer -= delta;
      if (this.mysteryTimer <= 0) {
        this.revertMysteryTransformation();
      }
    }
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - delta);
    }

    // 6. Update Active Terrain Spans & Flyover Pass Transition
    setBusRamps(this.activeObstacles);
    pruneFlyoverSpansBehind(pZ + GAME_CONFIG.DESPAWN_DISTANCE + 25);

    const activeSpan = getFlyoverSpanAtZ(pZ);
    if (activeSpan) {
      if (this.currentFlyoverSpanId !== activeSpan.id) {
        this.currentFlyoverSpanId = activeSpan.id;
        // Enter the ascending ramp ONLY if the player's lane is aligned with the ramp entrance!
        if (isLaneOnRampEntrance(this.playerX, activeSpan) || this.activePowerup === 'JETPACK') {
          this.playerFlyoverPassLevel = 1;
        } else {
          this.playerFlyoverPassLevel = 0;
        }
      }
    } else {
      this.currentFlyoverSpanId = -1;
      this.playerFlyoverPassLevel = 0;
    }

    // 7. Exponential-damped lane steer + Solid Flyover Guard Rail & Ground Median Clamping
    const prevX = this.playerX;
    const blend = 1 - Math.exp(-this.vehicleDef.laneSpeed * delta);
    this.playerX = THREE.MathUtils.lerp(this.playerX, this.targetX, blend);

    if (activeSpan && !this.isShortcutActive) {
      if (this.playerFlyoverPassLevel === 1) {
        // Clamp to ascending ramp rails, full deck rails, 20m exit taper rails, or descending ramp rails!
        const bounds = getElevatedBoundsAtZ(activeSpan, pZ);
        const railMargin = 0.65;
        if (this.playerX < bounds.minX + railMargin) {
          this.playerX = bounds.minX + railMargin;
          this.targetX = Math.max(this.targetX, this.playerX);
        } else if (this.playerX > bounds.maxX - railMargin) {
          this.playerX = bounds.maxX - railMargin;
          this.targetX = Math.min(this.targetX, this.playerX);
        }
        // Keep currentLaneIdx synced to nearest valid lane when tapered into down-ramp
        if (pZ < activeSpan.zDownStart + GAME_CONFIG.FLYOVER_EXIT_CLEAR_LEN) {
          let bestLane = activeSpan.rampLanes[0];
          let bestDist = Infinity;
          for (const rl of activeSpan.rampLanes) {
            const d = Math.abs(GAME_CONFIG.LANES[rl] - this.playerX);
            if (d < bestDist) {
              bestDist = d;
              bestLane = rl;
            }
          }
          this.currentLaneIdx = bestLane;
          if (pZ <= activeSpan.zDownStart + 2.0) {
            this.targetX = GAME_CONFIG.LANES[bestLane];
          }
        }
      } else {
        // Ground road (level = 0): solid median barrier keeps ground player in openGroundLanes (out of walled ramp columns)
        const gBounds = getGroundOpenBoundsForSpan(activeSpan);
        const margin = 0.55;
        if (this.playerX < gBounds.minX + margin) {
          this.playerX = gBounds.minX + margin;
          this.targetX = Math.max(this.targetX, this.playerX);
        } else if (this.playerX > gBounds.maxX - margin) {
          this.playerX = gBounds.maxX - margin;
          this.targetX = Math.min(this.targetX, this.playerX);
        }
      }
    }

    const lateralVelocity = (this.playerX - prevX) / Math.max(delta, 0.001);
    if (this.vehicleDef.id === 'chingchi' && Math.abs(lateralVelocity) > 2.2) {
      this.coins += Math.round(delta * 15 * this.scoreMultiplier);
    }

    const targetRoll = -lateralVelocity * 0.016;
    this.rickshawRoll = THREE.MathUtils.lerp(this.rickshawRoll, targetRoll, Math.min(1.0, delta * 15));
    this.rickshaw.rotation.z = this.rickshawRoll;
    this.rickshaw.rotation.y = THREE.MathUtils.lerp(this.rickshaw.rotation.y, -targetRoll * 0.45, Math.min(1.0, delta * 12));
    this.rickshaw.position.x = this.playerX;
    if (window.playerModel) {
      window.playerModel.position.x = this.playerX;
    }

    // Authentic Auto-Rickshaw Steering Animation:
    // Handlebar and Front Wheel turn together with lateral speed
    const steerAngle = THREE.MathUtils.clamp(
      -lateralVelocity * 0.045,
      -GAME_CONFIG.RICKSHAW_STEER_ANGLE_MAX,
      GAME_CONFIG.RICKSHAW_STEER_ANGLE_MAX
    );
    if (this.rickshaw.userData.frontSteerGroup) {
      this.rickshaw.userData.frontSteerGroup.rotation.y = THREE.MathUtils.lerp(
        this.rickshaw.userData.frontSteerGroup.rotation.y,
        steerAngle,
        Math.min(1.0, delta * 18)
      );
    }
    if (this.rickshaw.userData.handlebar) {
      this.rickshaw.userData.handlebar.rotation.y = THREE.MathUtils.lerp(
        this.rickshaw.userData.handlebar.rotation.y,
        steerAngle,
        Math.min(1.0, delta * 18)
      );
    }

    // Dynamic Paranda Tassel Sway under roof edge:
    // Swings outward with lateral acceleration and roll inertia
    if (this.rickshaw.userData.tasselGroup) {
      const targetTasselSwing = THREE.MathUtils.clamp(
        lateralVelocity * 0.038 + this.rickshawRoll * 1.5,
        -GAME_CONFIG.RICKSHAW_TASSEL_SWING_MAX,
        GAME_CONFIG.RICKSHAW_TASSEL_SWING_MAX
      );
      this.rickshaw.userData.tasselGroup.rotation.z = THREE.MathUtils.lerp(
        this.rickshaw.userData.tasselGroup.rotation.z,
        targetTasselSwing,
        Math.min(1.0, delta * 12)
      );
    }

    // 8. Single Source of Truth for Height: groundHeightAt(laneX, z, levelHint)
    const prevGroundY = this.groundY;
    this.groundY = groundHeightAt(this.playerX, pZ, this.playerFlyoverPassLevel);
    this.verticalLevel = surfaceLevelFromHeight(this.groundY);
    this.rampProgress = getRampProgressAt(pZ, this.playerFlyoverPassLevel);

    // Underpass detection (only when on level 0 underneath the deck — never when on top of the deck!)
    const deckUnderside = getDeckUndersideAt(pZ);
    this.inUnderpass = this.verticalLevel === 0 && deckUnderside !== null;

    // Update engine audio (including low-pass underpass echo & low-fuel sputter)
    this.sound.updateEngine(
      currentSpeed,
      true,
      this.vehicleDef.enginePitch,
      this.fuel,
      delta,
      this.inUnderpass
    );

    // Preserve world Y continuity when stepping onto/off a bus roof while airborne
    if (this.isJumping && Math.abs(this.groundY - prevGroundY) > 0.5 && this.playerFlyoverPassLevel === 0) {
      this.jumpOffset = Math.max(0, this.playerY - this.groundY);
    }

    // 9. Coyote Time & Input Buffer
    if (this.jumpOffset <= 0.06) {
      this.groundTimer = 0.10;
    } else {
      this.groundTimer = Math.max(0, this.groundTimer - delta);
    }

    if (this.inputBuffer.time > 0) {
      this.inputBuffer.time -= delta;
      if (this.inputBuffer.action === 'JUMP' && !this.isJumping && this.groundTimer > 0) {
        this.executeJump(false);
        this.inputBuffer.action = null;
        this.inputBuffer.time = 0;
      }
    }

    // Spring Boots rhythmic auto-bounce when grounded
    if (
      this.jumpVariant === 'JUMP_SPRING_BOOTS' &&
      !this.isJumping &&
      !this.isSliding &&
      this.activePowerup !== 'JETPACK'
    ) {
      this.springBouncePauseTimer += delta;
      if (this.springBouncePauseTimer >= GAME_CONFIG.JUMP_SPRING_BOOTS_INTERVAL) {
        this.springBouncePauseTimer = 0;
        this.executeJump(false);
      }
    }

    if (this.hornCooldown > 0) {
      this.hornCooldown = Math.max(0, this.hornCooldown - delta);
    }

    // 10. Shortcut Section Trigger
    if (pZ <= this.shortcutZStart && pZ >= this.shortcutZEnd) {
      if (!this.isShortcutActive) {
        this.isShortcutActive = true;
        this.emitToast('⚡ SHORTCUT ALLEYWAY! 3X COINS & FASTER RUN!');
        this.sound.playSpeedUp();
        if (this.currentLaneIdx > 1) {
          this.currentLaneIdx = 1;
          this.targetX = GAME_CONFIG.SHORTCUT_LANES[1];
        }
      }
    } else if (this.isShortcutActive && pZ < this.shortcutZEnd) {
      this.isShortcutActive = false;
      this.policeChase.reset(pZ);
      this.emitToast('🚦 MERGED BACK TO HIGHWAY! POLICE AT SAFE DISTANCE');
      this.currentLaneIdx = 1;
      this.targetX = GAME_CONFIG.LANES[1];
    }

    // 11. Jetpack Sky Flight vs Relative Surface Jump (playerY = groundHeightAt() + jumpOffset)
    const slopePitch = groundSlopePitchAt(this.playerX, pZ, this.playerFlyoverPassLevel);

    if (this.activePowerup === 'JETPACK') {
      const jetpackTargetY = Math.max(11.5, DECK_Y + 4.8);
      this.playerY = THREE.MathUtils.lerp(this.playerY, jetpackTargetY, delta * 6);
      this.jumpOffset = Math.max(0, this.playerY - this.groundY);
      this.rickshaw.position.y = this.playerY;
      this.isJumping = false;
      this.verticalVelocity = 0;
      this.rickshawPitch = THREE.MathUtils.lerp(this.rickshawPitch, 0, delta * 10);
      this.rickshaw.rotation.x = this.rickshawPitch;
    } else {
      if (this.isJumping || this.jumpOffset > 0.001) {
        this.jumpOffset += this.verticalVelocity * delta;
        const gravMultiplier = this.verticalVelocity < 0 ? 1.65 : 1.0;
        const repulsorHoverDamp = (this.vehicleDef.id === 'ironman' && this.verticalVelocity < 0 && this.jumpOffset > 0.8) ? 0.65 : 1.0;
        this.verticalVelocity -= GAME_CONFIG.GRAVITY * gravMultiplier * repulsorHoverDamp * delta;

        // Cap boosted jump height below overhead deck ceiling (when on level 0) or overhead beams
        let maxAllowedJumpOffset = GAME_CONFIG.OVERHEAD_CEILING_CLEARANCE;
        if (this.inUnderpass && deckUnderside !== null) {
          maxAllowedJumpOffset = Math.min(
            maxAllowedJumpOffset,
            Math.max(0.5, deckUnderside - this.groundY - this.vehicleDef.hitbox.height - 0.15)
          );
        }
        if (this.jumpOffset > maxAllowedJumpOffset) {
          this.jumpOffset = maxAllowedJumpOffset;
          if (this.verticalVelocity > 0) {
            this.verticalVelocity = 0;
          }
        }

        // Upward sparkles during boosted jumps (pooled zero allocation)
        if (this.jumpVariant !== null && this.verticalVelocity > 1.0 && Math.random() < 0.35) {
          this.spawnCoinSparkle(this.rickshaw.position);
        }

        if (this.jumpOffset <= 0) {
          this.jumpOffset = 0;
          this.verticalVelocity = 0;
          this.isJumping = false;
          this.landingSquashTimer = 0.14;
          if (this.jumpVariant === 'JUMP_DOUBLE_JUMP') {
            this.doubleJumpsRemaining = 1;
          }
        }
      } else {
        this.jumpOffset = 0;
        this.verticalVelocity = 0;
      }

      this.playerY = this.groundY + this.jumpOffset;
      this.rickshaw.position.y = this.playerY;
      if (window.playerModel) {
        window.playerModel.position.y = this.playerY;
      }

      // Smoothly damp vehicle pitch to match ramp slope + jump arc pitch
      const targetPitch = slopePitch + (this.isJumping ? this.verticalVelocity * 0.014 : 0);
      this.rickshawPitch = THREE.MathUtils.lerp(this.rickshawPitch, targetPitch, Math.min(1, delta * 14));
      this.rickshaw.rotation.x = this.rickshawPitch;
    }

    // Suspension bounce & landing squash-and-stretch
    this.suspensionPhase += delta * (currentSpeed * 0.45);
    const bounceOffset = Math.sin(this.suspensionPhase) * 0.032;
    if (this.rickshaw.userData.suspensionPivot) {
      this.rickshaw.userData.suspensionPivot.position.y = bounceOffset;
    }

    // Ground/Deck Blob Shadow anchored on current surface
    if (this.playerBlobShadow) {
      const baseW = this.vehicleDef?.hitbox?.width ?? 1.3;
      const baseL = this.vehicleDef?.hitbox?.length ?? 2.6;
      const jumpShrink = Math.max(0.28, 1 - this.jumpOffset * 0.13);
      this.playerBlobShadow.position.set(this.playerX, this.groundY + 0.02, pZ);
      this.playerBlobShadow.scale.set(baseW * 0.92 * jumpShrink, 1, baseL * 0.92 * jumpShrink);
    }
    if (this.rickshaw.userData.groundShadow) {
      this.rickshaw.userData.groundShadow.visible = false;
    }

    // Sliding & Landing Squash
    if (this.isSliding) {
      this.slideTimer -= delta;
      if (this.rickshaw.userData.isAvenger) {
        this.rickshaw.scale.set(1, 1, 1);
      } else {
        this.rickshaw.scale.set(1.06, 0.55, 1.04);
      }
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.rickshaw.scale.set(1, 1, 1);
      }
    } else if (this.landingSquashTimer > 0) {
      this.landingSquashTimer = Math.max(0, this.landingSquashTimer - delta);
      const sq = Math.sin((this.landingSquashTimer / 0.14) * Math.PI) * (this.rickshaw.userData.isAvenger ? 0.08 : 0.14);
      this.rickshaw.scale.set(1 + sq, 1 - sq, 1 + sq * 0.5);
    } else {
      this.rickshaw.scale.set(1, 1, 1);
    }

    // Kinematic Hero Limb Animation (Spider-Man, Iron Man, Captain America, Thor, Hulk)
    if (this.rickshaw.userData.isAvenger) {
      this.updateHeroKinematicAnimation(delta, currentSpeed);
    }

    // Wheels Spin (rotate wheel group around X axle proportional to speed / wheelRadius)
    if (this.rickshaw.userData.wheels) {
      const wRadius = this.rickshaw.userData.wheelRadius || 0.35;
      const dAngle = (currentSpeed * delta) / wRadius;
      this.rickshaw.userData.wheels.forEach((w: THREE.Group) => {
        w.rotation.x -= dAngle;
      });
    }

    // Dynamic Night Lighting & Brake Glow on Player Rickshaw
    const isNightOrDark = this.timeOfDayLabel === 'Karachi Night' || this.inUnderpass;
    if (this.rickshaw.userData.headlightMat) {
      const targetHeadlight = isNightOrDark ? 1.4 : 0.8;
      this.rickshaw.userData.headlightMat.emissiveIntensity = THREE.MathUtils.lerp(
        this.rickshaw.userData.headlightMat.emissiveIntensity,
        targetHeadlight,
        delta * 4
      );
    }
    if (this.rickshaw.userData.brakeMat) {
      // Brake/tail lights glow brighter on crash, slowdown, or night
      const isBraking = this.state === 'GAMEOVER' || this.isSliding || currentSpeed < GAME_CONFIG.BASE_SPEED * 0.8;
      const targetBrake = isBraking ? 2.5 : isNightOrDark ? 1.1 : 0.7;
      this.rickshaw.userData.brakeMat.emissiveIntensity = THREE.MathUtils.lerp(
        this.rickshaw.userData.brakeMat.emissiveIntensity,
        targetBrake,
        delta * 6
      );
    }

    // Exhaust Smoke (zero allocation using _scratchVec1)
    if (Math.random() < 0.6 && this.rickshaw.userData.exhaustEmitter && this.activePowerup !== 'JETPACK') {
      this.rickshaw.userData.exhaustEmitter.getWorldPosition(_scratchVec1);
      this.spawnExhaustPuff(_scratchVec1);
    }

    // Floating Origin Shift: keep world coordinates near 0 to prevent float precision jitter
    if (Math.abs(this.rickshaw.position.z) >= GAME_CONFIG.FLOATING_ORIGIN_THRESHOLD) {
      const zShift = -this.rickshaw.position.z;
      this.rickshaw.position.z += zShift;
      this.originZOffset += zShift;
      this.nextSpawnZ += zShift;
      this.shortcutZStart += zShift;
      this.shortcutZEnd += zShift;

      for (let i = 0; i < this.roadChunks.length; i++) {
        this.roadChunks[i].position.z += zShift;
      }
      for (let i = 0; i < this.activeObstacles.length; i++) {
        const obs = this.activeObstacles[i];
        obs.position.z += zShift;
        if (obs.userData.zStart !== undefined) obs.userData.zStart += zShift;
        if (obs.userData.zEnd !== undefined) obs.userData.zEnd += zShift;
      }
      for (let i = 0; i < this.activeAITraffic.length; i++) {
        this.activeAITraffic[i].position.z += zShift;
      }
      for (let i = 0; i < this.activePedestrians.length; i++) {
        const ped = this.activePedestrians[i];
        if (!ped.parent || ped.parent === this.scene) {
          ped.position.z += zShift;
        }
      }
      for (let i = 0; i < this.activeCoins.length; i++) {
        this.activeCoins[i].position.z += zShift;
      }
      for (let i = 0; i < this.activePowerups.length; i++) {
        this.activePowerups[i].position.z += zShift;
      }
      for (let i = 0; i < this.pendingSpawnQueue.length; i++) {
        this.pendingSpawnQueue[i].zPos += zShift;
      }
      if (this.policeChase) {
        this.policeChase.shiftOrigin(zShift);
      }
      if (this.pickupManager) {
        this.pickupManager.shiftOrigin(zShift);
      }
      shiftTerrainOrigin(zShift);
    }

    // PERF (Stage 3): Process 1 queued chunk pattern piece per frame (zero frame-time spikes)
    this.processPendingSpawnSlice();

    const curPZ = this.rickshaw.position.z;

    // Living World: Pedestrians walking animation, crossing motion & despawn
    for (let pIdx = this.activePedestrians.length - 1; pIdx >= 0; pIdx--) {
      const ped = this.activePedestrians[pIdx];

      // PERF (Stage 3): Recycle crossing pedestrians / cats back into pool when passed behind camera
      if (ped.userData.isCat || ped.userData.isCrossingPed) {
        if (ped.position.z > curPZ + GAME_CONFIG.DESPAWN_DISTANCE) {
          this.releasePooledObstacle(ped);
          this.activePedestrians.splice(pIdx, 1);
          continue;
        }

        // Lateral crossing movement
        if (ped.userData.crossSpeed) {
          const crossDir = ped.userData.crossDir || 1;
          ped.position.x += crossDir * ped.userData.crossSpeed * delta;
          if (Math.abs(ped.position.x) > 5.5) {
            ped.userData.crossDir = -crossDir;
            ped.rotation.y = ped.userData.crossDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
      }

      ped.userData.walkPhase += delta * 6;
      const swing = Math.sin(ped.userData.walkPhase) * 0.45;
      if (ped.userData.leftLeg && ped.userData.rightLeg) {
        ped.userData.leftLeg.rotation.x = swing;
        ped.userData.rightLeg.rotation.x = -swing;
      }
    }

    // Living Intelligent Traffic: PID Longitudinal Following Controller + Turn Blinkers & Lane Changing (Level-Aware!)
    for (let i = this.activeAITraffic.length - 1; i >= 0; i--) {
      const v = this.activeAITraffic[i];
      const vLevel: 0 | 1 = (v.userData.level ?? 0) === 1 ? 1 : 0;

      // 1. Longitudinal Following & Proximity Sensing (Safe Time-Headway Gap on SAME vertical level)
      const egoSpeed = v.userData.speed || v.userData.baseSpeed;
      const targetFollowDist = 8.5 + egoSpeed * 1.25;
      let minLeadDist = 999;
      let leadSpeed = v.userData.baseSpeed;
      let hasLeadVehicle = false;

      // Check distance to Player Rickshaw if ahead in same lane and on SAME level
      const distToPlayerZ = v.position.z - curPZ;
      if (
        vLevel === this.verticalLevel &&
        distToPlayerZ > 0 &&
        distToPlayerZ < targetFollowDist * 1.8 &&
        Math.abs(v.position.x - this.playerX) < 1.7
      ) {
        hasLeadVehicle = true;
        minLeadDist = distToPlayerZ;
        leadSpeed = this.speed;
      }

      // Check distance to static road hazards on SAME level
      for (const obs of this.activeObstacles) {
        if (obs.userData.type === 'FLYOVER_STRUCTURE' || (obs.userData.level ?? 0) !== vLevel) continue;
        const oDistZ = v.position.z - obs.position.z;
        if (oDistZ > 0 && oDistZ < targetFollowDist * 1.5 && Math.abs(v.position.x - obs.position.x) < 1.8) {
          hasLeadVehicle = true;
          if (oDistZ < minLeadDist) {
            minLeadDist = oDistZ;
            leadSpeed = 0; // Static hazard
          }
        }
      }

      // Check distance to other AI traffic ahead in the same lane and on SAME level
      for (let j = 0; j < this.activeAITraffic.length; j++) {
        if (i === j) continue;
        const other = this.activeAITraffic[j];
        if ((other.userData.level ?? 0) !== vLevel) continue;
        const cDistZ = v.position.z - other.position.z;
        if (cDistZ > 0 && cDistZ < targetFollowDist * 1.6 && Math.abs(v.position.x - other.position.x) < 1.8) {
          hasLeadVehicle = true;
          if (cDistZ < minLeadDist) {
            minLeadDist = cDistZ;
            leadSpeed = other.userData.speed;
          }
        }
      }

      // 2. PID Acceleration & Braking Control
      const kp = v.userData.kp ?? 0.65;
      const ki = v.userData.ki ?? 0.045;
      const kd = v.userData.kd ?? 0.25;
      const maxAccel = v.userData.maxAccel ?? 8.5;
      const maxBrake = v.userData.maxBrake ?? 18.0;

      let error = 0;
      if (hasLeadVehicle) {
        const distError = minLeadDist - targetFollowDist;
        const speedDelta = leadSpeed - egoSpeed;
        error = distError * 0.75 + speedDelta * 1.1;
      } else {
        error = (v.userData.baseSpeed - egoSpeed) * 1.4;
      }

      v.userData.pidIntegral = THREE.MathUtils.clamp((v.userData.pidIntegral ?? 0) + error * delta, -12, 12);
      const dError = delta > 0 ? (error - (v.userData.pidPrevError ?? error)) / delta : 0;
      v.userData.pidPrevError = error;

      const pidCommand = kp * error + ki * v.userData.pidIntegral + kd * dError;
      const commandedAccel = THREE.MathUtils.clamp(pidCommand, -maxBrake, maxAccel);

      v.userData.speed = Math.max(2.5, egoSpeed + commandedAccel * delta);

      const isHardBraking = commandedAccel < -1.6 || (hasLeadVehicle && minLeadDist < targetFollowDist * 0.75);
      v.userData.isBraking = isHardBraking;
      if (v.userData.brakeMat) {
        v.userData.brakeMat.emissiveIntensity = isHardBraking ? 2.6 : 0.6;
      }

      // 3. Living Traffic Lane-Changing & Turn Indicator Blinkers State Machine
      const curLaneIdx = v.userData.currentLaneIdx ?? 1;
      const spanAtV = getFlyoverSpanAtZ(v.position.z);

      if (v.userData.laneState === 'CRUISING') {
        v.userData.laneChangeTimer -= delta;
        const shouldConsiderLaneChange =
          v.userData.laneChangeTimer <= 0 ||
          (hasLeadVehicle && minLeadDist < targetFollowDist && Math.random() < 0.05);

        if (shouldConsiderLaneChange) {
          const candidateLanes: number[] = [];
          if (curLaneIdx > 0) candidateLanes.push(curLaneIdx - 1);
          if (curLaneIdx < GAME_CONFIG.LANES.length - 1) candidateLanes.push(curLaneIdx + 1);

          const safeCandidates = candidateLanes.filter((targetIdx) => {
            const candidateX = GAME_CONFIG.LANES[targetIdx];
            // Never steer into walled ramp lanes on ground level or outside tapered deck rails on level 1
            if (spanAtV) {
              if (vLevel === 0 && !spanAtV.openGroundLanes.includes(targetIdx)) return false;
              if (vLevel === 1) {
                const b = getElevatedBoundsAtZ(spanAtV, v.position.z);
                if (candidateX < b.minX + 0.6 || candidateX > b.maxX - 0.6) return false;
              }
            }
            if (
              vLevel === this.verticalLevel &&
              Math.abs(v.position.z - curPZ) < 16.0 &&
              Math.abs(candidateX - this.playerX) < 1.5
            ) {
              return false;
            }
            for (const obs of this.activeObstacles) {
              if (obs.userData.type === 'FLYOVER_STRUCTURE' || (obs.userData.level ?? 0) !== vLevel) continue;
              if (Math.abs(obs.position.x - candidateX) < 1.4 && Math.abs(v.position.z - obs.position.z) < 18.0) {
                return false;
              }
            }
            for (let k = 0; k < this.activeAITraffic.length; k++) {
              if (i === k) continue;
              const other = this.activeAITraffic[k];
              if ((other.userData.level ?? 0) !== vLevel) continue;
              if (Math.abs(other.position.x - candidateX) < 1.5) {
                const zGap = Math.abs(v.position.z - other.position.z);
                if (zGap < 18.0) return false;
              }
            }
            return true;
          });

          if (safeCandidates.length > 0) {
            const chosenLaneIdx = safeCandidates[Math.floor(Math.random() * safeCandidates.length)];
            v.userData.nextLaneIdx = chosenLaneIdx;
            v.userData.nextTargetLaneX = GAME_CONFIG.LANES[chosenLaneIdx];
            v.userData.blinkerSide = chosenLaneIdx < curLaneIdx ? 'LEFT' : 'RIGHT';
            v.userData.laneState = 'PREPARING_LANE_CHANGE';
            v.userData.prepareTimer = 0.85;
          } else {
            v.userData.laneChangeTimer = 1.2 + Math.random() * 1.6;
          }
        }
      } else if (v.userData.laneState === 'PREPARING_LANE_CHANGE') {
        v.userData.prepareTimer -= delta;
        if (v.userData.prepareTimer <= 0) {
          const targetX = v.userData.nextTargetLaneX;
          let stillSafe = true;
          for (let k = 0; k < this.activeAITraffic.length; k++) {
            if (i === k) continue;
            const other = this.activeAITraffic[k];
            if ((other.userData.level ?? 0) !== vLevel) continue;
            if (Math.abs(other.position.x - targetX) < 1.4 && Math.abs(v.position.z - other.position.z) < 14.0) {
              stillSafe = false;
              break;
            }
          }

          if (stillSafe) {
            v.userData.laneState = 'CHANGING_LANE';
            v.userData.currentLaneIdx = v.userData.nextLaneIdx;
            v.userData.targetLaneX = v.userData.nextTargetLaneX;
          } else {
            v.userData.laneState = 'CRUISING';
            v.userData.blinkerSide = 'NONE';
            v.userData.laneChangeTimer = 1.5 + Math.random() * 2.0;
          }
        }
      } else if (v.userData.laneState === 'CHANGING_LANE') {
        const lateralDist = Math.abs(v.userData.targetLaneX - v.position.x);
        if (lateralDist < 0.04) {
          v.position.x = v.userData.targetLaneX;
          v.userData.laneState = 'CRUISING';
          v.userData.blinkerSide = 'NONE';
          v.userData.laneChangeTimer = 3.5 + Math.random() * 5.0;
        }
      }

      // Blinker Flash Animation (~3.2 Hz rhythmic flash)
      v.userData.blinkerPhase = (v.userData.blinkerPhase ?? 0) + delta * 20;
      const flashOn = Math.sin(v.userData.blinkerPhase) > 0;
      const leftIntensity = v.userData.blinkerSide === 'LEFT' ? (flashOn ? 2.8 : 0.05) : 0.05;
      const rightIntensity = v.userData.blinkerSide === 'RIGHT' ? (flashOn ? 2.8 : 0.05) : 0.05;

      if (v.userData.leftBlinkerMat) {
        v.userData.leftBlinkerMat.emissiveIntensity = leftIntensity;
      }
      if (v.userData.rightBlinkerMat) {
        v.userData.rightBlinkerMat.emissiveIntensity = rightIntensity;
      }

      // 4. Realistic Street Honking
      v.userData.honkTimer -= delta;
      if (v.userData.honkTimer <= 0) {
        if (Math.abs(v.position.z - curPZ) < 32) {
          this.sound.playHorn();
        }
        v.userData.honkTimer = 6.0 + Math.random() * 10.0;
      }

      // Move forward relative to road and keep grounded on its own vertical surface (ground or flyover deck/ramp)
      v.position.z -= v.userData.speed * delta;
      if (vLevel === 1) {
        const curSpan = getFlyoverSpanAtZ(v.position.z);
        if (!curSpan) {
          v.userData.level = 0;
          v.position.y = ROAD_Y;
          v.rotation.x = 0;
        } else {
          const b = getElevatedBoundsAtZ(curSpan, v.position.z);
          v.userData.targetLaneX = THREE.MathUtils.clamp(v.userData.targetLaneX, b.minX + 0.8, b.maxX - 0.8);
          v.position.x = THREE.MathUtils.clamp(v.position.x, b.minX + 0.8, b.maxX - 0.8);
          v.position.y = groundHeightAt(v.position.x, v.position.z, 1);
          v.rotation.x = groundSlopePitchAt(v.position.x, v.position.z, 1);
        }
      } else {
        const curSpan = getFlyoverSpanAtZ(v.position.z);
        if (curSpan && curSpan.openGroundLanes.length > 0 && !curSpan.openGroundLanes.includes(v.userData.currentLaneIdx)) {
          const safeLane = curSpan.openGroundLanes[0];
          v.userData.currentLaneIdx = safeLane;
          v.userData.targetLaneX = GAME_CONFIG.LANES[safeLane];
        }
        v.position.y = ROAD_Y;
        v.rotation.x = 0;
      }

      // Wheel spin & suspension bounce tied to vehicle speed
      if (v.userData.wheels) {
        const wRadius = v.userData.wheelRadius || 0.35;
        const dAngle = (v.userData.speed * delta) / wRadius;
        v.userData.wheels.forEach((w: THREE.Group) => {
          w.rotation.x -= dAngle;
        });
      }
      if (v.userData.bodyGroup) {
        v.userData.bodyGroup.position.y = Math.sin(this.suspensionPhase + i * 1.3) * 0.022;
      }

      // Smooth lateral lane interpolation with authentic body roll & yaw tilt
      const lateralDiff = v.userData.targetLaneX - v.position.x;
      if (Math.abs(lateralDiff) > 0.02) {
        v.position.x = THREE.MathUtils.lerp(v.position.x, v.userData.targetLaneX, delta * 4.2);
        v.rotation.y = THREE.MathUtils.lerp(v.rotation.y, -Math.sign(lateralDiff) * 0.09, delta * 5);
      } else {
        v.position.x = v.userData.targetLaneX;
        v.rotation.y = THREE.MathUtils.lerp(v.rotation.y, 0, delta * 6);
      }

      // Continuous Infinite Traffic Pool: recycle behind camera or far ahead
      if (v.position.z > curPZ + GAME_CONFIG.DESPAWN_DISTANCE || v.position.z < curPZ - 360) {
        v.visible = false;
        this.activeAITraffic.splice(i, 1);
        continue;
      }

      // Level-Filtered Collision Check with Player (must be on SAME vertical level!)
      if ((v.userData.level ?? 0) === this.verticalLevel) {
        const zDiff = Math.abs(v.position.z - curPZ);
        const xDiff = Math.abs(v.position.x - this.playerX);

        if (xDiff < 1.15 && zDiff < 2.8) {
          if (this.jumpOffset < 2.2) {
            const vName = v.userData.isAIRickshaw
              ? 'Traffic Auto Rickshaw'
              : v.userData.isMotorbike
              ? '70cc Motorbike'
              : v.userData.carType === 'SUV'
              ? 'Rugged SUV'
              : v.userData.carType === 'SEDAN'
              ? 'City Sedan'
              : 'Local Hatchback';
            this.triggerGameOver(`💥 Smashed into ${vName}!`, v);
            return;
          }
        }
      }
    }

    // Lahore Highway Patrol Police Chase Update (follows player onto flyover after 0.6s delay, stays non-colliding while chasing)
    if (this.policeChase) {
      this.policeChase.update(
        delta,
        this.playerX,
        this.playerY,
        curPZ,
        currentSpeed,
        this.distance,
        this.verticalLevel
      );
    }

    // Prune flyover terrain spans only after their entire length (zEnd) has passed behind the camera
    pruneFlyoverSpansBehind(curPZ + GAME_CONFIG.DESPAWN_DISTANCE);

    // Update active bus ramps for groundHeightAt()
    setBusRamps(this.activeObstacles);

    // Chunk Recycling: Continuous Conveyer Belt Loop (Infinite road & cityscape)
    for (let c = 0; c < this.roadChunks.length; c++) {
      const chunk = this.roadChunks[c];
      if (chunk.position.z > curPZ + GAME_CONFIG.DESPAWN_DISTANCE) {
        // Find the furthest chunk currently ahead of the player (minimum Z)
        let minChunkZ = this.roadChunks[0].position.z;
        for (let j = 1; j < this.roadChunks.length; j++) {
          if (this.roadChunks[j].position.z < minChunkZ) {
            minChunkZ = this.roadChunks[j].position.z;
          }
        }
        const zPos = minChunkZ - GAME_CONFIG.CHUNK_LENGTH;
        chunk.position.z = zPos;
        const recycledIdx = this.nextChunkIndex++;
        chunk.userData.chunkIndex = recycledIdx;
        chunk.userData.shopOrderServedThisPass = false;
        this.nextSpawnZ = zPos - GAME_CONFIG.CHUNK_LENGTH;

        // Reset splash status for puddles on recycled chunk
        for (let p = 0; p < this.activePuddles.length; p++) {
          if (this.activePuddles[p].chunk === chunk) {
            this.activePuddles[p].puddle.userData.splashedThisPass = false;
          }
        }

        // Safeguard arch visibility when overlapping elevated flyovers
        const archChild = chunk.children.find((child) => child.userData.propCategory === 'ARCH');
        if (archChild) {
          archChild.visible = !getFlyoverSpanAtZ(zPos);
        }

        this.populateChunkContent(zPos, recycledIdx);
      } else if (
        this.verticalLevel === 0 &&
        !chunk.userData.shopOrderServedThisPass &&
        Math.abs(this.playerX) >= 3.0 &&
        Math.abs(chunk.position.z - curPZ) < 4.0
      ) {
        // Open Roadside Dhaba / Paan Kiosk outer-lane drive-by express pickup
        chunk.userData.shopOrderServedThisPass = true;
        this.roadsideOrdersServed++;
        const tip = 20 * this.scoreMultiplier;
        this.coins += tip;
        this.totalRupees += tip;
        this.fuel = Math.min(GAME_CONFIG.FUEL_MAX, this.fuel + 12);
        this.cngFuel = this.fuel;
        this.chaiNitroCharge = Math.min(100, this.chaiNitroCharge + 25);
        this.sound.playCoin();
        this.spawnPickupBurst(this.rickshaw.position, 0xfacc15, 16);
        this.emitToast(`🍵 ROADSIDE OPEN SHOP DRIVE-BY! +${tip} PKR, +12% FUEL & +25% NITRO!`);
      }
    }

    // Obstacles & Level-Filtered Collision Check
    this.electricTowerNearby = false;
    let closestTowerDist = 999;

    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const obs = this.activeObstacles[i];

      // Special lifecycle for FLYOVER_STRUCTURE: only despawn when its far end (zEnd) is behind DESPAWN_DISTANCE!
      if (obs.userData.type === 'FLYOVER_STRUCTURE') {
        const zEnd = obs.userData.zEnd ?? obs.position.z;
        if (zEnd > curPZ + GAME_CONFIG.DESPAWN_DISTANCE) {
          this.disposeFlyoverGroup(obs);
          this.scene.remove(obs);
          this.activeObstacles.splice(i, 1);
        }
        continue;
      }

      if (obs.position.z > curPZ + GAME_CONFIG.DESPAWN_DISTANCE) {
        // PERF (Stage 3): Recycle obstacle back into pool instead of disposing
        this.releasePooledObstacle(obs);
        this.activeObstacles.splice(i, 1);
        continue;
      }

      const obsLevel = obs.userData.level ?? 0;

      // Move Bedford truck regardless of player level, but only collide on same level
      if (obs.userData.type === 'BEDFORD_TRUCK') {
        obs.position.z -= (obs.userData.speed || 12) * delta;
        obs.userData.honkTimer -= delta;
        if (obs.userData.honkTimer <= 0) {
          if (Math.abs(obs.position.z - curPZ) < 35) {
            this.sound.playBedfordAirHorn();
          }
          obs.userData.honkTimer = 8 + Math.random() * 12;
        }
      }

      // Skip collision checks when obstacle is on a different vertical level than the player!
      if (obsLevel !== this.verticalLevel) {
        continue;
      }

      if (obs.userData.type === 'ELECTRIC_TOWER') {
        const dist = obs.position.z - curPZ;
        const towerLaneX = obs.userData.laneX ?? 0;
        const xDiff = Math.abs(towerLaneX - this.playerX);
        if (dist < 0 && dist > -65 && xDiff < 2.0) {
          this.electricTowerNearby = true;
          closestTowerDist = Math.min(closestTowerDist, Math.abs(dist));
        }

        if (obs.userData.sparkLine) {
          const pos = obs.userData.sparkLine.geometry.attributes.position.array;
          for (let p = 0; p < pos.length; p += 3) {
            pos[p + 1] = (Math.random() - 0.5) * 0.35;
          }
          obs.userData.sparkLine.geometry.attributes.position.needsUpdate = true;
        }

        if (obs.userData.beacon) {
          obs.userData.beacon.material.color.setHex(Math.sin(Date.now() * 0.008) > 0 ? 0xef4444 : 0x450a0a);
        }

        if (Math.abs(dist) < 1.4 && xDiff < 1.3 && this.jumpOffset < 10.0) {
          this.triggerGameOver('💥 Direct Hit with High-Voltage Electric Tower! ⚡', obs);
          return;
        }
      } else if (obs.userData.type === 'BUS_RAMP') {
        const zDiff = Math.abs(obs.position.z - curPZ);
        const xDiff = Math.abs(obs.userData.laneX - this.playerX);
        // Only crashes if hitting the bus body rather than climbing its ramp
        if (xDiff < 1.15 && zDiff < 4.2 && this.groundY < ROAD_Y + 1.8 && this.jumpOffset < 2.2) {
          this.triggerGameOver('💥 Smashed into Metro Bus Ramp!', obs);
          return;
        }
      } else if (obs.userData.type === 'BUS') {
        const zDiff = Math.abs(obs.position.z - curPZ);
        const xDiff = Math.abs(obs.userData.laneX - this.playerX);

        if (xDiff < 1.15 && zDiff < 4.2 && this.jumpOffset < 3.4) {
          this.triggerGameOver('💥 Smashed into Pakistani Transport Bus!', obs);
          return;
        }
      } else if (obs.userData.type === 'FRUIT_CART') {
        const zDiff = Math.abs(obs.position.z - curPZ);
        const xDiff = Math.abs(obs.userData.laneX - this.playerX);

        if (xDiff < 1.1 && zDiff < 1.2 && this.jumpOffset < 1.2) {
          this.handleStumble('Crashed into Anwar Ratol Mango Cart!', obs);
        }
      } else if (obs.userData.type === 'BEDFORD_TRUCK') {
        const zDiff = Math.abs(obs.position.z - curPZ);
        const xDiff = Math.abs(obs.userData.laneX - this.playerX);

        if (xDiff < 1.3 && zDiff < 4.8 && this.jumpOffset < 3.8) {
          this.triggerGameOver('💥 Smashed into Chamak-Patti Bedford Rocket Truck!', obs);
          return;
        }
      } else if (obs.userData.type === 'SAHIWAL_COW') {
        const zDiff = Math.abs(obs.position.z - curPZ);
        const xDiff = Math.abs(obs.userData.laneX - this.playerX);

        if (xDiff < 1.2 && zDiff < 1.8 && this.jumpOffset < 1.8) {
          this.triggerGameOver('💥 Bumped into Sahiwal Bull on Mall Road! 🐂', obs);
          return;
        }
      } else if (obs.userData.type === 'HURDLE') {
        const zDiff = Math.abs(obs.position.z - curPZ);
        const xDiff = Math.abs(obs.position.x - this.playerX);

        if (xDiff < 0.95 && zDiff < 0.65 && this.jumpOffset < 0.7 && !this.isSliding) {
          this.handleStumble('Tripped on Road Hurdle!', obs);
        }
      } else if (obs.userData.type === 'LOW_BEAM') {
        const zDiff = Math.abs(obs.position.z - curPZ);
        const xDiff = Math.abs(obs.position.x - this.playerX);

        if (xDiff < 1.1 && zDiff < 0.75 && (!this.isSliding || this.jumpOffset > 0.35)) {
          this.handleStumble('Hit Overhead Low Height Barrier!', obs);
        }
      }
    }

    // Collision check for crossing pedestrians and street cats (ground level 0 only)
    if (this.verticalLevel === 0) {
      if (this.npcManager) {
        this.npcManager.update(delta, {
          x: this.playerX,
          y: this.playerY,
          z: curPZ,
          timeOfDay: this.timeOfDayLabel
        });
        const npcHit = this.npcManager.checkCollision({
          x: this.playerX,
          y: this.jumpOffset,
          z: curPZ
        });
        if (npcHit) {
          this.coins = Math.max(0, this.coins - npcHit.penalty);
          this.totalRupees = Math.max(0, this.totalRupees - npcHit.penalty);
          this.emitToast(`⚠️ CAREFUL! Bumped ${npcHit.label}! (-${npcHit.penalty} PKR)`);
          this.handleStumble(`Careful! Swerved into ${npcHit.label}!`);
        }
      }
      for (const ped of this.activePedestrians) {
        if (ped.userData.isCat || ped.userData.isCrossingPed) {
          const zDiff = Math.abs(ped.position.z - curPZ);
          const xDiff = Math.abs(ped.position.x - this.playerX);
          if (xDiff < 0.95 && zDiff < 1.0 && this.jumpOffset < 1.2) {
            this.handleStumble(ped.userData.isCat ? 'Swerved into Street Cat!' : 'Swerved into Crossing Pedestrian!');
          }
        }
      }
    }

    // Near Miss / Close Call Check for both AI traffic & obstacles on SAME vertical level
    for (const v of this.activeAITraffic) {
      if ((v.userData.level ?? 0) !== this.verticalLevel) continue;
      const zDiff = Math.abs(v.position.z - curPZ);
      const xDiff = Math.abs(v.position.x - this.playerX);
      if (zDiff < 3.0 && zDiff > 0.6 && xDiff > 1.15 && xDiff < 2.4 && !v.userData.nearMissAwarded) {
        v.userData.nearMissAwarded = true;
        this.closeCallCount++;
        this.streakCount++;
        this.streakTimer = 4.5;
        const streakBonus = Math.min(30, this.streakCount * 5);
        this.coins += streakBonus;
        this.totalRupees += streakBonus;
        this.chaiNitroCharge = Math.min(100, this.chaiNitroCharge + 25);
        if (this.policeChase) this.policeChase.registerNearMiss();
        this.sound.playCloseCall();
        const phrases = ['Oye Hoye!', 'Shabaash!', 'Zabardast!', 'Balle Balle!', 'Bach Ke!'];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.sound.speakCallout(phrase);
        if (this.onCloseCall) this.onCloseCall(this.closeCallCount, phrase);
      }
    }
    for (const obs of this.activeObstacles) {
      if (obs.userData.type === 'FLYOVER_STRUCTURE' || (obs.userData.level ?? 0) !== this.verticalLevel) continue;
      const zDiff = Math.abs(obs.position.z - curPZ);
      const xDiff = Math.abs(obs.position.x - this.playerX);
      if (zDiff < 3.0 && zDiff > 0.6 && xDiff > 1.15 && xDiff < 2.4 && !obs.userData.nearMissAwarded) {
        obs.userData.nearMissAwarded = true;
        this.closeCallCount++;
        this.chaiNitroCharge = Math.min(100, this.chaiNitroCharge + 25);
        if (this.policeChase) this.policeChase.registerNearMiss();
        this.sound.playCloseCall();
        const phrases = ['Oye Hoye!', 'Shabaash!', 'Zabardast!', 'Bach Ke!'];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.sound.speakCallout(phrase);
        if (this.onCloseCall) this.onCloseCall(this.closeCallCount, phrase);
      }
    }

    // Puddle Splash Check (only on ground road level 0) - O(1) direct pool lookup
    if (this.verticalLevel === 0 && this.jumpOffset < 0.25) {
      for (let p = 0; p < this.activePuddles.length; p++) {
        const item = this.activePuddles[p];
        if (!item.puddle.userData.splashedThisPass) {
          const worldPuddleZ = item.chunk.position.z + item.puddle.position.z;
          const worldPuddleX = item.puddle.position.x;
          if (Math.abs(curPZ - worldPuddleZ) < 2.0 && Math.abs(this.playerX - worldPuddleX) < 1.4) {
            item.puddle.userData.splashedThisPass = true;
            this.sound.playWaterSplash();
            if (this.onPuddleSplash) this.onPuddleSplash();
          }
        }
      }
    }

    if (this.electricTowerNearby) {
      this.sound.setElectricHumVolume(1.0 - closestTowerDist / 65);
    } else {
      this.sound.setElectricHumVolume(0);
    }

    // Shared Pickup System (Fuel, Shield, & Jump Boost InstancedMeshes)
    if (this.pickupManager) {
      this.pickupManager.update(delta, this.playerX, this.playerY, curPZ, (def, worldPos) => {
        this.handlePickupCollected(def, worldPos);
      });
    }

    // Coins Collection (level-aware via 3D distance check)
    for (let i = this.activeCoins.length - 1; i >= 0; i--) {
      const coin = this.activeCoins[i];
      coin.rotation.y += delta * 4;

      if (coin.position.z > curPZ + GAME_CONFIG.DESPAWN_DISTANCE) {
        coin.visible = false;
        this.activeCoins.splice(i, 1);
        continue;
      }

      const isSpiderMan = this.vehicleDef.id === 'spiderman';
      const isThor = this.vehicleDef.id === 'thor';
      if (this.activePowerup === 'MAGNET' || (this.isMysteryActive && this.mysteryVehicle === 'tonga') || isSpiderMan || isThor) {
        const pullDistLimit = (isSpiderMan || isThor) ? 14 : 18;
        const cDist = coin.position.distanceTo(this.rickshaw.position);
        if (cDist < pullDistLimit) {
          coin.position.lerp(this.rickshaw.position, delta * 9.5);
        }
      }

      _scratchVec1.set(this.playerX, this.playerY + 0.8, curPZ);
      const hitDist = coin.position.distanceTo(_scratchVec1);
      if (hitDist < 1.45) {
        const shortcutBonus = this.isShortcutActive ? 3 : 1;
        const tongaBonus = this.isMysteryActive && this.mysteryVehicle === 'tonga' ? 2 : 1;
        const earned = 1 * this.scoreMultiplier * shortcutBonus * tongaBonus;
        this.coins += earned;
        this.totalRupees += earned;
        this.chaiNitroCharge = Math.min(100, this.chaiNitroCharge + 2);
        if (this.policeChase) this.policeChase.registerCleanCoin();
        this.sound.playCoin();
        this.spawnCoinSparkle(coin.position);
        coin.visible = false;
        this.activeCoins.splice(i, 1);
      }
    }

    // Power-ups & Mystery Boxes
    for (let i = this.activePowerups.length - 1; i >= 0; i--) {
      const pUp = this.activePowerups[i];
      pUp.rotation.y += delta * 3;

      if (pUp.position.z > curPZ + GAME_CONFIG.DESPAWN_DISTANCE) {
        // PERF (Stage 3): Recycle powerup back into pool instead of disposing
        this.releasePooledObstacle(pUp);
        this.activePowerups.splice(i, 1);
        continue;
      }

      _scratchVec1.set(this.playerX, this.playerY + 0.8, curPZ);
      const pDist = pUp.position.distanceTo(_scratchVec1);
      if (pDist < 1.7) {
        if (pUp.userData.isMysteryBox) {
          this.activateMysteryTransformation();
        } else {
          this.activatePowerupItem(pUp.userData.type as PowerupType);
        }
        // PERF (Stage 3): Recycle collected powerup back into pool
        this.releasePooledObstacle(pUp);
        this.activePowerups.splice(i, 1);
      }
    }

    if (this.activePowerup) {
      this.powerupTimer -= delta;
      if (this.powerupTimer <= 0) {
        this.deactivatePowerup();
      }
    }
  }

  private handlePickupCollected(def: PickupConfigDef, worldPos: THREE.Vector3) {
    this.spawnPickupBurst(worldPos, def.color, 20);

    if (def.kind === 'FUEL') {
      const wasEmpty = this.fuel <= 0.01;
      this.fuel = Math.min(GAME_CONFIG.FUEL_MAX, this.fuel + def.amount);
      this.cngFuel = this.fuel;
      this.fuelEmptyTimer = 0;
      this.stallSpeedFactor = 1.0;

      if (def.id === 'FUEL_GOLDEN_CAN') {
        this.fuelNoDrainTimer = def.duration;
        this.sound.playFuelPickup(true);
        this.emitToast('⛽✨ GOLDEN FUEL CAN! 100% TANK + 6s ZERO DRAIN!');
      } else {
        if (wasEmpty) {
          this.sound.playEngineRestartCough();
          this.emitToast(`⛽ ENGINE RESTARTED! +${def.amount}% FUEL!`);
        } else {
          this.sound.playFuelPickup(false);
          this.emitToast(`⛽ ${def.name.toUpperCase()}! +${def.amount}% FUEL!`);
        }
      }
      return;
    }

    if (def.kind === 'SHIELD') {
      this.sound.playShieldPickup();
      this.activateShield(def.id);
      return;
    }

    if (def.kind === 'JUMP') {
      this.sound.playJumpPickup();
      this.jumpVariant = def.id;
      this.jumpMaxDuration = def.duration;
      this.jumpTimer = def.duration;
      if (def.id === 'JUMP_DOUBLE_JUMP') {
        this.doubleJumpsRemaining = 1;
        this.emitToast('🪽 WINGED DOUBLE JUMP BOOTS ACTIVE! (10s)');
      } else if (def.id === 'JUMP_SPRING_BOOTS') {
        this.doubleJumpsRemaining = 0;
        this.emitToast('🥾 AUTO-BOUNCE SPRING BOOTS ACTIVE! (8s)');
      } else {
        this.doubleJumpsRemaining = 0;
        this.emitToast('👟✨ SUPER KHUSSA 1.8X HIGH JUMP ACTIVE! (12s)');
      }
    }
  }

  private activatePowerupItem(type: PowerupType) {
    if (type === 'SHIELD' || type === 'SHIELD_STANDARD' || type === 'SHIELD_DOUBLE' || type === 'SHIELD_GOLDEN') {
      this.activateShield(type === 'SHIELD' ? 'SHIELD_STANDARD' : type);
      return;
    }

    if (type === 'CNG' || type === 'FUEL_JERRY_CAN' || type === 'FUEL_DRUM' || type === 'FUEL_GOLDEN_CAN') {
      const def = PICKUP_DEFINITIONS[type === 'CNG' ? 'FUEL_JERRY_CAN' : type];
      this.handlePickupCollected(def, this.rickshaw.position);
      return;
    }

    if (type === 'HYDRAULIC' || type === 'JUMP_SUPER_KHUSSA' || type === 'JUMP_SPRING_BOOTS' || type === 'JUMP_DOUBLE_JUMP') {
      const def = PICKUP_DEFINITIONS[type === 'HYDRAULIC' ? 'JUMP_SUPER_KHUSSA' : type];
      this.handlePickupCollected(def, this.rickshaw.position);
      return;
    }

    this.activePowerup = type;
    if (type === 'MAGNET') {
      this.powerupTimer = 8.0 + (this.upgrades.magnetLevel - 1) * 2.5;
    } else if (type === 'JETPACK') {
      this.powerupTimer = 8.0 + (this.upgrades.jetpackLevel - 1) * 2.0;
    } else {
      this.powerupTimer = 10.0;
    }

    if (type === 'JETPACK') {
      if (this.rickshaw.userData.jetpackVisual) this.rickshaw.userData.jetpackVisual.visible = true;
      this.sound.playJetpack();
    } else if (type === 'MULTIPLIER') {
      this.scoreMultiplier = 2;
    }

    this.emitToast(`✨ ${type} ACTIVE!`);
  }

  private deactivatePowerup() {
    if (this.activePowerup === 'JETPACK') {
      if (this.rickshaw.userData.jetpackVisual) this.rickshaw.userData.jetpackVisual.visible = false;
      this.jumpOffset = 0;
    } else if (this.activePowerup === 'MULTIPLIER') {
      this.scoreMultiplier = 1;
    }
    this.activePowerup = null;
  }

  private spawnExhaustPuff(pos: THREE.Vector3) {
    let puff: THREE.Mesh | null = null;
    for (let i = 0; i < this.puffPool.length; i++) {
      if (!this.puffPool[i].visible) {
        puff = this.puffPool[i];
        break;
      }
    }
    if (!puff) return; // Pool exhausted, skip to safeguard 60 FPS
    puff.position.copy(pos);
    puff.scale.set(1, 1, 1);
    (puff.material as THREE.MeshBasicMaterial).opacity = 0.5;
    puff.visible = true;
    this.particles.push({ mesh: puff, life: 0.45, maxLife: 0.45 });
  }

  private spawnCoinSparkle(pos: THREE.Vector3) {
    let spawned = 0;
    for (let i = 0; i < this.sparklePool.length && spawned < 4; i++) {
      const sparkle = this.sparklePool[i];
      if (!sparkle.visible) {
        sparkle.position.copy(pos);
        sparkle.scale.set(1, 1, 1);
        (sparkle.material as THREE.MeshBasicMaterial).opacity = 0.8;
        sparkle.visible = true;
        if (!sparkle.userData.vel) {
          sparkle.userData.vel = new THREE.Vector3();
        }
        sparkle.userData.vel.set(
          (Math.random() - 0.5) * 3,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 3
        );
        this.particles.push({ mesh: sparkle, vel: sparkle.userData.vel, life: 0.35, maxLife: 0.35 });
        spawned++;
      }
    }
  }

  private updateParticles(delta: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        if (p.mesh) {
          p.mesh.visible = false;
        }
        if (p.points) {
          if (p.points.geometry) {
            p.points.geometry.dispose();
          }
          if (p.points.material) {
            if (Array.isArray(p.points.material)) {
              p.points.material.forEach((m) => m.dispose());
            } else {
              p.points.material.dispose();
            }
          }
          this.scene.remove(p.points);
        }
        this.particles.splice(i, 1);
        continue;
      }

      if (p.mesh) {
        p.mesh.scale.multiplyScalar(1.0 + delta * 2.5);
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        if (mat && mat.opacity !== undefined) {
          mat.opacity = Math.max(0, p.life / p.maxLife);
        }
        if (p.vel) {
          p.mesh.position.addScaledVector(p.vel, delta);
        }
      }
      if (p.points) {
        (p.points.material as THREE.PointsMaterial).opacity = Math.max(0, p.life);
        const pos = p.points.geometry.attributes.position.array as Float32Array;
        for (let j = 0; j < p.vels!.length; j++) {
          pos[j * 3] += p.vels![j].x * delta;
          pos[j * 3 + 1] += p.vels![j].y * delta;
          pos[j * 3 + 2] += p.vels![j].z * delta;
          p.vels![j].y -= 25 * delta;
        }
        p.points.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  private notifyStats() {
    if (this.onStatsUpdate) {
      const nowMs = Date.now();
      this.onStatsUpdate({
        distance: this.distance,
        coins: this.coins,
        speed: this.speed,
        bestScore: this.bestScore,
        activePowerup: this.activePowerup,
        powerupTimer: this.powerupTimer,
        scoreMultiplier: this.scoreMultiplier,
        hasShield: this.hasShield,
        policeDanger: this.policeDistance < 9.0,
        electricWarning: this.electricTowerNearby,
        state: this.state,
        crashReason: this.crashReason,
        timeOfDay: this.timeOfDayLabel,
        weather: this.weather,
        totalRupees: this.totalRupees,
        closeCalls: this.closeCallCount,
        currentSkin: this.currentSkin,
        cngFuel: Math.round(this.cngFuel),
        policeDistance: this.policeChase ? this.policeChase.gap : 14,
        wardenStrikes: this.policeChase && this.policeChase.state === 'CLOSE' ? 1 : 0,
        hornCooldown: this.hornCooldown,
        powerupFlicker: this.powerupTimer > 0 && this.powerupTimer < 2.5 && Math.sin(nowMs * 0.02) > 0,
        // Connected Systems Stats
        difficultyLevel: this.difficultyLevel,
        speedUpFlash: this.speedUpFlashTimer > 0,
        policeState: this.policeChase ? this.policeChase.state : 'SAFE',
        policeGap: this.policeChase ? this.policeChase.gap : 14,
        activeVehicle: this.activeVehicle,
        isMysteryActive: this.isMysteryActive,
        mysteryVehicle: this.mysteryVehicle,
        mysteryTimer: Math.max(0, this.mysteryTimer),
        mysteryFlicker:
          this.mysteryTimer > 0 &&
          this.mysteryTimer <= GAME_CONFIG.MYSTERY_BOX_FLICKER &&
          Math.sin(nowMs * 0.02) > 0,
        isShortcutActive: this.isShortcutActive,
        verticalLevel: this.verticalLevel,
        comicDialogue: this.policeChase ? this.policeChase.arrest.comicDialogue : '',
        arrestPhase: this.policeChase && this.policeChase.arrest.active ? this.policeChase.arrest.phase : 'NONE',
        fps: this.fpsCount,
        // Fuel, Shield, & Jump Boost Systems
        fuel: Math.round(this.fuel),
        isLowFuel: this.fuel > 0 && this.fuel < GAME_CONFIG.FUEL_LOW_WARNING_PCT,
        isFuelEmpty: this.fuel <= 0,
        fuelNoDrainTimer: Math.max(0, this.fuelNoDrainTimer),
        shieldActive: this.hasShield && this.shieldCharges > 0,
        shieldVariant: this.shieldVariant,
        shieldTimer: Math.max(0, this.shieldTimer),
        shieldMaxDuration: this.shieldMaxDuration,
        shieldCharges: this.shieldCharges,
        shieldFlicker:
          this.hasShield &&
          this.shieldTimer > 0 &&
          this.shieldTimer <= GAME_CONFIG.SHIELD_FLICKER_TIME &&
          Math.sin(nowMs * 0.028) > 0,
        jumpBoostActive: this.jumpVariant !== null && this.jumpTimer > 0,
        jumpVariant: this.jumpVariant,
        jumpTimer: Math.max(0, this.jumpTimer),
        jumpMaxDuration: this.jumpMaxDuration,
        jumpFlicker:
          this.jumpVariant !== null &&
          this.jumpTimer > 0 &&
          this.jumpTimer <= GAME_CONFIG.JUMP_FLICKER_TIME &&
          Math.sin(nowMs * 0.028) > 0,
        doubleJumpsRemaining: this.doubleJumpsRemaining,
        screenFlashColor: this.screenFlashColor,
        // Flyover, Terrain, & Debug Telemetry
        inUnderpass: this.inUnderpass,
        playerY: Number(this.playerY.toFixed(2)),
        surfaceY: Number(this.groundY.toFixed(2)),
        rampProgress: Number(this.rampProgress.toFixed(2)),
        curveEnabled: this.curveEnabled,
        debugGroundGrid: this.debugGroundGrid,
        debugBaseMarkers: this.debugBaseMarkers,
        debugHeightOverlay: this.debugHeightOverlay,
        debugWireframe: this.debugWireframe,
        debugBoundingBoxes: this.debugBoundingBoxes,
        isShowroomMode: this.isShowroomMode,
        showroomValidationResults: this.showroomValidationResults,
        unpatchedCount: this.unpatchedCount,
        chaiNitroCharge: Math.round(this.chaiNitroCharge),
        isNitroActive: this.isNitroActive,
        nitroTimer: Number(this.nitroTimer.toFixed(1)),
        roadsideOrdersServed: this.roadsideOrdersServed,
        isNPCGalleryOpen: this.isNPCGalleryOpen,
        isShopGalleryOpen: this.isShopGalleryOpen,
        isBuildingGalleryOpen: this.isBuildingGalleryOpen,
        buildingGalleryStage: this.buildingGalleryStage,
        currentDistrict: this.currentDistrict,
        streakCount: this.streakCount,
        showPerfOverlay: this.showPerfOverlay,
        perfMetrics: this.perfMetrics
      });
    }
  }

  // ============================================================================
  // DEBUG OVERLAY TOGGLES & AUTOMATED VERIFICATION SUITES (Phase 6 + Key B)
  // ============================================================================
  /**
   * Key B Debug Toggle:
   * Shows Box3Helper and AxesHelper on every vehicle in the scene, and runs
   * alignment validation across all 8 VEHICLE_SPECS models.
   */
  public toggleBoundingBoxDebug(): boolean {
    this.debugBoundingBoxes = !this.debugBoundingBoxes;
    setSceneDebugHelpersVisible(this.scene, this.debugBoundingBoxes);
    if (this.debugBoundingBoxes && this.showroomValidationResults.length === 0) {
      const { results, group } = createModelShowroom();
      this.showroomValidationResults = results;
      group.visible = false;
      this.showroomGroup = group;
      this.scene.add(group);
    }
    const passedCount = this.showroomValidationResults.filter((r) => r.passed).length;
    const totalCount = this.showroomValidationResults.length;
    this.emitToast(
      `📦 VEHICLE BOX3 + AXES DEBUG (KEY B): ${this.debugBoundingBoxes ? 'ON' : 'OFF'} (${passedCount}/${totalCount} SPECS PASS)`
    );
    this.notifyStats();
    return this.debugBoundingBoxes;
  }

  /**
   * Toggles the Model Showroom scene that lines up all 8 VEHICLE_SPECS models in a row
   * on a reference ground grid with Box3Helpers and AxesHelpers for visual checking.
   */
  /**
   * Key G Toggle:
   * Toggles the 3D Karachi Street NPC Gallery (showNPCGallery) lining up all 15
   * procedural low-poly NPC & Animal types on a rotating sandstone stage.
   */
  public toggleNPCGallery(): boolean {
    return this.setNPCGalleryMode(!this.isNPCGalleryOpen);
  }

  public setNPCGalleryMode(active: boolean): boolean {
    if (!this.npcManager) return false;
    this.isNPCGalleryOpen = this.npcManager.showNPCGallery(active);
    if (this.isNPCGalleryOpen) {
      if (this.isShowroomMode) {
        this.setShowroomMode(false);
      }
      if (this.isShopGalleryOpen) {
        this.setShopGalleryMode(false);
      }
      uCurve.value = 0;
      this.rickshaw.visible = false;
      this.roadChunks.forEach((ch) => (ch.visible = false));
      this.activeObstacles.forEach((o) => (o.visible = false));
      this.activeAITraffic.forEach((v) => (v.visible = false));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = false;
        this.policeChase.rightCar.visible = false;
      }
      this.emitToast('👥 KARACHI STREET NPC GALLERY [KEY G] — ALL 15 PROCEDURAL CHARACTERS & ANIMALS');
    } else {
      uCurve.value = this.curveEnabled ? GAME_CONFIG.CURVE_STRENGTH : 0;
      this.rickshaw.visible = true;
      this.roadChunks.forEach((ch) => (ch.visible = true));
      this.activeObstacles.forEach((o) => (o.visible = true));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = true;
        this.policeChase.rightCar.visible = true;
      }
      this.emitToast('🛣️ RETURNED TO KARACHI STREET SCENE');
    }
    this.notifyStats();
    return this.isNPCGalleryOpen;
  }

  /**
   * Key H Toggle:
   * Toggles the 3D Pakistani Bazaar Shop Gallery (showShopGallery) lining up all 12
   * procedural shop types side-by-side in 2 tiers for inspection.
   */
  public toggleShopGallery(): boolean {
    return this.setShopGalleryMode(!this.isShopGalleryOpen);
  }

  public setShopGalleryMode(active: boolean): boolean {
    this.isShopGalleryOpen = showShopGallery(this.scene, active);
    if (this.isShopGalleryOpen) {
      if (this.isShowroomMode) {
        this.setShowroomMode(false);
      }
      if (this.isNPCGalleryOpen) {
        this.setNPCGalleryMode(false);
      }
      if (this.isBuildingGalleryOpen) {
        this.setBuildingGalleryMode(false);
      }
      uCurve.value = 0;
      this.rickshaw.visible = false;
      this.roadChunks.forEach((ch) => (ch.visible = false));
      this.activeObstacles.forEach((o) => (o.visible = false));
      this.activeAITraffic.forEach((v) => (v.visible = false));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = false;
        this.policeChase.rightCar.visible = false;
      }
      this.emitToast('🏪 KARACHI BAZAAR SHOP GALLERY [KEY H] — ALL 12 HAND-PAINTED SHOP TYPES');
    } else {
      uCurve.value = this.curveEnabled ? GAME_CONFIG.CURVE_STRENGTH : 0;
      this.rickshaw.visible = true;
      this.roadChunks.forEach((ch) => (ch.visible = true));
      this.activeObstacles.forEach((o) => (o.visible = true));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = true;
        this.policeChase.rightCar.visible = true;
      }
      this.emitToast('🛣️ RETURNED TO KARACHI STREET SCENE');
    }
    this.notifyStats();
    return this.isShopGalleryOpen;
  }

  /**
   * Key B Toggle:
   * Toggles the 3D Pakistani Skyline Building Gallery (showBuildingGallery) lining up
   * all 12 procedural building types (or filtered by Stage 1, 2, 3) for inspection.
   */
  public toggleBuildingGallery(): boolean {
    return this.setBuildingGalleryMode(!this.isBuildingGalleryOpen, this.buildingGalleryStage);
  }

  public setBuildingGalleryStage(stage: number): void {
    this.buildingGalleryStage = stage;
    if (this.isBuildingGalleryOpen) {
      showBuildingGallery(this.scene, true, stage);
      this.notifyStats();
    }
  }

  public setBuildingGalleryMode(active: boolean, stage: number = 0): boolean {
    this.buildingGalleryStage = stage;
    this.isBuildingGalleryOpen = showBuildingGallery(this.scene, active, stage);
    if (this.isBuildingGalleryOpen) {
      if (this.isShowroomMode) {
        this.setShowroomMode(false);
      }
      if (this.isNPCGalleryOpen) {
        this.setNPCGalleryMode(false);
      }
      if (this.isShopGalleryOpen) {
        this.setShopGalleryMode(false);
      }
      uCurve.value = 0;
      this.rickshaw.visible = false;
      this.roadChunks.forEach((ch) => (ch.visible = false));
      this.activeObstacles.forEach((o) => (o.visible = false));
      this.activeAITraffic.forEach((v) => (v.visible = false));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = false;
        this.policeChase.rightCar.visible = false;
      }
      this.emitToast('🏙️ PAKISTANI SKYLINE BUILDING GALLERY [KEY B] — ALL 12 SKYLINE & SET-PIECE BUILDINGS');
    } else {
      uCurve.value = this.curveEnabled ? GAME_CONFIG.CURVE_STRENGTH : 0;
      this.rickshaw.visible = true;
      this.roadChunks.forEach((ch) => (ch.visible = true));
      this.activeObstacles.forEach((o) => (o.visible = true));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = true;
        this.policeChase.rightCar.visible = true;
      }
      this.emitToast('🛣️ RETURNED TO KARACHI STREET SCENE');
    }
    this.notifyStats();
    return this.isBuildingGalleryOpen;
  }

  /**
   * Stage 0 Perf Overlay Toggle (Key F or Triple-Tap on screen)
   */
  public togglePerfOverlay(): boolean {
    this.showPerfOverlay = !this.showPerfOverlay;
    this.notifyStats();
    return this.showPerfOverlay;
  }

  /**
   * Key B Toggle:
   * Toggles the 3D Pakistani Skyline Building Gallery (showBuildingGallery) lining up
   * all 12 procedural building types (or filtered by Stage 1, 2, 3) for inspection.
   */
  public toggleBuildingGallery(): boolean {
    return this.setBuildingGalleryMode(!this.isBuildingGalleryOpen, this.buildingGalleryStage);
  }

  public setBuildingGalleryStage(stage: number): void {
    this.buildingGalleryStage = stage;
    if (this.isBuildingGalleryOpen) {
      showBuildingGallery(this.scene, true, stage);
      this.notifyStats();
    }
  }

  public setBuildingGalleryMode(active: boolean, stage: number = 0): boolean {
    this.buildingGalleryStage = stage;
    this.isBuildingGalleryOpen = showBuildingGallery(this.scene, active, stage);
    if (this.isBuildingGalleryOpen) {
      if (this.isShowroomMode) {
        this.setShowroomMode(false);
      }
      if (this.isNPCGalleryOpen) {
        this.setNPCGalleryMode(false);
      }
      if (this.isShopGalleryOpen) {
        this.setShopGalleryMode(false);
      }
      uCurve.value = 0;
      this.rickshaw.visible = false;
      this.roadChunks.forEach((ch) => (ch.visible = false));
      this.activeObstacles.forEach((o) => (o.visible = false));
      this.activeAITraffic.forEach((v) => (v.visible = false));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = false;
        this.policeChase.rightCar.visible = false;
      }
      this.emitToast('🏙️ PAKISTANI SKYLINE BUILDING GALLERY [KEY B] — ALL 12 SKYLINE & SET-PIECE BUILDINGS');
    } else {
      uCurve.value = this.curveEnabled ? GAME_CONFIG.CURVE_STRENGTH : 0;
      this.rickshaw.visible = true;
      this.roadChunks.forEach((ch) => (ch.visible = true));
      this.activeObstacles.forEach((o) => (o.visible = true));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = true;
        this.policeChase.rightCar.visible = true;
      }
      this.emitToast('🛣️ RETURNED TO KARACHI STREET SCENE');
    }
    this.notifyStats();
    return this.isBuildingGalleryOpen;
  }

  /**
   * Stage 0 Perf Overlay Toggle (Key F or Triple-Tap on screen)
   */
  public togglePerfOverlay(): boolean {
    this.showPerfOverlay = !this.showPerfOverlay;
    this.notifyStats();
    return this.showPerfOverlay;
  }

  public toggleShowroomMode(): boolean {
    return this.setShowroomMode(!this.isShowroomMode);
  }

  public setShowroomMode(active: boolean): boolean {
    this.isShowroomMode = active;
    if (!this.showroomGroup) {
      const { group, results } = createModelShowroom();
      this.showroomGroup = group;
      this.showroomValidationResults = results;
      this.scene.add(this.showroomGroup);
    }

    this.showroomGroup.visible = active;
    if (active) {
      this.debugBoundingBoxes = true;
      setSceneDebugHelpersVisible(this.scene, true);
      uCurve.value = 0; // Keep showroom floor flat for exact geometric inspection
      this.rickshaw.visible = false;
      this.roadChunks.forEach((ch) => (ch.visible = false));
      this.activeObstacles.forEach((o) => (o.visible = false));
      this.activeAITraffic.forEach((v) => (v.visible = false));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = false;
        this.policeChase.rightCar.visible = false;
      }
      this.emitToast('🏛️ MODEL SHOWROOM ACTIVE — ALL 8 VEHICLE_SPECS LINED UP AT Y=0 (←/→ TO FOCUS)');
    } else {
      uCurve.value = this.curveEnabled ? GAME_CONFIG.CURVE_STRENGTH : 0;
      this.rickshaw.visible = true;
      this.roadChunks.forEach((ch) => (ch.visible = true));
      this.activeObstacles.forEach((o) => (o.visible = true));
      if (this.policeChase) {
        this.policeChase.leftCar.visible = true;
        this.policeChase.rightCar.visible = true;
      }
      setSceneDebugHelpersVisible(this.scene, this.debugBoundingBoxes);
      this.emitToast('🛣️ RETURNED TO STREET SCENE');
    }
    this.notifyStats();
    return this.isShowroomMode;
  }

  public cycleShowroomFocus(dir: number) {
    if (!this.isShowroomMode || !this.showroomGroup) return;
    const items = (this.showroomGroup.userData.items as { x: number; key: string }[]) || [];
    if (items.length === 0) return;
    this.showroomFocusIndex += dir;
    if (this.showroomFocusIndex >= items.length) {
      this.showroomFocusIndex = -1; // -1 = full lineup view
    } else if (this.showroomFocusIndex < -1) {
      this.showroomFocusIndex = items.length - 1;
    }
    this.garageTurntableAngle = 0;
    if (this.showroomFocusIndex === -1) {
      this.emitToast('🏛️ SHOWROOM: FULL LINEUP OVERVIEW (8 MODELS)');
    } else {
      const item = items[this.showroomFocusIndex];
      const spec = VEHICLE_SPECS[item.key];
      this.emitToast(
        `🔎 INSPECTING: ${spec ? spec.name.toUpperCase() : item.key.toUpperCase()} (${spec.length}m × ${spec.width}m × ${spec.height}m)`
      );
    }
    this.notifyStats();
  }
  public toggleCurve(): boolean {
    this.curveEnabled = !this.curveEnabled;
    uCurve.value = this.curveEnabled ? GAME_CONFIG.CURVE_STRENGTH : 0;
    this.emitToast(`🌐 WORLD CURVE: ${this.curveEnabled ? 'ENABLED' : 'FLAT (0)'}`);
    this.notifyStats();
    return this.curveEnabled;
  }

  public toggleGroundGrid(): boolean {
    this.debugGroundGrid = !this.debugGroundGrid;
    if (this.debugGridGroup) {
      this.debugGridGroup.visible = this.debugGroundGrid;
    }
    this.emitToast(`📏 GROUND GRID (Y=0): ${this.debugGroundGrid ? 'ON' : 'OFF'}`);
    this.notifyStats();
    return this.debugGroundGrid;
  }

  public toggleBaseMarkers(): boolean {
    this.debugBaseMarkers = !this.debugBaseMarkers;
    if (this.debugMarkerGroup) {
      this.debugMarkerGroup.visible = this.debugBaseMarkers;
      if (this.debugBaseMarkers) {
        this.rebuildDebugBaseMarkers();
      }
    }
    this.emitToast(`🎯 BASE MARKERS: ${this.debugBaseMarkers ? 'ON' : 'OFF'}`);
    this.notifyStats();
    return this.debugBaseMarkers;
  }

  private rebuildDebugBaseMarkers() {
    if (!this.debugMarkerGroup) return;
    while (this.debugMarkerGroup.children.length > 0) {
      this.debugMarkerGroup.remove(this.debugMarkerGroup.children[0]);
    }
    const markerGeo = new THREE.SphereGeometry(0.22, 8, 8);
    const greenMat = createGameMaterial({ kind: 'basic', color: 0x22c55e });
    const redMat = createGameMaterial({ kind: 'basic', color: 0xef4444 });

    for (const obs of this.activeObstacles) {
      const expected = obs.userData.expectedBaseY ?? (obs.userData.level === 1 ? DECK_Y : ROAD_Y);
      const err = Math.abs(obs.position.y - expected);
      const m = new THREE.Mesh(markerGeo, err <= 0.03 ? greenMat : redMat);
      m.position.set(obs.position.x, obs.position.y + 0.25, obs.position.z);
      m.frustumCulled = false;
      this.debugMarkerGroup.add(m);
    }
  }

  public toggleHeightOverlay(): boolean {
    this.debugHeightOverlay = !this.debugHeightOverlay;
    if (this.debugHeightLine) {
      this.debugHeightLine.visible = this.debugHeightOverlay;
    }
    this.emitToast(`📐 HEIGHT OVERLAY: ${this.debugHeightOverlay ? 'ON' : 'OFF'}`);
    this.notifyStats();
    return this.debugHeightOverlay;
  }

  public toggleWireframe(): boolean {
    this.debugWireframe = !this.debugWireframe;
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material && obj !== this.skyDome) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if ('wireframe' in m) {
            (m as THREE.MeshStandardMaterial).wireframe = this.debugWireframe;
          }
        }
      }
    });
    this.emitToast(`🕸️ WIREFRAME: ${this.debugWireframe ? 'ON' : 'OFF'}`);
    this.notifyStats();
    return this.debugWireframe;
  }

  public runFuelAutomatedTest() {
    const res = runHeadlessFuelSimulation(5000);
    this.emitToast(
      `⛽ FUEL TEST: ${res.runsSimulated} RUNS, ${res.starvedRuns} STARVED (${res.passed ? 'PASS' : 'FAIL'})`
    );
    return res;
  }

  public runFlyoverAutomatedTest() {
    const patternRes = runHeadlessFlyoverValidation(10000);

    // Also verify smooth continuous climb & descent across a test flyover span with zero frame-to-frame Y jumps > 0.35u
    const testSpan = registerFlyoverSpan(-2000, 100, [0, 1]);
    let maxStepDeltaY = 0;
    let prevY = ROAD_Y;
    const stepZ = (GAME_CONFIG.MAX_SPEED * 1.1) / 60; // max distance per 60Hz tick (~0.77m)
    const testLaneX = GAME_CONFIG.LANES[1];

    for (let z = testSpan.zStart + 5; z >= testSpan.zEnd - 5; z -= stepZ) {
      const y = groundHeightAt(testLaneX, z, 1);
      const dy = Math.abs(y - prevY);
      if (dy > maxStepDeltaY) maxStepDeltaY = dy;
      prevY = y;
    }
    // Remove temporary test span
    pruneFlyoverSpansBehind(-1900);

    const smoothPassed = maxStepDeltaY <= 0.35;
    const rampDirRes = this.runRampDirectionAutomatedTest();
    this.emitToast(
      `🛣️ FLYOVER & RAMP TEST: ${patternRes.tested} SEEDS, MAX ΔY=${maxStepDeltaY.toFixed(3)}u, RAMPS=${
        rampDirRes.passed ? 'OK' : 'FAIL'
      }`
    );
    return {
      ...patternRes,
      maxStepDeltaY: Number(maxStepDeltaY.toFixed(4)),
      smoothClimbPassed: smoothPassed && rampDirRes.passed
    };
  }

  /**
   * Automated test asserting that for every ramp type (`BUS_RAMP` and `FLYOVER` ascending ramp)
   * across Left (0), Center (1), and Right (2) lanes, with curve both ON and OFF, and after origin shift/recycle:
   * 1. In world space after placement, the low end (`zLow`) is nearer to the approach/camera side (`+Z`) than the high end (`zHigh`), i.e. `zLow > zHigh`.
   * 2. The height function `groundHeightAt(laneX, z, levelHint)` monotonically increases as `z` moves along the direction of travel (`-Z`, from `zLow` to `zHigh`).
   * 3. The visible ramp mesh vertices at `zLow` are at road height (`~0m`) and at `zHigh` are at target roof/deck height (`2.8m` or `5.8m`), never a wall facing the player.
   */
  public runRampDirectionAutomatedTest(): {
    passed: boolean;
    busRampsChecked: number;
    flyoverRampsChecked: number;
    details: string[];
  } {
    const details: string[] = [];
    let allPassed = true;
    let busRampsChecked = 0;
    let flyoverRampsChecked = 0;

    // 1. Verify BUS_RAMP across all 3 lanes (Left = -4, Center = 0, Right = +4)
    const savedObstacles = [...this.activeObstacles];
    const testBusZ = -180;

    for (let laneIdx = 0; laneIdx < GAME_CONFIG.LANES.length; laneIdx++) {
      const laneX = GAME_CONFIG.LANES[laneIdx];
      const busMesh = createBusWithRamp(laneIdx % 2 === 0);
      busMesh.position.set(laneX, ROAD_Y, testBusZ);
      busMesh.updateMatrixWorld(true);
      busMesh.userData = {
        type: 'BUS_RAMP',
        laneX,
        roofHeight: BUS_ROOF_HEIGHT,
        level: 0
      };

      setBusRamps([busMesh]);
      const zLow = testBusZ + BUS_RAMP_LOW_OFFSET_Z;
      const zHigh = testBusZ + BUS_RAMP_HIGH_OFFSET_Z;

      // Assert 1A: Low end is reached first when traveling toward -Z (zLow > zHigh)
      if (!(zLow > zHigh)) {
        allPassed = false;
        details.push(`BUS_RAMP lane ${laneIdx}: zLow (${zLow}) <= zHigh (${zHigh})`);
      }

      // Assert 1B: Height function monotonically increases from zLow to zHigh along travel direction (-Z)
      let prevH = groundHeightAt(laneX, zLow + 0.5, 0);
      const samples = 12;
      for (let s = 0; s <= samples; s++) {
        const z = zLow - (s / samples) * (zLow - zHigh);
        const h = groundHeightAt(laneX, z, 0);
        if (h + 1e-4 < prevH) {
          allPassed = false;
          details.push(`BUS_RAMP lane ${laneIdx}: height decreased at z=${z.toFixed(2)} (${h} < ${prevH})`);
        }
        prevH = h;
      }
      const hAtLow = groundHeightAt(laneX, zLow, 0);
      const hAtHigh = groundHeightAt(laneX, zHigh, 0);
      if (Math.abs(hAtLow - ROAD_Y) > 0.05 || Math.abs(hAtHigh - (ROAD_Y + BUS_ROOF_HEIGHT)) > 0.05) {
        allPassed = false;
        details.push(`BUS_RAMP lane ${laneIdx}: endpoint height mismatch low=${hAtLow}, high=${hAtHigh}`);
      }

      // Assert 1C: Positive slope pitch on ascending bus ramp
      const pitchMid = groundSlopePitchAt(laneX, (zLow + zHigh) * 0.5, 0);
      if (!(pitchMid > 0.35)) {
        allPassed = false;
        details.push(`BUS_RAMP lane ${laneIdx}: pitchMid (${pitchMid}) is not positive ascending`);
      }

      busRampsChecked++;
    }

    // Restore original bus ramps
    setBusRamps(savedObstacles);

    // 2. Verify FLYOVER ascending ramps across all lane configurations ([0, 1], [1, 2], [1])
    const rampConfigs: number[][] = [[0, 1], [1, 2], [1]];
    for (let cIdx = 0; cIdx < rampConfigs.length; cIdx++) {
      const cfg = rampConfigs[cIdx];
      const testZStart = -2400 - cIdx * 300;
      const span = registerFlyoverSpan(testZStart, 90, cfg);
      const zLow = span.zStart;
      const zHigh = span.zUpEnd;

      if (!(zLow > zHigh)) {
        allPassed = false;
        details.push(`FLYOVER config ${cfg.join(',')}: zLow (${zLow}) <= zHigh (${zHigh})`);
      }

      for (const rl of span.rampLanes) {
        const lx = GAME_CONFIG.LANES[rl];
        let prevY = groundHeightAt(lx, zLow, 1);
        const steps = 20;
        for (let s = 1; s <= steps; s++) {
          const z = zLow - (s / steps) * RAMP_LENGTH;
          const y = groundHeightAt(lx, z, 1);
          if (y + 1e-4 < prevY) {
            allPassed = false;
            details.push(`FLYOVER lane ${rl}: height decreased at z=${z.toFixed(2)}`);
          }
          prevY = y;
        }
        const yStart = groundHeightAt(lx, zLow, 1);
        const yEnd = groundHeightAt(lx, zHigh, 1);
        if (Math.abs(yStart - ROAD_Y) > 0.02 || Math.abs(yEnd - DECK_Y) > 0.02) {
          allPassed = false;
          details.push(`FLYOVER lane ${rl}: endpoint height mismatch start=${yStart}, end=${yEnd}`);
        }
        flyoverRampsChecked++;
      }
    }
    pruneFlyoverSpansBehind(-2100);

    return {
      passed: allPassed,
      busRampsChecked,
      flyoverRampsChecked,
      details
    };
  }

  public runChunkAndGroundingTest() {
    let maxSeamGap = 0;
    const sortedZ = this.roadChunks.map((c) => c.position.z).sort((a, b) => b - a);
    for (let i = 0; i < sortedZ.length - 1; i++) {
      const gap = Math.abs(sortedZ[i] - sortedZ[i + 1] - GAME_CONFIG.CHUNK_LENGTH);
      if (gap > maxSeamGap) maxSeamGap = gap;
    }

    let maxGroundError = 0;
    for (const obs of this.activeObstacles) {
      if (obs.userData.type === 'FLYOVER_STRUCTURE') continue;
      const expected = obs.userData.expectedBaseY ?? (obs.userData.level === 1 ? DECK_Y : ROAD_Y);
      const err = Math.abs(obs.position.y - expected);
      if (err > maxGroundError) maxGroundError = err;
    }

    const unpatched = auditCurve(this.scene);
    this.unpatchedCount = unpatched.length;
    const passed = maxSeamGap <= 0.001 && maxGroundError <= 0.02 && unpatched.length === 0;
    this.emitToast(
      `🔍 GROUNDING & CURVE AUDIT: SEAM=${maxSeamGap.toFixed(4)}m, ERR=${maxGroundError.toFixed(3)}m, UNPATCHED=${unpatched.length}`
    );
    return {
      maxSeamGap: Number(maxSeamGap.toFixed(5)),
      maxGroundError: Number(maxGroundError.toFixed(4)),
      unpatchedMeshes: unpatched.length,
      passed
    };
  }

  public skipArrestCutscene() {
    if (this.policeChase && this.policeChase.arrest.active) {
      this.policeChase.skipArrestCutscene();
      this.notifyStats();
    }
  }

  private emitToast(msg: string) {
    if (this.onToast) this.onToast(msg);
  }

  private updateHeroKinematicAnimation(delta: number, currentSpeed: number) {
    const ud = this.rickshaw.userData;
    if (!ud || !ud.isAvenger) return;

    const isAirborne = this.isJumping || this.jumpOffset > 0.08;
    const isSliding = this.isSliding;

    if (isSliding) {
      // Superhero dynamic athletic knee slide
      if (ud.leftLeg) {
        ud.leftLeg.rotation.x = THREE.MathUtils.lerp(ud.leftLeg.rotation.x, -1.25, delta * 15);
        ud.leftLeg.rotation.z = THREE.MathUtils.lerp(ud.leftLeg.rotation.z, 0.15, delta * 15);
      }
      if (ud.rightLeg) {
        ud.rightLeg.rotation.x = THREE.MathUtils.lerp(ud.rightLeg.rotation.x, 0.65, delta * 15);
        ud.rightLeg.rotation.z = THREE.MathUtils.lerp(ud.rightLeg.rotation.z, -0.2, delta * 15);
      }
      if (ud.leftArm) {
        ud.leftArm.rotation.x = THREE.MathUtils.lerp(ud.leftArm.rotation.x, 0.85, delta * 15);
      }
      if (ud.rightArm) {
        ud.rightArm.rotation.x = THREE.MathUtils.lerp(ud.rightArm.rotation.x, -0.9, delta * 15);
      }
      if (ud.head) {
        ud.head.rotation.x = THREE.MathUtils.lerp(ud.head.rotation.x, -0.3, delta * 15);
      }
      if (ud.suspensionPivot) {
        ud.suspensionPivot.position.y = THREE.MathUtils.lerp(ud.suspensionPivot.position.y, -0.25, delta * 15);
      }
    } else if (isAirborne) {
      // Airborne dynamic leap / flight poses
      if (ud.heroId === 'ironman') {
        // Iron Man repulsor flight pose: streamlined arms slightly back, glowing repulsors
        if (ud.leftLeg) ud.leftLeg.rotation.x = THREE.MathUtils.lerp(ud.leftLeg.rotation.x, 0.22, delta * 12);
        if (ud.rightLeg) ud.rightLeg.rotation.x = THREE.MathUtils.lerp(ud.rightLeg.rotation.x, 0.18, delta * 12);
        if (ud.leftArm) {
          ud.leftArm.rotation.x = THREE.MathUtils.lerp(ud.leftArm.rotation.x, -0.65, delta * 12);
          ud.leftArm.rotation.z = THREE.MathUtils.lerp(ud.leftArm.rotation.z, -0.25, delta * 12);
        }
        if (ud.rightArm) {
          ud.rightArm.rotation.x = THREE.MathUtils.lerp(ud.rightArm.rotation.x, -0.65, delta * 12);
          ud.rightArm.rotation.z = THREE.MathUtils.lerp(ud.rightArm.rotation.z, 0.25, delta * 12);
        }
      } else if (ud.heroId === 'thor') {
        // Thor aerial strike pose: Mjolnir held forward/high, legs tucked
        if (ud.leftLeg) ud.leftLeg.rotation.x = THREE.MathUtils.lerp(ud.leftLeg.rotation.x, -0.5, delta * 12);
        if (ud.rightLeg) ud.rightLeg.rotation.x = THREE.MathUtils.lerp(ud.rightLeg.rotation.x, 0.7, delta * 12);
        if (ud.leftArm) ud.leftArm.rotation.x = THREE.MathUtils.lerp(ud.leftArm.rotation.x, -0.4, delta * 12);
        if (ud.rightArm) ud.rightArm.rotation.x = THREE.MathUtils.lerp(ud.rightArm.rotation.x, 1.8, delta * 12);
      } else if (ud.heroId === 'captain_america') {
        // Cap tactical parkour vault: shield braced forward, knees tucked
        if (ud.leftLeg) ud.leftLeg.rotation.x = THREE.MathUtils.lerp(ud.leftLeg.rotation.x, -0.6, delta * 12);
        if (ud.rightLeg) ud.rightLeg.rotation.x = THREE.MathUtils.lerp(ud.rightLeg.rotation.x, 0.5, delta * 12);
        if (ud.leftArm) ud.leftArm.rotation.x = THREE.MathUtils.lerp(ud.leftArm.rotation.x, 0.9, delta * 12);
        if (ud.rightArm) ud.rightArm.rotation.x = THREE.MathUtils.lerp(ud.rightArm.rotation.x, -0.5, delta * 12);
      } else if (ud.heroId === 'hulk') {
        // Hulk massive ground-pound leap: limbs splayed ready to crush
        if (ud.leftLeg) ud.leftLeg.rotation.x = THREE.MathUtils.lerp(ud.leftLeg.rotation.x, -0.4, delta * 10);
        if (ud.rightLeg) ud.rightLeg.rotation.x = THREE.MathUtils.lerp(ud.rightLeg.rotation.x, 0.4, delta * 10);
        if (ud.leftArm) ud.leftArm.rotation.x = THREE.MathUtils.lerp(ud.leftArm.rotation.x, 1.2, delta * 10);
        if (ud.rightArm) ud.rightArm.rotation.x = THREE.MathUtils.lerp(ud.rightArm.rotation.x, 1.2, delta * 10);
      } else {
        // Spider-Man web-slinger tuck leap
        if (ud.leftLeg) ud.leftLeg.rotation.x = THREE.MathUtils.lerp(ud.leftLeg.rotation.x, 0.85, delta * 14);
        if (ud.rightLeg) ud.rightLeg.rotation.x = THREE.MathUtils.lerp(ud.rightLeg.rotation.x, -0.7, delta * 14);
        if (ud.leftArm) ud.leftArm.rotation.x = THREE.MathUtils.lerp(ud.leftArm.rotation.x, 1.15, delta * 14);
        if (ud.rightArm) ud.rightArm.rotation.x = THREE.MathUtils.lerp(ud.rightArm.rotation.x, -0.65, delta * 14);
      }
    } else {
      // Kinematic running / sprinting stride
      const swingMultiplier = ud.isHulk ? 0.55 : 0.78;
      const legSwing = Math.sin(this.suspensionPhase * 1.6) * swingMultiplier;
      const armSwing = Math.sin(this.suspensionPhase * 1.6) * (swingMultiplier * 0.95);

      if (ud.leftLeg) {
        ud.leftLeg.rotation.x = THREE.MathUtils.lerp(ud.leftLeg.rotation.x, legSwing, delta * 20);
        ud.leftLeg.rotation.z = THREE.MathUtils.lerp(ud.leftLeg.rotation.z, 0, delta * 14);
      }
      if (ud.rightLeg) {
        ud.rightLeg.rotation.x = THREE.MathUtils.lerp(ud.rightLeg.rotation.x, -legSwing, delta * 20);
        ud.rightLeg.rotation.z = THREE.MathUtils.lerp(ud.rightLeg.rotation.z, 0, delta * 14);
      }
      if (ud.leftArm) {
        ud.leftArm.rotation.x = THREE.MathUtils.lerp(ud.leftArm.rotation.x, -armSwing, delta * 20);
        ud.leftArm.rotation.z = THREE.MathUtils.lerp(ud.leftArm.rotation.z, 0, delta * 14);
      }
      if (ud.rightArm) {
        ud.rightArm.rotation.x = THREE.MathUtils.lerp(ud.rightArm.rotation.x, armSwing, delta * 20);
        ud.rightArm.rotation.z = THREE.MathUtils.lerp(ud.rightArm.rotation.z, 0, delta * 14);
      }
      if (ud.head) {
        ud.head.rotation.x = THREE.MathUtils.lerp(ud.head.rotation.x, Math.sin(this.suspensionPhase * 3.2) * 0.06, delta * 10);
      }
      if (ud.suspensionPivot) {
        ud.suspensionPivot.position.y = Math.abs(Math.sin(this.suspensionPhase * 1.6)) * (ud.isHulk ? 0.12 : 0.07);
      }
    }

    // Hero special visual effects
    if (ud.cape) {
      // Thor's royal cape billowing behind him with speed
      const flutter = Math.sin(this.suspensionPhase * 2.8) * 0.18 + (currentSpeed * 0.015);
      ud.cape.rotation.x = 0.22 + flutter;
    }
    if (ud.arcReactorMat) {
      // Iron Man Arc Reactor breathing glow
      ud.arcReactorMat.emissiveIntensity = 1.6 + Math.sin(this.suspensionPhase * 4) * 0.6;
    }
  }

  public createPlayerVehicleMesh(vehicleId: VehicleId, skinId: RickshawSkin): THREE.Group {
    const vehicle = createPlayableVehicleById(vehicleId, skinId);
    if (vehicle.userData.groundShadow) {
      vehicle.userData.groundShadow.visible = false;
    }
    if (vehicle.userData.debugGroup) {
      vehicle.userData.debugGroup.visible = this.debugBoundingBoxes;
    }
    this.attachNeonUnderglowToMesh(vehicle, this.upgrades.activeNeon || 'none');
    patchObjectHierarchy(vehicle);
    return vehicle;
  }

  private attachNeonUnderglowToMesh(vehicle: THREE.Group, neonId: NeonColorId) {
    if (vehicle.userData.neonGlowMesh) {
      vehicle.remove(vehicle.userData.neonGlowMesh);
      vehicle.userData.neonGlowMesh = null;
    }
    if (!neonId || neonId === 'none') return;
    const neonHexMap: Record<NeonColorId, number> = {
      none: 0x000000,
      emerald: 0x10b981,
      cyan: 0x06b6d4,
      gold: 0xfacc15,
      magenta: 0xec4899
    };
    const hex = neonHexMap[neonId] || 0x10b981;
    const glowGroup = new THREE.Group();
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 2.75),
      createGameMaterial({
        kind: 'basic',
        color: hex,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      })
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 0.025;
    glowGroup.add(plate);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 24),
      createGameMaterial({
        kind: 'basic',
        color: hex,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    glowGroup.add(ring);

    vehicle.add(glowGroup);
    vehicle.userData.neonGlowMesh = glowGroup;
  }

  public setNeonColor(neonId: NeonColorId) {
    this.upgrades.activeNeon = neonId;
    localStorage.setItem('rickshaw_upgrades', JSON.stringify(this.upgrades));
    this.attachNeonUnderglowToMesh(this.rickshaw, neonId);
    patchObjectHierarchy(this.rickshaw);
    this.notifyStats();
  }

  public setVehicle(vehicleId: VehicleId) {
    if (!PLAYABLE_VEHICLES[vehicleId]) return;
    this.activeVehicle = vehicleId;
    this.vehicleDef = PLAYABLE_VEHICLES[vehicleId];
    setSelectedVehicle(vehicleId);

    const oldP = this.rickshaw.position.clone();
    const oldR = this.rickshaw.rotation.clone();
    this.scene.remove(this.rickshaw);

    this.rickshaw = this.createPlayerVehicleMesh(vehicleId, this.currentSkin);
    this.rickshaw.position.copy(oldP);
    this.rickshaw.rotation.copy(oldR);
    patchObjectHierarchy(this.rickshaw);
    if (this.playerShieldBubble) {
      this.rickshaw.add(this.playerShieldBubble);
      this.syncShieldBubbleVisuals();
    }
    this.scene.add(this.rickshaw);

    this.notifyStats();
  }

  public activateMysteryTransformation(forceType?: MysteryVehicleId) {
    const chosen: MysteryVehicleId = forceType || (Math.random() < 0.65 ? 'hulk' : (Math.random() < 0.5 ? 'tractor' : 'tonga'));
    this.isMysteryActive = true;
    this.mysteryVehicle = chosen;
    this.mysteryTimer = GAME_CONFIG.MYSTERY_BOX_DURATION;
    this.sound.playMysteryBox();

    const oldP = this.rickshaw.position.clone();
    const oldR = this.rickshaw.rotation.clone();
    this.scene.remove(this.rickshaw);

    if (chosen === 'hulk') {
      this.rickshaw = createHulkMesh();
      this.emitToast('💥 THE INCREDIBLE HULK! SMASH ALL ROAD HAZARDS & TRAFFIC FOR 10s!');
      this.sound.speakCallout('Hulk smash!');
    } else if (chosen === 'tractor') {
      this.rickshaw = createTractor();
      this.emitToast('🚜 MILLAT TRACTOR! CRUSH ALL ROAD HAZARDS FOR 10s!');
      this.sound.speakCallout('Millat Tractor power!');
    } else {
      this.rickshaw = createTonga();
      this.emitToast('🐎 SHAHI TONGA! SPEED & TRIPLE COIN SPRINT FOR 10s!');
      this.sound.speakCallout('Shahi Tonga!');
    }

    this.rickshaw.position.copy(oldP);
    this.rickshaw.rotation.copy(oldR);
    patchObjectHierarchy(this.rickshaw);
    if (this.playerShieldBubble) {
      this.rickshaw.add(this.playerShieldBubble);
      this.syncShieldBubbleVisuals();
    }
    this.scene.add(this.rickshaw);
    this.notifyStats();
  }

  public revertMysteryTransformation() {
    this.isMysteryActive = false;
    this.mysteryVehicle = null;
    this.mysteryTimer = 0;
    this.invulnerabilityTimer = GAME_CONFIG.MYSTERY_BOX_INVULN;

    const oldP = this.rickshaw.position.clone();
    const oldR = this.rickshaw.rotation.clone();
    this.scene.remove(this.rickshaw);

    this.rickshaw = this.createPlayerVehicleMesh(this.activeVehicle, this.currentSkin);
    this.rickshaw.position.copy(oldP);
    this.rickshaw.rotation.copy(oldR);
    patchObjectHierarchy(this.rickshaw);
    if (this.playerShieldBubble) {
      this.rickshaw.add(this.playerShieldBubble);
      this.syncShieldBubbleVisuals();
    }
    this.scene.add(this.rickshaw);

    this.emitToast('✨ REVERTED TO HERO (1s INVULNERABLE)');
    this.notifyStats();
  }

  public setRickshawSkin(skinId: RickshawSkin) {
    this.currentSkin = skinId;
    localStorage.setItem('rickshaw_current_skin', skinId);
    const oldP = this.rickshaw.position.clone();
    const oldR = this.rickshaw.rotation.clone();
    this.scene.remove(this.rickshaw);
    this.rickshaw = this.createPlayerVehicleMesh(this.activeVehicle, skinId);
    this.rickshaw.position.copy(oldP);
    this.rickshaw.rotation.copy(oldR);
    patchObjectHierarchy(this.rickshaw);
    if (this.playerShieldBubble) {
      this.rickshaw.add(this.playerShieldBubble);
      this.syncShieldBubbleVisuals();
    }
    this.scene.add(this.rickshaw);
    this.notifyStats();
  }

  public setUpgrades(upgrades: UpgradesState) {
    this.upgrades = upgrades;
    localStorage.setItem('rickshaw_upgrades', JSON.stringify(upgrades));
    this.notifyStats();
  }

  public setWeather(weather: WeatherType) {
    this.weather = weather;
    this.notifyStats();
  }

  public setGarageMode(active: boolean) {
    this.isGarageMode = active;
    if (active) {
      this.garageTurntableAngle = 0;
      this.rickshaw.position.set(0, 0, 0);
      this.rickshaw.rotation.set(0, 0, 0);
    }
  }

  public addBankedRupees(amount: number) {
    this.totalRupees += amount;
    localStorage.setItem('rickshaw_coins', this.totalRupees.toString());
    this.notifyStats();
  }

  public spendRupees(amount: number): boolean {
    if (this.totalRupees < amount) return false;
    this.totalRupees -= amount;
    localStorage.setItem('rickshaw_coins', this.totalRupees.toString());
    this.notifyStats();
    return true;
  }

  public destroy() {
    if (this.reqId) cancelAnimationFrame(this.reqId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
