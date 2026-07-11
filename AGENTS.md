# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-04 10:12:30 KST
**Commit:** 7e36fe6
**Branch:** test/lazycodex-first

## OVERVIEW

CommonJS Node 20 Discord bot for Project Redefine operations: participant guidance, FAQ/knowledge search, journey points, mission approvals, redemptions, operator tools, exports, and an optional admin console. Runtime state is local JSON for the MVP; Railway/Discord configuration is environment-driven.

## STRUCTURE

```text
redefine-discord-bot/
+-- src/              # Discord runtime, commands, points, admin API/server
+-- scripts/          # Plain Node smoke tests, data validation, release gate
+-- data/             # Public content, example fixtures, uncommitted local state
+-- public/admin/     # Static admin console assets
+-- docs/             # Korean operator runbooks, QA, release, and participant docs
+-- prompts/codex/    # Reusable Codex task prompts, not runtime code
`-- package.json      # npm scripts; no bundler or separate build step
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Bot startup/events | `src/index.js` | Wires Discord client, interactions, reactions, admin server |
| Slash command definitions | `src/deploy-commands.js` | Run `npm run deploy` after command shape changes |
| Command behavior | `src/handlers.js` | Largest orchestration file; check related tests before editing |
| Points/redemptions/missions storage | `src/pointsRepository.js`, `src/pointsStore.js` | Uses local JSON paths with example fallbacks |
| Mission reaction approvals | `src/reactionApproval.js` | Env-gated channel, emoji, reward, DM/public reply behavior |
| Operator logs/alerts | `src/logging.js` | Falls back to `LOG_CHANNEL_ID` when specific channels are absent |
| Admin dashboard API/server | `src/adminApi.js`, `src/adminServer.js` | Reads plus env/token-gated audited writes |
| Static dashboard UI | `public/admin/` | No frontend build; served by the bot process |
| Public FAQ/knowledge/channel data | `data/*.json` | Validate with `npm run validate:data` |
| Operational docs | `docs/README.md` | Index of record for docs navigation |
| Prompt library | `prompts/README.md`, `prompts/codex/` | Reusable agent task specs only |

## CODE MAP

| Module | Role | Hotspots |
| --- | --- | --- |
| `src/handlers.js` | Discord interaction dispatcher | 2k+ lines; commands, selects, buttons, modals |
| `src/pointsRepository.js` | Mutable operational repository | Local/example path resolution and persistence |
| `src/embeds.js` | Discord-facing Korean copy/embeds | Keep tone aligned with docs |
| `src/adminApi.js` | Dashboard data shaping | Must exclude example/demo/sample records |
| `scripts/check-release.js` | Local release gate | Broader than GitHub Actions CI |

## CONVENTIONS

- Use CommonJS: `require`, `module.exports`, direct `node` execution.
- JavaScript style: two-space indentation, semicolons, single quotes, descriptive camelCase.
- Korean participant/operator copy should stay calm, direct, and consistent with `README.md` and `docs/`.
- Prefer repository helpers for JSON state; do not hand-roll writes around `pointsRepository.js`.
- Tests are plain Node scripts with `assert`, not Jest/Mocha.

## ANTI-PATTERNS (THIS PROJECT)

- Do not commit `.env`, production Discord IDs, exported participant data, or `data/*.local.json`.
- Do not treat `npm run deploy` as a build; it only refreshes Discord slash commands.
- Do not show `data/*.example.json` records as real operations data in dashboard/API work.
- Admin mutations require the env gate, separate timing-safe token check, confirmation UI, repository-only mutation, and audit trail.
- Do not hardcode unresolved operations policy answers into FAQ/knowledge; route uncertainty to operators.

## COMMANDS

```bash
npm ci
npm start
npm run deploy
npm run validate:data
npm run test:questions
npm run check:release
node scripts/test-participant-ux-flow.js
node --check src/index.js
```

## NOTES

- GitHub Actions CI is narrower than `npm run check:release`; use the latter for release-facing changes.
- The same Node process can serve `/admin` only when `ADMIN_DASHBOARD_ENABLED=true` and `ADMIN_DASHBOARD_PASSWORD` is set.
- Operator permissions are generally `ManageMessages`, `Administrator`, or selected role env where implemented.
- If slash command names/options/default permissions change, update docs and run `npm run deploy` in the target Discord environment.
