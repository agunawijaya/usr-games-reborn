import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'cribbage',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
