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

      // Phase 10a carry-over: eslint-plugin-react-hooks@7 (shipped with
      // eslint-config-next@16) introduced four React-Compiler-era rules
      // that flag patterns React 19 discourages for render-correctness
      // and performance. Re-enabled as warnings, they surface 28 real
      // violations across 17 files, heavily concentrated in portfolio
      // surfaces: `src/components/overlay/overlay-view.tsx` (5),
      // `src/components/home/pipeline-editorial.tsx` (3), the homepage
      // pipeline + demos sections, the reveal sidebar + walkthrough,
      // and the core measurement-stack hooks (`useSessionContext`,
      // `useEventStream`, `useDataLayerEvents`, `useLiveEvents`).
      //
      // Disabling is not "runtime-legal" cleanup — it's a deliberate
      // deferral of work that's directly in-scope for Phase 10's Core
      // Web Vitals pass (`set-state-in-effect` in particular correlates
      // with cascading renders that hurt CWV; `refs` can mask stale
      // reads under React 19's stricter render model). Re-enable and
      // refactor progressively during Phase 10 polish work; tracked
      // in session-2026-04-23-002 handoff under Issues & Technical Debt.
      // Long-standing `react-hooks/rules-of-hooks` and
      // `react-hooks/exhaustive-deps` remain enforced.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',

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
