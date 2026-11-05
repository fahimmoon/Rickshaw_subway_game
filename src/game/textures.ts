import * as THREE from 'three';

export class TextureCache {
  private static brick: THREE.CanvasTexture | null = null;
  private static plaza: THREE.CanvasTexture | null = null;
  private static truckArtGreen: THREE.CanvasTexture | null = null;
  private static truckArtYellow: THREE.CanvasTexture | null = null;
  private static bumperArt: THREE.CanvasTexture | null = null;
  private static fruitBox: THREE.CanvasTexture | null = null;
  private static asphaltPBR: { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } | null = null;
  private static puddleReflection: THREE.CanvasTexture | null = null;
  private static carGrille: THREE.CanvasTexture | null = null;
  private static headlampLens: THREE.CanvasTexture | null = null;
  private static shopSignCache: Map<string, THREE.CanvasTexture> = new Map();
  private static neonBillboardCache: Map<string, THREE.CanvasTexture> = new Map();
  private static cngLogoTex: THREE.CanvasTexture | null = null;
  private static archTextureCache: Map<string, THREE.CanvasTexture> = new Map();
  private static heritageFacade: THREE.CanvasTexture | null = null;

  // Realistic Weathered Asphalt with cracks, oil stains, aggregate micro-texture & Normal Bump
  public static getAsphaltPBR(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
    if (this.asphaltPBR) return this.asphaltPBR;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base dark asphalt
    ctx.fillStyle = '#1e2530';
    ctx.fillRect(0, 0, 512, 512);

    // Fine mineral speckles & road aggregate
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 28;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Weathered Tar Cracks (Organic branched lines)
    ctx.strokeStyle = '#0f141c';
    ctx.lineWidth = 1.8;
    for (let c = 0; c < 5; c++) {
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 7; s++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.3) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Roadside Oil / Diesel stains
    ctx.fillStyle = 'rgba(10, 15, 20, 0.4)';
    for (let p = 0; p < 4; p++) {
      ctx.beginPath();
      ctx.arc(80 + Math.random() * 350, 80 + Math.random() * 350, 18 + Math.random() * 25, 0, Math.PI * 2);
      ctx.fill();
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2, 6);

    // Roughness Map (Puddles & wet stains are ultra-glossy 0.05, dry asphalt is rough 0.95)
    const rCanvas = document.createElement('canvas');
    rCanvas.width = 256;
    rCanvas.height = 256;
    const rCtx = rCanvas.getContext('2d')!;
    rCtx.fillStyle = '#e2e8f0'; // Rough base
    rCtx.fillRect(0, 0, 256, 256);

    // Slick patches
    rCtx.fillStyle = '#202020'; // Glossy
    for (let s = 0; s < 5; s++) {
      rCtx.beginPath();
      rCtx.ellipse(Math.random() * 256, Math.random() * 256, 30, 15, Math.random() * Math.PI, 0, Math.PI * 2);
      rCtx.fill();
    }
    const roughnessMap = new THREE.CanvasTexture(rCanvas);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(2, 6);

    // PBR Normal Map: standard tangent-space normal (RGB: 128, 128, 255 base flat normal) with micro bumps
    const nCanvas = document.createElement('canvas');
    nCanvas.width = 256;
    nCanvas.height = 256;
    const nCtx = nCanvas.getContext('2d')!;
    const nImgData = nCtx.createImageData(256, 256);
    const nData = nImgData.data;

    for (let i = 0; i < nData.length; i += 4) {
      const perturbX = 128 + Math.floor((Math.random() - 0.5) * 36);
      const perturbY = 128 + Math.floor((Math.random() - 0.5) * 36);
      nData[i] = perturbX;     // R (X normal component)
      nData[i + 1] = perturbY; // G (Y normal component)
      nData[i + 2] = 255;      // B (Z normal component up toward light)
      nData[i + 3] = 255;
    }
    nCtx.putImageData(nImgData, 0, 0);

    const normalMap = new THREE.CanvasTexture(nCanvas);
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(4, 12);

    this.asphaltPBR = { map, roughnessMap, normalMap };
    return this.asphaltPBR;
  }

  // Realistic PBR Roadside Puddle with multi-ring ripple reflections and iridescent oil sheen
  public static getPuddleSheen(): THREE.CanvasTexture {
    if (this.puddleReflection) return this.puddleReflection;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Water depth gradient (Deep sky blue center to dark wet asphalt rim)
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');    // Sky reflection
    grad.addColorStop(0.35, 'rgba(14, 165, 233, 0.65)'); // Water depth
    grad.addColorStop(0.7, 'rgba(30, 41, 59, 0.5)');     // Wet asphalt edge
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Iridescent Petrol / Diesel Oil Film swirl rings
    const colors = [
      'rgba(239, 68, 68, 0.25)',  // Red
      'rgba(234, 179, 8, 0.25)',  // Yellow
      'rgba(16, 185, 129, 0.25)', // Green
      'rgba(6, 182, 212, 0.3)',   // Cyan
      'rgba(168, 85, 247, 0.25)'  // Violet
    ];
    for (let r = 0; r < 5; r++) {
      ctx.strokeStyle = colors[r % colors.length];
      ctx.lineWidth = 4 + r;
      ctx.beginPath();
      ctx.ellipse(128 + (r - 2) * 6, 128 + (r - 2) * 4, 30 + r * 14, 18 + r * 9, 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sky Glint Sparkle Highlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(105, 110, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(145, 135, 3.5, 0, Math.PI * 2);
    ctx.fill();

    this.puddleReflection = new THREE.CanvasTexture(canvas);
    return this.puddleReflection;
  }

  public static getCarGrille(): THREE.CanvasTexture {
    if (this.carGrille) return this.carGrille;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 256, 64);

    // Honeycomb / Horizontal chrome slats
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    for (let y = 10; y < 64; y += 12) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(246, y);
      ctx.stroke();
    }
    // Center emblem badge circle
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(128, 32, 14, 0, Math.PI * 2);
    ctx.fill();

    this.carGrille = new THREE.CanvasTexture(canvas);
    return this.carGrille;
  }

  public static getHeadlampLens(): THREE.CanvasTexture {
    if (this.headlampLens) return this.headlampLens;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 128, 64);

    // Faceted reflector lines
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    for (let x = 6; x < 128; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 64);
      ctx.stroke();
    }

    // LED DRL strip on top
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, 128, 8);

    this.headlampLens = new THREE.CanvasTexture(canvas);
    return this.headlampLens;
  }

  public static getBrick(): THREE.CanvasTexture {
    if (this.brick) return this.brick;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#9a3412';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5;
    const brickH = 20;
    const brickW = 44;

    for (let y = 0; y < 256; y += brickH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();

      const offset = (Math.floor(y / brickH) % 2) * (brickW / 2);
      for (let x = offset; x < 256; x += brickW) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + brickH);
        ctx.stroke();
      }
    }
    this.brick = new THREE.CanvasTexture(canvas);
    this.brick.wrapS = THREE.RepeatWrapping;
    this.brick.wrapT = THREE.RepeatWrapping;
    this.brick.repeat.set(3, 3);
    return this.brick;
  }

  public static getPlaza(): THREE.CanvasTexture {
    if (this.plaza) return this.plaza;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);

    const winW = 34;
    const winH = 44;
    const gap = 14;

    for (let y = gap; y < 256 - winH; y += winH + gap) {
      for (let x = gap; x < 256 - winW; x += winW + gap) {
        const grad = ctx.createLinearGradient(x, y, x + winW, y + winH);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(0.5, '#0284c7');
        grad.addColorStop(1, '#0369a1');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, winW, winH);

        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, winW, winH);
      }
    }
    this.plaza = new THREE.CanvasTexture(canvas);
    this.plaza.wrapS = THREE.RepeatWrapping;
    this.plaza.wrapT = THREE.RepeatWrapping;
    this.plaza.repeat.set(2, 2);
    return this.plaza;
  }

  private static skinTruckArtCache: { [key: string]: THREE.CanvasTexture } = {};
  private static rickshawRearArtCache: { [key: string]: THREE.CanvasTexture } = {};
  private static bedfordTailboard: THREE.CanvasTexture | null = null;
  private static bedfordCrown: THREE.CanvasTexture | null = null;

  public static getTruckArt(isYellow = false, skin: string = 'badshahi'): THREE.CanvasTexture {
    const key = `${skin}_${isYellow ? 'trim' : 'body'}`;
    if (this.skinTruckArtCache[key]) return this.skinTruckArtCache[key];

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    let baseBg = isYellow ? '#f59e0b' : '#059669';
    let motifCenter = '#facc15';
    let motifRing1 = '#ef4444';
    let motifRing2 = '#06b6d4';

    if (skin === 'karachi') {
      baseBg = isYellow ? '#06b6d4' : '#0284c7';
      motifCenter = '#38bdf8';
      motifRing1 = '#f59e0b';
      motifRing2 = '#ffffff';
    } else if (skin === 'peshawar') {
      baseBg = isYellow ? '#f97316' : '#dc2626';
      motifCenter = '#facc15';
      motifRing1 = '#15803d';
      motifRing2 = '#fbbf24';
    } else if (skin === 'cyber') {
      baseBg = isYellow ? '#facc15' : '#7c3aed';
      motifCenter = '#ec4899';
      motifRing1 = '#06b6d4';
      motifRing2 = '#10b981';
    }

    ctx.fillStyle = baseBg;
    ctx.fillRect(0, 0, 256, 256);

    const colors = [motifRing1, motifCenter, motifRing2, '#ec4899', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = colors[i % colors.length];
      const triangleSize = 20;
      for (let x = 0; x < 256; x += triangleSize) {
        ctx.beginPath();
        ctx.moveTo(x, 15 * i);
        ctx.lineTo(x + triangleSize / 2, 15 * (i + 1));
        ctx.lineTo(x + triangleSize, 15 * i);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Peacock / floral medallion
    ctx.fillStyle = motifCenter;
    ctx.beginPath();
    ctx.arc(128, 150, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = motifRing1;
    ctx.beginPath();
    ctx.arc(128, 150, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = motifRing2;
    ctx.beginPath();
    ctx.arc(128, 150, 16, 0, Math.PI * 2);
    ctx.fill();

    // Calligraphic decorative flourishes
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(128, 150, 52, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    this.skinTruckArtCache[key] = tex;
    return tex;
  }

  /**
   * Iconic Framed Pakistani Auto-Rickshaw Rear Panel Painting.
   * Features a decorative border, mirror-work rosettes, floral medallions,
   * and high-contrast culturally authentic slogans (e.g. "DEKH MAGAR PYAR SE", "PAPPU YAAR", etc.)
   * Readable at standard chase-camera distance.
   */
  public static getRickshawRearArt(skin: string = 'badshahi'): THREE.CanvasTexture {
    if (this.rickshawRearArtCache[skin]) return this.rickshawRearArtCache[skin];

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;

    let borderOuter = '#f59e0b';
    let borderInner = '#ef4444';
    let frameBg = '#0f172a';
    let medallionCol = '#059669';
    let slogan = '🛺 DEKH MAGAR PYAR SE 🛺';
    let subSlogan = 'HONK PLEASE • LAHORE';

    if (skin === 'karachi') {
      borderOuter = '#06b6d4';
      borderInner = '#f59e0b';
      frameBg = '#032541';
      medallionCol = '#0284c7';
      slogan = '🌊 KARACHI SPEED • SULTAN 🌊';
      subSlogan = 'FASLA RAKHEIN • KHI-99';
    } else if (skin === 'peshawar') {
      borderOuter = '#f97316';
      borderInner = '#15803d';
      frameBg = '#3f0c0c';
      medallionCol = '#dc2626';
      slogan = '🦅 KHAN BROTHERS • PESHAWAR 🦅';
      subSlogan = 'PEHLAY AAP • ZINDABAD';
    } else if (skin === 'cyber') {
      borderOuter = '#facc15';
      borderInner = '#ec4899';
      frameBg = '#180728';
      medallionCol = '#7c3aed';
      slogan = '⚡ CYBER RICKSHAW 2077 ⚡';
      subSlogan = 'TURBO CNG • LAHORE RUSH';
    }

    // Outer Chamak-Patti border with alternating triangle teeth
    ctx.fillStyle = borderOuter;
    ctx.fillRect(0, 0, 512, 384);

    const toothW = 32;
    ctx.fillStyle = borderInner;
    for (let x = 0; x < 512; x += toothW) {
      // Top teeth
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + toothW / 2, 24);
      ctx.lineTo(x + toothW, 0);
      ctx.closePath();
      ctx.fill();

      // Bottom teeth
      ctx.beginPath();
      ctx.moveTo(x, 384);
      ctx.lineTo(x + toothW / 2, 360);
      ctx.lineTo(x + toothW, 384);
      ctx.closePath();
      ctx.fill();
    }

    // Inner painted canvas frame
    ctx.fillStyle = frameBg;
    ctx.fillRect(24, 24, 464, 336);

    // Golden inner fillet border
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.strokeRect(32, 32, 448, 320);

    // Left and Right Floral/Peacock Medallions
    [90, 422].forEach((cx) => {
      ctx.fillStyle = medallionCol;
      ctx.beginPath();
      ctx.arc(cx, 160, 48, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(cx, 160, 32, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, 160, 16, 0, Math.PI * 2);
      ctx.fill();

      // Chamki petals
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 40, 160 + Math.sin(a) * 40, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Central Chamak-Patti Heart / Plaque
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.roundRect(156, 70, 200, 150, [18]);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Ornate Crown / Arch atop central plaque
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(256, 70, 38, Math.PI, 0);
    ctx.fill();

    // Central Peacock Feather / Diamond motif
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(256, 90);
    ctx.lineTo(286, 140);
    ctx.lineTo(256, 190);
    ctx.lineTo(226, 140);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(256, 140, 16, 0, Math.PI * 2);
    ctx.fill();

    // Slogan Ribbon
    ctx.fillStyle = '#059669';
    ctx.fillRect(40, 246, 432, 54);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 246, 432, 54);

    // High-contrast, bold cultural slogan
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px "Plus Jakarta Sans", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slogan, 256, 273);

    // Sub-slogan at bottom
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 18px "Plus Jakarta Sans", monospace';
    ctx.fillText(subSlogan, 256, 330);

    const tex = new THREE.CanvasTexture(canvas);
    this.rickshawRearArtCache[skin] = tex;
    return tex;
  }

  // Iconic Pakistani Bedford Truck Chamak-Patti Tailboard with Eagle & Calligraphy
  public static getBedfordTailboardArt(): THREE.CanvasTexture {
    if (this.bedfordTailboard) return this.bedfordTailboard;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Vibrant background segments
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(0, 0, 512, 256);

    // Multi-color chevron border
    const chevronColors = ['#facc15', '#059669', '#0284c7', '#ea580c', '#ffffff'];
    for (let i = 0; i < 512; i += 32) {
      ctx.fillStyle = chevronColors[(i / 32) % chevronColors.length];
      ctx.fillRect(i, 0, 30, 24);
      ctx.fillRect(i, 232, 30, 24);
    }

    // Center oval badge with iconic "Maan Ki Dua" / "Dekh Magar Pyar Se"
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(256, 128, 180, 85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Golden Eagle silhouette in center
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(256, 75);
    ctx.lineTo(285, 115);
    ctx.lineTo(240, 105);
    ctx.lineTo(256, 135);
    ctx.lineTo(272, 105);
    ctx.lineTo(227, 115);
    ctx.closePath();
    ctx.fill();

    // Calligraphy banner
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 28px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦅 MAAN KI DUA 🦅', 256, 128);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText('DEKH MAGAR PYAR SE', 256, 168);

    this.bedfordTailboard = new THREE.CanvasTexture(canvas);
    return this.bedfordTailboard;
  }

  public static getBedfordCrownArt(): THREE.CanvasTexture {
    if (this.bedfordCrown) return this.bedfordCrown;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Golden ornate arch crown
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, 512, 128);

    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.ellipse(256, 64, 230, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ JANNAT KI TALASH ★', 256, 64);

    this.bedfordCrown = new THREE.CanvasTexture(canvas);
    return this.bedfordCrown;
  }

  public static getShopSign(text: string, subText = '', bgColor = '#facc15', textColor = '#0f172a'): THREE.CanvasTexture {
    const key = `${text}_${subText}_${bgColor}_${textColor}`;
    if (this.shopSignCache.has(key)) return this.shopSignCache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext('2d')!;

    // Background with decorative border
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 140);

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 128);

    // Inner gold pin-stripe
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(14, 14, 484, 112);

    ctx.fillStyle = textColor;
    ctx.font = '900 32px "Plus Jakarta Sans", "Bungee", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, subText ? 52 : 70);

    if (subText) {
      ctx.fillStyle = '#b91c1c';
      ctx.font = 'bold 22px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillText(subText, 256, 96);
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.shopSignCache.set(key, tex);
    return tex;
  }

  public static getNeonBillboard(title: string, sub: string): THREE.CanvasTexture {
    const key = `${title}_${sub}`;
    if (this.neonBillboardCache.has(key)) return this.neonBillboardCache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 180);

    // Glowing neon border
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 160);

    ctx.fillStyle = '#facc15';
    ctx.font = '900 36px "Plus Jakarta Sans", "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 75);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(sub, 256, 125);

    const tex = new THREE.CanvasTexture(canvas);
    this.neonBillboardCache.set(key, tex);
    return tex;
  }

  public static getBumperArt(): THREE.CanvasTexture {
    if (this.bumperArt) return this.bumperArt;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 64);

    ctx.fillStyle = '#0f172a';
    for (let x = -64; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 32, 64);
      ctx.lineTo(x + 16, 64);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(40, 10, 176, 44);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(42, 12, 172, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛺 PEHLAY AAP 🛺', 128, 32);

    this.bumperArt = new THREE.CanvasTexture(canvas);
    return this.bumperArt;
  }

  public static getFruitBoxTexture(): THREE.CanvasTexture {
    if (this.fruitBox) return this.fruitBox;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 120);

    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(124, 124);
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ANWAR RATOL', 64, 68);

    this.fruitBox = new THREE.CanvasTexture(canvas);
    return this.fruitBox;
  }

  // Authentic Pakistani Green CNG Cylinder Stencil
  public static getCNGLogo(): THREE.CanvasTexture {
    if (this.cngLogoTex) return this.cngLogoTex;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Forest green base
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, 256, 128);

    // Stencil borders
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 244, 116);

    // CNG Diamond Emblem
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(128, 16);
    ctx.lineTo(210, 64);
    ctx.lineTo(128, 112);
    ctx.lineTo(46, 64);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 32px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CNG', 128, 64);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('PAKISTAN CLEAN FUEL', 128, 102);

    this.cngLogoTex = new THREE.CanvasTexture(canvas);
    return this.cngLogoTex;
  }

  // Ceremonial Road Arch Banner ("Welcome to Lahore / Dekh Magar Pyar Se")
  public static getOverheadArchTexture(title = 'WELCOME TO LAHORE MALL ROAD', subtitle = 'خوش آمدید - شاہراہ قائد اعظم'): THREE.CanvasTexture {
    const key = `${title}_${subtitle}`;
    if (this.archTextureCache.has(key)) return this.archTextureCache.get(key)!;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    // Rich emerald green & gold gradient
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.2, '#047857');
    grad.addColorStop(0.5, '#059669');
    grad.addColorStop(0.8, '#047857');
    grad.addColorStop(1, '#064e3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 160);

    // Traditional floral truck-art chevron top and bottom trim
    const trimColors = ['#facc15', '#ef4444', '#0284c7', '#ffffff'];
    for (let x = 0; x < 1024; x += 32) {
      ctx.fillStyle = trimColors[(x / 32) % trimColors.length];
      ctx.fillRect(x, 0, 28, 14);
      ctx.fillRect(x, 146, 28, 14);
    }

    // Gold borders
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 18, 1008, 124);

    // Crescent & Star badge left & right
    [100, 924].forEach((cx) => {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(cx, 80, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.arc(cx + 8, 77, 24, 0, Math.PI * 2);
      ctx.fill();

      // Star
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', cx + 14, 75);
    });

    // Main Title
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 44px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(title, 512, 60);

    // Urdu Subtitle
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subtitle, 512, 110);
    ctx.shadowBlur = 0;

    const tex = new THREE.CanvasTexture(canvas);
    this.archTextureCache.set(key, tex);
    return tex;
  }

  // Mughal Heritage Brickwork with Cusped Arch Windows
  public static getHeritageMughalFacade(): THREE.CanvasTexture {
    if (this.heritageFacade) return this.heritageFacade;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Terracotta Mughal brick
    ctx.fillStyle = '#831843'; // Deep heritage red brick tone
    ctx.fillRect(0, 0, 512, 512);

    // Fine mortar lines
    ctx.strokeStyle = '#fbcfe8';
    ctx.lineWidth = 1.8;
    for (let y = 0; y < 512; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();

      const offset = (Math.floor(y / 24) % 2) * 28;
      for (let x = offset; x < 512; x += 56) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 24);
        ctx.stroke();
      }
    }

    // Mughal Arched Windows with White Marble Jaali Screen
    const winW = 60;
    const winH = 90;
    for (let r = 50; r < 512 - winH; r += 140) {
      for (let c = 40; c < 512 - winW; c += 110) {
        // Arch cutout
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(c, r + winH);
        ctx.lineTo(c, r + winW / 2);
        ctx.arc(c + winW / 2, r + winW / 2, winW / 2, Math.PI, 0);
        ctx.lineTo(c + winW, r + winH);
        ctx.closePath();
        ctx.fill();

        // White Marble Cusped Border
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Jaali Lattice geometric pattern inside window
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 1.5;
        for (let jx = c + 10; jx < c + winW; jx += 12) {
          ctx.beginPath();
          ctx.moveTo(jx, r + 20);
          ctx.lineTo(jx, r + winH - 5);
          ctx.stroke();
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    this.heritageFacade = tex;
    return tex;
  }
}
