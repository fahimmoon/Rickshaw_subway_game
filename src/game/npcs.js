import * as THREE from 'three';
import { patchObjectHierarchy } from './curve';

/**
 * ============================================================================
 * KARACHI LIVING STREET NPC SYSTEM (npcs.js)
 * ============================================================================
 * 100% procedural low-poly chunky cartoon characters & street animals built
 * strictly from Three.js primitives (BoxGeometry, CylinderGeometry,
 * SphereGeometry, ConeGeometry) with flat-shaded materials.
 *
 * Includes:
 * - 10 Karachi Pedestrian, Vendor, Laborer, Police & Rider types
 * - 5 Street Animal & Bird Flock types (Stray Dog, Stray Cat, Cow/Goat,
 *   Gadha Gari Donkey Cart, Crows/Pigeons Flock)
 * - Shared Geometry & Material caches + Object Pooling (<= 25 active NPCs)
 * - Pivot-based limb animations, Horn scatter reactions, Proximity dodge,
 *   and interactive 3D showNPCGallery() (toggle with Key G).
 */

export const NPC_CONFIG = {
  // PERF (Stage 3): Cap active NPCs to keep total NPC count <= 20
  MAX_ACTIVE_NPCS: 14,
  DESPAWN_BEHIND_DIST: 18,
  SPAWN_INTERVAL_Z: 20,
  DODGE_RADIUS: 3.2,
  HORN_REACTION_RADIUS: 22.0,
  BIRD_TAKEOFF_RADIUS: 14.0,
  KID_WAVE_RADIUS: 14.0,
  COLLISION_PENALTY_RUPEES: 15,

  // Speeds (meters / second)
  WALK_SPEED_MIN: 1.3,
  WALK_SPEED_MAX: 2.2,
  RUN_SPEED: 4.8,
  CROSS_ROAD_SPEED: 2.6,
  DOG_TROT_SPEED: 2.8,
  CAT_DART_SPEED: 3.6,
  COW_AMBLE_SPEED: 0.55,
  GOAT_HOP_SPEED: 1.8,
  DONKEY_CART_SPEED: 3.2,
  RIDER_TRAFFIC_SPEED: 9.5,
  BIRD_FLY_SPEED: 8.5,

  // Sidewalk & Road Coordinates (matches 3-lane road [-3.5, 0, +3.5])
  SIDEWALK_LEFT_X: -6.8,
  SIDEWALK_RIGHT_X: 6.8,
  ROADSIDE_LEFT_X: -5.4,
  ROADSIDE_RIGHT_X: 5.4,
  CURB_LEFT_X: -4.8,
  CURB_RIGHT_X: 4.8,

  // Authentic Karachi Palettes
  SKIN_TONES: [0xd9a17c, 0xc68642, 0xa56b46, 0x8d5524, 0x6b3e26],
  KURTA_MEN_COLORS: [0xf8fafc, 0xbae6fd, 0xe7dec8, 0x86efac, 0xcbd5e1, 0xd6d3d1],
  SHIRT_MEN_COLORS: [0x2563eb, 0xdc2626, 0x16a34a, 0xd97706, 0x4f46e5, 0x0d9488],
  TROUSER_COLORS: [0x1e293b, 0x334155, 0x475569, 0x292524, 0xf1f5f9],
  WOMAN_KURTA_COLORS: [0xec4899, 0x0d9488, 0x991b1b, 0xeab308, 0x9333ea, 0xe11d48],
  DUPATTA_COLORS: [0xfef08a, 0xfbcfe8, 0x99f6e4, 0xfde047, 0xffffff, 0xfecdd3],
  BACKPACK_COLORS: [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6],
  UMBRELLA_COLORS: [0xdc2626, 0x16a34a, 0x2563eb, 0xeab308, 0xdb2777],
  HAIR_COLORS: [0x171717, 0x27272a, 0x3f2314],
  DOG_COLORS: [0xb45309, 0x92400e, 0xd97706, 0x78350f, 0x57534e],
  CAT_COLORS: [0xf97316, 0x52525b, 0xf8fafc, 0x27272a]
};

export const NPC_TYPES = [
  // First 5 Pedestrian Types
  'MAN_SHALWAR_KAMEEZ',
  'MAN_SHIRT_PANTS',
  'WOMAN_DUPATTA',
  'WOMAN_ABAYA',
  'SCHOOL_KID',
  // Vendors, Police, Riders & Laborers
  'CHAI_WALA',
  'FRUIT_SELLER',
  'TRAFFIC_POLICE',
  'TRAFFIC_RIDER',
  'LABORER',
  // Animals & Birds
  'STRAY_DOG',
  'STRAY_CAT',
  'GOAT_OR_COW',
  'DONKEY_CART',
  'BIRDS_FLOCK'
];

// ============================================================================
// SHARED GEOMETRY & MATERIAL POOL (Created once for 60 FPS mobile performance)
// ============================================================================
const SHARED_GEOS = {};
const SHARED_MATS = {};

function getGeo(key, factory) {
  if (!SHARED_GEOS[key]) {
    SHARED_GEOS[key] = factory();
  }
  return SHARED_GEOS[key];
}

function getMat(colorHex, extra = {}) {
  const key = `${colorHex}_${extra.opacity || 1}_${extra.transparent ? 1 : 0}_${extra.emissive || 0}`;
  if (!SHARED_MATS[key]) {
    SHARED_MATS[key] = new THREE.MeshLambertMaterial({
      color: colorHex,
      flatShading: false,
      ...extra
    });
  }
  return SHARED_MATS[key];
}

function getShadowMat() {
  if (!SHARED_MATS['blob_shadow']) {
    SHARED_MATS['blob_shadow'] = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    });
  }
  return SHARED_MATS['blob_shadow'];
}

function pickRandom(arr, seedVal) {
  if (typeof seedVal === 'number') {
    return arr[Math.abs(Math.floor(seedVal)) % arr.length];
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Adds a soft flat dark blob shadow disc at y = 0.015 under any NPC.
 */
function addBlobShadow(group, radiusX = 0.34, radiusZ = 0.34) {
  const geo = getGeo('blob_shadow_disc', () => {
    const g = new THREE.CircleGeometry(1, 12);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const shadow = new THREE.Mesh(geo, getShadowMat());
  shadow.scale.set(radiusX, 1, radiusZ);
  shadow.position.y = 0.015;
  group.add(shadow);
  return shadow;
}

/**
 * Shared base human builder (~1.7m adult or ~1.1m school kid) with:
 * - Oversized expressive cartoon head, thin cylinder eyes, mouth line
 * - Shoulder-pivoted arms with oversized hands
 * - Hip-pivoted legs
 */
function buildBaseHumanoid({
  scale = 1.0,
  skinHex,
  topHex,
  bottomHex,
  isLongKameez = false,
  isAbaya = false,
  hasTopi = false,
  hasTurban = false,
  hasBeard = false,
  dupattaHex = null,
  hairHex = 0x171717
}) {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  addBlobShadow(root, 0.32 * scale, 0.32 * scale);

  const skinMat = getMat(skinHex);
  const topMat = getMat(topHex);
  const bottomMat = getMat(bottomHex);
  const hairMat = getMat(hairHex);
  const darkMat = getMat(0x111827);

  // Legs with hip pivots at y = 0.72
  const legGeo = getGeo('hum_leg', () => new THREE.BoxGeometry(0.14, 0.68, 0.15));
  const shoeGeo = getGeo('hum_shoe', () => new THREE.BoxGeometry(0.15, 0.08, 0.22));

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, 0.70, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, bottomMat);
  leftLegMesh.position.y = -0.34;
  leftLeg.add(leftLegMesh);
  const leftShoe = new THREE.Mesh(shoeGeo, darkMat);
  leftShoe.position.set(0, -0.66, -0.03);
  leftLeg.add(leftShoe);
  bodyPivot.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, 0.70, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, bottomMat);
  rightLegMesh.position.y = -0.34;
  rightLeg.add(rightLegMesh);
  const rightShoe = new THREE.Mesh(shoeGeo, darkMat);
  rightShoe.position.set(0, -0.66, -0.03);
  rightLeg.add(rightShoe);
  bodyPivot.add(rightLeg);

  // Torso / Kameez / Abaya
  if (isAbaya) {
    const abayaGeo = getGeo('hum_abaya', () => new THREE.ConeGeometry(0.30, 1.18, 8));
    const abayaMesh = new THREE.Mesh(abayaGeo, topMat);
    abayaMesh.position.y = 0.68;
    bodyPivot.add(abayaMesh);
  } else {
    const torsoGeo = getGeo(
      isLongKameez ? 'hum_kameez' : 'hum_shirt',
      () => new THREE.BoxGeometry(0.38, isLongKameez ? 0.76 : 0.56, 0.22)
    );
    const torsoMesh = new THREE.Mesh(torsoGeo, topMat);
    torsoMesh.position.y = isLongKameez ? 0.88 : 0.96;
    bodyPivot.add(torsoMesh);
  }

  // Arms with shoulder pivots at y = 1.20
  const armGeo = getGeo('hum_arm', () => new THREE.BoxGeometry(0.11, 0.48, 0.11));
  const handGeo = getGeo('hum_hand', () => new THREE.SphereGeometry(0.085, 6, 6));

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.25, 1.20, 0);
  const leftSleeve = new THREE.Mesh(armGeo, topMat);
  leftSleeve.position.y = -0.22;
  leftArm.add(leftSleeve);
  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.position.y = -0.48;
  leftArm.add(leftHand);
  bodyPivot.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.25, 1.20, 0);
  const rightSleeve = new THREE.Mesh(armGeo, topMat);
  rightSleeve.position.y = -0.22;
  rightArm.add(rightSleeve);
  const rightHand = new THREE.Mesh(handGeo, skinMat);
  rightHand.position.y = -0.48;
  rightArm.add(rightHand);
  bodyPivot.add(rightArm);

  // Oversized Chunky Cartoon Head (pivot at y = 1.28)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.28, 0);

  const headGeo = getGeo('hum_head', () => new THREE.BoxGeometry(0.34, 0.35, 0.32));
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.y = 0.18;
  headGroup.add(headMesh);

  // Eyes (2 tiny dark cylinders on -Z face) + simple mouth line
  const eyeGeo = getGeo('hum_eye', () => {
    const g = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 6);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const leftEye = new THREE.Mesh(eyeGeo, darkMat);
  leftEye.position.set(-0.075, 0.21, -0.162);
  headGroup.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, darkMat);
  rightEye.position.set(0.075, 0.21, -0.162);
  headGroup.add(rightEye);

  const mouthGeo = getGeo('hum_mouth', () => new THREE.BoxGeometry(0.09, 0.018, 0.02));
  const mouth = new THREE.Mesh(mouthGeo, darkMat);
  mouth.position.set(0, 0.10, -0.162);
  headGroup.add(mouth);

  // Optional Beard (small dark box on chin)
  if (hasBeard) {
    const beardGeo = getGeo('hum_beard', () => new THREE.BoxGeometry(0.24, 0.12, 0.14));
    const beard = new THREE.Mesh(beardGeo, hairMat);
    beard.position.set(0, 0.06, -0.11);
    headGroup.add(beard);
  }

  // Headwear: Prayer Cap (Topi), Turban (Pagri), Dupatta / Hijab, or Block Hair
  if (hasTopi) {
    const topiGeo = getGeo('hum_topi', () => new THREE.CylinderGeometry(0.18, 0.19, 0.11, 8));
    const topi = new THREE.Mesh(topiGeo, getMat(0xf8fafc));
    topi.position.set(0, 0.38, 0);
    headGroup.add(topi);
  } else if (hasTurban) {
    const turbanGeo = getGeo('hum_turban', () => new THREE.SphereGeometry(0.22, 8, 6));
    const turban = new THREE.Mesh(turbanGeo, getMat(0xfef3c7));
    turban.scale.set(1.05, 0.72, 1.05);
    turban.position.set(0, 0.37, 0);
    headGroup.add(turban);
  } else if (dupattaHex !== null) {
    const dupMat = getMat(dupattaHex);
    const headDupGeo = getGeo('hum_head_dupatta', () => new THREE.BoxGeometry(0.37, 0.36, 0.34));
    const headDup = new THREE.Mesh(headDupGeo, dupMat);
    headDup.position.set(0, 0.20, 0.02);
    headGroup.add(headDup);

    // Shoulder drape box
    const drapeGeo = getGeo('hum_shoulder_drape', () => new THREE.BoxGeometry(0.48, 0.12, 0.28));
    const drape = new THREE.Mesh(drapeGeo, dupMat);
    drape.position.set(0, 1.21, 0.01);
    bodyPivot.add(drape);
  } else {
    const hairGeo = getGeo('hum_hair', () => new THREE.BoxGeometry(0.36, 0.11, 0.34));
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.36, 0.01);
    headGroup.add(hair);
  }

  bodyPivot.add(headGroup);

  if (scale !== 1.0) {
    bodyPivot.scale.setScalar(scale);
  }

  root.userData = {
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headGroup,
    animPhase: Math.random() * Math.PI * 2
  };

  return root;
}

// ============================================================================
// 1–5: PEDESTRIAN FACTORY FUNCTIONS
// ============================================================================

/**
 * 1. Man in Shalwar Kameez:
 * Kurta in random color (white, sky blue, beige, green, grey), matching trousers,
 * optional prayer cap (topi) or turban, optional beard.
 */
export function createManShalwarKameez(options = {}) {
  const kurtaColor = options.color || pickRandom(NPC_CONFIG.KURTA_MEN_COLORS);
  const skinHex = pickRandom(NPC_CONFIG.SKIN_TONES);
  const headRoll = Math.random();
  const hasTopi = options.hasTopi ?? headRoll < 0.45;
  const hasTurban = !hasTopi && headRoll < 0.65;
  const hasBeard = options.hasBeard ?? Math.random() < 0.55;

  const npc = buildBaseHumanoid({
    scale: 1.0,
    skinHex,
    topHex: kurtaColor,
    bottomHex: kurtaColor,
    isLongKameez: true,
    hasTopi,
    hasTurban,
    hasBeard,
    hairHex: pickRandom(NPC_CONFIG.HAIR_COLORS)
  });

  // Optional waistcoat (Karachi / Quetta style)
  if (Math.random() < 0.35) {
    const vestGeo = getGeo('men_vest', () => new THREE.BoxGeometry(0.40, 0.44, 0.24));
    const vest = new THREE.Mesh(vestGeo, getMat(0x292524));
    vest.position.y = 1.02;
    npc.userData.bodyPivot.add(vest);
  }

  npc.userData.npcType = 'MAN_SHALWAR_KAMEEZ';
  npc.userData.label = 'Man in Shalwar Kameez';
  return npc;
}

/**
 * 2. Man in Shirt / Pants:
 * Casual Karachi commuter with random shirt color and dark trousers.
 */
export function createManShirtPants(options = {}) {
  const shirtColor = options.color || pickRandom(NPC_CONFIG.SHIRT_MEN_COLORS);
  const pantsColor = pickRandom(NPC_CONFIG.TROUSER_COLORS);
  const skinHex = pickRandom(NPC_CONFIG.SKIN_TONES);

  const npc = buildBaseHumanoid({
    scale: 1.0,
    skinHex,
    topHex: shirtColor,
    bottomHex: pantsColor,
    isLongKameez: false,
    hasBeard: Math.random() < 0.3,
    hairHex: pickRandom(NPC_CONFIG.HAIR_COLORS)
  });

  npc.userData.npcType = 'MAN_SHIRT_PANTS';
  npc.userData.label = 'Man in Shirt & Pants';
  return npc;
}

/**
 * 3. Woman in Shalwar Kameez with Dupatta:
 * Bright kurta (pink, teal, maroon, mustard) with a thin flat box draped over head & shoulders.
 */
export function createWomanDupatta(options = {}) {
  const kurtaColor = options.color || pickRandom(NPC_CONFIG.WOMAN_KURTA_COLORS);
  const dupattaColor = pickRandom(NPC_CONFIG.DUPATTA_COLORS);
  const skinHex = pickRandom(NPC_CONFIG.SKIN_TONES);

  const npc = buildBaseHumanoid({
    scale: 0.96,
    skinHex,
    topHex: kurtaColor,
    bottomHex: kurtaColor,
    isLongKameez: true,
    dupattaHex: dupattaColor
  });

  npc.userData.npcType = 'WOMAN_DUPATTA';
  npc.userData.label = 'Woman in Shalwar Kameez & Dupatta';
  return npc;
}

/**
 * 4. Woman in Black Abaya / Chadar:
 * Long dark robe with draped headscarf.
 */
export function createWomanAbaya(options = {}) {
  const robeHex = options.color || (Math.random() < 0.8 ? 0x18181b : 0x1e293b);
  const skinHex = pickRandom(NPC_CONFIG.SKIN_TONES);

  const npc = buildBaseHumanoid({
    scale: 0.96,
    skinHex,
    topHex: robeHex,
    bottomHex: robeHex,
    isAbaya: true,
    dupattaHex: robeHex
  });

  npc.userData.npcType = 'WOMAN_ABAYA';
  npc.userData.label = 'Woman in Black Abaya / Chadar';
  return npc;
}

/**
 * 5. School Kid (~1.1 units tall):
 * Uniform (white shirt, navy or grey bottoms) with a small colored backpack;
 * girl version has a white dupatta. Waves at the player as he passes!
 */
export function createSchoolKid(options = {}) {
  const isGirl = options.isGirl ?? Math.random() < 0.5;
  const bottomHex = Math.random() < 0.6 ? 0x1e3a8a : 0x475569;
  const skinHex = pickRandom(NPC_CONFIG.SKIN_TONES);
  const backpackHex = pickRandom(NPC_CONFIG.BACKPACK_COLORS);

  const npc = buildBaseHumanoid({
    scale: 0.66, // ~1.12m tall
    skinHex,
    topHex: 0xf8fafc,
    bottomHex,
    isLongKameez: isGirl,
    dupattaHex: isGirl ? 0xffffff : null,
    hairHex: 0x171717
  });

  // School Backpack on back (+Z face)
  const packGeo = getGeo('kid_backpack', () => new THREE.BoxGeometry(0.28, 0.34, 0.16));
  const pack = new THREE.Mesh(packGeo, getMat(backpackHex));
  pack.position.set(0, 1.0, 0.18);
  npc.userData.bodyPivot.add(pack);

  npc.userData.npcType = 'SCHOOL_KID';
  npc.userData.isSchoolKid = true;
  npc.userData.label = isGirl ? 'School Girl (Uniform & Backpack)' : 'School Boy (Uniform & Backpack)';
  return npc;
}

// ============================================================================
// 6–10: VENDORS, TRAFFIC POLICE, RIDERS & LABORERS
// ============================================================================

/**
 * 6. Chai Wala / Quetta Tea Vendor:
 * Wearing apron, standing next to a small wooden cart with a brass kettle/samovar,
 * and a colorful umbrella.
 */
export function createChaiWala(options = {}) {
  const group = new THREE.Group();
  addBlobShadow(group, 1.15, 0.85);

  // Vendor figure positioned at x = -0.55
  const vendor = buildBaseHumanoid({
    scale: 1.0,
    skinHex: pickRandom(NPC_CONFIG.SKIN_TONES),
    topHex: 0xbae6fd,
    bottomHex: 0xf8fafc,
    isLongKameez: true,
    hasTopi: true,
    hasBeard: true
  });
  vendor.position.set(-0.58, 0, 0);

  // Apron on vendor front
  const apronGeo = getGeo('vendor_apron', () => new THREE.BoxGeometry(0.36, 0.56, 0.04));
  const apron = new THREE.Mesh(apronGeo, getMat(0xdc2626));
  apron.position.set(0, 0.88, -0.12);
  vendor.userData.bodyPivot.add(apron);
  group.add(vendor);

  // Small Chai Cart at x = +0.35
  const cartGroup = new THREE.Group();
  cartGroup.position.set(0.35, 0, 0);

  const counterGeo = getGeo('chai_cart_box', () => new THREE.BoxGeometry(0.95, 0.65, 0.65));
  const counter = new THREE.Mesh(counterGeo, getMat(0x92400e));
  counter.position.y = 0.52;
  cartGroup.add(counter);

  // Brass Kettle / Samovar on counter
  const kettleBodyGeo = getGeo('chai_kettle', () => new THREE.CylinderGeometry(0.14, 0.16, 0.36, 8));
  const kettle = new THREE.Mesh(kettleBodyGeo, getMat(0xf59e0b));
  kettle.position.set(-0.15, 1.02, 0);
  cartGroup.add(kettle);

  // Tea cups row
  const cupGeo = getGeo('chai_cup', () => new THREE.CylinderGeometry(0.04, 0.03, 0.09, 6));
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(cupGeo, getMat(0xfef3c7));
    cup.position.set(0.12 + i * 0.11, 0.89, -0.12);
    cartGroup.add(cup);
  }

  // Colorful Umbrella Pole + Cone Canopy
  const poleGeo = getGeo('umb_pole', () => new THREE.CylinderGeometry(0.03, 0.03, 1.65, 6));
  const pole = new THREE.Mesh(poleGeo, getMat(0xd4d4d8));
  pole.position.set(0, 1.60, 0);
  cartGroup.add(pole);

  const umbConeGeo = getGeo('umb_cone', () => new THREE.ConeGeometry(0.95, 0.42, 8));
  const umbColor = options.umbrellaColor || pickRandom(NPC_CONFIG.UMBRELLA_COLORS);
  const umbCanopy = new THREE.Mesh(umbConeGeo, getMat(umbColor));
  umbCanopy.position.set(0, 2.42, 0);
  cartGroup.add(umbCanopy);

  group.add(cartGroup);

  group.userData = {
    ...vendor.userData,
    npcType: 'CHAI_WALA',
    isStationaryVendor: true,
    label: 'Karachi Quetta Chai Wala & Cart'
  };
  return group;
}

/**
 * 7. Fruit / Vegetable Seller (Thela Pushcart):
 * Wooden pushcart on two spoked wheels with piles of colored spheres
 * (oranges, apples, bananas, pomegranates) + vendor fanning the cart.
 */
export function createFruitSeller() {
  const group = new THREE.Group();
  addBlobShadow(group, 1.25, 0.95);

  // Vendor standing behind/beside pushcart
  const vendor = buildBaseHumanoid({
    scale: 1.0,
    skinHex: pickRandom(NPC_CONFIG.SKIN_TONES),
    topHex: 0xe7dec8,
    bottomHex: 0xe7dec8,
    isLongKameez: true,
    hasTurban: true
  });
  vendor.position.set(-0.68, 0, 0.15);
  group.add(vendor);

  // Wooden Pushcart (Thela)
  const cart = new THREE.Group();
  cart.position.set(0.28, 0, 0);

  const bedGeo = getGeo('thela_bed', () => new THREE.BoxGeometry(1.15, 0.18, 0.82));
  const bed = new THREE.Mesh(bedGeo, getMat(0x78350f));
  bed.position.y = 0.68;
  cart.add(bed);

  // 2 Large Cart Wheels
  const wheelGeo = getGeo('thela_wheel', () => {
    const g = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const wLeft = new THREE.Mesh(wheelGeo, getMat(0x292524));
  wLeft.position.set(-0.56, 0.32, 0);
  cart.add(wLeft);

  const wRight = new THREE.Mesh(wheelGeo, getMat(0x292524));
  wRight.position.set(0.56, 0.32, 0);
  cart.add(wRight);

  // Piles of colorful fruit spheres (Oranges, Red Apples, Yellow Mangoes/Bananas, Green Guavas)
  const fruitGeo = getGeo('fruit_sphere', () => new THREE.SphereGeometry(0.095, 6, 6));
  const fruitColors = [0xf97316, 0xdc2626, 0xfacc15, 0x22c55e];
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      const fColor = fruitColors[Math.abs(gx + gz * 2) % fruitColors.length];
      const fMat = getMat(fColor);
      const s1 = new THREE.Mesh(fruitGeo, fMat);
      s1.position.set(gx * 0.28, 0.84, gz * 0.20);
      cart.add(s1);
    }
  }
  group.add(cart);

  group.userData = {
    ...vendor.userData,
    npcType: 'FRUIT_SELLER',
    isStationaryVendor: true,
    label: 'Fruit & Vegetable Thela Seller'
  };
  return group;
}

/**
 * 8. Karachi Traffic Police Officer:
 * Crisp light-blue/white shirt, dark navy trousers, white peaked cap,
 * holding a red-and-white STOP sign paddle in his right hand.
 */
export function createTrafficPolice() {
  const npc = buildBaseHumanoid({
    scale: 1.02,
    skinHex: pickRandom(NPC_CONFIG.SKIN_TONES),
    topHex: 0xe0f2fe, // Crisp Karachi Traffic Police light-blue/white shirt
    bottomHex: 0x1e3a8a, // Dark navy trousers
    isLongKameez: false,
    hasBeard: Math.random() < 0.35
  });

  // White Traffic Police Peaked Cap with Blue Band
  const capCrownGeo = getGeo('police_cap_crown', () => new THREE.CylinderGeometry(0.21, 0.19, 0.11, 8));
  const capCrown = new THREE.Mesh(capCrownGeo, getMat(0xffffff));
  capCrown.position.set(0, 0.39, 0);
  npc.userData.headGroup.add(capCrown);

  const visorGeo = getGeo('police_visor', () => new THREE.BoxGeometry(0.26, 0.03, 0.14));
  const visor = new THREE.Mesh(visorGeo, getMat(0x0f172a));
  visor.position.set(0, 0.34, -0.16);
  npc.userData.headGroup.add(visor);

  // Stop-Sign Paddle in Right Hand
  const stickGeo = getGeo('paddle_stick', () => new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6));
  const stick = new THREE.Mesh(stickGeo, getMat(0xf8fafc));
  stick.position.set(0, -0.52, -0.14);
  stick.rotation.x = Math.PI / 3;
  npc.userData.rightArm.add(stick);

  const signGeo = getGeo('paddle_disc', () => new THREE.CylinderGeometry(0.15, 0.15, 0.03, 8));
  const sign = new THREE.Mesh(signGeo, getMat(0xdc2626));
  sign.rotation.z = Math.PI / 2;
  sign.position.set(0, -0.24, 0);
  stick.add(sign);

  // Raise right arm slightly to hold paddle
  npc.userData.rightArm.rotation.x = -0.65;

  npc.userData.npcType = 'TRAFFIC_POLICE';
  npc.userData.label = 'Karachi Traffic Police (Stop Paddle)';
  return npc;
}

/**
 * 9. Rickshaw / Bike Riders (Other Traffic NPCs):
 * Builds either a 70cc Karachi motorbike with a helmeted rider OR a compact
 * green-and-yellow Karachi mini-rickshaw with a visible driver.
 */
export function createTrafficRider(options = {}) {
  const isMiniRickshaw = options.variant === 'rickshaw' || (options.variant !== 'bike' && Math.random() < 0.45);
  const group = new THREE.Group();
  addBlobShadow(group, isMiniRickshaw ? 0.65 : 0.42, isMiniRickshaw ? 1.15 : 0.90);

  const wheelGeo = getGeo('rider_wheel', () => {
    const g = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const darkMat = getMat(0x18181b);

  if (!isMiniRickshaw) {
    // 70cc Motorbike + Helmeted Rider
    const frontWheel = new THREE.Mesh(wheelGeo, darkMat);
    frontWheel.position.set(0, 0.28, -0.62);
    group.add(frontWheel);

    const rearWheel = new THREE.Mesh(wheelGeo, darkMat);
    rearWheel.position.set(0, 0.28, 0.62);
    group.add(rearWheel);

    const frameGeo = getGeo('bike_frame', () => new THREE.BoxGeometry(0.22, 0.34, 1.15));
    const tankColor = pickRandom([0xdc2626, 0x1d4ed8, 0x15803d]);
    const frame = new THREE.Mesh(frameGeo, getMat(tankColor));
    frame.position.set(0, 0.58, 0);
    group.add(frame);

    const headlightGeo = getGeo('bike_lamp', () => new THREE.BoxGeometry(0.18, 0.16, 0.10));
    const lamp = new THREE.Mesh(headlightGeo, getMat(0xfef08a, { emissive: 0xfacc15 }));
    lamp.position.set(0, 0.78, -0.62);
    group.add(lamp);

    // Rider torso & helmeted head
    const torsoGeo = getGeo('rider_torso', () => new THREE.BoxGeometry(0.34, 0.50, 0.22));
    const torso = new THREE.Mesh(torsoGeo, getMat(pickRandom(NPC_CONFIG.SHIRT_MEN_COLORS)));
    torso.position.set(0, 1.02, 0.08);
    torso.rotation.x = -0.18;
    group.add(torso);

    const helmetGeo = getGeo('rider_helmet', () => new THREE.SphereGeometry(0.21, 8, 8));
    const helmet = new THREE.Mesh(helmetGeo, getMat(0xf8fafc));
    helmet.position.set(0, 1.42, 0.02);
    group.add(helmet);

    const visor = new THREE.Mesh(
      getGeo('helmet_visor', () => new THREE.BoxGeometry(0.26, 0.10, 0.12)),
      darkMat
    );
    visor.position.set(0, 1.42, -0.15);
    group.add(visor);

    group.userData = {
      npcType: 'TRAFFIC_RIDER',
      isVehicleNPC: true,
      wheels: [frontWheel, rearWheel],
      label: '70cc Bike Rider (Helmeted)'
    };
  } else {
    // Mini Auto-Rickshaw with Visible Driver
    const fWheel = new THREE.Mesh(wheelGeo, darkMat);
    fWheel.position.set(0, 0.28, -0.82);
    group.add(fWheel);

    const rLeft = new THREE.Mesh(wheelGeo, darkMat);
    rLeft.position.set(-0.52, 0.28, 0.68);
    group.add(rLeft);

    const rRight = new THREE.Mesh(wheelGeo, darkMat);
    rRight.position.set(0.52, 0.28, 0.68);
    group.add(rRight);

    const bodyGeo = getGeo('mini_rick_body', () => new THREE.BoxGeometry(1.08, 0.62, 1.55));
    const body = new THREE.Mesh(bodyGeo, getMat(0x16a34a));
    body.position.set(0, 0.62, 0.05);
    group.add(body);

    const roofGeo = getGeo('mini_rick_roof', () => new THREE.BoxGeometry(1.12, 0.14, 1.50));
    const roof = new THREE.Mesh(roofGeo, getMat(0xfacc15));
    roof.position.set(0, 1.48, 0.05);
    group.add(roof);

    // Visible Driver inside front cab
    const driverHead = new THREE.Mesh(
      getGeo('hum_head', () => new THREE.BoxGeometry(0.34, 0.35, 0.32)),
      getMat(pickRandom(NPC_CONFIG.SKIN_TONES))
    );
    driverHead.scale.setScalar(0.75);
    driverHead.position.set(0, 1.12, -0.25);
    group.add(driverHead);

    group.userData = {
      npcType: 'TRAFFIC_RIDER',
      isVehicleNPC: true,
      wheels: [fWheel, rLeft, rRight],
      label: 'Mini-Rickshaw & Visible Driver'
    };
  }

  return group;
}

/**
 * 10. Laborer (Mazdoor) Carrying a Sack or Brick Tray on Head:
 */
export function createLaborer(options = {}) {
  const carryBrickTray = options.carryBrickTray ?? Math.random() < 0.5;
  const npc = buildBaseHumanoid({
    scale: 1.0,
    skinHex: pickRandom(NPC_CONFIG.SKIN_TONES),
    topHex: 0xa8a29e,
    bottomHex: 0x78716c,
    isLongKameez: true,
    hasBeard: true
  });

  // Raise both arms to steady the load on top of the head
  npc.userData.leftArm.rotation.z = 2.45;
  npc.userData.rightArm.rotation.z = -2.45;

  if (carryBrickTray) {
    const trayGeo = getGeo('labor_tray', () => new THREE.CylinderGeometry(0.32, 0.22, 0.10, 8));
    const tray = new THREE.Mesh(trayGeo, getMat(0x57534e));
    tray.position.set(0, 0.42, 0);
    npc.userData.headGroup.add(tray);

    const brickGeo = getGeo('labor_brick', () => new THREE.BoxGeometry(0.18, 0.09, 0.10));
    const brickMat = getMat(0xb91c1c);
    for (let i = -1; i <= 1; i++) {
      const b = new THREE.Mesh(brickGeo, brickMat);
      b.position.set(i * 0.11, 0.50, 0);
      npc.userData.headGroup.add(b);
    }
  } else {
    // Burlap Flour / Grain Sack (Bori) balanced on head
    const sackGeo = getGeo('labor_sack', () => new THREE.BoxGeometry(0.46, 0.24, 0.34));
    const sack = new THREE.Mesh(sackGeo, getMat(0xd6c7b2));
    sack.position.set(0, 0.46, 0);
    npc.userData.headGroup.add(sack);
  }

  npc.userData.npcType = 'LABORER';
  npc.userData.isLaborer = true;
  npc.userData.label = carryBrickTray ? 'Laborer Carrying Brick Tray' : 'Laborer Carrying Grain Sack';
  return npc;
}

// ============================================================================
// 11–15: STREET ANIMALS, GADHA GARI (DONKEY CART) & BIRDS FLOCK
// ============================================================================

/**
 * 11. Stray Dog:
 * Brown/tan blocky body, 4 leg pivots, wagging tail, snout & ears.
 */
export function createStrayDog() {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  addBlobShadow(group, 0.28, 0.42);

  const coatMat = getMat(pickRandom(NPC_CONFIG.DOG_COLORS));
  const darkMat = getMat(0x1f2937);

  const torsoGeo = getGeo('dog_torso', () => new THREE.BoxGeometry(0.26, 0.24, 0.56));
  const torso = new THREE.Mesh(torsoGeo, coatMat);
  torso.position.set(0, 0.36, 0);
  bodyPivot.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.48, -0.30);
  const headMesh = new THREE.Mesh(
    getGeo('dog_head', () => new THREE.BoxGeometry(0.22, 0.20, 0.22)),
    coatMat
  );
  headGroup.add(headMesh);

  const snout = new THREE.Mesh(
    getGeo('dog_snout', () => new THREE.BoxGeometry(0.12, 0.10, 0.14)),
    darkMat
  );
  snout.position.set(0, -0.03, -0.15);
  headGroup.add(snout);
  bodyPivot.add(headGroup);

  // Tail pivot at rear
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.44, 0.28);
  const tailMesh = new THREE.Mesh(
    getGeo('dog_tail', () => new THREE.BoxGeometry(0.05, 0.22, 0.05)),
    coatMat
  );
  tailMesh.position.set(0, 0.09, 0.05);
  tailMesh.rotation.x = -0.5;
  tailPivot.add(tailMesh);
  bodyPivot.add(tailPivot);

  // 4 Legs
  const legGeo = getGeo('dog_leg', () => new THREE.BoxGeometry(0.07, 0.26, 0.07));
  const legs = [];
  const offsets = [
    [-0.09, 0.24, -0.20],
    [0.09, 0.24, -0.20],
    [-0.09, 0.24, 0.20],
    [0.09, 0.24, 0.20]
  ];
  offsets.forEach(([lx, ly, lz]) => {
    const lp = new THREE.Group();
    lp.position.set(lx, ly, lz);
    const lm = new THREE.Mesh(legGeo, coatMat);
    lm.position.y = -0.12;
    lp.add(lm);
    bodyPivot.add(lp);
    legs.push(lp);
  });

  group.userData = {
    npcType: 'STRAY_DOG',
    isAnimal: true,
    bodyPivot,
    headGroup,
    tailPivot,
    quadLegs: legs,
    animPhase: Math.random() * Math.PI * 2,
    label: 'Karachi Stray Dog (Tail Wag)'
  };
  return group;
}

/**
 * 12. Stray Cat:
 * Small agile street cat, sitting or crossing.
 */
export function createStrayCat() {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  addBlobShadow(group, 0.18, 0.26);

  const catMat = getMat(pickRandom(NPC_CONFIG.CAT_COLORS));

  const body = new THREE.Mesh(
    getGeo('cat_body', () => new THREE.BoxGeometry(0.16, 0.15, 0.34)),
    catMat
  );
  body.position.set(0, 0.20, 0);
  bodyPivot.add(body);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.30, -0.18);
  const head = new THREE.Mesh(
    getGeo('cat_head', () => new THREE.BoxGeometry(0.15, 0.14, 0.14)),
    catMat
  );
  headGroup.add(head);

  const earGeo = getGeo('cat_ear', () => new THREE.ConeGeometry(0.035, 0.07, 4));
  const earL = new THREE.Mesh(earGeo, catMat);
  earL.position.set(-0.045, 0.09, 0);
  headGroup.add(earL);
  const earR = new THREE.Mesh(earGeo, catMat);
  earR.position.set(0.045, 0.09, 0);
  headGroup.add(earR);
  bodyPivot.add(headGroup);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.24, 0.17);
  const tail = new THREE.Mesh(
    getGeo('cat_tail', () => new THREE.CylinderGeometry(0.02, 0.02, 0.22, 5)),
    catMat
  );
  tail.position.y = 0.10;
  tailPivot.add(tail);
  bodyPivot.add(tailPivot);

  group.userData = {
    npcType: 'STRAY_CAT',
    isAnimal: true,
    bodyPivot,
    headGroup,
    tailPivot,
    animPhase: Math.random() * Math.PI * 2,
    label: 'Stray Street Cat'
  };
  return group;
}

/**
 * 13. Goat or Sahiwal Cow:
 * Blocky body, horns on the cow (stands in road & chews slowly) or hopping goat.
 */
export function createGoatOrCow(options = {}) {
  const isCow = options.variant === 'cow' || (options.variant !== 'goat' && Math.random() < 0.6);
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  if (isCow) {
    addBlobShadow(group, 0.55, 0.95);
    const cowMat = getMat(0x9a3412); // Sahiwal reddish-brown
    const hornMat = getMat(0xfef3c7);

    const torso = new THREE.Mesh(
      getGeo('cow_torso', () => new THREE.BoxGeometry(0.68, 0.64, 1.38)),
      cowMat
    );
    torso.position.set(0, 0.82, 0);
    bodyPivot.add(torso);

    // Sahiwal Hump
    const hump = new THREE.Mesh(
      getGeo('cow_hump', () => new THREE.SphereGeometry(0.24, 7, 6)),
      cowMat
    );
    hump.position.set(0, 1.18, -0.32);
    bodyPivot.add(hump);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.05, -0.78);
    const head = new THREE.Mesh(
      getGeo('cow_head', () => new THREE.BoxGeometry(0.38, 0.36, 0.44)),
      cowMat
    );
    headGroup.add(head);

    // Curved Horns
    const hornGeo = getGeo('cow_horn', () => new THREE.ConeGeometry(0.05, 0.24, 6));
    const hL = new THREE.Mesh(hornGeo, hornMat);
    hL.position.set(-0.18, 0.24, 0.05);
    hL.rotation.z = 0.4;
    headGroup.add(hL);

    const hR = new THREE.Mesh(hornGeo, hornMat);
    hR.position.set(0.18, 0.24, 0.05);
    hR.rotation.z = -0.4;
    headGroup.add(hR);
    bodyPivot.add(headGroup);

    const legGeo = getGeo('cow_leg', () => new THREE.BoxGeometry(0.14, 0.54, 0.14));
    const legs = [];
    [
      [-0.22, 0.52, -0.46],
      [0.22, 0.52, -0.46],
      [-0.22, 0.52, 0.46],
      [0.22, 0.52, 0.46]
    ].forEach(([lx, ly, lz]) => {
      const lp = new THREE.Group();
      lp.position.set(lx, ly, lz);
      const lm = new THREE.Mesh(legGeo, cowMat);
      lm.position.y = -0.26;
      lp.add(lm);
      bodyPivot.add(lp);
      legs.push(lp);
    });

    group.userData = {
      npcType: 'GOAT_OR_COW',
      isAnimal: true,
      isCow: true,
      bodyPivot,
      headGroup,
      quadLegs: legs,
      animPhase: Math.random() * Math.PI * 2,
      label: 'Road-Blocking Sahiwal Cow'
    };
  } else {
    // Hopping Karachi Bakra (Goat)
    addBlobShadow(group, 0.32, 0.48);
    const goatMat = getMat(0xe7e5e4);
    const torso = new THREE.Mesh(
      getGeo('goat_torso', () => new THREE.BoxGeometry(0.32, 0.32, 0.64)),
      goatMat
    );
    torso.position.set(0, 0.48, 0);
    bodyPivot.add(torso);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.68, -0.34);
    const head = new THREE.Mesh(
      getGeo('goat_head', () => new THREE.BoxGeometry(0.20, 0.22, 0.26)),
      goatMat
    );
    headGroup.add(head);
    bodyPivot.add(headGroup);

    const legGeo = getGeo('goat_leg', () => new THREE.BoxGeometry(0.08, 0.34, 0.08));
    const legs = [];
    [
      [-0.10, 0.34, -0.22],
      [0.10, 0.34, -0.22],
      [-0.10, 0.34, 0.22],
      [0.10, 0.34, 0.22]
    ].forEach(([lx, ly, lz]) => {
      const lp = new THREE.Group();
      lp.position.set(lx, ly, lz);
      const lm = new THREE.Mesh(legGeo, goatMat);
      lm.position.y = -0.16;
      lp.add(lm);
      bodyPivot.add(lp);
      legs.push(lp);
    });

    group.userData = {
      npcType: 'GOAT_OR_COW',
      isAnimal: true,
      isGoat: true,
      bodyPivot,
      headGroup,
      quadLegs: legs,
      animPhase: Math.random() * Math.PI * 2,
      label: 'Karachi Street Goat (Bakra)'
    };
  }

  return group;
}

/**
 * 14. Karachi Donkey Cart (Gadha Gari):
 * Donkey with long ears + wooden flatbed cart on two spoked wheels + seated driver.
 */
export function createDonkeyCart() {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  addBlobShadow(group, 0.85, 1.85);

  const donkeyMat = getMat(0x78716c);
  const woodMat = getMat(0x78350f);
  const darkMat = getMat(0x1c1917);

  // Donkey at front (z = -0.95)
  const donkeyGroup = new THREE.Group();
  donkeyGroup.position.set(0, 0, -0.95);

  const dBody = new THREE.Mesh(
    getGeo('donkey_body', () => new THREE.BoxGeometry(0.46, 0.46, 0.98)),
    donkeyMat
  );
  dBody.position.set(0, 0.68, 0);
  donkeyGroup.add(dBody);

  const dHead = new THREE.Group();
  dHead.position.set(0, 0.98, -0.52);
  const dHeadMesh = new THREE.Mesh(
    getGeo('donkey_head', () => new THREE.BoxGeometry(0.28, 0.30, 0.38)),
    donkeyMat
  );
  dHead.add(dHeadMesh);

  // Long Donkey Ears
  const earGeo = getGeo('donkey_ear', () => new THREE.BoxGeometry(0.06, 0.26, 0.08));
  const earL = new THREE.Mesh(earGeo, donkeyMat);
  earL.position.set(-0.10, 0.24, 0.05);
  earL.rotation.z = 0.22;
  dHead.add(earL);
  const earR = new THREE.Mesh(earGeo, donkeyMat);
  earR.position.set(0.10, 0.24, 0.05);
  earR.rotation.z = -0.22;
  dHead.add(earR);
  donkeyGroup.add(dHead);

  // 4 Donkey Legs
  const dLegGeo = getGeo('donkey_leg', () => new THREE.BoxGeometry(0.10, 0.48, 0.10));
  const quadLegs = [];
  [
    [-0.14, 0.46, -0.34],
    [0.14, 0.46, -0.34],
    [-0.14, 0.46, 0.34],
    [0.14, 0.46, 0.34]
  ].forEach(([lx, ly, lz]) => {
    const lp = new THREE.Group();
    lp.position.set(lx, ly, lz);
    const lm = new THREE.Mesh(dLegGeo, donkeyMat);
    lm.position.y = -0.22;
    lp.add(lm);
    donkeyGroup.add(lp);
    quadLegs.push(lp);
  });
  bodyPivot.add(donkeyGroup);

  // Wooden Cart Bed & Shafts (z = +0.55)
  const cartBed = new THREE.Mesh(
    getGeo('gadha_bed', () => new THREE.BoxGeometry(1.18, 0.16, 1.45)),
    woodMat
  );
  cartBed.position.set(0, 0.56, 0.55);
  bodyPivot.add(cartBed);

  const wheelGeo = getGeo('gadha_wheel', () => {
    const g = new THREE.CylinderGeometry(0.38, 0.38, 0.10, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const wL = new THREE.Mesh(wheelGeo, darkMat);
  wL.position.set(-0.62, 0.38, 0.55);
  bodyPivot.add(wL);
  const wR = new THREE.Mesh(wheelGeo, darkMat);
  wR.position.set(0.62, 0.38, 0.55);
  bodyPivot.add(wR);

  // Seated Driver on front of wooden cart
  const driver = buildBaseHumanoid({
    scale: 0.82,
    skinHex: pickRandom(NPC_CONFIG.SKIN_TONES),
    topHex: 0xd6d3d1,
    bottomHex: 0xd6d3d1,
    isLongKameez: true,
    hasTurban: true
  });
  driver.position.set(0, 0.42, 0.10);
  bodyPivot.add(driver);

  group.userData = {
    npcType: 'DONKEY_CART',
    isVehicleNPC: true,
    bodyPivot,
    headGroup: dHead,
    quadLegs,
    wheels: [wL, wR],
    animPhase: Math.random() * Math.PI * 2,
    label: 'Karachi Donkey Cart (Gadha Gari)'
  };
  return group;
}

/**
 * 15. Crows or Pigeons Flock (Kabootar & Kawwa):
 * Small cluster of 4 birds with wing pivots that peck on the ground and fly off
 * into the sky when the player approaches or honks!
 */
export function createBirdsFlock() {
  const group = new THREE.Group();
  addBlobShadow(group, 0.65, 0.65);

  const birds = [];
  const birdBodyGeo = getGeo('bird_body', () => new THREE.ConeGeometry(0.08, 0.24, 5));
  const wingGeo = getGeo('bird_wing', () => new THREE.BoxGeometry(0.18, 0.02, 0.10));

  for (let i = 0; i < 4; i++) {
    const isCrow = i % 2 === 0;
    const bMat = getMat(isCrow ? 0x18181b : 0x94a3b8);
    const bGroup = new THREE.Group();
    const angle = (i / 4) * Math.PI * 2;
    bGroup.position.set(Math.cos(angle) * 0.35, 0.08, Math.sin(angle) * 0.35);

    const body = new THREE.Mesh(birdBodyGeo, bMat);
    body.rotation.x = Math.PI / 2;
    bGroup.add(body);

    const leftWing = new THREE.Mesh(wingGeo, bMat);
    leftWing.position.set(-0.09, 0.03, 0);
    bGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, bMat);
    rightWing.position.set(0.09, 0.03, 0);
    bGroup.add(rightWing);

    bGroup.userData = { leftWing, rightWing, offsetAngle: angle };
    group.add(bGroup);
    birds.push(bGroup);
  }

  group.userData = {
    npcType: 'BIRDS_FLOCK',
    isBirdFlock: true,
    birds,
    isFlyingAway: false,
    animPhase: Math.random() * Math.PI * 2,
    label: 'Karachi Crows & Pigeons Flock'
  };
  return group;
}

// ============================================================================
// UNIFIED FACTORY FUNCTION: createNPC(type, options)
// ============================================================================
export function createNPC(type, options = {}) {
  let group;
  switch (type) {
    case 'MAN_SHALWAR_KAMEEZ':
      group = createManShalwarKameez(options);
      break;
    case 'MAN_SHIRT_PANTS':
      group = createManShirtPants(options);
      break;
    case 'WOMAN_DUPATTA':
      group = createWomanDupatta(options);
      break;
    case 'WOMAN_ABAYA':
      group = createWomanAbaya(options);
      break;
    case 'SCHOOL_KID':
      group = createSchoolKid(options);
      break;
    case 'CHAI_WALA':
      group = createChaiWala(options);
      break;
    case 'FRUIT_SELLER':
      group = createFruitSeller(options);
      break;
    case 'TRAFFIC_POLICE':
      group = createTrafficPolice(options);
      break;
    case 'TRAFFIC_RIDER':
      group = createTrafficRider(options);
      break;
    case 'LABORER':
      group = createLaborer(options);
      break;
    case 'STRAY_DOG':
      group = createStrayDog(options);
      break;
    case 'STRAY_CAT':
      group = createStrayCat(options);
      break;
    case 'GOAT_OR_COW':
      group = createGoatOrCow(options);
      break;
    case 'DONKEY_CART':
      group = createDonkeyCart(options);
      break;
    case 'BIRDS_FLOCK':
      group = createBirdsFlock(options);
      break;
    default:
      group = createManShalwarKameez(options);
      break;
  }

  // Apply world-curve vertex shader compatibility so NPCs never float on curved roads
  patchObjectHierarchy(group);
  return group;
}

// ============================================================================
// NPC MANAGER CLASS (Object Pooling, Animations, Horn & Collision Reactions,
// and Interactive 3D Gallery Showroom)
// ============================================================================
export class NPCManager {
  constructor() {
    this.scene = null;
    this.activeNPCs = [];
    this.poolByType = {};
    this.lastSpawnZ = -20;
    this.galleryGroup = null;
    this.isGalleryOpen = false;
    this.galleryFocusIndex = 0;
  }

  init(scene) {
    this.scene = scene;
    this.activeNPCs = [];
    this.poolByType = {};
    NPC_TYPES.forEach((t) => {
      this.poolByType[t] = [];
    });
    // Pre-warm object pool with 1 of each type so mid-game spawns never stutter
    NPC_TYPES.forEach((t) => {
      const npc = createNPC(t);
      npc.visible = false;
      this.scene.add(npc);
      this.poolByType[t].push(npc);
    });
  }

  acquireFromPool(type) {
    const bucket = this.poolByType[type] || (this.poolByType[type] = []);
    let npc = bucket.pop();
    if (!npc) {
      npc = createNPC(type);
      if (this.scene) this.scene.add(npc);
    }
    npc.visible = true;
    npc.rotation.set(0, 0, 0);
    npc.scale.set(1, 1, 1);
    npc.userData.isTumbling = false;
    npc.userData.tumbleTimer = 0;
    npc.userData.isPanicked = false;
    npc.userData.isFlyingAway = false;
    npc.userData.crossState = 'NONE';
    return npc;
  }

  releaseToPool(npc) {
    npc.visible = false;
    const type = npc.userData.npcType || 'MAN_SHALWAR_KAMEEZ';
    if (!this.poolByType[type]) this.poolByType[type] = [];
    this.poolByType[type].push(npc);
  }

  /**
   * Spawns authentic Karachi street life ahead at zPosition based on time of day & distance.
   */
  spawnAhead(zPosition, options = {}) {
    if (!this.scene || this.isGalleryOpen) return;
    if (this.activeNPCs.length >= NPC_CONFIG.MAX_ACTIVE_NPCS) return;

    const timeOfDay = options.timeOfDay || 'Day';
    const isNight = timeOfDay === 'Night';
    const isEvening = timeOfDay === 'Sunset' || timeOfDay === 'Dusk';

    // Select weighted NPC mix based on time of day
    const roll = Math.random();
    let type = 'MAN_SHALWAR_KAMEEZ';

    if (roll < 0.16) type = 'MAN_SHALWAR_KAMEEZ';
    else if (roll < 0.28) type = 'MAN_SHIRT_PANTS';
    else if (roll < 0.40) type = 'WOMAN_DUPATTA';
    else if (roll < 0.48) type = 'WOMAN_ABAYA';
    else if (roll < (isNight ? 0.50 : 0.60)) type = 'SCHOOL_KID';
    else if (roll < (isEvening ? 0.72 : 0.66)) type = 'CHAI_WALA';
    else if (roll < 0.73) type = 'FRUIT_SELLER';
    else if (roll < 0.78) type = 'TRAFFIC_POLICE';
    else if (roll < 0.83) type = 'LABORER';
    else if (roll < 0.88) type = 'STRAY_DOG';
    else if (roll < 0.92) type = 'STRAY_CAT';
    else if (roll < 0.95) type = 'GOAT_OR_COW';
    else if (roll < 0.98) type = 'DONKEY_CART';
    else type = 'BIRDS_FLOCK';

    const side = Math.random() < 0.5 ? -1 : 1;
    const npc = this.acquireFromPool(type);

    if (type === 'CHAI_WALA' || type === 'FRUIT_SELLER') {
      npc.position.set(side * NPC_CONFIG.ROADSIDE_RIGHT_X, 0, zPosition);
      npc.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      npc.userData.velZ = 0;
      npc.userData.velX = 0;
    } else if (type === 'TRAFFIC_POLICE') {
      npc.position.set(side * NPC_CONFIG.CURB_RIGHT_X, 0, zPosition);
      npc.rotation.y = 0;
      npc.userData.velZ = 0;
      npc.userData.velX = 0;
    } else if (type === 'DONKEY_CART') {
      // Drives slowly along outer lane or roadside shoulder
      npc.position.set(side * 3.5, 0, zPosition);
      npc.rotation.y = 0;
      npc.userData.velZ = -NPC_CONFIG.DONKEY_CART_SPEED;
      npc.userData.velX = 0;
    } else if (type === 'GOAT_OR_COW' && npc.userData.isCow) {
      // Cow stands in outer/middle road and ambles slowly
      npc.position.set(side * 3.2, 0, zPosition);
      npc.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      npc.userData.velZ = 0;
      npc.userData.velX = -side * NPC_CONFIG.COW_AMBLE_SPEED;
    } else if (type === 'BIRDS_FLOCK') {
      npc.position.set(side * 2.5, 0, zPosition);
      npc.userData.velZ = 0;
      npc.userData.velX = 0;
      npc.userData.birds?.forEach((b) => {
        b.position.y = 0.08;
      });
    } else {
      // Sidewalk walker or curb-looker about to cross road
      const walkDir = Math.random() < 0.5 ? 1 : -1;
      const speed =
        NPC_CONFIG.WALK_SPEED_MIN +
        Math.random() * (NPC_CONFIG.WALK_SPEED_MAX - NPC_CONFIG.WALK_SPEED_MIN);
      const willCrossRoad = Math.random() < 0.24;

      npc.position.set(
        side * (willCrossRoad ? NPC_CONFIG.CURB_RIGHT_X : NPC_CONFIG.SIDEWALK_RIGHT_X),
        0,
        zPosition
      );
      npc.rotation.y = walkDir > 0 ? Math.PI : 0;
      npc.userData.velZ = walkDir * speed;
      npc.userData.velX = 0;
      npc.userData.side = side;
      if (willCrossRoad) {
        npc.userData.crossState = 'WAIT_AT_CURB';
        npc.userData.curbWaitTimer = 0.65;
      }

      // Occasionally spawn a companion walking alongside (family, friends, or school kids group)
      if (
        !willCrossRoad &&
        this.activeNPCs.length + 1 < NPC_CONFIG.MAX_ACTIVE_NPCS &&
        Math.random() < 0.32
      ) {
        const buddyType =
          type === 'SCHOOL_KID'
            ? 'SCHOOL_KID'
            : type === 'WOMAN_DUPATTA'
            ? 'SCHOOL_KID'
            : type;
        const buddy = this.acquireFromPool(buddyType);
        buddy.position.set(npc.position.x + side * 0.65, 0, zPosition - 0.7);
        buddy.rotation.y = npc.rotation.y;
        buddy.userData.velZ = npc.userData.velZ;
        buddy.userData.velX = 0;
        buddy.userData.side = side;
        this.activeNPCs.push(buddy);
      }
    }

    this.activeNPCs.push(npc);
  }

  /**
   * Triggered when the player honks the Rickshaw Horn [H]:
   * - Pedestrians jump back & bolt toward the sidewalk
   * - Animals bolt off the road
   * - Birds take off into the sky
   */
  onHorn(playerPosition) {
    let reactedCount = 0;
    for (let i = 0; i < this.activeNPCs.length; i++) {
      const npc = this.activeNPCs[i];
      const dz = Math.abs(npc.position.z - playerPosition.z);
      if (dz > NPC_CONFIG.HORN_REACTION_RADIUS) continue;

      if (npc.userData.isBirdFlock && !npc.userData.isFlyingAway) {
        npc.userData.isFlyingAway = true;
        reactedCount++;
      } else if (!npc.userData.isStationaryVendor && !npc.userData.isTumbling) {
        npc.userData.isPanicked = true;
        const retreatSign = npc.position.x >= 0 ? 1 : -1;
        npc.userData.velX = retreatSign * NPC_CONFIG.RUN_SPEED;
        npc.userData.velZ = 0;
        npc.rotation.y = retreatSign > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (npc.userData.bodyPivot) {
          npc.userData.bodyPivot.position.y = 0.28; // Startle jump!
        }
        reactedCount++;
      }
    }
    return reactedCount;
  }

  /**
   * Checks if playerBox (or player position) hits any NPC on the road.
   * Triggers a non-gore cartoon sideways tumble and returns the hit NPC info.
   */
  checkCollision(playerPosOrBox) {
    const px = playerPosOrBox.x ?? 0;
    const py = playerPosOrBox.y ?? 0;
    const pz = playerPosOrBox.z ?? 0;

    if (py > 1.35) return null; // Jumped cleanly over NPC

    for (let i = 0; i < this.activeNPCs.length; i++) {
      const npc = this.activeNPCs[i];
      if (
        !npc.visible ||
        npc.userData.isTumbling ||
        npc.userData.isBirdFlock ||
        npc.userData.isStationaryVendor
      ) {
        continue;
      }
      const dz = Math.abs(npc.position.z - pz);
      const dx = Math.abs(npc.position.x - px);
      const hitRadiusX = npc.userData.npcType === 'DONKEY_CART' ? 0.95 : 0.72;
      const hitRadiusZ = npc.userData.npcType === 'DONKEY_CART' ? 1.35 : 0.75;

      if (dx < hitRadiusX && dz < hitRadiusZ) {
        npc.userData.isTumbling = true;
        npc.userData.tumbleTimer = 1.1;
        const pushDir = npc.position.x >= px ? 1 : -1;
        npc.userData.velX = pushDir * 6.5;
        npc.userData.velZ = -4.0;
        return {
          npc,
          type: npc.userData.npcType,
          label: npc.userData.label,
          penalty: NPC_CONFIG.COLLISION_PENALTY_RUPEES
        };
      }
    }
    return null;
  }

  /**
   * Updates all active NPCs (limb swing, vendor waving, bird flight, curb look-and-cross,
   * proximity dodge, and despawn/respawn pooling).
   */
  update(dt, playerState) {
    if (!this.scene) return;

    // If NPC Gallery Showroom is active, slowly rotate every showcase pedestal
    if (this.isGalleryOpen && this.galleryGroup) {
      this.galleryGroup.children.forEach((item) => {
        if (item.userData.isGalleryActor) {
          item.rotation.y += dt * 0.85;
          this.animateNPCLimbs(item, dt, 1.8, false);
        }
      });
      return;
    }

    const pz = playerState?.z ?? 0;
    const px = playerState?.x ?? 0;

    // Auto-spawn ahead of player as they drive forward (-Z)
    while (this.lastSpawnZ > pz - 165) {
      this.lastSpawnZ -= NPC_CONFIG.SPAWN_INTERVAL_Z;
      if (Math.random() < 0.78) {
        this.spawnAhead(this.lastSpawnZ, {
          timeOfDay: playerState?.timeOfDay || 'Day'
        });
      }
    }

    for (let i = this.activeNPCs.length - 1; i >= 0; i--) {
      const npc = this.activeNPCs[i];

      // Despawn behind camera & recycle into object pool
      if (npc.position.z > pz + NPC_CONFIG.DESPAWN_BEHIND_DIST) {
        this.releaseToPool(npc);
        this.activeNPCs.splice(i, 1);
        continue;
      }

      // 1. Handle Tumble Animation after a "Careful!" bump
      if (npc.userData.isTumbling) {
        npc.userData.tumbleTimer -= dt;
        npc.position.x += (npc.userData.velX || 4) * dt;
        npc.position.z += (npc.userData.velZ || -3) * dt;
        npc.rotation.z += dt * 7.5;
        npc.rotation.x += dt * 4.0;
        const scaleFade = Math.max(0.05, npc.userData.tumbleTimer / 1.1);
        npc.scale.setScalar(scaleFade);
        if (npc.userData.tumbleTimer <= 0) {
          this.releaseToPool(npc);
          this.activeNPCs.splice(i, 1);
        }
        continue;
      }

      // 2. Birds Flock Takeoff when player is close
      if (npc.userData.isBirdFlock) {
        const distToPlayer = Math.hypot(npc.position.x - px, npc.position.z - pz);
        if (distToPlayer < NPC_CONFIG.BIRD_TAKEOFF_RADIUS) {
          npc.userData.isFlyingAway = true;
        }
        if (npc.userData.isFlyingAway) {
          npc.userData.animPhase += dt * 22;
          npc.position.y += NPC_CONFIG.BIRD_FLY_SPEED * dt * 0.75;
          npc.position.z -= NPC_CONFIG.BIRD_FLY_SPEED * dt * 0.5;
          npc.userData.birds?.forEach((b, idx) => {
            const flap = Math.sin(npc.userData.animPhase + idx) * 0.75;
            b.userData.leftWing.rotation.z = flap;
            b.userData.rightWing.rotation.z = -flap;
          });
        } else {
          // Gentle ground pecking
          npc.userData.animPhase += dt * 6;
          npc.userData.birds?.forEach((b, idx) => {
            b.rotation.x = Math.max(0, Math.sin(npc.userData.animPhase + idx * 1.7) * 0.35);
          });
        }
        continue;
      }

      // 3. Curb Look-then-Cross Behavior
      const dzToPlayer = npc.position.z - pz;
      if (npc.userData.crossState === 'WAIT_AT_CURB' && dzToPlayer > -38 && dzToPlayer < -14) {
        npc.userData.curbWaitTimer -= dt;
        if (npc.userData.headGroup) {
          // Look left and right before crossing!
          npc.userData.headGroup.rotation.y = Math.sin(npc.userData.curbWaitTimer * 10) * 0.55;
        }
        if (npc.userData.curbWaitTimer <= 0) {
          npc.userData.crossState = 'CROSSING';
          const crossDir = npc.position.x > 0 ? -1 : 1;
          npc.userData.velX = crossDir * NPC_CONFIG.CROSS_ROAD_SPEED;
          npc.userData.velZ = 0;
          npc.rotation.y = crossDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }

      // 4. Proximity Dodge when player rickshaw comes within 3.2m
      const distToPlayer = Math.hypot(npc.position.x - px, npc.position.z - pz);
      if (
        !npc.userData.isStationaryVendor &&
        !npc.userData.isVehicleNPC &&
        distToPlayer < NPC_CONFIG.DODGE_RADIUS &&
        Math.abs(npc.position.x) < 4.5
      ) {
        npc.userData.isPanicked = true;
        const dodgeDir = npc.position.x >= px ? 1 : -1;
        npc.userData.velX = dodgeDir * NPC_CONFIG.RUN_SPEED;
        npc.rotation.y = dodgeDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      // Stop crossing once safely on opposite sidewalk
      if (
        (npc.userData.crossState === 'CROSSING' || npc.userData.isPanicked) &&
        Math.abs(npc.position.x) > NPC_CONFIG.SIDEWALK_RIGHT_X
      ) {
        npc.userData.velX = 0;
        npc.userData.isPanicked = false;
        npc.userData.crossState = 'NONE';
        npc.userData.velZ = NPC_CONFIG.WALK_SPEED_MIN;
        npc.rotation.y = Math.PI;
      }

      // Apply velocity
      npc.position.x += (npc.userData.velX || 0) * dt;
      npc.position.z += (npc.userData.velZ || 0) * dt;

      // Decay startle jump height back to ground
      if (npc.userData.bodyPivot && npc.userData.bodyPivot.position.y > 0.08) {
        npc.userData.bodyPivot.position.y = Math.max(
          0,
          npc.userData.bodyPivot.position.y - dt * 1.8
        );
      }

      const moveSpeed = Math.hypot(npc.userData.velX || 0, npc.userData.velZ || 0);
      const isNearKid =
        npc.userData.isSchoolKid && Math.abs(dzToPlayer) < NPC_CONFIG.KID_WAVE_RADIUS;

      this.animateNPCLimbs(npc, dt, moveSpeed, isNearKid);
    }
  }

  /**
   * Procedural pivot-group animation (Walk, Run, Idle breathing, Vendor wave,
   * School Kid wave, Dog tail wag, Cow chew, Goat hop, Wheel spin).
   */
  animateNPCLimbs(npc, dt, moveSpeed, waveAtPlayer = false) {
    const ud = npc.userData;
    const freq = ud.isPanicked ? 14 : moveSpeed > 0.2 ? 8.5 : 2.6;
    ud.animPhase = (ud.animPhase || 0) + dt * freq;
    const phase = ud.animPhase;

    // Spin wheels on Bike / Mini-Rickshaw / Donkey Cart
    if (ud.wheels) {
      ud.wheels.forEach((w) => {
        w.rotation.x -= dt * 6.5;
      });
    }

    // 4-legged animals (Stray Dog, Cow, Goat, Donkey)
    if (ud.quadLegs) {
      const swing = moveSpeed > 0.1 ? Math.sin(phase) * 0.42 : 0;
      ud.quadLegs[0].rotation.x = swing;
      ud.quadLegs[1].rotation.x = -swing;
      ud.quadLegs[2].rotation.x = -swing;
      ud.quadLegs[3].rotation.x = swing;

      if (ud.tailPivot) {
        ud.tailPivot.rotation.z = Math.sin(phase * 2.5) * 0.45;
      }
      if (ud.isCow && ud.headGroup) {
        ud.headGroup.rotation.z = Math.sin(phase * 1.4) * 0.08;
        ud.headGroup.rotation.x = Math.sin(phase * 0.9) * 0.06;
      }
      if (ud.isGoat && ud.bodyPivot && moveSpeed > 0.1) {
        ud.bodyPivot.position.y = Math.abs(Math.sin(phase)) * 0.14;
      }
      return;
    }

    // Stray Cat tail sway
    if (ud.npcType === 'STRAY_CAT' && ud.tailPivot) {
      ud.tailPivot.rotation.z = Math.sin(phase * 2.0) * 0.35;
      return;
    }

    // Humanoid Walk / Run / Idle / Vendor Wave / Kid Wave
    if (ud.leftLeg && ud.rightLeg) {
      if (moveSpeed > 0.15) {
        const amp = ud.isPanicked ? 0.68 : 0.44;
        const swing = Math.sin(phase) * amp;
        ud.leftLeg.rotation.x = swing;
        ud.rightLeg.rotation.x = -swing;

        if (!ud.isLaborer) {
          ud.leftArm.rotation.x = -swing * 0.85;
          if (!waveAtPlayer && ud.npcType !== 'TRAFFIC_POLICE') {
            ud.rightArm.rotation.x = swing * 0.85;
          }
        }
        if (ud.bodyPivot) {
          ud.bodyPivot.position.y = Math.abs(Math.sin(phase * 2)) * 0.045;
          ud.bodyPivot.rotation.x = ud.isPanicked ? 0.18 : 0.04;
        }
      } else {
        // Idle breathing & subtle head turn
        ud.leftLeg.rotation.x = 0;
        ud.rightLeg.rotation.x = 0;
        if (ud.headGroup) {
          ud.headGroup.rotation.y = Math.sin(phase * 0.65) * 0.22;
        }
        if (ud.isStationaryVendor && ud.rightArm) {
          // Vendors wave / fan their cart
          ud.rightArm.rotation.z = -2.2 + Math.sin(phase * 2.4) * 0.35;
        }
      }

      // School kids wave happily as the player passes!
      if (waveAtPlayer && ud.rightArm) {
        ud.rightArm.rotation.x = 0;
        ud.rightArm.rotation.z = -2.5 + Math.sin(phase * 3.5) * 0.42;
      }
    }
  }

  /**
   * Debug Showroom Function: showNPCGallery()
   * Lines up all 15 Karachi NPC types on a flat sandstone stage, slowly rotating,
   * so you can inspect every single character & animal model (Key G toggles).
   */
  showNPCGallery(forceState) {
    if (!this.scene) return false;
    this.isGalleryOpen =
      typeof forceState === 'boolean' ? forceState : !this.isGalleryOpen;

    if (!this.isGalleryOpen) {
      if (this.galleryGroup) {
        this.scene.remove(this.galleryGroup);
        this.galleryGroup = null;
      }
      this.activeNPCs.forEach((n) => {
        n.visible = true;
      });
      return false;
    }

    // Hide active road NPCs while viewing the gallery
    this.activeNPCs.forEach((n) => {
      n.visible = false;
    });

    if (this.galleryGroup) {
      this.scene.remove(this.galleryGroup);
    }

    const gallery = new THREE.Group();
    gallery.name = 'Karachi_NPC_Gallery';

    // Flat Karachi Sandstone Stage Platform
    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(46, 0.25, 16),
      new THREE.MeshStandardMaterial({
        color: 0xd6c7b2,
        roughness: 0.9,
        flatShading: true
      })
    );
    stage.position.set(0, -0.125, 0);
    gallery.add(stage);

    // Arrange all 15 NPC types in a neat 2-row exhibition (Row 1: 8 NPCs, Row 2: 7 NPCs)
    NPC_TYPES.forEach((type, idx) => {
      const row = idx < 8 ? 0 : 1;
      const col = idx < 8 ? idx : idx - 8;
      const countInRow = row === 0 ? 8 : 7;
      const spacingX = 2.6;
      const xPos = (col - (countInRow - 1) / 2) * spacingX;
      const zPos = row === 0 ? -1.8 : 2.2;

      // Pedestal disc
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.05, 0.08, 12),
        new THREE.MeshStandardMaterial({
          color: row === 0 ? 0x0f766e : 0xb45309,
          flatShading: true
        })
      );
      ped.position.set(xPos, 0.04, zPos);
      gallery.add(ped);

      const actor = createNPC(type);
      actor.position.set(xPos, 0.08, zPos);
      actor.userData.isGalleryActor = true;
      actor.userData.galleryIndex = idx;
      gallery.add(actor);
    });

    this.galleryGroup = gallery;
    this.scene.add(gallery);
    return true;
  }

  getGalleryMetadata() {
    return NPC_TYPES.map((type, idx) => {
      const sample = this.poolByType[type]?.[0];
      return {
        index: idx + 1,
        type,
        label: sample?.userData?.label || type.replace(/_/g, ' ')
      };
    });
  }

  dispose() {
    if (this.galleryGroup && this.scene) {
      this.scene.remove(this.galleryGroup);
      this.galleryGroup = null;
    }
    this.activeNPCs.forEach((npc) => {
      if (this.scene) this.scene.remove(npc);
    });
    this.activeNPCs = [];
  }
}
