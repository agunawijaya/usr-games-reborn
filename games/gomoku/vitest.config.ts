import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'gomoku',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
