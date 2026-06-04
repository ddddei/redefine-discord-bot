# CODEX PROMPTS KNOWLEDGE BASE

## OVERVIEW

Reusable Codex task prompts for this repository. These are work instructions, not source code or official operations docs.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Prompt library rules | `../README.md` | Reusable-only and no-sensitive-data policy |
| Feature implementation prompts | `*-v1.md`, `*-v2.md`, `*-v5.md` | Versioned task specs |
| Cleanup/maintenance prompts | `*-c1.md` | Maintenance campaign specs |
| Official docs | `../../docs/` | Move durable outcomes here after work lands |

## CONVENTIONS

- Use lowercase kebab-case filenames with a version suffix, for example `participant-guide-hub-v2.md`.
- Keep prompts reusable: goal, scope, allowed files, validation, and operational cautions.
- Treat prompts as stale until checked against current `main` and current repository files.
- Write task constraints clearly enough that another agent can execute without hidden context.
- Move lasting decisions, runbooks, and user-facing copy into `docs/` after implementation.

## ANTI-PATTERNS

- Do not commit one-off scratch prompts.
- Do not include real tokens, channel IDs, API keys, participant PII, or sensitive story text.
- Do not treat a prompt as proof that code already implements the behavior.
- Do not let prompt instructions override root repository safety, data, or testing rules.

## CHECKS

```bash
git diff -- prompts/codex
rg -n "TOKEN|API_KEY|CHANNEL_ID|DISCORD|password|비밀번호" prompts/codex
```
