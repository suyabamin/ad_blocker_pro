# 02_AppFlow — Screens, State Machine, Actions

An extension has no URL router for the user, so "routes" here are: the **Popup**, the **Options page** (hash routes), and **background events**.

## 1. Global State Machine (owned by the background service worker)

```
              install
                │
                ▼
          ┌───────────┐  user toggles off    ┌─────────────┐
          │  ACTIVE   │ ───────────────────▶ │  DISABLED   │
          │           │ ◀─────────────────── │ (global)    │
          └───────────┘  user toggles on     └─────────────┘
            │      ▲
 site paused│      │site resumed
            ▼      │
     ┌──────────────────┐
     │ ACTIVE +         │   (per-site, derived from allowlist; not a global state)
     │ SITE_ALLOWLISTED │
     └──────────────────┘

  Any state ──ruleset load failure──▶ DEGRADED (badge "!", popup shows reason)
  DEGRADED ──user clicks "Retry"──▶ ACTIVE (if reload ok) or stays DEGRADED
```

| State | Network rules | Cosmetic CSS | YouTube script | Toolbar icon |
|-------|---------------|--------------|----------------|--------------|
| ACTIVE | enabled per settings | injected | running | colour, badge = tab count |
| ACTIVE + site allowlisted | allow-rule (priority 1000) for that domain | skipped | skipped | colour w/ "paused" dot |
| DISABLED | all rulesets disabled | skipped | skipped | grey, no badge |
| DEGRADED | whatever loaded | skipped | running | colour + red "!" badge |

State is persisted in `chrome.storage.local` key `settings.enabled`. On service-worker wake-up the worker MUST re-derive state from storage (never rely on in-memory variables).

## 2. Screen: Popup (`src/popup/index.html`, 360×auto px)

### Layout (top → bottom)
1. Header: logo + "Hush" + global power toggle
2. Hero stat: "Blocked on this page" (large number) + "Today: N"
3. Current site row: hostname + "Pause on this site" switch
4. Footer: "Settings" link, "Report broken site" (copies diagnostic text to clipboard)

### Popup states
| State | Trigger | UI |
|-------|---------|----|
| Loading | popup opened, fetching tab info | skeleton for number + site row (max 300 ms) |
| Normal | ACTIVE | as layout |
| Site paused | hostname in allowlist | site switch ON, hero shows "Paused on this site", number greyed |
| Globally disabled | settings.enabled=false | hero shows "Hush is off", site row disabled |
| Unsupported page | URL scheme not http/https (chrome://, about:, file:, extension pages, Web Store) | hero shows "Can't run on this page", site row hidden |
| Degraded | background reports error | red inline banner with reason + "Retry" button |

### Button / control actions
| Control | Action | Side effects | Failure handling |
|---------|--------|--------------|------------------|
| Global toggle | `msg: SET_ENABLED {value}` | writes storage; enables/disables rulesets via `updateEnabledRulesets`; updates icon | on error → toggle reverts + toast "Couldn't change state" |
| Site switch | `msg: SET_SITE_PAUSED {hostname, paused}` | adds/removes allowlist row; refreshes dynamic allow rule; offers "Reload tab" button | on error → switch reverts + toast |
| Reload tab button | `chrome.tabs.reload` | none | n/a |
| Settings link | opens options page `#/general` | `runtime.openOptionsPage()` | n/a |
| Report broken site | copies `{url host, version, browser, enabled lists}` to clipboard | no network | toast "Copy failed" if clipboard denied |

## 3. Screen: Options (`src/options/index.html`, hash routing)

Sidebar nav on left (top bar on narrow widths). Routes:

| Route | Screen | Purpose |
|-------|--------|---------|
| `#/general` | General | global toggle, theme (system/light/dark), show badge count, export/import |
| `#/lists` | Filter Lists | toggle each bundled ruleset; shows rule count + generated date; shows "N of M rules fit browser limit" |
| `#/allowlist` | Allowlist | table of paused sites, remove button, add-by-hostname input |
| `#/custom` | Custom Rules | textarea editor (one rule per line), Save, line-numbered validation errors |
| `#/youtube` | YouTube | toggles: auto-skip, speed-up unskippable, hide banners/feed ads, hide "Ad blockers violate…" warning if present (best-effort) |
| `#/stats` | Stats | 30-day bar chart (pure CSS/SVG, no chart lib), reset button |
| `#/about` | About / Diagnostics | version, browser, ruleset versions, ruleset limits, "Copy diagnostics", honesty note on YouTube |

Unknown hash → redirect to `#/general`.

### Per-screen states
| Screen | Empty | Error | Loading |
|--------|-------|-------|---------|
| Allowlist | "No paused sites. Use the popup to pause a site." | storage read fail → banner + Retry | skeleton rows |
| Custom Rules | placeholder text with 2 syntax examples | per-line errors listed under editor; Save disabled while errors exist | n/a |
| Filter Lists | n/a (always shows bundled lists) | ruleset enable fails (limit exceeded) → toggle reverts, inline message with available count | spinner on the toggle |
| Stats | "No data yet. Browse a few pages." | storage read fail → banner | skeleton bars |
| Import | n/a | invalid JSON/schema → modal listing the first 5 problems; nothing is applied | "Importing…" |

### Destructive actions
- Reset stats, Clear allowlist, Reset all settings → each requires a confirm dialog (focus on Cancel by default).

## 4. Background Events (no UI)
| Event | Handler | Behaviour |
|-------|---------|-----------|
| `runtime.onInstalled` (install) | `bootstrap()` | write default settings, enable default rulesets, set icon |
| `runtime.onInstalled` (update) | `migrate()` | run schema migrations (see 05_Schema §6) |
| `runtime.onStartup` | `bootstrap()` | re-sync rulesets with settings |
| `runtime.onMessage` | router | typed message handlers (see 04_TRD §6) |
| `tabs.onUpdated` (status=loading) | `resetTabCounter()` | zero per-tab counter (stored in `storage.session`) |
| `alarms.onAlarm('flush-stats')` | `flushStats()` | every 1 min, merge session counters into daily stats |
| `declarativeNetRequest.onRuleMatchedDebug` | dev builds only | counts matches (unpacked only) |

Note: in production builds, per-tab block counts use `getMatchedRules` where available (Chromium, needs `declarativeNetRequestFeedback`) — see 04_TRD §7 for fallback.

## 5. Content Script Flow (per page load)
```
document_start
  ├─ ask background: GET_PAGE_POLICY {hostname}
  │     ├─ disabled / allowlisted → exit
  │     └─ active → continue
  ├─ inject cosmetic stylesheet (generic selectors)
  └─ if hostname is *.youtube.com → start youtube controller
        ├─ MutationObserver on #movie_player + ad slots
        ├─ every ad detection → run skip pipeline
        └─ on yt-navigate-finish → re-arm
```
Failure rule: content scripts MUST NOT throw to the page. Wrap entry points in try/catch and log with prefix `[Hush]` only when `debug=true`.

## 6. Global Error Handling Rules
1. Never show raw stack traces in UI.
2. Every user-facing error has: what happened, what is still working, one action.
3. Storage quota/permission errors → DEGRADED state, never a crash loop.
4. If an message round-trip exceeds 2 s, UI shows the last known value and a subtle "stale" marker.
