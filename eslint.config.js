import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,js}'],
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'fetch is forbidden in src/ (04_TRD §9 security rule).',
        },
        {
          name: 'XMLHttpRequest',
          message: 'XMLHttpRequest is forbidden in src/ (04_TRD §9 security rule).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: 'innerHTML is forbidden in src/ (04_TRD §9 security rule).',
        },
        {
          selector: "CallExpression[callee.name='Function']",
          message: 'Function constructor is forbidden (04_TRD §9 security rule).',
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'rulesets-src/**', 'coverage/**'],
  }
);
