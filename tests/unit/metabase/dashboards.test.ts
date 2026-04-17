/**
 * Tests for Phase 9B deliverable 6a — Metabase dashboards-as-code.
 *
 * Validates:
 * - Spec YAML files exist and parse
 * - Questions have required fields (name, display, query)
 * - Queries reference iampatterson_marts tables (not raw/staging)
 * - Dashboard references only questions we author
 * - Dashboard grid positions do not overlap
 * - apply.sh and lib/metabase_client.sh pass bash syntax check
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as yaml from 'js-yaml';

const DASHBOARDS_ROOT = path.join(process.cwd(), 'infrastructure/metabase/dashboards');
const SPECS_ROOT = path.join(DASHBOARDS_ROOT, 'specs');

interface QuestionSpec {
  name: string;
  description?: string;
  display: string;
  enable_embedding?: boolean;
  visualization_settings?: Record<string, unknown>;
  query: string;
}

interface DashboardCardRef {
  card: string;
  row: number;
  col: number;
  size_x: number;
  size_y: number;
}

interface DashboardSpec {
  name: string;
  description?: string;
  cards: DashboardCardRef[];
}

function loadQuestion(fileName: string): QuestionSpec {
  const p = path.join(SPECS_ROOT, 'questions', fileName);
  return yaml.load(fs.readFileSync(p, 'utf-8')) as QuestionSpec;
}

function loadDashboard(fileName: string): DashboardSpec {
  const p = path.join(SPECS_ROOT, 'dashboards', fileName);
  return yaml.load(fs.readFileSync(p, 'utf-8')) as DashboardSpec;
}

// ---------------------------------------------------------------------------
// Scaffold
// ---------------------------------------------------------------------------
describe('Metabase dashboards-as-code scaffold', () => {
  test('apply.sh exists and is executable', () => {
    const p = path.join(DASHBOARDS_ROOT, 'apply.sh');
    expect(fs.existsSync(p)).toBe(true);
    // eslint-disable-next-line no-bitwise
    expect(fs.statSync(p).mode & 0o111).not.toBe(0);
  });

  test('metabase_client.sh exists', () => {
    expect(fs.existsSync(path.join(DASHBOARDS_ROOT, 'lib/metabase_client.sh'))).toBe(true);
  });

  test('README.md documents auth, setup, and authoring conventions', () => {
    const readme = fs.readFileSync(path.join(DASHBOARDS_ROOT, 'README.md'), 'utf-8');
    expect(readme).toMatch(/metabase-api-key/);
    expect(readme).toMatch(/setup-domain\.sh/);
    expect(readme).toMatch(/apply\.sh/);
  });

  test('.gitignore excludes .ids.json', () => {
    const gi = fs.readFileSync(path.join(DASHBOARDS_ROOT, '.gitignore'), 'utf-8');
    expect(gi).toMatch(/^\.ids\.json/m);
  });

  test('apply.sh passes bash syntax check', () => {
    expect(() =>
      execSync(`bash -n ${path.join(DASHBOARDS_ROOT, 'apply.sh')}`, {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  test('metabase_client.sh passes bash syntax check', () => {
    expect(() =>
      execSync(`bash -n ${path.join(DASHBOARDS_ROOT, 'lib/metabase_client.sh')}`, {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Question specs
// ---------------------------------------------------------------------------
describe('Question specs', () => {
  const expectedQuestions = [
    '01_funnel_conversion_by_channel.yaml',
    '02_aov_trend_90d.yaml',
    '03_roas_by_campaign.yaml',
    '04_revenue_share_by_channel.yaml',
    '05_customer_ltv_distribution.yaml',
    '06_daily_revenue_trend.yaml',
  ];

  test('all six question specs present', () => {
    const actual = fs
      .readdirSync(path.join(SPECS_ROOT, 'questions'))
      .filter((f) => f.endsWith('.yaml'))
      .sort();
    expect(actual).toEqual(expectedQuestions);
  });

  test.each(expectedQuestions)('%s has required fields', (fileName) => {
    const q = loadQuestion(fileName);
    expect(q.name).toBeTruthy();
    expect(typeof q.name).toBe('string');
    expect(q.display).toBeTruthy();
    expect(q.query).toBeTruthy();
    expect(q.query.trim().length).toBeGreaterThan(20); // not a stub
  });

  test.each(expectedQuestions)('%s query targets iampatterson_marts', (fileName) => {
    const q = loadQuestion(fileName);
    // All queries must go through the marts layer — raw/staging bypass
    // the Dataform transformation pipeline that's part of the demo story.
    expect(q.query).toMatch(/iampatterson_marts\.mart_/);
    expect(q.query).not.toMatch(/iampatterson_raw\./);
    expect(q.query).not.toMatch(/iampatterson_staging\./);
  });

  test.each(expectedQuestions)('%s uses a recognized display type', (fileName) => {
    const q = loadQuestion(fileName);
    expect(['bar', 'line', 'pie', 'scalar', 'table', 'funnel', 'area', 'row', 'combo']).toContain(
      q.display,
    );
  });

  test('three questions are flagged for embedding (funnel, AOV, daily revenue)', () => {
    const embeddable = expectedQuestions.filter((f) => loadQuestion(f).enable_embedding === true);
    expect(embeddable.sort()).toEqual(
      [
        '01_funnel_conversion_by_channel.yaml',
        '02_aov_trend_90d.yaml',
        '06_daily_revenue_trend.yaml',
      ].sort(),
    );
  });

  test('question names are unique (names are idempotency keys)', () => {
    const names = expectedQuestions.map((f) => loadQuestion(f).name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// Dashboard spec
// ---------------------------------------------------------------------------
describe('Dashboard spec', () => {
  test('ecommerce_executive.yaml present', () => {
    expect(fs.existsSync(path.join(SPECS_ROOT, 'dashboards', 'ecommerce_executive.yaml'))).toBe(
      true,
    );
  });

  test('has required fields and references real questions', () => {
    const d = loadDashboard('ecommerce_executive.yaml');
    expect(d.name).toBeTruthy();
    expect(Array.isArray(d.cards)).toBe(true);
    expect(d.cards.length).toBeGreaterThan(0);

    const questionNames = new Set(
      fs
        .readdirSync(path.join(SPECS_ROOT, 'questions'))
        .filter((f) => f.endsWith('.yaml'))
        .map((f) => loadQuestion(f).name),
    );

    for (const card of d.cards) {
      expect(questionNames.has(card.card)).toBe(true);
      expect(typeof card.row).toBe('number');
      expect(typeof card.col).toBe('number');
      expect(typeof card.size_x).toBe('number');
      expect(typeof card.size_y).toBe('number');
      // 24-col grid
      expect(card.col).toBeGreaterThanOrEqual(0);
      expect(card.col + card.size_x).toBeLessThanOrEqual(24);
    }
  });

  test('grid positions do not overlap', () => {
    const d = loadDashboard('ecommerce_executive.yaml');
    // Project each card onto cells and ensure no cell is claimed twice.
    const claimed = new Set<string>();
    for (const c of d.cards) {
      for (let r = c.row; r < c.row + c.size_y; r += 1) {
        for (let col = c.col; col < c.col + c.size_x; col += 1) {
          const key = `${r},${col}`;
          expect(claimed.has(key)).toBe(false);
          claimed.add(key);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// URL-map path split assertion on setup-domain.sh
// ---------------------------------------------------------------------------
describe('setup-domain.sh URL-map split (deliverable 6a prerequisite)', () => {
  const setupDomain = fs.readFileSync(
    path.join(process.cwd(), 'infrastructure/metabase/setup-domain.sh'),
    'utf-8',
  );

  test('defines the non-IAP backend service name', () => {
    expect(setupDomain).toMatch(/BACKEND_DIRECT_NAME/);
  });

  test('adds a URL-map path matcher for /api/* and /embed/*', () => {
    expect(setupDomain).toMatch(/add-path-matcher/);
    expect(setupDomain).toMatch(/\/api\/\*/);
    expect(setupDomain).toMatch(/\/embed\/\*/);
  });

  test('passes bash syntax check', () => {
    expect(() =>
      execSync(`bash -n ${path.join(process.cwd(), 'infrastructure/metabase/setup-domain.sh')}`, {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
