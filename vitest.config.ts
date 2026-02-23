import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/example.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config'),
      '@core': path.resolve(__dirname, './src/core'),
      '@managers': path.resolve(__dirname, './src/managers'),
      '@commands': path.resolve(__dirname, './src/commands'),
      '@services': path.resolve(__dirname, './src/services'),
      '@systems': path.resolve(__dirname, './src/systems'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@moderation': path.resolve(__dirname, './src/moderation'),
      '@webhooks': path.resolve(__dirname, './src/webhooks'),
      '@giveaway': path.resolve(__dirname, './src/giveaway'),
    },
  },
});
