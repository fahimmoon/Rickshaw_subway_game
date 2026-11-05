import * as THREE from 'three';
import { GAME_CONFIG, ROAD_Y } from './config';
import { SoundFX } from './audio';
import { patchObjectHierarchy } from './curvedWorld';
import { createHighwayPatrolCar, createPoliceOfficer } from './models';
import {
  groundHeightAt,
  groundSlopePitchAt,
  getFlyoverSpanAtZ,
  getElevatedBoundsAtZ,
  getGroundOpenBoundsForSpan
} from './terrain';

export type ChaseState = 'SAFE' | 'CLOSE' | 'CAUGHT';

export type ArrestPhase = 'HITSTOP' | 'SKID' | 'OFFICER_APPROACH' | 'COMPLETE';

export interface PoliceArrestState {
  active: boolean;
  phase: ArrestPhase;
  timer: number;
  totalTimer: number;
  startLeftX: number;
  startLeftZ: number;
  startLeftRotY: number;
  startRightX: number;
  startRightZ: number;
  startRightRotY: number;
  officerGroup: THREE.Group | null;
  comicDialogue: string;
}

export class PoliceChaseController {
  private scene: THREE.Scene;
  private sound: SoundFX;

  // Two Highway Patrol pursuit vehicles
  public carLeft: THREE.Group;
  public carRight: THREE.Group;
  private officer: THREE.Group;

  public state: ChaseState = 'SAFE';
  public gap: number = GAME_CONFIG.POLICE_GAP_SAFE; // Distance behind player
  private cleanPlayTimer: number = 0;

  // Strobe sequencer
  private strobeTimer: number = 0;
  private strobePhase: boolean = false;

  // Cut-in / Overtake event
  public overtakeActive: boolean = false;
  public overtakeCar: 'LEFT' | 'RIGHT' | null = null;
  public overtakeTimer: number = 0;
  public overtakeTargetLane: number = 1; // 0, 1, or 2
  private lastOvertakeDistance: number = 0;

  // Arrest sequence state
  public arrest: PoliceArrestState = {
    active: false,
    phase: 'HITSTOP',
    timer: 0,
    totalTimer: 0,
    startLeftX: -3.2,
    startLeftZ: 10,
    startLeftRotY: 0,
    startRightX: 3.2,
    startRightZ: 11,
    startRightRotY: 0,
    officerGroup: null,
    comicDialogue: 'Oye, ruk ja! Challan katega!'
  };

  // Cached materials for strobe
  private redLightMats: THREE.MeshStandardMaterial[] = [];
  private blueLightMats: THREE.MeshStandardMaterial[] = [];

  // Phase 5: Police surface level tracking with 0.6s delay when player switches level
  public policeLevel: number = 0;
  private pendingPlayerLevel: number = 0;
  private levelSwitchTimer: number = 0;

  constructor(scene: THREE.Scene, sound: SoundFX) {
    this.scene = scene;
    this.sound = sound;

    // Create 2 Highway patrol cars
    this.carLeft = createHighwayPatrolCar('left');
    this.carRight = createHighwayPatrolCar('right');
    this.officer = createPoliceOfficer();
    this.officer.visible = false;

    patchObjectHierarchy(this.carLeft);
    patchObjectHierarchy(this.carRight);
    patchObjectHierarchy(this.officer);

    this.scene.add(this.carLeft);
    this.scene.add(this.carRight);
    this.scene.add(this.officer);

    this.cacheStrobeMaterials(this.carLeft);
    this.cacheStrobeMaterials(this.carRight);

    this.reset(0);
  }

  private cacheStrobeMaterials(group: THREE.Group) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.isPoliceLight) {
        if (child.userData.lightColor === 'red') {
          this.redLightMats.push(child.material as THREE.MeshStandardMaterial);
        } else if (child.userData.lightColor === 'blue') {
          this.blueLightMats.push(child.material as THREE.MeshStandardMaterial);
        }
      }
    });
  }

  public reset(playerZ: number = 0) {
    this.state = 'SAFE';
    this.gap = GAME_CONFIG.POLICE_GAP_SAFE;
    this.cleanPlayTimer = 0;
    this.overtakeActive = false;
    this.overtakeCar = null;
    this.overtakeTimer = 0;
    this.lastOvertakeDistance = 0;

    this.arrest.active = false;
    this.arrest.phase = 'HITSTOP';
    this.arrest.timer = 0;
    this.arrest.totalTimer = 0;
    this.officer.visible = false;
    this.policeLevel = 0;
    this.pendingPlayerLevel = 0;
    this.levelSwitchTimer = 0;

    // Initial positions behind player in left and right lanes
    this.carLeft.position.set(GAME_CONFIG.LANES[0], ROAD_Y, playerZ + this.gap);
    this.carLeft.rotation.set(0, 0, 0);
    this.carRight.position.set(GAME_CONFIG.LANES[2], ROAD_Y, playerZ + this.gap + 1.5);
    this.carRight.rotation.set(0, 0, 0);
  }

  public shiftOrigin(zOffset: number) {
    this.carLeft.position.z += zOffset;
    this.carRight.position.z += zOffset;
    this.officer.position.z += zOffset;
    this.arrest.startLeftZ += zOffset;
    this.arrest.startRightZ += zOffset;
  }

  /**
   * Called when player stumbles on a pothole, hurdle, or sideswipes a vehicle.
   */
  public registerMistake(): boolean {
    if (this.arrest.active) return false;

    if (this.state === 'SAFE') {
      this.state = 'CLOSE';
      this.gap = GAME_CONFIG.POLICE_GAP_CLOSE;
      this.cleanPlayTimer = 0;
      this.sound.playSiren();
      return false; // Not caught yet, just warning!
    } else if (this.state === 'CLOSE') {
      // Second mistake while close = CAUGHT!
      this.triggerArrest();
      return true;
    }
    return false;
  }

  public registerCleanCoin() {
    if (this.state === 'CLOSE') {
      this.gap = Math.min(GAME_CONFIG.POLICE_GAP_SAFE, this.gap + 0.35);
      if (this.gap >= GAME_CONFIG.POLICE_GAP_SAFE * 0.95) {
        this.state = 'SAFE';
      }
    }
  }

  public registerNearMiss() {
    if (this.state === 'CLOSE') {
      this.gap = Math.min(GAME_CONFIG.POLICE_GAP_SAFE, this.gap + 1.2);
      if (this.gap >= GAME_CONFIG.POLICE_GAP_SAFE * 0.9) {
        this.state = 'SAFE';
      }
    }
  }

  public triggerArrest(customReason?: string) {
    if (this.arrest.active) return;
    this.state = 'CAUGHT';
    this.arrest.active = true;
    this.arrest.phase = 'HITSTOP';
    this.arrest.timer = 0;
    this.arrest.totalTimer = 0;
    this.arrest.startLeftX = this.carLeft.position.x;
    this.arrest.startLeftZ = this.carLeft.position.z;
    this.arrest.startLeftRotY = this.carLeft.rotation.y;
    this.arrest.startRightX = this.carRight.position.x;
    this.arrest.startRightZ = this.carRight.position.z;
    this.arrest.startRightRotY = this.carRight.rotation.y;
    const dialogues = [
      'Oye, ruk ja! Challan katega!',
      'Gari side pe lagao! License dikhao!',
      'Mall road pe drifting? Seedha thana!',
      'Bhai helmet kahan hai aur CNG cylinder check karao!'
    ];
    this.arrest.comicDialogue = customReason || dialogues[Math.floor(Math.random() * dialogues.length)];
    this.sound.playCrash();
    this.sound.playSiren();
  }

  public skipArrestCutscene() {
    if (!this.arrest.active) return;
    this.arrest.phase = 'COMPLETE';
  }

  private updateStrobeLights(dt: number) {
    this.strobeTimer += dt;
    if (this.strobeTimer > 0.09) {
      this.strobeTimer = 0;
      this.strobePhase = !this.strobePhase;
      const redEmissive = this.strobePhase ? 0xff0022 : 0x220000;
      const blueEmissive = this.strobePhase ? 0x0022ff : 0x000044;
      for (const m of this.redLightMats) {
        m.emissive.setHex(redEmissive);
      }
      for (const m of this.blueLightMats) {
        m.emissive.setHex(blueEmissive);
      }
    }
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    playerSpeed: number,
    totalDistance: number,
    playerSurfaceLevel: number = 0
  ) {
    // 1. Always flash strobe LEDs (including during crash & arrest sequence!)
    this.updateStrobeLights(dt);

    if (this.arrest.active) {
      this.updateArrestSequence(dt, playerX, playerY, playerZ, playerSurfaceLevel);
      return;
    }

    // Track player surface level changes with ~0.6s pursuit decision delay
    if (playerSurfaceLevel !== this.policeLevel) {
      if (this.pendingPlayerLevel !== playerSurfaceLevel) {
        this.pendingPlayerLevel = playerSurfaceLevel;
        this.levelSwitchTimer = GAME_CONFIG.POLICE_LEVEL_SWITCH_DELAY;
      } else {
        this.levelSwitchTimer -= dt;
        if (this.levelSwitchTimer <= 0) {
          this.policeLevel = playerSurfaceLevel;
        }
      }
    } else {
      this.pendingPlayerLevel = this.policeLevel;
      this.levelSwitchTimer = 0;
    }

    // 2. State & Gap Recovery
    if (this.state === 'CLOSE') {
      this.cleanPlayTimer += dt;
      if (this.cleanPlayTimer >= GAME_CONFIG.POLICE_RECOVERY_TIME) {
        this.state = 'SAFE';
        this.cleanPlayTimer = 0;
      } else {
        // Slow continuous gap recovery
        this.gap = THREE.MathUtils.lerp(this.gap, GAME_CONFIG.POLICE_GAP_SAFE, dt * 0.15);
      }
    } else {
      this.gap = THREE.MathUtils.lerp(this.gap, GAME_CONFIG.POLICE_GAP_SAFE, dt * 1.5);
    }

    // 3. Siren Audio Proximity
    if (this.state === 'CLOSE') {
      if (Math.random() < 0.08) {
        this.sound.playSiren();
      }
    }

    // 4. Random ~600m Overtake Event (non-colliding intimidation maneuver in Phase 5)
    if (
      !this.overtakeActive &&
      totalDistance > 300 &&
      totalDistance - this.lastOvertakeDistance > GAME_CONFIG.POLICE_OVERTAKE_INTERVAL
    ) {
      this.lastOvertakeDistance = totalDistance;
      this.overtakeActive = true;
      this.overtakeTimer = 0;
      this.overtakeCar = Math.random() < 0.5 ? 'LEFT' : 'RIGHT';
      this.overtakeTargetLane = Math.floor(Math.random() * 3);
      this.sound.playSiren();
    }

    if (this.overtakeActive) {
      this.overtakeTimer += dt;
      if (this.overtakeTimer > 3.0) {
        this.overtakeActive = false;
        this.overtakeCar = null;
      }
    }

    // 5. Physics & Positioning using groundHeightAt(), groundSlopePitchAt(), and ramp/underpass lateral bounds
    const targetZ = playerZ + this.gap;
    const sway = Math.sin(Date.now() * 0.003) * 0.35;

    const clampCarXAtZ = (rawX: number, carZ: number): number => {
      const span = getFlyoverSpanAtZ(carZ);
      if (!span) return rawX;
      if (this.policeLevel === 1) {
        const b = getElevatedBoundsAtZ(span, carZ);
        return THREE.MathUtils.clamp(rawX, b.minX + 0.85, b.maxX - 0.85);
      } else {
        const b = getGroundOpenBoundsForSpan(span);
        return THREE.MathUtils.clamp(rawX, b.minX + 0.85, b.maxX - 0.85);
      }
    };

    // Left police car
    if (this.overtakeActive && this.overtakeCar === 'LEFT') {
      const pullZ = THREE.MathUtils.lerp(this.carLeft.position.z, playerZ - 1.5, dt * 2.5);
      const rawTargetX = clampCarXAtZ(GAME_CONFIG.LANES[this.overtakeTargetLane], pullZ);
      const pullX = THREE.MathUtils.lerp(this.carLeft.position.x, rawTargetX, dt * 2.0);
      const surfY = groundHeightAt(pullX, pullZ, this.policeLevel);
      const pitch = groundSlopePitchAt(pullX, pullZ, this.policeLevel);
      this.carLeft.position.set(pullX, THREE.MathUtils.lerp(this.carLeft.position.y, surfY, Math.min(1, dt * 14)), pullZ);
      this.carLeft.rotation.x = THREE.MathUtils.lerp(this.carLeft.rotation.x, pitch, Math.min(1, dt * 12));
      this.carLeft.rotation.y = 0.06;
    } else {
      const nextZ = THREE.MathUtils.lerp(this.carLeft.position.z, targetZ, dt * 5.0);
      const leftTargetX = clampCarXAtZ(GAME_CONFIG.LANES[0] + sway, nextZ);
      const nextX = THREE.MathUtils.lerp(this.carLeft.position.x, leftTargetX, dt * 4.0);
      const surfY = groundHeightAt(nextX, nextZ, this.policeLevel);
      const pitch = groundSlopePitchAt(nextX, nextZ, this.policeLevel);
      this.carLeft.position.x = nextX;
      this.carLeft.position.y = THREE.MathUtils.lerp(this.carLeft.position.y, surfY, Math.min(1, dt * 14));
      this.carLeft.position.z = nextZ;
      this.carLeft.rotation.x = THREE.MathUtils.lerp(this.carLeft.rotation.x, pitch, Math.min(1, dt * 12));
      this.carLeft.rotation.y = sway * 0.1;
    }

    // Right police car
    if (this.overtakeActive && this.overtakeCar === 'RIGHT') {
      const pullZ = THREE.MathUtils.lerp(this.carRight.position.z, playerZ - 1.5, dt * 2.5);
      const rawTargetX = clampCarXAtZ(GAME_CONFIG.LANES[this.overtakeTargetLane], pullZ);
      const pullX = THREE.MathUtils.lerp(this.carRight.position.x, rawTargetX, dt * 2.0);
      const surfY = groundHeightAt(pullX, pullZ, this.policeLevel);
      const pitch = groundSlopePitchAt(pullX, pullZ, this.policeLevel);
      this.carRight.position.set(pullX, THREE.MathUtils.lerp(this.carRight.position.y, surfY, Math.min(1, dt * 14)), pullZ);
      this.carRight.rotation.x = THREE.MathUtils.lerp(this.carRight.rotation.x, pitch, Math.min(1, dt * 12));
      this.carRight.rotation.y = -0.06;
    } else {
      const nextZ = THREE.MathUtils.lerp(this.carRight.position.z, targetZ + 1.2, dt * 4.5);
      const rightTargetX = clampCarXAtZ(GAME_CONFIG.LANES[2] - sway, nextZ);
      const nextX = THREE.MathUtils.lerp(this.carRight.position.x, rightTargetX, dt * 4.0);
      const surfY = groundHeightAt(nextX, nextZ, this.policeLevel);
      const pitch = groundSlopePitchAt(nextX, nextZ, this.policeLevel);
      this.carRight.position.x = nextX;
      this.carRight.position.y = THREE.MathUtils.lerp(this.carRight.position.y, surfY, Math.min(1, dt * 14));
      this.carRight.position.z = nextZ;
      this.carRight.rotation.x = THREE.MathUtils.lerp(this.carRight.rotation.x, pitch, Math.min(1, dt * 12));
      this.carRight.rotation.y = -sway * 0.1;
    }
  }

  private updateArrestSequence(dt: number, px: number, py: number, pz: number, playerSurfaceLevel: number = 0) {
    this.arrest.timer += dt;
    this.arrest.totalTimer += dt;
    const arrestSurfY = groundHeightAt(px, pz, playerSurfaceLevel);
    const arrestPitch = groundSlopePitchAt(px, pz, playerSurfaceLevel);

    if (this.arrest.phase === 'HITSTOP') {
      // Snap police cars up close behind the crash if they were far back so their screeching skid-in is immediately visible
      this.arrest.startLeftX = Math.min(px - 1.8, GAME_CONFIG.LANES[0]);
      this.arrest.startLeftZ = Math.min(this.carLeft.position.z, pz + 9.0);
      this.arrest.startRightX = Math.max(px + 1.8, GAME_CONFIG.LANES[2]);
      this.arrest.startRightZ = Math.min(this.carRight.position.z, pz + 10.5);

      this.carLeft.position.set(
        this.arrest.startLeftX,
        groundHeightAt(this.arrest.startLeftX, this.arrest.startLeftZ, playerSurfaceLevel),
        this.arrest.startLeftZ
      );
      this.carRight.position.set(
        this.arrest.startRightX,
        groundHeightAt(this.arrest.startRightX, this.arrest.startRightZ, playerSurfaceLevel),
        this.arrest.startRightZ
      );

      if (this.arrest.timer > 0.1) {
        this.arrest.phase = 'SKID';
        this.arrest.timer = 0;
        this.sound.playSiren();
      }
    } else if (this.arrest.phase === 'SKID') {
      // Swing police cars around from behind to screech to a halt right beside crashed rickshaw (1.15s)
      const skidDuration = 1.15;
      const t = Math.min(1.0, this.arrest.timer / skidDuration);
      const ease = 1 - Math.pow(1 - t, 3);
      const leftParkX = Math.max(-5.2, px - 2.5);
      const rightParkX = Math.min(5.2, px + 2.3);
      const leftParkZ = pz + 0.35;
      const rightParkZ = pz + 3.4;

      // Left car skids from startLeft -> beside player at ~24 deg angle, with slight nose-dive braking pitch
      const curLeftX = THREE.MathUtils.lerp(this.arrest.startLeftX, leftParkX, ease);
      const curLeftZ = THREE.MathUtils.lerp(this.arrest.startLeftZ, leftParkZ, ease);
      const brakeDive = Math.sin(t * Math.PI) * 0.08;
      this.carLeft.position.x = curLeftX;
      this.carLeft.position.y = groundHeightAt(curLeftX, curLeftZ, playerSurfaceLevel);
      this.carLeft.position.z = curLeftZ;
      this.carLeft.rotation.x = groundSlopePitchAt(curLeftX, curLeftZ, playerSurfaceLevel) + brakeDive;
      this.carLeft.rotation.y = THREE.MathUtils.lerp(this.arrest.startLeftRotY, 0.42, ease);
      this.carLeft.rotation.z = Math.sin(t * Math.PI) * -0.09; // Lateral body roll during skid

      // Right car skids from startRight -> angled behind/beside player on the right
      const curRightX = THREE.MathUtils.lerp(this.arrest.startRightX, rightParkX, ease);
      const curRightZ = THREE.MathUtils.lerp(this.arrest.startRightZ, rightParkZ, ease);
      this.carRight.position.x = curRightX;
      this.carRight.position.y = groundHeightAt(curRightX, curRightZ, playerSurfaceLevel);
      this.carRight.position.z = curRightZ;
      this.carRight.rotation.x = groundSlopePitchAt(curRightX, curRightZ, playerSurfaceLevel) + brakeDive;
      this.carRight.rotation.y = THREE.MathUtils.lerp(this.arrest.startRightRotY, -0.38, ease);
      this.carRight.rotation.z = Math.sin(t * Math.PI) * 0.09;

      if (this.arrest.timer >= skidDuration) {
        this.arrest.phase = 'OFFICER_APPROACH';
        this.arrest.timer = 0;
        this.officer.position.set(Math.max(-5.0, px - 2.0), arrestSurfY, pz + 1.2);
        this.officer.rotation.y = Math.PI * 0.4;
        this.officer.visible = true;
      }
    } else if (this.arrest.phase === 'OFFICER_APPROACH') {
      // Police officer steps out and walks towards the driver side on the deck/road surface (2.15s)
      const walkT = Math.min(1.0, this.arrest.timer / 1.35);
      const startX = Math.max(-5.0, px - 2.0);
      const endX = Math.max(-4.6, px - 1.15);
      this.officer.position.x = THREE.MathUtils.lerp(startX, endX, walkT);
      this.officer.position.y = arrestSurfY;
      this.officer.position.z = THREE.MathUtils.lerp(pz + 1.2, pz + 0.15, walkT);

      // Officer walking leg & arm swing
      const swing = walkT < 1.0 ? Math.sin(this.arrest.timer * 9) * 0.45 : 0;
      if (this.officer.userData.leftLeg) this.officer.userData.leftLeg.rotation.x = swing;
      if (this.officer.userData.rightLeg) this.officer.userData.rightLeg.rotation.x = -swing;
      if (this.officer.userData.rightArm) this.officer.userData.rightArm.rotation.x = -swing * 1.2;

      // Comic pointing hand pose at end of walk while delivering the challan line
      if (walkT >= 0.75 && this.officer.userData.rightArm) {
        this.officer.userData.rightArm.rotation.x = -Math.PI * 0.45;
      }

      if (this.arrest.timer > 2.15) {
        this.arrest.phase = 'COMPLETE';
      }
    }
  }
}
