import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  boundsFor,
  project,
  reanchor,
  screenAccelDown,
  screenVelocity,
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
import { GRAVITY, feelFor } from './materials';
import type { Frame } from '../../components/desk/physics-bridge';
import { PerspectiveCamera } from 'three';

const frame = (left: number, top: number): Frame => ({
  left,
  top,
  w: 900,
  h: 525,
  cx: left + 450,
  cy: top + 262.5,
  f: focalPx(525),
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

describe('hero camera', () => {
  it('is the same view at every call', () => {
    const a = new PerspectiveCamera();
    applyHeroCamera(a);
    expect(a.position.y).toBeCloseTo(heroPose().position.y, 9);
    expect(a.aspect).toBeCloseTo(1200 / 700, 9);
  });
});

describe('materials', () => {
  it('balls bounce, heavy things thud', () => {
    expect(feelFor('ball-m').restitution).toBeGreaterThan(0.5);
    expect(feelFor('laptop').restitution).toBeLessThan(0.1);
    expect(feelFor('laptop').friction).toBeGreaterThan(
      feelFor('ball-m').friction,
    );
    expect(feelFor('unknown-model').restitution).toBeLessThan(0.1);
  });
});
