import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'hangman',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
