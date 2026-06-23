# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CommonJS Node 20 Discord bot for Project Redefine ("프로젝트 리디파인") operations: participant guidance, FAQ/knowledge search, journey points, mission approvals, redemptions, operator tools, data export, and an optional read-only admin dashboard (`/admin`). Runtime state is local JSON for the MVP; configuration is environment-driven (Railway target deployment).

Detailed per-directory knowledge bases exist as `AGENTS.md` files and are the source of truth for that area — read them before editing in that directory: [AGENTS.md](AGENTS.md), [src/AGENTS.md](src/AGENTS.md), [data/AGENTS.md](data/AGENTS.md), [scripts/AGENTS.md](scripts/AGENTS.md), [docs/AGENTS.md](docs/AGENTS.md).

## Commands

```bash
npm ci                      # install deps
npm start                   # run the bot (node src/index.js)
npm run deploy               # push slash command definitions to Discord (not a build step)
npm run validate:data        # validate data/*.json shape
npm run test:questions       # FAQ/knowledge matching QA
npm run check:release        # full local release gate: syntax checks + all smoke/data/question tests
node --check src/index.js    # syntax-check a single file
node scripts/test-<name>.js  # run one smoke/flow test directly (no test runner; plain Node + assert)
```

There is no Jest/Mocha — tests are plain Node scripts under `scripts/test-*.js` using `assert`, run directly with `node`.

## Architecture

```
src/              Discord runtime, commands, points, admin API/server
scripts/          Plain Node smoke tests, data validation, release gate
data/             Public content JSON, *.example.json fixtures, *.local.json uncommitted runtime state
public/admin/     Static read-only admin dashboard assets (no frontend build)
docs/             Korean operator runbooks, QA, release, participant docs
prompts/codex/    Reusable Codex task prompts, not runtime code
```

Key flow: `src/index.js` boots the Discord client and admin server. `src/deploy-commands.js` defines slash command schemas (run `npm run deploy` after changing them). `src/handlers.js` is the large (2k+ line) interaction dispatcher for commands/selects/buttons/modals. All point/redemption/mission state mutations must go through `src/pointsRepository.js` / `src/pointsStore.js` — never hand-roll JSON writes elsewhere. `src/reactionApproval.js` implements the mission-approval-via-✅-reaction flow (env-gated channel, emoji, reward, DM/public reply). `src/adminApi.js` + `src/adminServer.js` + `src/adminAuth.js` form the read-only HTTP Basic Auth dashboard — must exclude example/demo records from real data. `src/search.js` + `data.js` drive FAQ/knowledge matching over `data/faq.json` and `data/knowledge.json`.

Journey point operational flow (see [AGENTS.md](AGENTS.md) for full detail): participant checks in (`/체크인`) → posts proof in mission channel → operator reacts ✅/❌ → points credited/transaction logged via `pointsRepository.js` → participant spends points via `/상점` → `/교환` → operator fulfills and closes out via `/교환관리`.

## Coding conventions

- CommonJS only: `require` / `module.exports`, direct `node` execution — no bundler, no ESM.
- Two-space indentation, semicolons, single quotes, descriptive camelCase.
- Korean participant/operator copy must stay calm, direct, consistent with `README.md` and `docs/`.
- New smoke tests: name `test-<module>.js` (module test) or `test-<feature>-flow.js` (workflow test), use `assert`, print one success line at the end.
- Add new env vars to `.env.example` and the relevant doc when behavior depends on them.
- When changing stored data shape, update `pointsRepository.js`, example fixtures, validation/smoke tests, and docs together.

## Anti-patterns to avoid

- Never commit `.env`, production Discord IDs, exported participant data, or `data/*.local.json`.
- `npm run deploy` only refreshes Discord slash commands — it is not a build step.
- Never present `data/*.example.json` records as live data in dashboard/API/docs.
- Don't make the admin dashboard mutating without explicitly changing MVP scope plus docs/tests.
- Don't hardcode unresolved operations-policy answers into FAQ/knowledge — route uncertainty to operators.
- Don't bypass `pointsRepository.js` for point/redemption/mission state.

## Current branch / PR flow

Trunk-based on `main`; feature work lands via PR and merge commit (see recent history: `feat/prelaunch-check-mode`, dungeonworld minigame, sensitive-question detection fixes). No CLAUDE.md existed prior to this file — `AGENTS.md` files were the existing knowledge base across `/`, `src/`, `data/`, `scripts/`, `docs/`.
