import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'worm',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
