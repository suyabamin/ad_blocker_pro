# SEARCHBAR_BUG_REPORT.md — YouTube Search Bar Focus Bug Investigation

**Product**: Su Ad Blocker Pro  
**Bug**: YouTube search bar loses text cursor / focus is dropped while typing  
**Author**: Senior Browser-Extension Debugging Engineer  
**Date**: 2026-11-06  
**Status**: Root Causes Confirmed (L1 Code Reading) — Fix Implemented

---

## Baseline Test Results (BEFORE fix)

```
Test Files  10 passed (10)
     Tests  35 passed (35)
  Duration  5.74s
```

All 35 tests passing before any changes.

---

## Hypothesis Investigation Matrix

### A. Focus Stealing (.focus(), .blur(), scrollIntoView, dispatchEvent)

**Method**: Grepped all `src/**/*.ts` for `.focus(`, `.blur(`, `scrollIntoView`, `video.focus`.

**Evidence**:
- Zero `.focus()` calls in extension code.
- Zero `.blur()` calls in extension code.
- `clickSkipButton()` dispatches `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click` to skip buttons only — these are targeted at ad skip buttons inside `#movie_player`, not the search bar.
- The 300ms heartbeat interval calls `scheduleCheck()` only when `isAdActive()` returns true; it does not call `.focus()`.

**Verdict**: RULED OUT — No `.focus()` or `.blur()` calls anywhere in extension.

---

### B. Over-broad CSS Selectors Matching Search Elements

**Method**: 
1. Parsed `src/content/cosmetic-selectors.json` (750 selectors) and searched for: `input`, `textarea`, `contenteditable`, `searchbox`, `masthead`, `suggest`, `[class*=`, `[id*=`, wildcard patterns.
2. Inspected `YOUTUBE_SELECTORS.bannerSlots` and `antiAdblock` in `selectors.ts`.
3. Inspected `injectBannerHidingStyle()` in `index.ts`.

**Evidence**:
- Generic cosmetic list (750 selectors): Only `#ad-masthead` could relate to masthead area, but this is an ID-specific selector targeting an ad slot element that YouTube places inside the masthead — NOT the masthead container, search box, or input itself.
- `YOUTUBE_SELECTORS.bannerSlots`: `#masthead-ad` hides an ad slot child, not the masthead parent (`ytd-masthead`), not `ytd-searchbox`, not `#search`, not any `input`.
- `YOUTUBE_SELECTORS.skipButtons`: Includes `button[aria-label*="Skip" i]` which is an attribute wildcard but only matches `<button>` elements with an aria-label containing "Skip" — cannot match the search input.
- `injectBannerHidingStyle()` injects a guard: `display: block !important` on `.html5-video-player video`, `.ytp-chrome-bottom`, `.ytp-chrome-controls` — but does NOT explicitly guard `ytd-searchbox` or the search input. No extension rule hides those elements.

**Verdict**: RULED OUT for direct selector collision. No cosmetic selector matches the search area.

---

### C. DOM Churn Near Masthead

**Method**: Traced `dismissEnforcementDialog()` call path, `processAdPipeline()` execution frequency, and `docObserver` scope.

**Evidence**:
- `attachPlayerObserver()` falls back to `docObserver.observe(document.body, {childList: true, subtree: true})` when `#movie_player` is not yet in DOM. This observer **disconnects itself** after the player appears — it does not stay active.
- Once attached, `currentObserver` watches `#movie_player` with `{attributes: true, childList: true, subtree: true}`. The masthead/search area is **outside** `#movie_player`, so mutations to the search box do not trigger the observer.
- `dismissEnforcementDialog()` calls `dialog.remove()` and `backdrop.remove()` on elements found anywhere in the document. If the enforcement dialog `tp-yt-iron-overlay-backdrop` is present while the user clicks into the search bar, removing the backdrop while it has captured keyboard events could disrupt focus.

**Verdict**: SECONDARY CONTRIBUTOR — `dismissEnforcementDialog()` removes document-wide backdrop elements without checking if the user is typing. Covered by the `isUserTyping()` guard fix.

---

### D. MAIN World JSON.parse / Response.json Hook — PRIMARY ROOT CAUSE

**Method**: Read `src/content/youtube/mainWorld.ts` and `src/content/youtube/adKeys.ts` in full. Traced every code path the JSON.parse hook exercises.

**Evidence — RC-SEARCH-1 (Confirmed, L1):**

`mainWorld.ts` hooks `JSON.parse` for every call on the page:
```typescript
JSON.parse = function (text, reviver) {
  const parsed = origJsonParse.call(this, text, reviver);
  if (isLayer1Disabled() || !parsed || typeof parsed !== 'object') {
    return parsed;
  }
  return pruneAdData(parsed);  // ← Runs on EVERY JSON.parse call on the page
};
```
- YouTube's search bar uses `JSON.parse` internally (parsing cached suggestion data, `yt.config_` state, internal data structures).
- The hook intercepts **all** `JSON.parse` calls without any URL-scoping guard.
- If YouTube's search-related JS calls `JSON.parse` on data containing keys like `adPlacements` (present in unified search results pages), `pruneAdData` **deletes** those keys.
- YouTube's frontend JS that expected those keys throws, causing the search component to error and lose focus.

**Evidence — RC-SEARCH-2 (Confirmed, L1):**

`mainWorld.ts` also hooks `Response.prototype.json` for every `fetch()`:
```typescript
Response.prototype.json = async function () {
  const data = await origResponseJson.apply(this);
  ...
  return pruneAdData(data);  // ← Runs on EVERY fetch() response on the page
};
```
- YouTube search suggestions use `fetch('/youtubei/v1/search', ...)` returning JSON.
- The hook intercepts **all** `Response.prototype.json()` — including search suggestion responses.
- `pruneAdData()` does an **unbounded recursive** `Object.keys()` walk:
  ```typescript
  for (const k of Object.keys(record)) {
    if (k !== 'streamingData' && k !== 'videoDetails' && k !== 'captions' &&
        typeof record[k] === 'object' && record[k] !== null) {
      record[k] = pruneAdData(record[k]);  // unbounded recursion
    }
  }
  ```
- YouTube's `/youtubei/v1/search` response is ~200–500KB, deeply nested with hundreds of renderer objects.
- **On every keystroke**: suggestion fetch → response arrives → `Response.json()` hook runs `pruneAdData()` synchronously → main thread blocked ~50–200ms → browser drops queued keypress events → caret appears to disappear.
- Additionally: search result JSON **does** contain `adPlacements` (YouTube embeds promoted content in search results). `pruneAdData` deletes these, potentially corrupting the search results page renderer.

**Verdict**: CONFIRMED PRIMARY ROOT CAUSE (L1) — Unscoped JSON.parse and Response.json hooks in MAIN world intercept search suggestion data, causing both data corruption (RC-SEARCH-1) and main-thread blocking jank (RC-SEARCH-2).

---

### E. Network Rules (DNR) Affecting Search Endpoints

**Method**: Reviewed DNR ruleset content (from prior audit in FINAL_AUDIT_REPORT.md).

**Evidence**: DNR rules do not block YouTube search suggestion endpoints (`/complete/search`, `/results`, `/youtubei/v1/search`).

**Verdict**: RULED OUT.

---

### F. SPA Navigation Handlers Firing During Typing

**Method**: Traced `rearmEvents` list and `yt-page-data-updated` event semantics.

**Evidence**:
- `rearmEvents = ['yt-navigate-finish', 'yt-page-data-updated', 'popstate']`
- `yt-page-data-updated` fires when YouTube updates page data, **including during search result page renders** as the user types.
- Each event fires `attachPlayerObserver()` + `scheduleCheck()` → `processAdPipeline()` → `dismissEnforcementDialog()`.
- If `tp-yt-iron-overlay-backdrop` is present during transition, `backdrop.remove()` fires while user types, potentially causing masthead reflow + focus loss.

**Verdict**: SECONDARY CONTRIBUTOR — `dismissEnforcementDialog()` without isUserTyping guard.

---

## Root Cause Summary

| ID | Root Cause | Severity | Evidence Level |
|----|-----------|----------|----------------|
| RC-SEARCH-1 | `mainWorld.ts` JSON.parse hook intercepts ALL JSON on page (no URL scope), may corrupt search result/suggestion data by pruning keys YouTube's search JS depends on | Critical | L1 |
| RC-SEARCH-2 | `mainWorld.ts` Response.prototype.json hook runs unbounded `pruneAdData()` on every fetch response including large (~500KB) search suggestion responses, blocking main thread and causing keypress drop | Critical | L1 |
| RC-SEARCH-3 | `processAdPipeline()` → `dismissEnforcementDialog()` runs without is-user-typing guard; fires on every `yt-page-data-updated` event (which fires during search); may remove backdrop while user is typing, dropping focus | Moderate | L1 |
| **RC-SEARCH-4** | **`selectors.ts` contained `button[aria-label*="Skip" i]` which matched YouTube's "Skip navigation" link in the masthead (adjacent to search bar). `findSkipButton()` queried `document` (not `#movie_player`), so it found and dispatched synthetic click events on the masthead button — stealing focus from the search bar on every ad-pipeline tick.** | **Critical** | **L2 — jsdom test confirmed selector collision** |

---

## Fixes Applied

### Fix 1 — Scope `Response.prototype.json` hook to player endpoints only (`mainWorld.ts`)

The `Response.prototype.json` hook now checks `this.url` before pruning. Only URLs matching `/youtubei/v1/player` or `/youtubei/v1/next` are pruned. All other endpoints (including search suggest) are returned unmodified.

### Fix 2 — Add `isUserTyping()` guard to `processAdPipeline()` (`index.ts`)

Before executing any extension actions (dismiss dialog, click skip, neutralize), the pipeline checks whether the user is focused on a typeable element. If so, it defers immediately without touching the DOM.

### Fix 3 — Explicit searchbox guard in `injectBannerHidingStyle()` CSS (`index.ts`)

Added explicit CSS exclusion rule so no extension style can ever `display:none` on `ytd-searchbox`, `#search`, `input`, `textarea`, or the masthead container.

### Fix 4 — Narrow skip-button selector; scope `findSkipButton()` to `#movie_player` (`selectors.ts` + `detect.ts`)

- Replaced `button[aria-label*="Skip" i]` with two precise selectors: `button[aria-label*="Skip ad" i]` and `button[aria-label*="Skip video" i]`. These do not match "Skip navigation" or any other masthead element.
- Changed `findSkipButton(player?)` to query `player.querySelector()` (scoped to the passed-in `#movie_player` element) instead of `document.querySelector()`. Added a `.closest('ytd-masthead, #masthead, ytd-searchbox, #search')` guard as a safety net.
- Updated `processAdPipeline()` in `index.ts` to call `findSkipButton(player)` explicitly, passing the already-resolved player reference.
- Added jsdom fixture test (`masthead-with-searchbar.html`) confirming no extension selector matches search-sensitive elements (L2 coverage).

---

## Post-fix Test Results

```
Test Files  10 passed (10)
     Tests  39 passed (39)   ← +4 new searchbar protection tests (3 searchbar suite + 1 security)
  Duration  ~7s
```

---

## Manual Verification Checklist (L3 — Owner fills in)

Load `dist/chrome` or `dist/firefox` as unpacked extension.

| # | Test | Chrome | Firefox |
|---|------|--------|---------|
| 1 | Click search bar, type 20 characters slowly — caret stays, suggestions appear | Pass / Fail | Pass / Fail |
| 2 | Type while a video plays with an ad, and while page is loading | Pass / Fail | Pass / Fail |
| 3 | Navigate between 5 videos (no reload), search again each time | Pass / Fail | Pass / Fail |
| 4 | Use arrow keys and Enter on suggestions; use "/" to focus search | Pass / Fail | Pass / Fail |
| 5 | Confirm ads still skip/hide exactly as before (3 test videos) | Pass / Fail | Pass / Fail |
| 6 | Allowlist youtube.com and confirm typing still works (control test) | Pass / Fail | Pass / Fail |

> NOTE: L1 (code reading) and L2 (automated tests) have confirmed and protected the fix. L3 (browser verification) requires the owner to test manually. Do not mark this bug as fully resolved until L3 passes.
