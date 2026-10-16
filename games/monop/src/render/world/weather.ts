import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
} from 'three';
import { createRng, type Rng } from '@usr-games/kit';
import { glowTexture } from './scenery';

/**
 * The sky's moods, shared by the boards that have a sky: cloud shadows drifting over the town
 * on a sunny day, a passing shower of rain now and then, and meteors over the colony. None of
 * it touches the game; reduced motion stills it.
 */

export interface Weather {
  readonly group: Group;
  /** Rain for this stretch of the game, or not. */
  setShower(on: boolean): void;
  step(seconds: number): void;
}

const dummy = new Object3D();

/** The area the weather covers around the board's middle. */
const SPAN = 110;

/** Soft dark blots on the ground, as if clouds were crossing the sun. */
class CloudShadows {
  readonly group = new Group();
  private readonly clouds: { mesh: Mesh; speed: number }[] = [];

  constructor(rng: Rng) {
    const shade = new MeshBasicMaterial({
      map: glowTexture(),
      color: new Color('#0b1a2c'),
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(new PlaneGeometry(1, 1), shade);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.set(34 + rng.next() * 20, 24 + rng.next() * 14, 1);
      mesh.position.set(-SPAN / 2 + rng.next() * SPAN, 0.25, -SPAN / 2 + rng.next() * SPAN);
      mesh.renderOrder = 1;
      this.group.add(mesh);
      this.clouds.push({ mesh, speed: 1.2 + rng.next() * 0.8 });
    }
  }

  step(seconds: number): void {
    for (const cloud of this.clouds) {
      cloud.mesh.position.x += cloud.speed * seconds;
      cloud.mesh.position.z += cloud.speed * 0.35 * seconds;
      if (cloud.mesh.position.x > SPAN / 2 + 30) cloud.mesh.position.x = -SPAN / 2 - 30;
      if (cloud.mesh.position.z > SPAN / 2 + 30) cloud.mesh.position.z = -SPAN / 2 - 30;
    }
  }
}

const RAINDROPS = 900;

/** Light rain falling across the whole board, fading in and out with the shower. */
class Rain {
  readonly group = new Group();
  private readonly drops: InstancedMesh;
  private readonly material: MeshBasicMaterial;
  private readonly heights: number[] = [];
  private readonly spots: [number, number][] = [];
  private amount = 0;
  private wanted = 0;

  constructor(rng: Rng, dark: boolean) {
    this.material = new MeshBasicMaterial({
      color: dark ? '#9fb4ff' : '#dfe8f2',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      ...(dark ? { blending: AdditiveBlending } : {}),
    });
    this.drops = new InstancedMesh(new BoxGeometry(0.03, 1.1, 0.03), this.material, RAINDROPS);
    this.drops.instanceMatrix.setUsage(DynamicDrawUsage);
    this.drops.frustumCulled = false;
    for (let i = 0; i < RAINDROPS; i++) {
      this.spots.push([-SPAN / 2 + rng.next() * SPAN, -SPAN / 2 + rng.next() * SPAN]);
      this.heights.push(rng.next() * 40);
    }
    this.group.add(this.drops);
    this.group.visible = false;
  }

  setShower(on: boolean): void {
    this.wanted = on ? 1 : 0;
  }

  step(seconds: number): void {
    this.amount +=
      Math.sign(this.wanted - this.amount) *
      Math.min(Math.abs(this.wanted - this.amount), seconds / 3);
    this.group.visible = this.amount > 0.01;
    if (!this.group.visible) return;
    this.material.opacity = 0.42 * this.amount;
    for (let i = 0; i < RAINDROPS; i++) {
      let height = this.heights[i]! - seconds * 26;
      if (height < 0) height += 40;
      this.heights[i] = height;
      const [x, z] = this.spots[i]!;
      dummy.position.set(x + height * 0.12, height, z);
      dummy.rotation.set(0, 0, 0.12);
      dummy.updateMatrix();
      this.drops.setMatrixAt(i, dummy.matrix);
    }
    this.drops.instanceMatrix.needsUpdate = true;
  }
}

/** A streak of light across the colony's sky every so often. */
class Meteors {
  readonly group = new Group();
  private readonly streak: Mesh;
  private wait = 6;
  private life = 0;
  private from = { x: 0, y: 0, z: 0 };

  constructor(private readonly rng: Rng) {
    this.streak = new Mesh(
      new BoxGeometry(9, 0.12, 0.12),
      new MeshBasicMaterial({
        color: '#e7f3ff',
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.streak.visible = false;
    this.group.add(this.streak);
  }

  step(seconds: number): void {
    const material = this.streak.material as MeshBasicMaterial;
    if (this.life > 0) {
      this.life -= seconds;
      const p = 1 - this.life / 0.9;
      this.streak.position.set(this.from.x - p * 60, this.from.y - p * 18, this.from.z + p * 10);
      material.opacity = Math.sin(Math.min(1, p) * Math.PI) * 0.9;
      if (this.life <= 0) this.streak.visible = false;
      return;
    }
    this.wait -= seconds;
    if (this.wait > 0) return;
    this.wait = 7 + this.rng.next() * 14;
    this.life = 0.9;
    this.from = {
      x: 40 + this.rng.next() * 40,
      y: 60 + this.rng.next() * 30,
      z: -60 + this.rng.next() * 40,
    };
    this.streak.rotation.set(0, -0.16, 0.29);
    this.streak.visible = true;
  }
}

/** The harbour's weather: cloud shadows by day, and a shower now and then by day or night. */
export function harbourWeather(dark: boolean): Weather {
  const rng = createRng('harbour-weather');
  const group = new Group();
  const clouds = dark ? null : new CloudShadows(rng);
  const rain = new Rain(rng, dark);
  if (clouds) group.add(clouds.group);
  group.add(rain.group);
  return {
    group,
    setShower: (on) => rain.setShower(on),
    step(seconds) {
      clouds?.step(seconds);
      rain.step(seconds);
    },
  };
}

/** The colony's sky: no air for clouds or rain, but a meteor now and then. */
export function colonyWeather(): Weather {
  const meteors = new Meteors(createRng('colony-meteors'));
  return { group: meteors.group, setShower: () => {}, step: (seconds) => meteors.step(seconds) };
}
