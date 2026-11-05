// src/shared/types.ts
// Source of truth for all storage and message schemas (04_TRD §6, 05_Schema §4)

export interface Settings {
  id: 'singleton';
  enabled: boolean;
  theme: 'system' | 'light' | 'dark';
  showBadge: boolean;
  debug: boolean;
  youtubePrunePlayerData: boolean;
  youtubeAutoSkip: boolean;
  youtubeSpeedUnskippable: boolean;
  youtubeHideBanners: boolean;
  updatedAt: number;
}

export interface FilterListRow {
  id: string;
  name: string;
  enabled: boolean;
  ruleCount: number;
  fetchedAt: number;
  sourceUrl: string;
}

export interface AllowlistRow {
  hostname: string;
  ruleId: number;
  createdAt: number;
}

export interface StatsDailyRow {
  date: string; // YYYY-MM-DD
  networkBlocked: number;
  cosmeticHidden: number;
  youtubeAdsSkipped: number;
}

export interface TabCountersRow {
  tabId: number;
  network: number;
  cosmetic: number;
  youtube: number;
  updatedAt: number;
}

export interface ExportFile {
  app: 'hush' | 'su-adblock-pro';
  schemaVersion: number;
  exportedAt: number;
  settings: Settings;
  filterLists: Pick<FilterListRow, 'id' | 'enabled'>[];
  allowlist: Pick<AllowlistRow, 'hostname'>[];
  customRules: string;
}

export type CustomRuleKind =
  | 'network_block'
  | 'network_allow'
  | 'cosmetic_hide'
  | 'comment'
  | 'invalid';

export interface CustomRuleLine {
  lineNo: number;
  kind: CustomRuleKind;
  pattern: string;
  error: string | null;
  ruleId: number | null;
}

export interface PagePolicy {
  enabled: boolean;
  paused: boolean;
  cosmeticSelectors: string[];
}

export interface GlobalState {
  enabled: boolean;
  theme: 'system' | 'light' | 'dark';
  degraded: boolean;
  degradedReason?: string;
  settings: Settings;
  filterLists: FilterListRow[];
  allowlist: AllowlistRow[];
  customRulesCount: number;
  todayStats: StatsDailyRow;
  rulesetLimits?: {
    availableStaticRuleCount: number;
    maxRulesets: number;
  };
}

export interface DebugEvent {
  timestamp: number;
  frameUrl: string;
  component: string;
  stage: string;
  outcome: string;
  reason?: string;
}

export interface BehavioralSelfTestResult {
  timestamp: number;
  browser: string;
  extensionVersion: string;
  rules: {
    enabledRulesets: string[];
    expectedRulesets: string[];
    rulesetsMatch: boolean;
    availableStaticRuleCount: number;
    canaryBlockedCheck: 'passed' | 'failed' | 'skipped';
  };
  contentScripts: {
    cosmeticActiveInTab: boolean;
    youtubeActiveInTab: boolean;
    allFrames: boolean;
  };
  youtube?: {
    onWatchPage: boolean;
    playerFound: boolean;
    videoFound: boolean;
    observerAttached: boolean;
    observerTarget: string;
    currentAdState: boolean;
    lastAdDetected: { timestamp: number; signals: string[] } | null;
    lastActionTaken: string | null;
    lastOutcome: string | null;
    error: string | null;
  };
}

export type Msg =
  | { type: 'GET_STATE' }
  | { type: 'SET_ENABLED'; value: boolean }
  | { type: 'SET_SITE_PAUSED'; hostname: string; paused: boolean }
  | { type: 'GET_PAGE_POLICY'; hostname: string }
  | { type: 'GET_TAB_COUNT'; tabId: number }
  | { type: 'SET_LIST_ENABLED'; id: string; value: boolean }
  | { type: 'SAVE_CUSTOM_RULES'; text: string }
  | { type: 'EXPORT_SETTINGS' }
  | { type: 'IMPORT_SETTINGS'; json: string }
  | { type: 'RESET_STATS' }
  | { type: 'INCR_STATS'; category: 'cosmetic' | 'youtube'; amount?: number }
  | { type: 'GET_STATS_HISTORY' }
  | { type: 'UPDATE_THEME'; theme: 'system' | 'light' | 'dark' }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'RECORD_DEBUG_EVENT'; event: Omit<DebugEvent, 'timestamp'> }
  | { type: 'GET_DEBUG_LOG' }
  | { type: 'CLEAR_DEBUG_LOG' }
  | { type: 'RUN_BEHAVIORAL_SELFTEST' };

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
