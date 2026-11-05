export const ROAD_Y = 0;
export const SIDEWALK_Y = 0.2;
export const GROUND_Y = -0.05;
export const DECK_Y = 5.8;
export const DECK_THICKNESS = 0.6;
export const RAMP_LENGTH = 34.0;
export const RAMP_SLOPE = DECK_Y / RAMP_LENGTH;
export const DECK_CLEARANCE = 5.2;
export const RAIL_HEIGHT = 0.95;

/**
 * Canonical Ramp & World Travel Convention:
 * - World travel direction is toward -Z (`RAMP_TRAVEL_DIR_Z = -1`), away from the camera at +Z.
 * - For every ascending ("go up") ramp in local and world space (with `rotation.y = 0`):
 *   - The LOW (approach) end is at the larger `+Z` coordinate (reached first by the player).
 *   - The HIGH (exit/deck/roof) end is at the smaller `-Z` coordinate (further ahead in `-Z`).
 *   - An inclined slab tilted up from `+Z` (low) to `-Z` (high) has a POSITIVE `rotation.x` (`+atan2(rise, run)`).
 *   - Directional chevrons and arrows on the ramp surface point toward `-Z`.
 */
export const RAMP_TRAVEL_DIR_Z = -1 as const;
export const BUS_BODY_LENGTH = 9.0;
export const BUS_ROOF_HEIGHT = 2.8;
export const BUS_RAMP_LENGTH = 5.2;
export const BUS_RAMP_LOW_OFFSET_Z = 4.2 + BUS_RAMP_LENGTH; // +9.4m (low end at road level, reached first)
export const BUS_RAMP_HIGH_OFFSET_Z = 4.2;                  // +4.2m (high end meeting bus rear roof at y = 2.8m)
export const BUS_ROOF_FRONT_OFFSET_Z = -4.5;                // -4.5m (front edge of bus roof)

export const GAME_CONFIG = {
  ROAD_Y,
  SIDEWALK_Y,
  GROUND_Y,
  DECK_Y,
  DECK_THICKNESS,
  RAMP_LENGTH,
  RAMP_SLOPE,
  DECK_CLEARANCE,
  RAIL_HEIGHT,
  LANES: [-4.0, 0, 4.0] as number[],        // Left (-4m), Center (0m), Right (+4m)
  SHORTCUT_LANES: [-2.2, 2.2] as number[],   // 2-lane narrow alleyway for shortcuts
  LANE_SWITCH_SPEED: 22,                     // Rapid, responsive lane switching
  BASE_SPEED: 18,                            // Starting speed in units/s (18 units/s)
  MAX_SPEED: 48,                             // Top speed in units/s (48 units/s)
  SPEED_DAMPING_DIST: 2500,                  // Exponential speed scaling distance
  DIFFICULTY_DIST_INTERVAL: 400,             // 400m per difficulty level
  MAX_DIFFICULTY_LEVEL: 12,                  // Capped at 12 levels
  MIN_REACTION_TIME: 0.45,                   // Minimum reaction time in seconds (gap >= speed * 0.45)
  NORMAL_JUMP: 13.5,                         // Standard jump impulse
  SUPER_JUMP: 21.6,                          // Super Khussa jump impulse (13.5 * 1.6)
  GRAVITY: 36.0,                             // Platformer gravity
  ROAD_WIDTH: 14.0,                          // 3-lane road width (m)
  CHUNK_LENGTH: 50.0,                        // Length of each road chunk
  ACTIVE_CHUNKS: 10,                         // Active road chunks in memory (500m total track)
  CHUNKS_AHEAD_MIN: 7,                       // Guarantee at least 7 chunks (350m) ahead of player
  CHUNK_GENERATION_MAX_PER_FRAME: 4,         // Max chunks to spawn/recycle per frame to prevent frame spikes
  DESPAWN_DISTANCE: 40.0,                    // Distance behind camera before recycling
  FLOATING_ORIGIN_THRESHOLD: 25000.0,        // Shift origin only after 25km (prevents premature coordinate shifting)
  FOG_COLOR: 0x7dd3fc,                       // Bright sunny blue horizon fog
  FOG_NEAR: 140,                             // Soft fog start
  FOG_FAR: 380,                              // Horizon fog end (fully masked within 500m track)
  // Police Chase Tuning
  POLICE_GAP_SAFE: 14.0,                     // Safe distance behind rickshaw
  POLICE_GAP_CLOSE: 5.0,                     // Danger gap after stumble/scrape
  POLICE_RECOVERY_TIME: 10.0,                // Seconds of clean play to recover gap
  POLICE_OVERTAKE_INTERVAL: 600,             // Every ~600m a car pulls alongside
  POLICE_LEVEL_SWITCH_DELAY: 0.6,            // 0.6s delay before police follow player onto/off flyover
  // Flyover & Underpass Tuning
  FLYOVER_HEIGHT: DECK_Y,                    // Vertical elevation of flyover deck (5.8 units)
  FLYOVER_RAMP_LENGTH: RAMP_LENGTH,          // Length of inclined flyover ramp (34.0 units)
  FLYOVER_FIRST_DIST: 600.0,                 // First flyover appears after ~600m
  FLYOVER_INTERVAL_MIN: 900.0,               // Minimum distance between flyovers (~900m)
  FLYOVER_INTERVAL_MAX: 1400.0,              // Maximum distance between flyovers (~1,400m)
  FLYOVER_SHORTCUT_BUFFER: 400.0,            // Never spawn a flyover within 400m of a shortcut start
  FLYOVER_DECK_LEN_MIN: 80.0,                // Minimum flat deck length (80 units)
  FLYOVER_DECK_LEN_MAX: 160.0,               // Maximum flat deck length (160 units)
  FLYOVER_PILLAR_SPACING: 18.0,              // Support pillars every ~18 units
  FLYOVER_ENTRY_CLEAR_LEN: 15.0,             // First 15 units of deck after ramp are clear
  FLYOVER_EXIT_CLEAR_LEN: 20.0,              // Last 20 units before down-ramp & after down-ramp are clear
  FLYOVER_GANTRY_LEAD_DIST: 24.0,            // Advance "FLYOVER" gantry placed 24m ahead of ramp entrance
  FLYOVER_COIN_DENSITY_MULT: 1.5,            // 1.5x coin density reward on the deck
  FLYOVER_CAM_MIN_ABOVE_DECK: 2.4,           // Camera stays at least 2.4 units above deck surface
  FLYOVER_CAM_UNDERSIDE_MARGIN: 0.55,        // Camera stays at least 0.55 units below deck underside ceiling
  FLYOVER_CLIMB_FOV_BONUS: 4.5,              // Slight FOV widening on climb/deck
  OVERHEAD_CEILING_CLEARANCE: 4.4,           // Max jump height offset above surface under ceilings/beams
  // Shortcuts
  SHORTCUT_INTERVAL_MIN: 900,                // Minimum distance between shortcuts
  SHORTCUT_INTERVAL_MAX: 1400,               // Maximum distance between shortcuts
  SHORTCUT_LENGTH: 250,                      // Shortcut alley length
  // Mystery Box Pickups
  MYSTERY_BOX_DURATION: 10.0,                // 10s transformation
  MYSTERY_BOX_FLICKER: 2.0,                  // 2s expiration flicker
  MYSTERY_BOX_INVULN: 1.0,                   // 1s invulnerability after reversion
  // Fuel System Tuning
  FUEL_MAX: 100.0,                           // Starting full tank
  FUEL_BASE_DRAIN_RATE: 0.128,               // % per meter base rate (~800m full tank at start speed)
  FUEL_LOW_WARNING_PCT: 25.0,                // Flashing warning + beep below 25%
  FUEL_SPUTTER_PCT: 15.0,                    // Engine sputter & speed dips below 15%
  FUEL_STALL_DECAY_TIME: 3.0,                // Seconds for speed to decay when empty (0%)
  FUEL_EMPTY_ARREST_TIME: 4.0,               // Seconds at 0% fuel before police arrest
  FUEL_PITY_THRESHOLD_PCT: 38.0,             // Guarantee fuel spawn when projected gauge < ~35-38% within 250m
  FUEL_PITY_LOOKAHEAD_M: 250.0,              // Lookahead distance (m) for guaranteed fuel spawn
  FUEL_GOLDEN_NODRAIN_DURATION: 5.0,         // 5s of zero fuel drain for Golden Fuel Can
  // Shield System Tuning
  SHIELD_DURATION_STANDARD: 15.0,            // Standard shield duration (s)
  SHIELD_DURATION_DOUBLE: 18.0,              // Double shield duration (s)
  SHIELD_DURATION_GOLDEN: 15.0,              // Golden shield duration (s)
  SHIELD_FLICKER_TIME: 3.0,                  // Flicker in last 3s before expiry
  SHIELD_HIT_INVULN: 1.0,                    // 1.0s invulnerability on shield hit
  SHIELD_GOLDEN_BONUS_COINS: 35,             // Bonus coins when Golden Shield destroys obstacle
  // Jump Boost System Tuning
  JUMP_SUPER_KHUSSA_MULT: 1.6,               // jumpVelocity x1.6
  JUMP_SUPER_KHUSSA_DURATION: 12.0,          // 12s duration
  JUMP_SPRING_BOOTS_DURATION: 8.0,           // 8s auto-bounce duration
  JUMP_SPRING_BOOTS_INTERVAL: 0.15,          // Pause on ground before next auto-bounce beat
  JUMP_DOUBLE_JUMP_DURATION: 15.0,           // 15s double jump duration
  JUMP_FLICKER_TIME: 3.0,                    // Flicker in last 3s before expiry
  CURVE_STRENGTH: 0.0006,                    // Curved-world horizon strength
  // Pickup Spawning Rules
  PICKUP_FLOAT_HEIGHT: 1.0,                  // Floats ~1 unit above road/deck
  PICKUP_RADIUS: 1.85,                       // Generous pickup radius larger than visual size
  PICKUP_MIN_SAME_KIND_GAP: 150.0,           // Minimum ~150m between two power pickups of the same kind

  // Auto-Rickshaw Authentic Anatomy & Proportions Config
  RICKSHAW_CHASSIS_WIDTH: 1.38,              // Cabin width (m)
  RICKSHAW_CHASSIS_LENGTH: 2.38,             // Nose to rear bumper (length to width ~1.72:1)
  RICKSHAW_CABIN_HEIGHT: 1.82,               // Total height (height to width ~1.32:1)
  RICKSHAW_WHEEL_FRONT_R: 0.28,              // Front wheel radius
  RICKSHAW_WHEEL_FRONT_W: 0.16,              // Front tire width
  RICKSHAW_WHEEL_REAR_R: 0.32,               // Rear wheel radius
  RICKSHAW_WHEEL_REAR_W: 0.20,               // Rear tire width
  RICKSHAW_REAR_TRACK: 1.16,                 // Distance between rear wheel centers
  RICKSHAW_WHEELBASE: 1.58,                  // Distance from front axle to rear axle
  RICKSHAW_ROOF_OVERHANG_F: 0.14,            // Canopy forward visor overhang
  RICKSHAW_ROOF_OVERHANG_R: 0.12,            // Canopy rear overhang
  RICKSHAW_TASSEL_SWING_MAX: 0.45,           // Maximum radian swing for hanging paranda tassels
  RICKSHAW_STEER_ANGLE_MAX: 0.32             // Maximum front fork steering angle during lane shifts
};

export type PickupKind = 'FUEL' | 'SHIELD' | 'JUMP';

export type PickupVariantId =
  | 'FUEL_JERRY_CAN'
  | 'FUEL_DRUM'
  | 'FUEL_GOLDEN_CAN'
  | 'SHIELD_STANDARD'
  | 'SHIELD_DOUBLE'
  | 'SHIELD_GOLDEN'
  | 'JUMP_SUPER_KHUSSA'
  | 'JUMP_SPRING_BOOTS'
  | 'JUMP_DOUBLE_JUMP';

export type HudIconId =
  | 'FuelCan'
  | 'FuelDrum'
  | 'GoldenFuel'
  | 'PetrolPump'
  | 'Shield'
  | 'DoubleShield'
  | 'GoldenShield'
  | 'Khussa'
  | 'SpringBoots'
  | 'DoubleJump';

export type PickupSoundId =
  | 'SFX_FUEL_PICKUP'
  | 'SFX_FUEL_GOLDEN'
  | 'SFX_SHIELD_PICKUP'
  | 'SFX_JUMP_PICKUP';

export interface PickupConfigDef {
  id: PickupVariantId;
  kind: PickupKind;
  variant: 'STANDARD' | 'LARGE' | 'GOLDEN';
  name: string;
  badgeText: 'F' | 'S' | 'J';
  color: number;
  accentColor: number;
  cssColor: string;
  shape: 'JERRY_CAN' | 'BARREL_DRUM' | 'GOLDEN_CAN' | 'CREST_SINGLE' | 'CREST_DOUBLE' | 'CREST_GOLD' | 'KHUSSA_COIL' | 'SPRING_BOOTS' | 'WINGED_KHUSSA';
  spawnWeight: {
    early: number;  // 0 to 500 m
    mid: number;    // 500 to 1,500 m
    late: number;   // 1,500 m+
  };
  minDistance: number;
  duration: number;     // Seconds (for timed effects or golden fuel no-drain)
  amount: number;       // Fuel % restored or shield hit charges
  soundId: PickupSoundId;
  hudIconId: HudIconId;
}

export const PICKUP_DEFINITIONS: Record<PickupVariantId, PickupConfigDef> = {
  // ==================== (A) FUEL PICKUPS ====================
  FUEL_JERRY_CAN: {
    id: 'FUEL_JERRY_CAN',
    kind: 'FUEL',
    variant: 'STANDARD',
    name: 'Jerry Can (+30%)',
    badgeText: 'F',
    color: 0xf97316,       // Red-orange
    accentColor: 0xfef08a,
    cssColor: '#f97316',
    shape: 'JERRY_CAN',
    spawnWeight: { early: 70, mid: 55, late: 45 },
    minDistance: 0,
    duration: 0,
    amount: 30,
    soundId: 'SFX_FUEL_PICKUP',
    hudIconId: 'FuelCan'
  },
  FUEL_DRUM: {
    id: 'FUEL_DRUM',
    kind: 'FUEL',
    variant: 'LARGE',
    name: 'Fuel Drum (+70%)',
    badgeText: 'F',
    color: 0x3b82f6,       // Blue-gray barrel with yellow stripe
    accentColor: 0xfacc15,
    cssColor: '#3b82f6',
    shape: 'BARREL_DRUM',
    spawnWeight: { early: 0, mid: 18, late: 35 },
    minDistance: 500,      // Introduced at low weight 500-1500m, full after 1500m & in flyovers/shortcuts
    duration: 0,
    amount: 70,
    soundId: 'SFX_FUEL_PICKUP',
    hudIconId: 'FuelDrum'
  },
  FUEL_GOLDEN_CAN: {
    id: 'FUEL_GOLDEN_CAN',
    kind: 'FUEL',
    variant: 'GOLDEN',
    name: 'Golden Fuel (100% + 5s No-Drain)',
    badgeText: 'F',
    color: 0xfacc15,       // Gold
    accentColor: 0xffffff,
    cssColor: '#facc15',
    shape: 'GOLDEN_CAN',
    spawnWeight: { early: 0, mid: 0, late: 12 },
    minDistance: 1500,
    duration: 5.0,
    amount: 100,
    soundId: 'SFX_FUEL_GOLDEN',
    hudIconId: 'GoldenFuel'
  },

  // ==================== (B) SHIELD PICKUPS ====================
  SHIELD_STANDARD: {
    id: 'SHIELD_STANDARD',
    kind: 'SHIELD',
    variant: 'STANDARD',
    name: 'Standard Shield (1 Hit)',
    badgeText: 'S',
    color: 0x06b6d4,       // Cyan-blue crest
    accentColor: 0xfacc15,
    cssColor: '#06b6d4',
    shape: 'CREST_SINGLE',
    spawnWeight: { early: 65, mid: 45, late: 35 },
    minDistance: 0,
    duration: 15.0,
    amount: 1,
    soundId: 'SFX_SHIELD_PICKUP',
    hudIconId: 'Shield'
  },
  SHIELD_DOUBLE: {
    id: 'SHIELD_DOUBLE',
    kind: 'SHIELD',
    variant: 'LARGE',
    name: 'Double Shield (2 Hits)',
    badgeText: 'S',
    color: 0x2563eb,       // Royal blue crest with two stacked rings
    accentColor: 0x38bdf8,
    cssColor: '#2563eb',
    shape: 'CREST_DOUBLE',
    spawnWeight: { early: 0, mid: 20, late: 35 },
    minDistance: 500,
    duration: 18.0,
    amount: 2,
    soundId: 'SFX_SHIELD_PICKUP',
    hudIconId: 'DoubleShield'
  },
  SHIELD_GOLDEN: {
    id: 'SHIELD_GOLDEN',
    kind: 'SHIELD',
    variant: 'GOLDEN',
    name: 'Golden Shield (Smash + Bonus)',
    badgeText: 'S',
    color: 0xfbbf24,       // Gold crest
    accentColor: 0x38bdf8,
    cssColor: '#fbbf24',
    shape: 'CREST_GOLD',
    spawnWeight: { early: 0, mid: 0, late: 14 },
    minDistance: 1500,
    duration: 15.0,
    amount: 1,
    soundId: 'SFX_SHIELD_PICKUP',
    hudIconId: 'GoldenShield'
  },

  // ==================== (C) JUMP BOOST PICKUPS ====================
  JUMP_SUPER_KHUSSA: {
    id: 'JUMP_SUPER_KHUSSA',
    kind: 'JUMP',
    variant: 'STANDARD',
    name: 'Super Khussa (1.6x Jump)',
    badgeText: 'J',
    color: 0x22c55e,       // Vivid green & gold
    accentColor: 0xfacc15,
    cssColor: '#22c55e',
    shape: 'KHUSSA_COIL',
    spawnWeight: { early: 65, mid: 45, late: 35 },
    minDistance: 0,
    duration: 12.0,
    amount: 1,
    soundId: 'SFX_JUMP_PICKUP',
    hudIconId: 'Khussa'
  },
  JUMP_SPRING_BOOTS: {
    id: 'JUMP_SPRING_BOOTS',
    kind: 'JUMP',
    variant: 'LARGE',
    name: 'Spring Boots (Auto-Bounce)',
    badgeText: 'J',
    color: 0x10b981,       // Emerald spring coil boots
    accentColor: 0xa7f3d0,
    cssColor: '#10b981',
    shape: 'SPRING_BOOTS',
    spawnWeight: { early: 0, mid: 20, late: 30 },
    minDistance: 500,
    duration: 8.0,
    amount: 1,
    soundId: 'SFX_JUMP_PICKUP',
    hudIconId: 'SpringBoots'
  },
  JUMP_DOUBLE_JUMP: {
    id: 'JUMP_DOUBLE_JUMP',
    kind: 'JUMP',
    variant: 'GOLDEN',
    name: 'Double Jump (Air Wing)',
    badgeText: 'J',
    color: 0x4ade80,       // Bright neon green & gold wings
    accentColor: 0xfef08a,
    cssColor: '#4ade80',
    shape: 'WINGED_KHUSSA',
    spawnWeight: { early: 0, mid: 0, late: 18 },
    minDistance: 1500,
    duration: 15.0,
    amount: 2,
    soundId: 'SFX_JUMP_PICKUP',
    hudIconId: 'DoubleJump'
  }
};

export type PowerupType =
  | 'MAGNET'
  | 'JETPACK'
  | 'HYDRAULIC'
  | 'MULTIPLIER'
  | 'SHIELD'
  | 'CNG'
  | PickupVariantId;

export type GameState = 'START' | 'RUNNING' | 'PAUSED' | 'GAMEOVER';
export type RickshawSkin = 'badshahi' | 'karachi' | 'peshawar' | 'cyber';
export type VehicleId = 'rickshaw' | 'bolan' | 'truck' | 'motorbike' | 'chingchi';
export type MysteryVehicleId = 'tractor' | 'tonga';
export type WeatherType = 'SUNNY' | 'GOLDEN' | 'MONSOON' | 'NIGHT';

export interface SkinInfo {
  id: RickshawSkin;
  name: string;
  city: string;
  description: string;
  price: number;
  unlocked: boolean;
  colors: {
    body: number;
    trim: number;
    canopy: number;
    accent: string;
  };
}

export interface UpgradesState {
  magnetLevel: number;         // 1 to 5: +2.5s duration per level
  jetpackLevel: number;        // 1 to 5: +2s duration & +10% speed
  hydraulicLevel: number;      // 1 to 5: +15% hydraulic jump boost & suspension cushion
  starterShield: number;       // 0 to 3: start runs with extra shield charges
  fuelEfficiencyLevel?: number; // 1 to 5: reduces fuel drain rate by 8% per level
}

export interface Quest {
  id: string;
  title: string;
  target: number;
  current: number;
  reward: number;
  type: 'DISTANCE' | 'COINS' | 'SPEED' | 'CLOSECALL' | 'DODGE_CARS';
  completed: boolean;
  claimed: boolean;
}
