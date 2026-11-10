import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  boundsFor,
  depthRange,
  floorPad,
  leavingView,
  liftForFloor,
  handoffDue,
  strandedBelowTop,
  floorWentDown,
  foldDepthVelocity,
  planeOffset,
  project,
  reanchor,
  screenAccelDown,
  screenVelocity,
  sidePads,
  startGravityScale,
  unproject,
} from './fall';
import {
  applyHeroCamera,
  cameraToWorld,
  focalPx,
  heroPose,
  vecToCamera,
  vecToWorld,
  worldToCamera,
} from './camera';
import { GRAVITY, WORLD_SCALE, feelFor } from './materials';
import type { Frame } from '../../components/desk/physics-bridge';
import { PerspectiveCamera } from 'three';
import { posterAspect } from '../../assets/camera';

// a canvas the shape of the poster (the camera's own aspect)
const H = 900 / posterAspect;
const frame = (left: number, top: number): Frame => ({
  left,
  top,
  w: 900,
  h: H,
  cx: left + 450,
  cy: top + H / 2,
  f: focalPx(H),
});

describe('fall frame maths', () => {
  it('projects and unprojects a camera-frame point', () => {
    const f = frame(100, 80);
    const p = unproject(640, 410, 2.2, f);
    const s = project(p, f);
    expect(s.x).toBeCloseTo(640, 6);
    expect(s.y).toBeCloseTo(410, 6);
    expect(s.z).toBeCloseTo(2.2, 6);
  });

  it('the table camera and the camera frame agree on where a world point is', () => {
    const cam = heroPose();
    const f = frame(120, 60);
    const world = new Vector3(0.31, -0.2, 0.74);
    const ndc = world.clone().project(cam);
    const px = f.left + ((ndc.x + 1) / 2) * f.w;
    const py = f.top + ((1 - ndc.y) / 2) * f.h;
    const pose = worldToCamera(cam, world, new Quaternion());
    const s = project(pose.p, f);
    expect(s.x).toBeCloseTo(px, 4);
    expect(s.y).toBeCloseTo(py, 4);
  });

  it('round-trips a pose and a vector between world and camera frames', () => {
    const cam = heroPose();
    const p = new Vector3(0.2, 0.1, -0.3);
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(1, 2, 3).normalize(),
      0.7,
    );
    const c = worldToCamera(cam, p, q);
    const w = cameraToWorld(cam, c.p, c.q);
    expect(w.p.distanceTo(p)).toBeLessThan(1e-9);
    expect(w.q.angleTo(q)).toBeLessThan(1e-9);
    const v = new Vector3(1, -2, 0.5);
    expect(vecToWorld(cam, vecToCamera(cam, v)).distanceTo(v)).toBeLessThan(
      1e-9,
    );
  });

  it('re-anchoring keeps screen position and screen velocity', () => {
    const from = frame(100, 80);
    const to = frame(100, -240);
    const p = new Vector3(0.3, -0.4, -2.2);
    const v = new Vector3(0.5, -1.2, -0.9);
    const s0 = project(p, from);
    const v0 = screenVelocity(p, v, from.f);
    reanchor(p, v, from, to);
    const s1 = project(p, to);
    const v1 = screenVelocity(p, v, to.f);
    expect(s1.x).toBeCloseTo(s0.x, 6);
    expect(s1.y).toBeCloseTo(s0.y, 6);
    expect(s1.z).toBeCloseTo(2.2, 9);
    expect(v1[0]).toBeCloseTo(v0[0], 6);
    expect(v1[1]).toBeCloseTo(v0[1], 6);
  });

  it('starts gravity at the value that matches the table view, then real gravity is 1', () => {
    const cam = heroPose();
    const f = frame(120, 60);
    const gWorld = new Vector3(0, -GRAVITY, 0);
    const pose = worldToCamera(
      cam,
      new Vector3(0.1, -0.2, 0.7),
      new Quaternion(),
    );
    const v = vecToCamera(cam, new Vector3(0.1, -1.1, 0.4));
    const aTable = vecToCamera(cam, gWorld);
    const g = startGravityScale(pose.p, v, aTable, f.f);
    expect(g.scale).toBeGreaterThan(0.3);
    expect(g.scale).toBeLessThanOrEqual(1);
    const aFall = screenAccelDown(
      pose.p,
      v,
      new Vector3(0, -GRAVITY * g.scale, 0),
      f.f,
    );
    expect(aFall).toBeCloseTo(g.aBefore, 3);
    // The view looks down at the table, so the same fall looks slower than real gravity at this size.
    expect(g.scale).toBeLessThan(1);
  });

  it('puts the floor at the bottom of the viewport for the nearest depth', () => {
    const f = frame(120, 60);
    const b = boundsFor(f, 1440, 900, 2, 3.3, 16);
    const onScreen = project(unproject(720, 884, 2, f), f);
    const floor = project(new Vector3(0, b.floorY, -2), f);
    expect(floor.y).toBeCloseTo(onScreen.y, 6);
    expect(b.left).toBeLessThan(0);
    expect(b.right).toBeGreaterThan(0);
  });

  it('puts the floor on the same screen line at every depth', () => {
    const f = frame(120, 60);
    const b = boundsFor(f, 1440, 900, 2, 3.3, 16);
    const line = project(new Vector3(0, b.floorY, -2), f).y;
    for (const d of [2, 2.5, 3.3]) {
      const y = project(new Vector3(0, b.floorSlope * d, -d), f).y;
      expect(y).toBeCloseTo(line, 6);
    }
  });
});

describe('foldDepthVelocity', () => {
  it('keeps the screen velocity', () => {
    const p = new Vector3(0.4, -0.3, -2.5);
    const v = new Vector3(0.5, -1.2, 0.8);
    const before = screenVelocity(p, v, 900);
    foldDepthVelocity(p, v);
    const after = screenVelocity(p, v, 900);
    expect(v.z).toBe(0);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });
});

describe('hero camera', () => {
  it('is the same view at every call', () => {
    const a = new PerspectiveCamera();
    applyHeroCamera(a);
    expect(a.position.y).toBeCloseTo(heroPose().position.y, 9);
    expect(a.aspect).toBeCloseTo(posterAspect, 9);
  });
});

describe('materials', () => {
  it('balls bounce, heavy things thud', () => {
    expect(feelFor('ball-l').restitution).toBeGreaterThan(0.5);
    expect(feelFor('laptop').restitution).toBeLessThan(0.1);
    expect(feelFor('laptop').friction).toBeGreaterThan(
      feelFor('ball-l').friction,
    );
    expect(feelFor('unknown-model').restitution).toBeLessThan(0.1);
  });
});

describe('gravity and materials, one source', () => {
  it('gravity is real gravity scaled by how much bigger the table is than a real one', () => {
    expect(WORLD_SCALE).toBeCloseTo(1.6 / 1.2, 9);
    expect(GRAVITY).toBeCloseTo(9.81 * WORLD_SCALE, 9);
  });
  it('balls lose speed rolling in seconds, not tens of seconds', () => {
    for (const m of ['ball-l', 'pacman']) {
      const f = feelFor(m);
      const rate = f.linearDamping + (f.angularDamping * 2) / 7;
      expect(rate).toBeGreaterThan(0.8);
    }
  });
  it('things bounce a little and lose most of it, and a ball bounces more than any of them', () => {
    for (const m of [
      'laptop',
      'clock',
      'letter-n',
      'arduino',
      'calendar',
      'mug',
      'phone',
    ]) {
      expect(feelFor(m).restitution).toBeGreaterThan(0.05);
      expect(feelFor(m).restitution).toBeLessThan(
        feelFor('ball-l').restitution,
      );
    }
  });
});

describe('leavingView', () => {
  const box = { left: 0, right: 1280 };
  it('is false for a body well inside, and for one moving away from the edge', () => {
    expect(leavingView(640, 0, 3, 1260, box, 0.05)).toBe(false);
    expect(leavingView(100, 3000, 3, 1260, box, 0.05)).toBe(false);
  });
  it('is true when it will pass the edge (minus the fall world wall margin) within the lead', () => {
    expect(leavingView(1100, 3750, 3, 1260, box, 0.05)).toBe(true);
    expect(leavingView(1260, 0, 3, 1260, box, 0.05)).toBe(true);
    expect(leavingView(50, -3750, 3, 1260, box, 0.05)).toBe(true);
  });
  it('respects a canvas narrower than the viewport', () => {
    expect(
      leavingView(1020, 0, 3, 1260, { left: 100, right: 1050 }, 0.05),
    ).toBe(true);
  });
});

describe('floorPad', () => {
  it('is the border inset plus the index strip below 1024 px', () => {
    expect(floorPad(390, 12, 44)).toBe(56);
    expect(floorPad(768, 12, 44)).toBe(56);
    expect(floorPad(1023, 12, 44)).toBe(56);
    expect(floorPad(1024, 24, 44)).toBe(24);
  });
});

describe('the room inside the sheet border', () => {
  const f = frame(120, 60);

  it('puts the side walls at the border, not at the viewport edge', () => {
    const edge = boundsFor(f, 1440, 900, 2, 3.3, 24);
    const inside = boundsFor(f, 1440, 900, 2, 3.3, 24, 24, 24);
    // 24 px in from each side, at any depth (the walls pass through the camera)
    expect(project(new Vector3(inside.left * 2, 0, -2), f).x).toBeCloseTo(
      24,
      6,
    );
    expect(project(new Vector3(inside.right * 2, 0, -2), f).x).toBeCloseTo(
      1440 - 24,
      6,
    );
    expect(inside.left).toBeGreaterThan(edge.left);
    expect(inside.right).toBeLessThan(edge.right);
  });

  it('moves a plane through the camera by reach over the cosine of its tilt', () => {
    expect(planeOffset(0, 0.05)).toBeCloseTo(0.05, 9);
    expect(planeOffset(-0.5, 0.05)).toBeCloseTo(0.05 * Math.hypot(1, 0.5), 9);
    expect(boundsFor(f, 1440, 900, 2, 3.3, 24, 24, 24, 0.07).reach).toBe(0.07);
  });

  it('keeps the right wall clear of the reset button from 1024 px up, and at the border below it', () => {
    expect(sidePads(1440, 24, 1304)).toEqual({
      left: 24,
      right: 1440 - 1304 + 8,
    });
    expect(sidePads(1023, 12, 900)).toEqual({ left: 12, right: 12 });
    expect(sidePads(1440, 24, null)).toEqual({ left: 24, right: 24 });
  });
});

describe('liftForFloor', () => {
  const f = frame(120, 60);
  const tall = boundsFor(f, 390, 844, 2, 3.3, 56);
  const short = boundsFor(f, 390, 744, 2, 3.3, 56);

  it('lifts a resting body by the amount the floor rose, so it keeps its screen distance from the floor', () => {
    const depth = 2.5;
    const y = tall.floorSlope * depth + 0.1;
    const dy = liftForFloor(tall, short, y, depth);
    expect(dy).toBeGreaterThan(0);
    const before = project(new Vector3(0, y, -depth), f).y;
    const after = project(new Vector3(0, y + dy, -depth), f).y;
    // 100 px shorter viewport: the body rests 100 px higher on screen.
    expect(before - after).toBeCloseTo(100, 4);
  });

  it('leaves a body in the air alone, and does nothing when the floor went down', () => {
    expect(liftForFloor(tall, short, 5, 2.5)).toBe(0);
    expect(liftForFloor(short, tall, short.floorSlope * 2.5 + 0.1, 2.5)).toBe(
      0,
    );
  });
});

describe('depth range of the fall room', () => {
  it('spans the given depths with room either side, never nearer than the floor', () => {
    expect(depthRange([4, 5], 0.5)).toEqual({ near: 3.5, far: 5.5 });
    expect(depthRange([0.8, 1], 0.5, 0.6).near).toBe(0.6);
    expect(depthRange([])).toEqual({ near: 2, far: 3.3 });
  });

  it('contains the depth of every point of the desk and of the area a carried object can reach, so a handoff never changes a body depth (no pop)', () => {
    const cam = heroPose();
    const depths: number[] = [];
    const p = new Vector3();
    for (const x of [-1.35, -1, 0, 1, 1.35])
      for (const z of [-0.8, 0, 0.6, 0.95])
        for (const y of [-0.5, 0, 0.6])
          depths.push(-p.set(x, y, z).applyMatrix4(cam.matrixWorldInverse).z);
    const r = depthRange(depths);
    for (const d of depths) {
      expect(d).toBeGreaterThan(r.near);
      expect(d).toBeLessThan(r.far);
    }
    // The camera sits well back from the desk (the old fixed 2.0 to 3.3 m range excluded all of it).
    expect(Math.min(...depths)).toBeGreaterThan(3.3);
  });
});

describe('handoffDue', () => {
  const base = {
    held: false,
    off: 0.2,
    y: -0.12,
    gap: 3,
    clearSteps: 2,
    ready: true,
    asleep: false,
    reach: 0.1,
    leaving: () => false,
  };

  it('takes a sleeping body that came to rest under the table top past the rim (chair seat, open tray) once the layer is up', () => {
    expect(handoffDue({ ...base, asleep: true })).toBe(true);
    expect(strandedBelowTop(0.2, -0.12, false)).toBe(true);
  });

  it('waits for the layer, for the body to be clear of the slab, and never takes a held body or one over the slab', () => {
    expect(handoffDue({ ...base, asleep: true, ready: false })).toBe(false);
    expect(handoffDue({ ...base, asleep: true, gap: 1 })).toBe(false);
    expect(handoffDue({ ...base, held: true })).toBe(false);
    expect(handoffDue({ ...base, off: 0 })).toBe(false);
    expect(strandedBelowTop(0.2, 0.05, false)).toBe(false);
    expect(strandedBelowTop(0.2, -0.12, true)).toBe(false);
  });

  it('takes an awake body above the top only when it is beyond its reach and leaving the canvas; a sleeping one never', () => {
    const above = { ...base, y: 0.2 };
    expect(handoffDue(above)).toBe(false);
    expect(handoffDue({ ...above, leaving: () => true })).toBe(true);
    expect(handoffDue({ ...above, off: 0.05, leaving: () => true })).toBe(
      false,
    );
    expect(handoffDue({ ...above, asleep: true, leaving: () => true })).toBe(
      false,
    );
  });
});

describe('floorWentDown', () => {
  it('flags a floor that moved down (sleeping bodies on the old one must be woken to fall), not one that rose or stayed', () => {
    const tall = boundsFor(frame(120, 60), 1000, 900, 3, 4, 20);
    const short = boundsFor(frame(120, 60), 1000, 500, 3, 4, 20);
    expect(floorWentDown(short, tall)).toBe(true);
    expect(floorWentDown(tall, short)).toBe(false);
    expect(floorWentDown(tall, tall)).toBe(false);
  });
});
