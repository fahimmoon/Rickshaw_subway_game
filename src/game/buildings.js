import * as THREE from 'three';
import { patchObjectHierarchy } from './curve';

// ============================================================================
// BUILDING_CONFIG — Tunables, Palettes, Layer Offsets & 12 Building Specs
// ============================================================================
export const BUILDING_CONFIG = {
  CHUNK_LENGTH: 40,
  // 3 Depth Layers behind the shop rows (shops occupy X = 11.4 to 16.0m)
  NEAR_LAYER_X: 19.2,      // Peeks between shop gaps / replaces/sits right behind shops
  MID_LAYER_X: 26.8,       // Main multi-story skyline directly behind the 1-3 floor shops
  FAR_LOD_LAYER_X: 40.5,   // Far horizon low-poly LOD silhouettes fading into haze
  SET_PIECE_MIN_DIST: 160, // Set-piece every 160-240m (4-6 chunks)
  SET_PIECE_MAX_DIST: 240,
  POOL_MAX_PER_TYPE: 6,
  NIGHT_LIT_WINDOW_RATIO: 0.4, // ~40% of windows glow warm at night

  // Wall Color Palettes
  WALL_COLORS: {
    APARTMENT: [
      0xf5ead6, // Warm cream
      0xf2cbd0, // Dusty Karachi pink
      0xb8e2dc, // Faded turquoise
      0xf3d58d, // Mustard ochre
      0xcce3cb, // Light pista green
      0xd99b82  // Faded brick terracotta
    ],
    COLONIAL: [
      0xa84232, // Anglo-Mughal red brick
      0xd49b6a, // Empress Market Jodhpuri sandstone
      0xc26d51  // Weathered terracotta stone
    ],
    PLAZA: [
      0xe2e8f0, // Modern silver-white Alucobond
      0xcbd5e1, // Cool concrete grey
      0xfef3c7  // Cream commercial facade
    ],
    MOSQUE: [
      0xfafaf9, // Crisp white marble
      0xfef9c3  // Soft cream limestone
    ],
    HOSPITAL: [
      0xf8fafc, // Clinical white
      0xf1f5f9  // Soft cool white
    ],
    SCHOOL: [
      0xfde68a, // Government school yellow-cream
      0xfed7aa, // Warm sandstone buff
      0xe2cfc4  // Chalky rose-beige
    ],
    BANK: [
      0x94a3b8, // Corporate slate concrete
      0xcbd5e1, // Architectural precast grey
      0xd6d3d1  // Warm granite grey
    ],
    WEDDING: [
      0xfef3c7, // Royal cream & gold
      0xfce7f3, // Rose palace pastel
      0xfaf5ff  // Ivory pearl
    ]
  },

  // All 12 Building Types organized by Stage
  BUILDING_TYPES: {
    // Stage 1
    APARTMENT_BLOCK: 'APARTMENT_BLOCK',
    COLONIAL_BUILDING: 'COLONIAL_BUILDING',
    SHOPPING_PLAZA: 'SHOPPING_PLAZA',
    // Stage 2
    MOSQUE: 'MOSQUE',
    HOSPITAL: 'HOSPITAL',
    SCHOOL_COLLEGE: 'SCHOOL_COLLEGE',
    BANK_TOWER: 'BANK_TOWER',
    // Stage 3
    WEDDING_HALL: 'WEDDING_HALL',
    CONSTRUCTION_SITE: 'CONSTRUCTION_SITE',
    PETROL_CNG_STATION: 'PETROL_CNG_STATION',
    OLD_CITY_GATE: 'OLD_CITY_GATE',
    FORT_MONUMENT: 'FORT_MONUMENT'
  },

  STAGE_GROUPS: {
    1: ['APARTMENT_BLOCK', 'COLONIAL_BUILDING', 'SHOPPING_PLAZA'],
    2: ['MOSQUE', 'HOSPITAL', 'SCHOOL_COLLEGE', 'BANK_TOWER'],
    3: ['WEDDING_HALL', 'CONSTRUCTION_SITE', 'PETROL_CNG_STATION', 'OLD_CITY_GATE', 'FORT_MONUMENT']
  },

  SET_PIECE_TYPES: [
    'MOSQUE',
    'SHOPPING_PLAZA',
    'OLD_CITY_GATE',
    'FORT_MONUMENT',
    'PETROL_CNG_STATION',
    'WEDDING_HALL'
  ],

  WALL_ADS: [
    { brand: 'SHALIMAR CEMENT', tag: 'MAZBOOT BUNYAD • SOLID PAKISTAN', bg: '#b91c1c', fg: '#fef08a', accent: '#ffffff' },
    { brand: 'KHYBER SUPREME TEA', tag: 'HAR PIALI MEIN KHAALIS RANG', bg: '#065f46', fg: '#ffffff', accent: '#facc15' },
    { brand: 'MEHRAN DELUXE FANS', tag: '100% COPPER • DOUBLE HAAWA', bg: '#1e3a8a', fg: '#38bdf8', accent: '#ffffff' },
    { brand: 'AL-NOOR HOUSING', tag: 'EASY MONTHLY INSTALLMENTS', bg: '#7c2d12', fg: '#fde047', accent: '#fed7aa' }
  ],

  ROOFTOP_BRANDS: [
    { title: 'PAK STATE BANK', sub: 'ISLAMIC & COMMERCIAL BANKING', bg: '#0f172a', fg: '#38bdf8', border: '#facc15' },
    { title: 'HABIB TRADE TOWER', sub: 'I.I. CHUNDRIGAR CORPORATE', bg: '#064e3b', fg: '#fde047', border: '#34d399' },
    { title: 'INDUS TELECOM 5G', sub: 'FASTEST NETWORK IN PAKISTAN', bg: '#7f1d1d', fg: '#ffffff', border: '#facc15' }
  ]
};

export const BUILDING_TYPE_KEYS = Object.values(BUILDING_CONFIG.BUILDING_TYPES);

// ============================================================================
// SEEDED PRNG
// ============================================================================
function createSeededRandom(seed = 101) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ============================================================================
// SHARED GEOMETRIES & MATERIALS (Zero per-building geometry churn)
// ============================================================================
const SHARED_GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  dome: new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65),
  sphere: new THREE.SphereGeometry(0.5, 7, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  plane: new THREE.PlaneGeometry(1, 1),
  ring: new THREE.TorusGeometry(0.32, 0.06, 6, 8, Math.PI * 1.45)
};

function freezeStaticBuildingMeshes(group) {
  const craneJib = group.userData?.craneJib;
  group.traverse((child) => {
    if (child === group || child === craneJib || child.parent === craneJib) return;
    child.updateMatrix();
    child.matrixAutoUpdate = false;
  });
}

const _matCache = new Map();
function getLambert(hex, extra = {}) {
  const key = `${hex}_${ extra.emissive || 0 }_${ extra.opacity || 1 }_${ extra.side || 0 }_${ extra.polygonOffset ? 1 : 0 }`;
  if (!_matCache.has(key)) {
    const mat = new THREE.MeshLambertMaterial({
      color: hex,
      flatShading: false,
      polygonOffset: Boolean(extra.polygonOffset),
      polygonOffsetFactor: extra.polygonOffset ? -1 : 0,
      polygonOffsetUnits: extra.polygonOffset ? -2 : 0,
      ...extra
    });
    patchObjectHierarchy(new THREE.Mesh(SHARED_GEO.box, mat));
    _matCache.set(key, mat);
  }
  return _matCache.get(key);
}

// Shared Night-Reactive Emissive Materials (toggled globally in O(1) by setNight)
const NIGHT_MATERIALS = {
  windowLitWarm: new THREE.MeshBasicMaterial({ color: 0x94a3b8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  windowLitCool: new THREE.MeshBasicMaterial({ color: 0x64748b, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  windowDark: getLambert(0x1e293b, { polygonOffset: true }),
  minaretCrescent: new THREE.MeshBasicMaterial({ color: 0x10b981 }),
  hospitalCross: new THREE.MeshBasicMaterial({ color: 0xef4444, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  weddingLedPink: new THREE.MeshBasicMaterial({ color: 0xec4899, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  weddingLedCyan: new THREE.MeshBasicMaterial({ color: 0x06b6d4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  weddingLedGold: new THREE.MeshBasicMaterial({ color: 0xfacc15, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  lanternGlow: new THREE.MeshBasicMaterial({ color: 0xd97706 }),
  petrolCanopyEdge: new THREE.MeshBasicMaterial({ color: 0x22c55e, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
};

// Pre-patch night materials for world curve shader
Object.values(NIGHT_MATERIALS).forEach((m) => {
  patchObjectHierarchy(new THREE.Mesh(SHARED_GEO.box, m));
});

let _isNightMode = false;

// ============================================================================
// PROCEDURAL CANVASTEXTURE GENERATORS (Cached)
// ============================================================================
const _texCache = new Map();

/**
 * Weathered building facade texture with bottom dirt/grime gradient,
 * vertical rain stain streaks, and subtle plaster mottling.
 */
function getWeatheredFacadeTexture(hexColor) {
  const key = `facade_${hexColor.toString(16)}`;
  if (_texCache.has(key)) return _texCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const c = new THREE.Color(hexColor);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);

  // Base vertical gradient: faded top, main tone middle, dark street grime bottom
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0.0, `rgb(${Math.max(0, r - 22)}, ${Math.max(0, g - 22)}, ${Math.max(0, b - 22)})`);
  grad.addColorStop(0.18, `rgb(${r}, ${g}, ${b})`);
  grad.addColorStop(0.82, `rgb(${Math.max(0, r - 12)}, ${Math.max(0, g - 12)}, ${Math.max(0, b - 12)})`);
  grad.addColorStop(1.0, `rgb(${Math.max(0, r - 58)}, ${Math.max(0, g - 55)}, ${Math.max(0, b - 50)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);

  // Subtle horizontal floor slab lines
  ctx.fillStyle = 'rgba(0,0,0,0.09)';
  for (let y = 16; y < 128; y += 22) {
    ctx.fillRect(0, y, 64, 2);
  }

  // Vertical rain & AC drip stain streaks
  ctx.fillStyle = 'rgba(35,30,25,0.12)';
  ctx.fillRect(11, 0, 3, 75);
  ctx.fillRect(39, 12, 4, 90);
  ctx.fillRect(52, 0, 2, 60);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshLambertMaterial({ map: tex, flatShading: false });
  patchObjectHierarchy(new THREE.Mesh(SHARED_GEO.box, mat));
  _texCache.set(key, mat);
  return mat;
}

/**
 * Painted billboard / signboard CanvasTexture
 */
function getSignBannerMaterial(keyId, cfg) {
  if (_texCache.has(keyId)) return _texCache.get(keyId);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = cfg.bg || '#1e3a8a';
  ctx.fillRect(0, 0, 256, 64);

  ctx.strokeStyle = cfg.border || '#facc15';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 250, 58);

  ctx.fillStyle = cfg.fg || '#ffffff';
  ctx.font = '900 22px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cfg.title, 128, 30);

  ctx.fillStyle = cfg.subColor || '#fde047';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.fillText(cfg.sub || '', 128, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  patchObjectHierarchy(new THREE.Mesh(SHARED_GEO.plane, mat));
  _texCache.set(keyId, mat);
  return mat;
}

/**
 * Colonial Clock Face CanvasTexture
 */
function getClockFaceMaterial() {
  const key = 'colonial_clock_face';
  if (_texCache.has(key)) return _texCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Hour ticks
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(32 + Math.cos(a) * 21, 32 + Math.sin(a) * 21);
    ctx.lineTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26);
    ctx.stroke();
  }

  // Hands at 10:10
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(20, 22);
  ctx.moveTo(32, 32);
  ctx.lineTo(46, 20);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  patchObjectHierarchy(new THREE.Mesh(SHARED_GEO.plane, mat));
  _texCache.set(key, mat);
  return mat;
}

// ============================================================================
// INSTANCED FACADE & ROOF CLUTTER HELPERS (Keeps each building < 40 meshes)
// ============================================================================
const _dummy = new THREE.Object3D();

/**
 * Populates a grid of windows across a building facade using ONLY 2 InstancedMeshes
 * (one for lit night windows ~40%, one for dark windows ~60%) + optional InstancedMesh
 * for balconies or window AC units.
 */
function addInstancedWindowsAndBalconies(group, opts) {
  const {
    width,
    floors,
    floorHeight = 2.8,
    startY = 3.2,
    frontZ,
    cols = 4,
    rng,
    style = 'GRILLE', // 'ARCHED' | 'GRILLE' | 'JHAROKA' | 'GLASS'
    addBalconies = false,
    addACs = false,
    balconyColor = 0xe2e8f0
  } = opts;

  const litTransforms = [];
  const darkTransforms = [];
  const frameTransforms = [];
  const balconyTransforms = [];
  const acTransforms = [];

  const colSpacing = (width * 0.78) / Math.max(1, cols - 1);
  const startX = -((cols - 1) * colSpacing) * 0.5;

  const winW = style === 'GLASS' ? colSpacing * 0.78 : 1.05;
  const winH = style === 'ARCHED' ? 1.45 : style === 'GLASS' ? 1.75 : 1.25;

  for (let f = 0; f < floors; f++) {
    const wy = startY + f * floorHeight;
    for (let c = 0; c < cols; c++) {
      const wx = cols === 1 ? 0 : startX + c * colSpacing;
      const isLit = rng() < BUILDING_CONFIG.NIGHT_LIT_WINDOW_RATIO;

      _dummy.position.set(wx, wy, frontZ + 0.06);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(winW, winH, 0.08);
      _dummy.updateMatrix();
      if (isLit) {
        litTransforms.push(_dummy.matrix.clone());
      } else {
        darkTransforms.push(_dummy.matrix.clone());
      }

      // Window sill / jharoka / arch hood frame
      _dummy.position.set(wx, wy + (style === 'ARCHED' ? winH * 0.52 : -winH * 0.52), frontZ + 0.14);
      _dummy.scale.set(winW + 0.22, style === 'JHAROKA' ? 0.35 : 0.16, style === 'JHAROKA' ? 0.42 : 0.24);
      _dummy.updateMatrix();
      frameTransforms.push(_dummy.matrix.clone());

      if (addBalconies && (c + f) % 2 === 0) {
        _dummy.position.set(wx, wy - winH * 0.38, frontZ + 0.52);
        _dummy.scale.set(winW + 0.55, 0.72, 0.85);
        _dummy.updateMatrix();
        balconyTransforms.push(_dummy.matrix.clone());
      }

      if (addACs && rng() < 0.42) {
        _dummy.position.set(wx + winW * 0.58, wy - 0.2, frontZ + 0.28);
        _dummy.scale.set(0.62, 0.44, 0.48);
        _dummy.updateMatrix();
        acTransforms.push(_dummy.matrix.clone());
      }
    }
  }

  if (litTransforms.length > 0) {
    const litMat = style === 'GLASS' ? NIGHT_MATERIALS.windowLitCool : NIGHT_MATERIALS.windowLitWarm;
    const instLit = new THREE.InstancedMesh(SHARED_GEO.box, litMat, litTransforms.length);
    litTransforms.forEach((m, i) => instLit.setMatrixAt(i, m));
    instLit.instanceMatrix.needsUpdate = true;
    group.add(instLit);
  }

  if (darkTransforms.length > 0) {
    const instDark = new THREE.InstancedMesh(SHARED_GEO.box, NIGHT_MATERIALS.windowDark, darkTransforms.length);
    darkTransforms.forEach((m, i) => instDark.setMatrixAt(i, m));
    instDark.instanceMatrix.needsUpdate = true;
    group.add(instDark);
  }

  if (frameTransforms.length > 0) {
    const instFrame = new THREE.InstancedMesh(SHARED_GEO.box, getLambert(0xf8fafc), frameTransforms.length);
    frameTransforms.forEach((m, i) => instFrame.setMatrixAt(i, m));
    instFrame.instanceMatrix.needsUpdate = true;
    group.add(instFrame);
  }

  if (balconyTransforms.length > 0) {
    const instBalc = new THREE.InstancedMesh(SHARED_GEO.box, getLambert(balconyColor), balconyTransforms.length);
    balconyTransforms.forEach((m, i) => instBalc.setMatrixAt(i, m));
    instBalc.instanceMatrix.needsUpdate = true;
    group.add(instBalc);
  }

  if (acTransforms.length > 0) {
    const instAC = new THREE.InstancedMesh(SHARED_GEO.box, getLambert(0xcbd5e1), acTransforms.length);
    acTransforms.forEach((m, i) => instAC.setMatrixAt(i, m));
    instAC.instanceMatrix.needsUpdate = true;
    group.add(instAC);
  }
}

/**
 * Adds authentic Pakistani rooftop clutter:
 * - Blue/black cylindrical water tanks
 * - Stairwell roof shed (mumty)
 * - Satellite dish or tilted blue solar panel
 * - TV antenna with a colorful diamond kite (patang) stuck on top
 * - Clothesline with hanging laundry sheets
 */
function addRooftopClutter(group, width, depth, roofY, rng) {
  // 1. Parapet wall around roof edge
  const parapet = new THREE.Mesh(SHARED_GEO.box, getLambert(0xd6d3d1));
  parapet.scale.set(width + 0.25, 0.75, depth + 0.25);
  parapet.position.set(0, roofY + 0.35, 0);
  group.add(parapet);

  // 2. Stairwell shed (Mumty) on one side of the roof
  const shedW = Math.min(2.6, width * 0.28);
  const shed = new THREE.Mesh(SHARED_GEO.box, getLambert(0xe7e5e4));
  shed.scale.set(shedW, 2.2, 2.4);
  shed.position.set(-width * 0.28, roofY + 1.1, -depth * 0.15);
  group.add(shed);

  // 3. Blue plastic rooftop water tank on top of the mumty or roof
  const tank = new THREE.Mesh(SHARED_GEO.cyl, getLambert(0x0284c7));
  tank.scale.set(1.15, 1.45, 1.15);
  tank.position.set(-width * 0.28, roofY + 2.9, -depth * 0.15);
  group.add(tank);

  // 4. Satellite Dish or Solar Panel
  if (rng() < 0.55) {
    // Angled blue solar panel array
    const solar = new THREE.Mesh(SHARED_GEO.box, getLambert(0x1d4ed8));
    solar.scale.set(2.1, 0.1, 1.4);
    solar.position.set(width * 0.22, roofY + 1.05, depth * 0.12);
    solar.rotation.x = 0.42;
    group.add(solar);
  } else {
    // Parabolic satellite dish
    const dish = new THREE.Mesh(SHARED_GEO.dome, getLambert(0xe2e8f0));
    dish.scale.set(1.2, 0.5, 1.2);
    dish.position.set(width * 0.24, roofY + 1.2, depth * 0.18);
    dish.rotation.x = -0.8;
    group.add(dish);
  }

  // 5. TV Antenna pole + Diamond Kite (Patang) tangled on top
  const antPole = new THREE.Mesh(SHARED_GEO.cyl, getLambert(0x475569));
  antPole.scale.set(0.08, 3.2, 0.08);
  antPole.position.set(width * 0.32, roofY + 1.6, -depth * 0.18);
  group.add(antPole);

  const kiteColors = [0xef4444, 0xfacc15, 0xec4899, 0x06b6d4];
  const kite = new THREE.Mesh(SHARED_GEO.box, getLambert(kiteColors[Math.floor(rng() * kiteColors.length)]));
  kite.scale.set(0.65, 0.65, 0.06);
  kite.position.set(width * 0.34, roofY + 2.95, -depth * 0.15);
  kite.rotation.set(0.2, 0.3, Math.PI * 0.25);
  group.add(kite);

  // 6. Hanging Laundry / Clothesline on roof
  if (rng() < 0.65) {
    const clothColors = [0xf43f5e, 0x38bdf8, 0xfde047, 0xa855f7];
    for (let i = 0; i < 3; i++) {
      const sheet = new THREE.Mesh(SHARED_GEO.box, getLambert(clothColors[(i + Math.floor(rng() * 4)) % 4]));
      sheet.scale.set(0.75, 0.95, 0.06);
      sheet.position.set(-0.6 + i * 0.85, roofY + 1.15, depth * 0.28);
      group.add(sheet);
    }
  }
}

/**
 * Adds a painted wall advertisement board on one of the side/upper walls
 */
function addPaintedWallAd(group, width, height, depth, rng) {
  if (rng() > 0.55) return;
  const adIdx = Math.floor(rng() * BUILDING_CONFIG.WALL_ADS.length);
  const adDef = BUILDING_CONFIG.WALL_ADS[adIdx];
  const mat = getSignBannerMaterial(`wall_ad_${adIdx}`, {
    title: adDef.brand,
    sub: adDef.tag,
    bg: adDef.bg,
    fg: adDef.fg,
    border: adDef.accent
  });

  const adPlane = new THREE.Mesh(SHARED_GEO.plane, mat);
  adPlane.scale.set(Math.min(4.8, width * 0.58), 1.65, 1);
  adPlane.position.set(0, Math.max(4.5, height * 0.68), depth * 0.5 + 0.09);
  group.add(adPlane);
}

// ============================================================================
// STAGE 1: APARTMENT_BLOCK, COLONIAL_BUILDING, SHOPPING_PLAZA
// ============================================================================

/**
 * 1. Residential Apartment Block (4-6 floors):
 * Balconies with railings, window ACs, hanging laundry, water tanks & kite antenna on roof,
 * stairwell vertical strip on the side, stepped upper roof, and ~40% night-lit windows.
 */
function buildApartmentBlock(group, rng) {
  const floors = 4 + Math.floor(rng() * 3); // 4 to 6 floors
  const floorH = 2.75;
  const width = 9.5 + rng() * 3.0;
  const depth = 6.8 + rng() * 1.4;
  const mainH = floors * floorH + 1.2;

  const colors = BUILDING_CONFIG.WALL_COLORS.APARTMENT;
  const wallHex = colors[Math.floor(rng() * colors.length)];
  const wallMat = getWeatheredFacadeTexture(wallHex);

  // Main Apartment Mass
  const body = new THREE.Mesh(SHARED_GEO.box, wallMat);
  body.scale.set(width, mainH, depth);
  body.position.set(0, mainH * 0.5, 0);
  group.add(body);

  // Stepped Setback Penthouse Wing on top for varied skyline silhouette
  const stepW = width * 0.55;
  const stepH = 2.6;
  const stepWing = new THREE.Mesh(SHARED_GEO.box, wallMat);
  stepWing.scale.set(stepW, stepH, depth * 0.78);
  stepWing.position.set(width * 0.16, mainH + stepH * 0.5, -0.3);
  group.add(stepWing);

  // Vertical Stairwell Strip on the left side with vertical glass slot
  const stairW = 2.1;
  const stairTower = new THREE.Mesh(SHARED_GEO.box, getLambert(0xe7e5e4));
  stairTower.scale.set(stairW, mainH + 1.8, depth + 0.35);
  stairTower.position.set(-width * 0.5 + stairW * 0.42, (mainH + 1.8) * 0.5, 0.12);
  group.add(stairTower);

  const stairGlass = new THREE.Mesh(SHARED_GEO.box, NIGHT_MATERIALS.windowLitWarm);
  stairGlass.scale.set(0.65, mainH - 2.2, 0.12);
  stairGlass.position.set(-width * 0.5 + stairW * 0.42, mainH * 0.5 + 0.5, depth * 0.5 + 0.32);
  group.add(stairGlass);

  // Instanced Windows, Balconies & Window ACs across the main facade
  const winStyles = ['GRILLE', 'JHAROKA', 'ARCHED'];
  addInstancedWindowsAndBalconies(group, {
    width: width - stairW,
    floors,
    floorHeight: floorH,
    startY: 3.1,
    frontZ: depth * 0.5,
    cols: 4,
    rng,
    style: winStyles[Math.floor(rng() * winStyles.length)],
    addBalconies: true,
    addACs: true,
    balconyColor: 0xfef3c7
  });

  // Hanging colorful laundry dupattas/sheets draped over 2 balconies
  const dupattaColors = [0xec4899, 0x06b6d4, 0xfacc15, 0x22c55e];
  for (let i = 0; i < 3; i++) {
    const cloth = new THREE.Mesh(SHARED_GEO.box, getLambert(dupattaColors[i % dupattaColors.length]));
    cloth.scale.set(0.85, 0.75, 0.08);
    cloth.position.set(-1.2 + i * 2.1, 3.1 + (i % floors) * floorH - 0.65, depth * 0.5 + 0.96);
    group.add(cloth);
  }

  addPaintedWallAd(group, width, mainH, depth, rng);
  addRooftopClutter(group, width, depth, mainH, rng);

  group.userData.footprintW = width + 1.2;
  group.userData.buildingH = mainH + stepH;
}

/**
 * 2. Old Colonial Building (Empress Market / Anglo-Mughal Heritage style):
 * Red-brick or sandstone, arched windows, decorative cornice, clock tower + flag on top,
 * classical columns at the entrance, and a wide stone stair.
 */
function buildColonialBuilding(group, rng) {
  const floors = 3;
  const floorH = 3.25;
  const width = 12.2;
  const depth = 7.4;
  const mainH = floors * floorH + 1.4;

  const colors = BUILDING_CONFIG.WALL_COLORS.COLONIAL;
  const wallHex = colors[Math.floor(rng() * colors.length)];
  const wallMat = getWeatheredFacadeTexture(wallHex);
  const trimMat = getLambert(0xfef3c7); // Cream limestone heritage trim

  // Main Heritage Block
  const body = new THREE.Mesh(SHARED_GEO.box, wallMat);
  body.scale.set(width, mainH, depth);
  body.position.set(0, mainH * 0.5, 0);
  group.add(body);

  // Decorative White/Cream Cornices at mid-level and roofline
  [mainH * 0.36, mainH].forEach((cy) => {
    const cornice = new THREE.Mesh(SHARED_GEO.box, trimMat);
    cornice.scale.set(width + 0.55, 0.45, depth + 0.55);
    cornice.position.set(0, cy, 0);
    group.add(cornice);
  });

  // Entrance Portico with 4 Columns & Wide Stepped Stair
  const stair1 = new THREE.Mesh(SHARED_GEO.box, getLambert(0xd6d3d1));
  stair1.scale.set(5.4, 0.35, 1.8);
  stair1.position.set(0, 0.175, depth * 0.5 + 0.8);
  group.add(stair1);

  const stair2 = new THREE.Mesh(SHARED_GEO.box, getLambert(0xe7e5e4));
  stair2.scale.set(4.6, 0.35, 1.2);
  stair2.position.set(0, 0.52, depth * 0.5 + 0.55);
  group.add(stair2);

  // 4 Classical Columns batched in 1 InstancedMesh
  const colInst = new THREE.InstancedMesh(SHARED_GEO.cyl, trimMat, 4);
  [-1.9, -0.7, 0.7, 1.9].forEach((cx, idx) => {
    _dummy.position.set(cx, 2.1, depth * 0.5 + 0.65);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(0.38, 3.2, 0.38);
    _dummy.updateMatrix();
    colInst.setMatrixAt(idx, _dummy.matrix);
  });
  colInst.instanceMatrix.needsUpdate = true;
  group.add(colInst);

  // Portico Pediment Roof
  const pediment = new THREE.Mesh(SHARED_GEO.box, trimMat);
  pediment.scale.set(4.8, 0.55, 1.5);
  pediment.position.set(0, 3.85, depth * 0.5 + 0.55);
  group.add(pediment);

  // Central Clock Tower Turret on the Roof
  const towerH = 3.8;
  const clockTower = new THREE.Mesh(SHARED_GEO.box, wallMat);
  clockTower.scale.set(3.1, towerH, 2.8);
  clockTower.position.set(0, mainH + towerH * 0.5, depth * 0.15);
  group.add(clockTower);

  const towerDome = new THREE.Mesh(SHARED_GEO.dome, trimMat);
  towerDome.scale.set(2.8, 1.8, 2.6);
  towerDome.position.set(0, mainH + towerH, depth * 0.15);
  group.add(towerDome);

  // Clock Face CanvasTexture
  const clockFace = new THREE.Mesh(SHARED_GEO.plane, getClockFaceMaterial());
  clockFace.scale.set(1.55, 1.55, 1);
  clockFace.position.set(0, mainH + towerH * 0.55, depth * 0.15 + 1.44);
  group.add(clockFace);

  // Flagpole + Pakistani Flag on top of the Clock Tower
  const flagPole = new THREE.Mesh(SHARED_GEO.cyl, getLambert(0xf8fafc));
  flagPole.scale.set(0.09, 2.4, 0.09);
  flagPole.position.set(0, mainH + towerH + 1.6, depth * 0.15);
  group.add(flagPole);

  const flag = new THREE.Mesh(SHARED_GEO.box, getLambert(0x15803d));
  flag.scale.set(1.25, 0.75, 0.06);
  flag.position.set(0.62, mainH + towerH + 2.35, depth * 0.15);
  group.add(flag);

  // Arched Heritage Windows across all 3 floors
  addInstancedWindowsAndBalconies(group, {
    width,
    floors: 3,
    floorHeight: floorH,
    startY: 3.1,
    frontZ: depth * 0.5,
    cols: 5,
    rng,
    style: 'ARCHED',
    addBalconies: false,
    addACs: false
  });

  group.userData.footprintW = width + 1.4;
  group.userData.buildingH = mainH + towerH + 2.5;
}

/**
 * 3. Shopping Plaza (Gul Plaza / Saddar Commercial Mall):
 * Glass curtain front with metal frame, big glowing LED screen/billboard,
 * sloped parking ramp on the side, rooftop flag bunting line, and colorful "SALE" banner.
 */
function buildShoppingPlaza(group, rng) {
  const floors = 4;
  const floorH = 3.1;
  const width = 12.6;
  const depth = 7.6;
  const mainH = floors * floorH + 1.2;

  const body = new THREE.Mesh(SHARED_GEO.box, getWeatheredFacadeTexture(0xe2e8f0));
  body.scale.set(width, mainH, depth);
  body.position.set(0, mainH * 0.5, 0);
  group.add(body);

  // Blue-Teal Glass Curtain Wall Front with dark metal frame
  const glassFrame = new THREE.Mesh(SHARED_GEO.box, getLambert(0x0f172a));
  glassFrame.scale.set(width * 0.84, mainH * 0.78, 0.25);
  glassFrame.position.set(-0.6, mainH * 0.52, depth * 0.5 + 0.05);
  group.add(glassFrame);

  addInstancedWindowsAndBalconies(group, {
    width: width * 0.8,
    floors: 3,
    floorHeight: 3.0,
    startY: 4.2,
    frontZ: depth * 0.5 + 0.14,
    cols: 5,
    rng,
    style: 'GLASS',
    addBalconies: false,
    addACs: false
  });

  // Big Glowing LED Billboard Screen on the upper facade
  const ledBoardMat = getSignBannerMaterial('plaza_led_screen', {
    title: 'GUL PLAZA SHOPPING MALL',
    sub: 'ELECTRONICS • GOLD • CLOTHING • AC MARKET',
    bg: '#0284c7',
    fg: '#ffffff',
    border: '#facc15'
  });
  const ledScreen = new THREE.Mesh(SHARED_GEO.plane, ledBoardMat);
  ledScreen.scale.set(7.6, 2.1, 1);
  ledScreen.position.set(-0.6, mainH - 1.35, depth * 0.5 + 0.24);
  group.add(ledScreen);

  // Colorful vertical/horizontal "MEGA SALE 50% OFF" Banner
  const saleMat = getSignBannerMaterial('plaza_sale_banner', {
    title: 'GRAND EID SALE 50% OFF!',
    sub: 'BUY 1 GET 1 FREE • GROUND & 1ST FLOOR',
    bg: '#dc2626',
    fg: '#fef08a',
    border: '#ffffff'
  });
  const saleBanner = new THREE.Mesh(SHARED_GEO.plane, saleMat);
  saleBanner.scale.set(5.4, 1.35, 1);
  saleBanner.position.set(-0.6, 2.45, depth * 0.5 + 0.25);
  group.add(saleBanner);

  // Sloped Concrete Parking Ramp on the right side with yellow safety curb
  const ramp = new THREE.Mesh(SHARED_GEO.box, getLambert(0x64748b));
  ramp.scale.set(2.4, 0.35, 5.2);
  ramp.position.set(width * 0.5 + 1.0, 1.35, depth * 0.18);
  ramp.rotation.x = 0.42;
  group.add(ramp);

  const rampCurb = new THREE.Mesh(SHARED_GEO.box, getLambert(0xfacc15));
  rampCurb.scale.set(0.28, 0.55, 5.2);
  rampCurb.position.set(width * 0.5 + 2.05, 1.55, depth * 0.18);
  rampCurb.rotation.x = 0.42;
  group.add(rampCurb);

  // Rooftop colorful flag bunting line (batched in 1 InstancedMesh)
  const flagCount = 8;
  const buntingInst = new THREE.InstancedMesh(SHARED_GEO.cone, getLambert(0xf97316), flagCount);
  for (let i = 0; i < flagCount; i++) {
    _dummy.position.set(-width * 0.42 + i * (width * 0.84 / (flagCount - 1)), mainH + 0.65, depth * 0.5);
    _dummy.rotation.set(Math.PI, 0, 0);
    _dummy.scale.set(0.45, 0.65, 0.12);
    _dummy.updateMatrix();
    buntingInst.setMatrixAt(i, _dummy.matrix);
  }
  buntingInst.instanceMatrix.needsUpdate = true;
  group.add(buntingInst);

  group.userData.footprintW = width + 2.8;
  group.userData.buildingH = mainH + 1.5;
}

// ============================================================================
// STAGE 2: MOSQUE, HOSPITAL, SCHOOL_COLLEGE, BANK_TOWER
// ============================================================================

/**
 * 4. Mosque (Jamia Masjid):
 * Main ribbed dome, two tall minarets with green crescent lights on top (glows at night),
 * white/cream body with arches, loudspeaker cones on minarets, and courtyard wall with gate.
 */
function buildMosque(group, rng) {
  const width = 12.4;
  const depth = 8.2;
  const bodyH = 6.8;

  const wallMat = getLambert(0xfafaf9);
  const greenTrim = getLambert(0x047857);
  const goldMat = getLambert(0xfacc15);

  // Main Prayer Hall Body
  const hall = new THREE.Mesh(SHARED_GEO.box, wallMat);
  hall.scale.set(width * 0.82, bodyH, depth * 0.68);
  hall.position.set(0, bodyH * 0.5, -0.8);
  group.add(hall);

  // Green ornamental frieze band along the prayer hall roofline
  const frieze = new THREE.Mesh(SHARED_GEO.box, greenTrim);
  frieze.scale.set(width * 0.84, 0.55, depth * 0.7);
  frieze.position.set(0, bodyH - 0.3, -0.8);
  group.add(frieze);

  // Central Main Dome + Drum + Gold Finial + Glowing Green Crescent
  const drum = new THREE.Mesh(SHARED_GEO.cyl12, wallMat);
  drum.scale.set(4.4, 1.4, 4.4);
  drum.position.set(0, bodyH + 0.7, -0.8);
  group.add(drum);

  const mainDome = new THREE.Mesh(SHARED_GEO.dome, wallMat);
  mainDome.scale.set(5.2, 3.8, 5.2);
  mainDome.position.set(0, bodyH + 1.2, -0.8);
  group.add(mainDome);

  const domeCrescent = new THREE.Mesh(SHARED_GEO.ring, NIGHT_MATERIALS.minaretCrescent);
  domeCrescent.position.set(0, bodyH + 4.35, -0.8);
  domeCrescent.rotation.z = Math.PI * 0.25;
  group.add(domeCrescent);

  // Two Tall Flanking Minarets with Balconies, Loudspeakers & Glowing Green Crescent Tops
  [-1, 1].forEach((mSide) => {
    const mx = mSide * (width * 0.44);
    const mz = depth * 0.22;
    const minH = 14.5;

    const shaft = new THREE.Mesh(SHARED_GEO.cyl, wallMat);
    shaft.scale.set(1.25, minH, 1.25);
    shaft.position.set(mx, minH * 0.5, mz);
    group.add(shaft);

    // Minaret Balcony ring
    const balc = new THREE.Mesh(SHARED_GEO.cyl, greenTrim);
    balc.scale.set(1.85, 0.48, 1.85);
    balc.position.set(mx, minH * 0.72, mz);
    group.add(balc);

    // Loudspeaker horn on minaret
    const speaker = new THREE.Mesh(SHARED_GEO.cone, getLambert(0xcbd5e1));
    speaker.scale.set(0.45, 0.65, 0.45);
    speaker.position.set(mx, minH * 0.82, mz + 0.68);
    speaker.rotation.x = Math.PI * 0.45;
    group.add(speaker);

    // Minaret Cupola Dome
    const minDome = new THREE.Mesh(SHARED_GEO.dome, greenTrim);
    minDome.scale.set(1.35, 1.4, 1.35);
    minDome.position.set(mx, minH, mz);
    group.add(minDome);

    // Glowing Green Crescent Light on top of Minaret
    const crescent = new THREE.Mesh(SHARED_GEO.ring, NIGHT_MATERIALS.minaretCrescent);
    crescent.position.set(mx, minH + 1.35, mz);
    crescent.rotation.z = Math.PI * 0.25;
    group.add(crescent);
  });

  // 5 Pointed Arches along the Prayer Hall front (batched in 1 InstancedMesh)
  const archInst = new THREE.InstancedMesh(SHARED_GEO.box, NIGHT_MATERIALS.windowLitWarm, 5);
  for (let i = 0; i < 5; i++) {
    _dummy.position.set(-3.6 + i * 1.8, 2.4, depth * 0.34 - 0.72);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(1.15, 3.2, 0.15);
    _dummy.updateMatrix();
    archInst.setMatrixAt(i, _dummy.matrix);
  }
  archInst.instanceMatrix.needsUpdate = true;
  group.add(archInst);

  // Courtyard Boundary Wall & Central Arched Gate
  const wallL = new THREE.Mesh(SHARED_GEO.box, wallMat);
  wallL.scale.set(width * 0.34, 2.2, 0.38);
  wallL.position.set(-width * 0.3, 1.1, depth * 0.5);
  group.add(wallL);

  const wallR = new THREE.Mesh(SHARED_GEO.box, wallMat);
  wallR.scale.set(width * 0.34, 2.2, 0.38);
  wallR.position.set(width * 0.3, 1.1, depth * 0.5);
  group.add(wallR);

  const gatePortal = new THREE.Mesh(SHARED_GEO.box, greenTrim);
  gatePortal.scale.set(2.8, 3.8, 0.65);
  gatePortal.position.set(0, 1.9, depth * 0.5);
  group.add(gatePortal);

  const gateOpening = new THREE.Mesh(SHARED_GEO.box, goldMat);
  gateOpening.scale.set(1.6, 2.6, 0.72);
  gateOpening.position.set(0, 1.3, depth * 0.5);
  group.add(gateOpening);

  group.userData.footprintW = width + 1.6;
  group.userData.buildingH = 16.2;
}

/**
 * 5. Hospital (Al-Shifa / Mid-City Medical Complex):
 * Clean white body, big glowing red/green medical cross, covered ambulance bay, and signboard.
 */
function buildHospital(group, rng) {
  const floors = 5;
  const floorH = 2.85;
  const width = 12.0;
  const depth = 7.4;
  const mainH = floors * floorH + 1.2;

  const body = new THREE.Mesh(SHARED_GEO.box, getWeatheredFacadeTexture(0xf8fafc));
  body.scale.set(width, mainH, depth);
  body.position.set(0, mainH * 0.5, 0);
  group.add(body);

  // Emerald/Teal medical accent band across facade
  const stripe = new THREE.Mesh(SHARED_GEO.box, getLambert(0x0d9488));
  stripe.scale.set(width + 0.2, 0.65, depth + 0.2);
  stripe.position.set(0, 3.6, 0);
  group.add(stripe);

  // Big Glowing Red Cross Emblem high on the facade
  const crossV = new THREE.Mesh(SHARED_GEO.box, NIGHT_MATERIALS.hospitalCross);
  crossV.scale.set(0.85, 2.7, 0.25);
  crossV.position.set(width * 0.32, mainH - 2.1, depth * 0.5 + 0.12);
  group.add(crossV);

  const crossH = new THREE.Mesh(SHARED_GEO.box, NIGHT_MATERIALS.hospitalCross);
  crossH.scale.set(2.7, 0.85, 0.25);
  crossH.position.set(width * 0.32, mainH - 2.1, depth * 0.5 + 0.12);
  group.add(crossH);

  // Hospital Signboard
  const signMat = getSignBannerMaterial('hospital_sign', {
    title: 'AL-SHIFA GENERAL HOSPITAL',
    sub: '24/7 EMERGENCY • TRAUMA CENTER • PHARMACY',
    bg: '#be123c',
    fg: '#ffffff',
    border: '#fef08a'
  });
  const signBoard = new THREE.Mesh(SHARED_GEO.plane, signMat);
  signBoard.scale.set(6.8, 1.5, 1);
  signBoard.position.set(-1.2, mainH - 1.2, depth * 0.5 + 0.15);
  group.add(signBoard);

  // Covered Ambulance Bay Canopy + Mini Ambulance Front Peeking Out
  const bayCanopy = new THREE.Mesh(SHARED_GEO.box, getLambert(0xe11d48));
  bayCanopy.scale.set(4.8, 0.45, 2.6);
  bayCanopy.position.set(-2.2, 3.1, depth * 0.5 + 1.2);
  group.add(bayCanopy);

  [-4.2, -0.2].forEach((px) => {
    const pillar = new THREE.Mesh(SHARED_GEO.box, getLambert(0xe2e8f0));
    pillar.scale.set(0.35, 3.1, 0.35);
    pillar.position.set(px, 1.55, depth * 0.5 + 2.2);
    group.add(pillar);
  });

  // Low-poly Edhi/Chhipa style Ambulance cab parked in the bay
  const ambCab = new THREE.Mesh(SHARED_GEO.box, getLambert(0xffffff));
  ambCab.scale.set(1.75, 1.65, 2.4);
  ambCab.position.set(-2.2, 0.95, depth * 0.5 + 1.15);
  group.add(ambCab);

  const ambSiren = new THREE.Mesh(SHARED_GEO.box, NIGHT_MATERIALS.hospitalCross);
  ambSiren.scale.set(0.75, 0.22, 0.28);
  ambSiren.position.set(-2.2, 1.88, depth * 0.5 + 1.6);
  group.add(ambSiren);

  // Instanced Hospital Windows
  addInstancedWindowsAndBalconies(group, {
    width,
    floors: 4,
    floorHeight: floorH,
    startY: 5.2,
    frontZ: depth * 0.5,
    cols: 5,
    rng,
    style: 'GLASS',
    addBalconies: false,
    addACs: true
  });

  addRooftopClutter(group, width, depth, mainH, rng);

  group.userData.footprintW = width + 1.2;
  group.userData.buildingH = mainH + 2.0;
}

/**
 * 6. School / College (Jinnah Science College / Govt High School):
 * Academic block, boundary wall, flagpole, gate with painted sign arch, and playground corner.
 */
function buildSchoolCollege(group, rng) {
  const width = 12.8;
  const depth = 7.8;
  const mainH = 8.8; // 3-story academic block set back behind courtyard

  const wallColors = BUILDING_CONFIG.WALL_COLORS.SCHOOL;
  const wallMat = getWeatheredFacadeTexture(wallColors[Math.floor(rng() * wallColors.length)]);

  // Main Academic Block (set slightly back to leave room for courtyard & playground)
  const schoolBlock = new THREE.Mesh(SHARED_GEO.box, wallMat);
  schoolBlock.scale.set(width, mainH, depth * 0.65);
  schoolBlock.position.set(0, mainH * 0.5, -1.1);
  group.add(schoolBlock);

  addInstancedWindowsAndBalconies(group, {
    width: width * 0.9,
    floors: 3,
    floorHeight: 2.65,
    startY: 2.2,
    frontZ: depth * 0.325 - 1.1,
    cols: 5,
    rng,
    style: 'ARCHED',
    addBalconies: false,
    addACs: false
  });

  // Boundary Wall along the front
  const bWallL = new THREE.Mesh(SHARED_GEO.box, getLambert(0xfef3c7));
  bWallL.scale.set(width * 0.38, 1.85, 0.35);
  bWallL.position.set(-width * 0.31, 0.925, depth * 0.5);
  group.add(bWallL);

  const bWallR = new THREE.Mesh(SHARED_GEO.box, getLambert(0xfef3c7));
  bWallR.scale.set(width * 0.32, 1.85, 0.35);
  bWallR.position.set(width * 0.34, 0.925, depth * 0.5);
  group.add(bWallR);

  // Gate Pillars + Painted School Signboard Arch
  [-1.7, 1.7].forEach((gx) => {
    const gPillar = new THREE.Mesh(SHARED_GEO.box, getLambert(0xb45309));
    gPillar.scale.set(0.55, 3.4, 0.55);
    gPillar.position.set(gx, 1.7, depth * 0.5);
    group.add(gPillar);
  });

  const schoolSignMat = getSignBannerMaterial('school_gate_sign', {
    title: 'JINNAH GOVT. COLLEGE & SCHOOL',
    sub: 'ENTER TO LEARN • GO FORTH TO SERVE',
    bg: '#065f46',
    fg: '#ffffff',
    border: '#facc15'
  });
  const gateSign = new THREE.Mesh(SHARED_GEO.plane, schoolSignMat);
  gateSign.scale.set(4.2, 1.15, 1);
  gateSign.position.set(0, 3.35, depth * 0.5 + 0.32);
  group.add(gateSign);

  // Courtyard Flagpole with Pakistani Flag
  const pole = new THREE.Mesh(SHARED_GEO.cyl, getLambert(0xf8fafc));
  pole.scale.set(0.1, 6.2, 0.1);
  pole.position.set(-2.6, 3.1, depth * 0.22);
  group.add(pole);

  const flag = new THREE.Mesh(SHARED_GEO.box, getLambert(0x15803d));
  flag.scale.set(1.3, 0.8, 0.06);
  flag.position.set(-1.95, 5.7, depth * 0.22);
  group.add(flag);

  // Playground Corner (Colorful Slide + Swing Frame on right side of courtyard)
  const slideLadder = new THREE.Mesh(SHARED_GEO.box, getLambert(0x2563eb));
  slideLadder.scale.set(0.65, 2.1, 0.65);
  slideLadder.position.set(3.2, 1.05, depth * 0.22);
  group.add(slideLadder);

  const slideChute = new THREE.Mesh(SHARED_GEO.box, getLambert(0xef4444));
  slideChute.scale.set(0.65, 0.18, 2.4);
  slideChute.position.set(3.2, 1.1, depth * 0.22 + 1.05);
  slideChute.rotation.x = 0.58;
  group.add(slideChute);

  group.userData.footprintW = width + 1.2;
  group.userData.buildingH = mainH + 1.5;
}

/**
 * 7. Bank / Office Tower (8-12 floors, I.I. Chundrigar Road Corporate High-Rise):
 * Glass and concrete mix, stepped crown, communications spire, and illuminated rooftop sign.
 */
function buildBankTower(group, rng) {
  const floors = 8 + Math.floor(rng() * 5); // 8 to 12 floors
  const floorH = 2.65;
  const width = 10.6;
  const depth = 7.4;
  const mainH = floors * floorH + 1.5;

  const concreteMat = getWeatheredFacadeTexture(0x94a3b8);

  // Lower Podium + Tall Concrete Core
  const core = new THREE.Mesh(SHARED_GEO.box, concreteMat);
  core.scale.set(width, mainH, depth);
  core.position.set(0, mainH * 0.5, 0);
  group.add(core);

  // Stepped Glass Curtain Crown
  const crownH = 3.2;
  const crown = new THREE.Mesh(SHARED_GEO.box, getLambert(0x0f172a));
  crown.scale.set(width * 0.78, crownH, depth * 0.78);
  crown.position.set(0, mainH + crownH * 0.5, 0);
  group.add(crown);

  // Instanced Glass Office Windows across all 8-12 floors (~40% lit at night)
  addInstancedWindowsAndBalconies(group, {
    width: width * 0.9,
    floors,
    floorHeight: floorH,
    startY: 3.4,
    frontZ: depth * 0.5,
    cols: 5,
    rng,
    style: 'GLASS',
    addBalconies: false,
    addACs: false
  });

  // Illuminated Rooftop Brand Sign (Invented Pakistani Bank/Telecom brand)
  const brandIdx = Math.floor(rng() * BUILDING_CONFIG.ROOFTOP_BRANDS.length);
  const brandDef = BUILDING_CONFIG.ROOFTOP_BRANDS[brandIdx];
  const signMat = getSignBannerMaterial(`bank_roof_brand_${brandIdx}`, {
    title: brandDef.title,
    sub: brandDef.sub,
    bg: brandDef.bg,
    fg: brandDef.fg,
    border: brandDef.border
  });
  const roofSign = new THREE.Mesh(SHARED_GEO.plane, signMat);
  roofSign.scale.set(7.4, 2.1, 1);
  roofSign.position.set(0, mainH + crownH + 1.05, depth * 0.35);
  group.add(roofSign);

  // Communications Spire on top
  const spire = new THREE.Mesh(SHARED_GEO.cyl, getLambert(0xe2e8f0));
  spire.scale.set(0.16, 4.5, 0.16);
  spire.position.set(0, mainH + crownH + 2.25, 0);
  group.add(spire);

  const beacon = new THREE.Mesh(SHARED_GEO.sphere, NIGHT_MATERIALS.hospitalCross);
  beacon.scale.set(0.42, 0.42, 0.42);
  beacon.position.set(0, mainH + crownH + 4.55, 0);
  group.add(beacon);

  group.userData.footprintW = width + 1.4;
  group.userData.buildingH = mainH + crownH + 4.6;
}

// ============================================================================
// STAGE 3: WEDDING_HALL, CONSTRUCTION_SITE, PETROL_CNG_STATION, OLD_CITY_GATE, FORT_MONUMENT
// ============================================================================

/**
 * 8. Wedding Hall (Shadi Hall / Royal Banquet Lawn):
 * Ornate palace facade, colorful LED strips along the edges, big entrance arch,
 * and blinking fairy lights updated in updateBuildings(dt).
 */
function buildWeddingHall(group, rng) {
  const width = 12.6;
  const depth = 7.6;
  const mainH = 9.4;

  const wallColors = BUILDING_CONFIG.WALL_COLORS.WEDDING;
  const body = new THREE.Mesh(SHARED_GEO.box, getWeatheredFacadeTexture(wallColors[Math.floor(rng() * wallColors.length)]));
  body.scale.set(width, mainH, depth);
  body.position.set(0, mainH * 0.5, 0);
  group.add(body);

  // Grand Mughal Entrance Arch with Red Carpet
  const archFrame = new THREE.Mesh(SHARED_GEO.box, getLambert(0xd97706));
  archFrame.scale.set(4.8, 5.6, 1.2);
  archFrame.position.set(0, 2.8, depth * 0.5 + 0.4);
  group.add(archFrame);

  const archInner = new THREE.Mesh(SHARED_GEO.box, NIGHT_MATERIALS.windowLitWarm);
  archInner.scale.set(3.2, 4.2, 1.3);
  archInner.position.set(0, 2.1, depth * 0.5 + 0.42);
  group.add(archInner);

  const redCarpet = new THREE.Mesh(SHARED_GEO.box, getLambert(0xb91c1c));
  redCarpet.scale.set(2.8, 0.12, 2.8);
  redCarpet.position.set(0, 0.06, depth * 0.5 + 1.2);
  group.add(redCarpet);

  // Wedding Hall Signboard
  const shadiSignMat = getSignBannerMaterial('wedding_hall_sign', {
    title: 'QASR-E-NOOR SHADI HALL & BANQUET',
    sub: 'FULLY AIR CONDITIONED • VALET PARKING',
    bg: '#581c87',
    fg: '#fde047',
    border: '#ec4899'
  });
  const signPlane = new THREE.Mesh(SHARED_GEO.plane, shadiSignMat);
  signPlane.scale.set(7.8, 1.65, 1);
  signPlane.position.set(0, mainH - 1.4, depth * 0.5 + 0.16);
  group.add(signPlane);

  // Colorful LED Strips along roofline and vertical edges
  const topLed = new THREE.Mesh(SHARED_GEO.box, NIGHT_MATERIALS.weddingLedPink);
  topLed.scale.set(width + 0.4, 0.32, depth + 0.4);
  topLed.position.set(0, mainH + 0.15, 0);
  group.add(topLed);

  [-width * 0.5, width * 0.5].forEach((lx, idx) => {
    const vLed = new THREE.Mesh(
      SHARED_GEO.box,
      idx === 0 ? NIGHT_MATERIALS.weddingLedCyan : NIGHT_MATERIALS.weddingLedGold
    );
    vLed.scale.set(0.32, mainH, 0.32);
    vLed.position.set(lx, mainH * 0.5, depth * 0.5 + 0.12);
    group.add(vLed);
  });

  // Blinking Fairy Light Strands across the facade (1 InstancedMesh registered for blinking)
  const bulbCount = 18;
  const fairyInst = new THREE.InstancedMesh(SHARED_GEO.sphere, NIGHT_MATERIALS.weddingLedGold, bulbCount);
  for (let i = 0; i < bulbCount; i++) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    _dummy.position.set(-4.8 + col * 1.92, 4.2 + row * 1.65, depth * 0.5 + 0.25);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(0.28, 0.28, 0.28);
    _dummy.updateMatrix();
    fairyInst.setMatrixAt(i, _dummy.matrix);
  }
  fairyInst.instanceMatrix.needsUpdate = true;
  group.add(fairyInst);
  group.userData.fairyLights = fairyInst;

  group.userData.footprintW = width + 1.4;
  group.userData.buildingH = mainH + 1.2;
}

/**
 * 9. Under-Construction Building:
 * Raw concrete frame slabs & pillars, rebar rods poking from top,
 * bamboo scaffolding lattice, translucent green safety net, and rotating yellow tower crane.
 */
function buildConstructionSite(group, rng) {
  const floors = 5;
  const floorH = 2.75;
  const width = 11.2;
  const depth = 7.2;
  const topY = floors * floorH;

  const concreteMat = getLambert(0x94a3b8);
  const rebarMat = getLambert(0x475569);
  const bambooMat = getLambert(0xd97706);

  // 1. Concrete Floor Slabs (batched in 1 InstancedMesh)
  const slabInst = new THREE.InstancedMesh(SHARED_GEO.box, concreteMat, floors);
  for (let f = 0; f < floors; f++) {
    _dummy.position.set(0, (f + 1) * floorH, 0);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(width, 0.36, depth);
    _dummy.updateMatrix();
    slabInst.setMatrixAt(f, _dummy.matrix);
  }
  slabInst.instanceMatrix.needsUpdate = true;
  group.add(slabInst);

  // 2. Concrete Columns + Rebar Rods poking out the top (batched in 1 InstancedMesh)
  const colPositions = [
    [-width * 0.44, -depth * 0.42],
    [0, -depth * 0.42],
    [width * 0.44, -depth * 0.42],
    [-width * 0.44, depth * 0.42],
    [0, depth * 0.42],
    [width * 0.44, depth * 0.42]
  ];
  const pillarInst = new THREE.InstancedMesh(SHARED_GEO.box, concreteMat, colPositions.length);
  const rebarInst = new THREE.InstancedMesh(SHARED_GEO.cyl, rebarMat, colPositions.length);
  colPositions.forEach(([cx, cz], idx) => {
    _dummy.position.set(cx, topY * 0.5, cz);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(0.58, topY, 0.58);
    _dummy.updateMatrix();
    pillarInst.setMatrixAt(idx, _dummy.matrix);

    // Rusty rebar bundle poking above top slab
    _dummy.position.set(cx, topY + 0.9, cz);
    _dummy.scale.set(0.16, 1.8, 0.16);
    _dummy.updateMatrix();
    rebarInst.setMatrixAt(idx, _dummy.matrix);
  });
  pillarInst.instanceMatrix.needsUpdate = true;
  rebarInst.instanceMatrix.needsUpdate = true;
  group.add(pillarInst);
  group.add(rebarInst);

  // 3. Green Safety Net wrapping upper half of the frame
  const safetyNet = new THREE.Mesh(
    SHARED_GEO.box,
    getLambert(0x16a34a, { transparent: true, opacity: 0.68 })
  );
  safetyNet.scale.set(width + 0.35, topY * 0.55, depth + 0.35);
  safetyNet.position.set(0, topY * 0.68, 0);
  group.add(safetyNet);

  // 4. Bamboo Scaffolding poles along the front facade (1 InstancedMesh)
  const bambooCount = 10;
  const bambooInst = new THREE.InstancedMesh(SHARED_GEO.cyl, bambooMat, bambooCount);
  for (let i = 0; i < bambooCount; i++) {
    if (i < 6) {
      // Vertical bamboo poles
      _dummy.position.set(-width * 0.45 + i * (width * 0.9 / 5), topY * 0.52, depth * 0.5 + 0.35);
      _dummy.rotation.set(0, 0, (i % 2 === 0 ? 1 : -1) * 0.03);
      _dummy.scale.set(0.1, topY + 0.8, 0.1);
    } else {
      // Horizontal bamboo ledger poles
      const row = i - 6;
      _dummy.position.set(0, 2.5 + row * 3.0, depth * 0.5 + 0.38);
      _dummy.rotation.set(0, 0, Math.PI * 0.5);
      _dummy.scale.set(0.09, width + 0.4, 0.09);
    }
    _dummy.updateMatrix();
    bambooInst.setMatrixAt(i, _dummy.matrix);
  }
  bambooInst.instanceMatrix.needsUpdate = true;
  group.add(bambooInst);

  // 5. Yellow Rooftop Tower Crane (Mast + Rotating Jib + Hook)
  const craneYellow = getLambert(0xeab308);
  const craneMast = new THREE.Mesh(SHARED_GEO.box, craneYellow);
  craneMast.scale.set(0.85, 6.2, 0.85);
  craneMast.position.set(1.5, topY + 3.1, 0);
  group.add(craneMast);

  const craneJibGroup = new THREE.Group();
  craneJibGroup.position.set(1.5, topY + 6.1, 0);

  const jibArm = new THREE.Mesh(SHARED_GEO.box, craneYellow);
  jibArm.scale.set(8.5, 0.55, 0.55);
  jibArm.position.set(2.2, 0, 0);
  craneJibGroup.add(jibArm);

  const counterWeight = new THREE.Mesh(SHARED_GEO.box, getLambert(0x334155));
  counterWeight.scale.set(1.4, 0.85, 0.9);
  counterWeight.position.set(-1.8, -0.1, 0);
  craneJibGroup.add(counterWeight);

  const hookCable = new THREE.Mesh(SHARED_GEO.cyl, rebarMat);
  hookCable.scale.set(0.06, 2.8, 0.06);
  hookCable.position.set(5.4, -1.4, 0);
  craneJibGroup.add(hookCable);

  group.add(craneJibGroup);
  group.userData.craneJib = craneJibGroup;

  group.userData.footprintW = width + 1.8;
  group.userData.buildingH = topY + 6.8;
}

/**
 * 10. Petrol / CNG Station (PSO / Pak Green CNG Forecourt):
 * High canopy with pumps, digital price totem board, small tuck-shop at back,
 * and a queue of 2 low-poly auto-rickshaws waiting for CNG.
 */
function buildPetrolCNGStation(group, rng) {
  const width = 13.0;
  const depth = 8.4;

  // Rear Station Mini-Mart & Office Building
  const shop = new THREE.Mesh(SHARED_GEO.box, getWeatheredFacadeTexture(0xfef3c7));
  shop.scale.set(width * 0.72, 3.6, 3.2);
  shop.position.set(-1.0, 1.8, -depth * 0.3);
  group.add(shop);

  const shopGlass = new THREE.Mesh(SHARED_GEO.box, NIGHT_MATERIALS.windowLitCool);
  shopGlass.scale.set(4.5, 1.8, 0.15);
  shopGlass.position.set(-1.0, 1.5, -depth * 0.3 + 1.62);
  group.add(shopGlass);

  // Forecourt High Canopy + Glowing Green Fascia Edge
  const canopyH = 5.4;
  const canopy = new THREE.Mesh(SHARED_GEO.box, getLambert(0xf8fafc));
  canopy.scale.set(10.2, 0.65, 5.2);
  canopy.position.set(-0.6, canopyH, depth * 0.16);
  group.add(canopy);

  const canopyEdge = new THREE.Mesh(SHARED_GEO.box, NIGHT_MATERIALS.petrolCanopyEdge);
  canopyEdge.scale.set(10.4, 0.42, 5.4);
  canopyEdge.position.set(-0.6, canopyH + 0.12, depth * 0.16);
  group.add(canopyEdge);

  // 2 Stout Canopy Pillars + 2 Fuel/CNG Pump Dispensers
  [-3.4, 2.2].forEach((px) => {
    const col = new THREE.Mesh(SHARED_GEO.cyl, getLambert(0xe2e8f0));
    col.scale.set(0.52, canopyH, 0.52);
    col.position.set(px, canopyH * 0.5, depth * 0.16);
    group.add(col);

    const pump = new THREE.Mesh(SHARED_GEO.box, getLambert(0x16a34a));
    pump.scale.set(0.85, 1.65, 0.55);
    pump.position.set(px + 1.1, 0.825, depth * 0.16);
    group.add(pump);
  });

  // Tall Roadside Price Totem Board
  const totemSignMat = getSignBannerMaterial('cng_price_totem', {
    title: 'PAK PSO & GREEN CNG',
    sub: 'CNG OPEN 24 HRS • HI-OCTANE • TYRE AIR',
    bg: '#14532d',
    fg: '#fef08a',
    border: '#22c55e'
  });
  const totemPost = new THREE.Mesh(SHARED_GEO.box, getLambert(0x15803d));
  totemPost.scale.set(1.8, 6.2, 0.45);
  totemPost.position.set(width * 0.42, 3.1, depth * 0.42);
  group.add(totemPost);

  const totemFace = new THREE.Mesh(SHARED_GEO.plane, totemSignMat);
  totemFace.scale.set(1.7, 2.2, 1);
  totemFace.position.set(width * 0.42, 4.6, depth * 0.42 + 0.25);
  group.add(totemFace);

  // CNG Queue of 2 Low-Poly Auto-Rickshaws waiting in line
  [-2.6, 0.8].forEach((rx) => {
    const rickHull = new THREE.Mesh(SHARED_GEO.box, getLambert(0x15803d));
    rickHull.scale.set(1.9, 0.85, 1.15);
    rickHull.position.set(rx, 0.58, depth * 0.34);
    group.add(rickHull);

    const rickHood = new THREE.Mesh(SHARED_GEO.box, getLambert(0xfacc15));
    rickHood.scale.set(1.65, 0.72, 1.12);
    rickHood.position.set(rx - 0.1, 1.32, depth * 0.34);
    group.add(rickHood);
  });

  group.userData.footprintW = width + 1.4;
  group.userData.buildingH = 6.5;
}

/**
 * 11. Old-City Gate (Darwaza — Lahori / Mithadar Battered Brick Gateway):
 * Brick arch with pointed top, flanking octagonal bastions, battlements,
 * hanging warm lanterns, and a narrow old-city lane visible behind.
 */
function buildOldCityGate(group, rng) {
  const width = 12.2;
  const depth = 7.4;
  const gateH = 10.2;

  const brickMat = getWeatheredFacadeTexture(0x9a3412);
  const trimMat = getLambert(0xfef3c7);

  // Left & Right Flanking Bastion Towers
  [-1, 1].forEach((side) => {
    const bx = side * (width * 0.34);
    const bastion = new THREE.Mesh(SHARED_GEO.cyl, brickMat);
    bastion.scale.set(3.2, gateH, 3.2);
    bastion.position.set(bx, gateH * 0.5, depth * 0.2);
    group.add(bastion);

    // Cupola crown on bastion
    const cupola = new THREE.Mesh(SHARED_GEO.dome, trimMat);
    cupola.scale.set(2.6, 1.8, 2.6);
    cupola.position.set(bx, gateH, depth * 0.2);
    group.add(cupola);
  });

  // Central Archway Bridge Wall above the pointed portal
  const bridge = new THREE.Mesh(SHARED_GEO.box, brickMat);
  bridge.scale.set(width * 0.56, gateH * 0.42, 2.4);
  bridge.position.set(0, gateH * 0.79, depth * 0.2);
  group.add(bridge);

  // Pointed Arch Frame Trim
  const archTrim = new THREE.Mesh(SHARED_GEO.box, trimMat);
  archTrim.scale.set(4.8, 0.45, 2.6);
  archTrim.position.set(0, gateH * 0.58, depth * 0.2);
  group.add(archTrim);

  // Hanging Warm Lanterns inside and flanking the gate
  [-1.9, 0, 1.9].forEach((lx, idx) => {
    const lantern = new THREE.Mesh(SHARED_GEO.sphere, NIGHT_MATERIALS.lanternGlow);
    lantern.scale.set(0.45, 0.58, 0.45);
    lantern.position.set(lx, idx === 1 ? gateH * 0.54 : 4.2, depth * 0.2 + 1.25);
    group.add(lantern);
  });

  // Narrow Old-City Lane & Warm Houses visible behind the gate opening
  const backLaneL = new THREE.Mesh(SHARED_GEO.box, getWeatheredFacadeTexture(0xf3d58d));
  backLaneL.scale.set(3.2, 7.8, 3.4);
  backLaneL.position.set(-2.1, 3.9, -depth * 0.25);
  group.add(backLaneL);

  const backLaneR = new THREE.Mesh(SHARED_GEO.box, getWeatheredFacadeTexture(0xf2cbd0));
  backLaneR.scale.set(3.2, 8.4, 3.4);
  backLaneR.position.set(2.1, 4.2, -depth * 0.25);
  group.add(backLaneR);

  group.userData.footprintW = width + 1.4;
  group.userData.buildingH = gateH + 2.0;
}

/**
 * 12. Fort / Monument Piece (Badshahi / Alamgiri Red Sandstone Monument):
 * Grand Mughal red sandstone gateway with white marble inlay panels,
 * three bulbous white domes, and corner cupolas (chatris).
 */
function buildFortMonument(group, rng) {
  const width = 13.6;
  const depth = 8.0;
  const mainH = 11.2;

  const sandstoneMat = getWeatheredFacadeTexture(0x991b1b);
  const marbleMat = getLambert(0xfafaf9);
  const goldMat = getLambert(0xfacc15);

  // Grand Red Sandstone Monument Mass
  const monument = new THREE.Mesh(SHARED_GEO.box, sandstoneMat);
  monument.scale.set(width, mainH, depth * 0.72);
  monument.position.set(0, mainH * 0.5, 0);
  group.add(monument);

  // White Marble Inlay Portal Frame
  const iwanFrame = new THREE.Mesh(SHARED_GEO.box, marbleMat);
  iwanFrame.scale.set(5.4, mainH * 0.82, 0.45);
  iwanFrame.position.set(0, mainH * 0.41, depth * 0.36 + 0.12);
  group.add(iwanFrame);

  // Recessed Dark Mughal Arch Cavity
  const iwanArch = new THREE.Mesh(SHARED_GEO.box, getLambert(0x450a0a));
  iwanArch.scale.set(3.6, mainH * 0.66, 0.55);
  iwanArch.position.set(0, mainH * 0.33, depth * 0.36 + 0.16);
  group.add(iwanArch);

  // Three White Bulbous Mughal Domes + Gold Finials along the roofline
  [-3.6, 0, 3.6].forEach((dx, idx) => {
    const isCenter = idx === 1;
    const r = isCenter ? 4.4 : 2.8;
    const h = isCenter ? 3.4 : 2.2;

    const dome = new THREE.Mesh(SHARED_GEO.dome, marbleMat);
    dome.scale.set(r, h, r);
    dome.position.set(dx, mainH, 0);
    group.add(dome);

    const finial = new THREE.Mesh(SHARED_GEO.cone, goldMat);
    finial.scale.set(0.35, 1.1, 0.35);
    finial.position.set(dx, mainH + h * 0.75, 0);
    group.add(finial);
  });

  // Corner Octagonal Minaret Turrets with White Chatri Domes
  [-width * 0.48, width * 0.48].forEach((tx) => {
    const turret = new THREE.Mesh(SHARED_GEO.cyl, sandstoneMat);
    turret.scale.set(1.65, mainH + 2.4, 1.65);
    turret.position.set(tx, (mainH + 2.4) * 0.5, depth * 0.34);
    group.add(turret);

    const chatri = new THREE.Mesh(SHARED_GEO.dome, marbleMat);
    chatri.scale.set(1.8, 1.3, 1.8);
    chatri.position.set(tx, mainH + 2.4, depth * 0.34);
    group.add(chatri);
  });

  group.userData.footprintW = width + 1.8;
  group.userData.buildingH = mainH + 4.2;
}

// ============================================================================
// STAGE 4: FAR-HORIZON LOW-DETAIL SILHOUETTE LOD BUILDING (2 Meshes)
// ============================================================================
function createFarLodBuilding(seed = 1) {
  const rng = createSeededRandom(seed);
  const group = new THREE.Group();
  const w = 10 + rng() * 6;
  const h = 14 + rng() * 14;
  const d = 7 + rng() * 3;

  const hazeColors = [0x64748b, 0x78716c, 0x475569, 0x57534e];
  const body = new THREE.Mesh(SHARED_GEO.box, getLambert(hazeColors[Math.floor(rng() * hazeColors.length)]));
  body.scale.set(w, h, d);
  body.position.set(0, h * 0.5, 0);
  group.add(body);

  // Simple glowing night window strip so far skyline sparkles at night
  const strip = new THREE.Mesh(SHARED_GEO.box, NIGHT_MATERIALS.windowLitWarm);
  strip.scale.set(w * 0.65, h * 0.7, 0.15);
  strip.position.set(0, h * 0.52, d * 0.5 + 0.08);
  group.add(strip);

  patchObjectHierarchy(group);
  freezeStaticBuildingMeshes(group);
  return group;
}
// ============================================================================
/**
 * Creates a detailed low-poly Pakistani skyline building Group with its front (+Z)
 * facing the road. Uses shared geometries, cached CanvasTextures, and InstancedMesh
 * so every building stays well under 50 meshes.
 */
export function createBuilding(type = BUILDING_CONFIG.BUILDING_TYPES.APARTMENT_BLOCK, options = {}) {
  const seed = options.seed !== undefined ? options.seed : 1337;
  const rng = createSeededRandom(seed);
  const group = new THREE.Group();
  group.name = `Building_${type}`;
  group.userData.buildingType = type;
  group.userData.propCategory = 'BUILDING';

  switch (type) {
    case BUILDING_CONFIG.BUILDING_TYPES.COLONIAL_BUILDING:
      buildColonialBuilding(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.SHOPPING_PLAZA:
      buildShoppingPlaza(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.MOSQUE:
      buildMosque(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.HOSPITAL:
      buildHospital(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.SCHOOL_COLLEGE:
      buildSchoolCollege(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.BANK_TOWER:
      buildBankTower(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.WEDDING_HALL:
      buildWeddingHall(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.CONSTRUCTION_SITE:
      buildConstructionSite(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.PETROL_CNG_STATION:
      buildPetrolCNGStation(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.OLD_CITY_GATE:
      buildOldCityGate(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.FORT_MONUMENT:
      buildFortMonument(group, rng);
      break;
    case BUILDING_CONFIG.BUILDING_TYPES.APARTMENT_BLOCK:
    default:
      buildApartmentBlock(group, rng);
      break;
  }

  // Patch for world-curve shader compatibility & freeze static matrices
  patchObjectHierarchy(group);
  freezeStaticBuildingMeshes(group);
  return group;
}

// ============================================================================
// POOLING & SKYLINE LAYOUT MANAGER: BuildingManager
// ============================================================================
const _buildingPools = new Map();
const _activeBuildings = new Set();
let _lastNearTypeLeft = '';
let _lastNearTypeRight = '';
let _lastMidTypeLeft = '';
let _lastMidTypeRight = '';

function acquireBuildingFromPool(type, seed) {
  if (!_buildingPools.has(type)) {
    _buildingPools.set(type, []);
  }
  const pool = _buildingPools.get(type);
  let bld = pool.pop();
  if (!bld) {
    bld = createBuilding(type, { seed });
  }
  bld.visible = true;
  _activeBuildings.add(bld);
  return bld;
}

function recycleClusterBuildings(cluster) {
  if (!cluster || !cluster.userData.spawnedBuildings) return;
  for (const bld of cluster.userData.spawnedBuildings) {
    if (bld.parent) bld.parent.remove(bld);
    _activeBuildings.delete(bld);
    const type = bld.userData.buildingType;
    if (type) {
      if (!_buildingPools.has(type)) _buildingPools.set(type, []);
      const pool = _buildingPools.get(type);
      if (pool.length < BUILDING_CONFIG.POOL_MAX_PER_TYPE) {
        pool.push(bld);
      }
    }
  }
  cluster.userData.spawnedBuildings = [];
}

const _chunkClusterMap = new Map();

export const BuildingManager = {
  /**
   * Generates a 3-layer skyline cluster (Near gap-filler/set-piece, Mid skyline, Far LOD)
   * for one side (-1 left, +1 right) of a 40m road chunk.
   * Never repeats the same building type twice in a row, and places a landmark set-piece
   * (Mosque, Gate, Plaza, Fort Monument, Petrol Station, Wedding Hall) every 160-240m.
   */
  generate(chunkZ = 0, side = -1, seed = 1) {
    const chunkIndex = Math.round(Math.abs(chunkZ) / BUILDING_CONFIG.CHUNK_LENGTH);
    const clusterKey = `${chunkIndex}_${side}`;
    if (_chunkClusterMap.has(clusterKey)) {
      recycleClusterBuildings(_chunkClusterMap.get(clusterKey));
    }

    const rng = createSeededRandom(chunkIndex * 131 + (side > 0 ? 59 : 17) + seed * 19);
    const cluster = new THREE.Group();
    cluster.name = `BuildingCluster_${clusterKey}`;
    cluster.userData.spawnedBuildings = [];

    const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;

    // 1. Check if this chunk is a Set-Piece milestone (every 4 to 6 chunks = 160-240m)
    const isSetPieceChunk = chunkIndex > 0 && chunkIndex % 5 === (side > 0 ? 2 : 0);

    // 2. NEAR / GAP LAYER (Sits at X = ±19.2m peeking between shop rows or showcasing a set-piece)
    const lastNear = side < 0 ? _lastNearTypeLeft : _lastNearTypeRight;
    let nearType;
    if (isSetPieceChunk) {
      const setPieces = BUILDING_CONFIG.SET_PIECE_TYPES;
      nearType = setPieces[(chunkIndex + (side > 0 ? 1 : 0)) % setPieces.length];
      if (nearType === lastNear) {
        nearType = setPieces[(chunkIndex + 2) % setPieces.length];
      }
    } else {
      const nearCandidates = [
        'COLONIAL_BUILDING',
        'SHOPPING_PLAZA',
        'WEDDING_HALL',
        'PETROL_CNG_STATION',
        'OLD_CITY_GATE',
        'SCHOOL_COLLEGE'
      ];
      nearType = nearCandidates[Math.floor(rng() * nearCandidates.length)];
      if (nearType === lastNear) {
        nearType = nearCandidates[(nearCandidates.indexOf(nearType) + 1) % nearCandidates.length];
      }
    }
    if (side < 0) _lastNearTypeLeft = nearType;
    else _lastNearTypeRight = nearType;

    const nearBld = acquireBuildingFromPool(nearType, chunkIndex * 31 + (side > 0 ? 7 : 3));
    nearBld.rotation.y = rotY;
    nearBld.position.set(side * BUILDING_CONFIG.NEAR_LAYER_X, 0, -10 + (rng() - 0.5) * 4);
    cluster.add(nearBld);
    cluster.userData.spawnedBuildings.push(nearBld);

    // 3. MIDDLE SKYLINE LAYER (2 taller buildings at X = ±26.8m towering behind the shops)
    const midCandidates = [
      'APARTMENT_BLOCK',
      'BANK_TOWER',
      'HOSPITAL',
      'CONSTRUCTION_SITE',
      'COLONIAL_BUILDING',
      'MOSQUE',
      'FORT_MONUMENT'
    ];
    [-12, 12].forEach((zOff, idx) => {
      const lastMid = side < 0 ? _lastMidTypeLeft : _lastMidTypeRight;
      let midType = midCandidates[Math.floor(rng() * midCandidates.length)];
      if (midType === lastMid || midType === nearType) {
        midType = midCandidates[(midCandidates.indexOf(midType) + 1 + idx) % midCandidates.length];
      }
      if (side < 0) _lastMidTypeLeft = midType;
      else _lastMidTypeRight = midType;

      const midBld = acquireBuildingFromPool(midType, chunkIndex * 73 + idx * 19 + (side > 0 ? 11 : 5));
      midBld.rotation.y = rotY;
      midBld.position.set(side * (BUILDING_CONFIG.MID_LAYER_X + (idx % 2) * 2.2), 0, zOff);
      cluster.add(midBld);
      cluster.userData.spawnedBuildings.push(midBld);
    });

    // 4. FAR HORIZON LOD LAYER (Low-detail 2-mesh silhouette at X = ±40.5m)
    const farLod = createFarLodBuilding(chunkIndex * 97 + (side > 0 ? 23 : 13));
    farLod.rotation.y = rotY;
    farLod.position.set(side * BUILDING_CONFIG.FAR_LOD_LAYER_X, 0, 2);
    cluster.add(farLod);

    _chunkClusterMap.set(clusterKey, cluster);
    return cluster;
  },

  setNight(isNight) {
    setNight(isNight);
  },

  dispose() {
    _chunkClusterMap.forEach((cluster) => recycleClusterBuildings(cluster));
    _chunkClusterMap.clear();
    _buildingPools.clear();
    _activeBuildings.clear();
  }
};

// ============================================================================
// NIGHT MODE & ANIMATION UPDATER: setNight(bool) & updateBuildings(dt)
// ============================================================================
export function setNight(isNight) {
  const nextState = Boolean(isNight);
  if (_isNightMode === nextState) return;
  _isNightMode = nextState;

  // Toggle shared emissive window, crescent, cross & LED materials in O(1)
  NIGHT_MATERIALS.windowLitWarm.color.setHex(_isNightMode ? 0xfef08a : 0x64748b);
  NIGHT_MATERIALS.windowLitCool.color.setHex(_isNightMode ? 0x7dd3fc : 0x475569);
  NIGHT_MATERIALS.minaretCrescent.color.setHex(_isNightMode ? 0x34d399 : 0x059669);
  NIGHT_MATERIALS.hospitalCross.color.setHex(_isNightMode ? 0xf43f5e : 0xdc2626);
  NIGHT_MATERIALS.lanternGlow.color.setHex(_isNightMode ? 0xfde047 : 0xb45309);
  NIGHT_MATERIALS.petrolCanopyEdge.color.setHex(_isNightMode ? 0x4ade80 : 0x16a34a);
}

let _animClock = 0;
export function updateBuildings(dt = 0.016) {
  _animClock += dt;

  // Blink wedding hall fairy lights & gently rotate construction cranes
  const pulse = Math.sin(_animClock * 5.5) > 0;
  NIGHT_MATERIALS.weddingLedGold.color.setHex(pulse ? 0xfef08a : 0xf97316);
  NIGHT_MATERIALS.weddingLedPink.color.setHex(pulse ? 0xf472b6 : 0xa855f7);

  _activeBuildings.forEach((bld) => {
    if (bld.userData.craneJib) {
      bld.userData.craneJib.rotation.y = Math.sin(_animClock * 0.45) * 0.65;
    }
  });
}

// ============================================================================
// INTERACTIVE 3D SHOWCASE: showBuildingGallery(scene, forceState, stageFilter)
// ============================================================================
let _galleryGroup = null;
let _galleryActive = false;

/**
 * Key B Showcase:
 * Lines up all 12 Pakistani Skyline Building Types (or filtered by Stage 1, 2, 3)
 * on a 2-tier avenue stage for visual inspection.
 */
export function showBuildingGallery(scene, forceState, stageFilter = 0) {
  if (!scene) return false;
  _galleryActive = forceState !== undefined ? Boolean(forceState) : !_galleryActive;

  if (_galleryGroup) {
    if (_galleryGroup.parent) _galleryGroup.parent.remove(_galleryGroup);
    _galleryGroup = null;
  }

  if (!_galleryActive) {
    return false;
  }

  _galleryGroup = new THREE.Group();
  _galleryGroup.name = 'PakistaniSkylineBuildingGallery';

  // Showcase Ground Platform
  const stageBase = new THREE.Mesh(SHARED_GEO.box, getLambert(0x292524));
  stageBase.scale.set(96, 0.35, 36);
  stageBase.position.set(0, -0.175, -4);
  _galleryGroup.add(stageBase);

  const typesToShow =
    stageFilter >= 1 && stageFilter <= 3
      ? BUILDING_CONFIG.STAGE_GROUPS[stageFilter]
      : BUILDING_TYPE_KEYS;

  const isSingleStage = typesToShow.length <= 5;
  const cols = isSingleStage ? typesToShow.length : 6;
  const spacingX = isSingleStage ? 14.5 : 14.2;

  typesToShow.forEach((type, idx) => {
    const row = isSingleStage ? 0 : Math.floor(idx / cols);
    const col = isSingleStage ? idx : idx % cols;
    const rowCount = isSingleStage ? typesToShow.length : cols;

    const bld = createBuilding(type, { seed: (idx + 1) * 97 });
    const xPos = (col - (rowCount - 1) * 0.5) * spacingX;
    const zPos = row === 0 ? 1.5 : -11.5;
    const yPos = row === 0 ? 0 : 2.2;

    bld.position.set(xPos, yPos, zPos);
    bld.scale.setScalar(0.82);
    _galleryGroup.add(bld);
    _activeBuildings.add(bld);
  });

  patchObjectHierarchy(_galleryGroup);
  scene.add(_galleryGroup);
  return true;
}

