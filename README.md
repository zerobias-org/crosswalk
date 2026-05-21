# Crosswalk monorepo

ZeroBias crosswalk artifacts — element-to-element mappings between two compliance frameworks. Each `package/<vendor>/<suite>/<versionPair>/` directory is one publishable crosswalk (e.g. `aiuc/aiuc_1/v1_csa_aicm_v1` maps AIUC-1 v1 ✕ CSA AICM v1).

## Authentication

Set `ZB_TOKEN` in your environment to authenticate with the npm registry. Get one from [ZeroBias](https://app.zerobias.com).

## Build & validate

This repo is on the gradle + [zbb](https://github.com/zerobias-org/devops) publish pipeline.

```bash
./gradlew :<vendor>:<suite>:<versionPair>:validateContent   # file-shape only
./gradlew :<vendor>:<suite>:<versionPair>:gate              # full gate (writes gate-stamp.json)
```

## Naming

Crosswalks are depth 3. The `<versionPair>` 3rd segment is a compound key (`<srcVer>_<tgtVendor>_<tgtSuite>_<tgtVer>`).

- dir: `package/<vendor>/<suite>/<versionPair>/` → `aiuc/aiuc_1/v1_csa_aicm_v1`
- npm: `@zerobias-org/crosswalk-<vendor>-<suite>-<versionPair>` — **segments kept verbatim** (underscores/hyphens preserved)
- `zerobias.package`: `<vendor>.<suite>.<versionPair>.crosswalk` — **hyphens normalized** (the dataloader key must be hyphen-free): vendor/suite hyphens are stripped (`800-218`→`800218`), versionPair hyphens/dots become underscores (`...800-171...`→`...800_171...`)

## Creating a new crosswalk

```bash
sh scripts/createNewCrosswalk.sh ...   # see script usage
```

Then fill `index.yml` + `mappings/`, drop the gradle marker (`echo 'plugins { id("zb.content") }' > package/<v>/<s>/<vp>/build.gradle.kts`), and `./gradlew :<v>:<s>:<vp>:gate`.

## Publishing

`.github/workflows/publish.yml` invokes `zerobias-org/devops/.github/workflows/zbb-publish-reusable.yml@main` on push to `main`/`qa`/`dev`/`uat`.

## Commit format

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint. Scope: `crosswalk-<vendor>-<suite>-<versionPair>`.
