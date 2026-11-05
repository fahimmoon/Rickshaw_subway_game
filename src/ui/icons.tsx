import React from 'react';
import { HudIconId } from '../game/config';

export interface PickupIconProps {
  className?: string;
  size?: number;
  colorblindMode?: boolean;
}

/**
 * Helper badge rendered in colorblind-friendly mode: high-contrast pattern + letter badge (F, S, J)
 */
const ColorblindBadge: React.FC<{ letter: 'F' | 'S' | 'J'; bg: string }> = ({ letter, bg }) => (
  <g>
    <rect x="40" y="4" width="20" height="20" rx="5" fill={bg} stroke="#ffffff" strokeWidth="2" />
    <text
      x="50"
      y="18"
      textAnchor="middle"
      fill="#ffffff"
      fontSize="13"
      fontWeight="900"
      fontFamily="monospace"
    >
      {letter}
    </text>
  </g>
);

/**
 * 1. Jerry Can (Small Fuel Pickup): Red-orange rectangular can with top handle, angled spout, and X-ribbed sides
 */
export const FuelCan: React.FC<PickupIconProps> = ({ className = '', size = 32, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Jerry Can Fuel">
    <defs>
      <pattern id="cb-fuel-stripes" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" />
      </pattern>
    </defs>
    {/* Angled Pour Spout */}
    <path d="M16 18 L10 9 L16 6 L23 15 Z" fill="#facc15" stroke="#7c2d12" strokeWidth="2" />
    {/* Top Grip Handle */}
    <path d="M24 16 V10 H44 V16" stroke="#ea580c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    {/* Main Can Body */}
    <rect x="14" y="16" width="36" height="42" rx="6" fill="#f97316" stroke="#fed7aa" strokeWidth="2.5" />
    {colorblindMode && <rect x="14" y="16" width="36" height="42" rx="6" fill="url(#cb-fuel-stripes)" />}
    {/* Recessed X-Stamping Ribs */}
    <rect x="20" y="23" width="24" height="28" rx="3" fill="#c2410c" />
    <path d="M23 26 L41 48 M41 26 L23 48" stroke="#ffedd5" strokeWidth="3" strokeLinecap="round" />
    <circle cx="32" cy="37" r="4.5" fill="#facc15" />
    {colorblindMode && <ColorblindBadge letter="F" bg="#c2410c" />}
  </svg>
);

/**
 * 2. Fuel Drum (Large Fuel Pickup): Blue-gray cylindrical steel barrel with bold yellow center stripe and chime rings
 */
export const FuelDrum: React.FC<PickupIconProps> = ({ className = '', size = 32, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Fuel Drum">
    {/* Barrel Body */}
    <rect x="14" y="8" width="36" height="48" rx="6" fill="#2563eb" stroke="#93c5fd" strokeWidth="2.5" />
    {/* Yellow Center Caution Band */}
    <rect x="14" y="24" width="36" height="16" fill="#facc15" />
    {/* Horizontal Rolling Hoops / Ribs */}
    <rect x="12" y="7" width="40" height="4" rx="2" fill="#cbd5e1" />
    <rect x="12" y="22" width="40" height="3.5" rx="1.5" fill="#94a3b8" />
    <rect x="12" y="38.5" width="40" height="3.5" rx="1.5" fill="#94a3b8" />
    <rect x="12" y="53" width="40" height="4" rx="2" fill="#cbd5e1" />
    {/* Fuel Drop Emblem in Center */}
    <path d="M32 26 C32 26 27 32 27 35 C27 37.8 29.2 40 32 40 C34.8 40 37 37.8 37 35 C37 32 32 26 32 26 Z" fill="#dc2626" />
    {colorblindMode && <ColorblindBadge letter="F" bg="#1e40af" />}
  </svg>
);

/**
 * 3. Golden Fuel Can (Rare Bonus): Radiant gold jerry can with crown star and 100% no-drain aura
 */
export const GoldenFuel: React.FC<PickupIconProps> = ({ className = '', size = 32, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Golden Fuel Can">
    {/* Outer Radiant Halo */}
    <circle cx="32" cy="34" r="27" stroke="#fde047" strokeWidth="2" strokeDasharray="4 3" />
    {/* Pour Spout */}
    <path d="M16 18 L9 8 L16 5 L23 15 Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
    {/* Twin Crowned Handle */}
    <path d="M23 16 V9 H45 V16" stroke="#facc15" strokeWidth="4.5" strokeLinecap="round" />
    {/* Gold Body */}
    <rect x="13" y="16" width="38" height="42" rx="7" fill="#eab308" stroke="#fef9c3" strokeWidth="3" />
    {/* Inner Star Medallion */}
    <polygon
      points="32,23 35,32 44,32 37,37 39,46 32,41 25,46 27,37 20,32 29,32"
      fill="#ffffff"
      stroke="#b45309"
      strokeWidth="1.5"
    />
    {colorblindMode && <ColorblindBadge letter="F" bg="#854d0e" />}
  </svg>
);

/**
 * 4. Petrol Pump (HUD Gauge Icon): Classic vintage fuel dispenser with nozzle and hose
 */
export const PetrolPump: React.FC<PickupIconProps> = ({ className = '', size = 24, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Petrol Pump Gauge">
    {/* Pump Cabinet */}
    <rect x="14" y="10" width="28" height="46" rx="4" fill="#f97316" stroke="#ffedd5" strokeWidth="2.5" />
    {/* Meter Screen */}
    <rect x="19" y="16" width="18" height="12" rx="2" fill="#fef08a" stroke="#7c2d12" strokeWidth="1.5" />
    {/* Pump Base */}
    <rect x="10" y="54" width="36" height="5" rx="2" fill="#cbd5e1" />
    {/* Flexible Fuel Hose & Nozzle */}
    <path
      d="M42 24 H49 C52 24 54 26 54 30 V44 C54 48 50 50 47 48 L42 42"
      stroke="#fbbf24"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M48 16 L55 11" stroke="#fef08a" strokeWidth="4" strokeLinecap="round" />
    {colorblindMode && <ColorblindBadge letter="F" bg="#9a3412" />}
  </svg>
);

/**
 * 5. Standard Shield: Truck-art rounded crest with peacock-feather motif and gold border in cyan-blue
 */
export const Shield: React.FC<PickupIconProps> = ({ className = '', size = 32, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Standard Shield">
    <defs>
      <pattern id="cb-shield-dots" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1.6" fill="rgba(255,255,255,0.3)" />
      </pattern>
    </defs>
    {/* Truck-Art Rounded Crest Silhouette */}
    <path
      d="M32 6 L54 14 V30 C54 45 44 54 32 59 C20 54 10 45 10 30 V14 L32 6 Z"
      fill="#06b6d4"
      stroke="#facc15"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
    {colorblindMode && (
      <path d="M32 6 L54 14 V30 C54 45 44 54 32 59 C20 54 10 45 10 30 V14 L32 6 Z" fill="url(#cb-shield-dots)" />
    )}
    {/* Peacock Feather Motif in Center */}
    <ellipse cx="32" cy="31" rx="11" ry="15" fill="#0e7490" stroke="#67e8f9" strokeWidth="1.5" />
    <ellipse cx="32" cy="29" rx="7" ry="10" fill="#10b981" />
    <ellipse cx="32" cy="28" rx="4" ry="6" fill="#1d4ed8" />
    <circle cx="32" cy="26" r="2" fill="#fde047" />
    {colorblindMode && <ColorblindBadge letter="S" bg="#0e7490" />}
  </svg>
);

/**
 * 6. Double Shield: Royal blue crest with two stacked concentric rings (absorbs 2 collisions)
 */
export const DoubleShield: React.FC<PickupIconProps> = ({ className = '', size = 32, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Double Shield">
    {/* Outer Stacked Ring 1 */}
    <circle cx="32" cy="32" r="29" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6 3" />
    {/* Inner Stacked Ring 2 */}
    <circle cx="32" cy="32" r="25" stroke="#facc15" strokeWidth="2" />
    {/* Royal Blue Crest */}
    <path
      d="M32 8 L52 16 V30 C52 44 42 52 32 57 C22 52 12 44 12 30 V16 L32 8 Z"
      fill="#2563eb"
      stroke="#fef08a"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    {/* Dual Chevron Bars Inside Crest */}
    <path d="M21 28 L32 20 L43 28" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 38 L32 30 L43 38" stroke="#fde047" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    {colorblindMode && <ColorblindBadge letter="S" bg="#1e3a8a" />}
  </svg>
);

/**
 * 7. Golden Shield (Rare): Gold truck-art crest with diamond starburst (destroys obstacle + bonus coins)
 */
export const GoldenShield: React.FC<PickupIconProps> = ({ className = '', size = 32, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Golden Shield">
    {/* Crowned Gold Crest */}
    <path
      d="M32 5 L55 13 V30 C55 46 44 55 32 60 C20 55 9 46 9 30 V13 L32 5 Z"
      fill="#fbbf24"
      stroke="#ffffff"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
    <path
      d="M32 11 L49 17 V30 C49 42 40 49 32 53 C24 49 15 42 15 30 V17 L32 11 Z"
      fill="#d97706"
      stroke="#fef08a"
      strokeWidth="1.5"
    />
    {/* Peacock Starburst */}
    <polygon
      points="32,17 36,27 46,27 38,33 41,43 32,37 23,43 26,33 18,27 28,27"
      fill="#fef9c3"
      stroke="#0284c7"
      strokeWidth="1.5"
    />
    {colorblindMode && <ColorblindBadge letter="S" bg="#92400e" />}
  </svg>
);

/**
 * 8. Super Khussa: Stylized Pakistani Khussa shoe with curled toe ("Nok"), spring coil underneath, and upward arrow glow
 */
export const Khussa: React.FC<PickupIconProps> = ({ className = '', size = 32, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Super Khussa Jump Boost">
    {/* Upward Arrow Glow */}
    <path d="M32 4 L41 13 H35 V21 H29 V13 H23 L32 4 Z" fill="#4ade80" stroke="#fef08a" strokeWidth="1.5" />
    {/* Stylized Traditional Khussa Shoe with Curled Toe */}
    <path
      d="M12 26 H28 L35 32 H46 C51 32 55 28 55 23 C55 20 52 19 50 21 C49 23 48 26 44 26 L36 25 L26 20 H14 C11 20 10 23 12 26 Z"
      fill="#22c55e"
      stroke="#facc15"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path d="M12 26 H50 V35 C50 37 48 38 45 38 H14 C11 38 10 36 10 33 V28 C10 27 11 26 12 26 Z" fill="#16a34a" stroke="#facc15" strokeWidth="2" />
    {/* Spring Coil Under Shoe */}
    <path
      d="M18 41 L44 45 L18 49 L44 53 L18 57 H46"
      stroke="#facc15"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {colorblindMode && <ColorblindBadge letter="J" bg="#14532d" />}
  </svg>
);

/**
 * 9. Spring Boots: High-ankle twin spring boots with heavy double coils (auto-bounce)
 */
export const SpringBoots: React.FC<PickupIconProps> = ({ className = '', size = 32, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Spring Boots Auto-Bounce">
    {/* Boot Shaft & Foot */}
    <path
      d="M18 10 H34 V26 L48 30 C51 31 52 34 52 37 H16 V12 C16 11 17 10 18 10 Z"
      fill="#10b981"
      stroke="#a7f3d0"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* Gold Trim Buckles */}
    <rect x="16" y="15" width="18" height="4" rx="1" fill="#facc15" />
    <rect x="16" y="22" width="18" height="4" rx="1" fill="#facc15" />
    {/* Dual Heavy Coil Springs */}
    <path d="M16 41 L32 45 L16 49 L32 53 L16 57" stroke="#6ee7b7" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M34 41 L50 45 L34 49 L50 53 L34 57" stroke="#facc15" strokeWidth="3.5" strokeLinecap="round" />
    {colorblindMode && <ColorblindBadge letter="J" bg="#065f46" />}
  </svg>
);

/**
 * 10. Double Jump (Rare): Khussa shoe adorned with golden falcon wings for mid-air second jump
 */
export const DoubleJump: React.FC<PickupIconProps> = ({ className = '', size = 32, colorblindMode = false }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="Double Jump Winged Khussa">
    {/* Golden Wings */}
    <path
      d="M28 28 C20 14 8 10 6 14 C5 18 12 22 16 24 C10 24 6 27 8 30 C11 33 20 33 28 32 Z"
      fill="#facc15"
      stroke="#ffffff"
      strokeWidth="2"
    />
    <path
      d="M36 28 C44 14 56 10 58 14 C59 18 52 22 48 24 C54 24 58 27 56 30 C53 33 44 33 36 32 Z"
      fill="#facc15"
      stroke="#ffffff"
      strokeWidth="2"
    />
    {/* Central Winged Khussa */}
    <path
      d="M14 38 H46 C51 38 56 33 54 29 C52 27 49 32 45 33 H26 L20 29 H14 V38 Z"
      fill="#4ade80"
      stroke="#fef08a"
      strokeWidth="2.5"
    />
    {/* Double Upward Chevrons */}
    <path d="M22 48 L32 41 L42 48" stroke="#4ade80" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 56 L32 49 L42 56" stroke="#facc15" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    {colorblindMode && <ColorblindBadge letter="J" bg="#15803d" />}
  </svg>
);

export const HUD_ICON_COMPONENTS: Record<HudIconId, React.FC<PickupIconProps>> = {
  FuelCan,
  FuelDrum,
  GoldenFuel,
  PetrolPump,
  Shield,
  DoubleShield,
  GoldenShield,
  Khussa,
  SpringBoots,
  DoubleJump
};

export const RenderHudIcon: React.FC<{ iconId: HudIconId } & PickupIconProps> = ({ iconId, ...props }) => {
  const Comp = HUD_ICON_COMPONENTS[iconId] || Shield;
  return <Comp {...props} />;
};
