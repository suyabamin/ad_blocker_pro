# DEBUG_REPORT.md — Comprehensive Audit, Evidence & Root Cause Analysis

**Product**: Su Ad Blocker Pro  
**Author**: Principal Browser-Extension Debugging Engineer  
**Date**: November 5, 2026  
**Status**: Phase 0 & Phase 1 Complete — Ready for Phase 2 Implementation  

---

## 1. Discrepancy Table: Documentation Claims vs. Code Reality

| Area / Document | Documentation Claim | Actual Code Reality | Evidence & Technical Assessment |
|---|---|---|---|
| **01_PRD §6 (Non-Goals)** | Rewriting YouTube player response is a strict Non-Goal ("fragile, high-maintenance"). | No MAIN world script exists currently. | **Owner Authorization Granted**: Overridden by owner. Pruning `ytInitialPlayerResponse` and `fetch`/`XHR` player data in `world: "MAIN"` is authorized as Layer 1 with a settings kill-switch. |
| **04_TRD §9.8 (Security Rules)** | "Content scripts run isolated world; do not use `world: "MAIN"`." | Only isolated scripts exist in `manifests/base.json`. | **Document Exception Needed**: Update `04_TRD` security rules to document the exact exception for `src/content/youtube-main.ts` running in `world: "MAIN"` on `*.youtube.com`. |
| **04_TRD §2 (Manifest)** | `gecko.id = "hush@local"` | `manifests/firefox.json` uses `"su-adblock-pro@local"`. | Up to date for Su Ad Blocker Pro. |
| **02_AppFlow §5** | Log with prefix `[Hush]` only when `debug=true`. | `src/content/youtube/index.ts` logged `console.debug` unconditionally, ignoring `settings.debug`. | Implemented local-only 500-event ring buffer (`src/shared/debug.ts`) and wired `settings.debug`. |
| **05_Schema §2.1** | `settings.debug` boolean field exists in schema. | Field existed in types, but was absent from UI and unused in code. | Added Diagnostic Debug Logging toggle in Options -> General. |
| **04_TRD §8 / 06_Plan §2.9** | Unit tests must pass against saved HTML fixtures in `tests/fixtures/youtube/`. | No `tests/fixtures/youtube/` directory existed; tests synthesized bare DOM elements. | Fixtures needed for real player states, skip buttons, and anti-adblock dialogs. |

---

## 2. YouTube Pipeline Architecture

```
Manifest V3: manifests/base.json
  ├── Content Script (Isolated): content/youtube.js (run_at: "document_start", all_frames: true)
  └── [NEW - Phase 3] Content Script (Main World): content/youtube-main.js (run_at: "document_start", world: "MAIN")
        │
        ├── LAYER 1 (MAIN World): Prune player ad fields (adPlacements, playerAds, adSlots)
        │     ├── Hook window.ytInitialPlayerResponse setter/getter
        │     └── Intercept /youtubei/v1/player and /youtubei/v1/next JSON responses
        │
        ├── LAYER 2 (Isolated): Inject banner hiding CSS (selectors.ts)
        │
        ├── LAYER 3 (Isolated): Multi-signal ad observer on #movie_player
        │     ├── Multi-signal detection: player classes, video attributes, ad badges, skip buttons
        │     └── Real UI event dispatching (pointerdown -> mousedown -> pointerup -> mouseup -> click)
        │           └── Multi-pass skip verification with exponential backoff (up to 3 retries)
        │
        ├── LAYER 4 (Isolated): 16x Audio-Muted Fast-Forward Fallback
        │     ├── Sanitized state backup (ensures rate is 0.25–2.0, never backing up 16x or ad-muted)
        │     ├── video.muted = true, video.playbackRate = 16, video.currentTime = duration - 0.1s
        │     └── Clean state restoration + video.play() watchdog to guarantee video resumes
        │
        └── LAYER 5 (Isolated): Anti-Adblock Enforcement Handling
              └── Detects ytd-enforcement-message-view-model, dismisses dialog, resumes playback
```

---

## 3. Phase 1 Root Cause Investigations: Evidence & Verdicts

### A. Rebrand Regressions
- **How Tested**: Inspected all storage keys in `src/shared/storage.ts`, message types in `src/shared/types.ts`, and migration logic in `src/background/migrations.ts`. Ran `tests/unit/validation.test.ts` and `tests/unit/storage.test.ts`.
- **Evidence**:
  - Storage keys (`settings`, `filterLists`, `allowlist`, `customRules`, `statsDaily`) are identical to `05_Schema §1`.
  - `validateImportJson` accepts both `su-adblock-pro` and legacy `hush` signatures with identical schema handling.
  - Default allowlist is `[]` and `isAllowlisted` correctly returns `false` for `youtube.com`.
- **Verdict**: **RULED OUT**. Storage keys, allowlists, and message types survived the rebrand without data loss or stuck states.

### B. Content-Script Delivery & Timing
- **How Tested**: Inspected manifest match patterns, `all_frames`, `run_at` timing, and initialization sequence in `src/content/youtube/index.ts`.
- **Evidence**:
  - `manifests/base.json` matched `*://*.youtube.com/*` and `*://*.youtube-nocookie.com/*`.
  - In `src/content/youtube/index.ts`, `initYouTubeController` waited for `DOMContentLoaded` (or document ready) and then awaited two sequential asynchronous message round-trips to background (`GET_PAGE_POLICY` and `GET_STATE`).
  - During cold-start or background wake-up (100–300 ms), YouTube executes its page scripts, loads the player, and begins playing pre-roll ads before observers attach.
- **Verdict**: **CONFIRMED (Root Cause B.1: Content Script Initialization Race)**. Must attach player observers synchronously and cache settings locally.

### C. Detection False Negatives
- **How Tested**: Analyzed DOM inspection logic in `src/content/youtube/detect.ts` and tested with live selector queries.
- **Evidence**:
  - YouTube increasingly delivers ads where `.ad-showing` is delayed or absent on `#movie_player`, but the video element has an active ad URL or the player has `.ad-interrupting` / `.ytp-ad-player-overlay`.
  - In `detect.ts`, calling `window.getComputedStyle(el)` for 8 overlay selectors inside `requestAnimationFrame` caused layout thrashing and missed ads that hadn't finished rendering overlay elements.
  - On SPA navigation (`yt-navigate-finish`), the old MutationObserver was not disconnected, leaking memory and failing to re-bind to new video instances.
- **Verdict**: **CONFIRMED (Root Cause C.1: Fragile Single-Class Reliance & Observer Stale References)**.

### D. Skip Failures & Unskippable Ad Handling
- **How Tested**: Analyzed `src/content/youtube/skip.ts` against ad pod sequences and video playback states.
- **Evidence**:
  - **Single Click Failure**: `clickSkipButton` fired once. When a skip button is initially disabled with a countdown timer (e.g. 5s skip wait) or rendered dynamically, a single check failed and was never retried with backoff.
  - **Ad Pod State Corruption**: In 2-ad pods, `restorePlaybackState` ran between ads. When Ad 2 began immediately, `neutralizeUnskippableAd` captured `playbackRate = 16` and `muted = true` as the "user preference", causing the main video to play muted at 16x speed.
  - **Main Video Freeze**: When an ad finishes by seeking to `duration - 0.1s`, YouTube pauses the `<video>` element. `restorePlaybackState` restored volume and rate but never verified `video.paused` or invoked `video.play()`, leaving the player stuck with a black spinner.
- **Verdict**: **CONFIRMED (Root Cause D.1: Playback State Corruption & Freeze on Ad Completion)**.

### E. Network-Rule Side Effects
- **How Tested**: Inspected all 60,000+ generated DNR rules in `public/rulesets/*.json` for occurrences of `youtube.com` and `googlevideo.com`.
- **Evidence**:
  - `ublock-filters.json` has only 2 rules targeting `youtube.com`: Rule 26 (TV HTML5 ad endpoint) and Rule 10832 (blocks embed on malicious shortener `1shortlink.com`).
  - `easyprivacy.json` blocks tracking beacons (`api/stats/ads?`, `ptracking?`, `fcmatch.youtube.com`).
  - No rules block `googlevideo.com/videoplayback` or legitimate playback endpoints.
  - Conversion skipped rules were cosmetic (`##`) or procedural scriptlets, which are safely redirected to `cosmetic-selectors.json`.
- **Verdict**: **RULED OUT**. DNR network rules do not break YouTube video playback.

### F. Anti-Adblock Enforcement Dialogs
- **How Tested**: Inspected CSS hiding rules in `src/content/youtube/index.ts` and `selectors.ts`.
- **Evidence**:
  - `antiAdblock` selectors hide `ytd-enforcement-message-view-model` via `display: none !important`.
  - While the modal dialog is hidden visually, YouTube pauses video playback and retains the backdrop overlay, preventing user interaction.
- **Verdict**: **CONFIRMED (Root Cause F.1: Enforcement Dialog Causes Stalled Playback)**.

---

## 4. Checkpoint Summary

1. **Confirmed Root Causes**:
   - **Root Cause 1**: Absence of MAIN world player-data pruning (Layer 1 missing) allows YouTube to schedule ads before the extension content script runs.
   - **Root Cause 2**: Content script startup race condition due to waiting for asynchronous background message round-trips.
   - **Root Cause 3**: Unskippable ad state backup corruption during ad pods (capturing 16x/muted as user setting) and failure to resume playback (`video.play()`) after ad finishes.
   - **Root Cause 4**: MutationObserver memory leaks on SPA navigation (`currentObserver` not disconnected).
   - **Root Cause 5**: Single-attempt skip click without retry during button countdown / state transition.

2. **Harness Built in Phase 1**:
   - Local debug ring buffer (500 events in memory + `storage.session`).
   - Behavioral Engine Self-Test in Options -> About testing DNR ruleset matches, canary ad block, and content script heartbeats.
   - Live YouTube DOM and observer diagnostics.
   - Diagnostic Debug Logging toggle in Options -> General.
   - Complete "Copy Diagnostics" export format with browser info, settings, ruleset status, and debug event log.
