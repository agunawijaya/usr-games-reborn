import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'wump',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
