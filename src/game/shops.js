import * as THREE from 'three';
import { patchObjectHierarchy } from './curve';

/**
 * ============================================================================
 * PAKISTANI BAZAAR & STREET SHOP BUILDINGS MODULE (shops.js)
 * ============================================================================
 * Procedural low-poly flat-shaded 1-to-3 story Pakistani bazaar shop buildings
 * with recessed 3D interiors, rolling steel shutters, hand-painted Urdu/English
 * CanvasTexture signboards, 12 distinct shop types, upper-floor jharokas/ACs/ads,
 * street-level clutter, day/night emissive lighting, and object pooling.
 */

export const SHOP_CONFIG = {
  CHUNK_SPAN_Z: 48,
  MIN_SHOP_WIDTH: 3.8,
  MAX_SHOP_WIDTH: 6.4,
  BASE_DEPTH: 5.2,
  GROUND_FLOOR_HEIGHT: 3.6,
  UPPER_FLOOR_HEIGHT: 3.0,
  MAX_FLOORS: 3,

  WALL_PALETTE: [
    0xf5ead6, // Weathered Sandstone Cream
    0xeab64d, // Lahore Mustard
    0xe8a598, // Faded Terracotta Pink
    0x7dd3c0, // Clifton Turquoise
    0xa7dca2, // Pistachio Light Green
    0xc86d58  // Old Saddar Brick Red
  ],

  TRIM_PALETTE: [
    0x1e293b,
    0x78350f,
    0x0f766e,
    0x991b1b,
    0x1e3a8a,
    0x3f6212
  ],

  AWNING_PAIRS: [
    ['#dc2626', '#f8fafc'], // Red / White
    ['#16a34a', '#f8fafc'], // Green / White
    ['#2563eb', '#facc15'], // Blue / Yellow
    ['#d97706', '#fef3c7'], // Amber / Cream
    ['#0d9488', '#f8fafc']  // Teal / White
  ],

  SHOP_TYPES: [
    'MOBILE_SHOP',
    'HOTEL_DHABA',
    'BAKERY_SWEET',
    'FRUIT_VEG',
    'MEDICAL_STORE',
    'CLOTH_SHOP',
    'TAILOR_SHOP',
    'TYRE_MECHANIC',
    'GENERAL_STORE',
    'JUICE_CORNER',
    'BARBER_SHOP',
    'FURNITURE_HARDWARE'
  ],

  SHOP_CATALOG: {
    MOBILE_SHOP: {
      names: [
        { en: 'AL-FALAH MOBILE SHOP', ur: 'الفلاح موبائل شاپ', phone: '0300-4128890' },
        { en: 'RAFIQUE ELECTRONICS', ur: 'رفیق الیکٹرانکس', phone: '0321-7745120' }
      ],
      borderHex: '#0284c7',
      bgHex: '#0f172a',
      neonHex: 0x38bdf8,
      icon: '📱'
    },
    HOTEL_DHABA: {
      names: [
        { en: 'BISMILLAH QUETTA HOTEL', ur: 'بسم اللہ کوئٹہ ہوٹل', phone: '0312-9981122' },
        { en: 'AL-MAKKAH CHAI & TANDOOR', ur: 'المکہ چائے اینڈ تندور', phone: '0345-6612098' }
      ],
      borderHex: '#dc2626',
      bgHex: '#450a0a',
      neonHex: 0xfacc15,
      icon: '☕'
    },
    BAKERY_SWEET: {
      names: [
        { en: 'LAHORE SHAHI BAKERY', ur: 'لاہور شاہی بیکری اینڈ مٹھائی', phone: '0301-5543210' },
        { en: 'SADDAR SWEETS & NIMKO', ur: 'صدر سویٹس اینڈ نمکو', phone: '0333-2298741' }
      ],
      borderHex: '#f59e0b',
      bgHex: '#78350f',
      neonHex: 0xfde047,
      icon: '🍰'
    },
    FRUIT_VEG: {
      names: [
        { en: 'CHAUDHRY FRUIT CHAAT', ur: 'چوہدری فروٹ چاٹ اینڈ سبزی', phone: '0302-8834119' },
        { en: 'SWAT FRESH FRUIT HOUSE', ur: 'سوات فریش فروٹ ہاؤس', phone: '0315-4432901' }
      ],
      borderHex: '#16a34a',
      bgHex: '#064e3b',
      neonHex: 0x4ade80,
      icon: '🥭'
    },
    MEDICAL_STORE: {
      names: [
        { en: 'MADINA MEDICAL STORE', ur: 'مدینہ میڈیکل سٹور', phone: '0300-2190844' },
        { en: 'SHIFA DAWAKHANA 24/7', ur: 'شفا دواخانہ اینڈ فارمیسی', phone: '0322-6671234' }
      ],
      borderHex: '#10b981',
      bgHex: '#ecfdf5',
      textHex: '#065f46',
      neonHex: 0x10b981,
      icon: '➕'
    },
    CLOTH_SHOP: {
      names: [
        { en: 'HAJI CLOTH & DUPATTA HOUSE', ur: 'حاجی کلاتھ اینڈ دوپٹہ ہاؤس', phone: '0334-9901230' },
        { en: 'BANARSI SILK EMPORIUM', ur: 'بنارسی سلک ایمپوریم', phone: '0300-8123456' }
      ],
      borderHex: '#ec4899',
      bgHex: '#500724',
      neonHex: 0xf472b6,
      icon: '👗'
    },
    TAILOR_SHOP: {
      names: [
        { en: 'GULZAR MASTER TAILORS', ur: 'گلزار ماسٹر ٹیلرز', phone: '0311-3344556' },
        { en: 'ROYAL GENTS SUITING', ur: 'رائل جینٹس سوٹنگ', phone: '0346-7788990' }
      ],
      borderHex: '#eab308',
      bgHex: '#1e1b4b',
      neonHex: 0xa855f7,
      icon: '✂️'
    },
    TYRE_MECHANIC: {
      names: [
        { en: 'USTAD TYRE & VULCANIZER', ur: 'استاد ٹائر اینڈ پنکچر شاپ', phone: '0306-1122334' },
        { en: 'KHYBER AUTO MECHANIC', ur: 'خیبر آٹو مکینک ورکشاپ', phone: '0323-9900112' }
      ],
      borderHex: '#f97316',
      bgHex: '#18181b',
      neonHex: 0xf97316,
      icon: '🛞'
    },
    GENERAL_STORE: {
      names: [
        { en: 'SHAN GENERAL & KIRYANA', ur: 'شان جنرل اینڈ کریانہ سٹور', phone: '0300-7654321' },
        { en: 'BARAKAT SUPER STORE', ur: 'برکت سپر سٹور', phone: '0331-5432198' }
      ],
      borderHex: '#3b82f6',
      bgHex: '#172554',
      neonHex: 0x60a5fa,
      icon: '🛒'
    },
    JUICE_CORNER: {
      names: [
        { en: 'SUPER COOL JUICE CORNER', ur: 'سپر کول گنے کا رس اینڈ جوس', phone: '0313-4455667' },
        { en: 'KARACHI GANNA & FALooda', ur: 'کراچی گنا رس اینڈ فالودہ', phone: '0304-8899001' }
      ],
      borderHex: '#84cc16',
      bgHex: '#14532d',
      neonHex: 0xa3e635,
      icon: '🥤'
    },
    BARBER_SHOP: {
      names: [
        { en: 'PRINCE HAIR DRESSER', ur: 'پرنس ہیئر ڈریسر اینڈ سیلون', phone: '0308-2233445' },
        { en: 'VIP KASHMIR HAIR SALON', ur: 'وی آئی پی کشمیر سیلون', phone: '0324-5566778' }
      ],
      borderHex: '#ef4444',
      bgHex: '#1e293b',
      neonHex: 0xf43f5e,
      icon: '💈'
    },
    FURNITURE_HARDWARE: {
      names: [
        { en: 'CHINIOT WOOD & HARDWARE', ur: 'چنیوٹ فرنیچر اینڈ ہارڈویئر', phone: '0300-6677889' },
        { en: 'SADDAR TIMBER & PAINTS', ur: 'صدر ٹمبر اینڈ پینٹس سٹور', phone: '0332-1199887' }
      ],
      borderHex: '#d97706',
      bgHex: '#292524',
      neonHex: 0xfbbf24,
      icon: '🪑'
    }
  },

  WALL_ADS: [
    { title: 'PAK COLA', sub: 'Thanda Thaar Refreshment!', bg: '#1d4ed8', accent: '#facc15' },
    { title: 'STAR ACADEMY', sub: 'Matric & FSC Admissions Open', bg: '#7c2d12', accent: '#fde047' },
    { title: 'CHAMAK SOAP', sub: '100% Pure कपड़े دھونے کا صابن', bg: '#065f46', accent: '#ffffff' },
    { title: 'SHAHI BASMATI', sub: 'Khushbu Daar Super Kernel', bg: '#831843', accent: '#fbcfe8' }
  ]
};

// ============================================================================
// SEEDED RANDOM GENERATOR (Repeatable natural bazaar layout)
// ============================================================================
export function createSeededRNG(seed = 101) {
  let s = (seed >>> 0) || 1;
  return function nextRand() {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// SHARED GEOMETRY, TEXTURE & MATERIAL CACHES
// ============================================================================
const GEO_CACHE = {};
const MAT_CACHE = {};
const SIGN_TEX_CACHE = {};
const AWNING_TEX_CACHE = {};
const AD_TEX_CACHE = {};
let SHUTTER_TEX = null;
let WALL_DIRT_TEX = null;

// Track all night-reactive materials & animated parts across active shops
const NIGHT_MATERIALS = new Set();
const ANIMATED_SHOPS = new Set();
let GLOBAL_IS_NIGHT = false;

function getGeo(key, factory) {
  if (!GEO_CACHE[key]) {
    GEO_CACHE[key] = factory();
  }
  return GEO_CACHE[key];
}

function getMat(colorHex, extra = {}) {
  const key = `lambert_${colorHex}_${extra.emissive || 0}_${extra.opacity || 1}`;
  if (!MAT_CACHE[key]) {
    MAT_CACHE[key] = new THREE.MeshLambertMaterial({
      color: colorHex,
      emissive: extra.emissive ?? 0x000000,
      emissiveIntensity: extra.emissiveIntensity ?? 0,
      transparent: Boolean(extra.transparent),
      opacity: extra.opacity ?? 1.0,
      depthWrite: extra.depthWrite ?? true,
      flatShading: true
    });
  }
  return MAT_CACHE[key];
}

function getCachedCustomMat(key, factory) {
  if (!MAT_CACHE[key]) {
    MAT_CACHE[key] = factory();
  }
  return MAT_CACHE[key];
}

function freezeStaticShopMeshes(group, animRefs = {}) {
  const animatedSet = new Set(Object.values(animRefs).filter((v) => v && typeof v === 'object'));
  group.traverse((child) => {
    if (child === group || animatedSet.has(child) || animatedSet.has(child.parent)) return;
    child.updateMatrix();
    child.matrixAutoUpdate = false;
  });
}

function createBlobShadow(w = 0.8, d = 0.8) {
  const geo = getGeo('shop_blob_shadow', () => {
    const g = new THREE.CircleGeometry(0.5, 10);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const mat = getMat(0x020617, { transparent: true, opacity: 0.34, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(w, 1, d);
  m.position.y = 0.015;
  return m;
}

/**
 * Ribbed grey rolling steel shutter CanvasTexture.
 */
function getShutterTexture() {
  if (SHUTTER_TEX) return SHUTTER_TEX;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 8) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, y, 64, 3);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, y + 3, 64, 1);
  }
  SHUTTER_TEX = new THREE.CanvasTexture(c);
  return SHUTTER_TEX;
}

/**
 * Subtle vertical dirt & rain-stain gradient texture for building walls.
 */
function getWallWeatheringTexture() {
  if (WALL_DIRT_TEX) return WALL_DIRT_TEX;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#d6d3d1'); // Top rain stain
  grad.addColorStop(0.18, '#ffffff');
  grad.addColorStop(0.78, '#f5f5f4');
  grad.addColorStop(1.0, '#a8a29e'); // Bottom street dust gradient
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);
  // Subtle vertical rain streaks
  ctx.fillStyle = 'rgba(68, 64, 60, 0.09)';
  for (let x = 4; x < 64; x += 11) {
    ctx.fillRect(x, 0, 2, 42);
  }
  WALL_DIRT_TEX = new THREE.CanvasTexture(c);
  return WALL_DIRT_TEX;
}

/**
 * Hand-painted Pakistani shop fascia signboard CanvasTexture with English title,
 * Urdu script, colored border, category icon, and phone number line.
 */
function getSignboardTexture(shopType, variantIdx = 0) {
  const cat = SHOP_CONFIG.SHOP_CATALOG[shopType] || SHOP_CONFIG.SHOP_CATALOG.GENERAL_STORE;
  const idx = Math.abs(variantIdx) % cat.names.length;
  const key = `${shopType}_${idx}`;
  if (SIGN_TEX_CACHE[key]) return SIGN_TEX_CACHE[key];

  const info = cat.names[idx];
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');

  // Background & double hand-painted border
  ctx.fillStyle = cat.bgHex;
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = cat.borderHex;
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, 500, 116);

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 100);

  // Left logo badge
  ctx.fillStyle = cat.borderHex;
  ctx.beginPath();
  ctx.arc(54, 64, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(cat.icon, 54, 66);

  // English Shop Title + Urdu Title + Phone Line
  ctx.fillStyle = cat.textHex || '#ffffff';
  ctx.font = '900 25px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(info.en, 275, 38);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(info.ur, 275, 74);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`PROP: HAJI SAHIB  •  PH: ${info.phone}`, 275, 104);

  const tex = new THREE.CanvasTexture(c);
  SIGN_TEX_CACHE[key] = tex;
  return tex;
}

/**
 * Striped fabric awning CanvasTexture.
 */
function getAwningTexture(pairIdx = 0) {
  const idx = Math.abs(pairIdx) % SHOP_CONFIG.AWNING_PAIRS.length;
  if (AWNING_TEX_CACHE[idx]) return AWNING_TEX_CACHE[idx];
  const [c1, c2] = SHOP_CONFIG.AWNING_PAIRS[idx];

  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d');
  for (let x = 0; x < 128; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? c1 : c2;
    ctx.fillRect(x, 0, 16, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  AWNING_TEX_CACHE[idx] = tex;
  return tex;
}

/**
 * Painted upper-wall advertisement board CanvasTexture (invented Pakistani brands).
 */
function getWallAdTexture(adIdx = 0) {
  const idx = Math.abs(adIdx) % SHOP_CONFIG.WALL_ADS.length;
  if (AD_TEX_CACHE[idx]) return AD_TEX_CACHE[idx];
  const ad = SHOP_CONFIG.WALL_ADS[idx];

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = ad.bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = ad.accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 244, 116);

  ctx.fillStyle = ad.accent;
  ctx.font = '900 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ad.title, 128, 54);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(ad.sub, 128, 92);

  const tex = new THREE.CanvasTexture(c);
  AD_TEX_CACHE[idx] = tex;
  return tex;
}

// ============================================================================
// STAGE 3: 12 SHOP TYPE INTERIOR & FOREGROUND PROPS BUILDERS
// ============================================================================
function populateShopTypeProps(type, group, width, isOpen, animRefs) {
  const woodMat = getMat(0x78350f);
  const darkMat = getMat(0x1e293b);
  const metalMat = getMat(0x94a3b8, { metalness: 0.5, roughness: 0.4 });
  const glassMat = getMat(0xbae6fd, { transparent: true, opacity: 0.52 });

  switch (type) {
    case 'MOBILE_SHOP': {
      // Glass display counter + stacked phone boxes + hanging cables + glowing Easyload sign
      const counter = new THREE.Mesh(
        getGeo('mob_counter', () => new THREE.BoxGeometry(1.8, 0.85, 0.55)),
        glassMat
      );
      counter.position.set(-0.3, 0.62, -0.35);
      group.add(counter);

      const boxGeo = getGeo('mob_box', () => new THREE.BoxGeometry(0.28, 0.22, 0.22));
      [0xef4444, 0x3b82f6, 0x10b981, 0xfacc15].forEach((cHex, i) => {
        const b = new THREE.Mesh(boxGeo, getMat(cHex));
        b.position.set(-0.7 + i * 0.34, 1.15, -0.35);
        group.add(b);
      });

      const easyLoadMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x22c55e,
        emissiveIntensity: GLOBAL_IS_NIGHT ? 1.3 : 0.55,
        flatShading: true
      });
      NIGHT_MATERIALS.add(easyLoadMat);
      const easySign = new THREE.Mesh(
        getGeo('mob_easysign', () => new THREE.BoxGeometry(0.75, 0.38, 0.08)),
        easyLoadMat
      );
      easySign.position.set(width * 0.28, 1.85, 0.12);
      group.add(easySign);
      break;
    }

    case 'HOTEL_DHABA': {
      // Clay Tandoor oven + steaming deg pots + charpai outside + chef inside
      const tandoor = new THREE.Mesh(
        getGeo('dhaba_tandoor', () => new THREE.CylinderGeometry(0.38, 0.48, 0.88, 8)),
        getMat(0x9a3412)
      );
      tandoor.position.set(-width * 0.24, 0.64, 0.28);
      group.add(tandoor);

      const deg = new THREE.Mesh(
        getGeo('dhaba_deg', () => new THREE.SphereGeometry(0.30, 8, 6)),
        getMat(0xd97706, { metalness: 0.55, roughness: 0.3 })
      );
      deg.position.set(0.25, 0.92, -0.15);
      group.add(deg);

      // Animated rising steam puffs over tandoor & deg
      const steamGroup = new THREE.Group();
      steamGroup.position.set(-width * 0.24, 1.22, 0.28);
      const steamGeo = getGeo('steam_puff', () => new THREE.SphereGeometry(0.11, 5, 5));
      const steamMat = getMat(0xf8fafc, { transparent: true, opacity: 0.45 });
      for (let s = 0; s < 3; s++) {
        const sp = new THREE.Mesh(steamGeo, steamMat);
        sp.position.y = s * 0.22;
        steamGroup.add(sp);
      }
      group.add(steamGroup);
      animRefs.steamGroup = steamGroup;

      // Visible Chef inside
      const chefTorso = new THREE.Mesh(
        getGeo('chef_torso', () => new THREE.BoxGeometry(0.38, 0.58, 0.24)),
        getMat(0xf8fafc)
      );
      chefTorso.position.set(0.25, 1.15, -0.65);
      group.add(chefTorso);
      const chefHead = new THREE.Mesh(
        getGeo('chef_head', () => new THREE.BoxGeometry(0.26, 0.28, 0.26)),
        getMat(0xc68642)
      );
      chefHead.position.set(0.25, 1.58, -0.65);
      group.add(chefHead);
      break;
    }

    case 'BAKERY_SWEET': {
      // Glass mithai counter with jalebi/barfi/laddu boxes + hanging cake trays
      const vitrine = new THREE.Mesh(
        getGeo('bak_vitrine', () => new THREE.BoxGeometry(2.1, 0.92, 0.65)),
        glassMat
      );
      vitrine.position.set(0, 0.66, -0.15);
      group.add(vitrine);

      const trayGeo = getGeo('mithai_tray', () => new THREE.BoxGeometry(0.38, 0.10, 0.38));
      const mithaiColors = [0xf97316, 0xfef08a, 0xfde047, 0xec4899]; // Jalebi, Barfi, Laddu, Gulab Jamun
      mithaiColors.forEach((hex, idx) => {
        const tray = new THREE.Mesh(trayGeo, getMat(hex));
        tray.position.set(-0.68 + idx * 0.45, 0.85, -0.15);
        group.add(tray);
      });
      break;
    }

    case 'FRUIT_VEG': {
      // Stacked wooden crates at front with colored fruit spheres + striped umbrella
      const crateGeo = getGeo('fruit_crate', () => new THREE.BoxGeometry(0.68, 0.42, 0.55));
      const fruitSphereGeo = getGeo('fruit_pile', () => new THREE.SphereGeometry(0.14, 6, 5));
      const fruitCols = [0xf97316, 0xdc2626, 0xfacc15, 0x22c55e];
      for (let i = 0; i < 3; i++) {
        const lx = (i - 1) * 0.78;
        const crate = new THREE.Mesh(crateGeo, woodMat);
        crate.position.set(lx, 0.42, 0.35);
        group.add(crate);

        const mound = new THREE.Mesh(fruitSphereGeo, getMat(fruitCols[i % fruitCols.length]));
        mound.scale.set(2.1, 1.0, 1.6);
        mound.position.set(lx, 0.68, 0.35);
        group.add(mound);
      }
      break;
    }

    case 'MEDICAL_STORE': {
      // Glowing Green Cross sign + white pharmacy counter + medicine box shelves
      const crossMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: GLOBAL_IS_NIGHT ? 1.4 : 0.7,
        flatShading: true
      });
      NIGHT_MATERIALS.add(crossMat);
      const crossV = new THREE.Mesh(
        getGeo('med_cross_v', () => new THREE.BoxGeometry(0.18, 0.58, 0.12)),
        crossMat
      );
      crossV.position.set(-width * 0.38, 2.35, 0.25);
      const crossH = new THREE.Mesh(
        getGeo('med_cross_h', () => new THREE.BoxGeometry(0.58, 0.18, 0.12)),
        crossMat
      );
      crossH.position.set(-width * 0.38, 2.35, 0.25);
      group.add(crossV, crossH);

      const counter = new THREE.Mesh(
        getGeo('med_counter', () => new THREE.BoxGeometry(1.9, 0.85, 0.52)),
        getMat(0xf8fafc)
      );
      counter.position.set(0, 0.62, -0.25);
      group.add(counter);
      break;
    }

    case 'CLOTH_SHOP': {
      // Hanging colorful suits & dupattas outside (waving slightly) + 2 mannequins
      const clothGroup = new THREE.Group();
      clothGroup.position.set(0, 2.55, 0.28);
      const suitGeo = getGeo('hanging_suit', () => new THREE.BoxGeometry(0.42, 0.95, 0.04));
      [0xec4899, 0x06b6d4, 0xfacc15, 0xa855f7].forEach((cHex, idx) => {
        const suit = new THREE.Mesh(suitGeo, getMat(cHex));
        suit.position.set((idx - 1.5) * 0.62, -0.45, 0);
        clothGroup.add(suit);
      });
      group.add(clothGroup);
      animRefs.hangingClothes = clothGroup;

      // Mannequin in Shalwar Kameez
      const manq = new THREE.Mesh(
        getGeo('cloth_manq', () => new THREE.CylinderGeometry(0.16, 0.14, 1.35, 7)),
        getMat(0xe11d48)
      );
      manq.position.set(-width * 0.25, 0.88, 0.18);
      group.add(manq);
      break;
    }

    case 'TAILOR_SHOP': {
      // Stacked fabric rolls + vintage black sewing machine on table
      const table = new THREE.Mesh(
        getGeo('tailor_table', () => new THREE.BoxGeometry(1.4, 0.76, 0.62)),
        woodMat
      );
      table.position.set(-0.2, 0.58, -0.10);
      group.add(table);

      const machine = new THREE.Mesh(
        getGeo('sewing_machine', () => new THREE.BoxGeometry(0.42, 0.32, 0.22)),
        darkMat
      );
      machine.position.set(-0.2, 1.12, -0.10);
      group.add(machine);

      const rollGeo = getGeo('fabric_roll', () => {
        const g = new THREE.CylinderGeometry(0.12, 0.12, 0.65, 8);
        g.rotateZ(Math.PI / 2);
        return g;
      });
      [0x3b82f6, 0xef4444, 0x10b981].forEach((hex, idx) => {
        const roll = new THREE.Mesh(rollGeo, getMat(hex));
        roll.position.set(0.65, 0.55 + idx * 0.25, -0.35);
        group.add(roll);
      });
      break;
    }

    case 'TYRE_MECHANIC': {
      // Stacked black tyres + blue oil drum + red hydraulic jack
      const tyreGeo = getGeo('shop_tyre', () => new THREE.CylinderGeometry(0.36, 0.36, 0.22, 10));
      for (let t = 0; t < 4; t++) {
        const tyre = new THREE.Mesh(tyreGeo, darkMat);
        tyre.position.set(-width * 0.28, 0.31 + t * 0.23, 0.38);
        group.add(tyre);
      }

      const drum = new THREE.Mesh(
        getGeo('oil_drum', () => new THREE.CylinderGeometry(0.28, 0.28, 0.85, 9)),
        getMat(0x1d4ed8)
      );
      drum.position.set(width * 0.26, 0.62, 0.35);
      group.add(drum);

      const jack = new THREE.Mesh(
        getGeo('hyd_jack', () => new THREE.BoxGeometry(0.24, 0.18, 0.45)),
        getMat(0xdc2626)
      );
      jack.position.set(0.1, 0.29, 0.48);
      group.add(jack);
      break;
    }

    case 'GENERAL_STORE': {
      // Hanging snack packet strings + grain sack + ice-cream chest freezer
      const freezer = new THREE.Mesh(
        getGeo('ice_freezer', () => new THREE.BoxGeometry(1.15, 0.82, 0.65)),
        getMat(0xef4444)
      );
      freezer.position.set(-width * 0.22, 0.61, 0.28);
      group.add(freezer);

      const sack = new THREE.Mesh(
        getGeo('grain_sack', () => new THREE.CylinderGeometry(0.26, 0.32, 0.72, 7)),
        getMat(0xd6c7b2)
      );
      sack.position.set(width * 0.24, 0.56, 0.32);
      group.add(sack);

      // Hanging snack packets strip
      const snackGeo = getGeo('snack_strip', () => new THREE.BoxGeometry(0.18, 0.95, 0.05));
      [-0.45, 0.45].forEach((sx, i) => {
        const strip = new THREE.Mesh(snackGeo, getMat(i === 0 ? 0xfacc15 : 0x22c55e));
        strip.position.set(sx, 2.15, 0.15);
        group.add(strip);
      });
      break;
    }

    case 'JUICE_CORNER': {
      // Sugarcane crusher wheel machine + plastic table & chairs
      const machine = new THREE.Mesh(
        getGeo('ganna_machine', () => new THREE.BoxGeometry(0.75, 0.95, 0.55)),
        getMat(0x16a34a)
      );
      machine.position.set(-width * 0.22, 0.68, 0.25);
      group.add(machine);

      const wheel = new THREE.Mesh(
        getGeo('ganna_wheel', () => new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10)),
        metalMat
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(-width * 0.22, 0.85, 0.56);
      group.add(wheel);
      animRefs.gannaWheel = wheel;
      break;
    }

    case 'BARBER_SHOP': {
      // Rotating striped Barber Pole + Barber Chair + Wall Mirror
      const poleGroup = new THREE.Group();
      poleGroup.position.set(-width * 0.36, 1.85, 0.32);
      const poleCyl = new THREE.Mesh(
        getGeo('barber_pole', () => new THREE.CylinderGeometry(0.11, 0.11, 0.72, 8)),
        new THREE.MeshStandardMaterial({
          map: getAwningTexture(0),
          roughness: 0.4,
          flatShading: true
        })
      );
      poleGroup.add(poleCyl);
      group.add(poleGroup);
      animRefs.barberPole = poleCyl;

      const mirror = new THREE.Mesh(
        getGeo('barber_mirror', () => new THREE.BoxGeometry(1.4, 1.1, 0.06)),
        glassMat
      );
      mirror.position.set(0, 1.65, -1.05);
      group.add(mirror);
      break;
    }

    case 'FURNITURE_HARDWARE':
    default: {
      // Wooden chairs, tables & paint buckets spilling onto sidewalk
      const table = new THREE.Mesh(
        getGeo('furn_table', () => new THREE.BoxGeometry(1.1, 0.68, 0.72)),
        woodMat
      );
      table.position.set(-width * 0.22, 0.54, 0.35);
      group.add(table);

      const bucketGeo = getGeo('paint_bucket', () => new THREE.CylinderGeometry(0.16, 0.14, 0.34, 7));
      [0xef4444, 0x3b82f6, 0xfacc15].forEach((hex, idx) => {
        const b = new THREE.Mesh(bucketGeo, getMat(hex));
        b.position.set(0.35 + idx * 0.34, 0.37, 0.38);
        group.add(b);
      });
      break;
    }
  }
}

// ============================================================================
// STAGE 5: STREET-LEVEL CLUTTER BUILDER (Never blocks driving lanes!)
// ============================================================================
function addStreetLevelClutter(group, width, rng) {
  const clutterRoll = Math.floor(rng() * 5);
  const offsetX = (rng() - 0.5) * (width * 0.55);
  const clutterZ = 0.92; // Sits on the sidewalk step right in front of the shop

  if (clutterRoll === 0) {
    // Plastic chairs & small table with blob shadow
    const chairGroup = new THREE.Group();
    chairGroup.position.set(offsetX, 0, clutterZ);
    chairGroup.add(createBlobShadow(0.65, 0.65));
    const seat = new THREE.Mesh(
      getGeo('clutter_chair', () => new THREE.BoxGeometry(0.42, 0.44, 0.42)),
      getMat(0x2563eb)
    );
    seat.position.y = 0.22;
    chairGroup.add(seat);
    group.add(chairGroup);
  } else if (clutterRoll === 1) {
    // Traditional woven Charpai bench
    const charpai = new THREE.Group();
    charpai.position.set(offsetX, 0, clutterZ + 0.1);
    charpai.add(createBlobShadow(1.35, 0.78));
    const frame = new THREE.Mesh(
      getGeo('clutter_charpai', () => new THREE.BoxGeometry(1.3, 0.12, 0.72)),
      getMat(0x92400e)
    );
    frame.position.y = 0.36;
    charpai.add(frame);
    group.add(charpai);
  } else if (clutterRoll === 2) {
    // Parked 70cc Motorbike angled by the curb
    const bike = new THREE.Group();
    bike.position.set(offsetX, 0, clutterZ + 0.15);
    bike.rotation.y = 0.45;
    bike.add(createBlobShadow(0.55, 1.05));
    const body = new THREE.Mesh(
      getGeo('clutter_bike_body', () => new THREE.BoxGeometry(0.22, 0.42, 0.98)),
      getMat(0xdc2626)
    );
    body.position.y = 0.46;
    bike.add(body);
    group.add(bike);
  } else if (clutterRoll === 3) {
    // Sleeping Cat on the front step + stacked crates
    const cat = new THREE.Mesh(
      getGeo('sleeping_cat', () => new THREE.SphereGeometry(0.16, 6, 5)),
      getMat(0xf97316)
    );
    cat.scale.set(1.3, 0.65, 1.0);
    cat.position.set(offsetX, 0.24, 0.55);
    group.add(cat);
  } else {
    // Colorful Balloon Bunch on a stick
    const pole = new THREE.Mesh(
      getGeo('balloon_stick', () => new THREE.CylinderGeometry(0.02, 0.02, 1.45, 5)),
      getMat(0xd4d4d8)
    );
    pole.position.set(offsetX, 0.72, clutterZ);
    group.add(pole);

    const bGeo = getGeo('balloon_sph', () => new THREE.SphereGeometry(0.15, 6, 6));
    [0xef4444, 0xfacc15, 0x3b82f6].forEach((hex, idx) => {
      const b = new THREE.Mesh(bGeo, getMat(hex));
      b.position.set(offsetX + (idx - 1) * 0.14, 1.52 + (idx % 2) * 0.12, clutterZ);
      group.add(b);
    });
  }
}

// ============================================================================
// MAIN SHOP FACTORY: createShop(type, options)
// ============================================================================
/**
 * Builds a complete 1-to-3 story Pakistani bazaar shop building with its front
 * facing +Z (rotated by ShopRow.generate to face the road).
 */
export function createShop(type = 'GENERAL_STORE', options = {}) {
  const rng = options.rng || Math.random;
  const width =
    options.width ||
    SHOP_CONFIG.MIN_SHOP_WIDTH +
      rng() * (SHOP_CONFIG.MAX_SHOP_WIDTH - SHOP_CONFIG.MIN_SHOP_WIDTH);
  const floors = options.floors || 1 + Math.floor(rng() * SHOP_CONFIG.MAX_FLOORS);
  const depth = options.depth || SHOP_CONFIG.BASE_DEPTH + (rng() - 0.5) * 1.1;
  const wallHex =
    options.color ||
    SHOP_CONFIG.WALL_PALETTE[Math.floor(rng() * SHOP_CONFIG.WALL_PALETTE.length)];
  const trimHex =
    SHOP_CONFIG.TRIM_PALETTE[Math.floor(rng() * SHOP_CONFIG.TRIM_PALETTE.length)];

  // Shutter state: 68% fully open, 20% half-open, 12% closed
  const shutterRoll = options.shutterState ? 0 : rng();
  const shutterState =
    options.shutterState ||
    (shutterRoll < 0.68 ? 'OPEN' : shutterRoll < 0.88 ? 'HALF' : 'CLOSED');
  const isOpen = shutterState !== 'CLOSED';

  const group = new THREE.Group();
  group.name = `BazaarShop_${type}`;
  const animRefs = { phase: rng() * Math.PI * 2 };

  const groundH = SHOP_CONFIG.GROUND_FLOOR_HEIGHT;
  const upperH = (floors - 1) * SHOP_CONFIG.UPPER_FLOOR_HEIGHT;
  const totalH = groundH + upperH;

  const unitBoxGeo = getGeo('unit_box_1', () => new THREE.BoxGeometry(1, 1, 1));
  const wallMat = getCachedCustomMat(`wall_mat_${wallHex}`, () =>
    new THREE.MeshLambertMaterial({
      color: wallHex,
      map: getWallWeatheringTexture(),
      flatShading: true
    })
  );
  const trimMat = getMat(trimHex);
  const plinthMat = getMat(0x57534e);

  // --------------------------------------------------------------------------
  // STAGE 1: GROUND FLOOR PLINTH, PILASTERS, RECESSED INTERIOR, SHUTTER,
  //          AWNING, HAND-PAINTED FASCIA SIGNBOARD & VERTICAL SIGN
  // --------------------------------------------------------------------------

  // 1. Concrete Footing / Plinth + Front Step + Drain Ramp Slab
  const plinth = new THREE.Mesh(unitBoxGeo, plinthMat);
  plinth.scale.set(width, 0.20, depth);
  plinth.position.set(0, 0.10, -depth / 2);
  group.add(plinth);

  const frontStep = new THREE.Mesh(unitBoxGeo, getMat(0x78716c));
  frontStep.scale.set(width * 0.88, 0.14, 0.48);
  frontStep.position.set(0, 0.07, 0.24);
  group.add(frontStep);

  // 2. Left & Right Painted Pilasters / Pillars framing the recessed shop bay
  const pilasterW = 0.34;
  [-1, 1].forEach((sx) => {
    const pil = new THREE.Mesh(unitBoxGeo, trimMat);
    pil.scale.set(pilasterW, groundH, 0.36);
    pil.position.set(sx * (width / 2 - pilasterW / 2), groundH / 2, -0.12);
    group.add(pil);
  });

  // 3. Recessed Ground-Floor Shop Volume & Back Wall
  const bodyCore = new THREE.Mesh(unitBoxGeo, wallMat);
  bodyCore.scale.set(width, groundH, depth - 1.25);
  bodyCore.position.set(0, groundH / 2, -depth / 2 - 0.62);
  group.add(bodyCore);

  const bayW = width - pilasterW * 2;
  const bayH = 2.65;

  if (isOpen) {
    // Warm Recessed Interior Back Wall & Side Liners
    const interiorGlowMat = getCachedCustomMat('shop_interior_glow', () => {
      const m = new THREE.MeshLambertMaterial({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: GLOBAL_IS_NIGHT ? 1.15 : 0.55,
        flatShading: true
      });
      NIGHT_MATERIALS.add(m);
      return m;
    });

    const backWall = new THREE.Mesh(unitBoxGeo, interiorGlowMat);
    backWall.scale.set(bayW, bayH, 0.12);
    backWall.position.set(0, 0.20 + bayH / 2, -1.20);
    group.add(backWall);

    // Ceiling Tube Light Strip + Spinning Ceiling Fan inside recessed bay
    const tubeLight = new THREE.Mesh(
      getGeo('shop_tube_light', () => new THREE.BoxGeometry(1.4, 0.08, 0.12)),
      getCachedCustomMat('shop_tube_basic_white', () => new THREE.MeshBasicMaterial({ color: 0xffffff }))
    );
    tubeLight.position.set(0, 2.74, -0.55);
    group.add(tubeLight);

    const fanBlades = new THREE.Mesh(
      getGeo('shop_ceil_fan', () => new THREE.BoxGeometry(0.95, 0.03, 0.16)),
      getMat(0x1e293b)
    );
    fanBlades.position.set(0, 2.62, -0.60);
    group.add(fanBlades);
    animRefs.ceilingFan = fanBlades;
  }

  // 4. Rolling Steel Shutter (OPEN housing roll, HALF-open, or CLOSED)
  const shutterMat = getCachedCustomMat('shop_shutter_mat', () =>
    new THREE.MeshLambertMaterial({
      map: getShutterTexture(),
      flatShading: true
    })
  );
  const shutterHousing = new THREE.Mesh(unitBoxGeo, shutterMat);
  shutterHousing.scale.set(bayW, 0.26, 0.28);
  shutterHousing.position.set(0, 2.88, -0.05);
  group.add(shutterHousing);

  if (shutterState === 'HALF' || shutterState === 'CLOSED') {
    const curtainH = shutterState === 'CLOSED' ? bayH : bayH * 0.42;
    const curtain = new THREE.Mesh(unitBoxGeo, shutterMat);
    curtain.scale.set(bayW - 0.04, curtainH, 0.08);
    curtain.position.set(0, 2.85 - curtainH / 2, -0.06);
    group.add(curtain);
  }

  // 5. Striped Fabric Awning over entrance (swings gently)
  const awningPivot = new THREE.Group();
  awningPivot.position.set(0, 2.86, 0);
  const awnIdx = Math.floor(rng() * 5);
  const awningMat = getCachedCustomMat(`shop_awning_mat_${awnIdx}`, () =>
    new THREE.MeshLambertMaterial({
      map: getAwningTexture(awnIdx),
      flatShading: true
    })
  );
  const awningSlope = new THREE.Mesh(unitBoxGeo, awningMat);
  awningSlope.scale.set(width * 0.94, 0.10, 1.05);
  awningSlope.position.set(0, -0.14, 0.50);
  awningSlope.rotation.x = 0.28;
  awningPivot.add(awningSlope);
  group.add(awningPivot);
  animRefs.awningPivot = awningPivot;

  // 6. Hand-Painted Urdu & English Fascia Signboard (CanvasTexture)
  const signVarIdx = Math.floor(rng() * 4);
  const signMat = getCachedCustomMat(`shop_sign_mat_${type}_${signVarIdx}`, () => {
    const signTex = getSignboardTexture(type, signVarIdx);
    const m = new THREE.MeshLambertMaterial({
      map: signTex,
      emissive: 0xffffff,
      emissiveMap: signTex,
      emissiveIntensity: GLOBAL_IS_NIGHT ? 0.65 : 0.12
    });
    NIGHT_MATERIALS.add(m);
    return m;
  });

  const fasciaBoard = new THREE.Mesh(unitBoxGeo, signMat);
  fasciaBoard.scale.set(width * 0.96, 0.82, 0.18);
  fasciaBoard.position.set(0, 3.32, 0.06);
  group.add(fasciaBoard);

  // 7. Projecting Vertical Signboard on a Bracket + Night Neon Strip
  const catInfo = SHOP_CONFIG.SHOP_CATALOG[type] || SHOP_CONFIG.SHOP_CATALOG.GENERAL_STORE;
  const neonMat = getCachedCustomMat(`shop_neon_mat_${catInfo.neonHex}`, () => {
    const m = new THREE.MeshLambertMaterial({
      color: catInfo.neonHex,
      emissive: catInfo.neonHex,
      emissiveIntensity: GLOBAL_IS_NIGHT ? 1.45 : 0.35,
      flatShading: true
    });
    NIGHT_MATERIALS.add(m);
    return m;
  });

  const vertSignPivot = new THREE.Group();
  vertSignPivot.position.set(width / 2 - 0.15, 3.15, 0.45);
  const vertBoard = new THREE.Mesh(
    getGeo('vert_sign_board', () => new THREE.BoxGeometry(0.12, 0.95, 0.52)),
    neonMat
  );
  vertBoard.position.y = -0.45;
  vertSignPivot.add(vertBoard);
  group.add(vertSignPivot);
  animRefs.vertSignPivot = vertSignPivot;

  // --------------------------------------------------------------------------
  // STAGE 2: UPPER FLOORS (1 TO 3 FLOORS), WINDOWS, JHAROKAS, ACS, WALL ADS & ROOF
  // --------------------------------------------------------------------------
  if (floors > 1) {
    const upperBlock = new THREE.Mesh(unitBoxGeo, wallMat);
    upperBlock.scale.set(width, upperH, depth);
    upperBlock.position.set(0, groundH + upperH / 2, -depth / 2);
    group.add(upperBlock);

    const winDarkMat = getMat(0x0f172a);
    const acBoxGeo = getGeo('upper_ac_unit', () => new THREE.BoxGeometry(0.68, 0.46, 0.36));
    const acMat = getMat(0xe2e8f0);

    for (let f = 1; f < floors; f++) {
      const floorCenterY = groundH + (f - 0.5) * SHOP_CONFIG.UPPER_FLOOR_HEIGHT;
      const winStyle = (f + Math.floor(rng() * 4)) % 4;

      if (winStyle === 0) {
        // Jharoka Boxed Bay Window sticking out from facade
        const jharoka = new THREE.Mesh(unitBoxGeo, trimMat);
        jharoka.scale.set(width * 0.48, 1.55, 0.56);
        jharoka.position.set(0, floorCenterY, 0.24);
        group.add(jharoka);
      } else if (winStyle === 1) {
        // Projecting Balcony with Railings + Hanging Laundry
        const balSlab = new THREE.Mesh(unitBoxGeo, plinthMat);
        balSlab.scale.set(width * 0.76, 0.14, 0.78);
        balSlab.position.set(0, floorCenterY - 0.85, 0.36);
        group.add(balSlab);

        const rail = new THREE.Mesh(unitBoxGeo, trimMat);
        rail.scale.set(width * 0.76, 0.58, 0.08);
        rail.position.set(0, floorCenterY - 0.50, 0.72);
        group.add(rail);
      } else {
        // Twin Arched / Grilled Windows
        [-width * 0.24, width * 0.24].forEach((wx) => {
          const win = new THREE.Mesh(
            getGeo('upper_win_pane', () => new THREE.BoxGeometry(0.88, 1.25, 0.10)),
            winDarkMat
          );
          win.position.set(wx, floorCenterY, 0.03);
          group.add(win);
        });
      }

      // Clamped Window AC Unit on one side
      if (rng() < 0.75) {
        const ac = new THREE.Mesh(acBoxGeo, acMat);
        ac.position.set(width * 0.32, floorCenterY + 0.35, 0.16);
        group.add(ac);
      }
    }

    // Painted Advertisement on Upper Side Wall (Pak Cola / Star Academy)
    if (rng() < 0.65) {
      const adIdx = Math.floor(rng() * 4);
      const adMat = getCachedCustomMat(`shop_wall_ad_${adIdx}`, () =>
        new THREE.MeshLambertMaterial({
          map: getWallAdTexture(adIdx)
        })
      );
      const adBoard = new THREE.Mesh(
        getGeo('side_wall_ad', () => new THREE.PlaneGeometry(2.6, 1.4)),
        adMat
      );
      adBoard.rotation.y = Math.PI / 2;
      adBoard.position.set(width / 2 + 0.03, groundH + 1.5, -depth * 0.48);
      group.add(adBoard);
    }
  }

  // Roof Parapet + Blue Rooftop Water Tank / Satellite Dish / Barsati Shed
  const parapet = new THREE.Mesh(unitBoxGeo, trimMat);
  parapet.scale.set(width, 0.45, 0.24);
  parapet.position.set(0, totalH + 0.225, -0.12);
  group.add(parapet);

  const waterTank = new THREE.Mesh(
    getGeo('roof_water_tank', () => new THREE.CylinderGeometry(0.52, 0.52, 1.05, 8)),
    getMat(0x0284c7)
  );
  waterTank.position.set(-width * 0.22, totalH + 0.52, -depth * 0.55);
  group.add(waterTank);

  // --------------------------------------------------------------------------
  // STAGE 3 & 5: SHOP-SPECIFIC PROPS & STREET-LEVEL CLUTTER
  // --------------------------------------------------------------------------
  if (isOpen) {
    populateShopTypeProps(type, group, width, isOpen, animRefs);
  }
  addStreetLevelClutter(group, width, rng);

  group.userData = {
    isBazaarShop: true,
    shopType: type,
    width,
    floors,
    shutterState,
    animRefs
  };

  ANIMATED_SHOPS.add(group);
  patchObjectHierarchy(group);
  freezeStaticShopMeshes(group, animRefs);
  return group;
}

// ============================================================================
// SPECIAL BAZAAR LANDMARK CAMEOS (Narrow Side-Street Alley & Mosque Cameo)
// ============================================================================
function createSideStreetAlley(width = 3.6) {
  const group = new THREE.Group();
  group.name = 'Bazaar_SideAlley';
  const unitBoxGeo = getGeo('unit_box_1', () => new THREE.BoxGeometry(1, 1, 1));

  // Cobblestone narrow galli floor
  const alleyFloor = new THREE.Mesh(unitBoxGeo, getMat(0x334155));
  alleyFloor.scale.set(width, 0.08, 7.5);
  alleyFloor.position.set(0, 0.04, -3.75);
  group.add(alleyFloor);

  // Recessed glimpse of a tall building deep inside the alley
  const backBldg = new THREE.Mesh(unitBoxGeo, getMat(0xd6c7b2));
  backBldg.scale.set(width * 1.15, 11.5, 2.5);
  backBldg.position.set(0, 5.75, -7.2);
  group.add(backBldg);

  // Hanging street banner across the alley entrance
  const banner = new THREE.Mesh(unitBoxGeo, getMat(0x16a34a));
  banner.scale.set(width * 0.92, 0.55, 0.08);
  banner.position.set(0, 4.2, -0.4);
  group.add(banner);

  patchObjectHierarchy(group);
  freezeStaticShopMeshes(group);
  return group;
}

function createNeighborhoodMasjid(width = 5.4) {
  const group = new THREE.Group();
  group.name = 'Bazaar_Masjid';
  const unitBoxGeo = getGeo('unit_box_1', () => new THREE.BoxGeometry(1, 1, 1));

  const whiteMat = getMat(0xf8fafc);
  const greenMat = getMat(0x15803d);

  const hall = new THREE.Mesh(unitBoxGeo, whiteMat);
  hall.scale.set(width, 4.4, 5.2);
  hall.position.set(0, 2.2, -2.6);
  group.add(hall);

  // Green Dome
  const dome = new THREE.Mesh(
    getGeo('masjid_dome', () => new THREE.SphereGeometry(1.45, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
    greenMat
  );
  dome.position.set(0, 4.4, -2.6);
  group.add(dome);

  // Minaret Tower
  const minaret = new THREE.Mesh(
    getGeo('masjid_minaret', () => new THREE.CylinderGeometry(0.32, 0.38, 8.2, 8)),
    whiteMat
  );
  minaret.position.set(width * 0.36, 4.1, -0.8);
  group.add(minaret);

  const spire = new THREE.Mesh(
    getGeo('masjid_spire', () => new THREE.ConeGeometry(0.38, 1.2, 8)),
    greenMat
  );
  spire.position.set(width * 0.36, 8.7, -0.8);
  group.add(spire);

  patchObjectHierarchy(group);
  freezeStaticShopMeshes(group);
  return group;
}

// ============================================================================
// SHOP ROW GENERATOR & POOLING: ShopRow.generate(chunkZ, side, seed)
// ============================================================================
export const ShopRow = {
  /**
   * Fills one side (side = -1 for left, +1 for right) of a road chunk with a
   * continuous, non-repeating row of 1-to-3 story Pakistani bazaar shops,
   * narrow side-street alleys, and occasional mosque cameos.
   */
  generate(chunkZ = 0, side = 1, seed = 1) {
    const rowGroup = new THREE.Group();
    rowGroup.name = `ShopRow_${side > 0 ? 'Right' : 'Left'}_${chunkZ}`;

    const combinedSeed = Math.abs(Math.floor(chunkZ * 13 + side * 997 + seed * 31));
    const rng = createSeededRNG(combinedSeed);

    const spanZ = SHOP_CONFIG.CHUNK_SPAN_Z;
    let cursorZ = -spanZ / 2;
    let prevType = null;
    let slotIdx = 0;

    // Position row along the outer edge of the sidewalk facing the road
    const roadEdgeX = side * 11.2;

    while (cursorZ < spanZ / 2 - 3.2) {
      const remaining = spanZ / 2 - cursorZ;
      const w = Math.min(
        remaining,
        SHOP_CONFIG.MIN_SHOP_WIDTH +
          rng() * (SHOP_CONFIG.MAX_SHOP_WIDTH - SHOP_CONFIG.MIN_SHOP_WIDTH)
      );
      if (w < 3.0) break;

      const centerZ = cursorZ + w / 2;
      let piece;

      // Occasional Side-Street Alley (Galli) or Neighborhood Masjid cameo
      if (slotIdx === 2 && rng() < 0.22) {
        piece = rng() < 0.65 ? createSideStreetAlley(w) : createNeighborhoodMasjid(w);
      } else {
        // Pick a shop type that NEVER repeats the previous shop in the row
        const types = SHOP_CONFIG.SHOP_TYPES;
        let typeIdx = Math.floor(rng() * types.length);
        if (side < 0) {
          typeIdx = (typeIdx + 5) % types.length; // Different mix on Left vs Right side
        }
        let chosenType = types[typeIdx];
        if (chosenType === prevType) {
          chosenType = types[(typeIdx + 1) % types.length];
        }
        prevType = chosenType;

        piece = createShop(chosenType, {
          width: w - 0.14, // Narrow bazaar gap between buildings
          rng
        });
      }

      // Rotate so the shop front (+Z in local space) faces inward toward the road (X = 0)
      const depthJitter = (rng() - 0.5) * 0.45;
      piece.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      piece.position.set(roadEdgeX + side * depthJitter, 0, centerZ);
      rowGroup.add(piece);

      cursorZ += w;
      slotIdx++;
    }

    return rowGroup;
  }
};

// ============================================================================
// DAY / NIGHT LIGHTING TOGGLE & SUBTLE ANIMATION LOOP
// ============================================================================
export function setNight(isNight) {
  GLOBAL_IS_NIGHT = Boolean(isNight);
  NIGHT_MATERIALS.forEach((mat) => {
    if (mat.emissiveMap) {
      mat.emissiveIntensity = GLOBAL_IS_NIGHT ? 0.72 : 0.12;
    } else {
      mat.emissiveIntensity = GLOBAL_IS_NIGHT ? 1.35 : 0.42;
    }
  });
}

export function updateShops(dt) {
  const now = performance.now() * 0.001;
  ANIMATED_SHOPS.forEach((shop) => {
    const refs = shop.userData?.animRefs;
    if (!refs) return;
    const p = now * 2.2 + (refs.phase || 0);

    if (refs.awningPivot) {
      refs.awningPivot.rotation.x = Math.sin(p) * 0.025;
    }
    if (refs.vertSignPivot) {
      refs.vertSignPivot.rotation.z = Math.sin(p * 1.3) * 0.06;
    }
    if (refs.hangingClothes) {
      refs.hangingClothes.rotation.z = Math.sin(p * 1.6) * 0.08;
    }
    if (refs.barberPole) {
      refs.barberPole.rotation.y += dt * 3.2;
    }
    if (refs.gannaWheel) {
      refs.gannaWheel.rotation.z += dt * 4.0;
    }
    if (refs.ceilingFan) {
      refs.ceilingFan.rotation.y += dt * 9.5;
    }
    if (refs.steamGroup) {
      refs.steamGroup.children.forEach((sp, idx) => {
        sp.position.y = ((now * 0.55 + idx * 0.25) % 0.75);
      });
    }
  });
}

// ============================================================================
// DEBUG GALLERY SHOWROOM: showShopGallery(scene, forceState) (Key H)
// ============================================================================
let GALLERY_GROUP = null;
let IS_GALLERY_ACTIVE = false;

export function showShopGallery(scene, forceState) {
  if (!scene) return false;
  IS_GALLERY_ACTIVE =
    typeof forceState === 'boolean' ? forceState : !IS_GALLERY_ACTIVE;

  if (!IS_GALLERY_ACTIVE) {
    if (GALLERY_GROUP) {
      scene.remove(GALLERY_GROUP);
      GALLERY_GROUP = null;
    }
    return false;
  }

  if (GALLERY_GROUP) {
    scene.remove(GALLERY_GROUP);
  }

  const gallery = new THREE.Group();
  gallery.name = 'Pakistani_Bazaar_Shop_Gallery';

  // Flat bazaar street display platform
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(42, 0.25, 22),
    getMat(0x334155)
  );
  stage.position.set(0, -0.125, 0);
  gallery.add(stage);

  // Arrange all 12 shop types in 2 rows of 6 shops so all fit clearly on screen
  const types = SHOP_CONFIG.SHOP_TYPES;
  const rng = createSeededRNG(786);

  types.forEach((type, idx) => {
    const row = idx < 6 ? 0 : 1;
    const col = idx < 6 ? idx : idx - 6;
    const spacingX = 5.6;
    const xPos = (col - 2.5) * spacingX;
    const zPos = row === 0 ? -4.2 : 4.2;

    const shop = createShop(type, {
      width: 4.8,
      floors: 1 + (idx % 3),
      shutterState: 'OPEN',
      rng
    });
    shop.position.set(xPos, 0, zPos);
    gallery.add(shop);
  });

  GALLERY_GROUP = gallery;
  scene.add(gallery);
  return true;
}

