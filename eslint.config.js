import { defineConfig } from '@tofrankie/eslint'

export default defineConfig({
  ignores: ['node_modules', 'dist', '**/*.md'],
  typescript: true,
  rules: {
    'e18e/prefer-static-regex': 'off',
    'regexp/no-super-linear-backtracking': 'off',
  },
})
