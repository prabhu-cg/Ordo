import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', '.impeccable'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // UI components must never touch IndexedDB directly. Use src/storage.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'dexie', message: 'Import from @/storage; only src/storage may use Dexie.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/storage/**', 'src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  { files: ['src/components/ui/**'], rules: { 'react-refresh/only-export-components': 'off' } },
)
