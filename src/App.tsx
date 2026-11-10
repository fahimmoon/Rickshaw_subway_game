import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Zap,
  Shield,
  Trophy,
  Coins,
  Gauge,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Flame,
  AlertTriangle,
  Radio,
  Sparkles,
  HelpCircle,
  X,
  Palette,
  Award,
  CloudRain,
  Sun,
  Sunrise,
  Moon,
  ChevronRight,
  CheckCircle2,
  Lock,
  Pause,
  PlayCircle,
  Car,
  Truck,
  Bike,
  Terminal,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SubwayRickshawEngine, GameStats } from './game/engine';
import {
  RickshawSkin,
  NeonColorId,
  NeonInfo,
  WeatherType,
  UpgradesState,
  Quest,
  SkinInfo,
  VehicleId,
  MysteryVehicleId,
  PICKUP_DEFINITIONS
} from './game/config';
import {
  PLAYABLE_VEHICLES,
  VehicleDef,
  getUnlockedVehicles,
  unlockVehicle,
  getSelectedVehicle,
  setSelectedVehicle
} from './game/vehicles';
import { runHeadlessPatternValidation } from './game/patterns';
import { PetrolPump, RenderHudIcon } from './ui/icons';

const SKINS_DEF: SkinInfo[] = [
  {
    id: 'badshahi',
    name: 'The Badshahi Royal',
    city: 'Lahore Mall Road',
    description: 'Imperial Mughal emerald green & gold with floral peacock truck-art medallions.',
    price: 0,
    unlocked: true,
    colors: { body: 0x059669, trim: 0xfbbf24, canopy: 0x14532d, accent: '#059669' }
  },
  {
    id: 'karachi',
    name: 'Karachi Thunder',
    city: 'Clifton Beachway',
    description: 'Arabian Sea midnight blue & electric cyan with stormy ocean wave motifs.',
    price: 200,
    unlocked: false,
    colors: { body: 0x0284c7, trim: 0x06b6d4, canopy: 0x0f172a, accent: '#0284c7' }
  },
  {
    id: 'peshawar',
    name: 'Peshawar Falcon',
    city: 'Khyber Pass',
    description: 'Fiery Khyber Pass crimson & marigold orange with mountain eagle calligraphy.',
    price: 400,
    unlocked: false,
    colors: { body: 0xdc2626, trim: 0xf97316, canopy: 0x7f1d1d, accent: '#dc2626' }
  },
  {
    id: 'cyber',
    name: 'Cyber Mall Road',
    city: 'Cyber Lahore 2099',
    description: 'Futuristic ultraviolet & chrome gold Chameli cyber-art with neon lighting.',
    price: 800,
    unlocked: false,
    colors: { body: 0x7c3aed, trim: 0xfacc15, canopy: 0x3b0764, accent: '#7c3aed' }
  },
  {
    id: 'multan',
    name: 'Multan Blue Pottery',
    city: 'Multan Shahi Bazaar',
    description: 'Hand-glazed cobalt & turquoise Kashi-kari ceramic tilework with ivory trim.',
    price: 550,
    unlocked: false,
    colors: { body: 0x1d4ed8, trim: 0x38bdf8, canopy: 0x1e3a8a, accent: '#1d4ed8' }
  },
  {
    id: 'swat',
    name: 'Swat Emerald Phulkari',
    city: 'Mingora Valley',
    description: 'Alpine jade green & golden silk embroidery motifs inspired by Swat Valley.',
    price: 650,
    unlocked: false,
    colors: { body: 0x10b981, trim: 0xfde047, canopy: 0x064e3b, accent: '#10b981' }
  }
];

const NEONS_DEF: NeonInfo[] = [
  { id: 'none', name: 'Factory Stock (No Neon)', price: 0, hex: '#475569' },
  { id: 'emerald', name: 'Lahore Emerald Underglow', price: 200, hex: '#10b981' },
  { id: 'cyan', name: 'Karachi Sea Cyan Underglow', price: 250, hex: '#06b6d4' },
  { id: 'gold', name: 'Badshahi Shahi Gold Underglow', price: 350, hex: '#facc15' },
  { id: 'magenta', name: 'Cyber Mall Magenta Underglow', price: 450, hex: '#ec4899' }
];

const DEFAULT_QUESTS: Quest[] = [
  {
    id: 'quest_coins',
    title: 'Dhaba Chai Run: Collect 50 Rupees',
    target: 50,
    current: 0,
    reward: 250,
    type: 'COINS',
    completed: false,
    claimed: false
  },
  {
    id: 'quest_distance',
    title: 'Mall Road Explorer: Run 600 Meters',
    target: 600,
    current: 0,
    reward: 300,
    type: 'DISTANCE',
    completed: false,
    claimed: false
  },
  {
    id: 'quest_speed',
    title: 'Speed King: Hit 45 km/h on Speedometer',
    target: 45,
    current: 0,
    reward: 350,
    type: 'SPEED',
    completed: false,
    claimed: false
  },
  {
    id: 'quest_closecall',
    title: 'Close Call Maestro: 3 Near-Misses',
    target: 3,
    current: 0,
    reward: 400,
    type: 'CLOSECALL',
    completed: false,
    claimed: false
  }
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SubwayRickshawEngine | null>(null);

  const [stats, setStats] = useState<GameStats>({
    distance: 0,
    coins: 0,
    speed: 32,
    bestScore: 0,
    activePowerup: null,
    powerupTimer: 0,
    scoreMultiplier: 1,
    hasShield: false,
    policeDanger: false,
    electricWarning: false,
    state: 'START',
    crashReason: '',
    timeOfDay: 'Day',
    weather: 'SUNNY',
    totalRupees: 0,
    closeCalls: 0,
    currentSkin: 'badshahi',
    cngFuel: 100,
    policeDistance: 14,
    wardenStrikes: 0,
    hornCooldown: 0,
    powerupFlicker: false,
    difficultyLevel: 0,
    speedUpFlash: false,
    policeState: 'SAFE',
    policeGap: 14,
    activeVehicle: 'rickshaw',
    isMysteryActive: false,
    mysteryVehicle: null,
    mysteryTimer: 0,
    mysteryFlicker: false,
    isShortcutActive: false,
    verticalLevel: 0,
    comicDialogue: '',
    arrestPhase: 'NONE',
    fps: 60,
    fuel: 100,
    isLowFuel: false,
    isFuelEmpty: false,
    fuelNoDrainTimer: 0,
    shieldActive: false,
    shieldVariant: null,
    shieldTimer: 0,
    shieldMaxDuration: 10,
    shieldCharges: 0,
    shieldFlicker: false,
    jumpBoostActive: false,
    jumpVariant: null,
    jumpTimer: 0,
    jumpMaxDuration: 12,
    jumpFlicker: false,
    doubleJumpsRemaining: 0,
    screenFlashColor: null,
    inUnderpass: false,
    playerY: 0,
    surfaceY: 0,
    rampProgress: 0,
    curveEnabled: true,
    debugGroundGrid: false,
    debugBaseMarkers: false,
    debugHeightOverlay: false,
    debugWireframe: false,
    debugBoundingBoxes: false,
    isShowroomMode: false,
    showroomValidationResults: [],
    unpatchedCount: 0,
    chaiNitroCharge: 35,
    isNitroActive: false,
    nitroTimer: 0,
    roadsideOrdersServed: 0,
    isNPCGalleryOpen: false,
    isShopGalleryOpen: false,
    isBuildingGalleryOpen: false,
    buildingGalleryStage: 0,
    currentDistrict: 'Saddar & Empress Mkt',
    streakCount: 0,
    showPerfOverlay: false,
    perfMetrics: {
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
    }
  });

  const [isMuted, setIsMuted] = useState(false);
  const [colorblindMode, setColorblindMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showGarage, setShowGarage] = useState(false);
  const [garageTab, setGarageTab] = useState<'VEHICLES' | 'SKINS' | 'UPGRADES' | 'BAZAAR'>('VEHICLES');
  const [dailyEidiClaimed, setDailyEidiClaimed] = useState<boolean>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return localStorage.getItem('rickshaw_daily_eidi_date') === today;
  });
  const [showQuests, setShowQuests] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [unlockedVehicles, setUnlockedVehicles] = useState<VehicleId[]>(() => getUnlockedVehicles());
  const [selectedVehicle, setSelectedVehicleState] = useState<VehicleId>(() => getSelectedVehicle());
  const [headlessTestResult, setHeadlessTestResult] = useState<{
    tested: number;
    valid: number;
    rejectedAndRerolled: number;
    passRate: number;
  } | null>(null);
  const [flyoverTestResult, setFlyoverTestResult] = useState<{
    tested: number;
    passed: number;
    failedSeeds: number[];
    vehiclesTested: VehicleId[];
    passRate: number;
    maxStepDeltaY: number;
    smoothClimbPassed: boolean;
  } | null>(null);
  const [fuelTestResult, setFuelTestResult] = useState<{
    runsSimulated: number;
    starvedRuns: number;
    minFuelObserved: number;
    avgFuelPickupsPerRun: number;
    passed: boolean;
  } | null>(null);

  // Close Call Banner State
  const [closeCallBanner, setCloseCallBanner] = useState<{ phrase: string; combo: number } | null>(null);
  const closeCallTimeoutRef = useRef<number | null>(null);

  // Puddle Screen Splash Animation
  const [puddleSplashActive, setPuddleSplashActive] = useState(false);
  const splashTimeoutRef = useRef<number | null>(null);

  // Unlocked Skins & Upgrades State
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(() => {
    const saved = localStorage.getItem('rickshaw_unlocked_skins');
    return saved ? JSON.parse(saved) : ['badshahi'];
  });

  const [upgrades, setUpgrades] = useState<UpgradesState>(() => {
    const saved = localStorage.getItem('rickshaw_upgrades');
    if (!saved) return { magnetLevel: 1, jetpackLevel: 1, hydraulicLevel: 1, starterShield: 0 };
    try {
      const parsed = JSON.parse(saved);
      if (parsed.sneakersLevel && !parsed.hydraulicLevel) parsed.hydraulicLevel = parsed.sneakersLevel;
      return { magnetLevel: 1, jetpackLevel: 1, hydraulicLevel: 1, starterShield: 0, ...parsed };
    } catch {
      return { magnetLevel: 1, jetpackLevel: 1, hydraulicLevel: 1, starterShield: 0 };
    }
  });

  // Quests State
  const [quests, setQuests] = useState<Quest[]>(() => {
    const saved = localStorage.getItem('rickshaw_quests');
    return saved ? JSON.parse(saved) : DEFAULT_QUESTS;
  });

  const toastTimeoutRef = useRef<number | null>(null);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  }, []);

  // Initialize Three.js Engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new SubwayRickshawEngine(canvasRef.current);
    engineRef.current = engine;

    engine.onStatsUpdate = (newStats) => {
      setStats({ ...newStats });

      // Update quests tracking in real-time
      setQuests((prevQuests) => {
        let changed = false;
        const updated = prevQuests.map((q) => {
          let currentVal = q.current;
          if (q.type === 'COINS') currentVal = Math.max(q.current, newStats.coins);
          else if (q.type === 'DISTANCE') currentVal = Math.max(q.current, Math.floor(newStats.distance));
          else if (q.type === 'SPEED') currentVal = Math.max(q.current, Math.floor(newStats.speed * 1.5));
          else if (q.type === 'CLOSECALL') currentVal = Math.max(q.current, newStats.closeCalls);

          const isNowCompleted = currentVal >= q.target;
          if (!q.completed && isNowCompleted) {
            changed = true;
            engine.sound.playQuestComplete();
            triggerToast(`🏆 QUEST COMPLETED: ${q.title}!`);
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.4 } });
          }
          return { ...q, current: currentVal, completed: q.completed || isNowCompleted };
        });

        if (changed) {
          localStorage.setItem('rickshaw_quests', JSON.stringify(updated));
          return updated;
        }
        return prevQuests;
      });

      if (newStats.state === 'GAMEOVER' && newStats.distance > newStats.bestScore && newStats.distance > 50) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    };

    engine.onToast = (msg) => {
      triggerToast(msg);
    };

    engine.onCloseCall = (combo, phrase) => {
      setCloseCallBanner({ phrase, combo });
      if (closeCallTimeoutRef.current) clearTimeout(closeCallTimeoutRef.current);
      closeCallTimeoutRef.current = window.setTimeout(() => {
        setCloseCallBanner(null);
      }, 1400);
    };

    engine.onPuddleSplash = () => {
      setPuddleSplashActive(true);
      if (splashTimeoutRef.current) clearTimeout(splashTimeoutRef.current);
      splashTimeoutRef.current = window.setTimeout(() => {
        setPuddleSplashActive(false);
      }, 1000);
    };

    return () => {
      engine.destroy();
    };
  }, [triggerToast]);

  // Sync Garage Showroom camera
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setGarageMode(showGarage);
    }
  }, [showGarage]);

  const statsRef = useRef(stats);
  statsRef.current = stats;

  const showGarageRef = useRef(showGarage);
  showGarageRef.current = showGarage;

  const showQuestsRef = useRef(showQuests);
  showQuestsRef.current = showQuests;

  const showHowToPlayRef = useRef(showHowToPlay);
  showHowToPlayRef.current = showHowToPlay;

  const showDebugRef = useRef(showDebug);
  showDebugRef.current = showDebug;

  // Keyboard Handlers (Fixed listener leak: attached once with stable refs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // Prevent key repeat floods
      const engine = engineRef.current;
      if (!engine) return;

      const currentStats = statsRef.current;
      const isGarageOpen = showGarageRef.current;
      const isQuestsOpen = showQuestsRef.current;
      const isHowToPlayOpen = showHowToPlayRef.current;
      const isDebugOpen = showDebugRef.current;

      if (e.code === 'Backquote' || e.code === 'F2' || e.key === '`' || e.key === '~') {
        e.preventDefault();
        setShowDebug((prev) => !prev);
        return;
      }

      // Stage 0 Performance Telemetry Overlay Toggle (Key F)
      if (e.code === 'KeyF' && !isDebugOpen) {
        e.preventDefault();
        engine.togglePerfOverlay();
        return;
      }

      // Key G: Toggle 3D Karachi Street NPC Gallery (showNPCGallery)
      if (e.code === 'KeyG' && !isDebugOpen) {
        e.preventDefault();
        engine.toggleNPCGallery();
        return;
      }

      if (engine.isNPCGalleryOpen && e.code === 'Escape') {
        e.preventDefault();
        engine.setNPCGalleryMode(false);
        return;
      }

      // Key H: Toggle 3D Pakistani Bazaar Shop Gallery (showShopGallery) when on Start screen, or Shift+H anytime
      if (e.code === 'KeyH' && !isDebugOpen && (currentStats.state !== 'RUNNING' || e.shiftKey || engine.isShopGalleryOpen)) {
        e.preventDefault();
        engine.toggleShopGallery();
        return;
      }

      if (engine.isShopGalleryOpen && e.code === 'Escape') {
        e.preventDefault();
        engine.setShopGalleryMode(false);
        return;
      }

      // Key B: Toggle 3D Pakistani Skyline Building Gallery (showBuildingGallery), or Shift+B for Vehicle Box3 Debug
      if (e.code === 'KeyB') {
        e.preventDefault();
        if (e.shiftKey) {
          engine.toggleBoundingBoxDebug();
        } else {
          engine.toggleBuildingGallery();
        }
        return;
      }

      if (engine.isBuildingGalleryOpen) {
        if (e.code === 'Digit1') {
          e.preventDefault();
          engine.setBuildingGalleryStage(1);
          return;
        }
        if (e.code === 'Digit2') {
          e.preventDefault();
          engine.setBuildingGalleryStage(2);
          return;
        }
        if (e.code === 'Digit3') {
          e.preventDefault();
          engine.setBuildingGalleryStage(3);
          return;
        }
        if (e.code === 'Digit0') {
          e.preventDefault();
          engine.setBuildingGalleryStage(0);
          return;
        }
        if (e.code === 'Escape') {
          e.preventDefault();
          engine.setBuildingGalleryMode(false);
          return;
        }
      }

      if (engine.isShowroomMode) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          engine.cycleShowroomFocus(-1);
          return;
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          engine.cycleShowroomFocus(1);
          return;
        }
        if (e.code === 'Escape') {
          e.preventDefault();
          engine.setShowroomMode(false);
          return;
        }
      }

      // When Debug Overlay is active, route debug hotkeys (H, C, L, K, G, F) while still allowing normal driving!
      if (isDebugOpen) {
        if (e.code === 'KeyH') {
          e.preventDefault();
          engine.toggleHeightOverlay();
          return;
        }
        if (e.code === 'KeyC') {
          e.preventDefault();
          engine.toggleCurve();
          return;
        }
        if (e.code === 'KeyL') {
          e.preventDefault();
          engine.forceSpawnFlyoverAhead();
          return;
        }
        if (e.code === 'KeyK') {
          e.preventDefault();
          engine.toggleWireframe();
          return;
        }
        if (e.code === 'KeyG') {
          e.preventDefault();
          engine.toggleGroundGrid();
          return;
        }
        if (e.code === 'KeyF') {
          e.preventDefault();
          engine.toggleBaseMarkers();
          return;
        }
      }

      if (isGarageOpen || isQuestsOpen || isHowToPlayOpen) {
        if (e.code === 'Escape') {
          setShowGarage(false);
          setShowQuests(false);
          setShowHowToPlay(false);
        }
        return;
      }

      if (currentStats.state === 'START') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          engine.start();
        }
        return;
      }

      if (currentStats.state === 'GAMEOVER') {
        if (e.code === 'Space' || e.code === 'KeyR' || e.code === 'Enter') {
          e.preventDefault();
          if (currentStats.arrestPhase !== 'COMPLETE' && currentStats.arrestPhase !== 'NONE') {
            engine.skipArrestCutscene();
          } else {
            engine.restart();
          }
        }
        return;
      }

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          engine.switchLane(-1);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          engine.switchLane(1);
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
          e.preventDefault();
          engine.jump();
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          engine.slide();
          break;
        case 'KeyE':
          e.preventDefault();
          engine.activateShield();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyN':
          e.preventDefault();
          engine.activateChaiNitro();
          break;
        case 'KeyO':
          e.preventDefault();
          if (currentStats.state === 'RUNNING') {
            engine.pause();
          }
          setShowGarage(true);
          break;
        case 'KeyH':
          e.preventDefault();
          engine.honkHorn();
          break;
        case 'KeyM':
          e.preventDefault();
          setIsMuted(!engine.sound.toggleMute());
          break;
        case 'KeyP':
        case 'Escape':
          e.preventDefault();
          engine.pause();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        engine.releaseJump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Enhanced Mobile Touch & Swipe Handling (Instant low-threshold response) + Stage 0 Triple-Tap Perf Toggle
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  const onPointerDown = (e: React.PointerEvent) => {
    const now = Date.now();
    touchStartPos.current = { x: e.clientX, y: e.clientY, time: now };

    // Triple-tap within 550ms toggles Stage 0 Performance Telemetry Overlay
    const recentTaps = tapTimesRef.current.filter((t) => now - t < 550);
    recentTaps.push(now);
    tapTimesRef.current = recentTaps;
    if (recentTaps.length >= 3) {
      tapTimesRef.current = [];
      engineRef.current?.togglePerfOverlay();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!touchStartPos.current || stats.state !== 'RUNNING') return;
    const deltaX = e.clientX - touchStartPos.current.x;
    const deltaY = e.clientY - touchStartPos.current.y;
    const deltaTime = Date.now() - touchStartPos.current.time;
    touchStartPos.current = null;

    if (deltaTime > 450) return; // Ignore long drags
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const swipeThreshold = 22; // Low threshold for snappy mobile reaction

    if (absX > absY && absX > swipeThreshold) {
      if (deltaX > 0) engineRef.current?.switchLane(1);
      else engineRef.current?.switchLane(-1);
    } else if (absY > absX && absY > swipeThreshold) {
      if (deltaY < 0) engineRef.current?.jump();
      else engineRef.current?.slide();
    }
  };

  const toggleSound = () => {
    if (!engineRef.current) return;
    setIsMuted(!engineRef.current.sound.toggleMute());
  };

  // Weather Cycle Switcher
  const cycleWeather = () => {
    if (!engineRef.current) return;
    const weathers: WeatherType[] = ['SUNNY', 'GOLDEN', 'MONSOON', 'NIGHT'];
    const nextIdx = (weathers.indexOf(stats.weather) + 1) % weathers.length;
    const nextWeather = weathers[nextIdx];
    engineRef.current.setWeather(nextWeather);
    const labels: Record<WeatherType, string> = {
      SUNNY: '☀️ Clear Mall Road',
      GOLDEN: '🌅 Sunset Boulevard',
      MONSOON: '⛈️ Lahore Monsoon Rain',
      NIGHT: '🌙 Karachi Night Lights'
    };
    triggerToast(`Weather: ${labels[nextWeather]}`);
  };

  // Skin unlock / equip
  const selectSkin = (skin: SkinInfo) => {
    if (!engineRef.current) return;
    if (unlockedSkins.includes(skin.id)) {
      engineRef.current.setRickshawSkin(skin.id);
      triggerToast(`Equipped: ${skin.name}!`);
      return;
    }

    if (stats.totalRupees >= skin.price) {
      if (engineRef.current.spendRupees(skin.price)) {
        const updated = [...unlockedSkins, skin.id];
        setUnlockedSkins(updated);
        localStorage.setItem('rickshaw_unlocked_skins', JSON.stringify(updated));
        engineRef.current.setRickshawSkin(skin.id);
        engineRef.current.sound.playQuestComplete();
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.5 } });
        triggerToast(`🎉 Unlocked & Equipped: ${skin.name}!`);
      }
    } else {
      triggerToast(`⚠️ Need ${skin.price - stats.totalRupees} more Rupees!`);
    }
  };

  // Upgrade power-up
  const buyUpgrade = (key: keyof UpgradesState, cost: number) => {
    if (!engineRef.current) return;
    if (stats.totalRupees >= cost) {
      if (engineRef.current.spendRupees(cost)) {
        const nextLevel = (upgrades[key] || 0) + 1;
        const newUpgrades = { ...upgrades, [key]: nextLevel };
        setUpgrades(newUpgrades);
        engineRef.current.setUpgrades(newUpgrades);
        engineRef.current.sound.playQuestComplete();
        triggerToast(`⚡ Upgraded to Level ${nextLevel}!`);
      }
    } else {
      triggerToast(`⚠️ Need ${cost - stats.totalRupees} more Rupees!`);
    }
  };

  // Vehicle unlock / equip
  const selectVehicle = (veh: VehicleDef) => {
    if (!engineRef.current) return;
    if (unlockedVehicles.includes(veh.id)) {
      engineRef.current.setVehicle(veh.id);
      setSelectedVehicleState(veh.id);
      triggerToast(`Equipped: ${veh.name}!`);
      return;
    }

    if (stats.totalRupees >= veh.price) {
      if (engineRef.current.spendRupees(veh.price)) {
        unlockVehicle(veh.id);
        const updated = getUnlockedVehicles();
        setUnlockedVehicles(updated);
        engineRef.current.setVehicle(veh.id);
        setSelectedVehicleState(veh.id);
        engineRef.current.sound.playQuestComplete();
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
        triggerToast(`🎉 Unlocked & Equipped: ${veh.name}!`);
      }
    } else {
      triggerToast(`⚠️ Need ${veh.price - stats.totalRupees} more Rupees!`);
    }
  };

  // Rent / Test-Drive any locked vehicle for 50 PKR
  const rentVehicleTestDrive = (veh: VehicleDef) => {
    if (!engineRef.current) return;
    const rentPrice = 50;
    if (stats.totalRupees >= rentPrice) {
      if (engineRef.current.spendRupees(rentPrice)) {
        engineRef.current.setVehicle(veh.id);
        setSelectedVehicleState(veh.id);
        engineRef.current.sound.playPowerup();
        triggerToast(`🔑 Rented ${veh.name} for Test Drive!`);
      }
    } else {
      triggerToast(`⚠️ Need ${rentPrice - stats.totalRupees} more Rupees to Rent!`);
    }
  };

  // Unlock / Equip 3D Neon Underglow Kit
  const selectNeonKit = (neon: NeonInfo) => {
    if (!engineRef.current) return;
    const unlockedList = upgrades.unlockedNeons || ['none'];
    if (unlockedList.includes(neon.id) || neon.price === 0) {
      const newUpgrades: UpgradesState = { ...upgrades, activeNeon: neon.id, unlockedNeons: unlockedList };
      setUpgrades(newUpgrades);
      engineRef.current.setUpgrades(newUpgrades);
      engineRef.current.setNeonColor(neon.id);
      triggerToast(`✨ Equipped: ${neon.name}!`);
      return;
    }
    if (stats.totalRupees >= neon.price) {
      if (engineRef.current.spendRupees(neon.price)) {
        const nextUnlocked = [...unlockedList, neon.id];
        const newUpgrades: UpgradesState = {
          ...upgrades,
          activeNeon: neon.id,
          unlockedNeons: nextUnlocked
        };
        setUpgrades(newUpgrades);
        engineRef.current.setUpgrades(newUpgrades);
        engineRef.current.setNeonColor(neon.id);
        engineRef.current.sound.playQuestComplete();
        confetti({ particleCount: 55, spread: 70, origin: { y: 0.5 } });
        triggerToast(`🌟 Unlocked & Equipped: ${neon.name}!`);
      }
    } else {
      triggerToast(`⚠️ Need ${neon.price - stats.totalRupees} more Rupees!`);
    }
  };

  // Claim Free Daily Eidi Gift (+150 PKR) in Open Bazaar
  const claimDailyEidi = () => {
    if (!engineRef.current || dailyEidiClaimed) return;
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('rickshaw_daily_eidi_date', today);
    setDailyEidiClaimed(true);
    engineRef.current.addBankedRupees(150);
    engineRef.current.sound.playQuestComplete();
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
    triggerToast('🎁 DAILY BAZAAR EIDI CLAIMED: +150 PKR!');
  };

  // Open Shop helper (auto-pauses if called during active run)
  const openShopModal = (initialTab: 'VEHICLES' | 'SKINS' | 'UPGRADES' | 'BAZAAR' = 'VEHICLES') => {
    if (engineRef.current && stats.state === 'RUNNING') {
      engineRef.current.pause();
    }
    setGarageTab(initialTab);
    setShowGarage(true);
  };

  // Headless pattern validator runner
  const handleRunHeadlessTest = () => {
    const res = runHeadlessPatternValidation(10000);
    setHeadlessTestResult(res);
    triggerToast(`🧪 Headless Test: 10,000 Chunks Validated (${(res.passRate * 100).toFixed(1)}% Pass Rate)`);
  };

  // Claim quest reward
  const claimQuest = (questId: string) => {
    if (!engineRef.current) return;
    const quest = quests.find((q) => q.id === questId);
    if (!quest || !quest.completed || quest.claimed) return;

    engineRef.current.addBankedRupees(quest.reward);
    engineRef.current.sound.playQuestComplete();
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.4 } });
    triggerToast(`💰 Claimed +${quest.reward} Rupees!`);

    const updated = quests.map((q) => (q.id === questId ? { ...q, claimed: true } : q));
    setQuests(updated);
    localStorage.setItem('rickshaw_quests', JSON.stringify(updated));
  };

  const weatherIcons: Record<WeatherType, React.ReactNode> = {
    SUNNY: <Sun className="w-3.5 h-3.5 text-amber-400" />,
    GOLDEN: <Sunrise className="w-3.5 h-3.5 text-orange-400" />,
    MONSOON: <CloudRain className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />,
    NIGHT: <Moon className="w-3.5 h-3.5 text-indigo-300" />
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />

      {/* STAGE 0 TINY PERFORMANCE TELEMETRY OVERLAY (Toggle with Key F or Triple-Tap) */}
      {stats.showPerfOverlay && (
        <div className="absolute top-28 left-2.5 z-50 bg-stone-950/90 border border-emerald-500/70 rounded-xl px-2.5 py-2 text-[10px] font-mono text-stone-200 shadow-xl pointer-events-auto leading-tight">
          <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-1 mb-1">
            <span className="font-bold text-emerald-400">⚡ PERF [KEY F / 3-TAP]</span>
            <span
              className={`px-1.5 py-0.2 rounded font-bold ${
                stats.perfMetrics.frameTimeMs > 25
                  ? 'bg-rose-600 text-white'
                  : stats.perfMetrics.frameTimeMs > 18
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {stats.perfMetrics.fps} FPS ({stats.perfMetrics.frameTimeMs} ms)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span>Draw Calls: <strong className="text-amber-300">{stats.perfMetrics.drawCalls}</strong></span>
            <span>Triangles: <strong className="text-amber-300">{stats.perfMetrics.triangles.toLocaleString()}</strong></span>
            <span>Geometries: <strong className="text-cyan-300">{stats.perfMetrics.geometries}</strong></span>
            <span>Textures: <strong className="text-cyan-300">{stats.perfMetrics.textures}</strong></span>
            <span>
              JS Heap:{' '}
              <strong className="text-purple-300">
                {stats.perfMetrics.jsHeapMB !== null ? `${stats.perfMetrics.jsHeapMB} MB` : 'N/A'}
              </strong>
            </span>
            <span>NPCs: <strong className="text-emerald-300">{stats.perfMetrics.activeNPCs}</strong></span>
            <span>Vehicles: <strong className="text-emerald-300">{stats.perfMetrics.activeVehicles}</strong></span>
            <span>Props/Particles: <strong className="text-emerald-300">{stats.perfMetrics.activeProps}/{stats.perfMetrics.activeParticles}</strong></span>
          </div>
          {stats.perfMetrics.leakWarning && (
            <div className="mt-1 px-1.5 py-0.5 bg-rose-900/90 border border-rose-400 text-rose-200 rounded text-[9px] font-bold">
              ⚠️ GPU GEOMETRY/TEXTURE GROWTH DETECTED
            </div>
          )}
        </div>
      )}

      {/* Underpass Ambient Vignette (when driving on level 0 beneath an elevated flyover deck) */}
      {stats.inUnderpass && stats.verticalLevel === 0 && (
        <div
          className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(circle at 50% 60%, transparent 45%, rgba(2, 6, 23, 0.55) 100%)'
          }}
        />
      )}

      {/* Shield Shatter / Golden Impact Screen Flash */}
      {stats.screenFlashColor && (
        <div
          className="absolute inset-0 z-25 pointer-events-none animate-out fade-out duration-300"
          style={{ backgroundColor: stats.screenFlashColor, opacity: 0.32 }}
        />
      )}

      {/* Roadside Water Puddle Screen Splash Effect */}
      {puddleSplashActive && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center animate-in fade-in zoom-in-110 duration-200">
          <div className="w-80 h-80 rounded-full border-8 border-cyan-400/30 bg-cyan-400/10 backdrop-blur-[2px] animate-ping" />
          <div className="absolute text-cyan-200 font-arcade text-sm font-black tracking-widest drop-shadow-md">
            💦 WATER SPLASH! 💦
          </div>
        </div>
      )}

      {/* Near-Miss / Close Call Floating Combo Banner */}
      {closeCallBanner && stats.state === 'RUNNING' && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-35 pointer-events-none animate-in zoom-in-75 duration-150">
          <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-slate-950 px-5 py-1.5 rounded-full border-2 border-yellow-200 shadow-2xl font-black font-arcade text-sm sm:text-base tracking-widest flex items-center gap-2">
            <Sparkles className="w-4 h-4 fill-slate-950" />
            <span>CLOSE CALL! {closeCallBanner.phrase.toUpperCase()} (+150 PTS)</span>
            <span className="bg-slate-950 text-amber-300 text-xs px-2 py-0.5 rounded-full font-mono">
              x{closeCallBanner.combo}
            </span>
          </div>
        </div>
      )}

      {/* Top Arcade HUD (Visible during gameplay & pause) */}
      {(stats.state === 'RUNNING' || stats.state === 'PAUSED') && (
        <header className="absolute top-0 left-0 right-0 p-3 sm:p-5 flex items-start justify-between z-30 pointer-events-none">
          {/* Left: Distance & Multiplier */}
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <div className="bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-emerald-500/30 shadow-lg text-white">
              <span className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider">Distance</span>
              <div className="text-xl sm:text-3xl font-black font-arcade text-emerald-300">
                {Math.floor(stats.distance)} <span className="text-xs sm:text-sm font-sans font-bold">m</span>
              </div>
            </div>

            {/* Petrol / CNG Fuel Tank Gauge with Vintage PetrolPump SVG */}
            <div
              className={`bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border shadow-lg text-white flex items-center gap-2 transition-colors ${
                stats.isLowFuel || stats.isFuelEmpty
                  ? 'border-rose-500 bg-rose-950/85 animate-pulse'
                  : stats.fuelNoDrainTimer > 0
                  ? 'border-yellow-400 bg-amber-950/75'
                  : 'border-emerald-500/30'
              }`}
            >
              <PetrolPump
                size={22}
                colorblindMode={colorblindMode}
                className={stats.isLowFuel || stats.isFuelEmpty ? 'animate-bounce' : ''}
              />
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2 text-[9px] font-bold">
                  <span
                    className={
                      stats.isLowFuel || stats.isFuelEmpty
                        ? 'text-rose-400 font-black'
                        : stats.fuelNoDrainTimer > 0
                        ? 'text-yellow-300'
                        : 'text-emerald-400'
                    }
                  >
                    {stats.fuelNoDrainTimer > 0
                      ? `GOLDEN NO-DRAIN (${stats.fuelNoDrainTimer.toFixed(1)}s)`
                      : stats.isLowFuel
                      ? 'LOW FUEL!'
                      : 'PETROL / CNG'}
                  </span>
                  <span className="font-mono text-xs">{stats.fuel}%</span>
                </div>
                <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden mt-0.5 border border-slate-700">
                  <div
                    className={`h-full transition-all duration-200 ${
                      stats.fuelNoDrainTimer > 0
                        ? 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-200'
                        : stats.fuel < 25
                        ? 'bg-rose-500'
                        : stats.fuel < 55
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, stats.fuel))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Flyover / Surface Level Badge */}
            {stats.verticalLevel === 1 && (
              <div className="flex items-center gap-1.5 bg-amber-500/90 text-slate-950 font-black font-arcade text-[10px] px-2.5 py-1 rounded-xl shadow-md border border-yellow-200">
                <span>🛣️ ELEVATED FLYOVER DECK</span>
              </div>
            )}

            {/* Open Dhaba Chai Nitro Overdrive Meter & Trigger Button */}
            <button
              onClick={() => engineRef.current?.activateChaiNitro()}
              className={`px-3 py-1.5 rounded-2xl border shadow-lg text-left transition-all cursor-pointer active:scale-95 ${
                stats.isNitroActive
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-cyan-400 text-slate-950 border-white animate-pulse'
                  : stats.chaiNitroCharge >= 50
                  ? 'bg-slate-900/90 border-amber-400 text-amber-200 hover:bg-slate-800'
                  : 'bg-slate-900/80 border-slate-700 text-slate-300'
              }`}
              title="Honk [H] at Open Roadside Shops or Near-Miss traffic to charge Chai Nitro! Press [Shift] or [N] at 50%+ to unleash Turbo Overdrive!"
            >
              <div className="flex items-center justify-between gap-2 text-[9px] font-black font-arcade uppercase">
                <span>
                  {stats.isNitroActive
                    ? `🔥 CHAI NITRO OVERDRIVE (${stats.nitroTimer.toFixed(1)}s)`
                    : stats.chaiNitroCharge >= 50
                    ? '☕ NITRO READY! [SHIFT / N]'
                    : '🍵 DHABA CHAI NITRO'}
                </span>
                <span className="font-mono text-xs">
                  {stats.isNitroActive ? 'TURBO' : `${stats.chaiNitroCharge}%`}
                </span>
              </div>
              <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden mt-0.5 border border-slate-700">
                <div
                  className={`h-full transition-all duration-200 ${
                    stats.isNitroActive
                      ? 'bg-slate-950'
                      : stats.chaiNitroCharge >= 50
                      ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-cyan-400'
                      : 'bg-amber-500/70'
                  }`}
                  style={{
                    width: `${stats.isNitroActive ? 100 : Math.min(100, Math.max(0, stats.chaiNitroCharge))}%`
                  }}
                />
              </div>
            </button>

            {stats.scoreMultiplier > 1 && (
              <div className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-red-500 text-white font-black font-arcade text-xs px-2.5 py-1 rounded-xl shadow-md animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{stats.scoreMultiplier}X COMBO MULTIPLIER</span>
              </div>
            )}
          </div>

          {/* Center: Active Power-Up Tray (Shield, Jump Boost, & Classic Powerups) */}
          <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
            {stats.shieldActive && stats.shieldVariant && (
              <div
                className={`flex items-center gap-2 backdrop-blur-md px-3 py-1.5 rounded-2xl border shadow-xl transition-all ${
                  stats.shieldFlicker
                    ? 'border-rose-400 bg-rose-950/80 opacity-60'
                    : 'bg-slate-900/85 border-cyan-400/60 text-cyan-200'
                }`}
              >
                <RenderHudIcon
                  iconId={PICKUP_DEFINITIONS[stats.shieldVariant].hudIconId}
                  size={28}
                  colorblindMode={colorblindMode}
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-[10px] font-black font-arcade uppercase">
                    <span>{PICKUP_DEFINITIONS[stats.shieldVariant].name}</span>
                    <span className="bg-cyan-500/30 text-cyan-200 px-1.5 py-0.2 rounded-full font-mono text-[9px]">
                      {stats.shieldCharges} HIT{stats.shieldCharges > 1 ? 'S' : ''}
                    </span>
                  </div>
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5 border border-cyan-500/30">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-100"
                      style={{
                        width: `${Math.min(100, Math.max(0, (stats.shieldTimer / Math.max(1, stats.shieldMaxDuration)) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {stats.jumpBoostActive && stats.jumpVariant && (
              <div
                className={`flex items-center gap-2 backdrop-blur-md px-3 py-1.5 rounded-2xl border shadow-xl transition-all ${
                  stats.jumpFlicker
                    ? 'border-amber-400 bg-amber-950/80 opacity-60'
                    : 'bg-slate-900/85 border-emerald-400/60 text-emerald-200'
                }`}
              >
                <RenderHudIcon
                  iconId={PICKUP_DEFINITIONS[stats.jumpVariant].hudIconId}
                  size={28}
                  colorblindMode={colorblindMode}
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-[10px] font-black font-arcade uppercase">
                    <span>{PICKUP_DEFINITIONS[stats.jumpVariant].name}</span>
                    <span className="font-mono text-[9px] text-amber-300">{stats.jumpTimer.toFixed(1)}s</span>
                  </div>
                  <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5 border border-emerald-500/30">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-yellow-300 transition-all duration-100"
                      style={{
                        width: `${Math.min(100, Math.max(0, (stats.jumpTimer / Math.max(1, stats.jumpMaxDuration)) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {stats.activePowerup && (
              <div
                className={`flex flex-col items-center gap-1 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border shadow-xl transition-all ${
                  stats.powerupFlicker
                    ? 'border-red-500 bg-red-950/85 text-red-300 animate-pulse'
                    : 'bg-slate-900/85 border-purple-500/50 text-purple-200'
                }`}
              >
                <div className="flex items-center gap-2 text-[10px] font-bold font-arcade uppercase tracking-wider">
                  <span>🚀 {stats.activePowerup}</span>
                  <span className="font-mono text-[9px] text-amber-300">({stats.powerupTimer.toFixed(1)}s)</span>
                </div>
                <div className="w-24 h-1.5 bg-slate-850 rounded-full overflow-hidden border border-purple-500/40">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-amber-400 transition-all duration-100"
                    style={{ width: `${Math.min(100, Math.max(0, (stats.powerupTimer / 10.0) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: Rupees, Weather Cycle, Sound & Pause */}
          <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-2">
              {/* Session Rupees */}
              <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-yellow-500/30 shadow-lg text-white">
                <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <div className="flex flex-col items-end">
                  <span className="text-[9px] uppercase font-bold text-yellow-300/80">Rupees</span>
                  <span className="text-lg sm:text-xl font-black font-arcade text-yellow-400">{stats.coins}</span>
                </div>
              </div>

              {/* Instant Open Shop & Bazaar Button */}
              <button
                onClick={() => openShopModal('BAZAAR')}
                className="px-3 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black font-arcade text-[10px] sm:text-xs rounded-2xl border border-yellow-200 shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                title="Open 3D Garage & Street Bazaar Shop [O]"
              >
                <span>🛒</span>
                <span className="hidden sm:inline">OPEN SHOP</span>
              </button>

              {/* Weather Switcher Button */}
              <button
                onClick={cycleWeather}
                className="p-2 sm:p-2.5 bg-slate-900/85 hover:bg-slate-800 text-white rounded-2xl border border-slate-700 shadow-lg transition-transform active:scale-95"
                title="Toggle Weather Condition"
                aria-label="Cycle Weather"
              >
                {weatherIcons[stats.weather]}
              </button>

              {/* Audio Mute */}
              <button
                onClick={toggleSound}
                className="p-2 sm:p-2.5 bg-slate-900/85 hover:bg-slate-800 text-white rounded-2xl border border-slate-700 shadow-lg transition-transform active:scale-95"
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                aria-label="Toggle Sound"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              {/* Pause */}
              <button
                onClick={() => engineRef.current?.pause()}
                className="p-2 sm:p-2.5 bg-slate-900/85 hover:bg-slate-800 text-white rounded-2xl border border-slate-700 shadow-lg transition-transform active:scale-95"
                title="Pause Game"
                aria-label="Pause"
              >
                {stats.state === 'PAUSED' ? <PlayCircle className="w-4 h-4 text-amber-400" /> : <Pause className="w-4 h-4 text-slate-300" />}
              </button>
            </div>

            {/* Karachi Highway District Signboard, Speedometer & Time of Day */}
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <div className="flex items-center gap-1 bg-emerald-900/95 text-white border border-white/60 px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-wide shadow">
                <span>🛣️ {stats.currentDistrict}</span>
              </div>
              {stats.streakCount > 1 && (
                <div className="flex items-center gap-1 bg-amber-500 text-stone-950 px-2 py-0.5 rounded-lg text-[11px] font-black font-arcade animate-bounce">
                  <span>🔥 {stats.streakCount}x STREAK</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-lg text-xs font-semibold">
                <span>🌆 {stats.timeOfDay}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/70 text-slate-300 px-2 py-0.5 rounded-lg text-xs font-mono">
                <Gauge className="w-3 h-3 text-cyan-400" />
                <span>{Math.floor(stats.speed * 1.5)} km/h</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Hazard / Warning Banners & Warden Proximity Meter */}
      {stats.state === 'RUNNING' && (
        <div className="absolute top-20 sm:top-24 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none z-30 px-4">
          {/* Warden Pursuit & Strike Proximity Meter */}
          {(stats.policeDanger || stats.wardenStrikes > 0 || stats.policeDistance < 11.5) && (
            <div
              className={`flex items-center gap-2.5 px-4 py-1.5 rounded-2xl shadow-2xl border text-xs sm:text-sm font-black tracking-wide ${
                stats.wardenStrikes > 0
                  ? 'bg-rose-600/95 text-white border-yellow-300 animate-pulse'
                  : 'bg-slate-900/90 text-amber-300 border-amber-500/60'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-yellow-300 animate-bounce" />
              <div className="flex items-center gap-2">
                <span>🚨 WARDEN PROXIMITY:</span>
                <span className="font-mono text-white text-xs">{stats.policeDistance.toFixed(1)}m</span>
                {stats.wardenStrikes > 0 ? (
                  <span className="bg-slate-950 text-rose-300 px-2 py-0.5 rounded text-[10px] font-mono border border-rose-500/50">
                    STRIKE 1/2! (COLLECT COINS TO ESCAPE)
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-200/80 font-mono">
                    (RECOVERING GAP)
                  </span>
                )}
              </div>
            </div>
          )}

          {stats.electricWarning && (
            <div className="flex items-center gap-2 bg-rose-600/95 text-white px-4 py-2 rounded-2xl shadow-xl shadow-rose-900/50 border border-yellow-300 animate-pulse text-xs sm:text-sm font-black tracking-wide">
              <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              <span>⚡ DANGER: HIGH-VOLTAGE TOWER IN PATH! SWITCH LANES! ⚡</span>
            </div>
          )}

          {stats.cngFuel < 20 && (
            <div className="flex items-center gap-2 bg-amber-600/95 text-slate-950 px-4 py-1.5 rounded-2xl shadow-xl border border-yellow-200 animate-pulse text-xs sm:text-sm font-black tracking-wide">
              <Flame className="w-4 h-4 text-slate-950" />
              <span>⛽ LOW CNG GAS! PICK UP GREEN CYLINDER ON ROAD! ⛽</span>
            </div>
          )}
        </div>
      )}

      {/* Float Toast Notifications */}
      {toastMessage && (
        <div className="absolute top-36 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 animate-in fade-in zoom-in-95">
          <div className="bg-slate-950/90 text-amber-300 border-2 border-amber-400 px-5 py-2 rounded-2xl shadow-2xl font-bold font-arcade text-sm sm:text-base tracking-wider text-center">
            {toastMessage}
          </div>
        </div>
      )}

      {/* Mobile Touch Controller (Thumb controls) */}
      {stats.state === 'RUNNING' && (
        <div className="absolute bottom-4 left-0 right-0 px-4 flex items-end justify-between pointer-events-none z-20">
          {/* Left Thumb: Steering */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => engineRef.current?.switchLane(-1)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/80 active:bg-amber-500/80 border-2 border-amber-500/60 flex items-center justify-center text-white shadow-xl active:scale-90 transition-transform"
              aria-label="Steer Left"
            >
              <ArrowLeft className="w-8 h-8 text-amber-300" />
            </button>
            <button
              onClick={() => engineRef.current?.switchLane(1)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/80 active:bg-amber-500/80 border-2 border-amber-500/60 flex items-center justify-center text-white shadow-xl active:scale-90 transition-transform"
              aria-label="Steer Right"
            >
              <ArrowRight className="w-8 h-8 text-amber-300" />
            </button>
          </div>

          {/* Center Action: Horn, Chai Nitro & Shield */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => engineRef.current?.honkHorn()}
              disabled={stats.hornCooldown > 0}
              className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shadow-lg active:scale-90 transition-transform font-bold text-[10px] ${
                stats.hornCooldown > 0
                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                  : 'bg-yellow-500/90 active:bg-yellow-400 border-yellow-200 text-slate-950 cursor-pointer'
              }`}
              aria-label="Honk Horn"
            >
              <Radio className="w-5 h-5" />
              <span>{stats.hornCooldown > 0 ? `${stats.hornCooldown.toFixed(1)}s` : 'HORN'}</span>
            </button>
            <button
              onClick={() => engineRef.current?.activateChaiNitro()}
              className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shadow-lg active:scale-90 transition-transform font-bold text-[10px] ${
                stats.isNitroActive
                  ? 'bg-amber-400 text-slate-950 border-white animate-pulse'
                  : stats.chaiNitroCharge >= 50
                  ? 'bg-gradient-to-b from-amber-500 to-orange-600 text-slate-950 border-yellow-200 cursor-pointer'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700'
              }`}
              aria-label="Activate Chai Nitro"
            >
              <Flame className="w-5 h-5" />
              <span>{stats.chaiNitroCharge}%</span>
            </button>
            <button
              onClick={() => engineRef.current?.activateShield()}
              className="w-12 h-12 rounded-xl bg-cyan-600/80 active:bg-cyan-500 border border-cyan-300 flex flex-col items-center justify-center text-white shadow-lg active:scale-90 transition-transform font-bold text-[10px]"
              aria-label="Activate Shield"
            >
              <Shield className="w-5 h-5 text-cyan-200" />
              <span>SHIELD</span>
            </button>
          </div>

          {/* Right Thumb: Jump & Slide */}
          <div className="flex flex-col gap-2 pointer-events-auto">
            <button
              onClick={() => engineRef.current?.jump()}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-600/85 active:bg-emerald-500 border-2 border-emerald-300 flex items-center justify-center text-white shadow-xl active:scale-90 transition-transform"
              aria-label="Jump"
            >
              <ArrowUp className="w-8 h-8 text-emerald-100" />
            </button>
            <button
              onClick={() => engineRef.current?.slide()}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-orange-600/85 active:bg-orange-500 border-2 border-orange-300 flex items-center justify-center text-white shadow-xl active:scale-90 transition-transform"
              aria-label="Slide / Duck"
            >
              <ArrowDown className="w-8 h-8 text-orange-100" />
            </button>
          </div>
        </div>
      )}

      {/* START SCREEN MODAL — Grounded Karachi Saddar & M.A. Jinnah Road Street Signboard Vibe */}
      {stats.state === 'START' && !showGarage && !showQuests && !stats.isShowroomMode && !stats.isNPCGalleryOpen && !stats.isShopGalleryOpen && !stats.isBuildingGalleryOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-sm">
          <div className="relative max-w-lg w-full bg-stone-900 p-6 sm:p-8 rounded-2xl border-4 border-amber-600/90 shadow-2xl text-center flex flex-col items-center">
            {/* Karachi Highway Milestone / Route W-11 Header */}
            <div className="inline-block bg-amber-500 text-stone-950 font-arcade font-black text-xs sm:text-sm px-4 py-1 rounded border-2 border-stone-950 shadow tracking-wider uppercase mb-3">
              🇵🇰 KARACHI SADDAR • BURNS ROAD • M.A. JINNAH RD
            </div>

            <h1 className="text-3xl sm:text-5xl font-black font-arcade text-amber-400 drop-shadow tracking-wider mb-1">
              RICKSHAW SURFERS
            </h1>

            <p className="text-stone-300 font-semibold text-xs sm:text-sm mb-4">
              Empress Market, Quetta Chai Dhabas & Gadha Gari Rush
            </p>

            {/* Wallet & High Score Bar (Sandstone & Charcoal Street Ledger) */}
            <div className="grid grid-cols-2 gap-3 w-full mb-5">
              <div className="flex items-center justify-center gap-2 bg-stone-800 px-3 py-2 rounded-xl border border-amber-600/50 text-amber-300 text-xs font-mono">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>MILESTONE:</span>
                <strong className="text-amber-400 font-arcade text-sm">{stats.bestScore} m</strong>
              </div>
              <div className="flex items-center justify-center gap-2 bg-stone-800 px-3 py-2 rounded-xl border border-emerald-600/50 text-emerald-300 text-xs font-mono">
                <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span>GALLA (CASH):</span>
                <strong className="text-yellow-400 font-arcade text-sm">{stats.totalRupees} PKR</strong>
              </div>
            </div>

            {/* Main Action Start Button */}
            <button
              onClick={() => engineRef.current?.start()}
              className="w-full py-4 px-6 bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-black font-arcade text-xl sm:text-2xl rounded-xl shadow-lg flex items-center justify-center gap-3 transition-transform cursor-pointer border-2 border-stone-950 mb-4"
            >
              <Play className="w-7 h-7 fill-stone-950" />
              <span>START SADDAR RUN!</span>
            </button>

            {/* Garage & Quests Action Buttons */}
            <div className="grid grid-cols-2 gap-3 w-full mb-4">
              <button
                onClick={() => setShowGarage(true)}
                className="py-2.5 px-4 bg-emerald-800 hover:bg-emerald-700 text-amber-100 font-bold rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm shadow border border-emerald-500/50 cursor-pointer active:scale-95 transition-transform"
              >
                <Palette className="w-4 h-4 text-amber-300" />
                <span>USTAD GARAGE & BAZAAR</span>
              </button>

              <button
                onClick={() => setShowQuests(true)}
                className="py-2.5 px-4 bg-stone-800 hover:bg-stone-700 text-amber-300 font-black rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm shadow border border-amber-500/50 cursor-pointer active:scale-95 transition-transform"
              >
                <Award className="w-4 h-4 text-amber-400" />
                <span>DAILY ROUTE TASKS</span>
              </button>
            </div>

            {/* Helper controls row */}
            <div className="flex flex-wrap items-center justify-between gap-2 w-full pt-3 border-t border-stone-700 text-xs text-stone-300 font-medium">
              <button
                onClick={() => setShowHowToPlay(true)}
                className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>Controls</span>
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => engineRef.current?.toggleBuildingGallery()}
                  className="px-2.5 py-1 bg-cyan-900/90 rounded-lg border border-cyan-400/70 text-cyan-200 text-xs flex items-center gap-1 hover:bg-cyan-800 cursor-pointer font-bold"
                  title="Preview all 12 Pakistani Skyline & Set-Piece Buildings in 3D (Key B)"
                >
                  <span>🏙️ Buildings [B]</span>
                </button>
                <button
                  onClick={() => engineRef.current?.toggleShopGallery()}
                  className="px-2.5 py-1 bg-emerald-900/90 rounded-lg border border-emerald-400/70 text-emerald-200 text-xs flex items-center gap-1 hover:bg-emerald-800 cursor-pointer font-bold"
                  title="Preview all 12 Pakistani Bazaar Shop Buildings side-by-side in 3D (Key H)"
                >
                  <span>🏪 Shops [H]</span>
                </button>
                <button
                  onClick={() => engineRef.current?.toggleNPCGallery()}
                  className="px-2.5 py-1 bg-amber-900/90 rounded-lg border border-amber-400/70 text-amber-200 text-xs flex items-center gap-1 hover:bg-amber-800 cursor-pointer font-bold"
                  title="Preview all 15 Karachi Procedural NPCs & Animals rotating in 3D (Key G)"
                >
                  <span>👥 NPCs [G]</span>
                </button>
                <button
                  onClick={cycleWeather}
                  className="px-2.5 py-1 bg-stone-800 rounded-lg border border-stone-700 text-xs flex items-center gap-1.5 hover:bg-stone-700 cursor-pointer"
                >
                  {weatherIcons[stats.weather]}
                  <span className="capitalize">{stats.weather.toLowerCase()}</span>
                </button>
                <button
                  onClick={toggleSound}
                  className="px-2.5 py-1 bg-stone-800 rounded-lg border border-stone-700 text-xs flex items-center gap-1 hover:bg-stone-700 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3D KARACHI STREET NPC GALLERY OVERLAY (Key G) */}
      {stats.isNPCGalleryOpen && (
        <div className="absolute inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
          <div className="max-w-4xl w-full bg-stone-900/95 border-2 border-amber-500 rounded-2xl p-4 text-stone-100 shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-stone-700">
              <div>
                <h3 className="text-sm sm:text-base font-black font-arcade text-amber-400">
                  🇵🇰 KARACHI LIVING STREET 3D NPC GALLERY (15 PROCEDURAL CHARACTERS & ANIMALS)
                </h3>
                <p className="text-[11px] text-stone-300">
                  Built 100% from Three.js primitives (Box, Cylinder, Sphere, Cone) with flat-shaded materials & pivot animations.
                </p>
              </div>
              <button
                onClick={() => engineRef.current?.setNPCGalleryMode(false)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs rounded-xl cursor-pointer"
              >
                Exit Gallery [G] ✕
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-[10px] font-mono">
              {[
                '1. Man (Shalwar Kameez)',
                '2. Man (Shirt/Pants)',
                '3. Woman (Dupatta)',
                '4. Woman (Black Abaya)',
                '5. School Kid (Uniform)',
                '6. Quetta Chai Wala',
                '7. Fruit Thela Seller',
                '8. Traffic Police (Stop)',
                '9. Bike / Rickshaw Rider',
                '10. Laborer (Mazdoor)',
                '11. Stray Dog (Tail Wag)',
                '12. Stray Street Cat',
                '13. Sahiwal Cow / Goat',
                '14. Donkey Cart (Gadha)',
                '15. Crows & Pigeons Flock'
              ].map((label, i) => (
                <div
                  key={label}
                  className={`px-2 py-1 rounded border ${
                    i < 5
                      ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-200'
                      : i < 10
                      ? 'bg-amber-950/70 border-amber-600/50 text-amber-200'
                      : 'bg-stone-800 border-stone-600 text-stone-200'
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3D PAKISTANI BAZAAR SHOP GALLERY OVERLAY (Key H) */}
      {stats.isShopGalleryOpen && (
        <div className="absolute inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
          <div className="max-w-4xl w-full bg-stone-900/95 border-2 border-emerald-500 rounded-2xl p-4 text-stone-100 shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-stone-700">
              <div>
                <h3 className="text-sm sm:text-base font-black font-arcade text-emerald-400">
                  🏪 PAKISTANI BAZAAR 3D SHOP GALLERY (12 HAND-PAINTED SHOP BUILDINGS)
                </h3>
                <p className="text-[11px] text-stone-300">
                  Recessed 3D interiors, rolling steel shutters, striped awnings, Urdu/English CanvasTexture signboards & 1–3 story upper floors.
                </p>
              </div>
              <button
                onClick={() => engineRef.current?.setShopGalleryMode(false)}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs rounded-xl cursor-pointer"
              >
                Exit Shop Gallery [H] ✕
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
              {[
                '1. Al-Falah Mobile Shop',
                '2. Bismillah Hotel & Dhaba',
                '3. Lahore Bakery & Sweets',
                '4. Chaudhry Fruit & Sabzi',
                '5. Madina Medical Store',
                '6. Haji Cloth House',
                '7. Gulzar Tailors (Darzi)',
                '8. Ustad Tyre & Puncture',
                '9. Shan General Store',
                '10. Super Cool Juice Corner',
                '11.VIP Hair Salon (Barber)',
                '12. Pak Hardware & Paint'
              ].map((label, i) => (
                <div
                  key={label}
                  className={`px-2 py-1 rounded border ${
                    i < 6
                      ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-200'
                      : 'bg-amber-950/70 border-amber-600/50 text-amber-200'
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3D PAKISTANI SKYLINE BUILDING GALLERY OVERLAY (Key B — Stages 1–4) */}
      {stats.isBuildingGalleryOpen && (
        <div className="absolute inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none">
          <div className="max-w-5xl w-full bg-stone-900/95 border-2 border-cyan-500 rounded-2xl p-4 text-stone-100 shadow-2xl pointer-events-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-stone-700">
              <div>
                <h3 className="text-sm sm:text-base font-black font-arcade text-cyan-400">
                  🏙️ PAKISTANI SKYLINE 3D BUILDING GALLERY [KEY B] — 12 SKYLINE & SET-PIECE BUILDINGS
                </h3>
                <p className="text-[11px] text-stone-300">
                  InstancedMesh windows/balconies/ACs, rooftop clutter (water tanks, solar panels, kites), blinking wedding LEDs, tower cranes & 40% night lit windows.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 0, label: 'All 12 [0]' },
                  { id: 1, label: 'Stage 1: Apt/Colonial/Plaza [1]' },
                  { id: 2, label: 'Stage 2: Mosque/Hosp/School/Bank [2]' },
                  { id: 3, label: 'Stage 3: Shadi/Const/CNG/Gates [3]' }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => engineRef.current?.setBuildingGalleryStage(st.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer border ${
                      stats.buildingGalleryStage === st.id
                        ? 'bg-cyan-500 text-stone-950 border-white'
                        : 'bg-stone-800 text-stone-200 border-stone-600 hover:bg-stone-700'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
                <button
                  onClick={cycleWeather}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-black text-[10px] rounded-lg cursor-pointer"
                  title="Stage 4: Toggle Day / Night Lighting & Lit Windows"
                >
                  🌓 Stage 4 Lighting ({stats.weather})
                </button>
                <button
                  onClick={() => engineRef.current?.setBuildingGalleryMode(false)}
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-black text-xs rounded-xl cursor-pointer"
                >
                  Exit [B] ✕
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
              {[
                '1. Residential Apartment (4–6F)',
                '2. Old Colonial Heritage (Clock)',
                '3. Shopping Plaza (LED + Ramp)',
                '4. Jamia Mosque (Dome + Minarets)',
                '5. General Hospital (Amb. Bay)',
                '6. School / College (Playground)',
                '7. Bank / Office Tower (8–12F)',
                '8. Wedding Shadi Hall (Blinking LED)',
                '9. Under-Construction (Tower Crane)',
                '10. Petrol & CNG Station (Queue)',
                '11. Old-City Gate (Darwaza)',
                '12. Badshahi Fort Monument'
              ].map((label, i) => (
                <div
                  key={label}
                  className={`px-2 py-1 rounded border ${
                    i < 3
                      ? 'bg-cyan-950/70 border-cyan-600/50 text-cyan-200'
                      : i < 7
                      ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-200'
                      : 'bg-amber-950/70 border-amber-600/50 text-amber-200'
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GARAGE & SHOP 3D SHOWROOM MODAL */}
      {showGarage && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-2xl w-full bg-slate-900/95 border-2 border-amber-400/80 rounded-3xl p-6 text-white shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Car className="w-6 h-6 text-amber-400" />
                <h3 className="text-xl sm:text-2xl font-black font-arcade text-amber-400">
                  3D VEHICLE GARAGE & SHOWROOM
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-xl text-yellow-400 font-mono text-sm font-bold border border-yellow-500/30">
                  <Coins className="w-4 h-4 fill-yellow-400" />
                  <span>{stats.totalRupees} PKR</span>
                </div>
                <button
                  onClick={() => setShowGarage(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <button
                onClick={() => setGarageTab('VEHICLES')}
                className={`py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                  garageTab === 'VEHICLES'
                    ? 'bg-amber-500 text-slate-950 font-arcade'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🏎️ VEHICLES
              </button>
              <button
                onClick={() => setGarageTab('SKINS')}
                className={`py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                  garageTab === 'SKINS'
                    ? 'bg-amber-500 text-slate-950 font-arcade'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🎨 SKINS & NEON
              </button>
              <button
                onClick={() => setGarageTab('UPGRADES')}
                className={`py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                  garageTab === 'UPGRADES'
                    ? 'bg-amber-500 text-slate-950 font-arcade'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ⚡ UPGRADES
              </button>
              <button
                onClick={() => setGarageTab('BAZAAR')}
                className={`py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                  garageTab === 'BAZAAR'
                    ? 'bg-emerald-400 text-slate-950 font-arcade'
                    : 'bg-slate-800 text-emerald-300 hover:bg-slate-700 border border-emerald-500/30'
                }`}
              >
                🍵 OPEN BAZAAR
              </button>
            </div>

            {/* Tab 0: Playable Vehicles */}
            {garageTab === 'VEHICLES' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.values(PLAYABLE_VEHICLES).map((veh) => {
                  const isUnlocked = unlockedVehicles.includes(veh.id);
                  const isEquipped = selectedVehicle === veh.id;

                  return (
                    <div
                      key={veh.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isEquipped
                          ? 'border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10'
                          : 'border-slate-800 bg-slate-850/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-arcade font-black text-sm text-amber-300">{veh.name}</span>
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-emerald-300 font-medium">
                          {veh.tagline}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{veh.abilityDescription}</p>

                      {/* Hero Stat Matrix */}
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-3 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Speed:</span>
                          <span className="font-mono text-amber-400 font-bold">
                            {'★'.repeat(veh.stats.speed)}{'☆'.repeat(5 - veh.stats.speed)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Agility:</span>
                          <span className="font-mono text-cyan-400 font-bold">
                            {'★'.repeat(veh.stats.agility)}{'☆'.repeat(5 - veh.stats.agility)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Jump:</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {'★'.repeat(veh.stats.jump)}{'☆'.repeat(5 - veh.stats.jump)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Armor:</span>
                          <span className="font-mono text-purple-400 font-bold">
                            {'★'.repeat(veh.stats.armor)}{'☆'.repeat(5 - veh.stats.armor)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => selectVehicle(veh)}
                          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform ${
                            isEquipped
                              ? 'bg-emerald-600 text-white cursor-default'
                              : isUnlocked
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                              : stats.totalRupees >= veh.price
                              ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 hover:brightness-110'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {isEquipped ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>EQUIPPED</span>
                            </>
                          ) : isUnlocked ? (
                            <span>DRIVE VEHICLE</span>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>UNLOCK ({veh.price} PKR)</span>
                            </>
                          )}
                        </button>
                        {!isUnlocked && !isEquipped && (
                          <button
                            onClick={() => rentVehicleTestDrive(veh)}
                            className="py-2 px-2.5 rounded-xl font-bold text-[11px] bg-cyan-600/80 hover:bg-cyan-500 text-white border border-cyan-400/50 cursor-pointer active:scale-95 transition-transform"
                            title="Rent this vehicle for a Test Drive (50 PKR)"
                          >
                            🔑 RENT (50)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 1: Skins & 3D Neon Underglow */}
            {garageTab === 'SKINS' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-black font-arcade text-amber-300 uppercase tracking-wider mb-2">
                    🛺 PAKISTANI TRUCK-ART CHASSIS SKINS (6 REGIONAL STYLES)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SKINS_DEF.map((skin) => {
                      const isUnlocked = unlockedSkins.includes(skin.id);
                      const isEquipped = stats.currentSkin === skin.id;

                      return (
                        <div
                          key={skin.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isEquipped
                              ? 'border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10'
                              : 'border-slate-800 bg-slate-850/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-arcade font-black text-sm text-amber-300">{skin.name}</span>
                            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300 font-medium">
                              {skin.city}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 mb-4 h-10">{skin.description}</p>

                          <button
                            onClick={() => selectSkin(skin)}
                            className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform ${
                              isEquipped
                                ? 'bg-emerald-600 text-white cursor-default'
                                : isUnlocked
                                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                : stats.totalRupees >= skin.price
                                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 hover:brightness-110'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {isEquipped ? (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>EQUIPPED</span>
                              </>
                            ) : isUnlocked ? (
                              <span>SELECT & EQUIP</span>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>UNLOCK ({skin.price} PKR)</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3D Neon Underglow Kits */}
                <div className="pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-black font-arcade text-cyan-300 uppercase tracking-wider mb-2">
                    ✨ 3D NEON CHASSIS UNDERGLOW KITS
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {NEONS_DEF.map((neon) => {
                      const unlockedList = upgrades.unlockedNeons || ['none'];
                      const isUnlocked = unlockedList.includes(neon.id) || neon.price === 0;
                      const isEquipped = (upgrades.activeNeon || 'none') === neon.id;
                      return (
                        <div
                          key={neon.id}
                          className={`p-3 rounded-2xl border flex items-center justify-between ${
                            isEquipped
                              ? 'border-cyan-400 bg-cyan-500/15'
                              : 'border-slate-800 bg-slate-850/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-5 h-5 rounded-full border border-white/40 shadow-md"
                              style={{ backgroundColor: neon.hex, boxShadow: `0 0 10px ${neon.hex}` }}
                            />
                            <span className="text-xs font-bold text-slate-200">{neon.name}</span>
                          </div>
                          <button
                            onClick={() => selectNeonKit(neon)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] cursor-pointer active:scale-95 ${
                              isEquipped
                                ? 'bg-emerald-600 text-white'
                                : isUnlocked
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-amber-500 text-slate-950'
                            }`}
                          >
                            {isEquipped ? 'ACTIVE' : isUnlocked ? 'EQUIP' : `${neon.price} PKR`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Upgrades */}
            {garageTab === 'UPGRADES' && (
              <div className="space-y-3">
                {/* Magnet Upgrade */}
                <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold text-rose-400 font-arcade">🧲 Rupee Magnet</span>
                      <span className="text-xs text-slate-400">Level {upgrades.magnetLevel} / 5</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Duration: {8.0 + (upgrades.magnetLevel - 1) * 2.5}s (+2.5s per level)
                    </p>
                  </div>
                  {upgrades.magnetLevel < 5 ? (
                    <button
                      onClick={() => buyUpgrade('magnetLevel', upgrades.magnetLevel * 150)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      UPGRADE ({upgrades.magnetLevel * 150} PKR)
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-bold">MAXED OUT</span>
                  )}
                </div>

                {/* Jetpack Upgrade */}
                <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold text-cyan-400 font-arcade">🚀 Rocket Jetpack</span>
                      <span className="text-xs text-slate-400">Level {upgrades.jetpackLevel} / 5</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Duration: {8.0 + (upgrades.jetpackLevel - 1) * 2.0}s (+2.0s per level)
                    </p>
                  </div>
                  {upgrades.jetpackLevel < 5 ? (
                    <button
                      onClick={() => buyUpgrade('jetpackLevel', upgrades.jetpackLevel * 200)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      UPGRADE ({upgrades.jetpackLevel * 200} PKR)
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-bold">MAXED OUT</span>
                  )}
                </div>

                {/* Hydraulic Jump Suspension */}
                <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold text-amber-400 font-arcade">⚡ Hydraulic Jump Suspension</span>
                      <span className="text-xs text-slate-400">Level {upgrades.hydraulicLevel || 1} / 5</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Pneumatic Leap: +{((upgrades.hydraulicLevel || 1) - 1) * 12}% height & cushioned landing
                    </p>
                  </div>
                  {(upgrades.hydraulicLevel || 1) < 5 ? (
                    <button
                      onClick={() => buyUpgrade('hydraulicLevel', (upgrades.hydraulicLevel || 1) * 175)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      UPGRADE ({((upgrades.hydraulicLevel || 1)) * 175} PKR)
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-bold">MAXED OUT</span>
                  )}
                </div>

                {/* CNG / Petrol Carburetor Fuel Efficiency */}
                <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold text-yellow-300 font-arcade">⛽ CNG & Petrol Fuel Efficiency</span>
                      <span className="text-xs text-slate-400">Level {upgrades.fuelEfficiencyLevel || 1} / 5</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Tuned Eco-Carburetor: -{((upgrades.fuelEfficiencyLevel || 1) - 1) * 8}% fuel drain per meter
                    </p>
                  </div>
                  {(upgrades.fuelEfficiencyLevel || 1) < 5 ? (
                    <button
                      onClick={() => buyUpgrade('fuelEfficiencyLevel', (upgrades.fuelEfficiencyLevel || 1) * 160)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      UPGRADE ({(upgrades.fuelEfficiencyLevel || 1) * 160} PKR)
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-bold">MAXED OUT</span>
                  )}
                </div>

                {/* Starter Shield Armor */}
                <div className="p-4 rounded-2xl bg-slate-850/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold text-emerald-400 font-arcade">🛡️ Starter Shield</span>
                      <span className="text-xs text-slate-400">Level {upgrades.starterShield} / 2</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Start every race with an active Truck Art protective shield bubble (Lv 2 = Double-Hit)!
                    </p>
                  </div>
                  {upgrades.starterShield < 2 ? (
                    <button
                      onClick={() => buyUpgrade('starterShield', (upgrades.starterShield + 1) * 300)}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      UPGRADE ({(upgrades.starterShield + 1) * 300} PKR)
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-400 font-bold">MAXED OUT</span>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Open Street Bazaar & Dhaba Shop */}
            {garageTab === 'BAZAAR' && (
              <div className="space-y-3">
                {/* Free Daily Bazaar Eidi Gift */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 border-2 border-amber-400/70 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-black text-amber-300 font-arcade">🎁 OPEN BAZAAR DAILY EIDI GIFT</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full font-bold">
                        FREE REWARD
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Complimentary Mall Road Shopkeeper Eidi bonus (+150 PKR) to spend on boosters or vehicles!
                    </p>
                  </div>
                  <button
                    onClick={claimDailyEidi}
                    disabled={dailyEidiClaimed}
                    className={`px-4 py-2 rounded-xl font-black text-xs cursor-pointer active:scale-95 ${
                      dailyEidiClaimed
                        ? 'bg-slate-800 text-slate-500 cursor-default'
                        : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-lg animate-pulse'
                    }`}
                  >
                    {dailyEidiClaimed ? 'CLAIMED TODAY ✓' : 'CLAIM +150 PKR'}
                  </button>
                </div>

                {/* Booster 1: Karak Chai Nitro Headstart */}
                <div className="p-4 rounded-2xl bg-slate-850/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold text-amber-400 font-arcade">☕ Karak Chai Turbo Headstart</span>
                      <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                        Owned: {upgrades.chaiHeadstartCount || 0}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Auto-activates 6.5s of Chai Nitro Overdrive at the start of your run (1.38x speed & obstacle smash)!
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {stats.state === 'PAUSED' && (
                      <button
                        onClick={() => {
                          if (!engineRef.current) return;
                          if (stats.totalRupees >= 100 && engineRef.current.spendRupees(100)) {
                            setShowGarage(false);
                            engineRef.current.pause();
                            engineRef.current.activateChaiNitro(true);
                          } else {
                            triggerToast('⚠️ Need 100 PKR for Instant Karak Chai Nitro!');
                          }
                        }}
                        className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                      >
                        DRINK NOW (100)
                      </button>
                    )}
                    <button
                      onClick={() => buyUpgrade('chaiHeadstartCount', 100)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      BUY (100 PKR)
                    </button>
                  </div>
                </div>

                {/* Booster 2: Emergency Reserve Petrol Can */}
                <div className="p-4 rounded-2xl bg-slate-850/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold text-emerald-400 font-arcade">⛽ Reserve Petrol Jerrycan</span>
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                        Owned: {upgrades.reserveFuelCount || 0}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Automatically refills +65% Petrol/CNG the moment your tank hits 0% so you never stall!
                    </p>
                  </div>
                  <button
                    onClick={() => buyUpgrade('reserveFuelCount', 150)}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    BUY (150 PKR)
                  </button>
                </div>

                {/* Booster 3: VIP Warden Pass / Challan Forgiveness */}
                <div className="p-4 rounded-2xl bg-slate-850/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold text-purple-400 font-arcade">👮 VIP Warden Challan Pass</span>
                      <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-mono">
                        Owned: {upgrades.wardenBribeCount || 0}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Automatically excuses 1 fatal crash or police interception, destroying the obstacle and continuing your run!
                    </p>
                  </div>
                  <button
                    onClick={() => buyUpgrade('wardenBribeCount', 220)}
                    className="px-3.5 py-2 bg-purple-500 hover:bg-purple-400 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    BUY (220 PKR)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DAILY QUESTS & MISSIONS MODAL */}
      {showQuests && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-lg w-full bg-slate-900 border-2 border-yellow-400/80 rounded-3xl p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-black font-arcade text-yellow-400">
                  MALL ROAD MISSIONS
                </h3>
              </div>
              <button
                onClick={() => setShowQuests(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3">
              {quests.map((q) => {
                const percent = Math.min(100, Math.floor((q.current / q.target) * 100));

                return (
                  <div key={q.id} className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-750">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs sm:text-sm text-slate-200">{q.title}</span>
                      <span className="text-xs font-mono text-yellow-400 font-bold">+{q.reward} PKR</span>
                    </div>

                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-2 border border-slate-700">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {q.current} / {q.target} ({percent}%)
                      </span>

                      {q.claimed ? (
                        <span className="text-emerald-400 font-bold">CLAIMED ✓</span>
                      ) : q.completed ? (
                        <button
                          onClick={() => claimQuest(q.id)}
                          className="px-3 py-1 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black rounded-lg cursor-pointer animate-bounce"
                        >
                          CLAIM REWARD
                        </button>
                      ) : (
                        <span className="text-slate-500">IN PROGRESS</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CINEMATIC POLICE CRASH & ARREST CUTSCENE OVERLAY (Unobstructed 3D View for ~3.4s before Game Over Modal) */}
      {stats.state === 'GAMEOVER' && stats.arrestPhase !== 'COMPLETE' && stats.arrestPhase !== 'NONE' && (
        <div className="absolute inset-0 z-40 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
          {/* Top Police Siren Letterbox Banner */}
          <div className="w-full max-w-lg mx-auto bg-slate-950/85 backdrop-blur-md border-2 border-rose-500 rounded-2xl px-5 py-3 shadow-2xl flex items-center justify-between animate-in slide-in-from-top duration-300 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
              <div>
                <div className="text-xs sm:text-sm font-black font-arcade tracking-widest text-rose-400">
                  🚨 LAHORE HIGHWAY PATROL — INTERCEPTED! 🚨
                </div>
                <div className="text-[11px] sm:text-xs text-slate-300 font-semibold">
                  {stats.arrestPhase === 'OFFICER_APPROACH'
                    ? 'Traffic Warden stepping out to issue Challan...'
                    : 'Patrol units skidding in beside your crashed vehicle...'}
                </div>
              </div>
            </div>
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500 animate-ping" />
          </div>

          {/* Bottom Officer Comic Challan Dialogue Bubble & Skip Button */}
          <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-3 mb-4 animate-in slide-in-from-bottom duration-300 pointer-events-auto">
            <div className="w-full bg-slate-900/90 backdrop-blur-md border-2 border-amber-400 rounded-2xl p-4 shadow-2xl text-center">
              <div className="text-[10px] uppercase tracking-widest font-bold text-amber-400 mb-1">
                {stats.arrestPhase === 'OFFICER_APPROACH' ? '👮 TRAFFIC WARDEN SAYS:' : '💥 CRASH REPORT:'}
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                "{stats.comicDialogue || stats.crashReason || 'Oye, ruk ja! Challan katega!'}"
              </div>
            </div>

            <button
              onClick={() => engineRef.current?.skipArrestCutscene()}
              className="px-4 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-full border border-slate-700 shadow-lg cursor-pointer transition-colors"
            >
              Skip Cutscene [Space] ⏭️
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN MODAL (Appears after Police Arrest Cutscene finishes) */}
      {stats.state === 'GAMEOVER' && (stats.arrestPhase === 'COMPLETE' || stats.arrestPhase === 'NONE') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative max-w-md w-full bg-slate-900 p-6 sm:p-8 rounded-3xl border-4 border-rose-500 shadow-2xl text-center flex flex-col items-center">
            {/* Crash Header */}
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-500 mb-3 animate-pulse">
              <Flame className="w-9 h-9" />
            </div>

            <h2 className="text-3xl font-black font-arcade text-rose-500 tracking-wider mb-1">
              CHALAN HO GAYA!
            </h2>
            <p className="text-sm font-semibold text-rose-200 mb-4">
              {stats.crashReason || 'You got caught in Lahore traffic!'}
            </p>

            {/* Score Summary Grid */}
            <div className="grid grid-cols-2 gap-3 w-full my-4">
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Distance Run</span>
                <span className="text-2xl font-black font-arcade text-amber-400">
                  {Math.floor(stats.distance)} m
                </span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Rupees Earned</span>
                <span className="text-2xl font-black font-arcade text-yellow-400">
                  +{stats.coins}
                </span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Near-Misses</span>
                <span className="text-xl font-bold font-mono text-cyan-300">
                  {stats.closeCalls}
                </span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-amber-500/40 flex flex-col items-center">
                <span className="text-[10px] text-amber-300/80 uppercase font-bold">Total Wallet</span>
                <span className="text-xl font-black font-arcade text-yellow-300">
                  {stats.totalRupees} PKR
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 w-full mt-2">
              <button
                onClick={() => engineRef.current?.restart()}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-amber-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-95 text-slate-950 font-black font-arcade text-xl rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-transform cursor-pointer border-2 border-yellow-200"
              >
                <RotateCcw className="w-6 h-6 fill-slate-950" />
                <span>PLAY AGAIN</span>
              </button>

              <button
                onClick={() => setShowGarage(true)}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-amber-300 font-bold rounded-xl flex items-center justify-center gap-2 text-xs border border-slate-700 cursor-pointer"
              >
                <Palette className="w-4 h-4" />
                <span>VISIT GARAGE & SHOP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOW TO PLAY & CONTROLS MODAL */}
      {showHowToPlay && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative max-w-md w-full bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 text-white shadow-2xl">
            <button
              onClick={() => setShowHowToPlay(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="Close Guide"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-xl font-black font-arcade text-amber-400 mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              HOW TO PLAY
            </h3>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300">
              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl">
                <span className="text-lg">⌨️</span>
                <div>
                  <strong className="text-white block font-semibold">Desktop Keyboard Controls</strong>
                  <span>Arrow Keys / WASD to Steer, Jump & Duck. Press H for Horn, E for Shield.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl">
                <span className="text-lg">📱</span>
                <div>
                  <strong className="text-white block font-semibold">Mobile & Tablet Swipes</strong>
                  <span>Swipe Left / Right to change lanes, Swipe Up to jump, Swipe Down to duck.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl">
                <span className="text-lg">⚡</span>
                <div>
                  <strong className="text-white block font-semibold">Transmission Pylons</strong>
                  <span>High-voltage towers always block the center lane! Weave to left or right!</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl">
                <span className="text-lg">🚛</span>
                <div>
                  <strong className="text-white block font-semibold">Bedford Rocket Trucks & Cows</strong>
                  <span>Watch out for decorated heavy trucks and resting Sahiwal cows on the road!</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl">
                <span className="text-lg">⛽</span>
                <div>
                  <strong className="text-white block font-semibold">Green CNG Cylinders</strong>
                  <span>Keep your tank full! Pick up green cylinders to refill CNG gas and trigger turbo bursts!</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl">
                <span className="text-lg">⛈️</span>
                <div>
                  <strong className="text-white block font-semibold">Monsoon Weather</strong>
                  <span>Experience rain storms, wet road sprays, lightning flashes, and puddle splashes!</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHowToPlay(false)}
              className="w-full mt-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer"
            >
              GOT IT!
            </button>
          </div>
        </div>
      )}

      {/* DEVELOPER DEBUG OVERLAY (` / F2) */}
      {showDebug && (
        <div className="absolute bottom-4 left-4 z-50 max-w-md w-full bg-slate-950/92 backdrop-blur-md border-2 border-emerald-500/80 rounded-2xl p-4 text-white shadow-2xl font-mono text-xs pointer-events-auto">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Terminal className="w-4 h-4" />
              <span>DEBUG TELEMETRY & FLYOVER INSPECTOR (` / F2)</span>
            </div>
            <button
              onClick={() => setShowDebug(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
              aria-label="Close Debug Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Live Height & Flyover Telemetry */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 mb-3 text-[11px]">
            <div>
              <span className="text-slate-400">FPS: </span>
              <span className="text-emerald-300 font-bold">{stats.fps}</span>
            </div>
            <div>
              <span className="text-slate-400">Level: </span>
              <span className={stats.verticalLevel === 1 ? 'text-amber-300 font-bold' : 'text-cyan-300'}>
                {stats.verticalLevel === 1 ? '1 (FLYOVER DECK)' : '0 (GROUND)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">playerY: </span>
              <span className="text-yellow-300 font-bold">{stats.playerY.toFixed(2)}m</span>
            </div>
            <div>
              <span className="text-slate-400">surfaceY: </span>
              <span className="text-emerald-300 font-bold">{stats.surfaceY.toFixed(2)}m</span>
            </div>
            <div>
              <span className="text-slate-400">rampProgress: </span>
              <span className="text-amber-300 font-bold">{(stats.rampProgress * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-slate-400">inUnderpass: </span>
              <span className="text-purple-300 font-bold">{stats.inUnderpass ? 'YES' : 'NO'}</span>
            </div>
            <div>
              <span className="text-slate-400">Unpatched Meshes: </span>
              <span className={stats.unpatchedCount === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {stats.unpatchedCount}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Police State: </span>
              <span className="text-amber-300 font-bold">
                {stats.policeState} ({stats.policeGap.toFixed(1)}m)
              </span>
            </div>
          </div>

          {/* Hotkey Toggles (B, Shift+B, H, C, L, K, G, F + Colorblind) */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <button
              onClick={() => engineRef.current?.toggleBoundingBoxDebug()}
              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                stats.debugBoundingBoxes
                  ? 'bg-emerald-600/40 border-emerald-400 text-emerald-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              [B] Box3 + Axes: {stats.debugBoundingBoxes ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => engineRef.current?.toggleShowroomMode()}
              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                stats.isShowroomMode
                  ? 'bg-cyan-600/40 border-cyan-400 text-cyan-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              [Shift+B] Showroom: {stats.isShowroomMode ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <button
              onClick={() => engineRef.current?.toggleHeightOverlay()}
              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                stats.debugHeightOverlay
                  ? 'bg-emerald-600/40 border-emerald-400 text-emerald-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              [H] Height Line
            </button>
            <button
              onClick={() => engineRef.current?.toggleCurve()}
              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                stats.curveEnabled
                  ? 'bg-cyan-600/40 border-cyan-400 text-cyan-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              [C] Curve: {stats.curveEnabled ? 'ON' : 'FLAT'}
            </button>
            <button
              onClick={() => engineRef.current?.forceSpawnFlyoverAhead()}
              className="px-2 py-1.5 rounded-lg border border-amber-400 bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 text-[10px] font-bold cursor-pointer"
            >
              [L] Spawn Flyover
            </button>
            <button
              onClick={() => engineRef.current?.toggleWireframe()}
              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                stats.debugWireframe
                  ? 'bg-purple-600/40 border-purple-400 text-purple-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              [K] Wireframe
            </button>
            <button
              onClick={() => engineRef.current?.toggleGroundGrid()}
              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                stats.debugGroundGrid
                  ? 'bg-emerald-600/40 border-emerald-400 text-emerald-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              [G] Ground Grid
            </button>
            <button
              onClick={() => setColorblindMode((prev) => !prev)}
              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                colorblindMode
                  ? 'bg-yellow-500/40 border-yellow-300 text-yellow-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              CB Badges: {colorblindMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Automated Verification Suites */}
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={handleRunHeadlessTest}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-[10px] font-bold text-cyan-300 cursor-pointer"
              >
                🧪 10k Ground
              </button>
              <button
                onClick={() => {
                  if (!engineRef.current) return;
                  setFlyoverTestResult(engineRef.current.runFlyoverAutomatedTest());
                }}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-amber-500/60 rounded-lg text-[10px] font-bold text-amber-300 cursor-pointer"
              >
                🛣️ 10k Flyover
              </button>
              <button
                onClick={() => {
                  if (!engineRef.current) return;
                  setFuelTestResult(engineRef.current.runFuelAutomatedTest());
                }}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-emerald-500/60 rounded-lg text-[10px] font-bold text-emerald-300 cursor-pointer"
              >
                ⛽ 5k Fuel Sim
              </button>
            </div>

            {headlessTestResult && (
              <div className="text-[10px] text-cyan-300 bg-slate-900 px-2.5 py-1 rounded border border-cyan-500/30">
                Ground Validator: {headlessTestResult.valid}/{headlessTestResult.tested} valid (
                {(headlessTestResult.passRate * 100).toFixed(1)}%)
              </div>
            )}
            {flyoverTestResult && (
              <div className="text-[10px] text-amber-300 bg-slate-900 px-2.5 py-1 rounded border border-amber-500/30">
                Flyover Validator: {(flyoverTestResult.passRate * 100).toFixed(1)}% valid | Max ΔY=
                {flyoverTestResult.maxStepDeltaY}u ({flyoverTestResult.smoothClimbPassed ? 'SMOOTH ✓' : 'FAIL'})
              </div>
            )}
            {fuelTestResult && (
              <div className="text-[10px] text-emerald-300 bg-slate-900 px-2.5 py-1 rounded border border-emerald-500/30">
                Fuel Sim: {fuelTestResult.runsSimulated} runs, {fuelTestResult.starvedRuns} starved (Min{' '}
                {fuelTestResult.minFuelObserved}%)
              </div>
            )}
          </div>
        </div>
      )}

      {/* VEHICLE_SPECS ALIGNMENT VALIDATION & MODEL SHOWROOM HUD (Key B / Shift+B) */}
      {(stats.debugBoundingBoxes || stats.isShowroomMode) && stats.showroomValidationResults.length > 0 && (
        <div className="absolute top-3 right-3 z-50 max-w-xl w-full bg-slate-950/92 backdrop-blur-md border-2 border-cyan-400/80 rounded-2xl p-3.5 text-white shadow-2xl font-mono text-[11px] pointer-events-auto">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <span>📦 VEHICLE_SPECS BOX3 ALIGNMENT VALIDATOR (1u = 1m, -Z Forward)</span>
            </div>
            <div className="flex items-center gap-1.5">
              {stats.isShowroomMode && (
                <>
                  <button
                    onClick={() => engineRef.current?.cycleShowroomFocus(-1)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-xs cursor-pointer"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => engineRef.current?.cycleShowroomFocus(1)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-xs cursor-pointer"
                  >
                    Next →
                  </button>
                </>
              )}
              <button
                onClick={() => engineRef.current?.toggleShowroomMode()}
                className={`px-2.5 py-0.5 rounded border font-bold cursor-pointer ${
                  stats.isShowroomMode
                    ? 'bg-amber-500 text-slate-950 border-yellow-200'
                    : 'bg-cyan-700/60 text-cyan-100 border-cyan-400'
                }`}
              >
                {stats.isShowroomMode ? 'Exit Showroom' : 'Open Showroom'}
              </button>
              <button
                onClick={() => {
                  if (stats.isShowroomMode) engineRef.current?.setShowroomMode(false);
                  if (stats.debugBoundingBoxes) engineRef.current?.toggleBoundingBoxDebug();
                }}
                className="text-slate-400 hover:text-white cursor-pointer ml-1"
                aria-label="Close Box3 Validator"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-1 pr-2">Model</th>
                  <th className="py-1 pr-2">Spec (L×W×H m)</th>
                  <th className="py-1 pr-2">Measured Box3</th>
                  <th className="py-1 pr-2">min.y</th>
                  <th className="py-1 pr-2">center (x,z)</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.showroomValidationResults.map((r) => (
                  <tr key={r.specKey} className="border-b border-slate-900/80">
                    <td className="py-1 pr-2 font-bold text-cyan-200">{r.specKey}</td>
                    <td className="py-1 pr-2 text-slate-300">
                      {r.expected.length.toFixed(1)}×{r.expected.width.toFixed(1)}×{r.expected.height.toFixed(2)}
                    </td>
                    <td className="py-1 pr-2 text-emerald-300">
                      {r.measured.length.toFixed(2)}×{r.measured.width.toFixed(2)}×{r.measured.height.toFixed(2)}
                    </td>
                    <td className="py-1 pr-2 text-amber-300">{r.minY.toFixed(3)}</td>
                    <td className="py-1 pr-2 text-slate-300">
                      ({r.centerX.toFixed(2)}, {r.centerZ.toFixed(2)})
                    </td>
                    <td className="py-1">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          r.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {r.passed ? 'PASS ✓' : 'WARN'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Press [B] to toggle Box3 + Axes helpers | [Shift+B] for Model Showroom lineup</span>
            <span className="text-emerald-400 font-bold">LANE_WIDTH = 3.5m ([-3.5, 0, +3.5])</span>
          </div>
        </div>
      )}
    </div>
  );
}
