import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    name: 'action',
    entry: ['src/action.ts'],
    format: ['esm'],
    platform: 'node',
    target: 'node24',
    dts: true,
    clean: true,
  },
  {
    name: 'npm',
    entry: ['src/index.ts', 'src/cli.ts'],
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    dts: true,
    clean: true,
  },
])
