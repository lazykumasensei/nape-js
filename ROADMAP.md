# nape-js — Roadmap

## Completed Items

Done: P21-P28, P30-P33, P35, P37-P43, P45-P48, P50-P55, P57.
Cancelled: P34 (tree shaking — architectural limit), P36 (server demos — superseded by P52), P49 (ECS adapter — trivial pattern).

---

## Active Priorities

| #   | Priority                         | Effort | Impact   | Status                                                         |
| --- | -------------------------------- | ------ | -------- | -------------------------------------------------------------- |
| P29 | Test coverage >= 80%             | L      | safety   | :diamonds: ~57% (4873 tests)                                   |
| P44 | PixiJS integration — npm package | M      | adoption | :diamonds: Phase 1 done (demos), Phase 2 pending (npm package) |
| P56 | Interactive playground           | S-M    | adoption | :white_square_button: Not started                              |

---

## New Priorities

### Ecosystem & Integrations

| #   | Priority                     | Effort | Impact          | Why                                                                                                                                                   |
| --- | ---------------------------- | ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P58 | **Phaser plugin/adapter**    | M      | :fire: adoption | Phaser is the #1 JS game framework — direct integration = massive reach. Phaser Box2D exists but lacks fluid sim, character controller, serialization |
| P59 | **React/R3F integration**    | M      | :fire: adoption | `@react-three/rapier`-style package for the React gamedev community. Growing market segment                                                           |
| P60 | **Tilemap collision helper** | S      | DX              | Tiled/LDtk map -> physics body conversion. Common gamedev need, low effort, high utility                                                              |

### Developer Experience & Onboarding

| #   | Priority                            | Effort | Impact          | Why                                                                                                                                                                                                                                    |
| --- | ----------------------------------- | ------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P63 | **AI/LLM-friendly docs + Cookbook** | S      | :fire: adoption | AI-korszakban a legjobb marketing ha az AI jo kodot general. Strukturalt prompt-peldak, 20-30 copy-paste recipe (platformer, ragdoll, fluid pool, pinball stb.), troubleshooting guide az API gotchakkal. A meglevo `llms.txt` jo alap |
| P65 | **One-click game templates**        | M      | :fire: adoption | `npm create nape-game@latest` vagy StackBlitz template-ek: platformer starter (CharacterController + tilemap + camera), top-down car, ragdoll fighter, pinball. 5 perc alatt futo elso jatek = legfontosabb onboarding elem            |
| P66 | **Trigger zone API**                | S      | DX              | Magas szintu Unity-stílusu `onEnter/onStay/onExit` wrapper a callback rendszer folott. A jelenlegi CbType-alapu API mukodik de nem intuitiv. Egyszerusitett API csökkenti a belépési küszöböt                                          |

### Physics Features

| #   | Priority                        | Effort | Impact            | Why                                                                                                                                                                                                                 |
| --- | ------------------------------- | ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P62 | **Particle system**             | S-M    | features          | Fizika-tudatos particle emitter — gamedevek altal gyakran kert feature                                                                                                                                              |
| P64 | **Spring/Damper joint**         | S      | features          | Hianyzó alap constraint. Soft-body, vehicle suspension, ragdoll hair, UI animaciok mind rugot akarnak. Most csak UserConstraint-tel oldhato meg                                                                     |
| P67 | **Destruction/Fracture system** | M      | :fire: wow-factor | Voronoi-alapu toredezes — `Body.fracture(impactPoint, energy)` API. Egyetlen mas JS engine sem csinalja. Mar van `createConcaveBody` es `destructible-terrain` demo mint alap. Vizualisan latvanjos, marketing gold |

### Tooling & Infrastructure

| #   | Priority                                 | Effort | Impact          | Why                                                                                                                                                                                                                            |
| --- | ---------------------------------------- | ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P61 | **Bundle size reduction**                | S-M    | competitiveness | 87 KB vs Phaser Box2D 65 KB gap csökkentese. Dead code audit, hot path optimalizalas                                                                                                                                           |
| P68 | **Performance profiler / debug overlay** | S      | DX              | Runtime profiler: broadphase/narrowphase/solver ido, body/contact/constraint szam, sleep statisztikak, bottleneck highlight. Rapier-nek van, nekünk nincs. Bizalomépiítés profi fejlesztoknel                                  |
| P69 | **Deterministic replay system**          | M      | features        | Input-rogzites + visszajátszas a meglevo serializacio + determinisztikus mod felett. Debug bug-reprodukcio, multiplayer rollback alap, megosztható replay, determinisztikus regression teszt — egy feature ami osszekot tobbet |

---

## Recommended Execution Order

### Phase 1 — Finish what's started + onboarding (next)

1. **P44 Phase 2** — Ship `@newkrok/nape-pixi` npm package (auto-sync transforms, typed API, TSDoc)
2. **P63** — AI/LLM docs + Cookbook (legkisebb effort, legnagyobb hatás az AI-korszakban)
3. **P56** — Interactive playground (StackBlitz/CodeSandbox template, editable examples)

### Phase 2 — Wow-factor + ecosystem

4. **P67** — Destruction/Fracture system (egyedülálló feature, marketing érték)
5. **P58** — Phaser plugin/adapter (biggest community reach opportunity)
6. **P65** — One-click game templates (5 perc elso jatekk)
7. **P66** — Trigger zone API (kicsi effort, nagy DX javulas)

### Phase 3 — Ecosystem expand

8. **P60** — Tilemap collision helper (low effort, high gamedev utility)
9. **P59** — React/R3F integration (growing market)
10. **P64** — Spring/Damper joint (alapveto fizika feature)

### Phase 4 — Polish & tooling

11. **P62** — Particle system
12. **P68** — Performance profiler
13. **P69** — Deterministic replay system
14. **P61** — Bundle size reduction
15. **P29** — Continue test coverage push toward 80%
