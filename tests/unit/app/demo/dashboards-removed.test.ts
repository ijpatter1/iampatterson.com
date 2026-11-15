/**
 * 17.1 removed the shop's dashboards: the analytics page, the confirmation
 * page's Metabase embed and the warmup that primed it. Metabase itself is
 * being retired (18.10), and its embedding secret was exposed in the 2026-09
 * compromise, so nothing in the site may sign an embed with it, send a
 * visitor to the BI host, or keep shipping the chart and JWT libraries the
 * dashboards needed.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const SRC = path.join(ROOT, 'src');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js|jsx|mjs|css)$/.test(entry.name) ? [full] : [];
  });
}

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles(SRC)
    .filter((f) => pattern.test(fs.readFileSync(f, 'utf-8')))
    .map((f) => path.relative(ROOT, f));
}

describe('the shop without its dashboards (17.1)', () => {
  it('reads neither Metabase embedding env var anywhere in src/', () => {
    expect(filesMatching(/MB_EMBEDDING_SECRET_KEY|METABASE_EMBED_CONFIG/)).toEqual([]);
  });

  it('names the BI host nowhere in src/', () => {
    expect(filesMatching(/bi\.iampatterson\.com/)).toEqual([]);
  });

  it('no longer depends on the chart and JWT libraries only the dashboards used', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of ['recharts', 'jsonwebtoken', '@types/jsonwebtoken']) {
      expect(deps).not.toHaveProperty([name]);
    }
  });
});
