# Development Roadmap

This is the public, contributor-facing roadmap for the **open-source historical strategy simulation framework**. Detailed task IDs and dependencies remain in `docs/09-roadmap.md`; system maturity is tracked in `docs/12-system-map.md`.

The roadmap is evidence-based: “implemented” means code exists and has been exercised; “designed” means documentation exists but runtime behavior may not.

## Now — stabilize the 0-A framework slice

- ✅ Restore the campaign regression suite to a fully green baseline and add it to default CI (62 deterministic assertions).
- ✅ Define versioned save envelopes, migration validation, and deterministic continuation boundaries before implementing persistence. All action-resolution randomness uses the authoritative serializable PRNG; S15 military action/target choices now use it as well.
- ✅ Complete the BF-P0 historical-geography contract for the 190 CE Nanjun prototype, including strict schemas, sourced data, and the strategic-node/county boundary rule.
- Establish reproducible 30-city and synthetic 0-B performance baselines before choosing optimizations.
- Expand automated coverage beyond the shared pure-function suite.
- Add reproducible engine checks to the default CI workflow.
- ✅ Connect strategic military AI to real CampaignArmy marching, siege, battle resolution, diplomacy filtering, and war reports.
- Implement BF-P1: enter the static Nanjun battlefield, march between historical county nodes, resolve a local encounter, and write the result back exactly once.
- Replace remaining instant or hard-coded campaign calculations with explicit turn-based rules.
- Improve contributor onboarding, issue triage, and public maintenance workflows.

Exit criteria: a new contributor can install, validate, run, and exercise the documented demo path from a clean checkout; core engine regressions run in CI.

The evidence-based hardening gates and rejected premature optimizations are documented in `docs/20-architecture-hardening-audit.md`.

## Next — persistence and distributable demo

- Implement production save/load persistence and UI on top of the documented v1 envelope and validated in-memory restore contract.
- Add import/export and migration rules for saved state.
- Produce a reproducible hosted or packaged demo.
- Publish the first tagged pre-release with release notes and known limitations.
- Improve accessibility, error recovery, and cross-platform UI behavior.

Exit criteria: users can try a stable demo, preserve a session, and report issues against a named version.

## Later — 0-B data and system expansion

- Clear the performance and state-management debt listed in `docs/12-system-map.md`.
- Expand cities, officers, units, formations, skills, items, events, and scenarios only through validated schemas.
- Complete historical sourcing and provenance review for expanded datasets.
- Deepen AI, diplomacy, siege, private-retinue, farming-colony, and tournament systems.

Exit criteria: full-scale data loads and advances turns within agreed performance budgets without weakening validation or source provenance.

## Non-goals for the current milestone

- Claiming a finished or historically exhaustive game.
- Publishing unstable framework packages before module boundaries and APIs settle.
- Bulk-generating data before the 0-A architecture and tests are ready.
- Using proprietary game art, commercial fonts, or unverified media assets.

## How to help

High-value contributions today include tests, verification scripts, data-schema review, documentation corrections, accessibility improvements, and small isolated fixes. See `CONTRIBUTING.md` before proposing a larger system.
