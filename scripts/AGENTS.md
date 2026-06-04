# SCRIPTS KNOWLEDGE BASE

## OVERVIEW

Plain Node scripts for validation, release checks, and smoke tests. There is no external test runner.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Full local release gate | `check-release.js` | Syntax checks plus all smoke/data/question tests |
| Public JSON validation | `validate-data.js` | Validates FAQ, knowledge, notices, channels, test questions |
| Question matching QA | `test-questions.js` | Uses `data/test-questions.json` and search exports |
| Points primitives | `test-points-store.js` | Example fixture and temp write checks |
| Repository persistence | `test-points-repository.js` | Local/example repository behavior |
| User/operator flows | `test-*-flow.js` | Interaction, approval, export, dashboard smoke tests |

## CONVENTIONS

- Use `assert` from Node core.
- Name new files `test-<module>.js` for module smoke tests or `test-<feature>-flow.js` for workflow tests.
- Prefer `fs.mkdtempSync(path.join(os.tmpdir(), ...))` for writable state.
- Reset mutated environment variables and module cache when tests depend on `process.env`.
- Print one concise success line at the end of a passing script.

## ANTI-PATTERNS

- Do not require real Discord credentials, network access, or production channel IDs.
- Do not write into committed fixture files during tests.
- Do not add release-blocking behavior without adding it to `check-release.js`.
- Do not weaken assertions just to match current output; update fixtures or implementation intentionally.

## CHECKS

```bash
node scripts/test-points-store.js
node scripts/test-admin-dashboard-flow.js
npm run validate:data
npm run test:questions
npm run check:release
```
