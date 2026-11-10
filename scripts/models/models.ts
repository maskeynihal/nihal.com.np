/**
 * Code-built models (D-06 grey boxes, D-03 detail). Units: metres, matching the colliders in
 * `src/content/objects.ts`. Local origin sits on the floor at the object's footprint centre
 * (y = 0 is the sheet); each model fits its collider, so `home` poses work unchanged.
 *
 * A model is a `body` plus optional named child nodes (clock hands, calendar face, ghost eyes,
 * OLED screen) that the runtime rotates or textures. Each named node has its origin at its pivot,
 * so rotating it needs no other bookkeeping. Creases are authored per part, never by angle.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import {
  FLOOR_Y,
  HAND_OFFSET,
  HAND_R,
  ankleAt,
  hipAt,
  kneeAt,
  HEAD_OFFSET,
  HIP,
  LEAN,
  NECK_H,
  SEAT_TOP,
  TORSO_H,
  neckAt,
  restArm,
} from '../../src/lib/desk/rig';
import {
  ball,
  bar,
  box,
  cylinder,
  extrude,
  lathe,
  lineSeg,
  merge,
  mergeAll,
  quad,
  ringLines,
  rotateX,
  rotateY,
  roundedFloor,
  roundedRect,
  torus,
  transform,
  translate,
  dome,
  emptyPart,
  type Part,
  type Vec3,
} from './geom';

/** A named child node: `part` is in the node's own frame, `origin` places it in the model. */
export interface NodeDef {
  name: string;
  origin: Vec3;
  part: Part;
  /** Rotation about Y (radians) applied only when drawing the poster; the GLB node stays at identity. */
  posterYaw?: number;
  /** Drawn on the poster only (not in the GLB): something the Scene draws itself, such as the laptop's cable. */
  posterOnly?: boolean;
}

export interface ModelParts {
  body: Part;
  nodes: NodeDef[];
}

export interface ModelDef {
  /** GLB basename, matches `BodyDef.model` (without `.glb`). */
  file: string;
  /** Root node name inside the GLB. */
  name: string;
  parts: () => ModelParts;
  /** Everything merged in the authored rest pose (identity node transforms). */
  build: () => Part;
  /** Everything merged with `posterYaw` applied (used by the poster only). */
  buildPosed: () => Part;
}

export function flatten(mp: ModelParts, posed: boolean): Part {
  const out = emptyPart();
  merge(out, mp.body);
  for (const n of mp.nodes) {
    if (n.posterOnly && !posed) continue;
    const p = posed && n.posterYaw ? rotateY(n.part, n.posterYaw) : n.part;
    merge(out, translate(p, n.origin));
  }
  return out;
}

function def(
  file: string,
  parts: () => ModelParts,
  name: string = file,
): ModelDef {
  return {
    file,
    name,
    parts,
    build: () => flatten(parts(), false),
    buildPosed: () => flatten(parts(), true),
  };
}

export const SHEET_SIZE = { w: 2.0, d: 1.2 } as const;

/** Lift for authored lines that sit on a surface, so they never z-fight with it. */
const LIFT = 0.0003;

/** Closed polyline from points. */
function loop(pts: Vec3[]): number[] {
  return pts.flatMap((p, i) => lineSeg(p, pts[(i + 1) % pts.length]!));
}

/** Rectangle on a horizontal plane at height y. */
const rectY = (x0: number, x1: number, y: number, z0: number, z1: number) =>
  loop([
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ]);

/** Rectangle on a plane of constant z. */
const rectZ = (x0: number, x1: number, y0: number, y1: number, z: number) =>
  loop([
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ]);

/** Rectangle on a plane of constant x. */
const rectX = (z0: number, z1: number, y0: number, y1: number, x: number) =>
  loop([
    [x, y0, z0],
    [x, y0, z1],
    [x, y1, z1],
    [x, y1, z0],
  ]);

/** Corner radius of the table top, m. */
const TOP_RADIUS = 0.04;
const CORNER_SEGS = 5;

/**
 * The drawing surface, y = 0: the top of the drafting table, a rounded-corner plane with a
 * drawing border, a blueprint grid (small crosses every 0.2 m) and a registration mark in each
 * corner. All authored lines; it is drawn in the sheet's thin secondary style and never hides
 * anything (`sheetOccluder`), so an object resting on it keeps its whole outline.
 */
function sheet(): ModelParts {
  const p = roundedFloor(
    [0, 0, 0],
    SHEET_SIZE.w,
    SHEET_SIZE.d,
    TOP_RADIUS,
    CORNER_SEGS,
  );
  const hw = SHEET_SIZE.w / 2 - 0.04;
  const hd = SHEET_SIZE.d / 2 - 0.04;
  const y = 0.0005;
  // drawing border, inset from the sheet edge
  p.lines.push(...rectY(-hw, hw, y, -hd, hd));
  // grid: a small cross at each 0.2 m crossing, clear of the border (the pitch is a cost: every
  // cross is inline in both posters)
  const tick = 0.012;
  for (let i = -4; i <= 4; i++)
    for (let j = -2; j <= 2; j++) {
      const x = i * 0.2;
      const z = j * 0.2;
      p.lines.push(
        ...lineSeg([x - tick, y, z], [x + tick, y, z]),
        ...lineSeg([x, y, z - tick], [x, y, z + tick]),
      );
    }
  // registration marks: a ring with a crosshair, in the gap between the border and the edge
  const mx = hw + 0.015;
  const mz = hd + 0.015;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const cx = sx * mx;
      const cz = sz * mz;
      p.lines.push(
        ...ringLines([cx, y, cz], 0.007, 12, 'y'),
        ...lineSeg([cx - 0.014, y, cz], [cx + 0.014, y, cz]),
        ...lineSeg([cx, y, cz - 0.014], [cx, y, cz + 0.014]),
      );
    }
  return { body: p, nodes: [] };
}

/**
 * The desk under the sheet: a thick board (rounded corners, same footprint as the sheet), a
 * shallow drawer with a pull under the left front, and an A-frame trestle base (two side frames,
 * a rung each and a rear stretcher; the front is open for the chair). Not an object: no collider,
 * never picked. Everything is below y = 0.
 *
 * The board's own top face sits 2 mm below the sheet and hides what is under it (the rear legs);
 * its top edge is drawn by the sheet's outline, so no crease is authored there. The whole base
 * is within 0.5 m of the top and 0.57 m of its front, so the hero and phone cameras both see it
 * inside their frames.
 */
const BOARD_TOP = -0.002;
const BOARD_THICK = 0.068;

function table(): ModelParts {
  const parts: Part[] = [];
  // Board: a rounded slab, laid flat. Creases at its top face are dropped (the sheet draws them).
  const slab = rotateX(
    extrude(
      roundedRect(SHEET_SIZE.w, SHEET_SIZE.d, TOP_RADIUS, CORNER_SEGS),
      BOARD_THICK,
      { corners: [] },
    ),
    -Math.PI / 2,
  );
  const board = translate(slab, [0, BOARD_TOP - BOARD_THICK / 2, 0]);
  const lines: number[] = [];
  for (let i = 0; i < board.lines.length; i += 6) {
    if (
      Math.abs(board.lines[i + 1]! - BOARD_TOP) < 1e-5 &&
      Math.abs(board.lines[i + 4]! - BOARD_TOP) < 1e-5
    )
      continue;
    lines.push(...board.lines.slice(i, i + 6));
  }
  board.lines = lines;
  parts.push(board);

  return { body: mergeAll(parts), nodes: [legs()] };
}

/**
 * The base of the desk: two A-shaped side frames (front and rear leg meeting under a rail), joined
 * by a rung each and a rear stretcher (the front is open for the chair). The `legs` node has its
 * pivot on the floor, so the Scene can stretch it upwards when the desk is raised for standing work.
 */
function legs(): NodeDef {
  const parts: Part[] = [];
  const XS = 0.84;
  const topY = BOARD_TOP - BOARD_THICK; // underside of the board
  const railY = topY - 0.05;
  const footY = -0.48;
  const legTopZ = 0.3;
  const legFootZ = 0.52;
  const legT = 0.045;
  /** z of a leg at height y (the front leg; the rear one is its mirror). */
  const legZ = (y: number) =>
    legTopZ + ((legFootZ - legTopZ) * (railY - y)) / (railY - footY);
  for (const sx of [-XS, XS]) {
    parts.push(
      box({ c: [sx, (topY + railY) / 2, 0], s: [legT, topY - railY, 0.8] }),
    );
    for (const sz of [-1, 1]) {
      parts.push(
        bar([sx, railY, sz * legTopZ], [sx, footY, sz * legFootZ], legT),
        box({ c: [sx, footY - 0.01, sz * legFootZ], s: [0.06, 0.02, 0.09] }),
      );
    }
    // the A's rung
    const ry = -0.28;
    parts.push(bar([sx, ry, -legZ(ry)], [sx, ry, legZ(ry)], 0.03));
  }
  // A rear stretcher only: the front stays open for the chair and the sitter's feet.
  const sy = -0.27;
  parts.push(bar([-XS, sy, -legZ(sy)], [XS, sy, -legZ(sy)], 0.03));
  return {
    name: 'legs',
    origin: [0, FLOOR_Y, 0],
    part: translate(mergeAll(parts), [0, -FLOOR_Y, 0]),
  };
}

/** Header row: a box with pin-slot ticks across its top face. */
function header(cx: number, cz: number, len: number, pins: number): Part {
  const h = 0.012;
  const top = 0.016 + h;
  const p = box({ c: [cx, 0.016 + h / 2, cz], s: [len, h, 0.0105] });
  const pitch = len / pins;
  for (let k = 1; k < pins; k++) {
    const x = cx - len / 2 + k * pitch;
    p.lines.push(
      ...lineSeg([x, top + LIFT, cz - 0.0052], [x, top + LIFT, cz + 0.0052]),
    );
  }
  return p;
}

/**
 * Uno R4 style board with an OLED module on stand-offs. Fills 0.34 x 0.06 x 0.22.
 * Named node `screen`: the OLED glass, a +Z-facing quad with UVs, rotated flat (faces +Y).
 */
function arduino(): ModelParts {
  const PCB_TOP = 0.016;
  const parts: Part[] = [
    box({ c: [0, 0.008, 0], s: [0.34, 0.016, 0.22] }), // pcb
    // usb-c and barrel jack on the left edge
    box({ c: [-0.1385, 0.0275, -0.045], s: [0.063, 0.023, 0.034] }),
    box({ c: [-0.1385, 0.0295, 0.055], s: [0.063, 0.027, 0.04] }),
    // digital and analog headers
    header(0.0, -0.0995, 0.2, 10),
    header(0.0, 0.0995, 0.2, 10),
    header(0.12, -0.0995, 0.07, 4),
    // mcu with a pin-1 notch
    box({ c: [0.075, 0.0205, 0.0], s: [0.05, 0.009, 0.05] }),
    // reset button and two electrolytic caps
    cylinder({
      c: [-0.09, 0.0205, 0.0],
      radius: 0.0075,
      height: 0.009,
      segments: 8,
    }),
    cylinder({
      c: [0.135, 0.022, 0.05],
      radius: 0.0075,
      height: 0.012,
      segments: 8,
    }),
    cylinder({
      c: [0.135, 0.022, 0.07],
      radius: 0.0075,
      height: 0.012,
      segments: 8,
    }),
  ];
  // stand-offs under the OLED module
  const OLED_BOTTOM = 0.04;
  for (const x of [-0.065, 0.015])
    for (const z of [-0.028, 0.028])
      parts.push(
        cylinder({
          c: [x, (PCB_TOP + OLED_BOTTOM) / 2, z],
          radius: 0.0035,
          height: OLED_BOTTOM - PCB_TOP,
          segments: 6,
          rings: false,
        }),
      );
  // oled carrier board and bezel
  parts.push(
    box({ c: [-0.025, 0.042, 0], s: [0.12, 0.004, 0.07] }),
    box({ c: [-0.025, 0.0495, 0], s: [0.112, 0.011, 0.062] }),
  );
  const p = mergeAll(parts);
  const BEZEL_TOP = 0.055;
  // mounting holes, mcu notch, glass window
  for (const [x, z] of [
    [-0.15, -0.09],
    [-0.15, 0.09],
    [0.15, -0.09],
    [0.15, 0.09],
  ] as const)
    p.lines.push(...ringLines([x, PCB_TOP + LIFT, z], 0.0045, 8, 'y'));
  p.lines.push(
    ...lineSeg(
      [0.0525, 0.0251 + LIFT, -0.018],
      [0.0525, 0.0251 + LIFT, -0.012],
    ),
  );
  p.lines.push(...rectY(-0.07, 0.02, BEZEL_TOP + LIFT, -0.024, 0.024));
  const glass = rotateX(quad(0.086, 0.044), -Math.PI / 2);
  return {
    body: p,
    nodes: [
      {
        name: 'screen',
        origin: [-0.025, BEZEL_TOP + LIFT * 2, 0],
        part: glass,
      },
    ],
  };
}

/** Clock face at 12 = -Z, clockwise from above. Hands rotate about Y by -angle. */
const dialAt = (angle: number, r: number, y: number): Vec3 => [
  Math.sin(angle) * r,
  y,
  -Math.cos(angle) * r,
];

/**
 * Round desk clock, face up, three instances. Fills 0.2 x 0.06 x 0.2.
 * Named nodes `hand-hour` and `hand-minute`: pivot at the dial centre, rest pose pointing at 12
 * (-Z); set rotation.y = -angle for a clockwise angle seen from above.
 */
function clock(): ModelParts {
  const DIAL = 0.047;
  const FOOT = 0.008;
  const profile: [number, number][] = [
    [0, FOOT],
    [0.09, FOOT],
    [0.098, 0.014],
    [0.098, 0.04],
    [0.1, 0.043],
    [0.1, 0.052],
    [0.09, 0.052],
    [0.084, DIAL],
    [0, DIAL],
  ];
  const parts: Part[] = [lathe([0, 0, 0], profile, 16)];
  parts[0]!.lines.push(
    ...ringLines([0, 0.052, 0], 0.1, 16),
    ...ringLines([0, 0.052, 0], 0.09, 16),
    ...ringLines([0, DIAL, 0], 0.084, 16),
    ...ringLines([0, 0.04, 0], 0.098, 16),
    ...ringLines([0, FOOT, 0], 0.09, 16),
  );
  // feet
  for (const a of [
    Math.PI / 4,
    (3 * Math.PI) / 4,
    (5 * Math.PI) / 4,
    (7 * Math.PI) / 4,
  ]) {
    parts.push(
      cylinder({
        c: [Math.sin(a) * 0.068, FOOT / 2, Math.cos(a) * 0.068],
        radius: 0.012,
        height: FOOT,
        segments: 8,
        rings: false,
      }),
    );
  }
  // centre hub
  parts.push(
    cylinder({
      c: [0, DIAL + 0.0045, 0],
      radius: 0.007,
      height: 0.009,
      segments: 10,
    }),
  );
  const p = mergeAll(parts);
  // hour ticks on the dial
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const [r0, r1] = k % 3 === 0 ? [0.054, 0.076] : [0.064, 0.076];
    p.lines.push(
      ...lineSeg(dialAt(a, r0, DIAL + LIFT), dialAt(a, r1, DIAL + LIFT)),
    );
  }
  const PIVOT_Y = 0.0505;
  const hand = (len: number, tail: number, w: number, y: number) =>
    box({ c: [0, y, -(len - tail) / 2], s: [w, 0.002, len + tail] });
  return {
    body: p,
    nodes: [
      {
        name: 'hand-hour',
        origin: [0, PIVOT_Y, 0],
        part: hand(0.042, 0.008, 0.009, 0),
        posterYaw: -(10.17 / 12) * Math.PI * 2,
      },
      {
        name: 'hand-minute',
        origin: [0, PIVOT_Y, 0],
        part: hand(0.07, 0.01, 0.006, 0.0025),
        posterYaw: -(10 / 60) * Math.PI * 2,
      },
    ],
  };
}

/**
 * Standing desk calendar: plinth, back board, tear-off pad, ring binding. Fills 0.18 x 0.14 x 0.06.
 * Named node `face`: a +Z quad with UVs on the pad front, for the BS date text (aspect 0.13 : 0.075).
 */
/** The face of the calendar: the textured quad, with a generic page drawn in front for the poster (hidden once the date is drawn). */
function calendarFace(): Part {
  const f = quad(0.13, 0.075);
  const z = LIFT * 2;
  f.lines.push(
    ...rectZ(-0.02, 0.02, -0.012, 0.034, z),
    ...lineSeg([-0.05, -0.027, z], [0.05, -0.027, z]),
    ...lineSeg([-0.03, -0.034, z], [0.03, -0.034, z]),
    ...lineSeg([-0.05, 0.03, z], [-0.03, 0.03, z]),
  );
  return f;
}

function calendar(): ModelParts {
  const parts: Part[] = [
    box({ c: [0, 0.006, 0], s: [0.18, 0.012, 0.056] }), // plinth
    box({ c: [0, 0.075, -0.012], s: [0.17, 0.126, 0.008] }), // back board
    box({ c: [0, 0.068, -0.0053], s: [0.15, 0.1, 0.0054] }), // pad
    box({ c: [0, 0.042, -0.0225], s: [0.05, 0.06, 0.011] }), // rear prop
  ];
  // ring binding along the top edge of the pad
  for (let k = -3; k <= 3; k++) {
    parts.push(
      torus({
        c: [k * 0.02, 0.1185, -0.0075],
        radius: 0.0085,
        tube: 0.0016,
        plane: 'x',
        tubeSegments: 3,
        ringSegments: 6,
      }),
    );
  }
  const p = mergeAll(parts);
  const FRONT = 0.0001; // pad front face z
  // header band and day grid edge on the pad
  p.lines.push(
    ...lineSeg([-0.075, 0.108, FRONT + LIFT], [0.075, 0.108, FRONT + LIFT]),
    ...lineSeg([-0.075, 0.034, FRONT + LIFT], [0.075, 0.034, FRONT + LIFT]),
    // page stack edge below the pad
    ...lineSeg([-0.075, 0.021, FRONT + LIFT], [0.075, 0.021, FRONT + LIFT]),
  );
  return {
    body: p,
    nodes: [
      {
        name: 'face',
        origin: [0, 0.071, FRONT + LIFT * 3],
        part: calendarFace(),
      },
    ],
  };
}

/**
 * Pac-Man ghost: scalloped skirt, domed head, two eyes. Fits the 0.09 radius collider ball.
 * Named nodes `eye-l` and `eye-r`: pivot at the eye centre, facing outward-forward (+Z); the
 * runtime tilts them to look at the pointer.
 */
function ghost(): ModelParts {
  const R = 0.088;
  const YC = 0.09; // head sphere centre
  const N = 18; // around
  const TEETH = 6;
  const hemY = (k: number) => 0.018 * Math.abs(2 * (((k * TEETH) / N) % 1) - 1);
  const p = emptyPart();
  const push = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
  ) => {
    p.positions.push(x, y, z);
    p.normals.push(nx, ny, nz);
  };
  const ang = (k: number) => (k / N) * Math.PI * 2;
  // vertical wall: for each k, (hem, seam) pair
  for (let k = 0; k <= N; k++) {
    const a = ang(k);
    const [s, c] = [Math.sin(a), Math.cos(a)];
    push(s * R, hemY(k % N), c * R, s, 0, c);
    push(s * R, YC, c * R, s, 0, c);
  }
  // dome rings at 30, 60 degrees
  const elev = [Math.PI / 6, Math.PI / 3];
  for (const e of elev) {
    for (let k = 0; k <= N; k++) {
      const a = ang(k);
      const [s, c] = [Math.sin(a), Math.cos(a)];
      const [ce, se] = [Math.cos(e), Math.sin(e)];
      push(s * R * ce, YC + R * se, c * R * ce, s * ce, se, c * ce);
    }
  }
  const apex = p.positions.length / 3;
  push(0, YC + R, 0, 0, 1, 0);
  // bottom cap
  const capCentre = apex + 1;
  push(0, 0.02, 0, 0, -1, 0);
  const capBase = capCentre + 1;
  for (let k = 0; k <= N; k++) {
    const a = ang(k);
    push(Math.sin(a) * R, 0.02, Math.cos(a) * R, 0, -1, 0);
  }
  const wall = (k: number) => k * 2; // hem index; seam is +1
  const domeRing = (i: number, k: number) => (N + 1) * 2 + i * (N + 1) + k;
  for (let k = 0; k < N; k++) {
    const [h0, s0, h1, s1] = [
      wall(k),
      wall(k) + 1,
      wall(k + 1),
      wall(k + 1) + 1,
    ];
    p.indices.push(h0, h1, s0, h1, s1, s0);
    let prevA = s0;
    let prevB = s1;
    for (let i = 0; i < elev.length; i++) {
      const a = domeRing(i, k);
      const b = domeRing(i, k + 1);
      p.indices.push(prevA, prevB, a, prevB, b, a);
      prevA = a;
      prevB = b;
    }
    p.indices.push(prevA, prevB, apex);
    // cap faces down
    p.indices.push(capCentre, capBase + k + 1, capBase + k);
  }
  // creases: scalloped hem, head/skirt seam, valley lines up the skirt
  const hem: Vec3[] = [];
  for (let k = 0; k < N; k++)
    hem.push([Math.sin(ang(k)) * R, hemY(k), Math.cos(ang(k)) * R]);
  p.lines.push(...loop(hem));
  p.lines.push(...ringLines([0, YC, 0], R, N, 'y'));
  for (let t = 0; t < TEETH; t++) {
    const k = (t * N) / TEETH; // valley (hem highest) at the start of each tooth
    p.lines.push(
      ...lineSeg(
        [Math.sin(ang(k)) * R, hemY(k) + 0.0, Math.cos(ang(k)) * R],
        [Math.sin(ang(k)) * R, 0.05, Math.cos(ang(k)) * R],
      ),
    );
  }
  const EYE_Z = 0.0775;
  const eye = (side: -1 | 1): NodeDef => {
    const part = mergeAll([
      cylinder({
        c: [0, 0, 0],
        radius: 0.017,
        height: 0.008,
        segments: 10,
        axis: 'z',
      }),
      cylinder({
        c: [0, 0, 0.0035],
        radius: 0.008,
        height: 0.006,
        segments: 8,
        axis: 'z',
      }),
    ]);
    return {
      name: side < 0 ? 'eye-l' : 'eye-r',
      origin: [side * 0.03, 0.105, EYE_Z],
      part: rotateY(part, side * 0.35),
    };
  };
  return { body: p, nodes: [eye(-1), eye(1)] };
}

/** Toy Land Cruiser (HJ60). Optional object, not on the default poster. Fills 0.24 x 0.1 x 0.12. */
function cruiser(): ModelParts {
  const parts: Part[] = [
    box({ c: [0, 0.038, 0], s: [0.22, 0.032, 0.092] }), // lower body
    box({ c: [0.064, 0.06, 0], s: [0.092, 0.012, 0.088] }), // hood
    box({ c: [-0.015, 0.078, 0], s: [0.12, 0.04, 0.086] }), // cabin
    box({ c: [-0.015, 0.099, 0], s: [0.124, 0.002, 0.09], edges: false }), // roof lip
    box({ c: [0.113, 0.034, 0], s: [0.008, 0.01, 0.094] }), // front bumper
    box({ c: [-0.113, 0.034, 0], s: [0.008, 0.01, 0.094] }), // rear bumper
  ];
  for (const x of [-0.076, 0.076])
    for (const z of [-0.052, 0.052])
      parts.push(
        cylinder({
          c: [x, 0.026, z],
          radius: 0.026,
          height: 0.016,
          segments: 8,
          axis: 'z',
        }),
      );
  for (const z of [-0.03, 0.03])
    parts.push(
      cylinder({
        c: [0.1115, 0.047, z],
        radius: 0.008,
        height: 0.003,
        segments: 8,
        axis: 'x',
      }),
    );
  parts.push(
    cylinder({
      c: [-0.114, 0.074, 0],
      radius: 0.016,
      height: 0.008,
      segments: 8,
      axis: 'x',
    }),
  );
  const p = mergeAll(parts);
  // windows and hub rings
  for (const z of [-0.0433, 0.0433]) {
    p.lines.push(...rectZ(-0.068, -0.016, 0.068, 0.092, z));
    p.lines.push(...rectZ(-0.012, 0.038, 0.068, 0.092, z));
  }
  p.lines.push(...rectX(-0.036, 0.036, 0.068, 0.092, 0.0453));
  p.lines.push(...rectX(-0.036, 0.036, 0.068, 0.092, -0.0753));
  return { body: p, nodes: [] };
}

/** Open MacBook-style laptop, generic: no logo. Base 0.28 x 0.19 m, lid leaning back 18 degrees. */
function laptop(): ModelParts {
  const W = 0.28;
  const D = 0.19;
  const H = 0.012;
  const RISE = 0.04; // the stand it sits on
  const base = box({ c: [0, H / 2, 0], s: [W, H, D] });
  const top = H + LIFT;
  // keyboard well: a rectangle, five key rows, eleven key columns
  const kx = 0.122;
  const kz0 = -0.08;
  const kz1 = 0.012;
  base.lines.push(...rectY(-kx, kx, top, kz0, kz1));
  for (let r = 1; r < 5; r++) {
    const z = kz0 + ((kz1 - kz0) * r) / 5;
    base.lines.push(...lineSeg([-kx, top, z], [kx, top, z]));
  }
  for (let c = 1; c < 11; c++) {
    const x = -kx + (2 * kx * c) / 11;
    base.lines.push(...lineSeg([x, top, kz0], [x, top, kz1]));
  }
  // trackpad
  base.lines.push(...rectY(-0.045, 0.045, top, 0.035, 0.083));
  // lid, built upright from the hinge line, then leant back
  const lid = box({ c: [0, 0.09, 0], s: [W, 0.18, 0.006] });
  lid.lines.push(...rectZ(-0.126, 0.126, 0.012, 0.172, 0.003 + LIFT));
  const lean = translate(rotateX(lid, -0.314), [0, H, -D / 2]);
  const lifted = translate(mergeAll([base, lean]), [0, RISE, 0]);
  // a stand under the laptop (the cable to the monitor is drawn by the Scene, so the laptop can move)
  const parts: Part[] = [
    lifted,
    box({ c: [0, RISE / 2, -0.02], s: [0.2, RISE, 0.1] }),
  ];
  return { body: mergeAll(parts), nodes: [] };
}

/** A beach-ball style sphere with an equator and two meridians. Rests on y = 0. */
function ballModel(r: number): () => ModelParts {
  return () => {
    const p = ball(r, 14, 9);
    p.lines.push(...ringLines([0, r, 0], r + LIFT, 16, 'y'));
    p.lines.push(...ringLines([0, r, 0], r + LIFT, 16, 'x'));
    p.lines.push(...ringLines([0, r, 0], r + LIFT, 16, 'z'));
    return { body: p, nodes: [] };
  };
}

type P2 = [number, number];
const LETTER_DEPTH = 0.04;
const letter = (outline: P2[], holes?: P2[][]): (() => ModelParts) => {
  return () => ({
    body: extrude(outline, LETTER_DEPTH, holes ? { holes } : {}),
    nodes: [],
  });
};

const LETTERS: Record<string, () => ModelParts> = {
  n: letter([
    [-0.055, 0],
    [-0.027, 0],
    [-0.027, 0.085],
    [0.02, 0],
    [0.055, 0],
    [0.055, 0.15],
    [0.027, 0.15],
    [0.027, 0.065],
    [-0.02, 0.15],
    [-0.055, 0.15],
  ]),
  i: letter([
    [-0.02, 0],
    [0.02, 0],
    [0.02, 0.15],
    [-0.02, 0.15],
  ]),
  h: letter([
    [-0.055, 0],
    [-0.027, 0],
    [-0.027, 0.062],
    [0.027, 0.062],
    [0.027, 0],
    [0.055, 0],
    [0.055, 0.15],
    [0.027, 0.15],
    [0.027, 0.088],
    [-0.027, 0.088],
    [-0.027, 0.15],
    [-0.055, 0.15],
  ]),
  a: letter(
    [
      [-0.065, 0],
      [-0.02, 0.15],
      [0.02, 0.15],
      [0.065, 0],
      [0.028, 0],
      [0.02, 0.035],
      [-0.02, 0.035],
      [-0.028, 0],
    ],
    [
      [
        [-0.012, 0.072],
        [0.012, 0.072],
        [0, 0.115],
      ],
    ],
  ),
  l: letter([
    [-0.045, 0],
    [0.045, 0],
    [0.045, 0.03],
    [-0.015, 0.03],
    [-0.015, 0.15],
    [-0.045, 0.15],
  ]),
};

// ---- the workstation -------------------------------------------------------------------------
//
// Furniture and the things on it. Local origin: the item's footprint centre on the desk top
// (y = 0) for desk things; the chair axis for the chair and the developer (y = 0 is the desk top,
// the floor is at FLOOR_Y). Everything faces +z (the front of the desk) unless it says otherwise.

const v3 = (x: number, y: number, z: number): Vec3 => [x, y, z];

/** A cylinder from `a` to `b` (end rings authored as creases, so every joint reads). */
function limb(
  a: Vec3,
  b: Vec3,
  radius: number,
  segments = 8,
  rings = true,
): Part {
  const dir = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const length = dir.length();
  const part = cylinder({
    c: [0, 0, 0],
    radius,
    height: length,
    segments,
    rings,
  });
  const q = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    dir.normalize(),
  );
  return transform(
    part,
    new Matrix4().compose(
      new Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2),
      q,
      new Vector3(1, 1, 1),
    ),
  );
}

/** A sphere centred at `c`. */
const sphereAt = (c: Vec3, r: number, segments: number, rings: number): Part =>
  translate(ball(r, segments, rings), [c[0], c[1] - r, c[2]]);

/** `part` rotated about the x axis through `pivot` (radians; positive tips +y towards +z). */
const rotXAbout = (part: Part, pivot: Vec3, a: number): Part =>
  transform(
    part,
    new Matrix4()
      .makeTranslation(pivot[0], pivot[1], pivot[2])
      .multiply(new Matrix4().makeRotationX(a))
      .multiply(new Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2])),
  );

/** A node whose geometry is given in model coordinates: stored relative to its pivot. */
const nodeAt = (
  name: string,
  origin: Vec3,
  world: Part,
  extra: Partial<NodeDef> = {},
): NodeDef => ({
  name,
  origin,
  part: translate(world, [-origin[0], -origin[1], -origin[2]]),
  ...extra,
});

/** The torso's lean about the hip, applied to a part drawn upright. */
const leanPart = (part: Part): Part =>
  transform(
    part,
    new Matrix4()
      .makeTranslation(HIP[0], HIP[1], HIP[2])
      .multiply(new Matrix4().makeRotationX(-LEAN))
      .multiply(new Matrix4().makeTranslation(-HIP[0], -HIP[1], -HIP[2])),
  );

/**
 * The drawer under the left front of the desk, and the handset at the right front edge that sets
 * the desk's height. The `tray` node (front panel, pull, box) slides out towards +z; the items
 * (`card`, `duck`) ride in it and are shown one at a time by the Scene. The handset is a
 * housing on the right front edge (a tap there, x > 0.5, is the handset). Origin: the desk centre.
 */
function deskKit(): ModelParts {
  const hz = SHEET_SIZE.d / 2;
  const dTop = BOARD_TOP - BOARD_THICK - 0.004;
  const dBot = dTop - 0.07;
  const dx = -0.5;
  const mid = (dTop + dBot) / 2;
  const tray = mergeAll([
    box({ c: [dx, mid, hz + 0.009], s: [0.46, dTop - dBot, 0.018] }),
    cylinder({
      c: [dx, mid, hz + 0.04],
      radius: 0.007,
      height: 0.12,
      segments: 6,
      axis: 'x',
    }),
    box({
      c: [dx - 0.05, mid, hz + 0.0265],
      s: [0.01, 0.012, 0.017],
      edges: false,
    }),
    box({
      c: [dx + 0.05, mid, hz + 0.0265],
      s: [0.01, 0.012, 0.017],
      edges: false,
    }),
    box({ c: [dx, dBot + 0.004, hz - 0.225], s: [0.42, 0.008, 0.45] }),
    box({ c: [dx - 0.206, dBot + 0.034, hz - 0.225], s: [0.008, 0.06, 0.45] }),
    box({ c: [dx + 0.206, dBot + 0.034, hz - 0.225], s: [0.008, 0.06, 0.45] }),
    box({ c: [dx, dBot + 0.034, hz - 0.45], s: [0.42, 0.06, 0.008] }),
  ]);
  const floorY = dBot + 0.008 + LIFT;
  const at: Vec3 = [dx, floorY, hz - 0.17];
  const card = rotateX(quad(0.13, 0.08), -Math.PI / 2);
  const duck = mergeAll([
    sphereAt([0, 0.03, 0], 0.03, 8, 6),
    sphereAt([0, 0.07, 0.02], 0.02, 6, 4),
    box({ c: [0, 0.068, 0.042], s: [0.02, 0.008, 0.02], edges: false }),
  ]);
  // the handset's pad, on its housing: two arrows for up and down
  const housing = box({ c: [0.92, 0.012, 0.5], s: [0.1, 0.024, 0.05] });
  housing.lines.push(
    ...lineSeg([0.895, 0.024 + LIFT, 0.51], [0.905, 0.024 + LIFT, 0.49]),
    ...lineSeg([0.905, 0.024 + LIFT, 0.49], [0.915, 0.024 + LIFT, 0.51]),
    ...lineSeg([0.925, 0.024 + LIFT, 0.49], [0.935, 0.024 + LIFT, 0.51]),
    ...lineSeg([0.935, 0.024 + LIFT, 0.51], [0.945, 0.024 + LIFT, 0.49]),
  );
  return {
    body: housing,
    nodes: [
      nodeAt('tray', [dx, 0, hz], tray),
      { name: 'card', origin: at, part: card },
      { name: 'duck', origin: at, part: duck },
    ],
  };
}

/** The chair: a five-star base on casters and a gas column (the body), and a `swivel` node (seat, back, arms). */
function chair(): ModelParts {
  const parts: Part[] = [];
  parts.push(
    cylinder({ c: [0, -0.33, 0], radius: 0.022, height: 0.25, segments: 6 }),
    cylinder({ c: [0, -0.455, 0], radius: 0.04, height: 0.04, segments: 8 }),
  );
  const R = 0.24;
  for (let k = 0; k < 5; k++) {
    const a = ((k * 72 + 36) * Math.PI) / 180;
    const x = Math.sin(a) * R;
    const z = Math.cos(a) * R;
    parts.push(
      bar([0, -0.46, 0], [x, -0.482, z], 0.026, false),
      box({ c: [x, -0.49, z], s: [0.035, 0.02, 0.035], edges: false }),
    );
  }
  const SW: Vec3 = [0, -0.21, 0];
  const sw: Part[] = [];
  sw.push(
    translate(
      rotateX(
        extrude(roundedRect(0.36, 0.34, 0.06, 1), 0.055, { corners: [] }),
        -Math.PI / 2,
      ),
      [0, SEAT_TOP - 0.0275, 0.02],
    ),
    box({ c: [0, -0.245, 0], s: [0.14, 0.018, 0.14] }),
    bar([0, -0.215, 0.15], [0, -0.1, 0.205], 0.028, false),
  );
  const back = translate(
    extrude(roundedRect(0.34, 0.34, 0.07, 1), 0.04, { corners: [] }),
    [0, SEAT_TOP + 0.04 + 0.17, 0.215],
  );
  sw.push(rotXAbout(back, [0, SEAT_TOP + 0.04, 0.215], 0.14));
  for (const sx of [-0.2, 0.2])
    sw.push(
      bar([sx, -0.2, 0.02], [sx, -0.065, 0.02], 0.02, false),
      box({ c: [sx, -0.052, 0.0], s: [0.05, 0.022, 0.22] }),
    );
  return {
    body: mergeAll(parts),
    nodes: [nodeAt('swivel', SW, mergeAll(sw))],
  };
}

/**
 * The developer, seated, in the typing pose (this is the pose the poster shows). Flat pivots, all
 * with their origin at the joint in the chair frame: `torso` (about the hip) and `head` (about the
 * neck), and per arm `upper-*` (shoulder) and
 * `fore-*` (elbow, with the hand). The Scene rebuilds the chain shoulder > elbow with `attach`,
 * which keeps the world pose. The body holds the legs.
 */
function developer(): ModelParts {
  const body: Part[] = [];

  // torso, drawn upright and then leaned about the hip: a flannel overshirt, boxy and dropped at the
  // shoulder, worn open over a tee
  const cy = HIP[1] + 0.17;
  const torsoParts: Part[] = [
    translate(
      extrude(
        [
          [-0.15, -0.19],
          [0.15, -0.19],
          [0.15, -0.04],
          [0.168, 0.1],
          [0.17, 0.15],
          [0.105, 0.195],
          [-0.105, 0.195],
          [-0.17, 0.15],
          [-0.168, 0.1],
          [-0.15, -0.04],
        ],
        0.175,
        { corners: [] },
      ),
      [0, cy, HIP[2]],
    ),
    limb(
      v3(0, HIP[1] + TORSO_H - 0.02, HIP[2]),
      v3(0, HIP[1] + NECK_H, HIP[2]),
      0.034,
      6,
    ),
  ];
  const torso = mergeAll(torsoParts);
  const zf = HIP[2] - 0.0875 - LIFT;
  const zb = HIP[2] + 0.0875 + LIFT;
  const top = HIP[1] + TORSO_H;
  // back: a yoke and a plaid (three bands, three stripes); front: the open placket over the tee,
  // a chest pocket and the tee's round neck
  for (const y of [0.02, 0.09, 0.16])
    torso.lines.push(
      ...lineSeg([-0.15, HIP[1] + y, zb], [0.15, HIP[1] + y, zb]),
    );
  for (const x of [-0.08, 0, 0.08])
    torso.lines.push(
      ...lineSeg([x, HIP[1] + 0.0, zb], [x, HIP[1] + 0.195 + 0.01, zb]),
    );
  torso.lines.push(
    ...lineSeg([-0.16, top - 0.07, zb], [0.16, top - 0.07, zb]),
    ...lineSeg([-0.05, HIP[1] - 0.02, zf], [-0.05, top - 0.02, zf]),
    ...lineSeg([0.05, HIP[1] - 0.02, zf], [0.05, top - 0.02, zf]),
    ...rectZ(0.07, 0.125, HIP[1] + 0.2, HIP[1] + 0.25, zf),
    ...ringLines([0, top - 0.005, HIP[2]], 0.05, 8, 'y'),
  );
  const torsoNode = nodeAt('torso', HIP, leanPart(torso));

  // head: a longer face with a jaw, ears, a nose; short textured hair with a side part;
  // thin rectangular glasses
  const neck = neckAt();
  const hc = v3(
    neck[0] + HEAD_OFFSET[0],
    neck[1] + HEAD_OFFSET[1],
    neck[2] + HEAD_OFFSET[2],
  );
  const skull: [number, number][] = [
    [0, -0.108],
    [0.024, -0.106],
    [0.047, -0.098],
    [0.067, -0.082],
    [0.079, -0.055],
    [0.086, -0.02],
    [0.088, 0.02],
    [0.084, 0.055],
    [0.07, 0.088],
    [0.045, 0.108],
    [0.02, 0.116],
    [0, 0.118],
  ];
  /** The skull's radius at height y (a hair of interpolation). */
  const rAt = (y: number): number => {
    for (let i = 1; i < skull.length; i++) {
      const p0 = skull[i - 1]!;
      const p1 = skull[i]!;
      if (y <= p1[1]) {
        const u = (y - p0[1]) / (p1[1] - p0[1] || 1);
        return p0[0] + (p1[0] - p0[0]) * Math.min(Math.max(u, 0), 1);
      }
    }
    return 0;
  };
  const hair = dome({
    c: [hc[0], hc[1] + 0.03, hc[2] + 0.014],
    radius: 0.096,
    widthSegments: 10,
    heightSegments: 3,
  });
  const head = mergeAll([
    lathe(hc, skull, 10),
    hair,
    // ears and a nose
    box({
      c: [-0.092, hc[1] - 0.004, hc[2] + 0.008],
      s: [0.014, 0.034, 0.022],
      edges: false,
    }),
    box({
      c: [0.092, hc[1] - 0.004, hc[2] + 0.008],
      s: [0.014, 0.034, 0.022],
      edges: false,
    }),
    box({
      c: [0, hc[1] - 0.02, hc[2] - 0.087],
      s: [0.012, 0.028, 0.016],
      edges: false,
    }),
  ]);
  /** A point on the face, a hair in front of the surface. */
  const onFace = (x: number, y: number, out = 0.0008): Vec3 => [
    hc[0] + x,
    hc[1] + y,
    hc[2] - Math.sqrt(Math.max(rAt(y) ** 2 - x * x, 0)) - out,
  ];
  // hair: a side part and a few strokes, so it reads as cut, not as a cap
  const hairAt = (th: number, phi: number, k = 1.0): Vec3 => [
    hc[0] + 0.0966 * k * Math.sin(th) * Math.sin(phi),
    hc[1] + 0.03 + 0.0966 * k * Math.cos(th),
    hc[2] + 0.014 + 0.0966 * k * Math.sin(th) * Math.cos(phi),
  ];
  head.lines.push(
    ...ringLines([hc[0], hc[1] + 0.03, hc[2] + 0.014], 0.096, 10, 'y'),
  );
  for (let i = 0; i < 4; i++) {
    const t0 = 0.25 + i * 0.22;
    head.lines.push(
      ...lineSeg(hairAt(t0, 2.6), hairAt(t0 + 0.2, 2.6)),
      ...lineSeg(hairAt(0.3 + i * 0.25, -0.5), hairAt(0.5 + i * 0.25, -0.62)),
      ...lineSeg(hairAt(0.35 + i * 0.25, 0.4), hairAt(0.55 + i * 0.25, 0.5)),
    );
  }
  // side part: a short line across the front of the crown, a little to the left
  head.lines.push(...lineSeg(hairAt(0.15, 3.1), hairAt(1.05, -0.3)));
  for (const sx of [-1, 1]) {
    // eyes with a dark centre, and a brow
    const e = onFace(sx * 0.036, 0.004);
    head.lines.push(
      ...ringLines(e, 0.007, 6, 'z'),
      ...ringLines(e, 0.0026, 4, 'z'),
    );
    const b0 = onFace(sx * 0.054, 0.034);
    const b1 = onFace(sx * 0.034, 0.039);
    const b2 = onFace(sx * 0.018, 0.035);
    head.lines.push(...lineSeg(b0, b1), ...lineSeg(b1, b2));
    // thin rectangular glasses, and the arm to the ear
    const cx = sx * 0.04;
    const c = [
      onFace(cx - 0.024, 0.02, 0.004),
      onFace(cx + 0.024, 0.02, 0.004),
      onFace(cx + 0.024, -0.012, 0.004),
      onFace(cx - 0.024, -0.012, 0.004),
    ];
    for (let i = 0; i < 4; i++)
      head.lines.push(...lineSeg(c[i]!, c[(i + 1) % 4]!));
    const outer = c[sx < 0 ? 0 : 1]!;
    head.lines.push(
      ...lineSeg(outer, [hc[0] + sx * 0.088, outer[1], hc[2] + 0.006]),
    );
    // the jaw, from the ear to the chin
    head.lines.push(
      ...lineSeg(onFace(sx * 0.078, -0.03), onFace(sx * 0.06, -0.075)),
      ...lineSeg(onFace(sx * 0.06, -0.075), onFace(sx * 0.026, -0.103)),
    );
  }
  head.lines.push(
    ...lineSeg(onFace(-0.016, 0.006, 0.004), onFace(0.016, 0.006, 0.004)),
  );
  // a nose line and a smile with a little more on one side
  head.lines.push(
    ...lineSeg(onFace(-0.007, -0.033, 0.009), onFace(0.007, -0.033, 0.009)),
  );
  for (let i = 0; i < 6; i++) {
    const x0 = -0.026 + (i * 0.054) / 6;
    const x1 = -0.026 + ((i + 1) * 0.054) / 6;
    const y = (x: number) =>
      -0.066 + 0.011 * (x / 0.026) ** 2 + 0.004 * (x / 0.026);
    head.lines.push(...lineSeg(onFace(x0, y(x0)), onFace(x1, y(x1))));
  }
  const headNode = nodeAt('head', neck, head);

  // arms, solved for the rest targets (the same solve the Scene uses): a loose sleeve to the
  // middle of the forearm, rolled, then the arm itself
  const nodes: NodeDef[] = [torsoNode, headNode];
  for (const s of [-1, 1] as const) {
    const side = s < 0 ? 'l' : 'r';
    const { shoulder, elbow, wrist } = restArm(s);
    const mid: Vec3 = [
      elbow[0] + (wrist[0] - elbow[0]) * 0.4,
      elbow[1] + (wrist[1] - elbow[1]) * 0.4,
      elbow[2] + (wrist[2] - elbow[2]) * 0.4,
    ];
    nodes.push(
      nodeAt(`upper-${side}`, shoulder, limb(shoulder, elbow, 0.042, 6, false)),
      nodeAt(
        `fore-${side}`,
        elbow,
        mergeAll([
          limb(elbow, mid, 0.04, 6),
          limb(mid, wrist, 0.028, 6),
          sphereAt(
            [
              wrist[0] + HAND_OFFSET[0],
              wrist[1] + HAND_OFFSET[1],
              wrist[2] + HAND_OFFSET[2],
            ],
            HAND_R,
            6,
            4,
          ),
        ]),
      ),
    );
  }
  // legs: straight jeans (a thigh about the hip, a shin about the knee) and high-top canvas
  // sneakers: ankle, toe cap and a sole
  for (const side of [-1, 1] as const) {
    const tag = side < 0 ? 'l' : 'r';
    const hip = hipAt(side);
    const knee = kneeAt(side);
    const ankle = ankleAt(side);
    nodes.push(
      nodeAt(`thigh-${tag}`, hip, limb(hip, knee, 0.052, 6, false)),
      nodeAt(
        `shin-${tag}`,
        knee,
        mergeAll([
          limb(knee, ankle, 0.046, 6),
          box({
            c: [ankle[0], ankle[1] - 0.012, ankle[2] - 0.01],
            s: [0.07, 0.07, 0.08],
            edges: false,
          }),
          box({
            c: [ankle[0], ankle[1] - 0.045, ankle[2] - 0.06],
            s: [0.075, 0.036, 0.07],
          }),
          box({
            c: [ankle[0], ankle[1] - 0.062, ankle[2] - 0.042],
            s: [0.082, 0.014, 0.135],
          }),
        ]),
      ),
    );
  }
  // a pelvis block keeps the body from being an empty mesh, and joins the thighs
  body.push(box({ c: [0, -0.16, 0.04], s: [0.17, 0.05, 0.1] }));
  return { body: mergeAll(body), nodes };
}

/**
 * A wide monitor on a stand, facing +z. `screen` is the textured glass (the Scene draws the
 * editor, the terminal and the page preview on it); a few code lines are authored on the glass too,
 * so the poster shows a screen that is working.
 */
const MON = { w: 0.64, h: 0.37, d: 0.028, y0: 0.125 } as const;
function monitor(): ModelParts {
  const cy = MON.y0 + MON.h / 2;
  const parts: Part[] = [
    box({ c: [0, 0.006, 0.0], s: [0.24, 0.012, 0.16] }),
    box({ c: [0, 0.075, -0.03], s: [0.045, 0.125, 0.026] }),
    box({ c: [0, cy, 0], s: [MON.w, MON.h, MON.d] }),
    box({ c: [0, cy, -MON.d / 2 - 0.012], s: [0.3, 0.2, 0.024] }),
  ];
  const p = mergeAll(parts);
  const front = MON.d / 2;
  // The glass: the textured quad, with its edge and a few code lines authored in front of it, so
  // the poster shows a screen that is working. The Scene hides these lines once the texture is on.
  const glass = quad(0.6, MON.h - 0.04);
  const gy = MON.h / 2 - 0.02;
  const zl = LIFT * 2;
  glass.lines.push(...rectZ(-0.3, 0.3, -gy, gy, zl));
  // indent, length (fraction of the glass width)
  const code: [number, number][] = [
    [0, 0.3],
    [0.05, 0.5],
    [0.05, 0.36],
    [0.1, 0.55],
    [0.1, 0.24],
    [0.05, 0.3],
    [0, 0.18],
    [0, 0.42],
  ];
  code.forEach(([indent, frac], i) => {
    const y = gy - 0.04 - i * 0.033;
    const x0 = -0.26 + indent;
    glass.lines.push(...lineSeg([x0, y, zl], [x0 + frac * 0.52, y, zl]));
  });
  // the cable to the laptop beside it, for the poster (the Scene draws a live one, since the laptop can move)
  const way: Vec3[] = [
    [-0.4, 0.006, 0.04],
    [-0.3, 0.003, 0.07],
    [-0.2, 0.003, 0.0],
    [-0.14, 0.003, -0.01],
    [-0.12, 0.003, 0.0],
  ];
  const cable = mergeAll(
    way.slice(0, -1).map((a, i) => bar(a, way[i + 1]!, 0.006, false)),
  );
  return {
    body: p,
    nodes: [
      { name: 'screen', origin: [0, cy, front + LIFT * 3], part: glass },
      { name: 'cable', origin: [0, 0, 0], part: cable, posterOnly: true },
    ],
  };
}

/** Keyboard: a tray and three rows of keys (`row-0` at the back to `row-2`) that the Scene presses one by one. */
function keyboard(): ModelParts {
  const base = box({ c: [0, 0.007, 0], s: [0.42, 0.014, 0.14] });
  const nodes: NodeDef[] = [];
  for (let i = 0; i < 3; i++) {
    const z = -0.04 + i * 0.04;
    const row = box({ c: [0, 0.005, 0], s: [0.395, 0.01, 0.034] });
    const keys = i === 2 ? [-0.06, 0.07, 0.11] : [];
    const n = i === 2 ? 0 : 13;
    for (let k = 1; k < n; k++) {
      const x = -0.1975 + (k * 0.395) / n;
      row.lines.push(
        ...lineSeg([x, 0.01 + LIFT, -0.017], [x, 0.01 + LIFT, 0.017]),
      );
    }
    for (const x of keys)
      row.lines.push(
        ...lineSeg([x, 0.01 + LIFT, -0.017], [x, 0.01 + LIFT, 0.017]),
      );
    nodes.push({ name: `row-${i}`, origin: [0, 0.014, z], part: row });
  }
  return { body: base, nodes };
}

/** Mouse: a rounded shell with a wheel and a split between the buttons, front towards -z. */
function mouse(): ModelParts {
  const shell = translate(
    rotateX(
      extrude(roundedRect(0.06, 0.105, 0.026, 2), 0.026, { corners: [] }),
      -Math.PI / 2,
    ),
    [0, 0.013, 0],
  );
  const wheel = cylinder({
    c: [0, 0.03, -0.03],
    radius: 0.008,
    height: 0.01,
    segments: 8,
    axis: 'x',
  });
  const p = mergeAll([shell, wheel]);
  p.lines.push(
    ...lineSeg([0, 0.026 + LIFT, -0.052], [0, 0.026 + LIFT, -0.012]),
  );
  return { body: p, nodes: [] };
}

/** Desk lamp on a two-bar arm: a base, the arm, and a `head` (shade and bulb) that tips. */
function lamp(): ModelParts {
  const P1 = v3(0.08, 0.25, -0.02);
  const P2 = v3(0.25, 0.24, 0.13);
  const parts: Part[] = [
    cylinder({ c: [0, 0.008, 0], radius: 0.06, height: 0.016, segments: 14 }),
    bar([0, 0.016, 0], P1, 0.014, false),
    bar(P1, P2, 0.014, false),
    sphereAt(P1, 0.016, 6, 4),
  ];
  const shade = lathe(
    [0, 0, 0],
    [
      [0.07, -0.01],
      [0.025, 0.055],
      [0, 0.06],
    ],
    14,
  );
  shade.lines.push(...ringLines([0, -0.01, 0], 0.07, 14, 'y'));
  const head = transform(shade, new Matrix4().makeRotationZ(0.4));
  return {
    body: mergeAll(parts),
    nodes: [{ name: 'head', origin: P2, part: head }],
  };
}

/**
 * Mug with a handle, handle towards +x. Open at the top: the coffee is a disc the Scene puts in it
 * (it sloshes, and pours out when the mug tips); the ring at the top of the cup is the poster's coffee.
 */
function mug(): ModelParts {
  const p = mergeAll([
    cylinder({
      c: [0, 0.0425, 0],
      radius: 0.038,
      height: 0.085,
      segments: 14,
      openEnded: true,
    }),
    box({ c: [0, 0.003, 0], s: [0.05, 0.006, 0.05], edges: false }),
    torus({
      c: [0.047, 0.045, 0],
      radius: 0.022,
      tube: 0.005,
      tubeSegments: 4,
      ringSegments: 10,
    }),
  ]);
  p.lines.push(...ringLines([0, 0.072, 0], 0.033, 14, 'y'));
  return { body: p, nodes: [] };
}

/** Headphones lying on the desk: a band arch and two cups. */
/**
 * Headphones, drawn at the size they are worn: a band that arcs over a head 0.18 m wide and 0.25 m
 * tall (an ellipse, 0.116 across the ear and 0.14 high), and a cup on each end, centred on the ear
 * and flat to the side of the head. Stood on the desk they are a hoop; the Scene seats them on
 * the ears by moving this same object.
 */
function headphones(): ModelParts {
  const parts: Part[] = [];
  const CY = 0.03805; // the cups' centre height (their lowest edge is on the desk)
  const arc = (t: number): Vec3 => [
    Math.cos(t) * 0.116,
    CY + Math.sin(t) * 0.14,
    0,
  ];
  const N = 8;
  for (let k = 0; k < N; k++)
    parts.push(
      bar(arc((k * Math.PI) / N), arc(((k + 1) * Math.PI) / N), 0.012, false),
    );
  for (const s of [-1, 1])
    parts.push(
      cylinder({
        c: [s * 0.116, CY, 0],
        radius: 0.04,
        height: 0.032,
        segments: 10,
        axis: 'x',
      }),
    );
  return { body: mergeAll(parts), nodes: [] };
}

/** Phone lying face up. */
function phone(): ModelParts {
  const shell = translate(
    rotateX(
      extrude(roundedRect(0.07, 0.145, 0.012, 2), 0.008, { corners: [] }),
      -Math.PI / 2,
    ),
    [0, 0.004, 0],
  );
  shell.lines.push(
    ...rectY(-0.031, 0.031, 0.008 + LIFT, -0.063, 0.063),
    ...ringLines([0, 0.008 + LIFT, -0.067], 0.002, 6, 'y'),
  );
  return { body: shell, nodes: [] };
}

/** Potted plant: a tapered pot and a `leaves` pivot at the soil that the Scene sways. */
function plant(): ModelParts {
  const SOIL = 0.086;
  const pot = lathe(
    [0, 0, 0],
    [
      [0, 0],
      [0.036, 0],
      [0.054, 0.088],
      [0.058, 0.096],
      [0.05, 0.096],
      [0.05, SOIL],
      [0, SOIL],
    ],
    10,
  );
  pot.lines.push(
    ...ringLines([0, 0.096, 0], 0.058, 10, 'y'),
    ...ringLines([0, 0.088, 0], 0.054, 10, 'y'),
  );
  const leaves: Part[] = [];
  const n = 4;
  for (let k = 0; k < n; k++) {
    const L = 0.15 - (k % 3) * 0.03;
    const w = 0.024;
    const leaf = extrude(
      [
        [0, 0],
        [w, 0.35 * L],
        [w * 0.75, 0.75 * L],
        [0, L],
        [-w * 0.75, 0.75 * L],
        [-w, 0.35 * L],
      ],
      0.004,
      { corners: [] },
    );
    leaf.lines.push(...lineSeg([0, 0, 0.0025], [0, 0.85 * L, 0.0025]));
    const m = new Matrix4()
      .makeRotationY((k * 2 * Math.PI) / n + 0.3)
      .multiply(new Matrix4().makeRotationZ(0.2 + (k % 3) * 0.22));
    leaves.push(transform(leaf, m));
  }
  return {
    body: pot,
    nodes: [{ name: 'leaves', origin: [0, SOIL, 0], part: mergeAll(leaves) }],
  };
}

export const models: ModelDef[] = [
  def('sheet', sheet),
  def('table', table),
  def('desk', deskKit),
  def('arduino', arduino),
  def('clock', clock),
  def('calendar', calendar),
  def('ghost', ghost),
  def('cruiser', cruiser),
  def('laptop', laptop),
  def('chair', chair),
  def('dev', developer),
  def('monitor', monitor),
  def('keyboard', keyboard),
  def('mouse', mouse),
  def('lamp', lamp),
  def('mug', mug),
  def('headphones', headphones),
  def('phone', phone),
  def('plant', plant),
  def('ball-l', ballModel(0.07)),
  ...Object.entries(LETTERS).map(([k, f]) => def(`letter-${k}`, f)),
];
