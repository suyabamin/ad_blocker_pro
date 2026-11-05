// src/options/screens/lists.ts
// Filter Lists management screen (02_AppFlow §3, 05_Schema §2.2)

import { sendMessage } from '../../shared/messages.js';
import type { GlobalState } from '../../shared/types.js';
import { showToast } from '../../popup/view.js';

export async function renderFilterListsScreen(container: HTMLElement): Promise<void> {
  const stateRes = await sendMessage<GlobalState>({ type: 'GET_STATE' });
  if (!stateRes.ok) {
    container.textContent = 'Failed to load filter lists.';
    return;
  }

  const { filterLists, rulesetLimits } = stateRes.data;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = 'var(--space-4)';

  const header = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'Filter Lists';
  title.style.fontSize = 'var(--text-h1-size)';
  title.style.fontWeight = 'var(--text-h1-weight)';
  header.appendChild(title);

  const desc = document.createElement('p');
  const available = rulesetLimits?.availableStaticRuleCount ?? 30000;
  desc.textContent = `Bundled network rulesets. Available browser rule capacity: ${available.toLocaleString()} rules.`;
  desc.style.color = 'var(--color-text-muted)';
  desc.style.fontSize = 'var(--text-small-size)';
  desc.style.marginTop = 'var(--space-1)';
  header.appendChild(desc);
  wrapper.appendChild(header);

  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '0';
  card.style.overflow = 'hidden';

  for (const list of filterLists) {
    const row = document.createElement('div');
    row.className = 'list-row';

    const infoCol = document.createElement('div');
    const name = document.createElement('div');
    name.textContent = list.name;
    name.style.fontWeight = '500';
    infoCol.appendChild(name);

    const meta = document.createElement('div');
    meta.style.fontSize = 'var(--text-small-size)';
    meta.style.color = 'var(--color-text-muted)';
    const dateStr = list.fetchedAt ? new Date(list.fetchedAt).toLocaleDateString() : 'Bundled';
    meta.textContent = `${list.ruleCount.toLocaleString()} rules • Updated: ${dateStr}`;
    infoCol.appendChild(meta);
    row.appendChild(infoCol);

    const sw = document.createElement('button');
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-label', `Toggle ${list.name}`);
    sw.setAttribute('aria-checked', String(list.enabled));
    sw.className = 'switch';
    const knob = document.createElement('span');
    knob.className = 'switch-knob';
    sw.appendChild(knob);

    let isEnabled = list.enabled;
    sw.addEventListener('click', async () => {
      const nextVal = !isEnabled;
      sw.setAttribute('aria-checked', String(nextVal));

      const res = await sendMessage({
        type: 'SET_LIST_ENABLED',
        id: list.id,
        value: nextVal,
      });

      if (res.ok) {
        isEnabled = nextVal;
        showToast(`${list.name} ${nextVal ? 'enabled' : 'disabled'}`);
      } else {
        // Revert switch on failure (02_AppFlow §3)
        sw.setAttribute('aria-checked', String(isEnabled));
        showToast(res.error.message, true);
      }
    });

    row.appendChild(sw);
    card.appendChild(row);
  }

  wrapper.appendChild(card);
  container.appendChild(wrapper);
}
