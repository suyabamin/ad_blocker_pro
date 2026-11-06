// src/background/bootstrap.ts
// Service worker bootstrap, setup, and recovery (02_AppFlow §4, 05_Schema §6)

import { browser } from '../shared/browser.js';
import { ALARMS } from '../shared/constants.js';
import { initializeStorage } from '../shared/storage.js';
import { runMigrations } from './migrations.js';
import { reconcileAllowlist } from './allowlist.js';
import { syncAllRulesets } from './rulesets.js';
import { updateBadgeAndIcon } from './badge.js';

let isDegraded = false;
let degradedReason = '';

export function getDegradedStatus(): { degraded: boolean; reason?: string } {
  return { degraded: isDegraded, reason: degradedReason };
}

export function setDegradedStatus(degraded: boolean, reason = ''): void {
  isDegraded = degraded;
  degradedReason = reason;
  updateBadgeAndIcon(undefined, degraded ? 'degraded' : undefined).catch(() => {});
}

export async function bootstrap(): Promise<void> {
  console.log('[Su AdBlock Pro] Bootstrapping background service...');
  try {
    // 1. Run migrations
    await runMigrations();

    // 2. Initialize default storage keys if not set
    await initializeStorage();

    // 3. Reconcile dynamic allowlist rules
    await reconcileAllowlist();

    // 4. Synchronize static DNR rulesets
    await syncAllRulesets();

    // 5. Register 1-min flush stats alarm
    try {
      if (browser.alarms) {
        browser.alarms.create(ALARMS.FLUSH_STATS, { periodInMinutes: 1 });
      }
    } catch {
      // alarms may be restricted
    }

    // 6. Reset degraded status if previously set
    setDegradedStatus(false);

    // 7. Initial badge and icon update
    await updateBadgeAndIcon();

    console.log('[Su AdBlock Pro] Bootstrap completed successfully.');
  } catch (err) {
    console.error('[Su AdBlock Pro] Bootstrap failed, entering DEGRADED state:', err);
    setDegradedStatus(
      true,
      err instanceof Error ? err.message : 'Ruleset or storage initialization failed'
    );
  }
}
