/**
 * Code-built models (D-06 grey boxes, D-03 detail). Units: metres, matching the colliders in
 * `src/content/objects.ts`. Local origin sits on the floor at the object's footprint centre
 * (y = 0 is the sheet); each model fits its collider, so `home` poses work unchanged.
 *
 * A model is a `body` plus optional named child nodes (clock hands, calendar face, ghost eyes,
 * OLED screen) that the runtime rotates or textures. Each named node has its origin at its pivot,
 * so rotating it needs no other bookkeeping. Creases are authored per part, never by angle.
 */
import {
  ball,
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
  torus,
  translate,
  emptyPart,
  floor,
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

export const SHEET_SIZE = { w: 1.6, d: 1.2 } as const;

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

function sheet(): ModelParts {
  const p = floor([0, 0, 0], SHEET_SIZE.w, SHEET_SIZE.d);
  const hw = SHEET_SIZE.w / 2 - 0.04;
  const hd = SHEET_SIZE.d / 2 - 0.04;
  const y = 0.0005;
  // drawing border, inset from the sheet edge
  p.lines.push(...rectY(-hw, hw, y, -hd, hd));
  return { body: p, nodes: [] };
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
  const parts: Part[] = [lathe([0, 0, 0], profile, 28)];
  parts[0]!.lines.push(
    ...ringLines([0, 0.052, 0], 0.1, 28),
    ...ringLines([0, 0.052, 0], 0.09, 28),
    ...ringLines([0, DIAL, 0], 0.084, 28),
    ...ringLines([0, 0.04, 0], 0.098, 28),
    ...ringLines([0, FOOT, 0], 0.09, 28),
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
        tubeSegments: 4,
        ringSegments: 8,
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
        part: quad(0.13, 0.075),
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
  const N = 24; // around
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
          segments: 12,
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
      segments: 12,
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
  for (const x of [-0.076, 0.076])
    for (const z of [-0.0602, 0.0602])
      p.lines.push(...ringLines([x, 0.026, z], 0.012, 10, 'z'));
  return { body: p, nodes: [] };
}

/** Open MacBook-style laptop, generic: no logo. Base 0.28 x 0.19 m, lid leaning back 18 degrees. */
function laptop(): ModelParts {
  const W = 0.28;
  const D = 0.19;
  const H = 0.012;
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
  return { body: mergeAll([base, lean]), nodes: [] };
}

/** A beach-ball style sphere with an equator and two meridians. Rests on y = 0. */
function ballModel(r: number): () => ModelParts {
  return () => {
    const p = ball(r, 20, 12);
    p.lines.push(...ringLines([0, r, 0], r + LIFT, 24, 'y'));
    p.lines.push(...ringLines([0, r, 0], r + LIFT, 24, 'x'));
    p.lines.push(...ringLines([0, r, 0], r + LIFT, 24, 'z'));
    return { body: p, nodes: [] };
  };
}

/** Pac-Man: a disc with a 70 degree wedge cut out of its right side, standing, 0.04 m thick. */
function pacman(): ModelParts {
  const R = 0.06;
  const half = (35 * Math.PI) / 180;
  const steps = 16;
  const pts: [number, number][] = [[0, R]];
  for (let i = 0; i <= steps; i++) {
    const a = half + (i / steps) * (2 * Math.PI - 2 * half);
    pts.push([Math.cos(a) * R, R + Math.sin(a) * R]);
  }
  const p = extrude(pts, 0.04, { corners: [0, 1, pts.length - 1] });
  for (const z of [-0.02 - LIFT, 0.02 + LIFT])
    p.lines.push(...ringLines([0.01, R + 0.032, z], 0.005, 8, 'z'));
  return { body: p, nodes: [] };
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

export const models: ModelDef[] = [
  def('sheet', sheet),
  def('arduino', arduino),
  def('clock', clock),
  def('calendar', calendar),
  def('ghost', ghost),
  def('cruiser', cruiser),
  def('laptop', laptop),
  def('ball-s', ballModel(0.035)),
  def('ball-m', ballModel(0.05)),
  def('ball-l', ballModel(0.07)),
  def('pacman', pacman),
  ...Object.entries(LETTERS).map(([k, f]) => def(`letter-${k}`, f)),
];
