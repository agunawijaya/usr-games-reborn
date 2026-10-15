import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'fish',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
