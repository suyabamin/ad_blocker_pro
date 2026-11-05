// src/options/screens/general.ts
// General settings screen (02_AppFlow §3)

import { sendMessage } from '../../shared/messages.js';
import type { GlobalState, ExportFile } from '../../shared/types.js';
import { showToast } from '../../popup/view.js';
import { createIconElement } from '../../ui/icons.js';

export async function renderGeneralScreen(container: HTMLElement): Promise<void> {
  const stateRes = await sendMessage<GlobalState>({ type: 'GET_STATE' });
  if (!stateRes.ok) {
    container.textContent = 'Failed to load settings.';
    return;
  }

  const state = stateRes.data;
  const settings = state.settings;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = 'var(--space-5)';

  const title = document.createElement('h1');
  title.textContent = 'General Settings';
  title.style.fontSize = 'var(--text-h1-size)';
  title.style.fontWeight = 'var(--text-h1-weight)';
  wrapper.appendChild(title);

  // Card 1: Main Toggles
  const card = document.createElement('div');
  card.className = 'card';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = 'var(--space-4)';

  // Row: Global Blocker
  const rowBlocker = createToggleRow(
    'Enable Su Ad Blocker Pro',
    'Block ads, trackers, and malicious requests across all websites.',
    settings.enabled,
    async (val) => {
      await sendMessage({ type: 'SET_ENABLED', value: val });
      showToast(val ? 'Su Ad Blocker Pro enabled' : 'Su Ad Blocker Pro disabled');
    }
  );
  card.appendChild(rowBlocker);

  // Row: Badge Counter
  const rowBadge = createToggleRow(
    'Show blocked count badge',
    'Display the number of blocked requests on the toolbar icon.',
    settings.showBadge,
    async (val) => {
      await sendMessage({
        type: 'SET_SETTINGS',
        settings: { showBadge: val },
      });
      showToast('Badge setting updated');
    }
  );
  card.appendChild(rowBadge);

  // Row: Diagnostic Debug Logging
  const rowDebug = createToggleRow(
    'Diagnostic Debug Logging',
    'Record the last 500 extension and YouTube events in a local session ring buffer.',
    settings.debug,
    async (val) => {
      await sendMessage({
        type: 'SET_SETTINGS',
        settings: { debug: val },
      });
      showToast(val ? 'Debug logging enabled' : 'Debug logging disabled');
    }
  );
  card.appendChild(rowDebug);

  // Row: Theme
  const themeRow = document.createElement('div');
  themeRow.style.display = 'flex';
  themeRow.style.justifyContent = 'space-between';
  themeRow.style.alignItems = 'center';

  const themeLabelCol = document.createElement('div');
  const themeTitle = document.createElement('div');
  themeTitle.textContent = 'Appearance Theme';
  themeTitle.style.fontWeight = '500';
  themeLabelCol.appendChild(themeTitle);

  const themeDesc = document.createElement('div');
  themeDesc.textContent = 'Choose between light, dark, or system preference.';
  themeDesc.style.fontSize = 'var(--text-small-size)';
  themeDesc.style.color = 'var(--color-text-muted)';
  themeLabelCol.appendChild(themeDesc);
  themeRow.appendChild(themeLabelCol);

  const themeSelect = document.createElement('select');
  themeSelect.className = 'input';
  themeSelect.style.width = '140px';

  for (const t of ['system', 'light', 'dark']) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    if (settings.theme === t) opt.selected = true;
    themeSelect.appendChild(opt);
  }

  themeSelect.addEventListener('change', async () => {
    const chosen = themeSelect.value as 'system' | 'light' | 'dark';
    document.documentElement.setAttribute(
      'data-theme',
      chosen === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : chosen
    );
    await sendMessage({ type: 'UPDATE_THEME', theme: chosen });
    showToast(`Theme set to ${chosen}`);
  });

  themeRow.appendChild(themeSelect);
  card.appendChild(themeRow);

  wrapper.appendChild(card);

  // Card 2: Export & Import
  const backupCard = document.createElement('div');
  backupCard.className = 'card';
  backupCard.style.display = 'flex';
  backupCard.style.flexDirection = 'column';
  backupCard.style.gap = 'var(--space-3)';

  const backupTitle = document.createElement('h2');
  backupTitle.textContent = 'Backup & Restore';
  backupTitle.style.fontSize = 'var(--text-h2-size)';
  backupCard.appendChild(backupTitle);

  const backupDesc = document.createElement('p');
  backupDesc.textContent = 'Export or restore your custom settings, filter list configurations, and allowlist.';
  backupDesc.style.fontSize = 'var(--text-small-size)';
  backupDesc.style.color = 'var(--color-text-muted)';
  backupCard.appendChild(backupDesc);

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = 'var(--space-3)';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-secondary';
  exportBtn.appendChild(createIconElement('download'));
  const exportText = document.createElement('span');
  exportText.textContent = 'Export Settings';
  exportBtn.appendChild(exportText);

  exportBtn.addEventListener('click', async () => {
    const expRes = await sendMessage<ExportFile>({ type: 'EXPORT_SETTINGS' });
    if (expRes.ok) {
      const blob = new Blob([JSON.stringify(expRes.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `su-adblock-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Settings exported');
    } else {
      showToast('Failed to export settings', true);
    }
  });
  btnRow.appendChild(exportBtn);

  const importBtn = document.createElement('button');
  importBtn.className = 'btn btn-secondary';
  importBtn.appendChild(createIconElement('upload'));
  const importText = document.createElement('span');
  importText.textContent = 'Import Settings';
  importBtn.appendChild(importText);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.style.display = 'none';

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      const impRes = await sendMessage({ type: 'IMPORT_SETTINGS', json: text });
      if (impRes.ok) {
        showToast('Settings imported successfully! Reloading...');
        setTimeout(() => window.location.reload(), 800);
      } else {
        alert(`Import Error: ${impRes.error.message}`);
      }
    };
    reader.readAsText(file);
  });

  importBtn.addEventListener('click', () => fileInput.click());
  btnRow.appendChild(importBtn);
  btnRow.appendChild(fileInput);

  backupCard.appendChild(btnRow);
  wrapper.appendChild(backupCard);

  container.appendChild(wrapper);
}

function createToggleRow(
  title: string,
  desc: string,
  initialVal: boolean,
  onChange: (val: boolean) => Promise<void>
): HTMLElement {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.alignItems = 'center';

  const col = document.createElement('div');
  const t = document.createElement('div');
  t.textContent = title;
  t.style.fontWeight = '500';
  col.appendChild(t);

  const d = document.createElement('div');
  d.textContent = desc;
  d.style.fontSize = 'var(--text-small-size)';
  d.style.color = 'var(--color-text-muted)';
  col.appendChild(d);
  row.appendChild(col);

  const sw = document.createElement('button');
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', String(initialVal));
  sw.className = 'switch';
  const knob = document.createElement('span');
  knob.className = 'switch-knob';
  sw.appendChild(knob);

  let curVal = initialVal;
  sw.addEventListener('click', async () => {
    curVal = !curVal;
    sw.setAttribute('aria-checked', String(curVal));
    await onChange(curVal);
  });

  row.appendChild(sw);
  return row;
}
