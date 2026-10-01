import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildBridge } from '../build';

describe('buildBridge', () => {
  it('produces both bridge files in memory without touching the disk', async () => {
    const files = await buildBridge({ write: false });
    expect(Object.keys(files).sort()).toEqual(['bridge.js', 'bridge.mjs']);
    expect(files['bridge.mjs']).toMatch(/export \{[^}]*connectToHall/);

    // The classic build must define the global a static game relies on, and nothing more.
    const global = runInNewContext(`${files['bridge.js']}\nUsrGamesBridge`) as Record<
      string,
      unknown
    >;
    expect(typeof global.connectToHall).toBe('function');
    expect(global.BRIDGE_VERSION).toBe(1);
    expect(global.BRIDGE_PROTOCOL).toBe('usr-games-bridge');
  }, 30_000);

  it('ships no network calls and no external URLs', async () => {
    const files = await buildBridge({ write: false });
    for (const code of Object.values(files)) {
      expect(code).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//);
    }
  }, 30_000);
});
