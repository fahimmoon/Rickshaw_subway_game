/**
 * Shared Coordinate System, Scale Table, and Palette Standards
 *
 * 1. COORDINATE SYSTEM AND ORIENTATION:
 *    - Units: 1 unit = 1 meter
 *    - Forward = -Z, Up = +Y, Right = +X
 *    - Origin: Ground level (y = 0), centered on X and Z (x = 0, z = 0)
 *    - Default facing direction: -Z
 */

export const LANE_WIDTH = 3.5; // meters (no vehicle may exceed 2.6 m wide)
export const NUM_LANES = 3;
export const LANE_CENTERS: number[] = [-LANE_WIDTH, 0, LANE_WIDTH]; // [-3.5, 0, 3.5]
export const ROAD_SURFACE_WIDTH = LANE_WIDTH * NUM_LANES; // 10.5 m
export const SIDEWALK_WIDTH = 4.5; // meters
export const BUILDING_SETBACK = 1.5; // consistent setback from sidewalk edge

export interface VehicleSpec {
  id: string;
  name: string;
  length: number;      // Z dimension (meters)
  width: number;       // X dimension (meters)
  height: number;      // Y dimension (meters)
  wheelRadius: number; // Shared wheel radius (meters)
  wheelWidth: number;  // Wheel tire width along X (meters)
  clearance: number;   // Ground clearance above wheel axle (meters)
  wheelbaseRatio: number; // Front/rear Z axle offset as fraction of length
  defaultColor: number;
}

/**
 * 2. REAL-WORLD SCALE TABLE (length x width x height, meters)
 * - Car/hatchback: 3.8 x 1.7 x 1.5
 * - Sedan: 4.5 x 1.8 x 1.45
 * - Ambulance (van): 5.2 x 2.0 x 2.4
 * - Auto-rickshaw: 2.6 x 1.3 x 1.7
 * - Bus: 10 x 2.5 x 3.2
 * - Truck: 8 x 2.4 x 3.2
 * - Motorcycle: 2.0 x 0.8 x 1.1
 * - Pedestrian: 0.5 x 0.3 x 1.7
 */
export const VEHICLE_SPECS = {
  car: {
    id: 'car',
    name: 'Car / Hatchback',
    length: 3.8,
    width: 1.7,
    height: 1.5,
    wheelRadius: 0.35,
    wheelWidth: 0.22,
    clearance: 0.20,
    wheelbaseRatio: 0.31,
    defaultColor: 0x0284c7
  },
  sedan: {
    id: 'sedan',
    name: 'Sedan',
    length: 4.5,
    width: 1.8,
    height: 1.45,
    wheelRadius: 0.35,
    wheelWidth: 0.22,
    clearance: 0.20,
    wheelbaseRatio: 0.32,
    defaultColor: 0xe11d48
  },
  ambulance: {
    id: 'ambulance',
    name: 'Ambulance (Van)',
    length: 5.2,
    width: 2.0,
    height: 2.4,
    wheelRadius: 0.45,
    wheelWidth: 0.26,
    clearance: 0.20,
    wheelbaseRatio: 0.32,
    defaultColor: 0xf8fafc
  },
  auto: {
    id: 'auto',
    name: 'Auto-Rickshaw',
    length: 2.6,
    width: 1.3,
    height: 1.7,
    wheelRadius: 0.26,
    wheelWidth: 0.16,
    clearance: 0.16,
    wheelbaseRatio: 0.33,
    defaultColor: 0x15803d
  },
  bus: {
    id: 'bus',
    name: 'City Bus',
    length: 10.0,
    width: 2.5,
    height: 3.2,
    wheelRadius: 0.50,
    wheelWidth: 0.30,
    clearance: 0.20,
    wheelbaseRatio: 0.31,
    defaultColor: 0xdc2626
  },
  truck: {
    id: 'truck',
    name: 'Highway Truck',
    length: 8.0,
    width: 2.4,
    height: 3.2,
    wheelRadius: 0.50,
    wheelWidth: 0.30,
    clearance: 0.20,
    wheelbaseRatio: 0.31,
    defaultColor: 0xd97706
  },
  bike: {
    id: 'bike',
    name: 'Motorcycle',
    length: 2.0,
    width: 0.8,
    height: 1.1,
    wheelRadius: 0.30,
    wheelWidth: 0.14,
    clearance: 0.15,
    wheelbaseRatio: 0.35,
    defaultColor: 0xdc2626
  },
  pedestrian: {
    id: 'pedestrian',
    name: 'Pedestrian',
    length: 0.5,
    width: 0.3,
    height: 1.7,
    wheelRadius: 0,
    wheelWidth: 0,
    clearance: 0,
    wheelbaseRatio: 0,
    defaultColor: 0x2563eb
  }
} as const satisfies Record<string, VehicleSpec>;

export type VehicleSpecKey = keyof typeof VEHICLE_SPECS;

export interface PropSpec {
  length: number; // Z
  width: number;  // X
  height: number; // Y
}

export const PROP_SPECS: Record<string, PropSpec> = {
  tree: { length: 2.8, width: 2.8, height: 6.5 },
  shopStall: { length: 4.0, width: 4.5, height: 3.4 },
  fruitCart: { length: 2.0, width: 1.5, height: 1.8 },
  hurdle: { length: 0.6, width: 2.4, height: 1.05 },
  cow: { length: 2.1, width: 0.85, height: 1.45 },
  buildingSmall: { length: 10.0, width: 10.0, height: 14.0 },
  buildingMedium: { length: 12.0, width: 12.0, height: 22.0 },
  buildingTall: { length: 12.0, width: 12.0, height: 30.0 }
};

/**
 * Curated Low-Poly Color Palette (no random chaotic colors)
 */
export const LOW_POLY_PALETTE = {
  cars: [0x0284c7, 0xe11d48, 0xf59e0b, 0x10b981, 0x7c3aed, 0xf8fafc],
  sedans: [0x1e293b, 0x991b1b, 0x0369a1, 0xd97706, 0x475569],
  buses: [0xdc2626, 0x16a34a, 0x2563eb],
  trucks: [0xd97706, 0xb91c1c, 0x15803d],
  bikes: [0xdc2626, 0x1e293b, 0x2563eb],
  pedestrianShirts: [0x2563eb, 0xd97706, 0x059669, 0x7c3aed, 0xe11d48, 0xf8fafc],
  pedestrianPants: [0x1e293b, 0x334155, 0x475569],
  buildings: [0xe2e8f0, 0xfef3c7, 0xfde68a, 0xfed7aa, 0xcbd5e1, 0xfecdd3],
  windowDarkBlue: 0x1e3a5f,
  tireRubber: 0x171717,
  hubcapSilver: 0xe2e8f0,
  bumperDark: 0x1e293b,
  headlightWarm: 0xfef08a,
  taillightRed: 0xef4444,
  ambulanceWhite: 0xf8fafc,
  ambulanceRed: 0xdc2626,
  sirenBlue: 0x3b82f6,
  autoGreen: 0x15803d,
  autoYellow: 0xfacc15
} as const;

