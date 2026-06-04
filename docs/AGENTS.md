# DOCS KNOWLEDGE BASE

## OVERVIEW

Korean operational documentation for operators, participant guidance, QA, release, incident response, and future plans.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Docs index | `README.md` | Navigation hub; update when adding notable docs |
| Daily operations | `operation-guide.md` | Main runbook for commands, data, deployment |
| Release readiness | `release-checklist.md`, `prelaunch-qa-checklist.md` | Final checks before participant entry |
| Operator command usage | `operator-command-guide.md`, `operator-dashboard-guide.md` | Internal operator workflows |
| Participant copy | `participant-*.md`, `first-time-participant-guide.md` | User-facing tone and instructions |
| Incidents/safety | `incident-response-guide.md`, `sensitive-question-alert-plan.md` | Escalation and sensitive-question handling |
| Railway/env setup | `railway-env-guide.md` | Environment variable guidance without secrets |
| Future scope | `*-plan.md` | Design notes; do not imply implemented behavior |

## CONVENTIONS

- Write Korean docs in a calm, practical operator style.
- Separate confirmed behavior from plans, candidates, and future work.
- Keep command examples aligned with actual slash commands and `package.json` scripts.
- For docs-only edits, do not touch `src/`, `data/`, `package.json`, or `.env`.
- If adding a new operational guide, add it to `docs/README.md`.

## ANTI-PATTERNS

- Do not paste real tokens, real channel IDs, admin passwords, user IDs, or participant submissions.
- Do not present `data/*.example.json` or sample dates as live operating state.
- Do not promise dashboard write actions; current dashboard docs describe read-only MVP unless scope changes.
- Do not hardcode unresolved program-policy answers such as meals, transport, selection, or late entry.

## CHECKS

```bash
git diff --stat
npm run validate:data
npm run test:questions
```
