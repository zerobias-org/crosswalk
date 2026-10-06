// Generates SCF STRM crosswalk packages — package/scf/scf/<scfVer>_<code>/ — from the
// SCF Council's Excel STRM bundle (one scf-strm-<focal document>.xlsx per focal document).
//
//   npm run update -- --bundle <dir> [--only <code>...] [--dry]
//
// The bundle is a paid download and is NOT in this (public) repo; pass its local path.
// The mapping data is CC BY-ND 4.0 (see NOTICE.md): it is reproduced verbatim. A
// crosswalk with any mapping the tool cannot reproduce exactly — an element id that does
// not resolve in the framework package, an unknown relationship, a conflicting duplicate —
// is BLOCKED and not written. Nothing is dropped to make a package fit, except rows whose
// FDE # the config lists in `dropFde` (elements the framework retired).
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import yml from 'js-yaml';
import { readStrm, StrmRow } from './strm.js';
import { fetchFramework, Framework, Resolver } from './frameworks.js';

// Where packages are written, and how they are named, comes from the config's `target`
// block. Crosswalks of restricted-license frameworks belong in the private auditlogic repo
// (licensing placement rule); their config lives there, not here — pass it with --config.
interface Target {
  npmScope: string;      // e.g. @zerobias-org
  registry: string;      // publishConfig.registry
  repository: string;    // git url for package.json repository.url
}
let PACKAGE_ROOT = '';   // <repo>/package/scf/scf
let REPO_ROOT = '';
let TARGET: Target;

const RELATIONSHIP: Record<string, string> = {
  'Intersects With': 'intersects',
  'Subset Of': 'subset_of',
  'Superset Of': 'superset_of',
  'Equal': 'equals'
};

interface CrosswalkConfig {
  code: string;
  focalDocument: string;
  sourceName: string;
  sourceStandard: string;
  sourceDependency: string;
  blocked?: string;
  // FDE spellings the STRM uses for one element, mapped onto the spelling to load. A
  // per-crosswalk decision (2026.3 MARS-E lists `CA-7.1` and `CA-7(1)` for one control);
  // the rows then merge, and any pair listed twice follows the highest-strength rule.
  sameFde?: Record<string, string>;
  // FDE #s whose rows are left out on purpose (e.g. elements the framework retired).
  dropFde?: string[];
}

// Rank for the tie-break when two rows of one pair carry the same strength.
const RELATIONSHIP_RANK: Record<string, number> = { equals: 3, subset_of: 2, superset_of: 2, intersects: 1 };

interface Mapping {
  id: string;
  sourceElement: string;
  targetElement: string;
  relationshipType: string;
  strengthOfRelationship?: number;
}

interface Result {
  code: string;
  status: 'written' | 'unchanged' | 'blocked' | 'error';
  reason?: string;
  mappings?: number;
  skipped?: number;
  duplicates?: number;
  dropped?: number;
  resolution?: Record<string, number>;
  unresolved?: string[];
  conflicts?: string[];   // pairs listed twice with different values, and which row was kept
  package?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function args(name: string): string[] {
  const i = process.argv.indexOf(name);
  if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < process.argv.length && !process.argv[j].startsWith('--'); j++) out.push(process.argv[j]);
  return out;
}

const dump = (o: unknown) => yml.dump(o, { indent: 2, lineWidth: -1, noRefs: true });
const readYaml = <T>(f: string): T | undefined => (fs.existsSync(f) ? (yml.load(fs.readFileSync(f, 'utf8')) as T) : undefined);

async function build(cfg: CrosswalkConfig, bundle: string, scfVersion: string, scf: Framework, dry: boolean): Promise<Result> {
  if (cfg.blocked) return { code: cfg.code, status: 'blocked', reason: cfg.blocked };

  const file = path.join(bundle, `scf-strm-${cfg.focalDocument}.xlsx`);
  if (!fs.existsSync(file)) return { code: cfg.code, status: 'blocked', reason: `bundle has no ${path.basename(file)}` };

  const sheet = await readStrm(file);
  if (sheet.scfVersion !== scfVersion) {
    return { code: cfg.code, status: 'error', reason: `${path.basename(file)} references SCF ${sheet.scfVersion || '(none)'}, bundle is ${scfVersion}` };
  }

  const source = fetchFramework(cfg.sourceDependency);
  const sourceIds = new Resolver(source.externalIds, source.aliases);
  const errors: string[] = [];
  const unresolved = new Set<string>();
  const mappings: Omit<Mapping, 'id'>[] = [];
  const seen = new Map<string, number>();   // pair -> index in mappings
  const conflicts: string[] = [];
  let skipped = 0;
  let duplicates = 0;
  let dropped = 0;
  const drop = new Set(cfg.dropFde ?? []);

  for (const row of sheet.rows) {
    const where = `${row.fde || '(no FDE #)'} → ${row.scf || '(no SCF #)'}`;
    if (row.relationship === 'No Relationship') {
      if (row.scf && row.scf !== 'N/A') errors.push(`${where}: "No Relationship" with an SCF control`);
      skipped++;
      continue;
    }
    // A row with no SCF control is not a mapping. Upstream occasionally shifts such a row
    // one column (2026.3 HIPAA Simplification § 164.502(a)(2)(ii)); it carries nothing.
    if (!row.scf || row.scf === 'N/A') { skipped++; continue; }

    const relationshipType = RELATIONSHIP[row.relationship];
    if (!relationshipType) { errors.push(`${where}: unknown relationship "${row.relationship}"`); continue; }
    if (!scf.externalIds.has(row.scf)) { errors.push(`${where}: SCF control not in ${scf.name}@${scf.version}`); continue; }
    if (!row.fde) { errors.push(`${where}: mapping without an FDE #`); continue; }

    let strengthOfRelationship: number | undefined;
    if (row.strength) {
      strengthOfRelationship = Number(row.strength);
      if (!Number.isInteger(strengthOfRelationship) || strengthOfRelationship < 0 || strengthOfRelationship > 10) {
        errors.push(`${where}: strength "${row.strength}"`); continue;
      }
    }

    if (drop.has(row.fde)) { dropped++; continue; }
    const fde = cfg.sameFde?.[row.fde] ?? row.fde;
    const resolved = sourceIds.resolve(fde);
    if (resolved === undefined) { unresolved.add(row.fde); continue; }
    if (typeof resolved !== 'string') { errors.push(`${where}: ${resolved.collision}`); continue; }
    const sourceElement = resolved;

    const pair = `${sourceElement}\u0000${row.scf}`;
    const candidate = { sourceElement, targetElement: row.scf, relationshipType, strengthOfRelationship };
    const at = seen.get(pair);
    if (at !== undefined) {
      duplicates++;
      const kept = mappings[at];
      const same = kept.relationshipType === relationshipType && kept.strengthOfRelationship === strengthOfRelationship;
      if (!same) {
        // Decision 2026-10-06: a pair listed twice with different values keeps the row with
        // the highest strength (then the strongest relationship). Reported, never silent.
        const better = (candidate.strengthOfRelationship ?? -1) - (kept.strengthOfRelationship ?? -1)
          || RELATIONSHIP_RANK[relationshipType] - RELATIONSHIP_RANK[kept.relationshipType];
        const win = better > 0 ? candidate : kept;
        const lose = better > 0 ? kept : candidate;
        conflicts.push(`${sourceElement} → ${row.scf}: kept ${win.relationshipType}/${win.strengthOfRelationship ?? '-'} over ${lose.relationshipType}/${lose.strengthOfRelationship ?? '-'}`);
        if (better > 0) mappings[at] = candidate;
      }
      continue;
    }
    seen.set(pair, mappings.length);
    mappings.push(candidate);
  }

  const base = { code: cfg.code, skipped, duplicates, ...(dropped ? { dropped } : {}), resolution: Object.fromEntries(sourceIds.used), ...(conflicts.length ? { conflicts } : {}) };
  if (errors.length) return { ...base, status: 'error', reason: `${errors.length} malformed row(s): ${errors.slice(0, 5).join('; ')}` };
  if (unresolved.size) {
    return {
      ...base, status: 'blocked', unresolved: [...unresolved],
      reason: `${unresolved.size} FDE #(s) not in ${source.name}@${source.version} — the framework package does not match this STRM's focal document`
    };
  }
  if (mappings.length === 0) return { ...base, status: 'blocked', reason: 'no mappings' };

  const pkg = writePackage(cfg, scfVersion, mappings, dry);
  return { ...base, status: pkg.changed ? 'written' : 'unchanged', mappings: mappings.length, package: pkg.dir };
}

function writePackage(cfg: CrosswalkConfig, scfVersion: string, rows: Omit<Mapping, 'id'>[], dry: boolean) {
  const versionKey = scfVersion.replace(/\./g, '_');
  const versionPair = `${versionKey}_${cfg.code}`;
  const dir = path.join(PACKAGE_ROOT, versionPair);
  const rel = path.relative(REPO_ROOT, dir);

  // Re-running for the same SCF release keeps every id: a new id orphans the loaded row.
  const prevIndex = readYaml<{ id: string }>(path.join(dir, 'index.yml'));
  const prevVersion = readYaml<{ id: string }>(path.join(dir, 'versions', '1.0.0.yml'));
  const prevIds = new Map<string, string>();
  for (const e of readYaml<{ elements: Mapping[] }>(path.join(dir, 'elements.yml'))?.elements ?? []) {
    prevIds.set(`${e.sourceElement}\u0000${e.targetElement}`, e.id);
  }

  const elements: Mapping[] = rows.map(r => ({ id: prevIds.get(`${r.sourceElement}\u0000${r.targetElement}`) ?? crypto.randomUUID(), ...r }));
  const name = `${cfg.sourceName} to Secure Controls Framework (SCF) ${scfVersion} Crosswalk`;
  const description = `Crosswalk mappings from ${cfg.sourceName} to the Secure Controls Framework (SCF) ${scfVersion} framework`;

  const files: Record<string, string> = {
    'index.yml': dump({
      id: prevIndex?.id ?? crypto.randomUUID(),
      name,
      description,
      externalId: name,
      code: `${cfg.code}_scf_scf_${versionKey}_crosswalk`,
      status: 'active',
      sourceStandard: cfg.sourceStandard,
      targetStandard: `scf.scf.${versionKey}.framework`
    }),
    'elements.yml': dump({ elements }),
    'versions/1.0.0.yml': dump({
      id: prevVersion?.id ?? crypto.randomUUID(),
      name,
      description,
      status: 'active',
      elements: elements.map(e => e.id)
    }),
    'build.gradle.kts': 'plugins { id("zb.content") }\n',
    '.npmrc': fs.readFileSync(path.join(REPO_ROOT, '.npmrc'), 'utf8')
  };

  // package.json: only on creation — the publish workflow owns `version` afterwards.
  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    files['package.json'] = JSON.stringify({
      name: `${TARGET.npmScope}/crosswalk-scf-scf-${versionPair}`,
      version: '1.0.0',
      description: name,
      author: 'team@zerobias.com',
      // the mapping data's license (NOTICE.md); settled in the 2026-07 licensing review
      license: 'CC-BY-ND-4.0',
      type: 'module',
      repository: { type: 'git', url: TARGET.repository, directory: `${rel}/` },
      publishConfig: { registry: TARGET.registry },
      files: ['index.yml', 'elements.yml', 'versions/**'],
      zerobias: {
        'dataloader-version': '1.0.0',
        'import-artifact': 'crosswalk',
        package: `scf.scf.${versionPair}.crosswalk`
      },
      dependencies: {
        [cfg.sourceDependency]: 'latest',
        [`@zerobias-org/framework-scf-scf-${scfVersion}`]: 'latest'
      }
    }, null, 2) + '\n';
  }

  let changed = false;
  for (const [f, content] of Object.entries(files)) {
    const p = path.join(dir, f);
    if (fs.existsSync(p) && fs.readFileSync(p, 'utf8') === content) continue;
    changed = true;
    if (!dry) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content, 'utf8');
    }
  }
  return { dir: rel, changed };
}

async function main() {
  const bundle = arg('--bundle') ?? process.env.SCF_STRM_BUNDLE;
  if (!bundle || !fs.existsSync(bundle)) {
    throw new Error('pass the Excel STRM bundle directory: npm run update -- --bundle <dir> (or SCF_STRM_BUNDLE)');
  }
  const only = args('--only');
  const dry = process.argv.includes('--dry');
  const configPath = path.resolve(arg('--config') ?? 'crosswalks.yml');
  const config = yml.load(fs.readFileSync(configPath, 'utf8')) as { target: Target; crosswalks: CrosswalkConfig[] };
  const { crosswalks } = config;
  TARGET = config.target;
  for (const k of ['npmScope', 'registry', 'repository'] as const) if (!TARGET?.[k]) throw new Error(`${configPath}: target.${k} is required`);
  // The config sits in <repo>/package/scf/scf/update/ — packages go next to it.
  PACKAGE_ROOT = path.resolve(path.dirname(configPath), '..');
  REPO_ROOT = path.resolve(PACKAGE_ROOT, '../../..');
  if (!fs.existsSync(path.join(REPO_ROOT, '.npmrc'))) throw new Error(`${REPO_ROOT}: no .npmrc — is the config in <repo>/package/scf/scf/update/?`);
  console.log(`config ${path.relative(process.cwd(), configPath) || configPath} → ${TARGET.npmScope} packages in ${PACKAGE_ROOT}`);
  if (!crosswalks?.length) throw new Error(`${configPath}: no crosswalks configured — the SCF crosswalks are generated from a private config (see CLAUDE.md)`);
  const selected = only.length ? crosswalks.filter(c => only.includes(c.code)) : crosswalks;
  if (only.length && selected.length !== only.length) throw new Error(`unknown --only code(s): ${only.filter(o => !crosswalks.some(c => c.code === o))}`);

  // Every STRM in a bundle references one SCF release; take it from the first one we read.
  const probe = selected.find(c => !c.blocked && fs.existsSync(path.join(bundle, `scf-strm-${c.focalDocument}.xlsx`)));
  if (!probe) throw new Error('nothing to generate');
  const scfVersion = (await readStrm(path.join(bundle, `scf-strm-${probe.focalDocument}.xlsx`))).scfVersion;
  if (!/^\d{4}\.\d+(\.\d+)?$/.test(scfVersion)) throw new Error(`cannot read the SCF version from the bundle (got "${scfVersion}")`);
  const scf = fetchFramework(`@zerobias-org/framework-scf-scf-${scfVersion}`);
  console.log(`SCF ${scfVersion} — targets validated against ${scf.name}@${scf.version} (${scf.externalIds.size} controls)${dry ? ' — DRY RUN' : ''}`);

  const results: Result[] = [];
  for (const cfg of selected) {
    let r: Result;
    try {
      r = await build(cfg, bundle, scfVersion, scf, dry);
    } catch (e) {
      r = { code: cfg.code, status: 'error', reason: (e as Error).message };
    }
    results.push(r);
    const detail = r.mappings !== undefined ? `${r.mappings} mappings, ${r.skipped} skipped rows${r.duplicates ? `, ${r.duplicates} duplicates` : ''}${r.dropped ? `, ${r.dropped} dropped rows` : ''}` : r.reason;
    console.log(`  ${r.status.padEnd(9)} ${cfg.code.padEnd(28)} ${detail}`);
    for (const c of r.conflicts ?? []) console.log(`            conflict resolved: ${c}`);
    if (r.unresolved) console.log(`            e.g. ${r.unresolved.slice(0, 8).join(', ')}`);
  }

  fs.writeFileSync('strm-report.json', JSON.stringify({ scfVersion, scf: `${scf.name}@${scf.version}`, results }, null, 1) + '\n');
  const count = (s: Result['status']) => results.filter(r => r.status === s).length;
  console.log(`\n${count('written')} written, ${count('unchanged')} unchanged, ${count('blocked')} blocked, ${count('error')} error — details in strm-report.json`);
  if (count('error')) process.exit(1);
}

main().catch(e => {
  console.error((e as Error).message);
  process.exit(1);
});
