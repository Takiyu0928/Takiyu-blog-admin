import assert from "node:assert/strict";
import { test } from "node:test";
import { heroAt, pointerAt, reelAt, reelStops, titleAt, trailFrameAt } from "../public/ctrl-motion.js";

test("the same CTA shifts down, fades its label, and folds across the hero transition", () => {
  const camera = { height: 720, anchor: 504 };
  const start = heroAt({ ...camera, scroll: 0 });
  const middle = heroAt({ ...camera, scroll: 250 });
  const end = heroAt({ ...camera, scroll: 720 });
  assert.equal(start.buttonY, 504);
  assert.equal(start.alpha, 1);
  assert.equal(start.fold, 0);
  assert.equal(start.label, 1);
  assert.ok(middle.buttonY > 504 && middle.buttonY < end.buttonY);
  assert.ok(middle.fold > 0 && middle.fold < 1);
  assert.ok(middle.alpha > 0 && middle.alpha < 1);
  assert.equal(end.buttonY, 671);
  assert.equal(end.fold, 1);
  assert.equal(end.alpha, 0);
  assert.equal(end.label, 0);
});

test("the reel first holds its icon, then keeps one frame and centers each of three panels", () => {
  assert.equal(reelAt(0).logo, 1);
  assert.equal(reelAt(0).active, -1);
  for (const [index, stop] of reelStops.entries()) {
    const at = reelAt(stop);
    assert.equal(at.frame, 1);
    assert.equal(at.active, index);
    assert.equal(at.frames[index].panel, 1);
    assert.equal(at.logo, 0);
    assert.ok(at.frames.every((panel, other) => other === index || panel.panel === 0));
  }
  assert.equal(reelAt(1.05).frame, 0);
});

test("the outgoing and incoming content cross-fade while its two side cards drift at different rates", () => {
  const transition = reelAt((reelStops[0] + reelStops[1]) / 2);
  assert.ok(transition.frames[0].panel > 0 && transition.frames[1].panel > 0);
  assert.ok(transition.frames[0].panel + transition.frames[1].panel <= .72);
  assert.ok(transition.frames[0].drift < 0 && transition.frames[1].drift > 0);
  assert.ok(transition.frames[0].lead < transition.frames[0].echo);
  assert.ok(transition.frames[1].lead > transition.frames[1].echo);
  assert.equal(transition.frames[2].panel, 0);
});

test("the active chapter follows native scroll progress without losing its target between stops", () => {
  for (let index = 0; index < reelStops.length - 1; index++) {
    const start = reelStops[index], end = reelStops[index + 1];
    for (let step = 0; step <= 100; step++) {
      const at = reelAt(start + (end - start) * step / 100);
      assert.ok(at.active === index || at.active === index + 1);
      assert.ok(at.frames.filter(pose => pose.panel > 0).length <= 2);
      for (const side of ["lead", "echo"]) {
        const [out, incoming] = at.frames.filter(pose => pose[side] > 0);
        if (incoming) assert.ok(Math.abs(out[`${side}Y`] - incoming[`${side}Y`]) > 100);
      }
    }
  }
});

test("left and right tiles enter and leave in a stagger around the stable center", () => {
  const entry = reelAt(.12).frames[0];
  const center = reelAt(reelStops[0]).frames[0];
  const exit = reelAt(.26).frames[0];
  assert.ok(entry.lead > entry.echo);
  assert.ok(center.lead > .85 && center.echo > .85);
  assert.ok(exit.lead < exit.echo);
  assert.ok(entry.leadY > center.leadY && center.leadY > exit.leadY);
  assert.ok(entry.echoY > center.echoY && center.echoY > exit.echoY);
});

test("hover geometry is centered and capped outside the control", () => {
  const bounds = { left: 10, top: 20, width: 120, height: 100 };
  assert.deepEqual(pointerAt({ x: 70, y: 70 }, bounds), { x: 0, y: 0 });
  assert.deepEqual(pointerAt({ x: 180, y: 10 }, bounds), { x: 1, y: -1 });
});

test("the trail emits one sticker per frame, only past a straight-line distance of 100px", () => {
  const start = { smooth: { x: 0, y: 0 }, last: { x: 0, y: 0 } };
  const exact = trailFrameAt(start, { x: 60, y: 80 });
  assert.equal(exact.stamp, null);
  const far = trailFrameAt(exact, { x: 600, y: 150 });
  assert.deepEqual(far.stamp.to, { x: 600, y: 150 });
  assert.ok(Math.abs(far.stamp.from.x - 65.4) < 1e-9);
  assert.ok(Math.abs(far.stamp.from.y - 22.2) < 1e-9);
  assert.deepEqual(far.last, far.stamp.to);
});

test("a stopped mouse does not emit any more stickers while the smooth point catches up", () => {
  const point = { x: 300, y: 200 };
  const stamp = trailFrameAt({ smooth: { x: 0, y: 0 }, last: { x: 0, y: 0 } }, point);
  const next = trailFrameAt(stamp, point);
  assert.deepEqual(stamp.stamp.from, { x: 30, y: 20 });
  assert.deepEqual(next.smooth, { x: 57, y: 38 });
  assert.equal(next.stamp, null);
});

test("type reveal advances one word at a time and moves the active dot", () => {
  assert.deepEqual(titleAt(0, [2, 3]), { lines: [{ count: 0, active: true }, { count: 0, active: false }], done: false });
  assert.deepEqual(titleAt(172, [2, 3]).lines, [{ count: 1, active: true }, { count: 0, active: false }]);
  assert.deepEqual(titleAt(410, [2, 3]).lines, [{ count: 2, active: false }, { count: 1, active: true }]);
  assert.deepEqual(titleAt(700, [2, 3]), { lines: [{ count: 2, active: false }, { count: 3, active: false }], done: true });
});
