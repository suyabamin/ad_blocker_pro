# CLAUDE.md — Agent Operating Rules for Hush

Hush is a personal, free, cross-browser (Chrome/Edge/Brave/Opera/Firefox) ad blocker extension built on Manifest V3. You are the implementing engineer. The architecture is already decided. Your job is to execute it exactly.

## 1. Mandatory Reading (before ANY task)
Read these in order, fully, every new session and after any long pause:
1. `docs/01_PRD.md` — what we build and, critically, what we do NOT build (Non-Goals)
2. `docs/02_AppFlow.md` — states, screens, actions, error handling
3. `docs/03_UI_Spec.md` — tokens, components, accessibility
4. `docs/04_TRD.md` — locked stack, versions, folder layout, security rules
5. `docs/05_Schema.md` — local data model, trust model, migrations
6. `docs/06_Plan.md` — the ordered checklist and progress log

If you have not read all six in this session, stop and read them before writing code. State in your first reply which files you read.

## 2. Source of Truth Hierarchy
If documents conflict: `01_PRD` Non-Goals > `04_TRD` security rules > `05_Schema` > `02_AppFlow` > `03_UI_Spec` > `06_Plan` > your own judgement.
If something is ambiguous or missing, **ask the owner**. Do not invent requirements, libraries, screens, or fields.

## 3. Workflow Loop (every task)
1. Open `docs/06_Plan.md`; find the first unchecked `[ ]` item. Work only on that item.
2. Restate the item and its "Done when" criterion in one or two lines.
3. Implement the smallest change that satisfies it, touching only files named or implied by `04_TRD` §3.
4. Run verification: `npm run lint`, `npm run typecheck`, `npm test`, plus any command named in "Done when".
5. **Update `docs/06_Plan.md` immediately**: mark `[x]` with date and note, and append a row to the Progress Log (date, item, result, notes). If blocked, mark `[!]` and explain.
6. Report: what changed, how it was verified, what is next. Then stop unless told to continue.
Never mark an item done without running its verification. Never batch several plan items into one unverified change.

## 4. Hard Rules (never violate)
- **No scope creep.** Anything under PRD §6 Non-Goals is forbidden. No backend, telemetry, accounts, store publishing, remote code, or paid services.
- **No dependency changes** without first editing `docs/04_TRD.md` §1 and getting owner approval. Use exact versions, never `latest` or `^`.
- **Security (04_TRD §9):** no `eval`/`new Function`, no `fetch`/`XMLHttpRequest` in `src/`, no dynamic `innerHTML`, validate all message payloads, check `sender.id`.
- **Permissions:** exactly those in `04_TRD` §2. Adding one requires a doc change first.
- **Browser API access** only through `src/shared/browser.ts`.
- **YouTube selectors** live only in `src/content/youtube/selectors.ts`.
- **Service worker is stateless:** derive state from storage on every wake.
- **Never claim** ads are blocked "forever" or "100%" in code, UI copy, README, or commit messages.
- Do not edit `docs/01–05` yourself. If one needs changing, propose the edit to the owner and wait. You may edit `docs/06_Plan.md` (checkboxes, Progress Log) and add notes under the log only.

## 5. Code Standards
- TypeScript strict; no `any` (use `unknown` + validation). No default exports except where a tool requires them.
- Small pure functions; side effects at the edges (`background/index.ts` only registers events).
- Every handler returns `Result<T>` (04_TRD §6). Never throw across a message boundary.
- Every new module gets unit tests in `tests/unit/` in the same step.
- UI: vanilla TS + CSS tokens only (03_UI_Spec). No hard-coded colours or spacing. Handle loading, empty, and error states for every screen (02_AppFlow).
- Comments explain *why*, not *what*. YouTube selectors get a "verified on YYYY-MM-DD" comment.
- Commits: one plan item per commit, message `plan <id>: <summary>`.

## 6. Testing & Verification Commands
```
npm run lint        npm run typecheck     npm test
npm run build:chrome   npm run build:firefox
npm run test:e2e    npm run update-lists  npm run build-rulesets
```
Manual checks must be recorded in the Progress Log with what was tested and the result.

## 7. When You Are Unsure
Ask one concise question with a recommended default. Do not guess, and do not "improve" the architecture on your own. If you find a bug or risk in the docs, report it; do not silently work around it.

## 8. Tone of Reporting
Be factual and brief. Report failures plainly (failing test output, what you tried). Never say "should work"; say what you ran and what it returned.
