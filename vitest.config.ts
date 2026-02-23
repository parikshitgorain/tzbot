import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@config': resolve(__dirname, './src/config'),
      '@core': resolve(__dirname, './src/core'),
      '@managers': resolve(__dirname, './src/managers'),
      '@commands': resolve(__dirname, './src/commands'),
      '@services': resolve(__dirname, './src/services'),
      '@systems': resolve(__dirname, './src/systems'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
});
