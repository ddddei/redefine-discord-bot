# DATA KNOWLEDGE BASE

## OVERVIEW

Repository JSON data splits into public content, safe example fixtures, and uncommitted local runtime state.

## WHERE TO LOOK

| Data | Files | Used By |
| --- | --- | --- |
| FAQ short answers | `faq.json` | `/질문`, `src/search.js`, `scripts/test-questions.js` |
| Knowledge explanations | `knowledge.json` | `/질문`, `src/search.js` |
| Channel guide | `channels.json` | `/채널안내`, `src/data.js` |
| Notice templates | `notices.json` | `/공지`, guide flows |
| Matching QA cases | `test-questions.json` | `npm run test:questions` |
| Safe fixtures | `*.example.json` | Smoke tests and repository fallbacks |
| Runtime state | `*.local.json` | Local MVP operational data; never commit |

## CONVENTIONS

- FAQ items need `keywords`, `question`, and `answer`.
- Knowledge items need unique `id`, `title`, `keywords`, `summary`, and `content`.
- `channels.json` must keep a top-level `categories` array.
- `test-questions.json` groups questions by `category`.
- Example fixture records should remain visibly example/demo/sample data.
- Local state may include Discord IDs, names, submissions, review notes, and approval history.

## ANTI-PATTERNS

- Do not commit `*.local.json` or exported operations data.
- Do not put production channel IDs, user IDs, tokens, or private participant stories into public JSON.
- Do not delete `*.example.json`; tests and fallbacks depend on them.
- Do not directly edit runtime local data for real operations unless the relevant runbook says to.
- Do not add unresolved policy answers as definitive FAQ/knowledge content.

## CHECKS

```bash
npm run validate:data
npm run test:questions
node scripts/test-points-repository.js
```
