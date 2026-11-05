import type { BodyDef } from './schema';

const Q0: [number, number, number, number] = [0, 0, 0, 1];

/**
 * Desk body defs (impl spec 4). Poses and colliders are placeholders taken from the
 * grey-box prototype (docs/prototype/blueprint-sneak-peek.html); E-tickets tune them.
 * `target` ids are section ids; `#work-car-sensors` and `#work-pac-man` are the work panels.
 */
export const objects: BodyDef[] = [
  {
    id: 'arduino',
    model: 'arduino.glb',
    home: { p: [0, 0, 0.02], q: Q0 },
    collider: {
      kind: 'cuboid',
      args: [0.17, 0.03, 0.11],
      offset: [0, 0.03, 0],
    },
    mass: 1.2,
    callouts: [{ anchor: [0.16, 0.02, 0], text: 'uno r4' }],
    target: '#work-car-sensors',
    explode: [0, 0.42, 0],
    label: 'arduino water monitor',
    confirmed: true,
  },
  {
    id: 'clock-ktm',
    model: 'clock.glb',
    home: { p: [-0.55, 0, -0.3], q: Q0 },
    collider: { kind: 'cuboid', args: [0.1, 0.03, 0.1], offset: [0, 0.03, 0] },
    mass: 0.6,
    callouts: [{ anchor: [0, 0.03, -0.1], text: 'ktm' }],
    target: '#contact',
    explode: [-0.22, 0.26, -0.16],
    label: 'clocks',
    confirmed: true,
  },
  {
    id: 'clock-2',
    model: 'clock.glb',
    home: { p: [-0.55, 0, 0.02], q: Q0 },
    collider: { kind: 'cuboid', args: [0.1, 0.03, 0.1], offset: [0, 0.03, 0] },
    mass: 0.6,
    callouts: [{ anchor: [0, 0.03, -0.1], text: 'city two' }],
    target: '#contact',
    explode: [-0.26, 0.3, 0],
    label: 'clock two',
    confirmed: false,
  },
  {
    id: 'clock-3',
    model: 'clock.glb',
    home: { p: [-0.55, 0, 0.34], q: Q0 },
    collider: { kind: 'cuboid', args: [0.1, 0.03, 0.1], offset: [0, 0.03, 0] },
    mass: 0.6,
    callouts: [{ anchor: [0, 0.03, -0.1], text: 'city three' }],
    target: '#contact',
    explode: [-0.22, 0.34, 0.16],
    label: 'clock three',
    confirmed: false,
  },
  {
    id: 'calendar',
    model: 'calendar.glb',
    home: { p: [0.5, 0, -0.24], q: Q0 },
    collider: {
      kind: 'cuboid',
      args: [0.09, 0.07, 0.03],
      offset: [0, 0.07, 0],
    },
    mass: 0.8,
    callouts: [{ anchor: [0, 0.04, -0.14], text: 'bikram sambat' }],
    target: '#open-source',
    explode: [0.22, 0.36, -0.14],
    label: 'calendar',
    confirmed: true,
  },
  {
    id: 'ghost',
    model: 'ghost.glb',
    home: { p: [0.46, 0, 0.3], q: Q0 },
    collider: { kind: 'ball', args: [0.09], offset: [0, 0.09, 0] },
    mass: 0.5,
    kinematicWhenIdle: true,
    callouts: [{ anchor: [0.08, 0.1, 0], text: 'canvas, 2020' }],
    target: '#work-pac-man',
    explode: [0.2, 0.44, 0.16],
    label: 'pac-man ghost',
    confirmed: true,
  },
  {
    id: 'cruiser',
    model: 'cruiser.glb',
    home: { p: [0.1, 0, 0.5], q: Q0 },
    collider: {
      kind: 'cuboid',
      args: [0.12, 0.05, 0.06],
      offset: [0, 0.05, 0],
    },
    mass: 0.7,
    callouts: [{ anchor: [0.1, 0.06, 0], text: 'hj60' }],
    target: '#work-car-sensors',
    explode: [0.1, 0.38, 0.2],
    label: 'land cruiser',
    confirmed: false,
  },
];
