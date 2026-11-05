import { PowerupType, GAME_CONFIG, VehicleId } from './config';
import { PLAYABLE_VEHICLES } from './vehicles';

export type PatternHazardKind =
  | 'CAR'
  | 'RICKSHAW'
  | 'BIKE'
  | 'BUS'
  | 'BUS_RAMP'
  | 'BEDFORD'
  | 'FRUIT_CART'
  | 'COW'
  | 'HURDLE'
  | 'PYLON'
  | 'CROSSING_CAT'
  | 'CROSSING_PED'
  | 'COIN_LINE'
  | 'POWERUP'
  | 'LOW_BEAM';

export interface PatternElement {
  lane: number; // 0: Left, 1: Center, 2: Right
  zOffset: number; // relative forward distance in meters (0 to length)
  kind: PatternHazardKind;
  level?: 0 | 1; // 0 = Ground road (default), 1 = Elevated flyover deck
  powerupType?: PowerupType;
  coinCount?: number;
}

export interface SpawnPattern {
  id: string;
  name: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  minDistance: number; // minimum player distance before this pattern enters rotation
  weight: number; // base selection weight
  length: number; // total pattern chunk span in meters (e.g. 40 - 60m)
  elements: PatternElement[];
}

/**
 * 30 Handcrafted Procedural Spawning Patterns.
 * Designed according to arcade endless runner principles:
 * - Always at least one open lane at any instantaneous point
 * - Consecutive rows maintain sufficient reaction time for single lane changes
 * - Mixes traffic flow, static hurdles, ramps, coin rewards, and powerups
 */
export const SPAWN_PATTERNS: SpawnPattern[] = [
  // ==================== EASY PATTERNS (0m+) ====================
  {
    id: 'easy_center_fruit_cart',
    name: 'Anarkali Fruit Stand',
    difficulty: 'EASY',
    minDistance: 0,
    weight: 12,
    length: 45,
    elements: [
      { lane: 1, zOffset: 12, kind: 'FRUIT_CART' },
      { lane: 0, zOffset: 10, kind: 'COIN_LINE', coinCount: 6 },
      { lane: 2, zOffset: 25, kind: 'HURDLE' }
    ]
  },
  {
    id: 'easy_single_bus_left',
    name: 'Metro Bus Left Corridor',
    difficulty: 'EASY',
    minDistance: 0,
    weight: 12,
    length: 50,
    elements: [
      { lane: 0, zOffset: 15, kind: 'BUS' },
      { lane: 1, zOffset: 12, kind: 'COIN_LINE', coinCount: 8 },
      { lane: 2, zOffset: 32, kind: 'CAR' }
    ]
  },
  {
    id: 'easy_slalom_gentle',
    name: 'Gentle Mall Road Slalom',
    difficulty: 'EASY',
    minDistance: 0,
    weight: 10,
    length: 55,
    elements: [
      { lane: 0, zOffset: 12, kind: 'HURDLE' },
      { lane: 1, zOffset: 24, kind: 'COIN_LINE', coinCount: 6 },
      { lane: 2, zOffset: 36, kind: 'HURDLE' },
      { lane: 1, zOffset: 46, kind: 'POWERUP', powerupType: 'MAGNET' }
    ]
  },
  {
    id: 'easy_sahiwal_cow_pasture',
    name: 'Resting Sahiwal Cow',
    difficulty: 'EASY',
    minDistance: 50,
    weight: 10,
    length: 45,
    elements: [
      { lane: 2, zOffset: 14, kind: 'COW' },
      { lane: 1, zOffset: 14, kind: 'COIN_LINE', coinCount: 5 },
      { lane: 0, zOffset: 30, kind: 'RICKSHAW' }
    ]
  },
  {
    id: 'easy_center_hurdle_split',
    name: 'Center Hurdle Fork',
    difficulty: 'EASY',
    minDistance: 0,
    weight: 12,
    length: 40,
    elements: [
      { lane: 1, zOffset: 12, kind: 'HURDLE' },
      { lane: 0, zOffset: 12, kind: 'COIN_LINE', coinCount: 6 },
      { lane: 2, zOffset: 12, kind: 'COIN_LINE', coinCount: 6 }
    ]
  },
  {
    id: 'easy_cng_refuel_oasis',
    name: 'CNG Green Gas Oasis',
    difficulty: 'EASY',
    minDistance: 60,
    weight: 10,
    length: 45,
    elements: [
      { lane: 0, zOffset: 14, kind: 'HURDLE' },
      { lane: 1, zOffset: 14, kind: 'POWERUP', powerupType: 'CNG' },
      { lane: 2, zOffset: 14, kind: 'CAR' },
      { lane: 1, zOffset: 28, kind: 'COIN_LINE', coinCount: 6 }
    ]
  },
  {
    id: 'easy_bus_ramp_intro',
    name: 'First Bus Ramp Hop',
    difficulty: 'EASY',
    minDistance: 80,
    weight: 11,
    length: 55,
    elements: [
      { lane: 1, zOffset: 15, kind: 'BUS_RAMP' },
      { lane: 0, zOffset: 25, kind: 'HURDLE' },
      { lane: 2, zOffset: 38, kind: 'CAR' }
    ]
  },
  {
    id: 'easy_stray_cat_dash',
    name: 'Brisk Street Cat Dash',
    difficulty: 'EASY',
    minDistance: 90,
    weight: 9,
    length: 45,
    elements: [
      { lane: 1, zOffset: 12, kind: 'CROSSING_CAT' },
      { lane: 0, zOffset: 10, kind: 'COIN_LINE', coinCount: 6 },
      { lane: 2, zOffset: 28, kind: 'RICKSHAW' }
    ]
  },
  {
    id: 'easy_rickshaw_duo',
    name: 'Cruising Auto Rickshaws',
    difficulty: 'EASY',
    minDistance: 40,
    weight: 10,
    length: 50,
    elements: [
      { lane: 0, zOffset: 14, kind: 'RICKSHAW' },
      { lane: 2, zOffset: 26, kind: 'RICKSHAW' },
      { lane: 1, zOffset: 14, kind: 'COIN_LINE', coinCount: 8 }
    ]
  },
  {
    id: 'easy_shield_gift',
    name: 'Truck Art Shield Sanctuary',
    difficulty: 'EASY',
    minDistance: 100,
    weight: 8,
    length: 45,
    elements: [
      { lane: 1, zOffset: 12, kind: 'POWERUP', powerupType: 'SHIELD' },
      { lane: 0, zOffset: 22, kind: 'FRUIT_CART' },
      { lane: 2, zOffset: 22, kind: 'HURDLE' }
    ]
  },

  // ==================== MEDIUM PATTERNS (250m+) ====================
  {
    id: 'med_pylon_left_wing',
    name: 'High-Voltage Pylon on Left Lane',
    difficulty: 'MEDIUM',
    minDistance: 200,
    weight: 11,
    length: 60,
    elements: [
      { lane: 0, zOffset: 16, kind: 'PYLON' },
      { lane: 1, zOffset: 14, kind: 'COIN_LINE', coinCount: 8 },
      { lane: 2, zOffset: 32, kind: 'CAR' },
      { lane: 1, zOffset: 45, kind: 'HURDLE' }
    ]
  },
  {
    id: 'med_pylon_right_wing',
    name: 'High-Voltage Pylon on Right Lane',
    difficulty: 'MEDIUM',
    minDistance: 250,
    weight: 11,
    length: 60,
    elements: [
      { lane: 2, zOffset: 16, kind: 'PYLON' },
      { lane: 1, zOffset: 14, kind: 'COIN_LINE', coinCount: 8 },
      { lane: 0, zOffset: 32, kind: 'CAR' },
      { lane: 1, zOffset: 44, kind: 'FRUIT_CART' }
    ]
  },
  {
    id: 'med_bedford_rocket_convoy',
    name: 'Chamak-Patti Bedford Convoy',
    difficulty: 'MEDIUM',
    minDistance: 300,
    weight: 10,
    length: 65,
    elements: [
      { lane: 1, zOffset: 15, kind: 'BEDFORD' },
      { lane: 0, zOffset: 12, kind: 'COIN_LINE', coinCount: 7 },
      { lane: 2, zOffset: 34, kind: 'BIKE' },
      { lane: 0, zOffset: 48, kind: 'HURDLE' }
    ]
  },
  {
    id: 'med_staggered_buses',
    name: 'Metro & Saloon Bus Weave',
    difficulty: 'MEDIUM',
    minDistance: 350,
    weight: 10,
    length: 65,
    elements: [
      { lane: 0, zOffset: 15, kind: 'BUS' },
      { lane: 1, zOffset: 14, kind: 'COIN_LINE', coinCount: 6 },
      { lane: 2, zOffset: 34, kind: 'BUS' },
      { lane: 1, zOffset: 48, kind: 'POWERUP', powerupType: 'HYDRAULIC' }
    ]
  },
  {
    id: 'med_bus_ramp_roof_coins',
    name: 'Elevated Bus Roof Treasure',
    difficulty: 'MEDIUM',
    minDistance: 280,
    weight: 11,
    length: 60,
    elements: [
      { lane: 0, zOffset: 14, kind: 'BUS_RAMP' },
      { lane: 1, zOffset: 18, kind: 'CAR' },
      { lane: 2, zOffset: 36, kind: 'BEDFORD' }
    ]
  },
  {
    id: 'med_pedestrian_crossing_weave',
    name: 'Mall Road Pedestrian Crossing',
    difficulty: 'MEDIUM',
    minDistance: 320,
    weight: 10,
    length: 50,
    elements: [
      { lane: 1, zOffset: 14, kind: 'CROSSING_PED' },
      { lane: 0, zOffset: 25, kind: 'CAR' },
      { lane: 2, zOffset: 12, kind: 'COIN_LINE', coinCount: 6 }
    ]
  },
  {
    id: 'med_motorbike_cross_weave',
    name: 'Nimble 70cc CD Motorbike Swarm',
    difficulty: 'MEDIUM',
    minDistance: 350,
    weight: 11,
    length: 55,
    elements: [
      { lane: 2, zOffset: 12, kind: 'BIKE' },
      { lane: 1, zOffset: 24, kind: 'BIKE' },
      { lane: 0, zOffset: 14, kind: 'COIN_LINE', coinCount: 8 },
      { lane: 0, zOffset: 40, kind: 'HURDLE' }
    ]
  },
  {
    id: 'med_cng_rush_hazard',
    name: 'Urgent CNG Gas Refill Challenge',
    difficulty: 'MEDIUM',
    minDistance: 380,
    weight: 9,
    length: 50,
    elements: [
      { lane: 0, zOffset: 14, kind: 'CAR' },
      { lane: 2, zOffset: 14, kind: 'FRUIT_CART' },
      { lane: 1, zOffset: 15, kind: 'POWERUP', powerupType: 'CNG' },
      { lane: 1, zOffset: 32, kind: 'HURDLE' }
    ]
  },
  {
    id: 'med_double_cow_chicane',
    name: 'Sahiwal Bull Chicane',
    difficulty: 'MEDIUM',
    minDistance: 400,
    weight: 9,
    length: 55,
    elements: [
      { lane: 0, zOffset: 14, kind: 'COW' },
      { lane: 2, zOffset: 30, kind: 'COW' },
      { lane: 1, zOffset: 14, kind: 'COIN_LINE', coinCount: 7 },
      { lane: 1, zOffset: 44, kind: 'POWERUP', powerupType: 'MULTIPLIER' }
    ]
  },
  {
    id: 'med_jetpack_sky_launch',
    name: 'Rocket Jetpack Launchpad',
    difficulty: 'MEDIUM',
    minDistance: 420,
    weight: 8,
    length: 60,
    elements: [
      { lane: 1, zOffset: 12, kind: 'POWERUP', powerupType: 'JETPACK' },
      { lane: 0, zOffset: 24, kind: 'BUS' },
      { lane: 2, zOffset: 24, kind: 'BEDFORD' },
      { lane: 1, zOffset: 40, kind: 'CAR' }
    ]
  },

  // ==================== HARD PATTERNS (600m+) ====================
  {
    id: 'hard_center_pylon_flanked',
    name: 'Center High-Voltage Pylon Flank',
    difficulty: 'HARD',
    minDistance: 600,
    weight: 12,
    length: 65,
    elements: [
      { lane: 1, zOffset: 16, kind: 'PYLON' },
      { lane: 0, zOffset: 14, kind: 'COIN_LINE', coinCount: 6 },
      { lane: 2, zOffset: 30, kind: 'CAR' },
      { lane: 0, zOffset: 44, kind: 'FRUIT_CART' }
    ]
  },
  {
    id: 'hard_dual_moving_traffic',
    name: 'Double Lane Rush Hour Flow',
    difficulty: 'HARD',
    minDistance: 650,
    weight: 12,
    length: 65,
    elements: [
      { lane: 0, zOffset: 14, kind: 'CAR' },
      { lane: 1, zOffset: 16, kind: 'RICKSHAW' },
      { lane: 2, zOffset: 14, kind: 'COIN_LINE', coinCount: 8 },
      { lane: 2, zOffset: 38, kind: 'BUS' },
      { lane: 0, zOffset: 42, kind: 'BIKE' }
    ]
  },
  {
    id: 'hard_bus_ramp_to_bus_ramp',
    name: 'Twin Bus Ramp Leap',
    difficulty: 'HARD',
    minDistance: 700,
    weight: 11,
    length: 70,
    elements: [
      { lane: 0, zOffset: 14, kind: 'BUS_RAMP' },
      { lane: 1, zOffset: 24, kind: 'BEDFORD' },
      { lane: 2, zOffset: 40, kind: 'BUS_RAMP' },
      { lane: 1, zOffset: 52, kind: 'COIN_LINE', coinCount: 6 }
    ]
  },
  {
    id: 'hard_rapid_zigzag_hurdles',
    name: 'High-Speed Reflex Zigzag',
    difficulty: 'HARD',
    minDistance: 750,
    weight: 11,
    length: 65,
    elements: [
      { lane: 0, zOffset: 12, kind: 'HURDLE' },
      { lane: 1, zOffset: 24, kind: 'HURDLE' },
      { lane: 2, zOffset: 38, kind: 'HURDLE' },
      { lane: 0, zOffset: 50, kind: 'POWERUP', powerupType: 'MAGNET' }
    ]
  },
  {
    id: 'hard_pylon_and_crossing_ped',
    name: 'Pylon and Street Crossing Mayhem',
    difficulty: 'HARD',
    minDistance: 800,
    weight: 10,
    length: 65,
    elements: [
      { lane: 2, zOffset: 15, kind: 'PYLON' },
      { lane: 1, zOffset: 22, kind: 'CROSSING_PED' },
      { lane: 0, zOffset: 15, kind: 'COIN_LINE', coinCount: 6 },
      { lane: 0, zOffset: 38, kind: 'CAR' }
    ]
  },
  {
    id: 'hard_chamak_patti_sandwich',
    name: 'Bedford Rocket Sandwich',
    difficulty: 'HARD',
    minDistance: 850,
    weight: 10,
    length: 65,
    elements: [
      { lane: 0, zOffset: 14, kind: 'BEDFORD' },
      { lane: 2, zOffset: 14, kind: 'BEDFORD' },
      { lane: 1, zOffset: 12, kind: 'COIN_LINE', coinCount: 9 },
      { lane: 1, zOffset: 38, kind: 'HURDLE' }
    ]
  },
  {
    id: 'hard_bike_weave_and_cat',
    name: 'Motorbike Swarm and Cat Dash',
    difficulty: 'HARD',
    minDistance: 900,
    weight: 10,
    length: 60,
    elements: [
      { lane: 1, zOffset: 12, kind: 'CROSSING_CAT' },
      { lane: 0, zOffset: 20, kind: 'BIKE' },
      { lane: 2, zOffset: 24, kind: 'BIKE' },
      { lane: 1, zOffset: 38, kind: 'POWERUP', powerupType: 'CNG' }
    ]
  },
  {
    id: 'hard_metro_express_pinch',
    name: 'Double Metro Bus Pinch',
    difficulty: 'HARD',
    minDistance: 950,
    weight: 9,
    length: 70,
    elements: [
      { lane: 0, zOffset: 15, kind: 'BUS' },
      { lane: 1, zOffset: 34, kind: 'BUS' },
      { lane: 2, zOffset: 15, kind: 'COIN_LINE', coinCount: 8 },
      { lane: 2, zOffset: 50, kind: 'CAR' }
    ]
  },
  {
    id: 'hard_master_slalom_gauntlet',
    name: 'Mall Road Grand Master Gauntlet',
    difficulty: 'HARD',
    minDistance: 1100,
    weight: 9,
    length: 75,
    elements: [
      { lane: 0, zOffset: 14, kind: 'FRUIT_CART' },
      { lane: 1, zOffset: 28, kind: 'COW' },
      { lane: 2, zOffset: 42, kind: 'CAR' },
      { lane: 0, zOffset: 56, kind: 'HURDLE' },
      { lane: 1, zOffset: 58, kind: 'COIN_LINE', coinCount: 7 }
    ]
  },
  {
    id: 'hard_cng_emergency_gauntlet',
    name: 'Zero-Fuel Survival Dash',
    difficulty: 'HARD',
    minDistance: 1200,
    weight: 8,
    length: 70,
    elements: [
      { lane: 0, zOffset: 15, kind: 'BUS' },
      { lane: 2, zOffset: 16, kind: 'PYLON' },
      { lane: 1, zOffset: 18, kind: 'POWERUP', powerupType: 'CNG' },
      { lane: 1, zOffset: 40, kind: 'RICKSHAW' },
      { lane: 0, zOffset: 54, kind: 'CAR' }
    ]
  }
];

/**
 * Validates that a pattern never completely blocks all 3 lanes on either level (0 or 1),
 * and that consecutive hazard rows are reachable with single lane changes.
 */
export function validatePattern(pattern: SpawnPattern, playerSpeed: number): boolean {
  // 1. Check all elements are in valid lanes 0, 1, 2
  for (const el of pattern.elements) {
    if (el.lane < 0 || el.lane > 2) return false;
  }

  // Validate both level 0 (ground) and level 1 (flyover deck) independently
  for (const checkLevel of [0, 1] as const) {
    const levelElements = pattern.elements.filter((e) => (e.level ?? 0) === checkLevel);
    if (levelElements.length === 0) continue;

    // 2. Window slice check: at any z position, there cannot be 3 blocking hazards occupying lanes 0, 1, and 2 simultaneously.
    const blockingHazards = levelElements.filter(
      (e) => e.kind !== 'COIN_LINE' && e.kind !== 'POWERUP' && e.kind !== 'CROSSING_CAT'
    );

    for (let z = 0; z <= pattern.length; z += 2.0) {
      const blockedLanes = new Set<number>();
      for (const h of blockingHazards) {
        const lengthTolerance = h.kind === 'BUS' || h.kind === 'BEDFORD' ? 4.5 : 2.5;
        if (Math.abs(h.zOffset - z) < lengthTolerance) {
          blockedLanes.add(h.lane);
        }
      }
      if (blockedLanes.size >= 3) {
        return false;
      }
    }

    // 3. Reachability check:
    const minReactionTime = 0.28; // seconds
    const minSafeZGap = Math.max(8.0, playerSpeed * minReactionTime);

    const sortedHazards = [...blockingHazards].sort((a, b) => a.zOffset - b.zOffset);
    for (let i = 0; i < sortedHazards.length - 1; i++) {
      const cur = sortedHazards[i];
      const next = sortedHazards[i + 1];
      const zGap = next.zOffset - cur.zOffset;

      if (zGap < minSafeZGap && cur.lane !== next.lane) {
        const remainingLane = 3 - cur.lane - next.lane;
        const isRemainingClear = !sortedHazards.some(
          (h) => h.lane === remainingLane && Math.abs(h.zOffset - cur.zOffset) < minSafeZGap
        );
        if (!isRemainingClear) {
          return false;
        }
      }
    }

    // 4. Never spawn two different power pickups in the same pattern row (±3.5m Z window)
    // and never place a powerup inside a blocking obstacle at the same lane & zOffset.
    const powerupElements = levelElements.filter((e) => e.kind === 'POWERUP');
    for (let i = 0; i < powerupElements.length; i++) {
      const p1 = powerupElements[i];
      for (const h of blockingHazards) {
        if (h.lane === p1.lane && Math.abs(h.zOffset - p1.zOffset) < 3.5) {
          return false;
        }
      }
      for (let j = i + 1; j < powerupElements.length; j++) {
        const p2 = powerupElements[j];
        if (Math.abs(p1.zOffset - p2.zOffset) < 4.0) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Phase 4 & 5: Generates a balanced, solvable elevated Flyover layout (both level 1 deck + level 0 underpass)
 * and validates all Phase 5 fairness rules:
 * 1. At least one reachable lane at each row on each level (0 and 1).
 * 2. Ramp entrance never leads into an unavoidable hazard.
 * 3. First 15 units of the deck after the up-ramp are completely clear of hazards.
 * 4. Last 20 units before the down-ramp AND first 20 units after the down-ramp are completely clear.
 * 5. Minimum reaction distance (`speed * 0.45 s`) is respected between consecutive hazard rows on the deck.
 * 6. Underpass (`level = 0`) never spawns tall `PYLON` towers that would clip through the deck ceiling.
 */
export function generateFlyoverDeckElements(
  deckLength: number,
  playerSpeed: number,
  rampLanes: number[] = [0, 1],
  rng: () => number = Math.random
): PatternElement[] {
  const elements: PatternElement[] = [];
  const minReactionGap = Math.max(12.0, playerSpeed * GAME_CONFIG.MIN_REACTION_TIME); // speed * 0.45s
  const clearStart = GAME_CONFIG.FLYOVER_ENTRY_CLEAR_LEN; // 15m clear after ramp top
  const clearEnd = deckLength - GAME_CONFIG.FLYOVER_EXIT_CLEAR_LEN; // last 20m before down-ramp clear

  const deckHazardTypes: PatternHazardKind[] = ['HURDLE', 'CAR', 'BIKE', 'LOW_BEAM', 'RICKSHAW'];
  let prevDeckLane = -1;

  // Populate elevated deck (level = 1) with safe spacing >= minReactionGap
  for (let z = clearStart + 2.0; z <= clearEnd - 2.0; z += minReactionGap + 2.5) {
    // Pick 1 lane to block, leaving 2 reachable open lanes on the deck
    const openLane = Math.floor(rng() * 3);
    const hazardKind = deckHazardTypes[Math.floor(rng() * deckHazardTypes.length)];
    let blockedLane = (openLane + 1 + Math.floor(rng() * 2)) % 3;
    if (blockedLane === prevDeckLane && rng() < 0.5) {
      blockedLane = (blockedLane + 1) % 3;
      if (blockedLane === openLane) blockedLane = (openLane + 2) % 3;
    }
    prevDeckLane = blockedLane;

    elements.push({
      lane: blockedLane,
      zOffset: z,
      kind: hazardKind,
      level: 1
    });

    // Dense 1.5x coin line on the open lane!
    elements.push({
      lane: openLane,
      zOffset: z,
      kind: 'COIN_LINE',
      coinCount: Math.round(6 * GAME_CONFIG.FLYOVER_COIN_DENSITY_MULT), // 9 coins (1.5x density)
      level: 1
    });
  }

  // Reward pickup on the elevated deck in an open lane near midpoint
  const midZ = Math.min(clearEnd - 4, Math.max(clearStart + 4, deckLength * 0.5));
  let rewardLane = rampLanes[0] ?? 1;
  for (let candidate = 0; candidate < 3; candidate++) {
    const conflict = elements.some(
      (e) => e.level === 1 && e.kind !== 'COIN_LINE' && e.lane === candidate && Math.abs(e.zOffset - midZ) < 6.0
    );
    if (!conflict) {
      rewardLane = candidate;
      break;
    }
  }
  elements.push({
    lane: rewardLane,
    zOffset: midZ,
    kind: 'POWERUP',
    powerupType: rng() < 0.65 ? 'FUEL_DRUM' : 'SHIELD_STANDARD',
    level: 1
  });

  // Populate ground underpass (level = 0) ONLY in openGroundLanes (never in the walled rampLanes!)
  const openGroundLanes = [0, 1, 2].filter((l) => !rampLanes.includes(l));
  if (openGroundLanes.length > 0) {
    // If only 1 ground lane is open beside a 2-lane ramp, keep it clear of blocking vehicles and place jumpable hurdles + coins
    // If 2 ground lanes are open beside a 1-lane ramp, place normal ground traffic in 1 lane and leave the other open
    const groundHazardTypes: PatternHazardKind[] =
      openGroundLanes.length >= 2
        ? ['CAR', 'BIKE', 'FRUIT_CART', 'HURDLE', 'BUS']
        : ['HURDLE'];

    for (let z = 12.0; z <= deckLength - 12.0; z += minReactionGap + 5.0) {
      const openIdx = Math.floor(rng() * openGroundLanes.length);
      const coinLane = openGroundLanes[openIdx];
      const hazardLane =
        openGroundLanes.length >= 2
          ? openGroundLanes[(openIdx + 1) % openGroundLanes.length]
          : openGroundLanes[0];
      const gKind = groundHazardTypes[Math.floor(rng() * groundHazardTypes.length)];

      elements.push({
        lane: hazardLane,
        zOffset: z,
        kind: gKind,
        level: 0
      });

      if (openGroundLanes.length >= 2 || z + 8.0 <= deckLength - 12.0) {
        elements.push({
          lane: coinLane,
          zOffset: openGroundLanes.length >= 2 ? z : z + 6.5,
          kind: 'COIN_LINE',
          coinCount: 6,
          level: 0
        });
      }
    }
  }

  return elements;
}

/**
 * Phase 5 Validator for (lane, level) flyover chunks:
 * Verifies:
 * - At least 1 open ground lane beside the ramp (`rampLanes.length <= 2`) so the flyover is never mandatory
 * - First 15 units of deck (`level = 1`) after up-ramp have 0 hazards
 * - Last 20 units of deck (`level = 1`) before down-ramp have 0 hazards
 * - Ground hazards (`level = 0`) are never placed inside walled `rampLanes` and never exceed `DECK_CLEARANCE`
 * - Minimum reaction distance (`speed * 0.45s`) between consecutive rows on different lanes
 * - At least one reachable lane at every Z slice on both `level = 0` and `level = 1`,
 *   accounting for vehicle hitbox width (`veh.hitbox.width <= 3.6`) and jump clearance.
 */
export function validateFlyoverChunk(
  elements: PatternElement[],
  deckLength: number,
  playerSpeed: number,
  vehicleId: VehicleId = 'rickshaw',
  rampLanes: number[] = [0, 1]
): boolean {
  const veh = PLAYABLE_VEHICLES[vehicleId] || PLAYABLE_VEHICLES.rickshaw;
  const minReactionDist = playerSpeed * GAME_CONFIG.MIN_REACTION_TIME; // speed * 0.45s
  const clearStart = GAME_CONFIG.FLYOVER_ENTRY_CLEAR_LEN; // 15m
  const clearEnd = deckLength - GAME_CONFIG.FLYOVER_EXIT_CLEAR_LEN; // deckLength - 20m

  // 1. Vehicle must fit inside lane width (4.0m between pillars) and under DECK_CLEARANCE (5.2m)
  if (veh.hitbox.height >= GAME_CONFIG.DECK_CLEARANCE - 0.3 || veh.hitbox.width >= 3.6) {
    return false;
  }

  // 2. Flyover must never be mandatory: at least 1 ground lane must stay open beside the ramp
  const openGroundLanes = [0, 1, 2].filter((l) => !rampLanes.includes(l));
  if (openGroundLanes.length === 0) {
    return false;
  }

  const deckHazards = elements.filter(
    (e) => (e.level ?? 0) === 1 && e.kind !== 'COIN_LINE' && e.kind !== 'POWERUP'
  );
  const groundHazards = elements.filter(
    (e) => (e.level ?? 0) === 0 && e.kind !== 'COIN_LINE' && e.kind !== 'POWERUP'
  );

  // 3. First 15m and last 20m of deck must be completely clear of hazards
  for (const h of deckHazards) {
    if (h.zOffset < clearStart - 1e-3 || h.zOffset > clearEnd + 1e-3) {
      return false;
    }
  }

  // 4. Ground underpass hazards must be in openGroundLanes, never PYLON, and if only 1 open ground lane exists, must be jumpable (HURDLE)
  for (const gh of groundHazards) {
    if (gh.kind === 'PYLON') return false;
    if (!openGroundLanes.includes(gh.lane)) return false;
    if (openGroundLanes.length === 1 && gh.kind !== 'HURDLE') return false;
  }

  // 5. Check deck (level = 1) for at least 1 reachable open lane at every Z slice and reaction gap >= speed * 0.45s
  for (let z = 0; z <= deckLength; z += 2.0) {
    const blockedDeck = new Set<number>();
    for (const h of deckHazards) {
      if (Math.abs(h.zOffset - z) < 3.5) {
        blockedDeck.add(h.lane);
      }
    }
    if (blockedDeck.size >= 3) return false;

    const blockedGround = new Set<number>();
    for (const gh of groundHazards) {
      if (gh.kind !== 'HURDLE' && Math.abs(gh.zOffset - z) < 3.5) {
        blockedGround.add(gh.lane);
      }
    }
    if (blockedGround.size >= openGroundLanes.length) return false;
  }

  for (const hazardList of [deckHazards, groundHazards]) {
    const sorted = [...hazardList].sort((a, b) => a.zOffset - b.zOffset);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const dz = b.zOffset - a.zOffset;
      if (a.lane !== b.lane && dz < minReactionDist - 1e-3) {
        const thirdLane = 3 - a.lane - b.lane;
        const thirdBlocked = sorted.some(
          (h) => h.lane === thirdLane && Math.abs(h.zOffset - a.zOffset) < minReactionDist
        );
        if (thirdBlocked) return false;
      }
    }
  }

  return true;
}

/**
 * Phase 5 Headless Test: Generates 10,000 flyover chunks across every vehicle in the roster
 * (including widest Bedford Truck and lowest-jump vehicles) at max difficulty and confirms
 * every chunk is 100% solvable. Prints any failing seeds.
 */
export function runHeadlessFlyoverValidation(chunksCount: number = 10000): {
  tested: number;
  passed: number;
  failedSeeds: number[];
  vehiclesTested: VehicleId[];
  passRate: number;
} {
  const vehicleIds = Object.keys(PLAYABLE_VEHICLES) as VehicleId[];
  const failedSeeds: number[] = [];
  let passed = 0;
  const rampOptions: number[][] = [[0, 1], [1, 2], [1]];

  for (let seed = 1; seed <= chunksCount; seed++) {
    let state = (seed * 1664525 + 1013904223) >>> 0;
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0xffffffff;
    };

    const vehicleId = vehicleIds[seed % vehicleIds.length];
    const veh = PLAYABLE_VEHICLES[vehicleId];
    const maxSpeed = GAME_CONFIG.MAX_SPEED * veh.speedMultiplier;
    const deckLength = 80 + Math.floor(rng() * 81); // 80 to 160 units
    const rampLanes = rampOptions[seed % rampOptions.length];

    const elements = generateFlyoverDeckElements(deckLength, maxSpeed, rampLanes, rng);
    if (validateFlyoverChunk(elements, deckLength, maxSpeed, vehicleId, rampLanes)) {
      passed++;
    } else {
      failedSeeds.push(seed);
    }
  }

  return {
    tested: chunksCount,
    passed,
    failedSeeds,
    vehiclesTested: vehicleIds,
    passRate: passed / chunksCount
  };
}

/**
 * Weighted selector based on player distance.
 * As distance grows, hard patterns receive exponentially higher selection weights.
 */
export function selectPattern(distance: number, playerSpeed: number): SpawnPattern {
  // Filter eligible patterns by minDistance
  const eligible = SPAWN_PATTERNS.filter((p) => distance >= p.minDistance);
  if (eligible.length === 0) return SPAWN_PATTERNS[0];

  // Dynamic weights based on distance
  const weighted = eligible.map((p) => {
    let weight = p.weight;
    if (p.difficulty === 'EASY') {
      // Drops from 1.0 down to 0.2 at 1000m
      weight *= Math.max(0.2, 1.0 - (distance / 1200) * 0.8);
    } else if (p.difficulty === 'MEDIUM') {
      // Peaks around 500m - 1200m
      weight *= distance > 300 ? 1.5 : 0.8;
    } else if (p.difficulty === 'HARD') {
      // Scales up sharply with distance
      weight *= Math.min(3.5, 0.8 + (distance / 600) * 1.8);
    }
    return { pattern: p, weight };
  });

  const totalWeight = weighted.reduce((sum, item) => sum + Math.max(0.001, item.weight), 0);
  if (!isFinite(totalWeight) || totalWeight <= 0) {
    return eligible[0] || SPAWN_PATTERNS[0];
  }
  let roll = Math.random() * totalWeight;

  for (const item of weighted) {
    roll -= Math.max(0.001, item.weight);
    if (roll <= 0) {
      if (validatePattern(item.pattern, playerSpeed)) {
        return item.pattern;
      }
    }
  }

  // Fallback to first valid pattern
  for (const item of weighted) {
    if (validatePattern(item.pattern, playerSpeed)) {
      return item.pattern;
    }
  }
  return eligible[0] || SPAWN_PATTERNS[0];
}

/**
 * Headless test validating procedural patterns over N chunks across speed & vehicle dimensions.
 * Ensures every selected pattern leaves at least one open lane and consecutive rows are reachable.
 */
export function runHeadlessPatternValidation(
  chunksCount: number = 10000,
  vehicleLaneSpeed: number = 22.0
): { tested: number; valid: number; rejectedAndRerolled: number; passRate: number } {
  let valid = 0;
  let rejectedAndRerolled = 0;

  for (let i = 0; i < chunksCount; i++) {
    // Test distances from 0 to 6000m
    const simulatedDist = (i * 0.6) % 6000;
    // Test speeds from 18 to 48 units/s
    const simulatedSpeed = 18 + (48 - 18) * (1 - Math.exp(-simulatedDist / 2500));

    const pattern = selectPattern(simulatedDist, simulatedSpeed);
    if (validatePattern(pattern, simulatedSpeed)) {
      valid++;
    } else {
      rejectedAndRerolled++;
    }
  }

  return {
    tested: chunksCount,
    valid,
    rejectedAndRerolled,
    passRate: valid / chunksCount
  };
}
