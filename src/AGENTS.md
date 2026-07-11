# SRC KNOWLEDGE BASE

## OVERVIEW

Runtime CommonJS modules for the Discord bot, local JSON repository, operator flows, exports, and optional admin server with gated audited writes.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Boot process | `index.js` | Loads `.env`, creates Discord client, registers events |
| Slash command registration | `deploy-commands.js` | Command schema and default operator permissions |
| Interaction behavior | `handlers.js` | Commands, selects, buttons, modals, operator checks |
| Point math primitives | `pointsStore.js` | Pure-ish helpers used by tests and repository |
| JSON persistence | `pointsRepository.js` | Local paths, fallback examples, state mutation |
| FAQ/knowledge matching | `search.js`, `data.js` | Public data loading and scoring |
| Sensitive-question handling | `safety.js`, `logging.js` | User response plus operator alert |
| Reaction approvals | `reactionApproval.js` | Message reaction to point transaction flow |
| Dashboard backend | `adminServer.js`, `adminApi.js`, `adminAuth.js` | Read-only HTTP Basic Auth dashboard |
| Discord UI builders | `components.js`, `embeds.js` | Shared rows, embeds, Korean copy |
| Export payloads | `exportUtils.js` | JSON/CSV/summary formatting |

## CONVENTIONS

- Keep modules CommonJS; export named helpers through `module.exports`.
- Preserve the existing operator gate: `ManageMessages` or `Administrator` unless a module already supports `OPERATOR_ROLE_ID`.
- Use ephemeral/private Discord responses for participant-sensitive or operator-only data where existing flows do.
- Add environment variables to `.env.example` and relevant docs when runtime behavior depends on them.
- When changing stored data shape, update `pointsRepository.js`, example fixtures, validation or smoke tests, and docs together.

## ANTI-PATTERNS

- Do not bypass `pointsRepository.js` for operational point/redemption/mission state.
- Do not let dashboard API responses include example/demo/sample records as live records.
- Do not make DM/logging failures block successful point or review state changes unless the existing flow already does.
- Do not add broad command behavior only in `handlers.js` without a focused script test.
- Do not assume `LOG_CHANNEL_ID` or specialized alert channels exist; current logging paths tolerate missing channel IDs.

## CHECKS

```bash
node --check src/index.js
node --check src/handlers.js
node --check src/pointsRepository.js
npm run check:release
```
