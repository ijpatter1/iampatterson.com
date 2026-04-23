import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  // `next lint` (Next ≤15) auto-ignored non-app directories. The Next 16
  // migration to `eslint .` walks the entire repo, so we reinstate those
  // exclusions explicitly. The input-artifact directories under docs/ hold
  // standalone design prototypes (raw .jsx, no TS, no repo lint posture)
  // kept as reference material; infrastructure/ is non-Next GCP config.
  {
    ignores: [
      'docs/input_artifacts/**',
      'infrastructure/**',
      'coverage/**',
      // eslint-config-next/typescript already ignores .next/, out/, build/,
      // node_modules/ (the last two by ESLint default).
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@next/next/no-before-interactive-script-outside-document': 'off',

      // `eslint-plugin-react-hooks@7` React-Compiler rules
      // (`immutability`, `purity`, `refs`, `set-state-in-effect`) run
      // at default severity (error) from eslint-config-next/core-web-vitals.
      // Phase 10a D3 preflight cleared all 31 initial violations across
      // 20 files — refactored where the React-Compiler-preferred shape
      // was a clean win, justified-disabled where the preferred shape
      // would undo load-bearing behaviour (owned-storage hydration,
      // external-signal sync, live-clock re-render, animation drivers,
      // test-fixture synchronous seeding). New violations in future
      // code fail `npm run lint` immediately.

      // The rest-sibling destructuring pattern (e.g.
      // `const { pipeline_id: _pid, ...rest } = event`) is deliberate —
      // it's how we strip a key while keeping the remainder — and it
      // also covers the `_`-prefixed convention for intentionally-unused
      // identifiers. Both idioms predated the Phase 10a upgrade; the
      // warnings only became visible because `eslint .` now walks tests/.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default config;
