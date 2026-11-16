import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Next's bundler special-cases this specifier; under Vitest it needs a real module.
      'server-only': path.resolve(__dirname, './src/__tests__/helpers/server-only-stub.ts'),
    },
  },
});
