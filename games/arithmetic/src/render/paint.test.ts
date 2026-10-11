import { describe, expect, it } from 'vitest';
import { transparentOf } from './paint';

describe('transparentOf', () => {
  it('keeps the colour and drops the alpha', () => {
    expect(transparentOf('rgba(255, 196, 80, 0.9)')).toBe('rgba(255, 196, 80,0)');
    expect(transparentOf('rgb(1,2,3)')).toBe('rgba(1,2,3,0)');
    expect(transparentOf('hsl(192.0 80% 68% / 0.42)')).toBe('hsl(192.0 80% 68% / 0)');
    expect(transparentOf('hsla(220, 90%, 75%, 0.7)')).toBe('hsla(220, 90%, 75%, 0)');
    expect(transparentOf('hsl(120 50% 50%)')).toBe('hsl(120 50% 50% / 0)');
    expect(transparentOf('#ff8800')).toBe('rgba(255, 136, 0, 0)');
  });
});
