# YouTube Search Bar Stability Audit

**Date:** 2026-11-06  
**Status:** Fix implemented; browser verification pending

## Symptoms

With the extension enabled, YouTube's masthead search field could lose focus or appear unstable while the user hovered or typed. No live browser reproduction was available in this environment, so the original user-visible symptom is not marked as reproduced here.

## Root cause and source evidence

The strongest direct cause recorded in the existing investigation is a skip-control selector collision. The previous selector `button[aria-label*="Skip" i]` could match YouTube's masthead `Skip navigation` control. A document-wide skip-button lookup could then dispatch synthetic pointer and click events to that masthead control while the ad pipeline ran, disrupting search interaction. The corrected selector list in `src/content/youtube/selectors.ts` requires `Skip ad` or `Skip video`; `findSkipButton()` in `src/content/youtube/detect.ts` queries only inside the player and rejects masthead/search ancestors. The new fixture regression test places a `Skip navigation` button beside the search box and verifies it cannot be selected as a player skip button.

A second risk was page-wide JSON pruning. `Response.prototype.json` in `src/content/youtube/mainWorld.ts` now prunes only `/youtubei/v1/player` and `/youtubei/v1/next` responses. The `JSON.parse` hook is further restricted to parsed objects with player-specific fields (`playerResponse`, `videoDetails`, `streamingData`, or `playabilityStatus`). This avoids recursively walking ordinary search suggestion and UI payloads. These changes are supported by source inspection; no browser trace establishes that JSON parsing caused the original disappearing field.

The ad pipeline in `src/content/youtube/index.ts` also returns before DOM actions when focus is in a typeable element or YouTube masthead/search region. Its player observer watches `#movie_player`, not the masthead. Banner CSS uses the explicit selectors from `selectors.ts`; the generic stylesheet is built from `cosmetic-selectors.json` and includes `#ad-masthead`, not the `#masthead` or search input.

The older `README.md`, `docs/SEARCHBAR_BUG_REPORT.md`, and `docs/YOUTUBE_REPAIR_RUNBOOK.md` claim that `injectBannerHidingStyle()` contains an explicit CSS guard for `ytd-searchbox`, `#search`, and search inputs. The current `src/content/youtube/index.ts` does not contain that guard. The selector audit found no current YouTube banner/anti-adblock selector matching the search fixture, and the generic list's masthead entry is specifically `#ad-masthead`; the claimed guard is therefore not part of the implemented fix and should not be relied on. The primary protection is precise ad selectors and player-scoped skip lookup.

## Module and DOM effect map

| Module | DOM or page data | Trigger | Search risk / mitigation |
|---|---|---|---|
| `src/content/youtube/mainWorld.ts` | Player response objects and JSON parsing | Page initialization and host JSON calls | JSON hook restricted to player-shaped objects; Fetch JSON also URL-scoped |
| `src/content/youtube/index.ts` | Banner CSS; player ad pipeline; player observer | Initialization, player mutations, SPA events | Typing guard; observer scoped to player; CSS selectors are ad-specific |
| `src/content/youtube/detect.ts` | Skip button lookup | Ad checks | Lookup scoped to player; masthead/search ancestor guard |
| `src/content/youtube/skip.ts` | Enforcement dialog and backdrop removal | Ad pipeline | Removes only elements matching anti-adblock selectors; pipeline defers while typing |
| `src/content/cosmetic.ts` | Generic/custom cosmetic stylesheet | Policy load | Selectors are CSS hides, not DOM removals; inspected YouTube-related entries are ad-specific |
| `scripts/update-lists.mjs`, `scripts/build-rulesets.mjs`, `src/background/rulesets.ts` | Filter list files and DNR configuration | Manual build/update or settings change | No YouTube DOM access; left unchanged |

There are two `MutationObserver` constructions, both in `youtube/index.ts`: a temporary document-subtree observer while waiting for the player and the player-subtree ad observer. SPA listeners are registered for `yt-navigate-finish`, `yt-page-data-updated`, and `popstate`; they disconnect the current player observer before rearming. The temporary retry observer is local to the waiting call and can be duplicated if multiple rearm events arrive before the player mounts. This is a lifecycle/performance risk, but source evidence does not connect it to search elements disappearing, so it was not changed in this search-focused fix.

Search of source found no content-script mouseover/mouseenter/focus/blur event handlers and no dynamic HTML assignment. The only YouTube DOM removals are dialog/backdrop removals in `skip.ts`.

## Files changed for this audit

- `tests/fixtures/youtube/masthead-with-searchbar.html`: added a representative masthead `Skip navigation` control.
- `tests/unit/youtube.test.ts`: added a regression assertion that the masthead control is not returned as the active player's skip button.
- `docs/YOUTUBE_SEARCH_BUG_FIX_REPORT.md`: this audit and verification report.
- `docs/06_Plan.md`: appended the verified audit result. The recurring list-update item remains pending because it would modify the protected fetcher.

The runtime search protection in `src/content/youtube/mainWorld.ts`, modified in the immediately preceding task, remains in the final working tree and is documented above. No fetcher file or code is changed by this audit.

## Regression checklist

| Scenario | Status |
|---|---|
| Search bar visible on load and hover | Browser verification pending |
| Click input; keyboard focus stays stable | Browser verification pending |
| Type normally and quickly; backspace | Browser verification pending |
| Suggestions open; pointer moves into suggestions | Browser verification pending |
| Enter submits; search button submits | Browser verification pending |
| Escape closes/reopens search | Browser verification pending |
| Search after SPA video navigation, reload, and new tab | Browser verification pending |
| Search with extension enabled and disabled | Browser verification pending |
| Search with YouTube blocking modules isolated | Browser verification pending |
| Player skip detection does not select masthead navigation control | Covered by new jsdom regression test |
| Existing YouTube unit/fixture suite | Pass; 9 YouTube tests |
| Full unit suite | Pass; 40 tests across 10 files |
| ESLint | Pass |
| TypeScript check | Pass |
| Chrome build | Pass |
| Firefox build | Pass |
| Live ad detection, playback, and other controls | Browser verification pending |

The jsdom suite emits warnings because `HTMLMediaElement.play()` is not implemented in jsdom; the affected tests pass and this warning does not represent live playback verification. `git diff --check` reports existing trailing whitespace in `src/ui/tokens.css` (lines 12, 17, 85, and 89), outside this audit's edits.

## Fetcher integrity

Fetcher-related files identified: `scripts/update-lists.mjs`, `scripts/build-rulesets.mjs`, `src/background/rulesets.ts`, and `public/rulesets/*.json`. These files are outside the fix's edit scope. Hashes below are unchanged from the pre-implementation snapshot:

| File | SHA-256 |
|---|---|
| `scripts/update-lists.mjs` | `E20E18470E294F1649A28BE5B2970478F2EB0F06A4F9BBBD32085C73E591D524` |
| `scripts/build-rulesets.mjs` | `1205D8A1EC9FB472C04AA89C46537E1C7ECD2DB1AFBA98E70CF51C8D4E2809A0` |
| `src/background/rulesets.ts` | `3F78008DE9F59A14C56F9F78F1CD01B5F3EF5AA4C07CF2DBE4EFDEA1841A4D8A` |
| `public/rulesets/easylist.json` | `C89C94B9E6C6B23476D3545DFB24FCA47151BF2F1B0246F8A6F6F9A02BEEA2F2` |
| `public/rulesets/easyprivacy.json` | `1B2D712ACC1BD84F898014AA128D7FF12FBFFCA7658C5ACBD9502A7605111E1` |
| `public/rulesets/ublock-filters.json` | `B3D199C2FB01DED2EEC8E3130FA5E2ADC6BAFB466A7552785A2425DAB1BA7418` |
| `public/rulesets/annoyances.json` | `2E0430AAB7B170F594A1401BE02F3609A061F2CD1DD9F1E589A0F0E8646D9825` |

Post-implementation hashes match the recorded snapshot. The source diff contains no changes to those fetcher/list files. The workspace contains other preexisting dirty/untracked files; they were left intact.

## Performance and limitations

The regression test adds a single small DOM fixture assertion. No new polling, global cosmetic exclusion, or broad ad-blocking disablement was introduced. The existing 300 ms heartbeat remains part of the controller and is not changed here. jsdom verifies selector behavior, not actual browser focus, hover, typing, navigation, or playback. Chrome and Firefox compatibility cannot be claimed until the manual checklist is run in both browsers.

## Manual verification

1. Build and load `dist/chrome` unpacked; repeat with `dist/firefox` as a temporary add-on.
2. With the extension enabled, open YouTube, hover the search field, click it, type a query including backspace, inspect suggestions, move the pointer into them, press Escape, then search with Enter and the search button.
3. Repeat after navigating between videos without reload, after page reload, and in a new tab.
4. Repeat with the extension disabled, then enable it and use YouTube diagnostics to verify player/skip detection. Check video playback, menu, notifications, account control, captions, settings, and video controls.
5. Record actual results per browser; do not mark browser verification complete based on builds or jsdom tests.
