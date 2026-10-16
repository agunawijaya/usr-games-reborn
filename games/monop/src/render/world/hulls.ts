import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

/**
 * Boat hulls, lofted from a plan outline: a pointed stem at the bow, a flat transom at the stern,
 * sides that flare out from a narrow keel to the deck edge, and a deck that rises towards the
 * bow. Those four cues are what make a shape read as a boat rather than a box, even from across
 * the harbour. The bow points along +x; y = 0 is the waterline.
 */

export interface HullBand {
  colour: string;
  /** Where the band stops, as a height above the waterline. */
  to?: number;
  /** Or where it stops as a distance below the deck edge, so a stripe follows the sheer. */
  belowDeck?: number;
}

export interface HullSpec {
  length: number;
  beam: number;
  /** Height of the deck edge above the waterline, amidships. */
  freeboard: number;
  /** Depth of the keel below the waterline. */
  draught: number;
  /** How much higher the deck edge stands at the bow than amidships. */
  sheer: number;
  /** How far aft (0 stern … 1 bow) the sides start curving in to the stem. */
  shoulder: number;
  /** The transom's width as a share of the beam. */
  transom: number;
  /** The colours up the side, bottom first; the last band runs up to the deck edge. */
  bands: readonly HullBand[];
  deck: string;
}

const STATIONS = 16;
/** The keel's outline is this share of the deck's, so the sides flare out as they rise. */
const KEEL_WIDTH = 0.42;
const KEEL_LENGTH = 0.86;

interface PlanPoint {
  x: number;
  z: number;
  /** How far along from stern to bow, for the sheer. */
  u: number;
}

function halfBeam(spec: HullSpec, u: number): number {
  const half = spec.beam / 2;
  if (u >= spec.shoulder) {
    const v = (u - spec.shoulder) / (1 - spec.shoulder);
    return half * (1 - v * v);
  }
  // The quarters round off into the transom.
  const easing = Math.sin(Math.min(1, u / 0.22) * (Math.PI / 2));
  return half * (spec.transom + (1 - spec.transom) * easing);
}

/** Round the deck edge: starboard from stern to bow, then port from bow back to the stern. */
function planOutline(spec: HullSpec): PlanPoint[] {
  const starboard: PlanPoint[] = [];
  for (let i = 0; i <= STATIONS; i++) {
    const u = i / STATIONS;
    starboard.push({ x: (u - 0.5) * spec.length, z: halfBeam(spec, u), u });
  }
  const port = starboard
    .slice(0, -1)
    .reverse()
    .map((p) => ({ ...p, z: -p.z }));
  return [...starboard, ...port];
}

function deckEdge(spec: HullSpec, u: number): number {
  return spec.freeboard + spec.sheer * u * u * u;
}

/** A point on the hull's skin at height y: the outline narrows and draws in towards the keel. */
function skin(spec: HullSpec, p: PlanPoint, y: number): [number, number, number] {
  const top = deckEdge(spec, p.u);
  const t = Math.max(0, Math.min(1, (y + spec.draught) / (top + spec.draught)));
  // A round bilge: most of the flare happens low down.
  const flare = 1 - (1 - t) * (1 - t);
  const width = KEEL_WIDTH + (1 - KEEL_WIDTH) * flare;
  const length = KEEL_LENGTH + (1 - KEEL_LENGTH) * flare;
  return [p.x * length, y, p.z * width];
}

function bandTop(spec: HullSpec, band: HullBand, u: number): number {
  const top = deckEdge(spec, u);
  if (band.belowDeck !== undefined) return top - band.belowDeck;
  return Math.min(band.to ?? top, top);
}

class Builder {
  readonly positions: number[] = [];
  readonly colours: number[] = [];
  readonly indices: number[] = [];

  vertex(position: readonly number[], colour: Color): number {
    this.positions.push(position[0]!, position[1]!, position[2]!);
    this.colours.push(colour.r, colour.g, colour.b);
    return this.positions.length / 3 - 1;
  }

  /** A fan over a flat-ish ring; `up` says which way the face should look. */
  cap(ring: readonly (readonly number[])[], colour: Color, up: boolean): void {
    const centre = [0, 0, 0];
    for (const p of ring) for (let k = 0; k < 3; k++) centre[k]! += p[k]! / ring.length;
    const middle = this.vertex(centre, colour);
    const rim = ring.map((p) => this.vertex(p, colour));
    rim.forEach((a, i) => {
      const b = rim[(i + 1) % rim.length]!;
      const [ax, , az] = ring[i]!;
      const [bx, , bz] = ring[(i + 1) % ring.length]!;
      // The y of the cross product of the two rim edges from the centre: positive faces up.
      const facesUp =
        (az! - centre[2]!) * (bx! - centre[0]!) - (ax! - centre[0]!) * (bz! - centre[2]!) > 0;
      if (facesUp === up) this.indices.push(middle, a, b);
      else this.indices.push(middle, b, a);
    });
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(this.colours, 3));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}

function loft(spec: HullSpec): BufferGeometry {
  const outline = planOutline(spec);
  const builder = new Builder();
  let lower = outline.map((p) => skin(spec, p, -spec.draught));
  spec.bands.forEach((band, index) => {
    const last = index === spec.bands.length - 1;
    const upper = outline.map((p) =>
      skin(spec, p, last ? deckEdge(spec, p.u) : bandTop(spec, band, p.u)),
    );
    // Each band has its own vertices, so its colour ends on a crisp line.
    const colour = new Color(band.colour);
    const bottom = lower.map((p) => builder.vertex(p, colour));
    const top = upper.map((p) => builder.vertex(p, colour));
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      builder.indices.push(bottom[i]!, bottom[j]!, top[j]!, bottom[i]!, top[j]!, top[i]!);
    }
    lower = upper;
  });
  builder.cap(lower, new Color(spec.deck), true);
  builder.cap(
    outline.map((p) => skin(spec, p, -spec.draught)),
    new Color(spec.bands[0]!.colour),
    false,
  );
  return builder.build();
}

const hulls = new Map<string, BufferGeometry>();

/** A hull's geometry, painted in vertex colours; shared between every boat of the same spec. */
export function hullGeometry(spec: HullSpec): BufferGeometry {
  const key = JSON.stringify(spec);
  let geometry = hulls.get(key);
  if (!geometry) {
    geometry = loft(spec);
    geometry.userData.shared = true;
    hulls.set(key, geometry);
  }
  return geometry;
}

/** The height of the deck edge at a point along the hull, for standing things on the deck. */
export function deckHeight(spec: HullSpec, x: number): number {
  return deckEdge(spec, Math.max(0, Math.min(1, x / spec.length + 0.5)));
}
