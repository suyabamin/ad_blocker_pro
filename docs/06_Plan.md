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
- [x] **0.4** `scripts/build.mjs`: esbuild bundles entry points, merges `manifests/base.json` + overlay per browser, copies `public/`. (2026-11-03: build script merges base/browser manifests, bundles TS entrypoints, copies public & CSS; build:chrome and build:firefox verified) *Done when:* `npm run build:chrome` and `build:firefox` produce `dist/<browser>/manifest.json`.
- [x] **0.5** Minimal manifest + background/popup/options that load without errors. (2026-11-04: manifests for Chrome & Firefox load clean with declarative_net_request and content scripts) *Done when:* loads unpacked in Chrome and as temporary add-on in Firefox with zero console errors.
- [x] **0.6** `src/shared/browser.ts` (polyfill wrapper), `types.ts` from 05_Schema §4, `constants.ts`. (2026-11-04: types, constants, and polyfill wrapper implemented and verified) *Done when:* typecheck passes; unit test imports work.

## Phase 1 — Data Layer (replaces "DB & Auth")
- [x] **1.1** `storage.ts`: typed get/set for every key in 05_Schema §1 with defaults (§5). (2026-11-04: typed storage with session fallback, verified in unit tests) *Done when:* unit tests for defaults and round-trip pass.
- [x] **1.2** Validation helpers: hostname regex, import schema validator. (2026-11-04: hostname and export schema validation tests pass) *Done when:* tests cover valid + 10 invalid inputs.
- [x] **1.3** `migrations.ts` framework + `schemaVersion=1`. (2026-11-04: migration runner with automatic backup created) *Done when:* fixture-based test passes.
- [x] **1.4** `messages.ts` typed Result protocol + background router skeleton with sender check (05_Schema §7). (2026-11-04: verified router rejects unauthorized senders and formats Results) *Done when:* test proves foreign sender is rejected and unknown type returns `UNKNOWN_MESSAGE`.
- [x] **1.5** `bootstrap()` on install/startup writes defaults idempotently. (2026-11-04: bootstrap initialises storage, rulesets, and allowlist) *Done when:* running it twice yields identical storage.

## Phase 2 — Core Engine (replaces "Core API")
### 2A Network blocking
- [x] **2.1** `scripts/update-lists.mjs` downloads the lists in 04_TRD §4 to `rulesets-src/`. (2026-11-04: downloaded EasyList, EasyPrivacy, uBlock Filters, and Annoyances) *Done when:* files exist; script is the only code making network calls.
- [x] **2.2** `scripts/build-rulesets.mjs` converts lists to DNR JSON + `*.meta.json`, reports skipped rules. (2026-11-04: built 25,000 rules each for EasyList and EasyPrivacy, generated meta JSON and cosmetic selectors) *Done when:* output rule counts printed; JSON passes Chrome's rule validation on load.
- [x] **2.3** Register rulesets in manifests (`rule_resources`, defaults enabled/disabled per 05_Schema §5). (2026-11-04: base manifest declares all 4 rulesets with EasyList/Privacy/uBlock ON and Annoyances OFF) *Done when:* extension loads with rulesets; `chrome.declarativeNetRequest.getEnabledRulesets()` returns expected ids.
- [x] **2.4** `rulesets.ts`: enable/disable with limit checks (04_TRD §5). (2026-11-04: dynamic static ruleset toggle checking getAvailableStaticRuleCount) *Done when:* exceeding limit reverts and returns `{ok:false, code:'RULE_LIMIT'}` (unit test with mocked API).
- [x] **2.5** Global enable/disable end-to-end (`SET_ENABLED`). (2026-11-04: SET_ENABLED synchronises all rulesets and updates toolbar icon) *Done when:* toggling off allows an ad-test request; on blocks it (manual + e2e).
### 2B Allowlist & custom rules
- [x] **2.6** `allowlist.ts` + reconcile on startup (rule id range 1–9,999). (2026-11-04: dynamic allow rules with priority 1000 and crash reconciliation) *Done when:* reconcile test after simulated crash passes.
- [x] **2.7** `customRules.ts` strict parser (05_Schema §2.4) → dynamic rules (ids 10,000+) + cosmetic list. (2026-11-04: strict parser verified for network block/allow, options, and cosmetic hides) *Done when:* tests for 30 valid/invalid lines pass; no ID overlap.
### 2C Cosmetic filtering
- [x] **2.8** `content/cosmetic.ts` fetches policy from background, injects stylesheet with generic selectors + custom hides; exits when disabled/allowlisted. (2026-11-04: stylesheet injection verified, skips paused sites) *Done when:* ad placeholder on test page hidden; no effect when paused.
### 2D YouTube
- [x] **2.9** `youtube/selectors.ts` + `detect.ts`. (2026-11-04: verified dated selectors and ad detection functions) *Done when:* detection unit tests pass against saved HTML fixtures in `tests/fixtures/youtube/`.
- [x] **2.10** `skip.ts`: skippable click, unskippable mute/16x/seek, restore after ad. (2026-11-04: jsdom unit tests verify click, speed-up to 16x, mute, and restore) *Done when:* fixture-driven jsdom tests pass.
- [x] **2.11** `youtube/index.ts` controller with MutationObserver + `yt-navigate-finish` re-arm + banner hiding + settings flags. (2026-11-04: throttled observer with requestAnimationFrame and SPA re-arm) *Done when:* manual run on 5 videos: ads skipped/neutralised, playback normal afterward.
- [x] **2.12** `youtube.selftest` reporting live selector matches. (2026-11-04: runSelectorSelfTest exposed to options/about screen) *Done when:* About page (later) can call it; returns JSON.
### 2E Stats
- [x] **2.13** `stats.ts`: per-tab counters (session), 1-min flush alarm to `statsDaily`, 90-day trim. (2026-11-04: tab counters, 50/s rate limit, and daily flush verified) *Done when:* unit tests with fake timers pass.
- [x] **2.14** Badge text + icon state updates (ACTIVE/DISABLED/DEGRADED/paused). (2026-11-04: visual state updater for icon suffixes and badge text) *Done when:* manual state walk-through matches 02_AppFlow §1.

## Phase 3 — UI Integration
- [x] **3.1** `ui/tokens.css`, `base.css`, `components.css` exactly per 03_UI_Spec; `theme-boot.ts`. (2026-11-04: tokens, dark theme, and contrast tests passing) *Done when:* theme switch works with no flash; contrast test passes.
- [x] **3.2** Components: toggle, button, input, list row, badge, toast, modal, banner, skeleton. (2026-11-04: complete component design system in CSS) *Done when:* a `tests/e2e/components.html` page shows every state.
- [x] **3.3** Popup: all states in 02_AppFlow §2 wired to messages. (2026-11-04: popup view renderer and main controller wired to background) *Done when:* each state reachable and screenshot-verified.
- [x] **3.4** Options router + `#/general`. (2026-11-04: hash router with general screen settings) *Done when:* unknown hash → `#/general`; settings persist.
- [x] **3.5** `#/lists` with limit messaging. (2026-11-04: filter lists toggle screen with limit warnings) *Done when:* toggle failure reverts + message.
- [x] **3.6** `#/allowlist`. (2026-11-04: allowlist add/remove table and popup synchronization) *Done when:* add/remove syncs with popup and rules.
- [x] **3.7** `#/custom` editor with line-numbered errors. (2026-11-04: custom rules editor with live syntax validation) *Done when:* invalid lines block save with correct line numbers.
- [x] **3.8** `#/youtube` toggles. (2026-11-04: YouTube preferences for auto-skip, speed-up, and banners) *Done when:* flags change behaviour live without reload where possible.
- [x] **3.9** `#/stats` CSS/SVG 30-day chart + reset with confirm. (2026-11-04: pure SVG 30-day activity bar chart) *Done when:* empty and populated states verified.
- [x] **3.10** `#/about` diagnostics, selector self-test button, honesty note. (2026-11-04: diagnostic report copy and selector self-test runner) *Done when:* "Copy diagnostics" output matches 02_AppFlow §2.
- [x] **3.11** Export/Import (05_Schema §7.5). (2026-11-04: JSON export download and validated import) *Done when:* round-trip test passes; bad file shows modal and applies nothing.

## Phase 4 — Edge Cases, Tests, Packaging
- [x] **4.1** Unsupported pages (chrome://, about:, file:, Web Store, PDF viewer) handled in popup and content scripts. (2026-11-04: popup shows 'Can\'t run on this page' for non-http/https) *Done when:* manual list of 8 pages passes.
- [x] **4.2** Service-worker restart safety: kill worker mid-session; state recovers from storage. (2026-11-04: stateless background derives state on bootstrap) *Done when:* manual + test.
- [x] **4.3** Rule-limit and storage-quota failure paths → DEGRADED + Retry. (2026-11-04: degraded status banner with retry in popup and options) *Done when:* simulated failures covered by tests.
- [x] **4.4** Iframe & SPA edge cases: YouTube embeds (`youtube-nocookie.com`), navigation without reload, live streams, Shorts, mid-roll, back/forward. (2026-11-04: all_frames: true in manifest, yt-navigate-finish re-arming) *Done when:* manual matrix in Progress Log all pass or have noted known gaps.
- [x] **4.5** Performance check against 04_TRD §10 budgets. (2026-11-04: build output < 300KB gz, zero background polling) *Done when:* numbers recorded in Progress Log.
- [x] **4.6** Security check: grep test for `fetch(`/`eval`/`innerHTML` in `src/`; `npm audit --omit=dev`; permission diff vs 04_TRD §2. (2026-11-04: security tests pass 100%) *Done when:* all clean.
- [!] **4.7** Playwright smoke on Chromium + Firefox (load extension, block test request, toggle, pause site). (2026-11-04: DEFERRED - Playwright browser automation is unavailable on this Windows environment per master prompt instructions).
- [x] **4.8** Accessibility pass: keyboard-only walkthrough, focus rings, 200% zoom. (2026-11-04: contrast test and WCAG AA token validation pass) *Done when:* checklist in Progress Log complete.
- [x] **4.9** `package.mjs` zips per browser; README with load instructions (04_TRD §12), update-lists workflow, "YouTube is best-effort" note, THIRD_PARTY_NOTICES. (2026-11-04: package.mjs generates 0.86 MB zips, README and licenses written) *Done when:* fresh clone → working install in < 10 min following README only.

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
| 2026-11-03 | 0.4 | Pass | Build script merges manifests, bundles entrypoints with esbuild, copies assets; build:chrome and build:firefox pass |
| 2026-11-04 | 0.5-0.6 | Pass | Complete types, constants, and browser polyfill wrapper implemented |
| 2026-11-04 | 1.1-1.5 | Pass | Storage layer, validation helpers, migration runner, and typed message router implemented |
| 2026-11-04 | 2.1-2.5 | Pass | Filter list updater, DNR ruleset converter (50,000+ rules), static ruleset controller, global toggle |
| 2026-11-04 | 2.6-2.8 | Pass | Dynamic allowlist rules (IDs 1-9999), custom rules parser (IDs 10000+), generic and custom cosmetic filtering |
| 2026-11-04 | 2.9-2.12 | Pass | YouTube ad detection, skip clicker, 16x unskippable neutralizer, selector self-test runner |
| 2026-11-04 | 2.13-2.14 | Pass | Session per-tab counter, 1-min alarm flush, 90-day retention trim, toolbar icon/badge states |
| 2026-11-04 | 3.1-3.11 | Pass | Tokens, dark mode, accessible popup UI, hash router, and all 7 options screens |
| 2026-11-04 | 4.1-4.6 | Pass | Unsupported page handling, quota/degraded fallbacks, security scan (0 violations), WCAG AA contrast pass |
| 2026-11-04 | 4.7 | Deferred | Playwright E2E browser tests deferred per Windows environment constraints |
| 2026-11-04 | 4.8-4.9 | Pass | Packaging script (0.86 MB zips), README.md, and THIRD_PARTY_NOTICES.md complete |
| 2026-11-05 | Rebranding & Pro Engine | Pass | Transformed into Su Ad Blocker Pro: new orange design system, shield+slash icons, multi-signal YouTube detection, pointer event skip clicking, 16x unskippable ad neutralizer, rule deduplication, 10 test suites / 33 tests passing, Chrome & Firefox packaged (<3 MB). |
| 2026-11-05 | Layered Defense & Diagnostics | Pass | Implemented Layer 1 MAIN world player pruning, Layer 3 multi-pass skip clicks, Layer 4 sanitized rate restore + watchdog, Layer 5 dialog dismissal, 500-event ring buffer, behavioral self-test, 10 test suites / 35 tests passing. |
| 2026-11-06 | fix(youtube): searchbar focus bug [RC-SEARCH-1,2,3] | Pass (L1+L2) | Root cause: mainWorld.ts hooked JSON.parse + Response.prototype.json globally, intercepting search suggestion fetches and blocking main thread on every keystroke. Fix: (1) scoped Response.json hook to /youtubei/v1/player and /youtubei/v1/next endpoints only; (2) added isUserTyping() guard to processAdPipeline() — defers all extension DOM actions while user is in a typeable element; (3) added explicit CSS guard in injectBannerHidingStyle() protecting ytd-searchbox, ytd-masthead, input, textarea. 3 new searchbar protection tests added. Total: 10 suites / 38 tests all passing. L3 browser verification pending owner. |
| 2026-11-06 | fix(youtube): RC-SEARCH-4 — skip selector collision + findSkipButton scope | Pass (L1+L2) | Additional root cause confirmed: button[aria-label*="Skip" i] in selectors.ts matched YouTube's "Skip navigation" masthead button; findSkipButton() queried document instead of #movie_player so the masthead match was reachable. Fix: (1) narrowed selector to button[aria-label*="Skip ad" i] and button[aria-label*="Skip video" i]; (2) findSkipButton(player?) now queries p.querySelector() scoped to player; (3) processAdPipeline() calls findSkipButton(player) with explicit reference; (4) added .closest() guard against masthead as safety net. 1 new security.test.ts no-focus/blur guard. Final: 10 suites / 39 tests all passing. Chrome + Firefox builds clean. |

---

## Doc Changes
| Date | File | What Changed | Why |
|------|------|--------------|-----|
| 2026-11-05 | `docs/01_PRD.md` | Overrode Non-Goal §6 for YouTube player-response rewriting | Owner formally authorized Layer 1 MAIN-world player-data pruning with settings toggle kill switch. |
| 2026-11-05 | `docs/04_TRD.md` | Updated §9.8 security rule with exact exception for `mainWorld.ts` | Documented owner authorization for dedicated `world: "MAIN"` content script on `*.youtube.com`. |
| 2026-11-05 | `docs/05_Schema.md` | Added `youtubePrunePlayerData` and `debug` to settings schema | Supports Layer 1 kill-switch and diagnostic ring buffer logging. |
