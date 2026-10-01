import { describe, expect, it } from 'vitest';
import { createSkyKeys } from './keys';

const press = (code: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({ code, ctrlKey: false, metaKey: false, altKey: false, ...modifiers }) as KeyboardEvent;

describe('the remappable keys', () => {
  it('starts from the manifest defaults', () => {
    const keys = createSkyKeys(undefined);
    expect(keys.actionFor(press('Space'))).toBe('next-tick');
    expect(keys.actionFor(press('Backquote'))).toBe('terminal');
    expect(keys.label('hold-left')).toBe('[');
    expect(keys.label('next-tick')).toBe('Space');
  });

  it('follows the Hall when a key is moved, and leaves the old one free', () => {
    const keys = createSkyKeys({ 'next-tick': ['KeyN'] });
    expect(keys.actionFor(press('KeyN'))).toBe('next-tick');
    expect(keys.actionFor(press('Space'))).toBeNull();
    expect(keys.label('next-tick')).toBe('N');
  });

  it('ignores bindings for actions Skyloom does not have, and modified keys', () => {
    const keys = createSkyKeys({ jump: ['Space'] });
    expect(keys.actionFor(press('Space'))).toBe('next-tick');
    expect(keys.actionFor(press('Space', { ctrlKey: true }))).toBeNull();
  });
});
