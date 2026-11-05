import { VehicleId, MysteryVehicleId } from './config';

export interface VehicleHitbox {
  width: number;
  length: number;
  height: number;
}

export type SpecialAbilityType =
  | 'HORN_BLAST'
  | 'CARGO_BUMP'
  | 'SMASH_ARMOR'
  | 'NARROW_DODGE'
  | 'WOBBLE_DRIFT'
  | 'TRACTOR_CRUSH'
  | 'HORSE_SPRINT';

export interface VehicleDef {
  id: VehicleId;
  name: string;
  tagline: string;
  description: string;
  price: number;
  unlockedByDefault: boolean;
  hitbox: VehicleHitbox;
  jumpImpulse: number;
  laneSpeed: number;
  speedMultiplier: number;
  specialAbility: SpecialAbilityType;
  abilityDescription: string;
  enginePitch: number; // Base frequency in Hz
  hornTone: number;    // Horn frequency in Hz
  stats: {
    speed: number;     // 1 to 5
    agility: number;   // 1 to 5
    jump: number;      // 1 to 5
    armor: number;     // 1 to 5
  };
}

export const PLAYABLE_VEHICLES: Record<VehicleId, VehicleDef> = {
  rickshaw: {
    id: 'rickshaw',
    name: 'Sultan Auto Rickshaw',
    tagline: 'The Legendary King of Lahore',
    description: 'Iconic three-wheeled champion adorned with traditional peacock truck-art. Balanced agility and iconic pressure horn blast.',
    price: 0,
    unlockedByDefault: true,
    hitbox: { width: 1.4, length: 2.5, height: 1.9 },
    jumpImpulse: 13.5,
    laneSpeed: 22.0,
    speedMultiplier: 1.0,
    specialAbility: 'HORN_BLAST',
    abilityDescription: 'Loud horn scatters pedestrians & stray cattle for bonus points',
    enginePitch: 34,
    hornTone: 380,
    stats: {
      speed: 3,
      agility: 4,
      jump: 3,
      armor: 2
    }
  },
  bolan: {
    id: 'bolan',
    name: 'Suzuki Bolan "Dabba"',
    tagline: 'Indestructible Family Workhorse',
    description: 'The ubiquitous Pakistani white van. Sturdy boxy frame with extra cargo capacity and higher hydraulic jump clearance.',
    price: 350,
    unlockedByDefault: false,
    hitbox: { width: 1.8, length: 3.2, height: 1.8 },
    jumpImpulse: 14.8,
    laneSpeed: 19.0,
    speedMultiplier: 1.02,
    specialAbility: 'CARGO_BUMP',
    abilityDescription: 'Heavy steel front bumper smashes fruit carts and hurdles without shield loss',
    enginePitch: 42,
    hornTone: 440,
    stats: {
      speed: 3,
      agility: 3,
      jump: 4,
      armor: 4
    }
  },
  truck: {
    id: 'truck',
    name: 'Bedford Shahzore Truck',
    tagline: 'Crown of the Grand Trunk Road',
    description: 'Majestic master of the highway with wooden carvings, reflective poetry, and heavy steel chassis. Crushes 1 bus or roadblock per run.',
    price: 750,
    unlockedByDefault: false,
    hitbox: { width: 2.4, length: 4.2, height: 2.8 },
    jumpImpulse: 12.0,
    laneSpeed: 16.0,
    speedMultiplier: 0.98,
    specialAbility: 'SMASH_ARMOR',
    abilityDescription: 'Gargantuan heavy chassis absorbs 1 fatal vehicle crash completely',
    enginePitch: 28,
    hornTone: 260,
    stats: {
      speed: 2,
      agility: 2,
      jump: 2,
      armor: 5
    }
  },
  motorbike: {
    id: 'motorbike',
    name: 'Lahore CD70 Rebel',
    tagline: 'Razor-Sharp Alley Striker',
    description: 'Lightweight, ultra-nimble two-wheeler. Glides between narrow traffic gaps with ease and earns 2x near-miss close call bonuses.',
    price: 250,
    unlockedByDefault: false,
    hitbox: { width: 0.85, length: 1.9, height: 1.4 },
    jumpImpulse: 12.5,
    laneSpeed: 28.0,
    speedMultiplier: 1.06,
    specialAbility: 'NARROW_DODGE',
    abilityDescription: 'Ultra-thin profile earns double Near-Miss combo bonuses in tight gaps',
    enginePitch: 52,
    hornTone: 520,
    stats: {
      speed: 5,
      agility: 5,
      jump: 2,
      armor: 1
    }
  },
  chingchi: {
    id: 'chingchi',
    name: 'Chingchi Express',
    tagline: 'High-Capacity Passenger Wobbler',
    description: 'Motorbike-pulled passenger carriage with colorful awnings. Its eccentric physics wobble generates extra score drift multipliers.',
    price: 500,
    unlockedByDefault: false,
    hitbox: { width: 1.6, length: 3.0, height: 2.1 },
    jumpImpulse: 13.0,
    laneSpeed: 21.0,
    speedMultiplier: 1.01,
    specialAbility: 'WOBBLE_DRIFT',
    abilityDescription: 'Dynamic carriage sway awards +15% continuous drift score bonus',
    enginePitch: 38,
    hornTone: 410,
    stats: {
      speed: 4,
      agility: 3,
      jump: 3,
      armor: 3
    }
  }
};

export interface MysteryTransformationDef {
  id: MysteryVehicleId;
  name: string;
  tagline: string;
  duration: number;
  ability: SpecialAbilityType;
  description: string;
}

export const MYSTERY_TRANSFORMATIONS: Record<MysteryVehicleId, MysteryTransformationDef> = {
  tractor: {
    id: 'tractor',
    name: 'Millat Desi Tractor',
    tagline: 'Heavy Industrial Crusher',
    duration: 10.0,
    ability: 'TRACTOR_CRUSH',
    description: 'Plow through cars, fruit carts, and hurdles with unstoppable raw torque!'
  },
  tonga: {
    id: 'tonga',
    name: 'Shahi Tonga Horse-Cart',
    tagline: 'Old Lahore Royal Trotter',
    duration: 10.0,
    ability: 'HORSE_SPRINT',
    description: 'Gallop at blinding speeds while vacuuming coins from all lanes!'
  }
};

const STORAGE_UNLOCKED_KEY = 'rickshaw_unlocked_vehicles';
const STORAGE_SELECTED_KEY = 'rickshaw_selected_vehicle';

export function getUnlockedVehicles(): VehicleId[] {
  try {
    const saved = localStorage.getItem(STORAGE_UNLOCKED_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as VehicleId[];
      }
    }
  } catch {
    // fallback
  }
  return ['rickshaw'];
}

export function unlockVehicle(id: VehicleId): boolean {
  const current = getUnlockedVehicles();
  if (!current.includes(id)) {
    current.push(id);
    localStorage.setItem(STORAGE_UNLOCKED_KEY, JSON.stringify(current));
    return true;
  }
  return false;
}

export function getSelectedVehicle(): VehicleId {
  const saved = localStorage.getItem(STORAGE_SELECTED_KEY) as VehicleId | null;
  if (saved && PLAYABLE_VEHICLES[saved]) {
    return saved;
  }
  return 'rickshaw';
}

export function setSelectedVehicle(id: VehicleId): void {
  localStorage.setItem(STORAGE_SELECTED_KEY, id);
}
