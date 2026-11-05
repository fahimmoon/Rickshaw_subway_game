import {
  ROAD_Y,
  DECK_Y,
  DECK_THICKNESS,
  RAMP_LENGTH,
  BUS_ROOF_HEIGHT,
  BUS_RAMP_LENGTH,
  BUS_RAMP_LOW_OFFSET_Z,
  BUS_RAMP_HIGH_OFFSET_Z,
  BUS_ROOF_FRONT_OFFSET_Z,
  GAME_CONFIG
} from './config';

/**
 * Represents an active Flyover span in world Z coordinates (where the player travels toward -Z,
 * so zStart > zUpEnd > zDownStart > zEnd).
 *
 * `rampLanes` defines which 1 or 2 lanes (e.g. [1], [0, 1], or [1, 2]) have the entrance and exit ramps.
 * - At least one ground lane (`openGroundLanes`) always remains open beside the ramp so the flyover is never mandatory.
 * - If the player enters within `rampLanes`, they smoothly climb the ascending ramp onto the full-width deck (`level = 1`).
 * - Over the last 20 units of the flat deck (`FLYOVER_EXIT_CLEAR_LEN`), the deck guard rails taper smoothly
 *   into `rampLanes` so the player descends the down-ramp without ever blocking the open ground lane(s).
 * - If the player enters in an `openGroundLanes` lane at `zStart`, they stay on `level = 0` and drive through the underpass,
 *   while a ground median barrier keeps them out of the walled ramp columns.
 */
export interface FlyoverSpan {
  id: number;
  zStart: number;          // Entrance of up-ramp (e.g. -600)
  zUpEnd: number;          // Top of up-ramp / start of flat deck (zStart - RAMP_LENGTH)
  zDownStart: number;      // End of flat deck / start of down-ramp (zUpEnd - deckLength)
  zEnd: number;            // Bottom of down-ramp where ramp merges back into ROAD_Y (zDownStart - RAMP_LENGTH)
  deckLength: number;      // Length of flat elevated deck (80 to 160m)
  rampLanes: number[];     // Entrance & exit ramp lanes (1 or 2 lanes: [1], [0, 1], or [1, 2])
  openGroundLanes: number[]; // Ground lanes that remain open all the way through (never blocked by ramp walls)
  minRampX: number;        // Left X bound of entrance/exit ramp
  maxRampX: number;        // Right X bound of entrance/exit ramp
  deckMinX: number;        // Left X bound of full-width elevated deck (-6.8)
  deckMaxX: number;        // Right X bound of full-width elevated deck (+6.8)
}

export interface BusRampSpan {
  laneX: number;
  zCenter: number;     // Center Z of the bus
  roofHeight: number;  // Usually 2.8m
}

// Active flyover spans and bus ramps in the scene (mutated in-place, zero per-frame allocations)
const _activeFlyovers: FlyoverSpan[] = [];
const _activeBusRamps: BusRampSpan[] = [];
let _nextFlyoverId = 1;

// Reusable tuple object for zero-allocation bounds queries
const _scratchBounds = { minX: -6.8, maxX: 6.8 };

export function getActiveFlyovers(): readonly FlyoverSpan[] {
  return _activeFlyovers;
}

export function getActiveBusRamps(): readonly BusRampSpan[] {
  return _activeBusRamps;
}

export function clearTerrainSpans(): void {
  _activeFlyovers.length = 0;
  _activeBusRamps.length = 0;
}

/**
 * Normalizes `rampLanes` so a flyover ramp always occupies 1 or 2 contiguous lanes
 * ([1], [0, 1], or [1, 2]), leaving at least one ground lane open beside it.
 */
export function normalizeRampLanes(requested: number[]): number[] {
  if (!requested || requested.length === 0) return [0, 1];
  if (requested.length >= 3) return [0, 1];
  if (requested.length === 2) {
    const has0 = requested.includes(0);
    const has1 = requested.includes(1);
    const has2 = requested.includes(2);
    if (has0 && has1) return [0, 1];
    if (has1 && has2) return [1, 2];
    return [0, 1];
  }
  const single = requested[0];
  if (single === 0) return [0, 1];
  if (single === 2) return [1, 2];
  return [1];
}

export function registerFlyoverSpan(
  zStart: number,
  deckLength: number,
  requestedRampLanes: number[] = [0, 1]
): FlyoverSpan {
  const rampLanes = normalizeRampLanes(requestedRampLanes);
  const openGroundLanes = [0, 1, 2].filter((l) => !rampLanes.includes(l));

  const zUpEnd = zStart - RAMP_LENGTH;
  const zDownStart = zUpEnd - deckLength;
  const zEnd = zDownStart - RAMP_LENGTH;

  let minLaneIdx = 2;
  let maxLaneIdx = 0;
  for (let i = 0; i < rampLanes.length; i++) {
    if (rampLanes[i] < minLaneIdx) minLaneIdx = rampLanes[i];
    if (rampLanes[i] > maxLaneIdx) maxLaneIdx = rampLanes[i];
  }
  const minRampX = GAME_CONFIG.LANES[minLaneIdx] - 2.0;
  const maxRampX = GAME_CONFIG.LANES[maxLaneIdx] + 2.0;

  const span: FlyoverSpan = {
    id: _nextFlyoverId++,
    zStart,
    zUpEnd,
    zDownStart,
    zEnd,
    deckLength,
    rampLanes,
    openGroundLanes,
    minRampX,
    maxRampX,
    deckMinX: -GAME_CONFIG.ROAD_WIDTH * 0.5 + 0.2,
    deckMaxX: GAME_CONFIG.ROAD_WIDTH * 0.5 - 0.2
  };
  _activeFlyovers.push(span);
  return span;
}

export function pruneFlyoverSpansBehind(despawnZ: number): void {
  for (let i = _activeFlyovers.length - 1; i >= 0; i--) {
    // Since travel is toward -Z, a flyover is completely behind the camera when its zEnd > despawnZ
    if (_activeFlyovers[i].zEnd > despawnZ) {
      _activeFlyovers.splice(i, 1);
    }
  }
}

export function shiftTerrainOrigin(zOffset: number): void {
  for (let i = 0; i < _activeFlyovers.length; i++) {
    const f = _activeFlyovers[i];
    f.zStart += zOffset;
    f.zUpEnd += zOffset;
    f.zDownStart += zOffset;
    f.zEnd += zOffset;
  }
  for (let i = 0; i < _activeBusRamps.length; i++) {
    _activeBusRamps[i].zCenter += zOffset;
  }
}

export function setBusRamps(busObstacles: readonly { position: { x: number; z: number }; userData: Record<string, unknown> }[]): void {
  _activeBusRamps.length = 0;
  for (let i = 0; i < busObstacles.length; i++) {
    const obs = busObstacles[i];
    if (obs.userData.type === 'BUS_RAMP' && (obs.userData.level ?? 0) === 0) {
      _activeBusRamps.push({
        laneX: (obs.userData.laneX as number) ?? obs.position.x,
        zCenter: obs.position.z,
        roofHeight: (obs.userData.roofHeight as number) ?? 2.8
      });
    }
  }
}

/**
 * Smoothstep interpolation `3t^2 - 2t^3` with zero derivative at t = 0 and t = 1,
 * eliminating any vertical kink at ramp start or ramp end.
 */
export function smoothstep01(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * Analytical derivative d(smoothstep)/dt = 6t(1 - t), used to compute exact ramp pitch angle.
 */
export function smoothstepDerivative01(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return 6 * c * (1 - c);
}

/**
 * Returns the active FlyoverSpan overlapping world `z` (if any).
 */
export function getFlyoverSpanAtZ(z: number): FlyoverSpan | null {
  for (let i = 0; i < _activeFlyovers.length; i++) {
    const f = _activeFlyovers[i];
    if (z <= f.zStart && z >= f.zEnd) {
      return f;
    }
  }
  return null;
}

/**
 * Checks whether `laneX` is aligned with the entrance/exit ramp of `span`.
 */
export function isLaneOnRampEntrance(laneX: number, span: FlyoverSpan): boolean {
  return laneX >= span.minRampX && laneX <= span.maxRampX;
}

/**
 * Returns the lateral X bounds `{ minX, maxX }` for the elevated structure at world `z`:
 * - On the ascending ramp (`z > zUpEnd`): `[minRampX, maxRampX]`.
 * - On the main flat deck (`z >= zDownStart + FLYOVER_EXIT_CLEAR_LEN`): full `[deckMinX, deckMaxX]`.
 * - Over the 20-unit exit clear zone (`zDownStart + 20 >= z >= zDownStart`): smoothly tapers from `[deckMinX, deckMaxX]`
 *   into `[minRampX, maxRampX]` so the player slides cleanly into the down-ramp lanes!
 * - On the descending ramp (`z < zDownStart`): `[minRampX, maxRampX]`.
 */
export function getElevatedBoundsAtZ(span: FlyoverSpan, z: number): { minX: number; maxX: number } {
  if (z > span.zUpEnd || z <= span.zDownStart) {
    _scratchBounds.minX = span.minRampX;
    _scratchBounds.maxX = span.maxRampX;
    return _scratchBounds;
  }
  const taperStartZ = span.zDownStart + GAME_CONFIG.FLYOVER_EXIT_CLEAR_LEN;
  if (z < taperStartZ) {
    const t = smoothstep01((taperStartZ - z) / GAME_CONFIG.FLYOVER_EXIT_CLEAR_LEN);
    _scratchBounds.minX = span.deckMinX + (span.minRampX - span.deckMinX) * t;
    _scratchBounds.maxX = span.deckMaxX + (span.maxRampX - span.deckMaxX) * t;
    return _scratchBounds;
  }
  _scratchBounds.minX = span.deckMinX;
  _scratchBounds.maxX = span.deckMaxX;
  return _scratchBounds;
}

/**
 * Returns the lateral X bounds `{ minX, maxX }` for the ground road (`level = 0`) when passing beside/under `span`:
 * - The ground median barrier closes off the `rampLanes` columns and keeps ground vehicles in `openGroundLanes`.
 */
export function getGroundOpenBoundsForSpan(span: FlyoverSpan): { minX: number; maxX: number } {
  let minIdx = 2;
  let maxIdx = 0;
  for (let i = 0; i < span.openGroundLanes.length; i++) {
    const idx = span.openGroundLanes[i];
    if (idx < minIdx) minIdx = idx;
    if (idx > maxIdx) maxIdx = idx;
  }
  _scratchBounds.minX = GAME_CONFIG.LANES[minIdx] - 1.95;
  _scratchBounds.maxX = GAME_CONFIG.LANES[maxIdx] + 1.95;
  return _scratchBounds;
}

/**
 * Single Source of Truth for surface height in the world: `groundHeightAt(laneX, z, levelHint)`.
 *
 * - Returns `ROAD_Y` (0), `DECK_Y` (5.8), or the smoothstep-interpolated ramp height on up/down ramps.
 * - `levelHint` (optional):
 *   - `1`: caller is on the elevated flyover path (climbs up-ramp, rides flat deck, descends down-ramp).
 *   - `0`: caller is on the ground road underneath/beside the flyover (stays at `ROAD_Y`, or climbs a ground bus ramp).
 *   - `undefined`: automatically resolves to the flyover surface if `(laneX, z)` is within the ramp/deck bounds.
 */
export function groundHeightAt(laneX: number, z: number, levelHint?: number): number {
  const span = getFlyoverSpanAtZ(z);
  if (span) {
    const bounds = getElevatedBoundsAtZ(span, z);
    const insideHorizontalBounds = laneX >= bounds.minX - 0.35 && laneX <= bounds.maxX + 0.35;
    const wantsElevated =
      levelHint === 1 ||
      (levelHint === undefined && insideHorizontalBounds);

    if (wantsElevated) {
      if (z > span.zUpEnd) {
        // Ascending ramp: z goes from zStart down to zUpEnd
        const progress = (span.zStart - z) / RAMP_LENGTH;
        return ROAD_Y + smoothstep01(progress) * (DECK_Y - ROAD_Y);
      } else if (z >= span.zDownStart) {
        // Flat elevated deck
        return DECK_Y;
      } else {
        // Descending ramp: z goes from zDownStart down to zEnd
        const progress = (z - span.zEnd) / RAMP_LENGTH;
        return ROAD_Y + smoothstep01(progress) * (DECK_Y - ROAD_Y);
      }
    }
  }

  // Check ground-level bus ramps when on level 0
  // Convention: Player travels toward -Z.
  // For a bus centered at `b.zCenter`:
  // - Low end of ramp (at ROAD_Y = 0) is at `zLow = b.zCenter + BUS_RAMP_LOW_OFFSET_Z` (+9.4m, reached first!)
  // - High end of ramp (at roofHeight = 2.8m) is at `zHigh = b.zCenter + BUS_RAMP_HIGH_OFFSET_Z` (+4.2m)
  // - Flat bus roof extends from `zHigh` (+4.2m) forward to `zFront = b.zCenter + BUS_ROOF_FRONT_OFFSET_Z` (-4.5m)
  if (levelHint !== 1) {
    for (let i = 0; i < _activeBusRamps.length; i++) {
      const b = _activeBusRamps[i];
      const xDiff = Math.abs(b.laneX - laneX);
      if (xDiff < 1.35) {
        const zLow = b.zCenter + BUS_RAMP_LOW_OFFSET_Z;
        const zHigh = b.zCenter + BUS_RAMP_HIGH_OFFSET_Z;
        const zFront = b.zCenter + BUS_ROOF_FRONT_OFFSET_Z;
        if (z <= zLow && z >= zHigh) {
          // Ascending bus ramp: progress goes from 0 at zLow (+9.4) to 1 at zHigh (+4.2) as z decreases toward -Z
          const rampProgress = (zLow - z) / BUS_RAMP_LENGTH;
          return ROAD_Y + Math.max(0, Math.min(1, rampProgress)) * b.roofHeight;
        }
        if (z < zHigh && z >= zFront) {
          // Flat bus roof
          return ROAD_Y + b.roofHeight;
        }
      }
    }
  }

  return ROAD_Y;
}

/**
 * Returns the surface pitch angle (in radians around the X axis) at `(laneX, z)` for `levelHint`.
 * - Positive pitch tilts the vehicle nose UP on an ascending ramp (traveling toward -Z).
 * - Negative pitch tilts the vehicle nose DOWN on a descending ramp.
 */
export function groundSlopePitchAt(laneX: number, z: number, levelHint?: number): number {
  const span = getFlyoverSpanAtZ(z);
  if (span) {
    const bounds = getElevatedBoundsAtZ(span, z);
    const insideHorizontalBounds = laneX >= bounds.minX - 0.35 && laneX <= bounds.maxX + 0.35;
    const wantsElevated =
      levelHint === 1 ||
      (levelHint === undefined && insideHorizontalBounds);

    if (wantsElevated) {
      if (z > span.zUpEnd) {
        const t = (span.zStart - z) / RAMP_LENGTH;
        const dyDz = (smoothstepDerivative01(t) * (DECK_Y - ROAD_Y)) / RAMP_LENGTH;
        return Math.atan(dyDz);
      } else if (z >= span.zDownStart) {
        return 0;
      } else {
        const t = (z - span.zEnd) / RAMP_LENGTH;
        const dyDz = -(smoothstepDerivative01(t) * (DECK_Y - ROAD_Y)) / RAMP_LENGTH;
        return Math.atan(dyDz);
      }
    }
  }

  if (levelHint !== 1) {
    for (let i = 0; i < _activeBusRamps.length; i++) {
      const b = _activeBusRamps[i];
      if (Math.abs(b.laneX - laneX) < 1.35) {
        const zLow = b.zCenter + BUS_RAMP_LOW_OFFSET_Z;
        const zHigh = b.zCenter + BUS_RAMP_HIGH_OFFSET_Z;
        if (z <= zLow && z >= zHigh) {
          return Math.atan2(b.roofHeight || BUS_ROOF_HEIGHT, BUS_RAMP_LENGTH);
        }
      }
    }
  }
  return 0;
}

/**
 * Derives the discrete `surfaceLevel` (0 = ground, 1 = elevated flyover) from a surface height.
 */
export function surfaceLevelFromHeight(surfaceY: number): 0 | 1 {
  return surfaceY >= (DECK_Y - ROAD_Y) * 0.35 ? 1 : 0;
}

/**
 * Returns normalized ramp progress `[0..1]` if `z` is on a flyover ramp, or `0` on flat ground / `1` on flat deck.
 */
export function getRampProgressAt(z: number, levelHint: number): number {
  const span = getFlyoverSpanAtZ(z);
  if (!span || levelHint === 0) return 0;
  if (z > span.zUpEnd) {
    return Math.max(0, Math.min(1, (span.zStart - z) / RAMP_LENGTH));
  }
  if (z >= span.zDownStart) {
    return 1;
  }
  return Math.max(0, Math.min(1, (z - span.zEnd) / RAMP_LENGTH));
}

/**
 * Returns the underside ceiling Y of the flyover deck if `(laneX, z)` is underneath the elevated structure on `level = 0`,
 * or `null` if there is no overhead deck at `(laneX, z)`.
 * Used for camera underpass ray/clamping, jump ceiling capping, and underpass audio/visual ambience.
 */
export function getDeckUndersideAt(z: number, laneX?: number): number | null {
  const span = getFlyoverSpanAtZ(z);
  if (!span) return null;
  if (laneX !== undefined) {
    const bounds = getElevatedBoundsAtZ(span, z);
    if (laneX < bounds.minX - 0.5 || laneX > bounds.maxX + 0.5) {
      return null;
    }
  }
  if (z <= span.zUpEnd && z >= span.zDownStart) {
    return DECK_Y - DECK_THICKNESS;
  }
  if (z > span.zUpEnd) {
    const t = (span.zStart - z) / RAMP_LENGTH;
    const topY = ROAD_Y + smoothstep01(t) * (DECK_Y - ROAD_Y);
    return topY > 2.2 ? topY - DECK_THICKNESS : null;
  }
  if (z < span.zDownStart) {
    const t = (z - span.zEnd) / RAMP_LENGTH;
    const topY = ROAD_Y + smoothstep01(t) * (DECK_Y - ROAD_Y);
    return topY > 2.2 ? topY - DECK_THICKNESS : null;
  }
  return null;
}
