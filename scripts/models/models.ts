/**
 * Grey-box models (D-02). Units: metres, matching `src/content/objects.ts` colliders.
 * Local origin sits on the floor at the object's footprint centre (y = 0 is the sheet);
 * each model fills its collider cuboid / ball, so `home` poses in objects.ts work unchanged.
 * D-03 swaps in detailed geometry behind the same ids.
 */
import {
  box,
  cylinder,
  dome,
  floor,
  lineSeg,
  mergeAll,
  ringLines,
  type Part,
} from './geom';

export interface ModelDef {
  /** GLB basename, matches `BodyDef.model` (without `.glb`). */
  file: string;
  /** Node name inside the GLB. */
  name: string;
  build: () => Part;
}

export const SHEET_SIZE = { w: 1.6, d: 1.2 } as const;

function sheet(): Part {
  const p = floor([0, 0, 0], SHEET_SIZE.w, SHEET_SIZE.d);
  const hw = SHEET_SIZE.w / 2 - 0.04;
  const hd = SHEET_SIZE.d / 2 - 0.04;
  const y = 0.0005;
  // drawing border, inset from the sheet edge
  p.lines.push(
    ...lineSeg([-hw, y, -hd], [hw, y, -hd]),
    ...lineSeg([hw, y, -hd], [hw, y, hd]),
    ...lineSeg([hw, y, hd], [-hw, y, hd]),
    ...lineSeg([-hw, y, hd], [-hw, y, -hd]),
  );
  return p;
}

/** Uno R4 board with an OLED module on a pedestal. Fills 0.34 x 0.06 x 0.22. */
function arduino(): Part {
  const parts = [
    box({ c: [0, 0.008, 0], s: [0.34, 0.016, 0.22] }), // pcb
    box({ c: [-0.15, 0.031, -0.03], s: [0.04, 0.03, 0.05] }), // usb-c
    box({ c: [-0.15, 0.026, 0.07], s: [0.04, 0.02, 0.05] }), // power jack
    box({ c: [0, 0.026, -0.1], s: [0.24, 0.02, 0.012] }), // header
    box({ c: [0, 0.026, 0.1], s: [0.24, 0.02, 0.012] }), // header
    box({ c: [0.05, 0.0215, 0], s: [0.05, 0.011, 0.05] }), // mcu
    box({ c: [-0.02, 0.03, 0], s: [0.06, 0.028, 0.04], edges: false }), // pedestal
    box({ c: [-0.02, 0.0525, 0], s: [0.12, 0.015, 0.07] }), // oled frame
  ];
  const p = mergeAll(parts);
  // oled screen window on the frame's top face
  const y = 0.0602;
  const [x0, x1, z0, z1] = [-0.07, 0.03, -0.025, 0.025];
  p.lines.push(
    ...lineSeg([x0, y, z0], [x1, y, z0]),
    ...lineSeg([x1, y, z0], [x1, y, z1]),
    ...lineSeg([x1, y, z1], [x0, y, z1]),
    ...lineSeg([x0, y, z1], [x0, y, z0]),
  );
  return p;
}

/** Round desk clock, face up. One model, three instances. Fills 0.2 x 0.06 x 0.2. */
function clock(): Part {
  const p = mergeAll([
    cylinder({ c: [0, 0.02, 0], radius: 0.1, height: 0.04, segments: 24 }),
    cylinder({ c: [0, 0.05, 0], radius: 0.085, height: 0.02, segments: 24 }),
  ]);
  // hour ticks on the dial
  const y = 0.0602;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const [r0, r1] = k % 3 === 0 ? [0.052, 0.07] : [0.06, 0.07];
    p.lines.push(...lineSeg([c * r0, y, s * r0], [c * r1, y, s * r1]));
  }
  return p;
}

/** Standing desk calendar with a pad and ring binding. Fills 0.18 x 0.14 x 0.06. */
function calendar(): Part {
  const parts = [
    box({ c: [0, 0.01, 0], s: [0.18, 0.02, 0.06] }), // base
    box({ c: [0, 0.07, -0.005], s: [0.18, 0.1, 0.012] }), // backing
    box({ c: [0, 0.065, 0.007], s: [0.16, 0.08, 0.006] }), // pad
  ];
  for (let k = -2; k <= 2; k++) {
    parts.push(
      cylinder({
        c: [k * 0.034, 0.125, -0.005],
        radius: 0.006,
        height: 0.03,
        segments: 6,
      }),
    );
  }
  return mergeAll(parts);
}

/** Pac-Man ghost: dome, scalloped skirt, two eyes. Fills a 0.09 radius ball. */
function ghost(): Part {
  const p = mergeAll([
    cylinder({
      c: [0, 0.045, 0],
      radius: 0.09,
      height: 0.09,
      segments: 12,
      openEnded: true,
      rings: false,
    }),
    dome({
      c: [0, 0.09, 0],
      radius: 0.09,
      widthSegments: 12,
      heightSegments: 5,
    }),
    box({ c: [-0.032, 0.095, 0.08], s: [0.024, 0.036, 0.016] }),
    box({ c: [0.032, 0.095, 0.08], s: [0.024, 0.036, 0.016] }),
  ]);
  // dome/body seam
  p.lines.push(...ringLines([0, 0.09, 0], 0.09, 12, 'y'));
  // skirt: zig-zag hem, 6 teeth
  const teeth = 6;
  for (let k = 0; k < teeth * 2; k++) {
    const pt = (i: number): [number, number, number] => {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      return [Math.cos(a) * 0.09, i % 2 === 0 ? 0 : 0.02, Math.sin(a) * 0.09];
    };
    p.lines.push(...lineSeg(pt(k), pt(k + 1)));
  }
  return p;
}

/** Toy Land Cruiser (HJ60): chassis, cabin, four wheels. Fills 0.24 x 0.1 x 0.12. */
function cruiser(): Part {
  const parts = [
    box({ c: [0, 0.045, 0], s: [0.24, 0.034, 0.09] }),
    box({ c: [-0.01, 0.081, 0], s: [0.13, 0.038, 0.088] }),
  ];
  for (const x of [-0.078, 0.078]) {
    for (const z of [-0.05, 0.05]) {
      parts.push(
        cylinder({
          c: [x, 0.028, z],
          radius: 0.028,
          height: 0.02,
          segments: 10,
          axis: 'z',
        }),
      );
    }
  }
  return mergeAll(parts);
}

export const models: ModelDef[] = [
  { file: 'sheet', name: 'sheet', build: sheet },
  { file: 'arduino', name: 'arduino', build: arduino },
  { file: 'clock', name: 'clock', build: clock },
  { file: 'calendar', name: 'calendar', build: calendar },
  { file: 'ghost', name: 'ghost', build: ghost },
  { file: 'cruiser', name: 'cruiser', build: cruiser },
];
