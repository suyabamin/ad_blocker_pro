// src/background/rulesets.ts
// Static ruleset management and limit checks (04_TRD §5, 05_Schema §2.2)

import { browser } from '../shared/browser.js';
import { getFilterLists, setFilterLists, getSettings } from '../shared/storage.js';

export async function getAvailableStaticRuleCount(): Promise<number> {
  try {
    if (browser.declarativeNetRequest?.getAvailableStaticRuleCount) {
      return await browser.declarativeNetRequest.getAvailableStaticRuleCount();
    }
  } catch {
    // fallback if unsupported
  }
  return 30000;
}

export async function syncAllRulesets(): Promise<void> {
  const settings = await getSettings();
  const lists = await getFilterLists();

  const enableRulesetIds: string[] = [];
  const disableRulesetIds: string[] = [];

  for (const list of lists) {
    if (settings.enabled && list.enabled) {
      enableRulesetIds.push(list.id);
    } else {
      disableRulesetIds.push(list.id);
    }
  }

  try {
    if (browser.declarativeNetRequest?.updateEnabledRulesets) {
      await browser.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds,
        disableRulesetIds,
      });
    }
  } catch (err) {
    console.error('[Su AdBlock Pro] Failed to update static rulesets:', err);
    throw err;
  }
}

export async function setListEnabled(
  listId: string,
  enable: boolean
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const lists = await getFilterLists();
  const target = lists.find((l) => l.id === listId);

  if (!target) {
    return {
      ok: false,
      code: 'LIST_NOT_FOUND',
      message: `Filter list "${listId}" does not exist.`,
    };
  }

  if (target.enabled === enable) {
    return { ok: true };
  }

  if (enable) {
    const available = await getAvailableStaticRuleCount();
    if (target.ruleCount > available) {
      return {
        ok: false,
        code: 'RULE_LIMIT',
        message: `Cannot enable ${target.name}: requires ${target.ruleCount} rules, but only ${available} available.`,
      };
    }
  }

  // Update storage
  const updated = lists.map((l) => (l.id === listId ? { ...l, enabled: enable } : l));
  await setFilterLists(updated);

  // Apply to browser
  const settings = await getSettings();
  if (settings.enabled) {
    try {
      if (browser.declarativeNetRequest?.updateEnabledRulesets) {
        await browser.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: enable ? [listId] : [],
          disableRulesetIds: enable ? [] : [listId],
        });
      }
    } catch (err) {
      // Revert in storage
      await setFilterLists(lists);
      return {
        ok: false,
        code: 'RULESET_UPDATE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to update rulesets in browser',
      };
    }
  }

  return { ok: true };
}
