// @ts-check
import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  // ── Next.js rules (React, React-Hooks, jsx-a11y, @next/next) ───────────────
  ...coreWebVitals,

  // ── @typescript-eslint/recommended on top ──────────────────────────────────
  ...nextTypescript,

  // ── Project-wide rule overrides ────────────────────────────────────────────
  {
    rules: {
      // Disable the base rule — the TypeScript-aware version below handles it
      "no-unused-vars": "off",

      // react-hooks/refs (v7) is overly broad: it flags useState values that
      // happen to be returned alongside refs from the same custom hook.
      // Downgrade from error to warn until the rule matures.
      "react-hooks/refs": "warn",

      // ── TypeScript ──────────────────────────────────────────────────────────

      // Require `import type` for type-only imports (keeps the JS bundle clean,
      // matches the pattern already used throughout this codebase).
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],

      // Catch unused variables; leading _ suppresses the rule (e.g. _err).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Downgrade any to a warning — it's occasionally unavoidable at boundary
      // types (e.g. better-sqlite3 raw row maps).
      "@typescript-eslint/no-explicit-any": "warn",

      // Warn on non-null assertions; prefer explicit null checks when feasible.
      "@typescript-eslint/no-non-null-assertion": "warn",

      // ── General ─────────────────────────────────────────────────────────────

      // Keep console.warn / console.error for server-side error reporting;
      // ban console.log which tends to be debugging noise.
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Strict equality everywhere except null comparisons (x == null catches
      // both null and undefined which is idiomatic).
      eqeqeq: ["error", "always", { null: "ignore" }],

      // { foo } over { foo: foo }
      "object-shorthand": "error",

      // Template literals over string concatenation
      "prefer-template": "error",

      // Ban var
      "no-var": "error",

      // Prefer const; let only when the variable is actually reassigned
      "prefer-const": "error",
    },
  },

  // ── Relaxed rules for test files ───────────────────────────────────────────
  {
    files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: {
      // Non-null assertions are idiomatic in tests after expect().not.toBeNull()
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // ── Relaxed rules for plain JS utility scripts ─────────────────────────────
  {
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },

  // ── Global ignores ─────────────────────────────────────────────────────────
  {
    ignores: [".next/**", "node_modules/**"],
  },
];
