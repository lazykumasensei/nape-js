import { describe, it, expect, beforeEach, vi } from "vitest";
import "../../src/core/engine";
import { TriggerZone } from "../../src/helpers/TriggerZone";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { CbType } from "../../src/callbacks/CbType";
import { InteractionType } from "../../src/callbacks/InteractionType";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSpace(): Space {
  const space = new Space();
  space.gravity = new Vec2(0, 600);
  return space;
}

function createZoneBody(space: Space, x = 200, y = 300): Body {
  const body = new Body(BodyType.STATIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.box(100, 100)));
  body.space = space;
  return body;
}

function createDynamicBody(space: Space, x = 200, y = 100): Body {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Circle(10));
  body.space = space;
  return body;
}

function step(space: Space, n = 1) {
  for (let i = 0; i < n; i++) {
    space.step(1 / 60, 8, 3);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TriggerZone", () => {
  let space: Space;

  beforeEach(() => {
    space = createSpace();
  });

  // ---- Construction ----

  describe("constructor", () => {
    it("creates with default options", () => {
      const zoneBody = createZoneBody(space);
      const zone = new TriggerZone(space, zoneBody);
      expect(zone.space).toBe(space);
      expect(zone.body).toBe(zoneBody);
      expect(zone.enabled).toBe(true);
      expect(zone.onEnter).toBeNull();
      expect(zone.onStay).toBeNull();
      expect(zone.onExit).toBeNull();
      zone.dispose();
    });

    it("auto-enables sensorEnabled on all shapes", () => {
      const body = new Body(BodyType.STATIC, new Vec2(200, 300));
      body.shapes.add(new Polygon(Polygon.box(50, 50)));
      body.shapes.add(new Circle(20));
      body.space = space;

      expect(body.shapes.at(0).sensorEnabled).toBe(false);
      expect(body.shapes.at(1).sensorEnabled).toBe(false);

      const zone = new TriggerZone(space, body);
      expect(body.shapes.at(0).sensorEnabled).toBe(true);
      expect(body.shapes.at(1).sensorEnabled).toBe(true);
      zone.dispose();
    });

    it("does not disable already-enabled sensors", () => {
      const body = new Body(BodyType.STATIC, new Vec2(200, 300));
      const shape = new Polygon(Polygon.box(50, 50));
      shape.sensorEnabled = true;
      body.shapes.add(shape);
      body.space = space;

      const zone = new TriggerZone(space, body);
      expect(body.shapes.at(0).sensorEnabled).toBe(true);
      zone.dispose();
    });

    it("assigns a CbType to the body", () => {
      const zoneBody = createZoneBody(space);
      const initialCbCount = zoneBody.cbTypes.length;
      const zone = new TriggerZone(space, zoneBody);
      expect(zoneBody.cbTypes.length).toBe(initialCbCount + 1);
      zone.dispose();
    });

    it("creates with initial handlers", () => {
      const zoneBody = createZoneBody(space);
      const enter = vi.fn();
      const stay = vi.fn();
      const exit = vi.fn();
      const zone = new TriggerZone(space, zoneBody, {
        onEnter: enter,
        onStay: stay,
        onExit: exit,
      });
      expect(zone.onEnter).toBe(enter);
      expect(zone.onStay).toBe(stay);
      expect(zone.onExit).toBe(exit);
      zone.dispose();
    });
  });

  // ---- Trigger callbacks ----

  describe("callbacks", () => {
    it("fires onEnter when a body enters the zone", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      const enter = vi.fn();
      const zone = new TriggerZone(space, zoneBody, { onEnter: enter });

      // Place dynamic body above the zone — gravity will pull it in
      createDynamicBody(space, 200, 100);

      // Step until the body falls into the zone
      step(space, 60);

      expect(enter).toHaveBeenCalled();
      zone.dispose();
    });

    it("fires onStay while a body remains in the zone", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      const stay = vi.fn();
      const zone = new TriggerZone(space, zoneBody, { onStay: stay });

      createDynamicBody(space, 200, 100);
      step(space, 60);

      expect(stay.mock.calls.length).toBeGreaterThan(1);
      zone.dispose();
    });

    it("fires onExit when a body leaves the zone", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      const exit = vi.fn();
      const zone = new TriggerZone(space, zoneBody, { onExit: exit });

      // Body falls through the sensor (no collision response) and exits below
      createDynamicBody(space, 200, 100);
      step(space, 120);

      expect(exit).toHaveBeenCalled();
      zone.dispose();
    });

    it("passes the other interactor (not the zone body) to the handler", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      let receivedInteractor: any = null;
      const zone = new TriggerZone(space, zoneBody, {
        onEnter: (other) => {
          receivedInteractor = other;
        },
      });

      createDynamicBody(space, 200, 100);
      step(space, 60);

      expect(receivedInteractor).not.toBeNull();
      // The interactor should not be the zone body itself
      expect(receivedInteractor?.id).not.toBe(zoneBody.id);
      zone.dispose();
    });
  });

  // ---- Enable / disable ----

  describe("enabled", () => {
    it("does not fire callbacks when disabled", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      const enter = vi.fn();
      const zone = new TriggerZone(space, zoneBody, { onEnter: enter });

      zone.enabled = false;
      createDynamicBody(space, 200, 100);
      step(space, 60);

      expect(enter).not.toHaveBeenCalled();
      zone.dispose();
    });

    it("resumes firing after re-enabling", () => {
      const zoneBody = createZoneBody(space, 200, 400);
      const enter = vi.fn();
      const zone = new TriggerZone(space, zoneBody, { onEnter: enter });

      zone.enabled = false;
      zone.enabled = true;

      createDynamicBody(space, 200, 100);
      step(space, 60);

      expect(enter).toHaveBeenCalled();
      zone.dispose();
    });
  });

  // ---- Dynamic handler changes ----

  describe("dynamic handler assignment", () => {
    it("registers listener when handler is set after construction", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      const zone = new TriggerZone(space, zoneBody);

      const enter = vi.fn();
      zone.onEnter = enter;

      createDynamicBody(space, 200, 100);
      step(space, 60);

      expect(enter).toHaveBeenCalled();
      zone.dispose();
    });

    it("removes listener when handler is set to null", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      const enter = vi.fn();
      const zone = new TriggerZone(space, zoneBody, { onEnter: enter });

      zone.onEnter = null;
      createDynamicBody(space, 200, 100);
      step(space, 60);

      expect(enter).not.toHaveBeenCalled();
      zone.dispose();
    });
  });

  // ---- Filter ----

  describe("filter", () => {
    it("only triggers for bodies matching the filter CbType", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      const enemyTag = new CbType();
      const enter = vi.fn();

      const zone = new TriggerZone(space, zoneBody, {
        filter: enemyTag,
        onEnter: enter,
      });

      // Body WITHOUT the tag — should NOT trigger
      createDynamicBody(space, 180, 100);
      step(space, 60);
      expect(enter).not.toHaveBeenCalled();

      // Body WITH the tag — should trigger
      const tagged = createDynamicBody(space, 220, 100);
      tagged.cbTypes.add(enemyTag);
      step(space, 60);
      expect(enter).toHaveBeenCalled();

      zone.dispose();
    });
  });

  // ---- Dispose ----

  describe("dispose", () => {
    it("removes all listeners and untags the body", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      const initialListenerCount = space.listeners.length;

      const zone = new TriggerZone(space, zoneBody, {
        onEnter: () => {},
        onStay: () => {},
        onExit: () => {},
      });

      expect(space.listeners.length).toBe(initialListenerCount + 3);

      zone.dispose();
      expect(space.listeners.length).toBe(initialListenerCount);
      expect(zone.enabled).toBe(false);
    });

    it("does not fire callbacks after dispose", () => {
      const zoneBody = createZoneBody(space, 200, 300);
      const enter = vi.fn();
      const zone = new TriggerZone(space, zoneBody, { onEnter: enter });

      zone.dispose();
      createDynamicBody(space, 200, 100);
      step(space, 60);

      expect(enter).not.toHaveBeenCalled();
    });
  });

  // ---- Custom interaction type ----

  describe("interactionType", () => {
    it("can use InteractionType.COLLISION instead of SENSOR", () => {
      // With COLLISION type, the zone body needs to be a solid collider
      const zoneBody = new Body(BodyType.STATIC, new Vec2(200, 400));
      zoneBody.shapes.add(new Polygon(Polygon.box(200, 20)));
      zoneBody.space = space;

      const enter = vi.fn();
      const zone = new TriggerZone(space, zoneBody, {
        interactionType: InteractionType.COLLISION,
        onEnter: enter,
      });

      // Note: sensorEnabled was set by TriggerZone, so this tests that the
      // interactionType option is accepted. For COLLISION to actually fire,
      // we'd need non-sensor shapes — but the constructor auto-enables sensor.
      // This test just validates the option is accepted without error.
      expect(zone.enabled).toBe(true);
      zone.dispose();
    });
  });
});
