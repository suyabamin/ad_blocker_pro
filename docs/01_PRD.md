# 01_PRD — Hush (Personal Ad Blocker Extension)

> Status: LOCKED for MVP. Any change requires editing this file first, then `06_Plan.md`.

## 1. Core Problem
Ads, trackers, and especially YouTube video ads degrade browsing. Existing blockers are either restricted (uBlock Origin on Chrome under Manifest V3), closed, or bundled with features the owner does not want. The owner wants a **personal, free, auditable** blocker that runs on every major browser with one shared codebase.

## 2. Target Persona
**Single user: the owner (solo developer, non-commercial use).**
- Browsers: Chrome, Edge, Brave, Opera (Chromium) and Firefox. Safari is stretch (needs macOS + Xcode).
- Technical comfort: can load an unpacked extension; uses an AI coding agent to build.
- Cost constraint: **$0**. No paid APIs, servers, or services.
- Distribution: **sideload only** (unpacked / temporary add-on). No store publishing in MVP.

## 3. Product Principles
1. Zero cost, zero backend, zero telemetry.
2. One codebase, browser differences isolated in `src/shared/browser.ts` and per-browser manifests.
3. Reuse public filter lists. Do not hand-write thousands of rules.
4. Be honest about YouTube: blocking is best-effort and needs maintenance. No "lifetime guarantee" claims anywhere in UI or docs.

## 4. MVP User Stories
| ID | As the owner, I want to... | Acceptance Criteria |
|----|----------------------------|---------------------|
| US-01 | Block ad and tracker network requests on all sites | Rulesets from EasyList + EasyPrivacy are enabled; a known test page (e.g. an ad-test page) shows ad requests blocked; counter increments |
| US-02 | Hide leftover empty ad containers (cosmetic filtering) | Generic cosmetic selectors applied via content script; no layout break on top-20 news sites tested manually |
| US-03 | Skip/neutralise YouTube video ads | Skippable ads auto-skip within 1s of Skip button appearing; unskippable ads are muted + sped to 16x and seeked to end; banner/overlay/feed ad slots hidden |
| US-04 | Pause blocking on the current site | Popup toggle creates an allowlist entry; page reload shows ads; toggle again re-enables |
| US-05 | Turn the blocker fully on/off | Global toggle disables all rulesets and content scripts take no action; icon shows disabled state |
| US-06 | See how many things were blocked | Popup shows blocked count for this tab and today; options page shows 30-day history |
| US-07 | Add my own block/hide rules | Options → Custom Rules accepts valid filter syntax subset; invalid lines are rejected with a line-numbered error |
| US-08 | Enable/disable individual filter lists | Options → Filter Lists toggles each bundled ruleset |
| US-09 | Export/import my settings | JSON file download/upload round-trips without loss |
| US-10 | Run the same extension in Chrome and Firefox | `npm run build:chrome` and `npm run build:firefox` both produce loadable builds passing the smoke test |

## 5. Success Metrics (personal, measurable)
- ≥ 90% of requests on a reference ad-test page blocked.
- YouTube: ≥ 95% of ads skipped or neutralised within 2s over a 20-video manual test, on the day of release.
- Page load overhead from the extension < 50 ms (measured with DevTools Performance on 5 sites).
- Zero console errors from the extension on the 10 test sites.
- Build from clean clone in < 60 s; both browser builds pass smoke tests.
- Extension package < 5 MB.

## 6. Out of Scope (Non-Goals) — STRICT
The agent MUST NOT build any of the following without the owner editing this section:
- Any backend, server, database, user accounts, login, or cloud sync.
- Telemetry, analytics, crash reporting, or any network call other than fetching filter list sources during `npm run update-lists` (build time).
- Paid services, paid APIs, or paid dependencies.
- Chrome Web Store / AMO / Edge Add-ons publishing, store listings, or privacy-policy pages.
- Mobile browsers (Chrome Android, Firefox Android, Safari iOS) in MVP.
- Bypassing paywalls, anti-adblock walls on arbitrary sites, or DRM.
- Auto-updating the extension's own code or loading remote JavaScript (forbidden by MV3 and by our security rules).
- Dynamic scriptlet injection from remote filter lists (`##+js(...)`).
- Whitelisting/"acceptable ads" programs or monetisation of any kind.
- A promise or UI claim of "permanent / lifetime" YouTube blocking.
- Redistribution of the extension to other people (YouTube ToS and legal exposure; personal use only).
- Rewriting YouTube's player-response JSON (fragile, high-maintenance). Revisit only as a post-MVP experiment.

## 7. Known Risks
| Risk | Mitigation |
|------|-----------|
| YouTube changes DOM/class names | All YouTube selectors in one file `src/content/youtube/selectors.ts`; manual regression checklist in plan |
| MV3 rule limits | Read limits at runtime via `getAvailableStaticRuleCount()`; only enable lists that fit |
| Static rulesets can't update at runtime | Update = rebuild with `npm run update-lists` and reload extension |
| YouTube ToS prohibits ad-blocking circumvention | Personal use only; documented as accepted owner risk |
