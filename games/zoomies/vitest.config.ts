import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'zoomies',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
