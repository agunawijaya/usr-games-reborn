# 0001 — The garden in Canvas 2D

- **Status:** Accepted (approved by the owner with the hero frames, 2026-10-02; the noodle's drawing
  revised after the frame-rate check, same day)
- **Date:** 2026-10-02

## Context

Prompt 04 asks for Canvas 2D or WebGL, decided in an ADR. The garden must draw a soft, glossy
noodle as a smooth body (not squares) up to 300 cells long with bulges, rings and a face, number-
fruit, a procedural soil cross-section in two looks, a rainbow pulse and a mosaic ripple, at 60 fps
at 1920 × 1080, with zero raster files.

## Decision

- Everything is drawn with Canvas 2D.
- The noodle is a curve through its cell centres with every bend a quarter circle, sampled every
  0.08 of a cell. The tube is **stroked** along that curve in runs of one width: most of the body is
  a single long stroke, and the width only steps where it really changes (the head, the tail's
  taper, a bulge, the saddle). Points in the middle of a straight stretch are dropped.
- Everything inside the body (the saddle, the shade, the lighter core, the rings, the rainbow
  pulse, the gloss, the loss's draining colour) is painted on an offscreen layer with
  `source-atop`, so it stays inside the tube, then copied onto the garden in one go. See-through
  washes are painted solid on a scratch layer and laid on with their alpha, so overlapping strokes
  never show as darker spots.
- The night glow is the body's shape drawn at a quarter size, blurred there with a canvas filter
  and scaled up: cheap, and soft.
- The scenery (sky, grass, soil, pebbles, roots, the bed and its rocks, roots, mud and tunnels) is
  painted once per size, look and garden into an offscreen canvas and copied every frame.
- No new dependency.

## Consequences

- No WebGL context to manage or lose; the same code draws play, the attract garden, the Hall's demo
  and the poster.
- A 300-cell noodle gliding through a 36 × 18 bed holds **60 fps at 1920 × 1080 in both looks
  (95th percentile 16.7 ms)**, measured by `e2e/perf.spec.ts`. The first version, which built the
  tube from thousands of round stamps a layer and its glow from `shadowBlur`, ran at 7 fps.
- The offscreen layers cost two canvases the size of the garden plus two at a quarter of it, per
  canvas the noodle is drawn on; only the noodle's bounding box is cleared and copied each frame.
