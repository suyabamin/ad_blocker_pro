# 06_Plan — Implementation Checklist

**Protocol for the agent (mandatory):**
1. Work on the FIRST unchecked item only. Do not skip ahead.
2. When an item's "Done when" is verified, change `[ ]` to `[x]`, add the date and a one-line note, and append an entry to the Progress Log at the bottom. Do this immediately, before starting the next item.
3. If blocked or a doc conflicts with reality, mark `[!]`, write the reason in the Progress Log, and ask the owner. Never silently deviate.
4. Never mark done without running the stated verification command.

Legend: `[ ]` todo · `[x]` done · `[!]` blocked

---

## Phase 0 — Scaffold & Tooling
- [x] **0.1** Init repo, `.nvmrc` (22), `.npmrc` (`save-exact=true`), `.gitignore` (node_modules, dist, rulesets-src). (2026-11-03: initialized git repo, config files, gitignore) *Done when:* `git status` clean after first commit.
- [x] **0.2** `package.json` with scripts from 04_TRD §11 and exact devDependencies from §1. Resolve and **write the pinned `@adguard/tsurlfilter` version into 04_TRD §1**. (2026-11-03: pinned @adguard/tsurlfilter to 6.0.4; npm ci verified) *Done when:* `npm ci` succeeds.
- [x] **0.3** `tsconfig.json` (strict), ESLint flat config incl. rules banning `eval`, `fetch`, `XMLHttpRequest`, `innerHTML` under `src/`; Prettier. (2026-11-03: strict tsconfig, ESLint security bans verified, Prettier configured) *Done when:* `npm run lint && npm run typecheck` pass on empty `src/`.
- [ ] **0.4** `scripts/build.mjs`: esbuild bundles entry points, merges `manifests/base.json` + overlay per browser, copies `public/`. *Done when:* `npm run build:chrome` and `build:firefox` produce `dist/<browser>/manifest.json`.
- [ ] **0.5** Minimal manifest + empty background/popup/options that load without errors. *Done when:* loads unpacked in Chrome and as temporary add-on in Firefox with zero console errors.
- [ ] **0.6** `src/shared/browser.ts` (polyfill wrapper), `types.ts` from 05_Schema §4, `constants.ts`. *Done when:* typecheck passes; unit test imports work.

## Phase 1 — Data Layer (replaces "DB & Auth")
- [ ] **1.1** `storage.ts`: typed get/set for every key in 05_Schema §1 with defaults (§5). *Done when:* unit tests for defaults and round-trip pass.
- [ ] **1.2** Validation helpers: hostname regex, import schema validator. *Done when:* tests cover valid + 10 invalid inputs.
- [ ] **1.3** `migrations.ts` framework + `schemaVersion=1`. *Done when:* fixture-based test passes.
- [ ] **1.4** `messages.ts` typed Result protocol + background router skeleton with sender check (05_Schema §7). *Done when:* test proves foreign sender is rejected and unknown type returns `UNKNOWN_MESSAGE`.
- [ ] **1.5** `bootstrap()` on install/startup writes defaults idempotently. *Done when:* running it twice yields identical storage.

## Phase 2 — Core Engine (replaces "Core API")
### 2A Network blocking
- [ ] **2.1** `scripts/update-lists.mjs` downloads the lists in 04_TRD §4 to `rulesets-src/`. *Done when:* files exist; script is the only code making network calls.
- [ ] **2.2** `scripts/build-rulesets.mjs` converts lists to DNR JSON + `*.meta.json`, reports skipped rules. *Done when:* output rule counts printed; JSON passes Chrome's rule validation on load.
- [ ] **2.3** Register rulesets in manifests (`rule_resources`, defaults enabled/disabled per 05_Schema §5). *Done when:* extension loads with rulesets; `chrome.declarativeNetRequest.getEnabledRulesets()` returns expected ids.
- [ ] **2.4** `rulesets.ts`: enable/disable with limit checks (04_TRD §5). *Done when:* exceeding limit reverts and returns `{ok:false, code:'RULE_LIMIT'}` (unit test with mocked API).
- [ ] **2.5** Global enable/disable end-to-end (`SET_ENABLED`). *Done when:* toggling off allows an ad-test request; on blocks it (manual + e2e).
### 2B Allowlist & custom rules
- [ ] **2.6** `allowlist.ts` + reconcile on startup (rule id range 1–9,999). *Done when:* reconcile test after simulated crash passes.
- [ ] **2.7** `customRules.ts` strict parser (05_Schema §2.4) → dynamic rules (ids 10,000+) + cosmetic list. *Done when:* tests for 30 valid/invalid lines pass; no ID overlap.
### 2C Cosmetic filtering
- [ ] **2.8** `content/cosmetic.ts` fetches policy from background, injects stylesheet with generic selectors + custom hides; exits when disabled/allowlisted. *Done when:* ad placeholder on test page hidden; no effect when paused.
### 2D YouTube
- [ ] **2.9** `youtube/selectors.ts` + `detect.ts`. *Done when:* detection unit tests pass against saved HTML fixtures in `tests/fixtures/youtube/`.
- [ ] **2.10** `skip.ts`: skippable click, unskippable mute/16x/seek, restore after ad. *Done when:* fixture-driven jsdom tests pass.
- [ ] **2.11** `youtube/index.ts` controller with MutationObserver + `yt-navigate-finish` re-arm + banner hiding + settings flags. *Done when:* manual run on 5 videos: ads skipped/neutralised, playback normal afterward.
- [ ] **2.12** `youtube.selftest` reporting live selector matches. *Done when:* About page (later) can call it; returns JSON.
### 2E Stats
- [ ] **2.13** `stats.ts`: per-tab counters (session), 1-min flush alarm to `statsDaily`, 90-day trim. *Done when:* unit tests with fake timers pass.
- [ ] **2.14** Badge text + icon state updates (ACTIVE/DISABLED/DEGRADED/paused). *Done when:* manual state walk-through matches 02_AppFlow §1.

## Phase 3 — UI Integration
- [ ] **3.1** `ui/tokens.css`, `base.css`, `components.css` exactly per 03_UI_Spec; `theme-boot.ts`. *Done when:* theme switch works with no flash; contrast test passes.
- [ ] **3.2** Components: toggle, button, input, list row, badge, toast, modal, banner, skeleton. *Done when:* a `tests/e2e/components.html` page shows every state.
- [ ] **3.3** Popup: all states in 02_AppFlow §2 wired to messages. *Done when:* each state reachable and screenshot-verified.
- [ ] **3.4** Options router + `#/general`. *Done when:* unknown hash → `#/general`; settings persist.
- [ ] **3.5** `#/lists` with limit messaging. *Done when:* toggle failure reverts + message.
- [ ] **3.6** `#/allowlist`. *Done when:* add/remove syncs with popup and rules.
- [ ] **3.7** `#/custom` editor with line-numbered errors. *Done when:* invalid lines block save with correct line numbers.
- [ ] **3.8** `#/youtube` toggles. *Done when:* flags change behaviour live without reload where possible.
- [ ] **3.9** `#/stats` CSS/SVG 30-day chart + reset with confirm. *Done when:* empty and populated states verified.
- [ ] **3.10** `#/about` diagnostics, selector self-test button, honesty note. *Done when:* "Copy diagnostics" output matches 02_AppFlow §2.
- [ ] **3.11** Export/Import (05_Schema §7.5). *Done when:* round-trip test passes; bad file shows modal and applies nothing.

## Phase 4 — Edge Cases, Tests, Packaging
- [ ] **4.1** Unsupported pages (chrome://, about:, file:, Web Store, PDF viewer) handled in popup and content scripts. *Done when:* manual list of 8 pages passes.
- [ ] **4.2** Service-worker restart safety: kill worker mid-session; state recovers from storage. *Done when:* manual + test.
- [ ] **4.3** Rule-limit and storage-quota failure paths → DEGRADED + Retry. *Done when:* simulated failures covered by tests.
- [ ] **4.4** Iframe & SPA edge cases: YouTube embeds (`youtube-nocookie.com`), navigation without reload, live streams, Shorts, mid-roll, back/forward. *Done when:* manual matrix in Progress Log all pass or have noted known gaps.
- [ ] **4.5** Performance check against 04_TRD §10 budgets. *Done when:* numbers recorded in Progress Log.
- [ ] **4.6** Security check: grep test for `fetch(`/`eval`/`innerHTML` in `src/`; `npm audit --omit=dev`; permission diff vs 04_TRD §2. *Done when:* all clean.
- [ ] **4.7** Playwright smoke on Chromium + Firefox (load extension, block test request, toggle, pause site). *Done when:* `npm run test:e2e` green.
- [ ] **4.8** Accessibility pass: keyboard-only walkthrough, focus rings, 200% zoom. *Done when:* checklist in Progress Log complete.
- [ ] **4.9** `package.mjs` zips per browser; README with load instructions (04_TRD §12), update-lists workflow, "YouTube is best-effort" note, THIRD_PARTY_NOTICES. *Done when:* fresh clone → working install in < 10 min following README only.

## Recurring Maintenance (after MVP)
- [ ] **M.1** Monthly: `npm run update-lists && npm run build-rulesets`, reload, smoke test.
- [ ] **M.2** When YouTube breaks: run selector self-test, fix `selectors.ts` only, re-run fixtures, log date.

---

## Progress Log
| Date | Item | Result | Notes |
|------|------|--------|-------|
| — | — | — | Plan created |
| 2026-11-03 | 0.1 | Pass | Initialized git, .nvmrc, .npmrc, .gitignore, moved docs to docs/ |
| 2026-11-03 | 0.2 | Pass | Configured package.json with locked dependencies, pinned tsurlfilter 6.0.4, npm ci verified |
| 2026-11-03 | 0.3 | Pass | Strict tsconfig, ESLint flat config with security bans (eval/fetch/xhr/innerHTML), prettier; lint and typecheck pass |
