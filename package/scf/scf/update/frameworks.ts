// Framework packages are fetched from the registry (npm pack, cached under cache/) so the
// element ids a crosswalk references are checked against what the dataloader will load.
// The dataloader resolves sourceElement/targetElement by alias or externalId and fails the
// whole package on a miss — so every id is resolved here first.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import yml from 'js-yaml';

const CACHE = path.join(process.cwd(), 'cache');

export interface Framework {
  name: string;
  version: string;
  externalIds: Set<string>;
  aliases: Map<string, string>;   // alias -> externalId (the dataloader resolves aliases too)
}

export function fetchFramework(pkg: string): Framework {
  const version = execFileSync('npm', ['view', `${pkg}@latest`, 'version'], { encoding: 'utf8' }).trim();
  const dir = path.join(CACHE, `${pkg.replace('/', '+')}@${version}`);
  if (!fs.existsSync(path.join(dir, 'package'))) {
    fs.mkdirSync(dir, { recursive: true });
    const tgz = execFileSync('npm', ['pack', `${pkg}@${version}`, '--pack-destination', dir, '--silent'], { encoding: 'utf8' }).trim().split('\n').pop()!;
    execFileSync('tar', ['-xzf', path.join(dir, tgz), '-C', dir]);
  }
  const elementsDir = path.join(dir, 'package', 'elements');
  const externalIds = new Set<string>();
  const aliases = new Map<string, string>();
  for (const f of fs.existsSync(elementsDir) ? fs.readdirSync(elementsDir) : []) {
    if (!f.endsWith('.yml')) continue;
    const e = yml.load(fs.readFileSync(path.join(elementsDir, f), 'utf8')) as Record<string, unknown> | undefined;
    if (!e || e.deprecate === true || e.skip === true || typeof e.externalId !== 'string') continue;
    externalIds.add(e.externalId);
    for (const a of Array.isArray(e.aliases) ? e.aliases : []) {
      if (typeof a !== 'string') continue;
      // an alias shared by two elements resolves to neither
      aliases.set(a, aliases.has(a) && aliases.get(a) !== e.externalId ? '' : e.externalId);
    }
  }
  if (externalIds.size === 0) throw new Error(`${pkg}@${version}: no elements`);
  return { name: pkg, version, externalIds, aliases };
}

// STRMs and our framework packages spell the same element differently (SP 800-53
// `AC-02(01)` vs `AC-2(1)`; Spain Decree 311 `Article 10(1)` vs `Article 10.1`). Each rule
// rewrites both sides; an FDE resolves at the first rule under which it matches exactly ONE
// element, so a looser rule can never pick between two candidates.
const RULES: [string, (s: string) => string][] = [
  ['exact', s => s],
  ['whitespace/case', s => s.replace(/\s+/g, ' ').trim().toLowerCase()],
  ['leading zeros', s => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|[^\d])0+(\d)/g, '$1$2')],
  ['parens as dots', s => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|[^\d])0+(\d)/g, '$1$2').replace(/\s*\(([^()]+)\)/g, '.$1')]
];

export class Resolver {
  private readonly indexes: Map<string, string[]>[];
  readonly used = new Map<string, number>();

  private readonly claimed = new Map<string, string>();   // element -> the FDE spelling that resolved to it

  constructor(ids: Iterable<string>, private readonly aliases: Map<string, string> = new Map()) {
    this.indexes = RULES.map(([, f]) => {
      const m = new Map<string, string[]>();
      for (const id of ids) {
        const k = f(id);
        m.set(k, [...(m.get(k) ?? []), id]);
      }
      return m;
    });
  }

  // Within one STRM two different FDE spellings must never land on the same element: that
  // would merge two source rows (2026.3 MARS-E lists both `CA-7.1` and `CA-7(1)`; the
  // parens-as-dots rule maps both onto `CA-7(1)`). Returns { collision } instead.
  resolve(id: string): string | { collision: string } | undefined {
    const hit = this.lookup(id);
    if (!hit) return undefined;
    const owner = this.claimed.get(hit);
    if (owner !== undefined && owner !== id) return { collision: `"${owner}" and "${id}" both resolve to ${hit}` };
    this.claimed.set(hit, id);
    return hit;
  }

  private lookup(id: string): string | undefined {
    for (let i = 0; i < RULES.length; i++) {
      if (i === 1) {   // after an exact externalId, before any normalization: an exact alias
        const alias = this.aliases.get(id);
        if (alias) {
          this.used.set('alias', (this.used.get('alias') ?? 0) + 1);
          return alias;
        }
      }
      const hits = this.indexes[i].get(RULES[i][1](id));
      if (hits?.length === 1) {
        this.used.set(RULES[i][0], (this.used.get(RULES[i][0]) ?? 0) + 1);
        return hits[0];
      }
      if (hits && hits.length > 1) return undefined;   // ambiguous: never guess
    }
    return undefined;
  }
}
