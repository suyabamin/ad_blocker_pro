# 05_Schema — Local Data Model and Trust Model

## 0. Why this isn't a SQL database
Hush has **no server, no accounts, and no cloud database**. Therefore:
- There is **no Auth flow and no Row-Level Security** (nothing to authenticate against, nothing multi-tenant).
- Data lives in the browser's `storage.local` (persistent), `storage.session` (volatile), and generated static JSON rulesets.
- To keep the "relational" discipline, the tables below define entities with primary keys, foreign keys, constraints, and indexes. Physically each table is a JSON array/object under one storage key. Integrity is enforced in code (`src/shared/storage.ts`) and tested.

## 1. Physical Storage Map
| Storage area | Key | Logical table | Max size |
|--------------|-----|---------------|----------|
| `local` | `schemaVersion` | meta | 1 number |
| `local` | `settings` | `settings` (single row) | < 2 KB |
| `local` | `filterLists` | `filter_lists` | < 4 KB |
| `local` | `allowlist` | `allowlist_entries` | ≤ 2,000 rows |
| `local` | `customRules` | `custom_rules` | ≤ 5,000 lines / 512 KB |
| `local` | `statsDaily` | `stats_daily` | ≤ 90 rows |
| `session` | `tabCounters` | `tab_counters` | volatile |
| bundled files | `rulesets/<id>.json` + `<id>.meta.json` | static rules | build output |

## 2. Tables

### 2.1 `settings` (singleton)
| Column | Type | Constraint | Default |
|--------|------|-----------|---------|
| `id` | literal `"singleton"` | PK | `"singleton"` |
| `enabled` | boolean | NOT NULL | `true` |
| `theme` | enum `system\|light\|dark` | NOT NULL | `system` |
| `showBadge` | boolean | NOT NULL | `true` |
| `debug` | boolean | NOT NULL | `false` |
| `youtubeAutoSkip` | boolean | NOT NULL | `true` |
| `youtubeSpeedUnskippable` | boolean | NOT NULL | `true` |
| `youtubeHideBanners` | boolean | NOT NULL | `true` |
| `updatedAt` | integer (epoch ms) | NOT NULL | now |

### 2.2 `filter_lists`
| Column | Type | Constraint |
|--------|------|-----------|
| `id` | string (`easylist`, `easyprivacy`, `ublock-filters`, `annoyances`) | **PK**, matches ruleset id in manifest |
| `name` | string | NOT NULL |
| `enabled` | boolean | NOT NULL |
| `ruleCount` | integer ≥ 0 | NOT NULL (copied from meta at build) |
| `fetchedAt` | integer (epoch ms) | NOT NULL (from meta) |
| `sourceUrl` | string | NOT NULL |

Invariant: set of `id`s equals set of `declarative_net_request.rule_resources[].id` in the manifest. Test: `tests/unit/manifest-lists.test.ts`.

### 2.3 `allowlist_entries`
| Column | Type | Constraint |
|--------|------|-----------|
| `hostname` | string (lowercase punycode, no scheme/port/path) | **PK**, regex `^[a-z0-9.-]{1,253}$` |
| `ruleId` | integer 1–9,999 | **UNIQUE**, identifies the dynamic DNR rule |
| `createdAt` | integer (epoch ms) | NOT NULL |

Indexes (in-memory maps built at load): `byHostname` (PK), `byRuleId`.
Matching semantics: an entry for `example.com` also covers `*.example.com`.
Invariant: every row has exactly one dynamic DNR rule with `id = ruleId`; reconcile on startup (`reconcileAllowlist()`).

### 2.4 `custom_rules`
Stored as a single object, but each parsed line is an entity:

`custom_rules_raw`: `{ text: string, updatedAt: number }`

`custom_rule_lines` (derived, not persisted):
| Column | Type | Constraint |
|--------|------|-----------|
| `lineNo` | integer ≥ 1 | PK (within the text) |
| `kind` | enum `network_block\|network_allow\|cosmetic_hide\|comment\|invalid` | NOT NULL |
| `pattern` | string | NOT NULL unless comment |
| `error` | string \| null | set when `kind=invalid` |
| `ruleId` | integer 10,000–29,999 \| null | UNIQUE when set; only network kinds |

Supported syntax (strict subset; everything else → `invalid`):
- `||example.com^` (block domain) · `@@||example.com^` (allow)
- optional options: `$third-party`, `$script`, `$image`, `$xmlhttprequest`, `$subdocument`
- `example.com##.selector` and `##.selector` (cosmetic hide; selector validated by `document.createDocumentFragment().querySelector` in a try/catch at save time)
- `! comment`

### 2.5 `stats_daily`
| Column | Type | Constraint |
|--------|------|-----------|
| `date` | string `YYYY-MM-DD` (local time) | **PK** |
| `networkBlocked` | integer ≥ 0 | NOT NULL |
| `cosmeticHidden` | integer ≥ 0 | NOT NULL |
| `youtubeAdsSkipped` | integer ≥ 0 | NOT NULL |

Retention: keep the last 90 rows, drop older on each flush. Index: sorted array by `date`.

### 2.6 `tab_counters` (session storage)
| Column | Type | Constraint |
|--------|------|-----------|
| `tabId` | integer | **PK** |
| `network` | integer | NOT NULL |
| `cosmetic` | integer | NOT NULL |
| `youtube` | integer | NOT NULL |
| `updatedAt` | integer | NOT NULL |

Removed on `tabs.onRemoved` and reset on navigation start.

## 3. Relationships
```
filter_lists.id  ──1:1──  manifest rule_resources.id      (static ruleset)
allowlist_entries.ruleId ──1:1── dynamic DNR rule.id      (range 1–9,999)
custom_rule_lines.ruleId ──1:1── dynamic DNR rule.id      (range 10,000–29,999)
stats_daily.date  (no FK)
settings (singleton) ──governs── all enable/disable behaviour
```

## 4. TypeScript Source of Truth (`src/shared/types.ts`)
```ts
export interface Settings {
  id: 'singleton'; enabled: boolean; theme: 'system'|'light'|'dark';
  showBadge: boolean; debug: boolean;
  youtubeAutoSkip: boolean; youtubeSpeedUnskippable: boolean; youtubeHideBanners: boolean;
  updatedAt: number;
}
export interface FilterListRow { id: string; name: string; enabled: boolean; ruleCount: number; fetchedAt: number; sourceUrl: string; }
export interface AllowlistRow { hostname: string; ruleId: number; createdAt: number; }
export interface StatsDailyRow { date: string; networkBlocked: number; cosmeticHidden: number; youtubeAdsSkipped: number; }
export interface ExportFile { app: 'hush'; schemaVersion: number; exportedAt: number;
  settings: Settings; filterLists: Pick<FilterListRow,'id'|'enabled'>[]; allowlist: Pick<AllowlistRow,'hostname'>[]; customRules: string; }
```

## 5. Defaults (first install)
- `settings` per §2.1 defaults.
- `filter_lists`: `easylist` ON, `easyprivacy` ON, `ublock-filters` ON, `annoyances` OFF.
- `allowlist`: empty. `customRules`: empty string. `statsDaily`: empty.

## 6. Migrations
- `schemaVersion` starts at `1`.
- `src/background/migrations.ts` exports an ordered array `migrations: Array<(db) => Promise<void>>`; on `onInstalled(update)` run all with index ≥ stored version, then write new version.
- Migrations must be idempotent and covered by a test that starts from a fixture of each prior version.
- Never delete user data in a migration without exporting a backup copy under key `backup_v<N>`.

## 7. Trust Model (replaces Auth / RLS)
| Actor | Trust | Allowed |
|-------|-------|---------|
| Owner via popup/options (extension pages) | trusted | all message types |
| Content scripts | **semi-trusted** (run beside untrusted page DOM) | only `GET_PAGE_POLICY`, `INCR_STATS` (rate-limited) |
| Web page JavaScript | **untrusted** | no access to extension APIs; content script must never expose them (no `window` bridges, no `postMessage` handlers that trigger privileged actions) |
| Other extensions | untrusted | blocked by `sender.id` check |

Rules:
1. Background router rejects any message whose `sender.id !== runtime.id`.
2. Content-script messages are checked against an allowlist of types and validated payload schemas.
3. `INCR_STATS` capped at 50 increments per tab per second; excess dropped.
4. Data never leaves the device; export is user-initiated file download only.
5. Import validates `app === 'hush'`, known `schemaVersion`, field types, hostname regex, size ≤ 1 MB.

## 8. Integrity Tests (must exist)
- allowlist ↔ dynamic rules reconcile after simulated crash.
- Rule ID ranges never overlap.
- Manifest ruleset ids ↔ `filter_lists` ids.
- Export → Import round trip equals original.
- Migration fixtures v1→vN.
