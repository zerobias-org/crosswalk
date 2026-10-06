# SCF STRM Crosswalk Updater

Private (`"private": true`, no gradle marker, never published) generator for the SCF
crosswalks: one package per focal document, `package/scf/scf/<scfVer>_<code>/`, mapping
the focal document's elements onto SCF controls, built from the SCF Council's **Excel STRM
bundle** (Set Theory Relationship Mapping, one `scf-strm-<focal document id>.xlsx` per
focal document).

## Run

```bash
cd package/scf/scf/update
npm install
aws s3 sync s3://lrojas-bucket/strm/<scf version>/ <bundle dir>      # the paid bundle
NPM_TOKEN=$(gh auth token) npm run update -- --bundle <bundle dir> \
  --config <repo>/package/scf/scf/update/crosswalks.yml [--only <code>...] [--dry]
```

Then gate each written package in the target repo:
`./gradlew :scf:scf:<scfVer>_<code>:gate`. `NPM_TOKEN` (`read:packages`) is needed to
fetch `@auditlogic` framework packages.

**Where packages go is the config's job.** Each config has a `target` block (npm scope,
registry, repository), and packages are written next to it:
`<repo>/package/scf/scf/<scfVer>_<code>/`. A crosswalk of a restricted-license framework
must be generated into `auditlogic/crosswalk` (licensing placement rule), from the config
that lives there. As of 2026-10, every SCF crosswalk is generated there, and this repo's
`crosswalks.yml` is empty.

**The bundle must never be committed, to any repo.** The Excel STRMs are a paid
download (the "EXCEL STRM BUNDLE" at securecontrolsframework.com). Every version we
hold is in the private, KMS-encrypted `s3://lrojas-bucket/strm/<version>/`. The free
PDFs are not machine-readable enough. The SCF version comes from the bundle: every
STRM's "Reference Document" cell names it.

## Files

| File | Role |
|---|---|
| `crosswalks.yml` | This repo's config: `target`, and one entry per crosswalk (focal document id, `sourceStandard`, `sourceDependency`, optional `blocked` reason). Empty for now |
| `index.ts` | CLI, per-crosswalk build and validation, package writer |
| `strm.ts` | Reads one STRM workbook |
| `frameworks.ts` | Fetches framework packages from the registry (`npm pack`, cached in `cache/`) and resolves element ids |
| `strm-report.json` | Last run's per-crosswalk result (git-ignored) |

## Verbatim, or not at all

The mapping data is CC BY-ND 4.0. `NOTICE.md` states it is reproduced verbatim,
with nothing added, removed, edited or re-scored. So the tool never drops a mapping
to make a package fit. A crosswalk is **blocked** (not written), with the reason in
the report, when:

- `crosswalks.yml` marks it `blocked`. The source framework is a different edition
  than the one the STRM maps. Element ids often still match across editions, so
  resolution alone cannot catch this.
- An FDE # does not resolve to an element of the source framework package. The
  dataloader would fail the whole package on it anyway.

It is an **error** (exit 1) when a row is malformed: an unknown relationship, an SCF #
that is not in `framework-scf-scf-<ver>`, a strength outside 0–10, the same pair
listed twice with different relationship/strength, or two different FDE spellings
resolving to one element.

Rows that are not mappings are skipped: `No Relationship`, or no SCF #.

## Conflicting rows (decision 2026-10-06)

SCF's own STRMs occasionally list one pair twice with different values (2026.3: NIS2
Annex `6.2.3 → TPM-14`, SP 800-218 `PW.4.4 → TDA-21.4`). The tool keeps the row with
the **highest strength**, then the strongest relationship (equals > subset/superset >
intersects). It reports every resolution (`conflict resolved: …` and `conflicts` in
`strm-report.json`). A crosswalk with a resolution is not strictly verbatim, so say so in
its PR.

When a STRM uses two spellings for one element (2026.3 MARS-E: `CA-7.1` and `CA-7(1)`),
declare it on the entry with `sameFde: { <spelling>: <spelling to load> }`. The rows then
merge, and repeated pairs follow the rule above. Never add a `sameFde` entry to make an
unrelated element resolve: that changes the mapping data.

## Element id resolution

STRMs and our framework packages spell elements differently: SP 800-53 writes
`AC-02(01)` where we have `AC-2(1)`, and Spain Decree 311 writes `Article 10(1)`
where we have `Article 10.1`. `frameworks.ts` tries these in order:

1. exact `externalId`
2. exact alias
3. whitespace and case
4. leading zeros
5. parentheses as dots

At each step it accepts only a **unique** match. On top of that, within one STRM no
two different FDE spellings may land on the same element. 2026.3 MARS-E lists both
`CA-7.1` and `CA-7(1)`, and rule 5 maps both onto `CA-7(1)`.

## The bundle is not uniform (2026.3)

- The FD→SCF table is the **first** sheet with an `FDE#` header, not the last. 11
  workbooks have SCF→FD, Assessment Objectives and ERL tabs after it. The previous
  tool (`auditlogic/crosswalk/tool`) read the last sheet.
- Headers vary: `FDE#` / `FDE #` / `CMMC FDE#`, newlines vs spaces, typos
  (`Legecy SCF #`), a stray `▪`, and `(optional)` or framework-specific suffixes.
- `general-nist-800-53-r4` and `general-shared-assessments-sig-2025` are not in the
  bundle.

## Ids

A re-run for the same SCF release keeps every id: the `index.yml` id, the version id,
and each mapping's id, keyed by (source, target). `package.json` is written only on
creation, because the publish workflow owns `version` afterwards. A new SCF release
writes new packages. The previous release's packages stay as they are; they target
that release's framework.
