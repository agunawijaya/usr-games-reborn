import { describe, expect, it } from 'vitest';
import { normalizeUsername, validateUsername } from './username';

describe('validateUsername', () => {
  it('accepts Unix-style names and normalises case and spaces', () => {
    expect(validateUsername('Ada')).toEqual({ ok: true, name: 'ada' });
    expect(validateUsername('  grace hopper ')).toEqual({ ok: true, name: 'grace-hopper' });
    expect(validateUsername('ken_1983')).toEqual({ ok: true, name: 'ken_1983' });
    expect(normalizeUsername('A  B')).toBe('a-b');
  });

  it('explains what is wrong, kindly', () => {
    expect(validateUsername('a')).toMatchObject({
      ok: false,
      reason: 'Use at least 2 characters.',
    });
    expect(validateUsername('1ada')).toMatchObject({ ok: false, reason: 'Start with a letter.' });
    expect(validateUsername('ada!')).toMatchObject({ ok: false });
    expect(validateUsername('x'.repeat(17))).toMatchObject({ ok: false });
    expect(validateUsername('root')).toMatchObject({ ok: false });
  });

  it('keeps names all-ages without flagging innocent words', () => {
    expect(validateUsername('crap-9')).toMatchObject({ ok: false });
    expect(validateUsername('classic')).toMatchObject({ ok: true });
    expect(validateUsername('hello')).toMatchObject({ ok: true });
    expect(validateUsername('diesel')).toMatchObject({ ok: true });
  });
});
