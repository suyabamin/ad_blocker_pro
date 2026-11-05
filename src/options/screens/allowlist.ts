// src/options/screens/allowlist.ts
// Allowlist (paused sites) screen (02_AppFlow §3, 05_Schema §2.3)

import { sendMessage } from '../../shared/messages.js';
import type { GlobalState } from '../../shared/types.js';
import { normalizeHostname } from '../../shared/validation.js';
import { showToast } from '../../popup/view.js';
import { createIconElement } from '../../ui/icons.js';

export async function renderAllowlistScreen(container: HTMLElement): Promise<void> {
  const stateRes = await sendMessage<GlobalState>({ type: 'GET_STATE' });
  if (!stateRes.ok) {
    container.textContent = 'Failed to load allowlist.';
    return;
  }

  const allowlist = stateRes.data.allowlist;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = 'var(--space-4)';

  const header = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'Allowlist (Paused Sites)';
  title.style.fontSize = 'var(--text-h1-size)';
  title.style.fontWeight = 'var(--text-h1-weight)';
  header.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = 'Websites where Su Ad Blocker Pro is paused. Ads and tracking requests will not be blocked on these sites.';
  desc.style.color = 'var(--color-text-muted)';
  desc.style.fontSize = 'var(--text-small-size)';
  desc.style.marginTop = 'var(--space-1)';
  header.appendChild(desc);
  wrapper.appendChild(header);

  // Add Hostname Form
  const formCard = document.createElement('div');
  formCard.className = 'card';
  formCard.style.display = 'flex';
  formCard.style.gap = 'var(--space-3)';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'e.g. example.com';
  input.className = 'input';
  formCard.appendChild(input);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.appendChild(createIconElement('plus'));
  const addText = document.createElement('span');
  addText.textContent = 'Add Site';
  addBtn.appendChild(addText);

  addBtn.addEventListener('click', async () => {
    const raw = input.value.trim();
    const cleanHost = normalizeHostname(raw);
    if (!cleanHost) {
      showToast('Invalid hostname syntax', true);
      return;
    }

    const res = await sendMessage({
      type: 'SET_SITE_PAUSED',
      hostname: cleanHost,
      paused: true,
    });

    if (res.ok) {
      showToast(`Added ${cleanHost} to allowlist`);
      input.value = '';
      renderAllowlistScreen(container);
    } else {
      showToast('Failed to add site', true);
    }
  });

  formCard.appendChild(addBtn);
  wrapper.appendChild(formCard);

  // Allowlist Items Table
  const tableCard = document.createElement('div');
  tableCard.className = 'card';
  tableCard.style.padding = '0';
  tableCard.style.overflow = 'hidden';

  if (allowlist.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.style.padding = 'var(--space-6) var(--space-4)';
    emptyRow.style.textAlign = 'center';
    emptyRow.style.color = 'var(--color-text-muted)';
    emptyRow.textContent = 'No paused sites. Use the popup or the form above to add a site.';
    tableCard.appendChild(emptyRow);
  } else {
    for (const item of allowlist) {
      const row = document.createElement('div');
      row.className = 'list-row';

      const hostCol = document.createElement('div');
      hostCol.textContent = item.hostname;
      hostCol.style.fontWeight = '500';
      row.appendChild(hostCol);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost btn-sm btn-icon-sm';
      delBtn.setAttribute('aria-label', `Remove ${item.hostname}`);
      delBtn.appendChild(createIconElement('trash'));

      delBtn.addEventListener('click', async () => {
        const res = await sendMessage({
          type: 'SET_SITE_PAUSED',
          hostname: item.hostname,
          paused: false,
        });
        if (res.ok) {
          showToast(`Removed ${item.hostname}`);
          renderAllowlistScreen(container);
        } else {
          showToast('Failed to remove site', true);
        }
      });

      row.appendChild(delBtn);
      tableCard.appendChild(row);
    }
  }

  wrapper.appendChild(tableCard);
  container.appendChild(wrapper);
}
