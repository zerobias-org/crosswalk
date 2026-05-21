# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Monorepo of ZeroBias **crosswalk** artifacts — element-to-element mappings between two compliance frameworks. Each `package/<vendor>/<suite>/<versionPair>/` directory is one publishable crosswalk (e.g. `aiuc/aiuc_1/v1_csa_aicm_v1` maps AIUC-1 v1 ✕ CSA AICM v1).

On the **gradle + zbb publish reusable workflow** pipeline. Lerna/nx removed. Sibling reference repos: `org/vendor`, `org/suite`, `org/product`, `org/framework`, `org/standard`.

## Development Commands

```bash
./gradlew :<vendor>:<suite>:<versionPair>:validateContent   # file-shape only
./gradlew :<vendor>:<suite>:<versionPair>:gate              # full gate
./gradlew validateUniqueIds                                 # repo-wide id cross-cut
```

`gate` writes `gate-stamp.json` (publish preflight requires it). `testIntegrationDataloader` runs against an ephemeral Neon branch (skipped locally without `NEON_*`).

## Package Structure & Naming

Depth 3. The `<versionPair>` segment is a compound key: `<srcVer>_<tgtVendor>_<tgtSuite>_<tgtVer>`.

| | value |
|---|---|
| dir | `package/<vendor>/<suite>/<versionPair>/` → `aiuc/aiuc_1/v1_csa_aicm_v1` |
| npm `name` | `@zerobias-org/crosswalk-<vendor>-<suite>-<versionPair>` — **segments verbatim** |
| `zerobias.package` | `<vendor>.<suite>.<versionPair>.crosswalk` — **hyphens normalized** |

**Hyphen normalization** (the dataloader key must match `^[\d_a-z]+$`, no hyphens) is position-dependent, mirroring the source each segment references:
- **vendor / suite** → hyphens **stripped** (mirrors the parent suite code, e.g. suite `nist/800-53` → `nist.80053`; here `800-218` → `800218`)
- **versionPair** → hyphens and dots → **underscores** (the compound key is underscore-delimited, so an embedded framework ref `nist_800-171_rev2` → `nist_800_171_rev2`)

The npm name keeps everything verbatim; only `zerobias.package` normalizes. The validator (`build.gradle.kts`) enforces both.

### Required files per package
- `index.yml` — crosswalk metadata
- `mappings/*.yml` — the element-to-element mappings (each with a unique `id`)
- `package.json`, `.npmrc`, `build.gradle.kts` (`plugins { id("zb.content") }`), `gate-stamp.json`

## Validator philosophy

Dataloader is the source of truth for schema rules. The gate validator only enforces what it can't see: (1) filesystem ↔ npm-name ↔ `zerobias.package` triangulation with the hyphen normalization above, and (2) repo-wide unique `id` UUIDs across `index.yml` + every `mappings/*.yml`.

## Migrating packages

`/migrate-packages` — see `.claude/skills/migrate-packages/SKILL.md`.

## Branches & commits

`main` canonical; `dev`/`qa`/`uat` synced downstream. [Conventional Commits](https://www.conventionalcommits.org/), commitlint-enforced. Scope: `crosswalk-<vendor>-<suite>-<versionPair>`.

## CI/CD

`.github/workflows/publish.yml` wraps `zerobias-org/devops/.github/workflows/zbb-publish-reusable.yml@main` (detect → version → publish matrix → update-bundle → sync).

## Related Documentation

- [Root CLAUDE.md](../../CLAUDE.md)
- [org/framework/CLAUDE.md](../framework/CLAUDE.md) / [org/standard/CLAUDE.md](../standard/CLAUDE.md) — the artifacts crosswalks map between
- [com/platform/dataloader/CLAUDE.md](../../com/platform/dataloader/CLAUDE.md)
