import { describe, expect, it } from 'vitest';
import {
  createInput,
  describeCode,
  findConflicts,
  mergeBindings,
  type ActionEvent,
} from './actions';

/** A minimal event target standing in for window. */
function fakeTarget() {
  const handlers = new Map<string, Set<(event: Event) => void>>();
  return {
    addEventListener(type: string, handler: (event: Event) => void) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
    },
    removeEventListener(type: string, handler: (event: Event) => void) {
      handlers.get(type)?.delete(handler);
    },
    fire(type: string, init: Record<string, unknown>) {
      const event = { type, repeat: false, preventDefault() {}, ...init } as unknown as Event;
      for (const handler of handlers.get(type) ?? []) handler(event);
    },
    count: () => [...handlers.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

const DEFAULTS = { up: ['ArrowUp', 'KeyW'], fire: ['Space', 'Mouse0'], pause: ['Escape'] };

describe('createInput', () => {
  it('turns keys and clicks into actions', () => {
    const target = fakeTarget();
    const input = createInput({ target: target as unknown as Window, defaults: DEFAULTS });
    const events: ActionEvent[] = [];
    input.on((event) => events.push(event));

    target.fire('keydown', { code: 'KeyW' });
    expect(input.isDown('up')).toBe(true);
    target.fire('keyup', { code: 'KeyW' });
    target.fire('mousedown', { button: 0 });
    expect(events.map((e) => `${e.action}:${e.pressed}:${e.source}`)).toEqual([
      'up:true:keyboard',
      'up:false:keyboard',
      'fire:true:mouse',
    ]);
  });

  it('releases held actions when the window loses focus', () => {
    const target = fakeTarget();
    const input = createInput({ target: target as unknown as Window, defaults: DEFAULTS });
    target.fire('keydown', { code: 'Space' });
    target.fire('blur', {});
    expect(input.isDown('fire')).toBe(false);
  });

  it('remaps, reports displaced actions and saves only the differences', () => {
    const target = fakeTarget();
    let saved: Record<string, string[]> = {};
    const input = createInput({
      target: target as unknown as Window,
      defaults: DEFAULTS,
      onBindingsChange: (overrides) => (saved = overrides),
    });
    expect(input.rebind('fire', ['KeyW'])).toEqual(['up']);
    expect(input.bindings().up).toEqual(['ArrowUp']);
    expect(saved).toEqual({ up: ['ArrowUp'], fire: ['KeyW'] });
    expect(() => input.rebind('jump', ['KeyJ'])).toThrow(RangeError);
  });

  it('removes its listeners on destroy', () => {
    const target = fakeTarget();
    createInput({ target: target as unknown as Window, defaults: DEFAULTS }).destroy();
    expect(target.count()).toBe(0);
  });
});

describe('binding helpers', () => {
  it('merges overrides only for known actions', () => {
    expect(mergeBindings(DEFAULTS, { up: ['KeyI'], ghost: ['KeyG'] })).toEqual({
      ...DEFAULTS,
      up: ['KeyI'],
    });
  });

  it('finds shared codes', () => {
    const conflicts = findConflicts({ a: ['KeyA'], b: ['KeyA', 'KeyB'] });
    expect([...conflicts]).toEqual([['KeyA', ['a', 'b']]]);
  });

  it('describes codes for people', () => {
    expect(describeCode('KeyW')).toBe('W');
    expect(describeCode('ArrowLeft')).toBe('←');
    expect(describeCode('Escape')).toBe('Esc');
    expect(describeCode('Mouse2')).toBe('Right click');
  });
});
