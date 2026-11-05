# YouTube Repair Runbook (10-Minute Rapid Fix Guide)

**Product**: Su Ad Blocker Pro  
**Target Component**: YouTube 5-Layer Defense Engine  
**Maintainer**: Solo Developer / AI Coding Agent  

---

## 1. When YouTube Alters Ad Delivery or Player Markup

YouTube frequently tests and rolls out new DOM structures, player class names, or anti-adblock scripts. Because Su Ad Blocker Pro uses a **5-Layer Defense Architecture**, if one layer degrades, the others continue protecting the user. When an update bypasses existing selectors or ad keys, follow this standard 10-minute repair procedure.

---

## 2. Step-by-Step 10-Minute Repair Procedure

### Step 1: Collect Diagnostics (1 minute)
1. Open YouTube in the browser where the ad played.
2. Click the **Su AdBlock Pro** toolbar icon → Click the **Settings (gear)** icon.
3. In the sidebar, select **About & Diagnostics**.
4. Click **Run Behavioral Self-Test** to inspect active DOM selectors and observer health.
5. Click **Copy Diagnostics** (copies complete telemetry-free system data and the last 100 debug events).
6. (Optional) If **Diagnostic Debug Logging** was enabled in General Settings, click **Copy Debug Log** to capture exact event timestamps and stage outcomes.

### Step 2: Determine Which Layer Needs Updating (2 minutes)
Inspect the copied diagnostics:
- **Layer 1 Failure (Player Data Pruning)**: Did YouTube introduce a new ad container key inside `ytInitialPlayerResponse`?
  - *Symptom*: Ads are scheduled before video start.
  - *File to edit*: [`src/content/youtube/adKeys.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/adKeys.ts).
  - *Fix*: Add the new ad key name to `YOUTUBE_AD_KEYS`.
- **Layer 2 Failure (Cosmetic Banners)**: Did YouTube change banner element tag names?
  - *Symptom*: Homepage masthead or sidebar banner is visible.
  - *File to edit*: [`src/content/youtube/selectors.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/selectors.ts) under `bannerSlots`.
  - *Fix*: Add the new element tag/class (e.g. `ytd-statement-banner-renderer`).
- **Layer 3 Failure (Skip Button)**: Did YouTube change the skip button class or DOM hierarchy?
  - *Symptom*: Skip button appears on screen, but is not clicked automatically.
  - *File to edit*: [`src/content/youtube/selectors.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/selectors.ts) under `skipButtons`.
  - *Fix*: Inspect the button element using browser DevTools (right-click button → Inspect), copy its class or attribute, and prepend it to `skipButtons`.
- **Layer 4 Failure (Unskippable Acceleration)**: Did YouTube change the player container class?
  - *Symptom*: Video ad plays at 1x speed without muting.
  - *File to edit*: [`src/content/youtube/selectors.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/selectors.ts) under `adPlayerClasses` or `adOverlaySignals`.
- **Layer 5 Failure (Anti-Adblock Enforcement)**: Did YouTube change the modal dialog tag?
  - *Symptom*: Black overlay or "Ad blockers violate Terms" popup appears.
  - *File to edit*: [`src/content/youtube/selectors.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/selectors.ts) under `antiAdblock`.

### Step 3: Edit Selector or Key Definitions (2 minutes)
All YouTube selectors and ad keys live strictly in **two files only**:
1. [`src/content/youtube/selectors.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/selectors.ts)
2. [`src/content/youtube/adKeys.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/adKeys.ts)

Always add a comment noting the date verified (e.g. `// verified on 2026-11-05`).

### Step 4: Refresh Test Fixtures & Run Verification (3 minutes)
1. If the DOM markup changed, save an updated sanitized snippet to [`tests/fixtures/youtube/`](file:///d:/su_pro_ad_blocker/tests/fixtures/youtube/).
2. Run the test and validation pipeline:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
3. Ensure all tests pass.

### Step 5: Rebuild & Reload Extension (2 minutes)
1. Run the build commands:
   ```bash
   npm run build:chrome
   npm run build:firefox
   npm run package
   ```
2. In Chrome/Edge: Navigate to `chrome://extensions`, locate **Su AdBlock Pro**, and click the **Reload (circular arrow)** button.
3. In Firefox: Reload the temporary add-on under `about:debugging`.

---

## 3. Template Prompt to Paste to the AI Coding Agent

When YouTube breaks again in the future, copy and paste the following prompt directly into chat:

```markdown
# YOUTUBE REPAIR REQUEST FOR SU AD BLOCKER PRO

YouTube has updated its player or ad delivery mechanics, and ads are not being blocked as expected.

Here are the diagnostics copied from Options -> About -> Copy Diagnostics:

<PASTE_COPIED_DIAGNOSTICS_HERE>

Please perform the following:
1. Review the diagnostics and identify which layer failed (Layer 1 pruning, Layer 2 cosmetic, Layer 3 skip button, Layer 4 unskippable, or Layer 5 enforcement).
2. Update ONLY src/content/youtube/selectors.ts or src/content/youtube/adKeys.ts with the updated selectors or keys, adding a "verified on YYYY-MM-DD" comment.
3. Update tests/fixtures/youtube/ if markup changed.
4. Run npm run lint, npm run typecheck, and npm test.
5. Rebuild for Chrome and Firefox (npm run build:chrome; npm run build:firefox; npm run package).
6. Report the changes clearly with the verification output.
```

---

## 4. Known Regressions & Resolutions

### Search Bar Focus Loss (Resolved 2026-11-06)

**Symptom**: YouTube search bar loses focus or the text cursor/caret disappears while typing. Suggestions may not appear. This occurs immediately after installing the extension.

**Root Cause** (see [`docs/SEARCHBAR_BUG_REPORT.md`](file:///d:/su_pro_ad_blocker/docs/SEARCHBAR_BUG_REPORT.md)):

| ID | Root Cause | Location |
|----|-----------|----------|
| RC-SEARCH-1 | `mainWorld.ts` hooked `JSON.parse` globally — intercepted all JSON on page including search data, potentially corrupting search result objects by pruning keys YouTube's search JS depends on | `src/content/youtube/mainWorld.ts` |
| RC-SEARCH-2 | `mainWorld.ts` hooked `Response.prototype.json` globally — ran unbounded `pruneAdData()` recursion on every fetch response including large (~300 KB) search suggestion responses, blocking the main thread on every keystroke | `src/content/youtube/mainWorld.ts` |
| RC-SEARCH-3 | `processAdPipeline()` → `dismissEnforcementDialog()` fired without an is-user-typing guard on every `yt-page-data-updated` event (which fires during search); could remove DOM backdrops while user was typing | `src/content/youtube/index.ts` |
| RC-SEARCH-4 | `selectors.ts` contained `button[aria-label*="Skip" i]` which matched YouTube's "Skip navigation" link in the masthead. `findSkipButton()` queried `document` (not `#movie_player`), so it found and dispatched synthetic click events on the masthead button — stealing focus from the search bar on every ad-pipeline tick | `src/content/youtube/selectors.ts` + `detect.ts` |

**Fixes Applied** (2026-11-06):

1. **[`mainWorld.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/mainWorld.ts)** — `Response.prototype.json` hook now checks `this.url` via `isPlayerEndpoint()`. Only URLs matching `/youtubei/v1/player` or `/youtubei/v1/next` are pruned. All other endpoints (search, config, etc.) are returned unmodified.

2. **[`index.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/index.ts)** — Added `isUserTyping()` function that checks `document.activeElement` for `input`, `textarea`, `select`, `contenteditable`, or any element inside `ytd-searchbox / #search / ytd-masthead`. Added guard at the very top of `processAdPipeline()`: if `isUserTyping()` is true, the pipeline returns immediately without touching the DOM.

3. **[`index.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/index.ts)** `injectBannerHidingStyle()` — Added explicit CSS safety-net guard (`display: revert !important; visibility: revert !important`) on `ytd-searchbox`, `ytd-masthead`, `#search`, `#masthead`, `#masthead-container`, `input`, `textarea`, and `[contenteditable="true"]`.

4. **[`selectors.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/selectors.ts)** — Replaced broad `button[aria-label*="Skip" i]` with precise `button[aria-label*="Skip ad" i]` and `button[aria-label*="Skip video" i]` to avoid matching masthead navigation buttons.

5. **[`detect.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/detect.ts)** — `findSkipButton(player?)` now queries `player.querySelector()` (scoped to `#movie_player`) instead of `document.querySelector()`. Added `.closest('ytd-masthead, #masthead, ytd-searchbox, #search')` guard as extra safety net.

6. **[`index.ts`](file:///d:/su_pro_ad_blocker/src/content/youtube/index.ts)** `processAdPipeline()` — Updated call from `findSkipButton()` to `findSkipButton(player)` to explicitly pass the already-resolved player reference.

**How to Recognize Future Recurrence**:
- If YouTube changes player endpoint URL patterns, update `PLAYER_URL_PATTERNS` in `mainWorld.ts`.
- If `isUserTyping()` is removed or the guard in `processAdPipeline()` is deleted, the bug will return.
- If new skip-button selectors are added with broad wildcards (e.g., `[aria-label*="Skip"]`), always verify against masthead HTML using `tests/fixtures/youtube/masthead-with-searchbar.html`.
- Run `tests/unit/youtube.test.ts` — the **Searchbar Protection** suite (3 tests) and `tests/unit/security.test.ts` **no .focus()/.blur() calls** test must pass.
