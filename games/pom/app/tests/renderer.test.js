// Renderer helpers that run without a GPU.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { looksSoftware, sunVector } from '../src/render/renderer.js';

test('looksSoftware: CPU rasterisers are recognised', () => {
  for (const name of [
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'Google SwiftShader',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'Mesa softpipe',
    'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'lavapipe',
  ]) assert.equal(looksSoftware(name), true, name);
});

test('looksSoftware: real GPUs are not flagged', () => {
  for (const name of [
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028E0) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Apple M2',
    'Adreno (TM) 740',
    'Mali-G78',
    '',
    undefined,
  ]) assert.equal(looksSoftware(name), false, String(name));
});

test('sunVector follows pom elongation: New behind, First Quarter right, Full in front', () => {
  const close = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  assert.ok(close(sunVector(0), [0, 0, -1]));
  assert.ok(close(sunVector(90), [1, 0, 0]));
  assert.ok(close(sunVector(180), [0, 0, 1]));
  assert.ok(close(sunVector(270), [-1, 0, 0]));
});
