/**
 * ZPP_Ray — Internal ray representation for the nape physics engine.
 *
 * Manages ray origin/direction with invalidation callbacks, plus ray-shape
 * intersection methods (AABB, circle, polygon).
 *
 * Converted from nape-compiled.js lines 31239–33172, 65896.
 */

import { getNape } from "../../core/engine";
import { ZPP_Vec2 } from "./ZPP_Vec2";
import { ZPP_AABB } from "./ZPP_AABB";
import { ZPP_PubPool } from "../util/ZPP_PubPool";
import { ZPP_ConvexRayResult } from "./ZPP_ConvexRayResult";
import { ZNPNode_RayResult } from "../util/ZNPRegistry";

export class ZPP_Ray {
  // --- Static: Haxe metadata ---

  // --- Static: internal flag ---
  static internal = false;

  // --- Instance fields ---
  zip_dir = false;
  absnormaly = 0.0;
  absnormalx = 0.0;
  normaly = 0.0;
  normalx = 0.0;
  idiry = 0.0;
  idirx = 0.0;
  diry = 0.0;
  dirx = 0.0;
  originy = 0.0;
  originx = 0.0;
  userData: unknown = null;
  maxdist = 0.0;
  direction: any = null;
  origin: any = null;

  constructor() {
    const nape = getNape();

    // --- Create origin Vec2 wrapper from pool ---
    let ret: any;
    if (ZPP_PubPool.poolVec2 == null) {
      ret = new nape.geom.Vec2();
    } else {
      ret = ZPP_PubPool.poolVec2;
      ZPP_PubPool.poolVec2 = ret.zpp_pool;
      ret.zpp_pool = null;
      ret.zpp_disp = false;
      if (ret == ZPP_PubPool.nextVec2) {
        ZPP_PubPool.nextVec2 = null;
      }
    }

    if (ret.zpp_inner == null) {
      let ret1: ZPP_Vec2;
      if (ZPP_Vec2.zpp_pool == null) {
        ret1 = new ZPP_Vec2();
      } else {
        ret1 = ZPP_Vec2.zpp_pool;
        ZPP_Vec2.zpp_pool = ret1.next;
        ret1.next = null;
      }
      ret1.weak = false;
      ret1._immutable = false;
      ret1.x = 0;
      ret1.y = 0;
      ret.zpp_inner = ret1;
      ret.zpp_inner.outer = ret;
    } else {
      if (ret != null && ret.zpp_disp) {
        throw new Error("Error: Vec2 has been disposed and cannot be used!");
      }
      const _this = ret.zpp_inner;
      if (_this._immutable) {
        throw new Error("Error: Vec2 is immutable");
      }
      if (_this._isimmutable != null) {
        _this._isimmutable();
      }
      let tmp: boolean;
      if (ret != null && ret.zpp_disp) {
        throw new Error("Error: Vec2 has been disposed and cannot be used!");
      }
      const _this1 = ret.zpp_inner;
      if (_this1._validate != null) {
        _this1._validate();
      }
      if (ret.zpp_inner.x == 0) {
        if (ret != null && ret.zpp_disp) {
          throw new Error("Error: Vec2 has been disposed and cannot be used!");
        }
        const _this2 = ret.zpp_inner;
        if (_this2._validate != null) {
          _this2._validate();
        }
        tmp = ret.zpp_inner.y == 0;
      } else {
        tmp = false;
      }
      if (!tmp) {
        ret.zpp_inner.x = 0;
        ret.zpp_inner.y = 0;
        const _this3 = ret.zpp_inner;
        if (_this3._invalidate != null) {
          _this3._invalidate(_this3);
        }
      }
    }
    ret.zpp_inner.weak = false;
    this.origin = ret;
    this.origin.zpp_inner._invalidate = (x: ZPP_Vec2) => this.origin_invalidate(x);

    // --- Create direction Vec2 wrapper from pool ---
    let ret2: any;
    if (ZPP_PubPool.poolVec2 == null) {
      ret2 = new nape.geom.Vec2();
    } else {
      ret2 = ZPP_PubPool.poolVec2;
      ZPP_PubPool.poolVec2 = ret2.zpp_pool;
      ret2.zpp_pool = null;
      ret2.zpp_disp = false;
      if (ret2 == ZPP_PubPool.nextVec2) {
        ZPP_PubPool.nextVec2 = null;
      }
    }

    if (ret2.zpp_inner == null) {
      let ret3: ZPP_Vec2;
      if (ZPP_Vec2.zpp_pool == null) {
        ret3 = new ZPP_Vec2();
      } else {
        ret3 = ZPP_Vec2.zpp_pool;
        ZPP_Vec2.zpp_pool = ret3.next;
        ret3.next = null;
      }
      ret3.weak = false;
      ret3._immutable = false;
      ret3.x = 0;
      ret3.y = 0;
      ret2.zpp_inner = ret3;
      ret2.zpp_inner.outer = ret2;
    } else {
      if (ret2 != null && ret2.zpp_disp) {
        throw new Error("Error: Vec2 has been disposed and cannot be used!");
      }
      const _this4 = ret2.zpp_inner;
      if (_this4._immutable) {
        throw new Error("Error: Vec2 is immutable");
      }
      if (_this4._isimmutable != null) {
        _this4._isimmutable();
      }
      let tmp1: boolean;
      if (ret2 != null && ret2.zpp_disp) {
        throw new Error("Error: Vec2 has been disposed and cannot be used!");
      }
      const _this5 = ret2.zpp_inner;
      if (_this5._validate != null) {
        _this5._validate();
      }
      if (ret2.zpp_inner.x == 0) {
        if (ret2 != null && ret2.zpp_disp) {
          throw new Error("Error: Vec2 has been disposed and cannot be used!");
        }
        const _this6 = ret2.zpp_inner;
        if (_this6._validate != null) {
          _this6._validate();
        }
        tmp1 = ret2.zpp_inner.y == 0;
      } else {
        tmp1 = false;
      }
      if (!tmp1) {
        ret2.zpp_inner.x = 0;
        ret2.zpp_inner.y = 0;
        const _this7 = ret2.zpp_inner;
        if (_this7._invalidate != null) {
          _this7._invalidate(_this7);
        }
      }
    }
    ret2.zpp_inner.weak = false;
    this.direction = ret2;
    this.direction.zpp_inner._invalidate = (x: ZPP_Vec2) => this.direction_invalidate(x);

    this.originx = 0;
    this.originy = 0;
    this.dirx = 0;
    this.diry = 0;
    this.zip_dir = false;
  }

  // ---------------------------------------------------------------------------
  // Invalidation callbacks
  // ---------------------------------------------------------------------------

  origin_invalidate(x: ZPP_Vec2): void {
    this.originx = x.x;
    this.originy = x.y;
  }

  direction_invalidate(x: ZPP_Vec2): void {
    this.dirx = x.x;
    this.diry = x.y;
    this.zip_dir = true;
  }

  invalidate_dir(): void {
    this.zip_dir = true;
  }

  // ---------------------------------------------------------------------------
  // Direction validation (normalizes + computes inverse/normals)
  // ---------------------------------------------------------------------------

  validate_dir(): void {
    if (this.zip_dir) {
      this.zip_dir = false;
      const nape = getNape();
      if (this.dirx * this.dirx + this.diry * this.diry < nape.Config.epsilon) {
        throw new Error("Error: Ray::direction is degenerate");
      }
      const d = this.dirx * this.dirx + this.diry * this.diry;
      const imag = 1.0 / Math.sqrt(d);
      this.dirx *= imag;
      this.diry *= imag;
      this.idirx = 1 / this.dirx;
      this.idiry = 1 / this.diry;
      this.normalx = -this.diry;
      this.normaly = this.dirx;
      const ax = this.normalx;
      this.absnormalx = ax < 0 ? -ax : ax;
      const ay = this.normaly;
      this.absnormaly = ay < 0 ? -ay : ay;
    }
  }

  // ---------------------------------------------------------------------------
  // rayAABB — Compute the AABB of this ray
  // ---------------------------------------------------------------------------

  rayAABB(): ZPP_AABB {
    let x0 = this.originx;
    let x1 = x0;
    let y0 = this.originy;
    let y1 = y0;

    if (this.maxdist >= Infinity) {
      if (this.dirx > 0) {
        x1 = Infinity;
      } else if (this.dirx < 0) {
        x1 = -Infinity;
      }
      if (this.diry > 0) {
        y1 = Infinity;
      } else if (this.diry < 0) {
        y1 = -Infinity;
      }
    } else {
      x1 += this.maxdist * this.dirx;
      y1 += this.maxdist * this.diry;
    }

    if (x1 < x0) {
      const t = x0;
      x0 = x1;
      x1 = t;
    }
    if (y1 < y0) {
      const t1 = y0;
      y0 = y1;
      y1 = t1;
    }

    let ret: ZPP_AABB;
    if (ZPP_AABB.zpp_pool == null) {
      ret = new ZPP_AABB();
    } else {
      ret = ZPP_AABB.zpp_pool;
      ZPP_AABB.zpp_pool = ret.next;
      ret.next = null;
    }
    ret.minx = x0;
    ret.miny = y0;
    ret.maxx = x1;
    ret.maxy = y1;
    return ret;
  }

  // ---------------------------------------------------------------------------
  // aabbtest — Test if ray overlaps an AABB (separating axis test)
  // ---------------------------------------------------------------------------

  aabbtest(a: ZPP_AABB): boolean {
    const dot1 =
      this.normalx * (this.originx - 0.5 * (a.minx + a.maxx)) +
      this.normaly * (this.originy - 0.5 * (a.miny + a.maxy));
    const dot2 =
      this.absnormalx * 0.5 * (a.maxx - a.minx) + this.absnormaly * 0.5 * (a.maxy - a.miny);
    const x = dot1;
    return (x < 0 ? -x : x) < dot2;
  }

  // ---------------------------------------------------------------------------
  // aabbsect — Find the closest intersection of ray with an AABB
  // ---------------------------------------------------------------------------

  aabbsect(a: ZPP_AABB): number {
    const cx = this.originx >= a.minx && this.originx <= a.maxx;
    const cy = this.originy >= a.miny && this.originy <= a.maxy;
    if (cx && cy) {
      return 0.0;
    } else {
      let ret = -1.0;
      while (!(this.dirx >= 0 && this.originx >= a.maxx)) {
        if (this.dirx <= 0 && this.originx <= a.minx) {
          break;
        }
        if (this.diry >= 0 && this.originy >= a.maxy) {
          break;
        }
        if (this.diry <= 0 && this.originy <= a.miny) {
          break;
        }
        if (this.dirx > 0) {
          const t = (a.minx - this.originx) * this.idirx;
          if (t >= 0 && t <= this.maxdist) {
            const y = this.originy + t * this.diry;
            if (y >= a.miny && y <= a.maxy) {
              ret = t;
              break;
            }
          }
        } else if (this.dirx < 0) {
          const t1 = (a.maxx - this.originx) * this.idirx;
          if (t1 >= 0 && t1 <= this.maxdist) {
            const y1 = this.originy + t1 * this.diry;
            if (y1 >= a.miny && y1 <= a.maxy) {
              ret = t1;
              break;
            }
          }
        }
        if (this.diry > 0) {
          const t2 = (a.miny - this.originy) * this.idiry;
          if (t2 >= 0 && t2 <= this.maxdist) {
            const x = this.originx + t2 * this.dirx;
            if (x >= a.minx && x <= a.maxx) {
              ret = t2;
              break;
            }
          }
        } else if (this.diry < 0) {
          const t3 = (a.maxy - this.originy) * this.idiry;
          if (t3 >= 0 && t3 <= this.maxdist) {
            const x1 = this.originx + t3 * this.dirx;
            if (x1 >= a.minx && x1 <= a.maxx) {
              ret = t3;
              break;
            }
          }
        }
        break;
      }
      return ret;
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: allocate a Vec2 wrapper with given (x, y) from pool
  // ---------------------------------------------------------------------------

  private static _allocVec2(x: number, y: number): any {
    const nape = getNape();
    if (x != x || y != y) {
      throw new Error("Error: Vec2 components cannot be NaN");
    }

    let ret: any;
    if (ZPP_PubPool.poolVec2 == null) {
      ret = new nape.geom.Vec2() as any;
    } else {
      ret = ZPP_PubPool.poolVec2;
      ZPP_PubPool.poolVec2 = ret.zpp_pool;
      ret.zpp_pool = null;
      ret.zpp_disp = false;
      if (ret == ZPP_PubPool.nextVec2) {
        ZPP_PubPool.nextVec2 = null;
      }
    }

    if (ret.zpp_inner == null) {
      let inner: ZPP_Vec2;
      if (ZPP_Vec2.zpp_pool == null) {
        inner = new ZPP_Vec2();
      } else {
        inner = ZPP_Vec2.zpp_pool;
        ZPP_Vec2.zpp_pool = inner.next;
        inner.next = null;
      }
      inner.weak = false;
      inner._immutable = false;
      inner.x = x;
      inner.y = y;
      ret.zpp_inner = inner;
      ret.zpp_inner.outer = ret;
    } else {
      if (ret != null && ret.zpp_disp) {
        throw new Error("Error: Vec2 has been disposed and cannot be used!");
      }
      const _this = ret.zpp_inner;
      if (_this._immutable) {
        throw new Error("Error: Vec2 is immutable");
      }
      if (_this._isimmutable != null) {
        _this._isimmutable();
      }
      if (x != x || y != y) {
        throw new Error("Error: Vec2 components cannot be NaN");
      }
      let same: boolean;
      if (ret.zpp_inner._validate != null) {
        ret.zpp_inner._validate();
      }
      if (ret.zpp_inner.x == x) {
        if (ret.zpp_inner._validate != null) {
          ret.zpp_inner._validate();
        }
        same = ret.zpp_inner.y == y;
      } else {
        same = false;
      }
      if (!same) {
        ret.zpp_inner.x = x;
        ret.zpp_inner.y = y;
        if (ret.zpp_inner._invalidate != null) {
          ret.zpp_inner._invalidate(ret.zpp_inner);
        }
      }
    }
    ret.zpp_inner.weak = false;
    return ret;
  }

  // ---------------------------------------------------------------------------
  // Helper: validate worldCOM on a shape (used by circlesect/circlesect2)
  // ---------------------------------------------------------------------------

  private static _validateWorldCOM(c: any): void {
    if (c.zip_worldCOM) {
      if (c.body != null) {
        c.zip_worldCOM = false;
        if (c.zip_localCOM) {
          c.zip_localCOM = false;
          if (c.type == 1) {
            const _this = c.polygon;
            if (_this.lverts.next == null) {
              throw new Error("Error: An empty polygon has no meaningful localCOM");
            }
            if (_this.lverts.next.next == null) {
              _this.localCOMx = _this.lverts.next.x;
              _this.localCOMy = _this.lverts.next.y;
            } else if (_this.lverts.next.next.next == null) {
              _this.localCOMx = _this.lverts.next.x;
              _this.localCOMy = _this.lverts.next.y;
              const t = 1.0;
              _this.localCOMx += _this.lverts.next.next.x * t;
              _this.localCOMy += _this.lverts.next.next.y * t;
              const t1 = 0.5;
              _this.localCOMx *= t1;
              _this.localCOMy *= t1;
            } else {
              _this.localCOMx = 0;
              _this.localCOMy = 0;
              let area = 0.0;
              let cx_ite = _this.lverts.next;
              let u = cx_ite;
              cx_ite = cx_ite.next;
              let v = cx_ite;
              cx_ite = cx_ite.next;
              while (cx_ite != null) {
                const w = cx_ite;
                area += v.x * (w.y - u.y);
                const cf = w.y * v.x - w.x * v.y;
                _this.localCOMx += (v.x + w.x) * cf;
                _this.localCOMy += (v.y + w.y) * cf;
                u = v;
                v = w;
                cx_ite = cx_ite.next;
              }
              cx_ite = _this.lverts.next;
              const w1 = cx_ite;
              area += v.x * (w1.y - u.y);
              const cf1 = w1.y * v.x - w1.x * v.y;
              _this.localCOMx += (v.x + w1.x) * cf1;
              _this.localCOMy += (v.y + w1.y) * cf1;
              u = v;
              v = w1;
              cx_ite = cx_ite.next;
              const w2 = cx_ite;
              area += v.x * (w2.y - u.y);
              const cf2 = w2.y * v.x - w2.x * v.y;
              _this.localCOMx += (v.x + w2.x) * cf2;
              _this.localCOMy += (v.y + w2.y) * cf2;
              area = 1 / (3 * area);
              const t2 = area;
              _this.localCOMx *= t2;
              _this.localCOMy *= t2;
            }
          }
          if (c.wrap_localCOM != null) {
            c.wrap_localCOM.zpp_inner.x = c.localCOMx;
            c.wrap_localCOM.zpp_inner.y = c.localCOMy;
          }
        }
        const _this1 = c.body;
        if (_this1.zip_axis) {
          _this1.zip_axis = false;
          _this1.axisx = Math.sin(_this1.rot);
          _this1.axisy = Math.cos(_this1.rot);
        }
        c.worldCOMx = c.body.posx + (c.body.axisy * c.localCOMx - c.body.axisx * c.localCOMy);
        c.worldCOMy = c.body.posy + (c.localCOMx * c.body.axisx + c.localCOMy * c.body.axisy);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: compute circle normal at intersection point
  // ---------------------------------------------------------------------------

  private _circleNormal(t: number, c: any, insideFlip: boolean): { nx: number; ny: number } {
    let nx = this.originx + this.dirx * t;
    let ny = this.originy + this.diry * t;
    nx -= c.worldCOMx;
    ny -= c.worldCOMy;
    const d = nx * nx + ny * ny;
    const imag = 1.0 / Math.sqrt(d);
    nx *= imag;
    ny *= imag;
    if (insideFlip) {
      nx = -nx;
      ny = -ny;
    }
    return { nx, ny };
  }

  // ---------------------------------------------------------------------------
  // Helper: insert a result into a sorted list (by toiDistance)
  // ---------------------------------------------------------------------------

  private static _insertSorted(list: any, res: any): void {
    let pre: any = null;
    let cx_ite = list.zpp_inner.inner.head;
    while (cx_ite != null) {
      const j = cx_ite.elt;
      if (res.zpp_inner.next != null) {
        throw new Error("Error: This object has been disposed of and cannot be used");
      }
      if (j.zpp_inner.next != null) {
        throw new Error("Error: This object has been disposed of and cannot be used");
      }
      if (res.zpp_inner.toiDistance < j.zpp_inner.toiDistance) {
        break;
      }
      pre = cx_ite;
      cx_ite = cx_ite.next;
    }
    const _this = list.zpp_inner.inner;
    let node: any;
    if (ZNPNode_RayResult.zpp_pool == null) {
      node = new ZNPNode_RayResult();
    } else {
      node = ZNPNode_RayResult.zpp_pool;
      ZNPNode_RayResult.zpp_pool = node.next;
      node.next = null;
    }
    node.elt = res;
    if (pre == null) {
      node.next = _this.head;
      _this.head = node;
    } else {
      node.next = pre.next;
      pre.next = node;
    }
    _this.pushmod = _this.modified = true;
    _this.length++;
  }

  // ---------------------------------------------------------------------------
  // circlesect — Find closest circle intersection (single result)
  // ---------------------------------------------------------------------------

  circlesect(c: any, inner: boolean, mint: number): any {
    ZPP_Ray._validateWorldCOM(c);

    const acx = this.originx - c.worldCOMx;
    const acy = this.originy - c.worldCOMy;
    let A = this.dirx * this.dirx + this.diry * this.diry;
    const B = 2 * (acx * this.dirx + acy * this.diry);
    const C = acx * acx + acy * acy - c.radius * c.radius;
    let det = B * B - 4 * A * C;

    if (det == 0) {
      const t = (-B / 2) * A;
      if ((!inner || C > 0) && t > 0 && t < mint && t <= this.maxdist) {
        const n = this._circleNormal(t, c, C <= 0);
        const normalVec = ZPP_Ray._allocVec2(n.nx, n.ny);
        return ZPP_ConvexRayResult.getRay(normalVec, t, C <= 0, c.outer);
      } else {
        return null;
      }
    } else {
      det = Math.sqrt(det);
      A = 1 / (2 * A);
      const t0 = (-B - det) * A;
      const t1 = (-B + det) * A;

      if (t0 > 0) {
        if (t0 < mint && t0 <= this.maxdist) {
          const n = this._circleNormal(t0, c, false);
          const normalVec = ZPP_Ray._allocVec2(n.nx, n.ny);
          return ZPP_ConvexRayResult.getRay(normalVec, t0, false, c.outer);
        } else {
          return null;
        }
      } else if (t1 > 0 && inner) {
        if (t1 < mint && t1 <= this.maxdist) {
          const n = this._circleNormal(t1, c, true);
          const normalVec = ZPP_Ray._allocVec2(n.nx, n.ny);
          return ZPP_ConvexRayResult.getRay(normalVec, t1, true, c.outer);
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // circlesect2 — Find all circle intersections (insert into sorted list)
  // ---------------------------------------------------------------------------

  circlesect2(c: any, inner: boolean, list: any): void {
    ZPP_Ray._validateWorldCOM(c);

    const acx = this.originx - c.worldCOMx;
    const acy = this.originy - c.worldCOMy;
    let A = this.dirx * this.dirx + this.diry * this.diry;
    const B = 2 * (acx * this.dirx + acy * this.diry);
    const C = acx * acx + acy * acy - c.radius * c.radius;
    let det = B * B - 4 * A * C;

    if (det == 0) {
      const t = (-B / 2) * A;
      if ((!inner || C > 0) && t > 0 && t <= this.maxdist) {
        const n = this._circleNormal(t, c, C <= 0);
        const normalVec = ZPP_Ray._allocVec2(n.nx, n.ny);
        const res = ZPP_ConvexRayResult.getRay(normalVec, t, C <= 0, c.outer);
        ZPP_Ray._insertSorted(list, res);
      }
    } else {
      det = Math.sqrt(det);
      A = 1 / (2 * A);
      const t0 = (-B - det) * A;
      const t1 = (-B + det) * A;

      if (t0 > 0 && t0 <= this.maxdist) {
        const n = this._circleNormal(t0, c, false);
        const normalVec = ZPP_Ray._allocVec2(n.nx, n.ny);
        const res = ZPP_ConvexRayResult.getRay(normalVec, t0, false, c.outer);
        ZPP_Ray._insertSorted(list, res);
      }
      if (t1 > 0 && t1 <= this.maxdist && inner) {
        const n = this._circleNormal(t1, c, true);
        const normalVec = ZPP_Ray._allocVec2(n.nx, n.ny);
        const res = ZPP_ConvexRayResult.getRay(normalVec, t1, true, c.outer);
        ZPP_Ray._insertSorted(list, res);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // capsect — Find closest capsule intersection (single result)
  // ---------------------------------------------------------------------------

  capsect(cap: any, inner: boolean, mint: number): any {
    // Ensure world-space spine endpoints and worldCOM are up to date
    ZPP_Ray._validateWorldCOM(cap);
    if (cap.zip_aabb) {
      cap.zip_aabb = false;
      cap.__validate_aabb();
    }

    const r = cap.radius;
    const s1x = cap.spine1x;
    const s1y = cap.spine1y;
    const s2x = cap.spine2x;
    const s2y = cap.spine2y;

    let bestT = mint;
    let bestNx = 0;
    let bestNy = 0;
    let bestInner = false;

    // --- Test two end-cap circles (at spine endpoints) ---
    for (let ci = 0; ci < 2; ci++) {
      const cx = ci === 0 ? s1x : s2x;
      const cy = ci === 0 ? s1y : s2y;
      const acx = this.originx - cx;
      const acy = this.originy - cy;
      let A = this.dirx * this.dirx + this.diry * this.diry;
      const B = 2 * (acx * this.dirx + acy * this.diry);
      const C = acx * acx + acy * acy - r * r;
      let det = B * B - 4 * A * C;
      if (det < 0) continue;

      det = Math.sqrt(det);
      A = 1 / (2 * A);
      const t0 = (-B - det) * A;
      const t1 = (-B + det) * A;

      // For each candidate t, verify the hit point is on the end-cap side
      // (not in the rectangular region claimed by the side edges)
      const candidates = [
        { t: t0, inside: false },
        { t: t1, inside: true },
      ];
      for (const { t, inside } of candidates) {
        if (t <= 0 || t >= bestT || t > this.maxdist) continue;
        if (inside && !inner) continue;
        // Hit point in world space
        const hx = this.originx + this.dirx * t;
        const hy = this.originy + this.diry * t;
        // Project hit onto spine to verify it's on this cap's side
        const spx = s2x - s1x;
        const spy = s2y - s1y;
        const spLen2 = spx * spx + spy * spy;
        if (spLen2 > 0) {
          const dot = (hx - s1x) * spx + (hy - s1y) * spy;
          const proj = dot / spLen2;
          // Only accept if projected onto the cap's side (not the middle rectangle)
          if (ci === 0 && proj > 0 && proj < 1) continue;
          if (ci === 1 && proj > 0 && proj < 1) continue;
        }
        // Compute normal
        let nx = hx - cx;
        let ny = hy - cy;
        const d = Math.sqrt(nx * nx + ny * ny);
        if (d > 0) {
          nx /= d;
          ny /= d;
        }
        if (inside) {
          nx = -nx;
          ny = -ny;
        }
        bestT = t;
        bestNx = nx;
        bestNy = ny;
        bestInner = inside;
      }
    }

    // --- Test two side edges (the flat sides of the capsule) ---
    // Spine direction
    const spx = s2x - s1x;
    const spy = s2y - s1y;
    const spLen = Math.sqrt(spx * spx + spy * spy);
    if (spLen > 1e-10) {
      // Side normals perpendicular to spine
      const pnx = -spy / spLen;
      const pny = spx / spLen;

      for (let side = 0; side < 2; side++) {
        const nx = side === 0 ? pnx : -pnx;
        const ny = side === 0 ? pny : -pny;

        // Edge vertices: spine endpoints offset by ±radius along normal
        const e1x = s1x + nx * r;
        const e1y = s1y + ny * r;
        const e2x = s2x + nx * r;
        const e2y = s2y + ny * r;

        // Skip back-facing edges (unless inner)
        if (!inner && nx * this.dirx + ny * this.diry >= 0) continue;

        // Ray-segment intersection
        const vx = e2x - e1x;
        const vy = e2y - e1y;
        const sx = e1x - this.originx;
        const sy = e1y - this.originy;
        let den = vy * this.dirx - vx * this.diry;
        if (den * den < 1e-12) continue;
        den = 1 / den;
        const t = (vy * sx - vx * sy) * den;
        if (t <= 0 || t >= bestT || t > this.maxdist) continue;
        const u = (this.diry * sx - this.dirx * sy) * den;
        if (u < -1e-6 || u > 1 + 1e-6) continue;

        const isInner = nx * this.dirx + ny * this.diry > 0;
        let fnx = nx;
        let fny = ny;
        if (isInner) {
          fnx = -nx;
          fny = -ny;
        }
        bestT = t;
        bestNx = fnx;
        bestNy = fny;
        bestInner = isInner;
      }
    }

    if (bestT < mint) {
      const normalVec = ZPP_Ray._allocVec2(bestNx, bestNy);
      return ZPP_ConvexRayResult.getRay(normalVec, bestT, bestInner, cap.outer);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // capsect2 — Find all capsule intersections (insert into sorted list)
  // ---------------------------------------------------------------------------

  capsect2(cap: any, inner: boolean, list: any): void {
    // Ensure world-space spine endpoints and worldCOM are up to date
    ZPP_Ray._validateWorldCOM(cap);
    if (cap.zip_aabb) {
      cap.zip_aabb = false;
      cap.__validate_aabb();
    }

    const r = cap.radius;
    const s1x = cap.spine1x;
    const s1y = cap.spine1y;
    const s2x = cap.spine2x;
    const s2y = cap.spine2y;

    let bestT = Infinity;
    let bestNx = 0;
    let bestNy = 0;
    let bestInner = false;
    let worstT = -1;
    let worstNx = 0;
    let worstNy = 0;
    let worstInner = false;

    // Helper to track min/max
    const track = (t: number, nx: number, ny: number, isInner: boolean) => {
      if (t < bestT) {
        bestT = t;
        bestNx = nx;
        bestNy = ny;
        bestInner = isInner;
      }
      if (t > worstT) {
        worstT = t;
        worstNx = nx;
        worstNy = ny;
        worstInner = isInner;
      }
    };

    // --- Test two end-cap circles ---
    for (let ci = 0; ci < 2; ci++) {
      const cx = ci === 0 ? s1x : s2x;
      const cy = ci === 0 ? s1y : s2y;
      const acx = this.originx - cx;
      const acy = this.originy - cy;
      let A = this.dirx * this.dirx + this.diry * this.diry;
      const B = 2 * (acx * this.dirx + acy * this.diry);
      const C = acx * acx + acy * acy - r * r;
      let det = B * B - 4 * A * C;
      if (det < 0) continue;

      det = Math.sqrt(det);
      A = 1 / (2 * A);
      const t0 = (-B - det) * A;
      const t1 = (-B + det) * A;

      const candidates = [
        { t: t0, inside: false },
        { t: t1, inside: true },
      ];
      for (const { t, inside } of candidates) {
        if (t <= 0 || t > this.maxdist) continue;
        if (inside && !inner) continue;
        const hx = this.originx + this.dirx * t;
        const hy = this.originy + this.diry * t;
        const spxd = s2x - s1x;
        const spyd = s2y - s1y;
        const spLen2 = spxd * spxd + spyd * spyd;
        if (spLen2 > 0) {
          const dot = (hx - s1x) * spxd + (hy - s1y) * spyd;
          const proj = dot / spLen2;
          if (ci === 0 && proj > 0 && proj < 1) continue;
          if (ci === 1 && proj > 0 && proj < 1) continue;
        }
        let nx = hx - cx;
        let ny = hy - cy;
        const d = Math.sqrt(nx * nx + ny * ny);
        if (d > 0) {
          nx /= d;
          ny /= d;
        }
        if (inside) {
          nx = -nx;
          ny = -ny;
        }
        track(t, nx, ny, inside);
      }
    }

    // --- Test two side edges ---
    const spx = s2x - s1x;
    const spy = s2y - s1y;
    const spLen = Math.sqrt(spx * spx + spy * spy);
    if (spLen > 1e-10) {
      const pnx = -spy / spLen;
      const pny = spx / spLen;

      for (let side = 0; side < 2; side++) {
        const nx = side === 0 ? pnx : -pnx;
        const ny = side === 0 ? pny : -pny;

        const e1x = s1x + nx * r;
        const e1y = s1y + ny * r;
        const e2x = s2x + nx * r;
        const e2y = s2y + ny * r;

        if (!inner && nx * this.dirx + ny * this.diry >= 0) continue;

        const vx = e2x - e1x;
        const vy = e2y - e1y;
        const sx = e1x - this.originx;
        const sy = e1y - this.originy;
        let den = vy * this.dirx - vx * this.diry;
        if (den * den < 1e-12) continue;
        den = 1 / den;
        const t = (vy * sx - vx * sy) * den;
        if (t <= 0 || t > this.maxdist) continue;
        const u = (this.diry * sx - this.dirx * sy) * den;
        if (u < -1e-6 || u > 1 + 1e-6) continue;

        const isInner = nx * this.dirx + ny * this.diry > 0;
        let fnx = nx;
        let fny = ny;
        if (isInner) {
          fnx = -nx;
          fny = -ny;
        }
        track(t, fnx, fny, isInner);
      }
    }

    if (bestT < Infinity) {
      const normalVec = ZPP_Ray._allocVec2(bestNx, bestNy);
      const res = ZPP_ConvexRayResult.getRay(normalVec, bestT, bestInner, cap.outer);
      ZPP_Ray._insertSorted(list, res);
    }
    if (worstT > 0 && worstT !== bestT) {
      const normalVec = ZPP_Ray._allocVec2(worstNx, worstNy);
      const res = ZPP_ConvexRayResult.getRay(normalVec, worstT, worstInner, cap.outer);
      ZPP_Ray._insertSorted(list, res);
    }
  }

  // ---------------------------------------------------------------------------
  // polysect — Find closest polygon intersection (single result)
  // ---------------------------------------------------------------------------

  polysect(p: any, inner: boolean, mint: number): any {
    const nape = getNape();
    let min = mint;
    let edge: any = null;
    let ei = p.edges.head;

    // Iterate edges using paired vertex ring
    const cx_cont = true;
    const cx_itei = p.gverts.next;
    let u = cx_itei;
    let cx_itej = cx_itei.next;

    while (cx_itej != null) {
      const v = cx_itej;
      const e = ei.elt;
      if (inner || e.gnormx * this.dirx + e.gnormy * this.diry < 0) {
        const _vx = v.x - u.x;
        const _vy = v.y - u.y;
        const _sx = u.x - this.originx;
        const _sy = u.y - this.originy;
        let den = _vy * this.dirx - _vx * this.diry;
        if (den * den > nape.Config.epsilon) {
          den = 1 / den;
          const sxx = (_vy * _sx - _vx * _sy) * den;
          if (sxx > 0 && sxx < min && sxx <= this.maxdist) {
            const txx = (this.diry * _sx - this.dirx * _sy) * den;
            if (txx > -nape.Config.epsilon && txx < 1 + nape.Config.epsilon) {
              min = sxx;
              edge = ei.elt;
            }
          }
        }
      }
      ei = ei.next;
      u = v;
      cx_itej = cx_itej.next;
    }

    // Wrap-around: last vertex to first vertex
    if (cx_cont) {
      cx_itej = p.gverts.next;
      const v1 = cx_itej;
      const e1 = ei.elt;
      if (inner || e1.gnormx * this.dirx + e1.gnormy * this.diry < 0) {
        const _vx1 = v1.x - u.x;
        const _vy1 = v1.y - u.y;
        const _sx1 = u.x - this.originx;
        const _sy1 = u.y - this.originy;
        let den1 = _vy1 * this.dirx - _vx1 * this.diry;
        if (den1 * den1 > nape.Config.epsilon) {
          den1 = 1 / den1;
          const sxx1 = (_vy1 * _sx1 - _vx1 * _sy1) * den1;
          if (sxx1 > 0 && sxx1 < min && sxx1 <= this.maxdist) {
            const txx1 = (this.diry * _sx1 - this.dirx * _sy1) * den1;
            if (txx1 > -nape.Config.epsilon && txx1 < 1 + nape.Config.epsilon) {
              min = sxx1;
              edge = ei.elt;
            }
          }
        }
      }
    }

    if (edge != null) {
      let nx = edge.gnormx;
      let ny = edge.gnormy;
      const inner1 = nx * this.dirx + ny * this.diry > 0;
      if (inner1) {
        nx = -nx;
        ny = -ny;
      }
      const normalVec = ZPP_Ray._allocVec2(nx, ny);
      return ZPP_ConvexRayResult.getRay(normalVec, min, inner1, p.outer);
    } else {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // polysect2 — Find all polygon intersections (insert into sorted list)
  // ---------------------------------------------------------------------------

  polysect2(p: any, inner: boolean, list: any): void {
    const nape = getNape();
    let min = Infinity;
    let max = -1.0;
    let edge: any = null;
    let edgemax: any = null;
    let ei = p.edges.head;

    // Iterate edges using paired vertex ring
    const cx_cont = true;
    const cx_itei = p.gverts.next;
    let u = cx_itei;
    let cx_itej = cx_itei.next;

    while (cx_itej != null) {
      const v = cx_itej;
      const e = ei.elt;
      if (inner || e.gnormx * this.dirx + e.gnormy * this.diry < 0) {
        const _vx = v.x - u.x;
        const _vy = v.y - u.y;
        const _sx = u.x - this.originx;
        const _sy = u.y - this.originy;
        let den = _vy * this.dirx - _vx * this.diry;
        if (den * den > nape.Config.epsilon) {
          den = 1 / den;
          const sxx = (_vy * _sx - _vx * _sy) * den;
          if (sxx > 0 && sxx <= this.maxdist && (sxx < min || sxx > max)) {
            const txx = (this.diry * _sx - this.dirx * _sy) * den;
            if (txx > -nape.Config.epsilon && txx < 1 + nape.Config.epsilon) {
              if (sxx < min) {
                min = sxx;
                edge = ei.elt;
              }
              if (sxx > max) {
                max = sxx;
                edgemax = ei.elt;
              }
            }
          }
        }
      }
      ei = ei.next;
      u = v;
      cx_itej = cx_itej.next;
    }

    // Wrap-around: last vertex to first vertex
    if (cx_cont) {
      cx_itej = p.gverts.next;
      const v1 = cx_itej;
      const e1 = ei.elt;
      if (inner || e1.gnormx * this.dirx + e1.gnormy * this.diry < 0) {
        const _vx1 = v1.x - u.x;
        const _vy1 = v1.y - u.y;
        const _sx1 = u.x - this.originx;
        const _sy1 = u.y - this.originy;
        let den1 = _vy1 * this.dirx - _vx1 * this.diry;
        if (den1 * den1 > nape.Config.epsilon) {
          den1 = 1 / den1;
          const sxx1 = (_vy1 * _sx1 - _vx1 * _sy1) * den1;
          if (sxx1 > 0 && sxx1 <= this.maxdist && (sxx1 < min || sxx1 > max)) {
            const txx1 = (this.diry * _sx1 - this.dirx * _sy1) * den1;
            if (txx1 > -nape.Config.epsilon && txx1 < 1 + nape.Config.epsilon) {
              if (sxx1 < min) {
                min = sxx1;
                edge = ei.elt;
              }
              if (sxx1 > max) {
                max = sxx1;
                edgemax = ei.elt;
              }
            }
          }
        }
      }
    }

    // Insert the min-distance edge result
    if (edge != null) {
      let nx = edge.gnormx;
      let ny = edge.gnormy;
      const inner1 = nx * this.dirx + ny * this.diry > 0;
      if (inner1) {
        nx = -nx;
        ny = -ny;
      }
      const normalVec = ZPP_Ray._allocVec2(nx, ny);
      const res = ZPP_ConvexRayResult.getRay(normalVec, min, inner1, p.outer);
      ZPP_Ray._insertSorted(list, res);
    }

    // Insert the max-distance edge result (if different from min edge)
    if (edgemax != null && edge != edgemax) {
      let nx1 = edgemax.gnormx;
      let ny1 = edgemax.gnormy;
      const inner2 = nx1 * this.dirx + ny1 * this.diry > 0;
      if (inner2) {
        nx1 = -nx1;
        ny1 = -ny1;
      }
      const normalVec = ZPP_Ray._allocVec2(nx1, ny1);
      const res = ZPP_ConvexRayResult.getRay(normalVec, max, inner2, p.outer);
      ZPP_Ray._insertSorted(list, res);
    }
  }
}
