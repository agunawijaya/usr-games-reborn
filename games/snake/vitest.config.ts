import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'snake',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
