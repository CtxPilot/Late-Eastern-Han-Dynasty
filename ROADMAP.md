# Development Roadmap

This is the public, contributor-facing roadmap. Detailed session logs live in `docs/10-progress.md`, task history in `docs/09-roadmap.md`, the phased delivery plan in `docs/35-phased-implementation-roadmap.md`, and system maturity in `docs/12-system-map.md`.

The roadmap is evidence-based: “implemented” means code exists and has been exercised; “designed” means documentation exists but runtime behavior may not.

## Now — shipped baseline (0-A playable prototype)

- ✅ Deterministic core: one seeded xorshift32 PRNG for every action resolution; save envelopes with schema validation, migrations, and deterministic continuation (SQLite named slots on desktop, IndexedDB slots in-browser).
- ✅ Two scenarios (Hero Assembly + the 190 CE four-faction slice) with layered event sourcing; turn pipeline covering economy, demographics, events, espionage, plots, families, children, AI factions.
- ✅ Campaign layer: army composition (commander/deputies/adviser/five squads), road marching, siege, assault or surrender via auto-battle.
- ✅ Combat: three entrances over one authoritative snapshot — auto resolution, standard melee rounds, tactical hex micro-control — plus duels, critical/counter/chain chains, cooperative surrounding, tactical retreat with pursuit/interception, siege defense & gate breakout, move-then-charge with unique-skill synergy, weather effects and cast skills, usage-based proficiency.
- ✅ 27 interlocking systems incl. merit ranks, treasure equipment, relations web, skill trees, mandate/popular will, faction politics & fame, hegemony→king line, L1–L3 ploys/policies, farming colonies and hostage-family treatment.
- ✅ Dual run modes: online (Express + SQLite authority) and fully offline in-browser (authoritative engines embedded in a Web Worker, Session 372), published to GitHub Pages on every push to `main`.

## Next — harden and widen what ships

- Clear remaining combat debts: terrain visibility rules and multi-army retreat coordination.
- Widen offline endpoint coverage (melee, commandery battlefields, grand strategist, skill trees, relations queries) so offline parity matches online.
- Add PWA precache so the hosted build cold-starts fully offline; keep CI verification-first (every slice lands with its own verify script).
- Browser click-through acceptance for battle views as environments allow; keep honest scope notes per session.
- Improve accessibility, error recovery, and contributor onboarding.

Exit criteria: a new contributor can install, validate, play online or offline from a clean checkout, and every gameplay slice carries a reproducible verification script.

## Later — 0-B data and system expansion (paused, needs re-authorization)

- Clear the performance and state-management debt listed in `docs/12-system-map.md` (D-0B-1~13).
- Expand cities, officers, units, formations, skills, items, events, and scenarios only through validated schemas (1000+ officers, 105 cities, 27 formations, 21 unit types, full scenario set).
- Complete historical sourcing and provenance review for expanded datasets.
- Deepen AI, diplomacy, siege, private-retinue, farming-colony, and tournament systems.

Exit criteria: full-scale data loads and advances turns within agreed performance budgets without weakening validation or source provenance.

## Non-goals for the current milestone

- Claiming a finished or historically exhaustive game.
- Publishing unstable framework packages before module boundaries and APIs settle.
- Bulk-generating data before the architecture and tests are ready.
- Using proprietary game art, commercial fonts, or unverified media assets.

## How to help

High-value contributions today include tests, verification scripts, data-schema review, documentation corrections, accessibility improvements, and small isolated fixes. See `CONTRIBUTING.md` before proposing a larger system.
