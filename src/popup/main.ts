// src/popup/main.ts
// Popup controller (02_AppFlow §2)

import { browser } from '../shared/browser.js';
import { sendMessage } from '../shared/messages.js';
import type { GlobalState } from '../shared/types.js';
import { renderPopup, showToast, type PopupViewModel } from './view.js';

let activeTabId: number | undefined;
let currentHostname = '';
let currentUrl = '';
let isUnsupportedPage = false;

const appEl = document.getElementById('app') || document.body;

const model: PopupViewModel = {
  state: 'loading',
  enabled: true,
  blockedCount: 0,
  todayCount: 0,
  hostname: '',
  isPausedOnSite: false,
};

async function loadTabInfo() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && tab.id !== undefined && tab.url) {
      activeTabId = tab.id;
      currentUrl = tab.url;

      try {
        const parsed = new URL(tab.url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          currentHostname = parsed.hostname;
          isUnsupportedPage = false;
        } else {
          isUnsupportedPage = true;
        }
      } catch {
        isUnsupportedPage = true;
      }
    } else {
      isUnsupportedPage = true;
    }
  } catch (err) {
    console.error('[Su AdBlock Pro Popup] Failed to get active tab:', err);
    isUnsupportedPage = true;
  }
}

async function refreshState() {
  await loadTabInfo();

  try {
    const stateRes = await sendMessage<GlobalState>({ type: 'GET_STATE' });
    if (!stateRes.ok) {
      model.state = 'degraded';
      model.degradedReason = stateRes.error.message;
      updateView();
      return;
    }

    const state = stateRes.data;
    model.enabled = state.enabled;
    model.todayCount =
      state.todayStats.networkBlocked +
      state.todayStats.cosmeticHidden +
      state.todayStats.youtubeAdsSkipped;

    if (state.degraded) {
      model.state = 'degraded';
      model.degradedReason = state.degradedReason;
    } else if (isUnsupportedPage) {
      model.state = 'unsupported';
    } else if (!state.enabled) {
      model.state = 'globally_disabled';
    } else {
      // Check if paused on current hostname
      const isPaused = state.allowlist.some(
        (a) =>
          currentHostname === a.hostname ||
          currentHostname.endsWith(`.${a.hostname}`)
      );
      model.isPausedOnSite = isPaused;
      model.hostname = currentHostname;
      model.state = isPaused ? 'site_paused' : 'normal';

      if (activeTabId !== undefined) {
        const countRes = await sendMessage<{ count: number }>({
          type: 'GET_TAB_COUNT',
          tabId: activeTabId,
        });
        if (countRes.ok) {
          model.blockedCount = countRes.data.count;
        }
      }
    }
  } catch (err) {
    model.state = 'degraded';
    model.degradedReason = err instanceof Error ? err.message : 'Connection error';
  }

  updateView();
}

function updateView() {
  renderPopup(appEl, model, {
    onToggleEnabled: async (newVal) => {
      try {
        const res = await sendMessage({ type: 'SET_ENABLED', value: newVal });
        if (res.ok) {
          model.enabled = newVal;
          await refreshState();
        } else {
          showToast("Couldn't change state", true);
        }
      } catch {
        showToast("Couldn't change state", true);
      }
    },

    onToggleSitePaused: async (newVal) => {
      if (!currentHostname) return;
      try {
        const res = await sendMessage({
          type: 'SET_SITE_PAUSED',
          hostname: currentHostname,
          paused: newVal,
        });
        if (res.ok) {
          model.isPausedOnSite = newVal;
          model.state = newVal ? 'site_paused' : 'normal';
          updateView();
          showToast(newVal ? 'Site paused. Reload to apply.' : 'Site unpaused. Reload to apply.');
          if (activeTabId !== undefined) {
            browser.tabs.reload(activeTabId).catch(() => {});
          }
        } else {
          showToast('Failed to pause site', true);
        }
      } catch {
        showToast('Failed to pause site', true);
      }
    },

    onReloadTab: () => {
      if (activeTabId !== undefined) {
        browser.tabs.reload(activeTabId).catch(() => {});
      }
    },

    onOpenSettings: () => {
      if (browser.runtime.openOptionsPage) {
        browser.runtime.openOptionsPage().catch(() => {});
      }
    },

    onReportBrokenSite: async () => {
      const stateRes = await sendMessage<GlobalState>({ type: 'GET_STATE' });
      const enabledLists = stateRes.ok
        ? stateRes.data.filterLists.filter((l) => l.enabled).map((l) => l.name).join(', ')
        : 'unknown';

      const diagnosticText = [
        '--- Su Ad Blocker Pro Diagnostic Report ---',
        `URL: ${currentUrl || 'n/a'}`,
        `Hostname: ${currentHostname || 'n/a'}`,
        `Version: 0.1.0`,
        `Browser: ${navigator.userAgent}`,
        `Su AdBlock Pro Enabled: ${model.enabled}`,
        `Site Paused: ${model.isPausedOnSite}`,
        `Enabled Filter Lists: ${enabledLists}`,
        `Blocked on Tab: ${model.blockedCount}`,
        '-------------------------------------------',
      ].join('\n');

      try {
        await navigator.clipboard.writeText(diagnosticText);
        showToast('Diagnostic details copied to clipboard');
      } catch {
        showToast('Copy failed: clipboard permission denied', true);
      }
    },

    onRetryBootstrap: async () => {
      await refreshState();
    },
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderPopup(appEl, model, {
    onToggleEnabled: () => {},
    onToggleSitePaused: () => {},
    onReloadTab: () => {},
    onOpenSettings: () => {},
    onReportBrokenSite: () => {},
    onRetryBootstrap: () => {},
  });
  refreshState();
});
