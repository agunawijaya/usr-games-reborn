import type { Vector3 } from 'three';
import type { BoardWorld, CameraShot } from './world';

/**
 * The camera that plays the game: it glides from one shot to the next instead of cutting, so
 * the table can follow a token round the town, swing to a lot going up and pull back to see the
 * whole board, and the player never loses their place.
 */

interface Pose {
  target: Vector3;
  distance: number;
  elevation: number;
  azimuth: number;
}

/** How quickly the camera closes on its goal: about two-thirds of the way in a third of a second. */
const EASE = 3.2;

export class CameraRig {
  private readonly pose: Pose;
  private goal: Pose;
  private ease = EASE;
  private readonly stopTick: () => void;

  constructor(
    private readonly world: BoardWorld,
    start: CameraShot,
  ) {
    this.pose = copy(start);
    this.goal = copy(start);
    world.frame(this.pose);
    this.stopTick = world.stage.onTick((seconds) => this.step(seconds));
  }

  /** Glides to a shot; `pace` above 1 moves faster, below 1 slower. */
  aim(shot: CameraShot, pace = 1): void {
    this.goal = copy(shot);
    // Turn the short way round.
    const turn = this.goal.azimuth - this.pose.azimuth;
    this.goal.azimuth = this.pose.azimuth + Math.atan2(Math.sin(turn), Math.cos(turn));
    this.ease = EASE * pace;
  }

  /** Jumps straight to a shot: reduced motion, and the first frame. */
  snap(shot: CameraShot): void {
    this.goal = copy(shot);
    Object.assign(this.pose, copy(shot));
    this.world.frame(this.pose);
  }

  private step(seconds: number): void {
    const k = 1 - Math.exp(-seconds * this.ease);
    this.pose.target.lerp(this.goal.target, k);
    this.pose.distance += (this.goal.distance - this.pose.distance) * k;
    this.pose.elevation += (this.goal.elevation - this.pose.elevation) * k;
    this.pose.azimuth += (this.goal.azimuth - this.pose.azimuth) * k;
    this.world.frame(this.pose);
  }

  dispose(): void {
    this.stopTick();
  }
}

function copy(shot: CameraShot): Pose {
  return {
    target: shot.target.clone(),
    distance: shot.distance,
    elevation: shot.elevation,
    azimuth: shot.azimuth,
  };
}
