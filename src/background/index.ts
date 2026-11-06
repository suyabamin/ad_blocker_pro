// src/background/index.ts
// Background service worker: event registration and message routing (04_TRD §3, §6)

import { browser, type MessageSender } from '../shared/browser.js';
import { ALARMS } from '../shared/constants.js';
import { MessageRouter } from '../shared/messages.js';
import {
  getSettings,
  setSettings,
  getFilterLists,
  getAllowlist,
  getCustomRules,
  getStatsDaily,
  setFilterLists,
} from '../shared/storage.js';
import { validateImportJson } from '../shared/validation.js';
import { bootstrap, getDegradedStatus } from './bootstrap.js';
import {
  syncAllRulesets,
  setListEnabled,
  getAvailableStaticRuleCount,
} from './rulesets.js';
import {
  addAllowlistEntry,
  removeAllowlistEntry,
  isAllowlisted,
  reconcileAllowlist,
} from './allowlist.js';
import {
  saveCustomRules,
  getCustomCosmeticRulesForHost,
  parseAllCustomRules,
} from './customRules.js';
import {
  getTabBlockedCount,
  getTodayStats,
  recordStatDirect,
  resetTabCounter,
  removeTabCounters,
  flushStats,
  resetAllStats,
} from './stats.js';
import { updateBadgeAndIcon } from './badge.js';
import {
  appendDebugEvent,
  getDebugEvents,
  clearDebugEvents,
} from '../shared/debug.js';
import type {
  ExportFile,
  GlobalState,
  PagePolicy,
  BehavioralSelfTestResult,
} from '../shared/types.js';
import type { YouTubeDiagnosticsReport } from '../content/youtube/selectors.js';

const router = new MessageRouter();

// 1. GET_STATE
router.on('GET_STATE', async (): Promise<GlobalState> => {
  const settings = await getSettings();
  const filterLists = await getFilterLists();
  const allowlist = await getAllowlist();
  const customRulesText = await getCustomRules();
  const todayStats = await getTodayStats();
  const degraded = getDegradedStatus();
  const availableStaticRuleCount = await getAvailableStaticRuleCount();

  const { lines } = parseAllCustomRules(customRulesText);
  const activeCustomRulesCount = lines.filter(
    (l) => l.kind === 'network_block' || l.kind === 'network_allow'
  ).length;

  return {
    enabled: settings.enabled,
    theme: settings.theme,
    degraded: degraded.degraded,
    degradedReason: degraded.reason,
    settings,
    filterLists,
    allowlist,
    customRulesCount: activeCustomRulesCount,
    todayStats,
    rulesetLimits: {
      availableStaticRuleCount,
      maxRulesets: 50,
    },
  };
});

// 2. SET_ENABLED
router.on('SET_ENABLED', async (msg) => {
  const updated = await setSettings({ enabled: msg.value });
  await syncAllRulesets();
  await updateBadgeAndIcon();
  return updated;
});

// 3. SET_SITE_PAUSED
router.on('SET_SITE_PAUSED', async (msg) => {
  if (msg.paused) {
    await addAllowlistEntry(msg.hostname);
  } else {
    await removeAllowlistEntry(msg.hostname);
  }
  await updateBadgeAndIcon();
  return { ok: true, paused: msg.paused };
});

// 4. GET_PAGE_POLICY
router.on('GET_PAGE_POLICY', async (msg): Promise<PagePolicy> => {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { enabled: false, paused: false, cosmeticSelectors: [] };
  }

  const paused = await isAllowlisted(msg.hostname);
  if (paused) {
    return { enabled: true, paused: true, cosmeticSelectors: [] };
  }

  const customHides = await getCustomCosmeticRulesForHost(msg.hostname);
  return {
    enabled: true,
    paused: false,
    cosmeticSelectors: customHides,
  };
});

// 5. GET_TAB_COUNT
router.on('GET_TAB_COUNT', async (msg) => {
  const count = await getTabBlockedCount(msg.tabId);
  return { count };
});

// 6. SET_LIST_ENABLED
router.on('SET_LIST_ENABLED', async (msg) => {
  const res = await setListEnabled(msg.id, msg.value);
  if (!res.ok) {
    throw new Error(res.message);
  }
  return { ok: true };
});

// 7. SAVE_CUSTOM_RULES
router.on('SAVE_CUSTOM_RULES', async (msg) => {
  const res = await saveCustomRules(msg.text);
  if (!res.ok && res.errors) {
    throw new Error(res.errors.map((e) => `Line ${e.lineNo}: ${e.error}`).join('; '));
  }
  return { ok: true };
});

// 8. EXPORT_SETTINGS
router.on('EXPORT_SETTINGS', async (): Promise<ExportFile> => {
  const settings = await getSettings();
  const filterLists = await getFilterLists();
  const allowlist = await getAllowlist();
  const customRules = await getCustomRules();

  return {
    app: 'su-adblock-pro',
    schemaVersion: 1,
    exportedAt: Date.now(),
    settings,
    filterLists: filterLists.map((l) => ({ id: l.id, enabled: l.enabled })),
    allowlist: allowlist.map((a) => ({ hostname: a.hostname })),
    customRules,
  };
});

// 9. IMPORT_SETTINGS
router.on('IMPORT_SETTINGS', async (msg) => {
  const validation = validateImportJson(msg.json);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const file = validation.file;
  // Apply settings
  await setSettings(file.settings);

  // Apply filter lists
  const currentLists = await getFilterLists();
  const importedMap = new Map(file.filterLists.map((l) => [l.id, l.enabled]));
  const updatedLists = currentLists.map((l) => ({
    ...l,
    enabled: importedMap.has(l.id) ? (importedMap.get(l.id) ?? l.enabled) : l.enabled,
  }));
  await setFilterLists(updatedLists);

  // Apply allowlist
  for (const entry of file.allowlist) {
    try {
      await addAllowlistEntry(entry.hostname);
    } catch {
      // ignore individual invalid entries
    }
  }

  // Apply custom rules
  await saveCustomRules(file.customRules);

  // Sync everything
  await syncAllRulesets();
  await reconcileAllowlist();
  await updateBadgeAndIcon();

  return { ok: true };
});

// 10. RESET_STATS
router.on('RESET_STATS', async () => {
  await resetAllStats();
  await updateBadgeAndIcon();
  return { ok: true };
});

// 11. INCR_STATS
router.on(
  'INCR_STATS',
  async (
    msg,
    sender: MessageSender
  ) => {
    const tabId = sender.tab?.id;
    await recordStatDirect(msg.category, msg.amount || 1, tabId);
    if (tabId !== undefined) {
      await updateBadgeAndIcon(tabId);
    }
    return { ok: true };
  }
);

// 12. GET_STATS_HISTORY
router.on('GET_STATS_HISTORY', async () => {
  const stats = await getStatsDaily();
  return stats;
});

// 13. UPDATE_THEME
router.on('UPDATE_THEME', async (msg) => {
  const updated = await setSettings({ theme: msg.theme });
  return updated;
});

// 14. SET_SETTINGS
router.on('SET_SETTINGS', async (msg) => {
  const updated = await setSettings(msg.settings);
  if (msg.settings.enabled !== undefined) {
    await syncAllRulesets();
  }
  await updateBadgeAndIcon();
  return updated;
});

// 15. RECORD_DEBUG_EVENT
router.on('RECORD_DEBUG_EVENT', async (msg) => {
  const settings = await getSettings();
  if (settings.debug) {
    await appendDebugEvent(msg.event);
  }
  return { ok: true };
});

// 16. GET_DEBUG_LOG
router.on('GET_DEBUG_LOG', async () => {
  const events = await getDebugEvents(500);
  return events;
});

// 17. CLEAR_DEBUG_LOG
router.on('CLEAR_DEBUG_LOG', async () => {
  await clearDebugEvents();
  return { ok: true };
});

// 18. RUN_BEHAVIORAL_SELFTEST
router.on('RUN_BEHAVIORAL_SELFTEST', async (): Promise<BehavioralSelfTestResult> => {
  const lists = await getFilterLists();
  const settings = await getSettings();
  const expectedRulesets = settings.enabled
    ? lists.filter((l) => l.enabled).map((l) => l.id)
    : [];

  let enabledRulesets: string[] = [];
  try {
    if (browser.declarativeNetRequest?.getEnabledRulesets) {
      enabledRulesets = await browser.declarativeNetRequest.getEnabledRulesets();
    }
  } catch {
    // fallback
  }

  const rulesetsMatch =
    expectedRulesets.slice().sort().join(',') ===
    enabledRulesets.slice().sort().join(',');

  const availableStaticRuleCount = await getAvailableStaticRuleCount();

  // Canary block check
  let canaryBlockedCheck: 'passed' | 'failed' | 'skipped' = 'skipped';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dnr = browser.declarativeNetRequest as any;
    if (dnr?.testMatchOutcome) {
      const outcome = await dnr.testMatchOutcome({
        url: 'https://googleads.g.doubleclick.net/pagead/ads',
        type: 'script',
      });
      canaryBlockedCheck =
        outcome?.matchedRules && outcome.matchedRules.length > 0 ? 'passed' : 'failed';
    } else {
      canaryBlockedCheck = enabledRulesets.includes('easylist') ? 'passed' : 'failed';
    }
  } catch {
    canaryBlockedCheck = 'skipped';
  }

  // Check content scripts in active tab
  let cosmeticActive = false;
  let youtubeActive = false;
  let ytDiagnostics: BehavioralSelfTestResult['youtube'];

  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (activeTab?.id) {
      try {
        const pingCosmetic = (await browser.tabs.sendMessage(activeTab.id, {
          type: 'PING_CONTENT_SCRIPT',
          script: 'cosmetic',
        })) as { ok?: boolean };
        if (pingCosmetic?.ok) cosmeticActive = true;
      } catch {
        // script not in tab or restricted
      }

      const isYouTubeUrl =
        activeTab.url?.includes('youtube.com') ||
        activeTab.url?.includes('youtube-nocookie.com');

      if (isYouTubeUrl) {
        try {
          const ytRes = (await browser.tabs.sendMessage(activeTab.id, {
            type: 'RUN_YOUTUBE_SELFTEST',
          })) as { ok?: boolean; data?: YouTubeDiagnosticsReport };
          if (ytRes?.ok && ytRes.data) {
            youtubeActive = true;
            ytDiagnostics = {
              onWatchPage: window.location?.href?.includes('/watch') || !!activeTab.url?.includes('/watch'),
              playerFound: ytRes.data.playerFound,
              videoFound: ytRes.data.videoFound,
              observerAttached: ytRes.data.observerAttached ?? true,
              observerTarget: ytRes.data.observerTarget ?? '#movie_player',
              currentAdState: ytRes.data.adActive,
              lastAdDetected: ytRes.data.lastDetectionTime
                ? {
                    timestamp: ytRes.data.lastDetectionTime,
                    signals: ytRes.data.activeSignals,
                  }
                : null,
              lastActionTaken: ytRes.data.lastActionTaken ?? (ytRes.data.lastSkipTime ? 'skip_clicked' : null),
              lastOutcome: ytRes.data.lastOutcome ?? (ytRes.data.lastSkipTime ? 'skipped' : null),
              error: ytRes.data.lastError ?? null,
            };
          }
        } catch {
          // tab communication error
        }
      }
    }
  } catch {
    // tab query error
  }

  return {
    timestamp: Date.now(),
    browser: navigator.userAgent,
    extensionVersion: '0.1.0',
    rules: {
      enabledRulesets,
      expectedRulesets,
      rulesetsMatch,
      availableStaticRuleCount,
      canaryBlockedCheck,
    },
    contentScripts: {
      cosmeticActiveInTab: cosmeticActive,
      youtubeActiveInTab: youtubeActive,
      allFrames: true,
    },
    youtube: ytDiagnostics,
  };
});

// Register router
router.register();

// Event Listeners
browser.runtime.onInstalled.addListener(() => {
  bootstrap().catch(console.error);
});

browser.runtime.onStartup.addListener(() => {
  bootstrap().catch(console.error);
});

if (browser.tabs?.onUpdated) {
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      resetTabCounter(tabId).catch(() => {});
      updateBadgeAndIcon(tabId).catch(() => {});
    }
  });
}

if (browser.tabs?.onActivated) {
  browser.tabs.onActivated.addListener((activeInfo) => {
    updateBadgeAndIcon(activeInfo.tabId).catch(() => {});
  });
}

if (browser.tabs?.onRemoved) {
  browser.tabs.onRemoved.addListener((tabId) => {
    removeTabCounters(tabId).catch(() => {});
  });
}

if (browser.alarms?.onAlarm) {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARMS.FLUSH_STATS) {
      flushStats().catch(console.error);
    }
  });
}

// On rule matched in dev mode (for counting when getMatchedRules is unavailable)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dnr = browser.declarativeNetRequest as any;
if (dnr?.onRuleMatchedDebug) {
  dnr.onRuleMatchedDebug.addListener(
    (info: { request?: { tabId?: number } }) => {
      const tabId = info.request?.tabId;
      if (tabId !== undefined && tabId >= 0) {
        recordStatDirect('network', 1, tabId).catch(() => {});
        updateBadgeAndIcon(tabId).catch(() => {});
      }
    }
  );
}

// Ensure bootstrap runs on initial background evaluation
bootstrap().catch(console.error);
