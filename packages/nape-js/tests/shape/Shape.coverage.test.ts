import { describe, it, expect } from "vitest";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { Capsule } from "../../src/shape/Capsule";
import { ShapeType } from "../../src/shape/ShapeType";
import { Material } from "../../src/phys/Material";
import { InteractionFilter } from "../../src/dynamics/InteractionFilter";
import { Space } from "../../src/space/Space";

// Side-effect imports
import "../../src/callbacks/PreFlag";
import "../../src/dynamics/CollisionArbiter";
import "../../src/dynamics/FluidArbiter";

describe("Shape — coverage", () => {
  describe("common properties", () => {
    it("should get/set sensorEnabled", () => {
      const shape = new Circle(10);
      expect(shape.sensorEnabled).toBe(false);
      shape.sensorEnabled = true;
      expect(shape.sensorEnabled).toBe(true);
    });

    it("should get/set material", () => {
      const shape = new Circle(10);
      const mat = new Material(0.5, 0.3, 0.3, 1);
      shape.material = mat;
      expect(shape.material.elasticity).toBeCloseTo(0.5);
    });

    it("should get/set filter", () => {
      const shape = new Circle(10);
      const filter = new InteractionFilter();
      shape.filter = filter;
      expect(shape.filter).toBeDefined();
    });

    it("should get body reference after adding to body", () => {
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const shape = new Circle(10);
      body.shapes.add(shape);
      expect(shape.body).toBe(body);
    });

    it("should get null body when not attached", () => {
      const shape = new Circle(10);
      expect(shape.body).toBeNull();
    });

    it("should get bounds after body is in space", () => {
      const space = new Space(new Vec2(0, 0));
      const body = new Body(BodyType.DYNAMIC, new Vec2(50, 50));
      const shape = new Circle(10);
      body.shapes.add(shape);
      body.space = space;
      space.step(1 / 60, 1, 1);

      const bounds = shape.bounds;
      expect(bounds).toBeDefined();
      expect(bounds.width).toBeGreaterThan(0);
    });

    it("should get/set userData", () => {
      const shape = new Circle(10);
      shape.userData.tag = "test";
      expect(shape.userData.tag).toBe("test");
    });
  });

  describe("Circle", () => {
    it("should get/set radius", () => {
      const c = new Circle(10);
      expect(c.radius).toBeCloseTo(10);
      c.radius = 20;
      expect(c.radius).toBeCloseTo(20);
    });

    it("should throw on NaN radius", () => {
      const c = new Circle(10);
      expect(() => {
        c.radius = NaN;
      }).toThrow();
    });

    it("should throw on negative radius", () => {
      const c = new Circle(10);
      expect(() => {
        c.radius = -5;
      }).toThrow();
    });

    it("should get type as CIRCLE", () => {
      const c = new Circle(10);
      expect(c.type).toBe(ShapeType.CIRCLE);
    });

    it("should get/set localCOM", () => {
      const c = new Circle(10);
      c.localCOM = new Vec2(5, 5);
      expect(c.localCOM.x).toBeCloseTo(5);
      expect(c.localCOM.y).toBeCloseTo(5);
    });

    it("should have toString", () => {
      const c = new Circle(10);
      expect(c.toString()).toBeDefined();
    });

    it("should copy circle", () => {
      const c = new Circle(15);
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(c);
      const bodyClone = body.copy();
      expect(bodyClone.shapes.at(0).type).toBe(ShapeType.CIRCLE);
    });
  });

  describe("Polygon", () => {
    it("should get type as POLYGON", () => {
      const p = new Polygon(Polygon.box(20, 20));
      expect(p.type).toBe(ShapeType.POLYGON);
    });

    it("should get localVerts", () => {
      const p = new Polygon(Polygon.box(20, 20));
      const verts = p.localVerts;
      expect(verts).toBeDefined();
      expect(verts.length).toBe(4);
    });

    it("should get worldVerts when attached to body in space", () => {
      const space = new Space(new Vec2(0, 0));
      const body = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
      const p = new Polygon(Polygon.box(20, 20));
      body.shapes.add(p);
      body.space = space;
      space.step(1 / 60, 1, 1);

      const wverts = p.worldVerts;
      expect(wverts).toBeDefined();
      expect(wverts.length).toBe(4);
    });

    it("should create regular polygon", () => {
      const verts = Polygon.regular(50, 50, 6);
      expect(verts).toBeDefined();
      const p = new Polygon(verts);
      expect(p.localVerts.length).toBe(6);
    });

    it("should create rect", () => {
      const verts = Polygon.rect(10, 20, 30, 40);
      expect(verts).toBeDefined();
      const p = new Polygon(verts);
      expect(p.localVerts.length).toBe(4);
    });

    it("should have toString", () => {
      const p = new Polygon(Polygon.box(20, 20));
      expect(p.toString()).toBeDefined();
    });

    it("should get edges", () => {
      const p = new Polygon(Polygon.box(20, 20));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(p);
      const edges = p.edges;
      expect(edges).toBeDefined();
      expect(edges.length).toBe(4);
    });

    it("should copy polygon via body", () => {
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Polygon(Polygon.box(20, 20)));
      const copy = body.copy();
      expect(copy.shapes.length).toBe(1);
    });
  });

  describe("Capsule", () => {
    it("should create capsule with width and height", () => {
      const c = new Capsule(60, 20);
      expect(c).toBeDefined();
      expect(c.type).toBe(ShapeType.CAPSULE);
    });

    it("should get width and height", () => {
      const c = new Capsule(60, 20);
      expect(c.width).toBeCloseTo(60);
      expect(c.height).toBeCloseTo(20);
    });

    it("should get/set radius", () => {
      const c = new Capsule(60, 20);
      expect(c.radius).toBeCloseTo(10); // height/2
      c.radius = 15;
      expect(c.radius).toBeCloseTo(15);
    });

    it("should have toString", () => {
      const c = new Capsule(60, 20);
      expect(c.toString()).toBeDefined();
    });

    it("should copy capsule via body", () => {
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Capsule(60, 20));
      const copy = body.copy();
      expect(copy.shapes.length).toBe(1);
      expect(copy.shapes.at(0).type).toBe(ShapeType.CAPSULE);
    });
  });

  describe("Edge", () => {
    it("should iterate edges of a polygon", () => {
      const p = new Polygon(Polygon.box(20, 20));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(p);

      const edges = p.edges;
      expect(edges.length).toBe(4);

      for (let i = 0; i < edges.length; i++) {
        const edge = edges.at(i);
        expect(edge).toBeDefined();
        expect(edge.length).toBeGreaterThan(0);
        expect(edge.localNormal).toBeDefined();
      }
    });

    it("should get edge polygon reference", () => {
      const p = new Polygon(Polygon.box(20, 20));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(p);

      const edge = p.edges.at(0);
      expect(edge.polygon).toBe(p);
    });

    it("should get local vertices of edge", () => {
      const p = new Polygon(Polygon.box(20, 20));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(p);

      const edge = p.edges.at(0);
      expect(edge.localVertex1).toBeDefined();
      expect(edge.localVertex2).toBeDefined();
    });

    it("should get world vertices when in space", () => {
      const space = new Space(new Vec2(0, 0));
      const body = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
      const p = new Polygon(Polygon.box(20, 20));
      body.shapes.add(p);
      body.space = space;
      space.step(1 / 60, 1, 1);

      const edge = p.edges.at(0);
      expect(edge.worldVertex1).toBeDefined();
      expect(edge.worldVertex2).toBeDefined();
      expect(edge.worldNormal).toBeDefined();
    });

    it("should have toString", () => {
      const p = new Polygon(Polygon.box(20, 20));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(p);
      const edge = p.edges.at(0);
      expect(edge.toString()).toBeDefined();
    });
  });
});
