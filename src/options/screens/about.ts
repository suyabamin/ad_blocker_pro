// src/options/screens/about.ts
// About & Diagnostics screen (Su Ad Blocker Pro — Phase 1 Diagnostic Harness)

import { sendMessage } from '../../shared/messages.js';
import type {
  GlobalState,
  BehavioralSelfTestResult,
  DebugEvent,
} from '../../shared/types.js';
import { showToast } from '../../popup/view.js';
import { createIconElement } from '../../ui/icons.js';

export async function renderAboutScreen(container: HTMLElement): Promise<void> {
  const stateRes = await sendMessage<GlobalState>({ type: 'GET_STATE' });
  const state = stateRes.ok ? stateRes.data : null;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = 'var(--space-4)';

  const header = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'About & Diagnostics';
  title.style.fontSize = 'var(--text-h1-size)';
  title.style.fontWeight = 'var(--text-h1-weight)';
  header.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent =
    'System details, diagnostic utilities, behavioral verification, and debug logging for Su Ad Blocker Pro.';
  desc.style.color = 'var(--color-text-muted)';
  desc.style.fontSize = 'var(--text-small-size)';
  desc.style.marginTop = 'var(--space-1)';
  header.appendChild(desc);
  wrapper.appendChild(header);

  // Card 1: System Info & Diagnostic Actions
  const sysCard = document.createElement('div');
  sysCard.className = 'card';
  sysCard.style.display = 'flex';
  sysCard.style.flexDirection = 'column';
  sysCard.style.gap = 'var(--space-3)';

  const sysTitle = document.createElement('h2');
  sysTitle.textContent = 'Su Ad Blocker Pro v0.1.0';
  sysTitle.style.fontSize = 'var(--text-h2-size)';
  sysCard.appendChild(sysTitle);

  const tagline = document.createElement('div');
  tagline.textContent = 'Browse Faster. Stay Ad-Free.';
  tagline.style.fontSize = 'var(--text-body-size)';
  tagline.style.fontWeight = '600';
  tagline.style.color = 'var(--color-primary)';
  sysCard.appendChild(tagline);

  const sysDesc = document.createElement('p');
  sysDesc.textContent =
    'Professional, zero-cost, high-performance Manifest V3 cross-browser ad blocker with native Declarative Net Request rules, intelligent cosmetic element hiding, and multi-layered YouTube ad neutralization.';
  sysDesc.style.fontSize = 'var(--text-body-size)';
  sysDesc.style.color = 'var(--color-text-muted)';
  sysCard.appendChild(sysDesc);

  // Diagnostic Buttons Bar
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.flexWrap = 'wrap';
  btnRow.style.gap = 'var(--space-2)';
  btnRow.style.marginTop = 'var(--space-2)';

  // Button: Copy Diagnostics
  const copyDiagBtn = document.createElement('button');
  copyDiagBtn.className = 'btn btn-secondary btn-sm';
  copyDiagBtn.appendChild(createIconElement('copy'));
  const copyDiagText = document.createElement('span');
  copyDiagText.textContent = 'Copy Diagnostics';
  copyDiagBtn.appendChild(copyDiagText);

  copyDiagBtn.addEventListener('click', async () => {
    try {
      const selfTestRes = await sendMessage<BehavioralSelfTestResult>({
        type: 'RUN_BEHAVIORAL_SELFTEST',
      });
      const testData = selfTestRes.ok ? selfTestRes.data : null;

      const debugEvents = (await sendMessage<DebugEvent[]>({
        type: 'GET_DEBUG_LOG',
      })) as { ok: boolean; data: DebugEvent[] };

      const listsText =
        state?.filterLists
          .map((l) => `${l.name} (${l.enabled ? 'ON' : 'OFF'}, ${l.ruleCount} rules)`)
          .join('; ') || 'none';

      const allowlistHosts = state?.allowlist.map((a) => a.hostname).join(', ') || 'none';
      const last100Events = (debugEvents?.data || [])
        .slice(-100)
        .map(
          (e) =>
            `[${new Date(e.timestamp).toISOString()}] [${e.component}:${e.stage}] ${e.outcome}${e.reason ? ' (' + e.reason + ')' : ''}`
        )
        .join('\n');

      const diag = [
        '=== Su Ad Blocker Pro Diagnostic Report ===',
        `Extension Version: 0.1.0`,
        `Browser: ${navigator.userAgent}`,
        `Schema Version: 1`,
        `Settings: ${JSON.stringify(state?.settings || {})}`,
        `Filter Lists: ${listsText}`,
        `Available Static Rule Capacity: ${state?.rulesetLimits?.availableStaticRuleCount ?? 'unknown'}`,
        `Allowlist: ${allowlistHosts}`,
        `Custom Rules Count: ${state?.customRulesCount ?? 0}`,
        '',
        '--- Behavioral Self-Test Outcome ---',
        `Enabled Rulesets: ${testData?.rules.enabledRulesets.join(', ') || 'none'}`,
        `Expected Rulesets: ${testData?.rules.expectedRulesets.join(', ') || 'none'}`,
        `Rulesets Match: ${testData?.rules.rulesetsMatch ?? false}`,
        `Canary Blocked Check: ${testData?.rules.canaryBlockedCheck ?? 'unknown'}`,
        `Cosmetic Content Script in Active Tab: ${testData?.contentScripts.cosmeticActiveInTab ?? false}`,
        `YouTube Content Script in Active Tab: ${testData?.contentScripts.youtubeActiveInTab ?? false}`,
        `YouTube Watch Page Diagnostics: ${JSON.stringify(testData?.youtube || 'Not on YouTube watch page')}`,
        '',
        '--- Last 100 Debug Events ---',
        last100Events || 'No debug events recorded. Enable Diagnostic Debug Logging in General Settings.',
        '===========================================',
      ].join('\n');

      await navigator.clipboard.writeText(diag);
      showToast('Complete diagnostics copied to clipboard (paste into chat)');
    } catch {
      showToast('Failed to copy diagnostics', true);
    }
  });
  btnRow.appendChild(copyDiagBtn);

  // Button: Copy Debug Log
  const copyLogBtn = document.createElement('button');
  copyLogBtn.className = 'btn btn-secondary btn-sm';
  copyLogBtn.appendChild(createIconElement('copy'));
  const copyLogText = document.createElement('span');
  copyLogText.textContent = 'Copy Debug Log';
  copyLogBtn.appendChild(copyLogText);

  copyLogBtn.addEventListener('click', async () => {
    try {
      const debugEvents = (await sendMessage<DebugEvent[]>({
        type: 'GET_DEBUG_LOG',
      })) as { ok: boolean; data: DebugEvent[] };
      const rawLog = JSON.stringify(debugEvents?.data || [], null, 2);
      await navigator.clipboard.writeText(rawLog);
      showToast('Debug log JSON copied to clipboard');
    } catch {
      showToast('Failed to copy debug log', true);
    }
  });
  btnRow.appendChild(copyLogBtn);

  // Button: Clear Debug Log
  const clearLogBtn = document.createElement('button');
  clearLogBtn.className = 'btn btn-ghost btn-sm';
  clearLogBtn.textContent = 'Clear Debug Log';
  clearLogBtn.addEventListener('click', async () => {
    await sendMessage({ type: 'CLEAR_DEBUG_LOG' });
    showToast('Debug log cleared');
  });
  btnRow.appendChild(clearLogBtn);

  sysCard.appendChild(btnRow);
  wrapper.appendChild(sysCard);

  // Card 2: Behavioral Engine Self-Test
  const testCard = document.createElement('div');
  testCard.className = 'card';
  testCard.style.display = 'flex';
  testCard.style.flexDirection = 'column';
  testCard.style.gap = 'var(--space-3)';

  const testTitle = document.createElement('h2');
  testTitle.textContent = 'Behavioral Engine Self-Test';
  testTitle.style.fontSize = 'var(--text-h2-size)';
  testCard.appendChild(testTitle);

  const testDesc = document.createElement('p');
  testDesc.textContent =
    'Verifies live runtime behavior: DNR ruleset matching, canary ad-request blocking, content script heartbeats in the active tab, and live YouTube DOM observers.';
  testDesc.style.fontSize = 'var(--text-small-size)';
  testDesc.style.color = 'var(--color-text-muted)';
  testCard.appendChild(testDesc);

  const runTestBtn = document.createElement('button');
  runTestBtn.className = 'btn btn-primary btn-sm';
  runTestBtn.style.alignSelf = 'flex-start';
  runTestBtn.textContent = 'Run Behavioral Self-Test';

  const testResultsBox = document.createElement('div');
  testResultsBox.style.display = 'none';
  testResultsBox.style.marginTop = 'var(--space-2)';

  runTestBtn.addEventListener('click', async () => {
    runTestBtn.disabled = true;
    runTestBtn.textContent = 'Running Self-Test...';

    try {
      const res = await sendMessage<BehavioralSelfTestResult>({
        type: 'RUN_BEHAVIORAL_SELFTEST',
      });

      while (testResultsBox.firstChild) {
        testResultsBox.removeChild(testResultsBox.firstChild);
      }

      if (!res.ok || !res.data) {
        const errDiv = document.createElement('div');
        errDiv.className = 'banner banner-danger';
        errDiv.textContent = 'Failed to execute behavioral self-test.';
        testResultsBox.appendChild(errDiv);
        testResultsBox.style.display = 'block';
        return;
      }

      const r = res.data;
      const col = document.createElement('div');
      col.style.display = 'flex';
      col.style.flexDirection = 'column';
      col.style.gap = 'var(--space-3)';

      // Section: Rules
      const rulesSection = document.createElement('div');
      rulesSection.style.display = 'flex';
      rulesSection.style.flexDirection = 'column';
      rulesSection.style.gap = 'var(--space-1)';

      const rulesHeader = document.createElement('div');
      rulesHeader.style.fontWeight = '600';
      rulesHeader.textContent = '1. Declarative Net Request Rules';
      rulesSection.appendChild(rulesHeader);

      const badgesRow = document.createElement('div');
      badgesRow.style.display = 'flex';
      badgesRow.style.flexWrap = 'wrap';
      badgesRow.style.gap = 'var(--space-2)';

      const addBadge = (label: string, pass: boolean) => {
        const b = document.createElement('span');
        b.className = `badge ${pass ? 'badge-success' : 'badge-danger'}`;
        b.textContent = label;
        badgesRow.appendChild(b);
      };

      addBadge(
        `Rulesets Match: ${r.rules.rulesetsMatch ? 'Pass' : 'Mismatch'}`,
        r.rules.rulesetsMatch
      );
      addBadge(
        `Static Rule Capacity: ${r.rules.availableStaticRuleCount} available`,
        r.rules.availableStaticRuleCount > 0
      );
      addBadge(
        `Canary Blocked Check: ${r.rules.canaryBlockedCheck.toUpperCase()}`,
        r.rules.canaryBlockedCheck === 'passed'
      );

      rulesSection.appendChild(badgesRow);
      col.appendChild(rulesSection);

      // Section: Content Scripts
      const csSection = document.createElement('div');
      csSection.style.display = 'flex';
      csSection.style.flexDirection = 'column';
      csSection.style.gap = 'var(--space-1)';

      const csHeader = document.createElement('div');
      csHeader.style.fontWeight = '600';
      csHeader.textContent = '2. Content Script Heartbeats (Active Tab)';
      csSection.appendChild(csHeader);

      const csBadgesRow = document.createElement('div');
      csBadgesRow.style.display = 'flex';
      csBadgesRow.style.flexWrap = 'wrap';
      csBadgesRow.style.gap = 'var(--space-2)';

      const addCsBadge = (label: string, active: boolean) => {
        const b = document.createElement('span');
        b.className = `badge ${active ? 'badge-success' : 'badge-neutral'}`;
        b.textContent = label;
        csBadgesRow.appendChild(b);
      };

      addCsBadge(
        `Cosmetic Script: ${r.contentScripts.cosmeticActiveInTab ? 'Active' : 'Inactive in active tab'}`,
        r.contentScripts.cosmeticActiveInTab
      );
      addCsBadge(
        `YouTube Script: ${r.contentScripts.youtubeActiveInTab ? 'Active' : 'Inactive in active tab'}`,
        r.contentScripts.youtubeActiveInTab
      );

      csSection.appendChild(csBadgesRow);
      col.appendChild(csSection);

      // Section: YouTube Diagnostics
      if (r.youtube) {
        const ytSection = document.createElement('div');
        ytSection.style.display = 'flex';
        ytSection.style.flexDirection = 'column';
        ytSection.style.gap = 'var(--space-1)';

        const ytHeader = document.createElement('div');
        ytHeader.style.fontWeight = '600';
        ytHeader.textContent = '3. Live YouTube Diagnostics';
        ytSection.appendChild(ytHeader);

        const ytDetails = document.createElement('div');
        ytDetails.style.fontFamily = 'var(--font-mono)';
        ytDetails.style.fontSize = 'var(--text-small-size)';
        ytDetails.style.backgroundColor = 'var(--color-surface-2)';
        ytDetails.style.padding = 'var(--space-2)';
        ytDetails.style.borderRadius = 'var(--radius-sm)';

        const lines = [
          `Player Found: ${r.youtube.playerFound}`,
          `Video Found: ${r.youtube.videoFound}`,
          `Observer Attached: ${r.youtube.observerAttached} (Target: ${r.youtube.observerTarget})`,
          `Ad State: ${r.youtube.currentAdState ? 'Ad Active' : 'Normal Playback'}`,
          `Last Action Taken: ${r.youtube.lastActionTaken || 'None yet'}`,
          `Last Outcome: ${r.youtube.lastOutcome || 'None yet'}`,
          r.youtube.error ? `Error: ${r.youtube.error}` : null,
        ].filter(Boolean);

        ytDetails.textContent = lines.join('\n');
        ytSection.appendChild(ytDetails);
        col.appendChild(ytSection);
      }

      testResultsBox.appendChild(col);
      testResultsBox.style.display = 'block';
    } finally {
      runTestBtn.disabled = false;
      runTestBtn.textContent = 'Run Behavioral Self-Test';
    }
  });

  testCard.appendChild(runTestBtn);
  testCard.appendChild(testResultsBox);
  wrapper.appendChild(testCard);

  // Card 3: Honesty Note
  const honestyCard = document.createElement('div');
  honestyCard.className = 'card';
  honestyCard.style.borderLeft = '4px solid var(--color-warning)';

  const noteTitle = document.createElement('h3');
  noteTitle.textContent = 'A Note on YouTube Ad Blocking';
  noteTitle.style.fontSize = 'var(--text-body-size)';
  noteTitle.style.fontWeight = '600';
  noteTitle.style.marginBottom = 'var(--space-1)';
  honestyCard.appendChild(noteTitle);

  const noteBody = document.createElement('p');
  noteBody.textContent =
    'YouTube frequently alters its internal DOM architecture and player scripts. Su Ad Blocker Pro uses multi-layered defense (data pruning, cosmetic hiding, skip-button automation, and playback acceleration) on a best-effort basis for personal use. We document technical limitations honestly and provide diagnostic tools to keep the engine maintained.';
  noteBody.style.fontSize = 'var(--text-small-size)';
  noteBody.style.color = 'var(--color-text-muted)';
  honestyCard.appendChild(noteBody);

  wrapper.appendChild(honestyCard);
  container.appendChild(wrapper);
}
