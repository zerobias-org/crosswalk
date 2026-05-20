---
name: migrate-packages
description: Migrate the next batch of crosswalk packages onto the gradle pipeline. Drops per-package build.gradle.kts marker, ensures .npmrc, runs full ./gradlew :<path>:gate (writes gate-stamp.json), fixes drift, major-bumps the version, commits per-package.
argument-hint: "[<vendor>/<suite>/<versionPair>...] [--batch=N] [--dry-run]"
---

# Migrate Crosswalk Packages

Per-repo companion to `/migrate-content-to-zbb`. Migrate crosswalk packages one at a time within `org/crosswalk`.

**Depth 3** (`package/<vendor>/<suite>/<versionPair>/`):

| Path | Sample | npm name | `zerobias.package` |
|---|---|---|---|
| `package/<v>/<s>/<vp>/` | `aiuc/aiuc_1/v1_csa_aicm_v1` | `@zerobias-org/crosswalk-<v>-<s>-<vp>` | `<v>.<s>.<vp>.crosswalk` |

`<versionPair>` is a compound key (`<srcVer>_<tgtVendor>_<tgtSuite>_<tgtVer>`) kept **VERBATIM** — its internal underscores are NOT hyphenated. The npm name's only hyphens are the three separators after `crosswalk`. The validator enforces this.

## Per-package loop

1. Drop `package/<path>/build.gradle.kts` = `plugins { id("zb.content") }`.
2. Ensure `.npmrc`.
3. Run **full** `./gradlew :<v>:<s>:<vp>:gate` (writes the mandatory `gate-stamp.json`).
4. Major-bump: `1.x → 2.0.0`, `0.x → 1.0.0`, `2.x → no-op`.
5. Commit per package: `feat(crosswalk-<v>-<s>-<vp>)!: migrate to gradle pipeline (<old> → <new>)`. Stage marker + `gate-stamp.json` + `package.json` + drift fixes.

Common drift:
- **`package.json name` not verbatim** — must be `@zerobias-org/crosswalk-<v>-<s>-<vp>` with `<vp>` underscores preserved (NOT hyphenated). A handful of legacy packages hand-hyphenated the version pair; fix them to match their own `zerobias.package`.
- **`zerobias.package` mismatch** — must be `<v>.<s>.<vp>.crosswalk`.
- **`zerobias.import-artifact` must be `crosswalk`.**
- **Duplicate `id` UUID** — `:validateUniqueIds` over `index.yml` + every `mappings/*.yml`. Regenerate the duplicate.

## What NOT to do

- Do NOT hyphenate the version-pair's internal underscores in the npm name — keep verbatim (matches `zerobias.package`).
- Do NOT change `id` UUIDs except to resolve a genuine duplicate.
- Do NOT skip the major bump.

## See also

- Root `build.gradle.kts` — verbatim validator.
- `com/platform/dataloader/src/processors/.../crosswalk` — dataloader source of truth.
- `/migrate-content-to-zbb` — meta-repo bootstrap skill.
