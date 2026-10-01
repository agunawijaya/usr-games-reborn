// The recognisable "face" of the Moon, as data.
//
// Every entry is a real near-side feature at its IAU selenographic
// coordinates (lat north +, lon east +; east is toward Mare Crisium,
// which appears on the RIGHT as seen from the northern hemisphere).
// Diameters in km; the Moon's radius is 1737.4 km.
// Source: IAU/USGS Gazetteer of Planetary Nomenclature.
//
// The bake shader turns this table into basins, bright rays and dark
// floors; the procedural crater field fills in everything else. The
// same table powers the hover tooltips.

export const MOON_RADIUS_KM = 1737.4;

// Maria: [name, meaning, lat, lon, diameterKm, tint(-1 blue .. +1 brown), ring]
// `ring` = strength of the mountainous basin rim (Apennines etc.).
// Irregular seas are built from several overlapping lobes; only the
// first lobe of each name carries a tooltip.
export const MARIA = [
  ['Mare Imbrium', 'Sea of Showers', 32.8, -15.6, 1146, 0.0, 1.0],
  ['Mare Serenitatis', 'Sea of Serenity', 28.0, 17.5, 707, 0.55, 0.8],
  ['Mare Tranquillitatis', 'Sea of Tranquility', 8.5, 31.4, 873, -0.9, 0.2],
  ['', '', 14.0, 25.0, 420, -0.8, 0.0],
  ['Mare Crisium', 'Sea of Crises', 17.0, 59.1, 556, 0.1, 0.9],
  ['Mare Fecunditatis', 'Sea of Fecundity', -7.8, 51.3, 740, -0.2, 0.1],
  ['', '', -2.0, 49.0, 380, -0.2, 0.0],
  ['Mare Nectaris', 'Sea of Nectar', -15.2, 35.5, 333, 0.1, 0.7],
  ['Mare Nubium', 'Sea of Clouds', -21.3, -16.6, 715, 0.1, 0.2],
  ['Mare Humorum', 'Sea of Moisture', -24.4, -38.6, 389, 0.0, 0.7],
  ['Mare Vaporum', 'Sea of Vapours', 13.3, 3.6, 245, 0.3, 0.0],
  ['Sinus Medii', 'Bay of the Centre', 2.4, 1.7, 300, 0.1, 0.0],
  ['Mare Insularum', 'Sea of Islands', 7.5, -30.9, 513, 0.0, 0.0],
  ['Mare Cognitum', 'Sea that has become Known', -10.0, -23.1, 376, 0.0, 0.0],
  ['Oceanus Procellarum', 'Ocean of Storms', 18.4, -57.4, 900, -0.5, 0.0],
  ['', '', 32.0, -52.0, 760, -0.4, 0.0],
  ['', '', 4.0, -50.0, 820, -0.5, 0.0],
  ['', '', -8.0, -42.0, 560, -0.3, 0.0],
  ['', '', 42.0, -62.0, 480, -0.3, 0.0],
  ['', '', 20.0, -72.0, 520, -0.4, 0.0],
  ['', '', -2.0, -64.0, 420, -0.4, 0.0],
  ['Sinus Iridum', 'Bay of Rainbows', 44.1, -31.5, 236, 0.0, 0.0],
  ['Mare Frigoris', 'Sea of Cold', 56.0, 1.4, 300, 0.2, 0.0],
  ['', '', 57.0, -9.0, 290, 0.2, 0.0],
  ['', '', 57.5, -20.0, 290, 0.2, 0.0],
  ['', '', 58.0, -32.0, 270, 0.2, 0.0],
  ['', '', 58.5, -44.0, 240, 0.2, 0.0],
  ['', '', 55.5, 12.0, 290, 0.2, 0.0],
  ['', '', 55.5, 23.0, 270, 0.2, 0.0],
  ['', '', 56.0, 34.0, 230, 0.2, 0.0],
  ['Lacus Somniorum', 'Lake of Dreams', 38.0, 29.2, 230, 0.3, 0.0],
  ['Mare Smythii', "Smyth's Sea", -1.3, 87.5, 373, 0.0, 0.0],
  ['Mare Marginis', 'Sea of the Edge', 13.3, 86.1, 358, 0.0, 0.0],
  ['Mare Australe', 'Southern Sea', -38.9, 93.0, 600, 0.0, 0.0],
  ['Mare Orientale', 'Eastern Sea', -19.9, -94.7, 327, 0.0, 0.9],
];

// Craters: [name, note, lat, lon, diameterKm, fresh(0..1), rays(0..1), darkFloor(0..1)]
export const CRATERS = [
  ['Tycho', 'Young crater with the Moon’s grandest ray system', -43.3, -11.2, 85, 1.0, 1.0, 0.0],
  ['Copernicus', '"Monarch of the Moon", 800 million years young', 9.6, -20.1, 93, 0.95, 0.75, 0.0],
  ['Kepler', 'Bright rayed crater in the Ocean of Storms', 8.1, -38.0, 31, 0.95, 0.55, 0.0],
  ['Aristarchus', 'Brightest large feature on the Moon', 23.7, -47.4, 40, 1.0, 0.45, 0.0],
  ['Proclus', 'Rays fan out like a peacock’s tail', 16.1, 46.8, 28, 1.0, 0.45, 0.0],
  ['Plato', 'Dark lava-flooded floor', 51.6, -9.4, 101, 0.3, 0.0, 1.0],
  ['Grimaldi', 'One of the darkest spots on the near side', -5.2, -68.6, 173, 0.2, 0.0, 1.0],
  ['Clavius', 'Giant walled plain, 231 km across', -58.4, -14.4, 231, 0.35, 0.0, 0.0],
  ['Ptolemaeus', 'Flat, ancient walled plain', -9.3, -1.9, 153, 0.25, 0.0, 0.2],
  ['Alphonsus', 'Central peak and dark-halo vents', -13.4, -2.8, 108, 0.35, 0.0, 0.0],
  ['Arzachel', 'Terraced walls, central peak', -18.2, -1.9, 97, 0.5, 0.0, 0.0],
  ['Theophilus', 'Sharp terraced rim and a massive central peak', -11.4, 26.4, 99, 0.75, 0.1, 0.0],
  ['Cyrillus', 'Older neighbour of Theophilus', -13.2, 24.0, 98, 0.35, 0.0, 0.0],
  ['Catharina', 'Heavily eroded walled plain', -18.1, 23.6, 99, 0.25, 0.0, 0.0],
  ['Langrenus', 'Prominent on the waxing crescent', -8.9, 60.9, 132, 0.7, 0.2, 0.0],
  ['Petavius', 'Floor split by a great rille', -25.3, 60.4, 188, 0.5, 0.0, 0.0],
  ['Eratosthenes', 'Marks the end of the Apennines', 14.5, -11.3, 58, 0.6, 0.0, 0.0],
  ['Archimedes', 'Flat-floored plain in Imbrium', 29.7, -4.0, 83, 0.4, 0.0, 0.5],
  ['Posidonius', 'Floor-fractured crater on Serenitatis’ shore', 31.8, 29.9, 95, 0.4, 0.0, 0.0],
  ['Maginus', 'Worn giant near Tycho', -50.0, -6.2, 194, 0.2, 0.0, 0.0],
  ['Longomontanus', 'Large southern walled plain', -49.6, -21.7, 145, 0.3, 0.0, 0.0],
  ['Stevinus', 'Small bright rayed crater', -32.5, 54.2, 74, 0.9, 0.35, 0.0],
  ['Furnerius', 'Old crater crossed by rays', -36.0, 60.6, 125, 0.3, 0.0, 0.0],
  ['Aristoteles', 'Terraced crater at the edge of Frigoris', 50.2, 17.4, 88, 0.6, 0.0, 0.0],
];

const DEG = Math.PI / 180;

/** Unit vector for a selenographic lat/lon (deg); +z faces Earth, +x is east. */
export function selenoToVec(latDeg, lonDeg) {
  const la = latDeg * DEG;
  const lo = lonDeg * DEG;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

/** Angular radius (radians) of a feature of the given diameter. */
export function angularRadius(diameterKm) {
  return diameterKm / 2 / MOON_RADIUS_KM;
}

/** Flattened uniform arrays for the bake shader. */
export function featureUniforms() {
  const mA = [];
  const mB = [];
  for (const [, , lat, lon, dia, tint, ring] of MARIA) {
    mA.push(...selenoToVec(lat, lon), angularRadius(dia));
    mB.push(tint, ring, 0, 0);
  }
  const cA = [];
  const cB = [];
  for (const [, , lat, lon, dia, fresh, rays, dark] of CRATERS) {
    cA.push(...selenoToVec(lat, lon), angularRadius(dia));
    cB.push(fresh, rays, dark, 0);
  }
  return {
    mariaCount: MARIA.length, mariaA: new Float32Array(mA), mariaB: new Float32Array(mB),
    craterCount: CRATERS.length, craterA: new Float32Array(cA), craterB: new Float32Array(cB),
  };
}

/**
 * Name the feature under a selenographic point (unit vector), if any.
 * Craters win over maria (they are smaller and sit on top).
 */
export function featureAt(v) {
  let best = null;
  for (const [name, note, lat, lon, dia] of CRATERS) {
    const c = selenoToVec(lat, lon);
    const ang = Math.acos(Math.min(1, v[0] * c[0] + v[1] * c[1] + v[2] * c[2]));
    const r = Math.max(angularRadius(dia) * 1.15, 0.018);
    if (ang < r && (!best || ang / r < best.score)) best = { name, note, kind: 'crater', dia, score: ang / r };
  }
  if (best) return best;
  let owner = null; // unnamed lobes belong to the preceding named sea
  for (const [n, meaning, lat, lon, dia] of MARIA) {
    if (n) owner = [n, meaning];
    const [name, note] = owner;
    const c = selenoToVec(lat, lon);
    const ang = Math.acos(Math.min(1, v[0] * c[0] + v[1] * c[1] + v[2] * c[2]));
    const r = angularRadius(dia) * 0.85;
    if (ang < r && (!best || ang / r < best.score)) best = { name, note, kind: 'mare', dia, score: ang / r };
  }
  return best;
}
