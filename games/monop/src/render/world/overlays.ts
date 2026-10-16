import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { saleBoard } from '../boards/common';
import { at, cylinder, mesh, paint } from './kit3d';
import type { BoardLayout } from './lots';
import { glowTexture } from './scenery';

/**
 * What the world lays over the boards' own art, the same on every board: bunting along a
 * district's street once it is whole, sale boards on the lots of a player in debt, columns of
 * light over the winner's lots at the end, and a puff of dust where a lot goes back to the bank.
 */

/** The pavement between the road and the lots, where the bunting's poles stand. */
const PAVEMENT = 2.3;
const POLE_HEIGHT = 3.4;

let pennant: BufferGeometry | null = null;

function pennantShape(): BufferGeometry {
  if (pennant) return pennant;
  pennant = new BufferGeometry();
  pennant.setAttribute(
    'position',
    new Float32BufferAttribute([-0.3, 0, 0, 0.3, 0, 0, 0, -0.56, 0], 3),
  );
  pennant.computeVertexNormals();
  pennant.userData.shared = true;
  return pennant;
}

/**
 * A string of little flags in the district's colour and white, on two poles along the street in
 * front of its lots, sagging a little between them.
 */
export function bunting(layout: BoardLayout, lots: readonly number[], colour: string): Group {
  const group = new Group();
  const from = lots[0]! - 0.4;
  const to = lots[lots.length - 1]! + 0.4;
  const pole = paint('#e9e6df', { roughness: 0.5 });
  for (const t of [from, to]) {
    const foot = layout.roadPoint(t, PAVEMENT);
    group.add(
      at(mesh(cylinder(0.05, 0.06, POLE_HEIGHT, 8), pole), foot.x, POLE_HEIGHT / 2, foot.z),
    );
  }
  // A little of their own colour as glow, so the flags read from either face and in shade.
  const cloth = [colour, '#fbf7ee'].map((tone) =>
    paint(tone, {
      side: DoubleSide,
      roughness: 0.6,
      emissive: new Color(tone),
      emissiveIntensity: 0.3,
    }),
  );
  const span = to - from;
  const flags = Math.max(6, Math.round(span * 5));
  for (let i = 1; i < flags; i++) {
    const f = i / flags;
    const point = layout.roadPoint(from + span * f, PAVEMENT);
    const sag = Math.sin(f * Math.PI) * 0.55;
    const ahead = layout.roadPoint(from + span * f + 0.05, PAVEMENT).sub(point);
    const flag = new Mesh(pennantShape(), cloth[i % 2]!);
    flag.position.set(point.x, POLE_HEIGHT - 0.1 - sag, point.z);
    flag.rotation.y = Math.atan2(-ahead.z, ahead.x);
    group.add(flag);
  }
  group.name = 'bunting';
  return group;
}

/** A "for sale" board in front of each lot of a player who cannot pay their way. */
export function debtBoards(layout: BoardLayout, lots: readonly number[], dark: boolean): Group {
  const group = new Group();
  for (const space of lots) {
    const frame = layout.lots[space]!;
    const board = saleBoard(dark);
    board.position.copy(layout.roadPoint(space, PAVEMENT + 0.6));
    board.position.addScaledVector(frame.along, 0.9);
    board.rotation.y = frame.yaw + Math.PI;
    group.add(board);
  }
  return group;
}

const beamGeometry = new CylinderGeometry(1.5, 2.1, 40, 24, 1, true);
beamGeometry.translate(0, 20, 0);
beamGeometry.userData.shared = true;

/** Columns of soft light in the winner's colour over every lot they own. */
export function beacons(layout: BoardLayout, lots: readonly number[], colour: string): Group {
  const group = new Group();
  const light = new MeshBasicMaterial({
    color: new Color(colour),
    transparent: true,
    opacity: 0.28,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const glow = new SpriteMaterial({
    map: glowTexture(),
    color: new Color(colour),
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  for (const space of lots) {
    const centre = layout.lots[space]!.centre;
    const beam = new Mesh(beamGeometry, light);
    beam.position.set(centre.x, 0, centre.z);
    beam.renderOrder = 3;
    group.add(beam);
    const halo = new Sprite(glow);
    halo.position.set(centre.x, 1.2, centre.z);
    halo.scale.setScalar(9);
    group.add(halo);
  }
  return group;
}

interface Puff {
  readonly sprites: Sprite[];
  readonly drift: Vector3[];
  age: number;
}

const PUFF_SECONDS = 1.4;

/** Dust that rises and thins where a lot is cleared; it tidies itself away. */
export class Dust {
  readonly group = new Group();
  private readonly puffs: Puff[] = [];
  private readonly material: SpriteMaterial;

  constructor(dark: boolean) {
    this.material = new SpriteMaterial({
      map: glowTexture(),
      color: new Color(dark ? '#8e8a9c' : '#d8cbb3'),
      transparent: true,
      depthWrite: false,
    });
  }

  add(points: readonly Vector3[]): void {
    for (const point of points) {
      const sprites: Sprite[] = [];
      const drift: Vector3[] = [];
      for (let i = 0; i < 7; i++) {
        const sprite = new Sprite(this.material.clone());
        const a = (i / 7) * Math.PI * 2;
        sprite.position.set(point.x + Math.cos(a) * 0.8, 0.6, point.z + Math.sin(a) * 0.8);
        sprite.scale.setScalar(1.5);
        sprites.push(sprite);
        drift.push(new Vector3(Math.cos(a) * 1.6, 1.2 + (i % 3) * 0.4, Math.sin(a) * 1.6));
        this.group.add(sprite);
      }
      this.puffs.push({ sprites, drift, age: 0 });
    }
  }

  step(seconds: number): void {
    for (const puff of [...this.puffs]) {
      puff.age += seconds;
      const p = Math.min(1, puff.age / PUFF_SECONDS);
      puff.sprites.forEach((sprite, i) => {
        sprite.position.addScaledVector(puff.drift[i]!, seconds * (1 - p));
        sprite.scale.setScalar(1.5 + p * 3.5);
        (sprite.material as SpriteMaterial).opacity = 0.7 * (1 - p);
      });
      if (p < 1) continue;
      for (const sprite of puff.sprites) {
        this.group.remove(sprite);
        (sprite.material as SpriteMaterial).dispose();
      }
      this.puffs.splice(this.puffs.indexOf(puff), 1);
    }
  }
}
