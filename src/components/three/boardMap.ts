// Anchor points on the Ethnos board photo (public/Ethnos.jpg, 2852x2846).
// Everything is expressed in image UV space: u right, v DOWN from the top-left
// corner of the image, both 0..1 — tune against /board-debug, which overlays
// these values on the photo.

export type UV = [number, number];

/** World size of the board plane (the table the game sits on is larger). */
export const BOARD_W = 11;
export const BOARD_H = BOARD_W * (2846 / 2852);

/** Map an image UV to world XZ (image top edge faces away from the camera). */
export function uvToWorld(u: number, v: number): [number, number] {
  return [(u - 0.5) * BOARD_W, (v - 0.5) * BOARD_H];
}

// The prestige track runs 0..79 clockwise around the board edge: 0 is the
// star hex at the top-left, 20 top-right, 40 bottom-right, 60 bottom-left.
const TRACK_CORNERS: UV[] = [
  [0.031, 0.035], // 0
  [0.9565, 0.035], // 20
  [0.9625, 0.9845], // 40
  [0.031, 0.9845], // 60
];

/** Board position of a prestige value (wraps past 80 like the physical track). */
export function trackUV(prestige: number): UV {
  const n = ((Math.round(prestige) % 80) + 80) % 80;
  const seg = Math.floor(n / 20);
  const t = (n % 20) / 20;
  const a = TRACK_CORNERS[seg];
  const b = TRACK_CORNERS[(seg + 1) % 4];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export interface RegionAnchors {
  /** Visual centre of the region art — click hotspot + highlight ring. */
  center: UV;
  /** Hotspot radius (in u units). */
  clickR: number;
  /** Centre of the area where control markers cluster. */
  markers: UV;
  /** Ellipse radii (u, v) the marker clusters stay inside. */
  markerR: [number, number];
  /** The region's Ⅰ/Ⅱ/Ⅲ prestige-token slots printed on the board. */
  box: [UV, UV, UV];
}

export const REGION_MAP: Record<string, RegionAnchors> = {
  red: {
    center: [0.47, 0.235],
    clickR: 0.095,
    markers: [0.475, 0.245],
    markerR: [0.07, 0.05],
    box: [
      [0.4475, 0.117],
      [0.495, 0.117],
      [0.5417, 0.117],
    ],
  },
  blue: {
    center: [0.775, 0.445],
    clickR: 0.095,
    markers: [0.775, 0.455],
    markerR: [0.06, 0.065],
    box: [
      [0.760, 0.2650],
      [0.8075, 0.2650],
      [0.855, 0.2650],
    ],
  },
  green: {
    center: [0.205, 0.425],
    clickR: 0.095,
    markers: [0.205, 0.435],
    markerR: [0.06, 0.07],
    box: [
      [0.108, 0.2415],
      [0.153, 0.2415],
      [0.199, 0.2415],
    ],
  },
  yellow: {
    center: [0.325, 0.665],
    clickR: 0.095,
    markers: [0.32, 0.67],
    markerR: [0.07, 0.055],
    box: [
      [0.108, 0.868],
      [0.154, 0.868],
      [0.201, 0.868],
    ],
  },
  black: {
    center: [0.645, 0.7],
    clickR: 0.095,
    markers: [0.65, 0.705],
    markerR: [0.07, 0.055],
    box: [
      [0.786, 0.8575],
      [0.8335, 0.8575],
      [0.881, 0.8575],
    ],
  },
  white: {
    center: [0.49, 0.42],
    clickR: 0.08,
    markers: [0.49, 0.415],
    markerR: [0.065, 0.05],
    box: [
      [0.4467, 0.545],
      [0.4942, 0.545],
      [0.5417, 0.545],
    ],
  },
};
