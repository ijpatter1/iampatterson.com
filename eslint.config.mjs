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

      // Phase 10a D3 React-Compiler preflight: `eslint-plugin-react-hooks@7`
      // (via `eslint-config-next@16`) introduces four rules flagging
      // patterns React 19 discourages. Running at `warn` during the
      // fix-up work so `npm run lint` still exits 0 while progress is
      // visible. Once all call sites are either refactored or carry an
      // explicit `eslint-disable-next-line` with a rationale comment,
      // these entries are removed entirely so the rules fall back to
      // their default severity (error) from eslint-plugin-react-hooks.
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',

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
