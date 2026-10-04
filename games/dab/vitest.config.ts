import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'dab',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
