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
      include: ['src/**/*.ts'],
      exclude: [
        // Entry point — not unit-testable
        'src/index.ts',
        // Infrastructure / external service wrappers that require live connections
        'src/core/cache/redis.client.ts',
        'src/services/google-safe-browsing/client.ts',
        'src/services/pusher/client.ts',
        'src/services/kick/chat-client.ts',
        'src/services/kick/client.ts',
        // Example / demo files
        'src/**/*.example.ts',
        'src/**/example.ts',
        // Type-only files (no logic)
        'src/types/**',
        'src/services/pusher/types.ts',
        'src/services/kick/types.ts',
        'src/moderation/rate-limiter/types.ts',
        'src/config/types.ts',
        // Index barrel files (only re-exports)
        'src/core/cache/index.ts',
        'src/core/discord/index.ts',
        'src/core/database/index.ts',
        'src/core/database/repositories/index.ts',
        'src/core/health/index.ts',
        'src/config/index.ts',
        'src/services/kick/index.ts',
        'src/services/pusher/index.ts',
        'src/moderation/index.ts',
        // Config manager does file watching — requires filesystem
        'src/config/config-manager.ts',
        // Large orchestrators that require integration environment
        'src/core/database/Database.ts',
        'src/core/database/pool.ts',
        'src/core/database/migrator.ts',
        'src/core/discord/client.ts',
        'src/core/health/**',
        'src/core/shutdown/**',
        'src/core/state/**',
        'src/core/data-retention/**',
        'src/managers/**',
        'src/commands/**',
        'src/webhooks/**',
        // AI modules - external service integrations requiring live connections
        'src/ai/**',
        'src/giveaway/confirmation-system.ts',
        'src/giveaway/message-listener.ts',
        'src/giveaway/reroll-handler.ts',
        'src/services/kick/role-sync.ts',
        'src/services/kick/user-linking.ts',
        'src/utils/health-check.ts',
        'src/core/security/rate-limiter.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
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
