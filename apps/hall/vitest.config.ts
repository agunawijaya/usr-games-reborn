import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'hall',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
