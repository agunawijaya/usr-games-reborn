import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'canfield',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
