import { describe, it, expect, beforeEach } from "vitest";
import "../../src/core/engine";
import { CharacterController } from "../../src/helpers/CharacterController";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { CbType } from "../../src/callbacks/CbType";
import { Material } from "../../src/phys/Material";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSpace(): Space {
  const space = new Space();
  space.gravity = new Vec2(0, 600);
  return space;
}

function addFloor(space: Space, y = 490, w = 900): Body {
  const floor = new Body(BodyType.STATIC, new Vec2(450, y));
  floor.shapes.add(new Polygon(Polygon.box(w, 20)));
  floor.space = space;
  return floor;
}

function createPlayer(space: Space, x = 100, y = 400): Body {
  const player = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  player.shapes.add(new Circle(12, undefined, new Material(0, 0.3, 0.3, 1)));
  player.allowRotation = false;
  player.isBullet = true;
  player.space = space;
  return player;
}

function step(space: Space, n = 1) {
  for (let i = 0; i < n; i++) {
    space.step(1 / 60, 8, 3);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CharacterController", () => {
  let space: Space;
  let player: Body;

  beforeEach(() => {
    space = createSpace();
    player = createPlayer(space);
  });

  // ---- Construction ----

  describe("constructor", () => {
    it("creates with default options", () => {
      const cc = new CharacterController(space, player);
      expect(cc.space).toBe(space);
      expect(cc.body).toBe(player);
      expect(cc.maxSlopeAngle).toBeCloseTo(Math.PI / 4);
      expect(cc.grounded).toBe(false);
      cc.destroy();
    });

    it("creates with custom options", () => {
      const cc = new CharacterController(space, player, {
        maxSlopeAngle: Math.PI / 3,
      });
      expect(cc.maxSlopeAngle).toBeCloseTo(Math.PI / 3);
      cc.destroy();
    });

    it("tags character shapes with CHAR_GROUP bit", () => {
      const cc = new CharacterController(space, player);
      const charGroup = player.shapes.at(0)!.filter.collisionGroup;
      expect(charGroup & (1 << 8)).toBe(1 << 8);
      cc.destroy();
    });
  });

  // ---- setVelocity + update ----

  describe("setVelocity + update", () => {
    it("applies velocity to the body", () => {
      const cc = new CharacterController(space, player);
      cc.setVelocity(100, 0);
      expect(player.velocity.x).toBeCloseTo(100);
      expect(player.velocity.y).toBeCloseTo(0);
      cc.destroy();
    });

    it("update returns grounded state after physics step", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      cc.setVelocity(0, 0);
      step(space, 5);
      const result = cc.update();
      expect(result.grounded).toBe(true);
      expect(result.groundBody).not.toBeNull();
      cc.destroy();
    });

    it("not grounded when in the air", () => {
      addFloor(space);
      player.position = new Vec2(100, 100);
      const cc = new CharacterController(space, player);

      cc.setVelocity(0, 0);
      step(space);
      const result = cc.update();
      expect(result.grounded).toBe(false);
      cc.destroy();
    });
  });

  // ---- Ground detection ----

  describe("ground detection", () => {
    it("detects ground when resting on floor", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      cc.setVelocity(0, 100);
      step(space, 3);
      const result = cc.update();
      expect(result.grounded).toBe(true);
      cc.destroy();
    });

    it("tracks timeSinceGrounded", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      cc.setVelocity(0, 0);
      step(space, 3);
      cc.update();
      expect(cc.timeSinceGrounded).toBe(0);

      // Launch upward
      player.position = new Vec2(100, 100);
      cc.setVelocity(0, 0);
      step(space);
      cc.update();
      expect(cc.timeSinceGrounded).toBeGreaterThan(0);
      cc.destroy();
    });
  });

  // ---- One-way platforms ----

  describe("one-way platforms", () => {
    it("sets up PreListener", () => {
      const platformTag = new CbType();
      const playerTag = new CbType();
      player.shapes.at(0)!.cbTypes.add(playerTag);

      const before = space.listeners.length;
      const cc = new CharacterController(space, player, {
        oneWayPlatformTag: platformTag,
        characterTag: playerTag,
      });
      expect(space.listeners.length).toBe(before + 1);

      cc.destroy();
      expect(space.listeners.length).toBe(before);
    });

    it("character passes through one-way platform from below", () => {
      const platformTag = new CbType();
      const playerTag = new CbType();

      // One-way platform
      const platform = new Body(BodyType.STATIC, new Vec2(100, 420));
      const pShape = new Polygon(Polygon.box(100, 8));
      pShape.cbTypes.add(platformTag);
      platform.shapes.add(pShape);
      platform.space = space;

      player.shapes.at(0)!.cbTypes.add(playerTag);
      player.position = new Vec2(100, 460);

      const cc = new CharacterController(space, player, {
        oneWayPlatformTag: platformTag,
        characterTag: playerTag,
      });

      // Launch upward through the platform
      cc.setVelocity(0, -400);
      step(space, 10);
      cc.update();

      // Character should have passed above the platform (y=420)
      expect(player.position.y).toBeLessThan(420);
      cc.destroy();
    });

    it("character lands on one-way platform from above", () => {
      const platformTag = new CbType();
      const playerTag = new CbType();

      const platform = new Body(BodyType.STATIC, new Vec2(100, 450));
      const pShape = new Polygon(Polygon.box(100, 8));
      pShape.cbTypes.add(platformTag);
      platform.shapes.add(pShape);
      platform.space = space;

      player.shapes.at(0)!.cbTypes.add(playerTag);
      player.position = new Vec2(100, 400);

      const cc = new CharacterController(space, player, {
        oneWayPlatformTag: platformTag,
        characterTag: playerTag,
      });

      // Fall down onto the platform
      cc.setVelocity(0, 200);
      step(space, 20);
      cc.update();

      // Character should be resting on or near the platform, not fallen through
      const RADIUS = 12;
      const platformTop = 450 - 4;
      expect(player.position.y + RADIUS).toBeLessThanOrEqual(platformTop + 5);
      cc.destroy();
    });
  });

  // ---- Wall detection ----

  describe("wall detection", () => {
    it("detects wall on the right", () => {
      addFloor(space);
      const wall = new Body(BodyType.STATIC, new Vec2(150, 450));
      wall.shapes.add(new Polygon(Polygon.box(20, 80)));
      wall.space = space;

      player.position = new Vec2(120, 465);
      const cc = new CharacterController(space, player);

      cc.setVelocity(200, 0);
      step(space, 5);
      const result = cc.update();
      expect(result.wallRight).toBe(true);
      cc.destroy();
    });
  });

  // ---- Destroy ----

  describe("destroy", () => {
    it("removes PreListener on destroy", () => {
      const platformTag = new CbType();
      const playerTag = new CbType();
      player.shapes.at(0)!.cbTypes.add(playerTag);

      const cc = new CharacterController(space, player, {
        oneWayPlatformTag: platformTag,
        characterTag: playerTag,
      });

      const count = space.listeners.length;
      cc.destroy();
      expect(space.listeners.length).toBe(count - 1);
    });

    it("destroy is safe to call multiple times", () => {
      const cc = new CharacterController(space, player);
      cc.destroy();
      cc.destroy();
    });
  });

  // ---- Edge cases ----

  describe("edge cases", () => {
    it("update works without prior setVelocity", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      step(space);
      const result = cc.update();
      expect(result).toBeDefined();
      expect(result.grounded).toBeDefined();
      cc.destroy();
    });

    it("works with polygon-shaped characters", () => {
      const boxPlayer = new Body(BodyType.DYNAMIC, new Vec2(100, 465));
      boxPlayer.shapes.add(new Polygon(Polygon.box(20, 24)));
      boxPlayer.allowRotation = false;
      boxPlayer.space = space;

      addFloor(space);
      const cc = new CharacterController(space, boxPlayer);
      cc.setVelocity(5, 0);
      step(space);
      const result = cc.update();
      expect(result).toBeDefined();
      cc.destroy();
    });
  });
});
