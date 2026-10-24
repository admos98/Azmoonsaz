import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // CQ-5 fix: api/ is no longer ignored — the 3k-line serverless API is now
  // linted with a dedicated plain-JS block below (npm run lint covers both).
  { ignores: ['dist/', 'node_modules/', '*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    // CQ-5 fix: serverless API block. Plain Node ESM JavaScript — no React
    // rules, no type-aware rules. no-undef is OFF here because the file has
    // no automatic Node globals set without the `globals` package; the
    // runtime surface (console/process/URL/fetch/…) is guaranteed by the
    // Vercel Node runtime and smoke-tested by tests/server.
    files: ['api/**/*.js'],
    rules: {
      'no-undef': 'off',
      'no-console': 'off', // serverless handlers log on purpose
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          // `const { isCorrect, ...option }` — the omit idiom strips
          // teacher-only fields before persistence; the named discard is
          // documentation, not a bug.
          ignoreRestSiblings: true,
        },
      ],
      eqeqeq: ['warn', 'smart'],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Downgrade strict React 19 rules to warnings — tracked for future refactor
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-refresh/only-export-components': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'no-case-declarations': 'warn',
      'no-useless-assignment': 'warn',
    },
  },
  // ── D.7 ratchet (chrome-only Cut migration) ─────────────────────────────
  // These surfaces have migrated to <Cut>; the named glyphs may never come
  // back. The set of banned names can only GROW as more surfaces migrate —
  // lucide stays legal for glyphs that have no cut (Home, Plus, Settings …)
  // and in content files.
  {
    files: ['src/components/CommandPalette.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              importNames: ['BookOpen', 'Users', 'GraduationCap'],
              message:
                'Migrated surface — use <Cut kind="exams|students|classes"> (Art Master Plan C.1/D.7). Never re-add a lucide glyph here.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/QuestionBankHealth.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              importNames: ['BookOpen'],
              message:
                'Migrated surface — use <Cut kind="questions"> (Art Master Plan C.1/D.7).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/pages/teacher/Dashboard.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              importNames: ['BookOpen', 'CalendarDays'],
              message:
                'Migrated surface — use <Cut kind="questions|scheduled"> (Art Master Plan C.1/D.7).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/pages/teacher/SettingsHub.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              importNames: ['HelpCircle'],
              message:
                'Migrated surface — use <Cut kind="questions"> (Art Master Plan C.1/D.7).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/pages/teacher/TeacherProfile.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              importNames: ['Users', 'GraduationCap'],
              message:
                'Migrated surface — use <Cut kind="students|classes"> (Art Master Plan C.1/D.7).',
            },
          ],
        },
      ],
    },
  },
);
