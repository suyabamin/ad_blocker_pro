// src/background/badge.ts
// Toolbar icon and badge state management (02_AppFlow §1, 03_UI_Spec §1)

import { browser } from '../shared/browser.js';
import { getSettings } from '../shared/storage.js';
import { isAllowlisted } from './allowlist.js';
import { getTabBlockedCount } from './stats.js';

export type BlockerVisualState = 'active' | 'paused' | 'disabled' | 'degraded';

export async function updateBadgeAndIcon(
  tabId?: number,
  overrideState?: BlockerVisualState
): Promise<void> {
  const settings = await getSettings();

  let state: BlockerVisualState = 'active';

  if (overrideState) {
    state = overrideState;
  } else if (!settings.enabled) {
    state = 'disabled';
  }

  // If active, check if current tab hostname is paused
  if (state === 'active' && tabId !== undefined) {
    try {
      const tab = await browser.tabs.get(tabId);
      if (tab?.url) {
        const url = new URL(tab.url);
        if (await isAllowlisted(url.hostname)) {
          state = 'paused';
        }
      }
    } catch {
      // Tab may be closed or special page
    }
  }

  // Set Icon
  const iconSuffix =
    state === 'disabled'
      ? '-disabled'
      : state === 'paused'
        ? '-paused'
        : state === 'degraded'
          ? '-degraded'
          : '';

  const path = {
    '16': `icons/icon-16${iconSuffix}.png`,
    '32': `icons/icon-32${iconSuffix}.png`,
    '48': `icons/icon-48${iconSuffix}.png`,
    '128': `icons/icon-128${iconSuffix}.png`,
  };

  try {
    if (browser.action?.setIcon) {
      if (tabId !== undefined) {
        await browser.action.setIcon({ tabId, path });
      } else {
        await browser.action.setIcon({ path });
      }
    }
  } catch {
    // ignore
  }

  // Set Badge
  try {
    if (browser.action?.setBadgeText) {
      if (state === 'disabled') {
        await browser.action.setBadgeText({ tabId, text: '' });
      } else if (state === 'degraded') {
        await browser.action.setBadgeText({ tabId, text: '!' });
        if (browser.action?.setBadgeBackgroundColor) {
          await browser.action.setBadgeBackgroundColor({
            tabId,
            color: '#DC2626',
          });
        }
      } else if (state === 'paused') {
        await browser.action.setBadgeText({ tabId, text: '' });
      } else {
        // Active
        if (!settings.showBadge || tabId === undefined) {
          await browser.action.setBadgeText({ tabId, text: '' });
        } else {
          const count = await getTabBlockedCount(tabId);
          const text = count > 0 ? (count > 999 ? '999+' : String(count)) : '';
          await browser.action.setBadgeText({ tabId, text });
          if (browser.action?.setBadgeBackgroundColor) {
            await browser.action.setBadgeBackgroundColor({
              tabId,
              color: '#2563EB',
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }
}
