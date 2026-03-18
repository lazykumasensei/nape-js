import { describe, it, expect } from "vitest";
import { ArbiterType } from "../../src/dynamics/ArbiterType";
import { BodyType } from "../../src/phys/BodyType";
import { ShapeType } from "../../src/shape/ShapeType";
import { ListenerType } from "../../src/callbacks/ListenerType";
import { ZPP_Flags } from "../../src/native/util/ZPP_Flags";

describe("ArbiterType coverage", () => {
  it("COLLISION singleton returns 'COLLISION'", () => {
    expect(ArbiterType.COLLISION.toString()).toBe("COLLISION");
  });

  it("SENSOR singleton returns 'SENSOR'", () => {
    expect(ArbiterType.SENSOR.toString()).toBe("SENSOR");
  });

  it("FLUID singleton returns 'FLUID'", () => {
    expect(ArbiterType.FLUID.toString()).toBe("FLUID");
  });

  it("singletons are stable across accesses", () => {
    expect(ArbiterType.COLLISION).toBe(ArbiterType.COLLISION);
    expect(ArbiterType.SENSOR).toBe(ArbiterType.SENSOR);
    expect(ArbiterType.FLUID).toBe(ArbiterType.FLUID);
  });

  it("throws when constructed without internal flag", () => {
    expect(() => new ArbiterType()).toThrow("Cannot instantiate ArbiterType derp!");
  });

  it("unknown instance toString() returns empty string", () => {
    ZPP_Flags.internal = true;
    const unknown = new ArbiterType();
    ZPP_Flags.internal = false;
    expect(unknown.toString()).toBe("");
  });
});

describe("BodyType coverage", () => {
  it("STATIC singleton returns 'STATIC'", () => {
    expect(BodyType.STATIC.toString()).toBe("STATIC");
  });

  it("DYNAMIC singleton returns 'DYNAMIC'", () => {
    expect(BodyType.DYNAMIC.toString()).toBe("DYNAMIC");
  });

  it("KINEMATIC singleton returns 'KINEMATIC'", () => {
    expect(BodyType.KINEMATIC.toString()).toBe("KINEMATIC");
  });

  it("singletons are stable across accesses", () => {
    expect(BodyType.STATIC).toBe(BodyType.STATIC);
    expect(BodyType.DYNAMIC).toBe(BodyType.DYNAMIC);
    expect(BodyType.KINEMATIC).toBe(BodyType.KINEMATIC);
  });

  it("throws when constructed without internal flag", () => {
    expect(() => new BodyType()).toThrow("Cannot instantiate BodyType derp!");
  });

  it("unknown instance toString() returns empty string", () => {
    ZPP_Flags.internal = true;
    const unknown = new BodyType();
    ZPP_Flags.internal = false;
    expect(unknown.toString()).toBe("");
  });
});

describe("ShapeType coverage", () => {
  it("CIRCLE singleton returns 'CIRCLE'", () => {
    expect(ShapeType.CIRCLE.toString()).toBe("CIRCLE");
  });

  it("POLYGON singleton returns 'POLYGON'", () => {
    expect(ShapeType.POLYGON.toString()).toBe("POLYGON");
  });

  it("CAPSULE singleton returns 'CAPSULE'", () => {
    expect(ShapeType.CAPSULE.toString()).toBe("CAPSULE");
  });

  it("singletons are stable across accesses", () => {
    expect(ShapeType.CIRCLE).toBe(ShapeType.CIRCLE);
    expect(ShapeType.POLYGON).toBe(ShapeType.POLYGON);
    expect(ShapeType.CAPSULE).toBe(ShapeType.CAPSULE);
  });

  it("throws when constructed without internal flag", () => {
    expect(() => new ShapeType()).toThrow("Cannot instantiate ShapeType derp!");
  });

  it("unknown instance toString() returns empty string", () => {
    ZPP_Flags.internal = true;
    const unknown = new ShapeType();
    ZPP_Flags.internal = false;
    expect(unknown.toString()).toBe("");
  });
});

describe("ListenerType coverage", () => {
  it("BODY singleton returns 'BODY'", () => {
    expect(ListenerType.BODY.toString()).toBe("BODY");
  });

  it("CONSTRAINT singleton returns 'CONSTRAINT'", () => {
    expect(ListenerType.CONSTRAINT.toString()).toBe("CONSTRAINT");
  });

  it("INTERACTION singleton returns 'INTERACTION'", () => {
    expect(ListenerType.INTERACTION.toString()).toBe("INTERACTION");
  });

  it("PRE singleton returns 'PRE'", () => {
    expect(ListenerType.PRE.toString()).toBe("PRE");
  });

  it("singletons are stable across accesses", () => {
    expect(ListenerType.BODY).toBe(ListenerType.BODY);
    expect(ListenerType.CONSTRAINT).toBe(ListenerType.CONSTRAINT);
    expect(ListenerType.INTERACTION).toBe(ListenerType.INTERACTION);
    expect(ListenerType.PRE).toBe(ListenerType.PRE);
  });

  it("all types are distinct", () => {
    const types = [
      ListenerType.BODY,
      ListenerType.CONSTRAINT,
      ListenerType.INTERACTION,
      ListenerType.PRE,
    ];
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        expect(types[i]).not.toBe(types[j]);
      }
    }
  });

  it("throws when constructed without internal flag", () => {
    expect(() => new ListenerType()).toThrow("Cannot instantiate ListenerType derp!");
  });

  it("unknown instance toString() returns empty string", () => {
    ZPP_Flags.internal = true;
    const unknown = new ListenerType();
    ZPP_Flags.internal = false;
    expect(unknown.toString()).toBe("");
  });
});
