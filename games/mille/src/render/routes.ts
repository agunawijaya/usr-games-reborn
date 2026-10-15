/**
 * The routes a hand can run along, each with a palette for day and for night. The shared parts
 * of the road (sky, tarmac, posts, verge) read these colours; each route's own scenery painter
 * (`scenery.ts`) adds its landscape and props.
 */

export type RouteId = 'coast' | 'desert' | 'alpine' | 'jungle' | 'city';

export interface RoutePalette {
  skyTop: string;
  skyLow: string;
  sun: string;
  sunHalo: string;
  cloud: string;
  far: string;
  farDeep: string;
  sea: string;
  seaLight: string;
  hill: string;
  hillDeep: string;
  foliage: string;
  foliageDeep: string;
  wall: string;
  roof: string;
  window: string;
  asphalt: string;
  asphaltEdge: string;
  lane: string;
  rail: string;
  verge: string;
  vergeDeep: string;
  post: string;
  postInk: string;
}

export interface Route {
  id: RouteId;
  name: string;
  day: RoutePalette;
  night: RoutePalette;
}

export const COAST: Route = {
  id: 'coast',
  name: 'Coastal Highway',
  day: {
    skyTop: '#86cbe3',
    skyLow: '#fde6c0',
    sun: '#ffcf5c',
    sunHalo: 'rgba(255, 214, 120, 0.32)',
    cloud: '#fff7ea',
    far: '#9cc7c6',
    farDeep: '#7fb2b3',
    sea: '#2a8a9a',
    seaLight: '#69bec6',
    hill: '#d99a55',
    hillDeep: '#b8743a',
    foliage: '#3f7d4b',
    foliageDeep: '#2b5d3a',
    wall: '#fbf1dd',
    roof: '#d4643c',
    window: '#2c5d7a',
    asphalt: '#5b616b',
    asphaltEdge: '#474c55',
    lane: '#f6e8c3',
    rail: '#e3e2da',
    verge: '#e7c58c',
    vergeDeep: '#c9a15f',
    post: '#f6efe0',
    postInk: '#1d2838',
  },
  night: {
    skyTop: '#0a1430',
    skyLow: '#2c3a6e',
    sun: '#f5ecd0',
    sunHalo: 'rgba(220, 230, 255, 0.16)',
    cloud: '#2b3966',
    far: '#1d2a4c',
    farDeep: '#162241',
    sea: '#0e2c40',
    seaLight: '#7fa6c8',
    hill: '#2c2f4d',
    hillDeep: '#22243d',
    foliage: '#16303a',
    foliageDeep: '#0f2229',
    wall: '#3b4466',
    roof: '#4a3a52',
    window: '#ffcf7a',
    asphalt: '#262a35',
    asphaltEdge: '#1b1e27',
    lane: '#c9b98f',
    rail: '#5c6378',
    verge: '#2c2b3d',
    vergeDeep: '#212031',
    post: '#cfd3dc',
    postInk: '#1d2838',
  },
};

export const DESERT: Route = {
  id: 'desert',
  name: 'Desert Run',
  day: {
    ...COAST.day,
    skyTop: '#6fb7d8',
    skyLow: '#ffd9a6',
    sun: '#ffd25c',
    cloud: '#fff4e2',
    far: '#c98a8a',
    farDeep: '#b0707a',
    sea: '#e2a663',
    seaLight: '#f0c48a',
    hill: '#d9733f',
    hillDeep: '#b5552c',
    foliage: '#5f8f4e',
    foliageDeep: '#456e3a',
    wall: '#f6ead2',
    roof: '#3e7f86',
    window: '#2c5d7a',
    asphalt: '#6a6461',
    asphaltEdge: '#57514f',
    lane: '#f8e2a6',
    rail: '#8a6a4a',
    verge: '#e9b779',
    vergeDeep: '#cf9556',
    post: '#f6efe0',
  },
  night: {
    ...COAST.night,
    skyTop: '#1a1038',
    skyLow: '#5a2e5e',
    sun: '#f6e8cf',
    cloud: '#3a2758',
    far: '#3d2546',
    farDeep: '#311d3c',
    sea: '#4a2c45',
    seaLight: '#6b4060',
    hill: '#4c2a3c',
    hillDeep: '#3b2030',
    foliage: '#24423a',
    foliageDeep: '#1a332c',
    wall: '#4a3a52',
    roof: '#2c4a56',
    window: '#ffcf7a',
    asphalt: '#2b262c',
    asphaltEdge: '#201c22',
    lane: '#c9b080',
    rail: '#5a4a52',
    verge: '#3a2836',
    vergeDeep: '#2c1e2a',
    post: '#d6cdd6',
  },
};

export const ALPINE: Route = {
  id: 'alpine',
  name: 'Snowline Pass',
  day: {
    ...COAST.day,
    skyTop: '#5aa2dc',
    skyLow: '#e3f1fa',
    sun: '#fff1b3',
    cloud: '#ffffff',
    far: '#9fb6d6',
    farDeep: '#7f99c0',
    sea: '#dfe9f3',
    seaLight: '#ffffff',
    hill: '#e9f1f7',
    hillDeep: '#c6d6e6',
    foliage: '#2f6b55',
    foliageDeep: '#1f4f40',
    wall: '#a6633c',
    roof: '#3a3f52',
    window: '#ffd27a',
    asphalt: '#565e6a',
    asphaltEdge: '#454b56',
    lane: '#f4f1e6',
    rail: '#d4dbe3',
    verge: '#eef4f9',
    vergeDeep: '#cdd9e5',
    post: '#ffffff',
  },
  night: {
    ...COAST.night,
    skyTop: '#06142a',
    skyLow: '#1f3a5c',
    sun: '#eef2ff',
    cloud: '#22385a',
    far: '#2c4468',
    farDeep: '#22375a',
    sea: '#3a5478',
    seaLight: '#9fb8d8',
    hill: '#5d7598',
    hillDeep: '#465e82',
    foliage: '#14302a',
    foliageDeep: '#0d221d',
    wall: '#5a3a2c',
    roof: '#1d2433',
    window: '#ffcf7a',
    asphalt: '#262b35',
    asphaltEdge: '#1b1f27',
    lane: '#c8c4b6',
    rail: '#6b7690',
    verge: '#7c8eaa',
    vergeDeep: '#5e7090',
    post: '#dfe6f2',
  },
};

export const JUNGLE: Route = {
  id: 'jungle',
  name: 'Rainforest Loop',
  day: {
    ...COAST.day,
    skyTop: '#7cc6c0',
    skyLow: '#e9f5d6',
    sun: '#fff0a6',
    cloud: '#f6fbef',
    far: '#7fb39a',
    farDeep: '#5f9a80',
    sea: '#4f9d7c',
    seaLight: '#bfe7d4',
    hill: '#3f8a57',
    hillDeep: '#2e6e44',
    foliage: '#2f7d3f',
    foliageDeep: '#1f5c2e',
    wall: '#f3e2c0',
    roof: '#b5532e',
    window: '#2c5d4a',
    asphalt: '#5c605e',
    asphaltEdge: '#4a4e4c',
    lane: '#f4e6b8',
    rail: '#8c6b45',
    verge: '#6aa04f',
    vergeDeep: '#4f8a3a',
    post: '#f6efe0',
  },
  night: {
    ...COAST.night,
    skyTop: '#071c24',
    skyLow: '#1b3d44',
    sun: '#eaf3e0',
    cloud: '#1f3b40',
    far: '#16343a',
    farDeep: '#112a30',
    sea: '#1d4a44',
    seaLight: '#8fcfc0',
    hill: '#143a2c',
    hillDeep: '#0e2d22',
    foliage: '#173f2b',
    foliageDeep: '#0f2e1f',
    wall: '#3c4a3e',
    roof: '#4a2f2a',
    window: '#ffd27a',
    asphalt: '#22282a',
    asphaltEdge: '#191e20',
    lane: '#bdb48c',
    rail: '#4a3e30',
    verge: '#1c3a26',
    vergeDeep: '#142c1c',
    post: '#d2dccf',
  },
};

export const CITY: Route = {
  id: 'city',
  name: 'Night City',
  day: {
    ...COAST.day,
    skyTop: '#5b6fb5',
    skyLow: '#ffb48a',
    sun: '#ffcf7a',
    cloud: '#ffd6c0',
    far: '#8a7fb5',
    farDeep: '#71669c',
    sea: '#5c5f8f',
    seaLight: '#ffd2a8',
    hill: '#4a4f7a',
    hillDeep: '#3a3e66',
    foliage: '#3f6b55',
    foliageDeep: '#2d5141',
    wall: '#5a5f8a',
    roof: '#3a3d63',
    window: '#ffe0a0',
    asphalt: '#4f5260',
    asphaltEdge: '#40424f',
    lane: '#f4e3b6',
    rail: '#8a8ea8',
    verge: '#9a9cb0',
    vergeDeep: '#7c7f96',
    post: '#f2eee6',
  },
  night: {
    ...COAST.night,
    skyTop: '#090a24',
    skyLow: '#2c1d4e',
    sun: '#f3ecd6',
    cloud: '#241c44',
    far: '#1a1838',
    farDeep: '#14122e',
    sea: '#1c1a3a',
    seaLight: '#ff8fc4',
    hill: '#161530',
    hillDeep: '#100f26',
    foliage: '#173a32',
    foliageDeep: '#0f2a24',
    wall: '#1e1d3c',
    roof: '#151430',
    window: '#ffcf7a',
    asphalt: '#1f1f2c',
    asphaltEdge: '#16161f',
    lane: '#c9bf9a',
    rail: '#3a3a56',
    verge: '#2a2a3e',
    vergeDeep: '#1f1f30',
    post: '#d8d6e4',
  },
};

export const ROUTES: Readonly<Record<RouteId, Route>> = {
  coast: COAST,
  desert: DESERT,
  alpine: ALPINE,
  jungle: JUNGLE,
  city: CITY,
};
