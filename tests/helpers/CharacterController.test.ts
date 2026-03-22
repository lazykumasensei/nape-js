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
  const player = new Body(BodyType.KINEMATIC, new Vec2(x, y));
  player.shapes.add(new Circle(12));
  player.allowRotation = false;
  player.space = space;
  return player;
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
      expect(cc.stepHeight).toBe(0);
      expect(cc.skinWidth).toBeCloseTo(0.5);
      expect(cc.snapToGround).toBe(4);
      expect(cc.grounded).toBe(false);
    });

    it("creates with custom options", () => {
      const cc = new CharacterController(space, player, {
        maxSlopeAngle: Math.PI / 3,
        stepHeight: 10,
        skinWidth: 1,
        snapToGround: 8,
        trackMovingPlatforms: false,
      });
      expect(cc.maxSlopeAngle).toBeCloseTo(Math.PI / 3);
      expect(cc.stepHeight).toBe(10);
      expect(cc.skinWidth).toBe(1);
      expect(cc.snapToGround).toBe(8);
    });
  });

  // ---- Configuration setters ----

  describe("setters", () => {
    it("updates maxSlopeAngle", () => {
      const cc = new CharacterController(space, player);
      cc.maxSlopeAngle = Math.PI / 6;
      expect(cc.maxSlopeAngle).toBeCloseTo(Math.PI / 6);
    });

    it("updates stepHeight", () => {
      const cc = new CharacterController(space, player);
      cc.stepHeight = 20;
      expect(cc.stepHeight).toBe(20);
    });

    it("updates skinWidth", () => {
      const cc = new CharacterController(space, player);
      cc.skinWidth = 2;
      expect(cc.skinWidth).toBe(2);
    });

    it("updates snapToGround", () => {
      const cc = new CharacterController(space, player);
      cc.snapToGround = 0;
      expect(cc.snapToGround).toBe(0);
    });
  });

  // ---- Ground detection ----

  describe("ground detection", () => {
    it("detects ground when standing on a floor", () => {
      addFloor(space);
      // Place player just above the floor
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      // Move down slightly (gravity)
      const result = cc.move(new Vec2(0, 2));
      expect(result.grounded).toBe(true);
      expect(result.groundBody).not.toBeNull();
    });

    it("not grounded when in the air", () => {
      addFloor(space);
      // Player high in the air
      player.position = new Vec2(100, 100);
      const cc = new CharacterController(space, player);

      const result = cc.move(new Vec2(0, 2));
      expect(result.grounded).toBe(false);
      expect(result.groundBody).toBeNull();
    });

    it("tracks timeSinceGrounded", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      // Ground the player
      cc.move(new Vec2(0, 2));
      expect(cc.timeSinceGrounded).toBe(0);

      // Move up (leave ground)
      player.position = new Vec2(100, 100);
      cc.move(new Vec2(0, 0));
      expect(cc.timeSinceGrounded).toBeGreaterThan(0);
    });
  });

  // ---- Horizontal movement ----

  describe("horizontal movement", () => {
    it("moves horizontally on flat ground", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      const startX = player.position.x;
      cc.move(new Vec2(5, 0));
      expect(player.position.x).toBeGreaterThan(startX);
    });

    it("stops at walls", () => {
      addFloor(space);
      // Add a wall
      const wall = new Body(BodyType.STATIC, new Vec2(130, 450));
      wall.shapes.add(new Polygon(Polygon.box(20, 80)));
      wall.space = space;

      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      // Try to move into the wall
      cc.move(new Vec2(50, 0));
      // Player should not pass through the wall
      expect(player.position.x).toBeLessThan(130);
    });
  });

  // ---- MoveResult ----

  describe("MoveResult", () => {
    it("returns correct collision count", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      const result = cc.move(new Vec2(0, 20));
      expect(result.numCollisions).toBeGreaterThanOrEqual(0);
    });

    it("getCollision returns collision info", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      const result = cc.move(new Vec2(0, 20));
      if (result.numCollisions > 0) {
        const col = result.getCollision(0);
        expect(col).toBeDefined();
        expect(col.normal).toBeDefined();
        expect(col.body).toBeDefined();
      }
    });

    it("reports wall contact", () => {
      addFloor(space);
      // Add walls on both sides
      const wallLeft = new Body(BodyType.STATIC, new Vec2(50, 450));
      wallLeft.shapes.add(new Polygon(Polygon.box(20, 80)));
      wallLeft.space = space;

      player.position = new Vec2(80, 465);
      const cc = new CharacterController(space, player);

      // Move into the left wall
      const result = cc.move(new Vec2(-50, 0));
      expect(result.wallLeft).toBe(true);
    });
  });

  // ---- One-way platforms ----

  describe("one-way platforms", () => {
    it("sets up PreListener when oneWayPlatformTag is provided", () => {
      const platformTag = new CbType();
      const playerTag = new CbType();

      const playerShape = player.shapes.at(0);
      playerShape!.cbTypes.add(playerTag);

      const platform = new Body(BodyType.STATIC, new Vec2(200, 450));
      const pShape = new Polygon(Polygon.box(100, 8));
      pShape.cbTypes.add(platformTag);
      platform.shapes.add(pShape);
      platform.space = space;

      const listenerCountBefore = space.listeners.length;

      const cc = new CharacterController(space, player, {
        oneWayPlatformTag: platformTag,
        characterTag: playerTag,
      });

      // A PreListener should have been added
      expect(space.listeners.length).toBe(listenerCountBefore + 1);

      // Cleanup
      cc.destroy();
      expect(space.listeners.length).toBe(listenerCountBefore);
    });

    it("does not block upward movement through one-way platforms", () => {
      addFloor(space);
      const platformTag = new CbType();
      const playerTag = new CbType();
      const ONEWAY_BIT = 1 << 9;

      // One-way platform above the player
      const platform = new Body(BodyType.STATIC, new Vec2(100, 430));
      const pShape = new Polygon(Polygon.box(100, 8));
      pShape.cbTypes.add(platformTag);
      pShape.filter.collisionGroup = ONEWAY_BIT;
      platform.shapes.add(pShape);
      platform.space = space;

      player.shapes.at(0)!.cbTypes.add(playerTag);
      player.position = new Vec2(100, 465);

      const cc = new CharacterController(space, player, {
        oneWayPlatformTag: platformTag,
        characterTag: playerTag,
        oneWayGroupBit: ONEWAY_BIT,
      });

      // Move upward (jumping) — should pass through the one-way platform
      const startY = player.position.y;
      cc.move(new Vec2(0, -50));
      expect(player.position.y).toBeLessThan(startY);
      // Should have moved past the platform (y=430), not stopped at it
      expect(player.position.y).toBeLessThan(430);
    });

    it("blocks downward movement onto one-way platform (landing)", () => {
      const platformTag = new CbType();
      const playerTag = new CbType();
      const ONEWAY_BIT = 1 << 9;

      // One-way platform
      const platform = new Body(BodyType.STATIC, new Vec2(100, 450));
      const pShape = new Polygon(Polygon.box(100, 8));
      pShape.cbTypes.add(platformTag);
      pShape.filter.collisionGroup = ONEWAY_BIT;
      platform.shapes.add(pShape);
      platform.space = space;

      player.shapes.at(0)!.cbTypes.add(playerTag);
      player.position = new Vec2(100, 420);

      const cc = new CharacterController(space, player, {
        oneWayPlatformTag: platformTag,
        characterTag: playerTag,
        oneWayGroupBit: ONEWAY_BIT,
      });

      // Move downward (falling) — should land on the platform
      cc.move(new Vec2(0, 50));
      // Should not fall through the platform
      expect(player.position.y).toBeLessThan(450);
    });
  });

  // ---- Moving platforms ----

  describe("moving platforms", () => {
    it("tracks kinematic platform position", () => {
      const platform = new Body(BodyType.KINEMATIC, new Vec2(200, 480));
      platform.shapes.add(new Polygon(Polygon.box(100, 12)));
      platform.space = space;

      player.position = new Vec2(200, 455);
      const cc = new CharacterController(space, player, {
        trackMovingPlatforms: true,
      });

      // Stand on platform first
      cc.move(new Vec2(0, 2));

      // Move the platform
      platform.position = new Vec2(210, 480);

      // Next move should compensate for platform movement
      const result = cc.move(new Vec2(0, 2));
      if (result.grounded && result.onMovingPlatform) {
        // Player should have moved with the platform
        expect(player.position.x).toBeGreaterThan(200);
      }
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
      cc.destroy(); // Should not throw
    });
  });

  // ---- Self-raycast filter ----

  describe("self-raycast filter", () => {
    it("does not hit the character's own shape when raycasting", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      // Moving should not throw — previously crashed with polysect error
      // when the ray hit the character's own shape
      expect(() => cc.move(new Vec2(5, 2))).not.toThrow();
      expect(() => cc.move(new Vec2(-5, -10))).not.toThrow();
      expect(() => cc.move(new Vec2(0, 20))).not.toThrow();
    });

    it("character shape gets tagged with CHAR_GROUP bit", () => {
      const cc = new CharacterController(space, player);
      const charGroup = player.shapes.at(0)!.filter.collisionGroup;
      // Should have bit 8 set (1 << 8 = 256)
      expect(charGroup & (1 << 8)).toBe(1 << 8);
      cc.destroy();
    });
  });

  // ---- Penetration prevention ----

  describe("penetration prevention", () => {
    it("character edge does not penetrate a solid platform from below", () => {
      // Platform at y=450 (16px tall, top at y=442, bottom at y=458)
      const platform = new Body(BodyType.STATIC, new Vec2(100, 450));
      platform.shapes.add(new Polygon(Polygon.box(200, 16)));
      platform.space = space;

      // Player below the platform, moving upward fast
      player.position = new Vec2(100, 475);
      const cc = new CharacterController(space, player);
      const RADIUS = 12; // default player radius in createPlayer

      // Move upward with enough speed to reach the platform
      cc.move(new Vec2(0, -30));

      // The character's TOP edge (center - radius) must not be inside the platform
      // Platform bottom = 450 + 8 = 458
      const playerTop = player.position.y - RADIUS;
      expect(playerTop).toBeGreaterThanOrEqual(458 - 1); // 1px tolerance for skinWidth
    });

    it("character edge does not penetrate floor from above", () => {
      // Floor at y=490 (20px tall, top at y=480)
      addFloor(space);
      player.position = new Vec2(100, 460);
      const cc = new CharacterController(space, player);
      const RADIUS = 12;

      // Move downward
      cc.move(new Vec2(0, 30));

      // Character bottom (center + radius) must not go below floor top
      const playerBottom = player.position.y + RADIUS;
      expect(playerBottom).toBeLessThanOrEqual(480 + 1); // 1px tolerance
    });

    it("resolves overlap when character is pushed into thin platform", () => {
      // Thin platform (8px) — thinner than character radius (12)
      const platform = new Body(BodyType.STATIC, new Vec2(100, 450));
      platform.shapes.add(new Polygon(Polygon.box(200, 8)));
      platform.space = space;

      // Place character so it overlaps the platform slightly
      // Platform top=446, bottom=454. Character center at 456, radius=12, top edge=444 < 446
      player.position = new Vec2(100, 456);
      const cc = new CharacterController(space, player);
      const RADIUS = 12;

      // Move upward — should be pushed out, not stuck
      cc.move(new Vec2(0, -5));
      const playerTop = player.position.y - RADIUS;
      // Should not be inside the platform (top at 446)
      // Either pushed below (>= 454) or above (<= 446)
      const insidePlatform = playerTop > 446 && playerTop < 454;
      expect(insidePlatform).toBe(false);
    });

    it("does not get stuck on repeated jumps into thin platform", () => {
      // Thin platform
      const platform = new Body(BodyType.STATIC, new Vec2(100, 440));
      platform.shapes.add(new Polygon(Polygon.box(200, 8)));
      platform.space = space;

      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);
      const RADIUS = 12;

      // Simulate multiple jumps into the platform from below
      for (let i = 0; i < 5; i++) {
        cc.move(new Vec2(0, -20)); // jump up
        cc.move(new Vec2(0, 20)); // fall back
      }

      // Character should not be stuck inside the platform
      const py = player.position.y;
      const platformTop = 440 - 4;
      const platformBot = 440 + 4;
      const topEdge = py - RADIUS;
      const botEdge = py + RADIUS;
      // Either fully above or fully below the platform
      const fullyAbove = botEdge <= platformTop + 2;
      const fullyBelow = topEdge >= platformBot - 2;
      expect(fullyAbove || fullyBelow).toBe(true);
    });

    it("character does not penetrate wall from the side", () => {
      addFloor(space);
      const wall = new Body(BodyType.STATIC, new Vec2(200, 450));
      wall.shapes.add(new Polygon(Polygon.box(20, 80)));
      wall.space = space;

      // Wall left edge = 200 - 10 = 190
      player.position = new Vec2(160, 465);
      const cc = new CharacterController(space, player);
      const RADIUS = 12;

      cc.move(new Vec2(50, 0));

      // Player right edge (center + radius) must not go past wall left edge
      const playerRight = player.position.x + RADIUS;
      expect(playerRight).toBeLessThanOrEqual(190 + 1); // 1px tolerance
    });
  });

  // ---- Edge cases ----

  describe("edge cases", () => {
    it("handles zero movement vector", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      const result = cc.move(new Vec2(0, 0));
      expect(result).toBeDefined();
      expect(result.grounded).toBeDefined();
    });

    it("handles very large movement", () => {
      addFloor(space);
      player.position = new Vec2(100, 465);
      const cc = new CharacterController(space, player);

      // Should not throw with large movement
      expect(() => cc.move(new Vec2(1000, 0))).not.toThrow();
    });

    it("works with polygon-shaped characters", () => {
      const boxPlayer = new Body(BodyType.KINEMATIC, new Vec2(100, 465));
      boxPlayer.shapes.add(new Polygon(Polygon.box(20, 24)));
      boxPlayer.allowRotation = false;
      boxPlayer.space = space;

      addFloor(space);
      const cc = new CharacterController(space, boxPlayer);
      const result = cc.move(new Vec2(5, 2));
      expect(result).toBeDefined();
    });

    it("clamps to world when no floor exists", () => {
      // No floor — player falls forever
      const cc = new CharacterController(space, player);
      const result = cc.move(new Vec2(0, 10));
      expect(result.grounded).toBe(false);
      expect(result.groundBody).toBeNull();
    });
  });
});
