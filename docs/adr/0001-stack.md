# 0001 — Stack: TypeScript, pnpm, Vite, Vitest, Playwright; framework-free Hall

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

The collection will hold about thirty games written by many parallel Claude Code sessions, plus
eight finished games adopted with their own stacks. We need one toolchain that builds everything
into a single static site, keeps sessions from stepping on each other, and stays small enough that
the Hall's first load is under 250 KB of gzipped JavaScript.

## Decision

- **TypeScript in strict mode** for all new code (`tsconfig.base.json`: `strict`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`).
- **TypeScript 6.0 is pinned** (6.0.3). TypeScript 7 exists, but typescript-eslint supports only
  versions below 6.1; lint must keep working. Revisit when typescript-eslint supports 7.
- **pnpm workspaces**: `apps/*`, `packages/*`, `games/*`, `games/*/app` (hosted games with their own
  build) and the bridge's Vite fixture. Workspace packages export TypeScript source directly; Vite
  compiles it, so there is no separate library build for the kit.
- **Vite 8** for the Hall, native games and the bridge's library build; **Vitest 5** with one
  project per package (`vitest.config.ts` at the root lists them; native games join by adding their
  own `vitest.config.ts`); **Playwright** for Hall-scoped end-to-end tests and screenshots.
- **ESLint** (flat config with typescript-eslint) and **Prettier** (100 columns, single quotes).
  `docs/PROGRESS.md`, `prompts/`, `CLAUDE.md` and adopted game code are excluded from Prettier.
- **Framework-free Hall.** The Hall is plain TypeScript and DOM with a tiny element helper, not a UI
  framework, so the budget goes to the room itself and nothing forces games into a framework.
- Scripts run with `tsx`. Node 22.12 or newer.

## Consequences

- Any session can run `pnpm check` and get the same answer as CI.
- Games may use a framework internally (an adopted game already does), but nothing in `packages/kit`
  or the Hall may depend on one.
- Upgrading TypeScript past 6.0 is blocked on typescript-eslint; the pin is deliberate, not drift.
