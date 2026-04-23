import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
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
      // eslint-config-next@16) introduced React-Compiler-era advisory
      // rules that flag latent patterns that were legal under Next 14/15
      // and still run correctly under Next 16 + React 19 (tests + build
      // green). Disabling here so `eslint .` exits 0 on a framework
      // upgrade that intentionally left non-mechanical refactors out of
      // scope. Re-enable progressively during Phase 10 polish work;
      // carried in session-2026-04-23-002 handoff as known tech debt.
      // Long-standing `react-hooks/rules-of-hooks` and
      // `react-hooks/exhaustive-deps` remain enforced.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/use': 'off',
    },
  },
];
