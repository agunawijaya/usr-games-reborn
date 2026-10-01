import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'kit',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
  },
});
