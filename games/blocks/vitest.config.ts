import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'blocks',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
