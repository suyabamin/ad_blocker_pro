# 04_TRD — Technical Requirements

> The agent must NOT add, remove, or upgrade a dependency without editing this file first.
> Versions below were chosen as known-stable. If `npm install` of a pinned version fails, STOP and ask the owner; do not float to `latest`.

## 1. Locked Stack

| Concern | Choice | Exact version | Notes |
|---------|--------|---------------|-------|
| Runtime (dev) | Node.js | 22.x LTS (`.nvmrc` = `22`) | |
| Package manager | npm | bundled with Node 22 | always `npm ci` in CI/clean installs; `.npmrc` has `save-exact=true` |
| Language | TypeScript | 5.6.3 | `strict: true`, `noUncheckedIndexedAccess: true` |
| Bundler | esbuild | 0.24.0 | one build script `scripts/build.mjs`; no Vite/Webpack |
| Extension API typings | @types/chrome | 0.0.280 | |
| Cross-browser API shim | webextension-polyfill | 0.12.0 | + `@types/webextension-polyfill` 0.12.1; import only via `src/shared/browser.ts` |
| Network rule conversion (build-time only) | @adguard/tsurlfilter | 6.0.4 | used by `scripts/build-rulesets.mjs` to convert ABP lists → DNR JSON. Fallback if unusable: minimal in-repo converter (`||domain^`, `@@`, `$third-party`, resource types) |
| Unit tests | vitest | 2.1.4 | + `jsdom` 25.0.1 for DOM tests |
| E2E smoke | Playwright | 1.48.2 | Chromium + Firefox smoke only |
| Lint | eslint 9.14.0 + typescript-eslint 8.13.0 | | flat config |
| Format | prettier | 3.3.3 | |
| Firefox dev/packaging | web-ext | 8.3.0 | |
| UI | Vanilla TS + plain CSS | — | **no React/Vue/Tailwind** |

Target browsers (minimum): Chrome/Edge/Brave/Opera ≥ 120, Firefox ≥ 128 (MV3 + DNR support). Safari: out of MVP.

## 2. Manifest Strategy
- **Manifest V3 everywhere.** Two generated manifests from `manifests/base.json` + overlays:
  - `manifests/chrome.json` overlay: `"background": {"service_worker": "background.js", "type": "module"}`
  - `manifests/firefox.json` overlay: `"background": {"scripts": ["background.js"], "type": "module"}` and `browser_specific_settings.gecko.id = "hush@local"`, `strict_min_version = "128.0"`.
- Permissions (principle of least privilege; do not add others):
  - `declarativeNetRequest`, `storage`, `alarms`
  - `declarativeNetRequestFeedback` (needed for per-tab match counts via `getMatchedRules`; Chromium only; drop on Firefox if unsupported)
  - `host_permissions`: `["<all_urls>"]` (required for generic cosmetic filtering and for DNR to apply to all hosts)
- No `tabs`, `webRequest`, `webRequestBlocking`, `cookies`, `history`, `scripting`, `unlimitedStorage`, or `nativeMessaging`.
- Content Security Policy: default MV3 (`script-src 'self'; object-src 'self'`). Never relax.
- Content scripts:
  1. `content/cosmetic.js` — `matches: ["<all_urls>"]`, `run_at: "document_start"`, `all_frames: true`
  2. `content/youtube.js` — `matches: ["*://*.youtube.com/*", "*://*.youtube-nocookie.com/*"]`, `run_at: "document_start"`, `all_frames: true`

## 3. Folder Structure

```
hush/
├─ CLAUDE.md
├─ .cursorrules
├─ docs/                      # 01..06 context files (read-only for agent except 06_Plan.md)
├─ manifests/
│  ├─ base.json
│  ├─ chrome.json
│  └─ firefox.json
├─ rulesets-src/              # downloaded raw lists (git-ignored, regenerated)
├─ public/
│  ├─ icons/                  # 16/32/48/128 × states
│  ├─ popup.html
│  └─ options.html
├─ src/
│  ├─ shared/
│  │  ├─ browser.ts           # the ONLY file importing webextension-polyfill
│  │  ├─ types.ts             # message + storage types (source of truth)
│  │  ├─ messages.ts          # typed send/receive helpers
│  │  ├─ storage.ts           # typed storage access + migrations hook
│  │  └─ constants.ts
│  ├─ background/
│  │  ├─ index.ts             # event registration only
│  │  ├─ bootstrap.ts
│  │  ├─ rulesets.ts          # enable/disable static rulesets, limits
│  │  ├─ allowlist.ts         # dynamic allow rules
│  │  ├─ customRules.ts       # parse + convert to dynamic rules
│  │  ├─ stats.ts
│  │  └─ migrations.ts
│  ├─ content/
│  │  ├─ cosmetic.ts
│  │  └─ youtube/
│  │     ├─ index.ts          # controller
│  │     ├─ selectors.ts      # ALL YouTube selectors live here
│  │     ├─ detect.ts
│  │     └─ skip.ts
│  ├─ popup/ (main.ts, view.ts)
│  ├─ options/ (main.ts, router.ts, screens/*.ts)
│  └─ ui/ (tokens.css, base.css, components.css, icons.ts, theme-boot.ts)
├─ scripts/
│  ├─ build.mjs               # esbuild + manifest merge + copy public
│  ├─ build-rulesets.mjs      # lists → dist/<browser>/rulesets/*.json
│  ├─ update-lists.mjs        # downloads lists to rulesets-src/ (build-time network only)
│  └─ package.mjs             # zip for each browser
├─ tests/
│  ├─ unit/  ├─ e2e/  └─ a11y/
├─ dist/                      # git-ignored; dist/chrome, dist/firefox
├─ package.json  tsconfig.json  eslint.config.js  .prettierrc  .nvmrc  .npmrc  .gitignore
```

## 4. Third-Party Data Sources (build time only; free)
| List | URL | Default | Purpose |
|------|-----|---------|---------|
| EasyList | `https://easylist.to/easylist/easylist.txt` | ON | ads |
| EasyPrivacy | `https://easylist.to/easylist/easyprivacy.txt` | ON | trackers |
| uBlock filters | `https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt` | ON | general + some YouTube network rules |
| uBlock Annoyances (optional) | `https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt` | OFF | cookie banners etc. |

Rules:
- Lists are downloaded ONLY by `npm run update-lists` (manual). The extension itself makes **zero** network requests.
- Each generated ruleset JSON records `source`, `fetchedAt`, `ruleCount`, `skippedCount` in a sibling `*.meta.json`.
- Lists are licensed (GPLv3 / CC BY-SA depending on list). Keep `THIRD_PARTY_NOTICES.md` in repo. Personal use only (see PRD non-goals).

## 5. Rule Limits (MV3)
- Never hard-code limits. Read at runtime: `getAvailableStaticRuleCount()`, `MAX_NUMBER_OF_ENABLED_STATIC_RULESETS`, `MAX_NUMBER_OF_DYNAMIC_RULES`.
- If enabling a ruleset would exceed available count → reject, revert toggle, show message (see 02_AppFlow §3).
- Rule ID plan: static rulesets use IDs from converter (unique per ruleset). Dynamic rules ID ranges: `1–9,999` allowlist, `10,000–29,999` custom rules. Never overlap.
- Allow rules use `priority: 1000` with `action.type = "allowAllRequests"` on `main_frame` for the hostname.

## 6. Message Protocol (typed; defined in `src/shared/types.ts`)
```ts
type Msg =
  | { type: 'GET_STATE' }
  | { type: 'SET_ENABLED'; value: boolean }
  | { type: 'SET_SITE_PAUSED'; hostname: string; paused: boolean }
  | { type: 'GET_PAGE_POLICY'; hostname: string }
  | { type: 'GET_TAB_COUNT'; tabId: number }
  | { type: 'SET_LIST_ENABLED'; id: string; value: boolean }
  | { type: 'SAVE_CUSTOM_RULES'; text: string }
  | { type: 'EXPORT_SETTINGS' }
  | { type: 'IMPORT_SETTINGS'; json: string }
  | { type: 'RESET_STATS' };
type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
```
Every handler returns `Result<T>`. Unknown message types return `{ok:false, error:{code:'UNKNOWN_MESSAGE'}}`. Validate all incoming payloads (never trust content-script messages; sender must be our own extension).

## 7. Counting Blocked Requests
1. Chromium: use `declarativeNetRequest.getMatchedRules({tabId})` (requires `declarativeNetRequestFeedback`), polled on popup open and cached in `storage.session`.
2. Fallback / Firefox: if `getMatchedRules` is unavailable, count via `onRuleMatchedDebug` in dev only; in production show cosmetic-hide counts and display "network count unavailable on this browser" in About.
3. Never block the request path for counting.

## 8. YouTube Strategy (MVP, DOM-based only)
Pipeline in `src/content/youtube/`:
1. **Detect**: `.ad-showing` on `#movie_player`, or `.ytp-ad-player-overlay`, via MutationObserver (throttled with `requestAnimationFrame`).
2. **Skippable**: click `.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern` when present.
3. **Unskippable**: set `video.muted = true`, `video.playbackRate = 16`, then `video.currentTime = video.duration` if finite; restore previous mute/rate when ad class disappears.
4. **Hide**: banner/overlay/feed ad slots via CSS from `selectors.ts` (`ytd-ad-slot-renderer`, `#masthead-ad`, `ytd-promoted-sparkles-web-renderer`, `.ytp-ad-overlay-container`, etc.).
5. **Re-arm** on `yt-navigate-finish`.
6. All selectors in one array/const, each with a comment of the date verified. Add a `youtube.selftest` function exposed to the About page that reports which selectors currently match (helps repair breakage).
Not in MVP: rewriting player response JSON, network interception of `googlevideo.com` ad segments (breaks playback), injecting remote scriptlets.

## 9. Security Constraints (hard rules)
1. No `eval`, `new Function`, `setTimeout(string)`, `innerHTML` with dynamic data (use `textContent`/DOM APIs; allowed only for static icon SVG constants).
2. No remote code or remote config loaded at runtime. No `fetch`/`XMLHttpRequest` anywhere under `src/`. (Enforced by an ESLint `no-restricted-globals`/`no-restricted-syntax` rule and a CI grep test.)
3. Message sender check: `sender.id === runtime.id`; content-script messages carry only hostname strings, validated by regex.
4. Hostnames validated with `^[a-z0-9.-]+$` (punycode form) before use in rules.
5. Custom rules parsed by our own strict parser; unsupported syntax rejected, never passed through.
6. No analytics, no cookies, no `localStorage` use for settings (use `storage.local`).
7. Dependencies: production deps limited to `webextension-polyfill` (+ build-time-only others in devDependencies). Run `npm audit --omit=dev` before each release.
8. Content scripts run isolated world; do not use `world: "MAIN"`.
9. Import settings: schema-validate and size-limit (≤ 1 MB) before applying.

## 10. Performance Budget
- Content script cosmetic injection < 10 ms main-thread at `document_start`.
- YouTube controller idle CPU < 1% (observer throttled, no polling intervals < 250 ms).
- Service worker stays stateless; each wake < 100 ms to answer messages.
- Bundle sizes: popup < 40 KB gz, options < 80 KB gz, content scripts < 20 KB gz each.

## 11. Scripts (package.json)
`dev:chrome`, `dev:firefox` (watch + web-ext), `build:chrome`, `build:firefox`, `update-lists`, `build-rulesets`, `test`, `test:e2e`, `lint`, `typecheck`, `package`.

## 12. Browser Loading Instructions (for README)
- Chromium: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`.
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json` (temporary; permanent install needs signing, out of MVP scope).
