import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@quacktrack/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@quacktrack/events': fileURLToPath(new URL('./packages/events/src/index.ts', import.meta.url)),
      '@quacktrack/objects': fileURLToPath(new URL('./packages/objects/src/index.ts', import.meta.url)),
      '@quacktrack/sponsor-policy': fileURLToPath(new URL('./packages/sponsor-policy/src/index.ts', import.meta.url)),
      '@quacktrack/registry': fileURLToPath(new URL('./packages/registry/src/index.ts', import.meta.url)),
      '@quacktrack/layout': fileURLToPath(new URL('./packages/layout/src/index.ts', import.meta.url)),
      '@quacktrack/queue': fileURLToPath(new URL('./packages/queue/src/index.ts', import.meta.url)),
      '@quacktrack/analytics': fileURLToPath(new URL('./packages/analytics/src/index.ts', import.meta.url)),
      '@quacktrack/renderer': fileURLToPath(new URL('./packages/renderer/src/index.ts', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'configs/**/*.test.ts'],
    passWithNoTests: true
  }
});
