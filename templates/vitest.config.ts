import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // TODO: tune thresholds as the project matures. Start strict.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.config.{ts,js}',
        '**/*.generated.{ts,css}',
        'src/__tests__/**',
        // Add per-project exclusions in docs/coverage-exclusions.md
        // and reference them here.
      ],
    },
    // Emulator-suite tests run via npm run test:emulator (separate vitest run).
    // Exclude from the default discovery to keep `npm test` fast.
    exclude: [
      'node_modules/**',
      'dist/**',
      'src/lib/firebase/__tests__-emulator/**',
      'e2e/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
