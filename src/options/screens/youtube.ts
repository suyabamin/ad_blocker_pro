// src/options/screens/youtube.ts
// YouTube preferences screen (02_AppFlow §3, 04_TRD §8)

import { sendMessage } from '../../shared/messages.js';
import type { GlobalState } from '../../shared/types.js';
import { showToast } from '../../popup/view.js';

export async function renderYouTubeScreen(container: HTMLElement): Promise<void> {
  const stateRes = await sendMessage<GlobalState>({ type: 'GET_STATE' });
  if (!stateRes.ok) {
    container.textContent = 'Failed to load settings.';
    return;
  }

  const settings = stateRes.data.settings;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = 'var(--space-4)';

  const header = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'YouTube Preferences';
  title.style.fontSize = 'var(--text-h1-size)';
  title.style.fontWeight = 'var(--text-h1-weight)';
  header.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent =
    'Configure video ad neutralization and cosmetic filtering for YouTube (best-effort, personal use only).';
  desc.style.color = 'var(--color-text-muted)';
  desc.style.fontSize = 'var(--text-small-size)';
  desc.style.marginTop = 'var(--space-1)';
  header.appendChild(desc);
  wrapper.appendChild(header);

  const card = document.createElement('div');
  card.className = 'card';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = 'var(--space-4)';

  // 1. Layer 1: Prune Player Data (MAIN World)
  card.appendChild(
    createToggleRow(
      'Prune player ad response (Layer 1 — Strongest)',
      'Intercepts and purges ad placements from YouTube player responses before the video player initializes.',
      settings.youtubePrunePlayerData,
      async (val) => {
        await sendMessage({
          type: 'SET_SETTINGS',
          settings: { youtubePrunePlayerData: val },
        });
        showToast('Player data pruning updated (reload YouTube to apply)');
      }
    )
  );

  // 2. Auto Skip
  card.appendChild(
    createToggleRow(
      'Auto-skip video ads',
      'Automatically clicks the Skip Ad button within 1 second of it appearing.',
      settings.youtubeAutoSkip,
      async (val) => {
        await sendMessage({
          type: 'SET_SETTINGS',
          settings: { youtubeAutoSkip: val },
        });
        showToast('Auto-skip setting updated');
      }
    )
  );

  // 2. Speed Unskippable
  card.appendChild(
    createToggleRow(
      'Neutralize unskippable ads',
      'Mutes unskippable ads, speeds playback to 16x, and fast-forwards to completion.',
      settings.youtubeSpeedUnskippable,
      async (val) => {
        await sendMessage({
          type: 'SET_SETTINGS',
          settings: { youtubeSpeedUnskippable: val },
        });
        showToast('Unskippable ad setting updated');
      }
    )
  );

  // 3. Hide Banners
  card.appendChild(
    createToggleRow(
      'Hide banners and promoted items',
      'Hides homepage masthead ads, sidebar sponsored slots, and video banner overlays.',
      settings.youtubeHideBanners,
      async (val) => {
        await sendMessage({
          type: 'SET_SETTINGS',
          settings: { youtubeHideBanners: val },
        });
        showToast('Banner hiding setting updated');
      }
    )
  );

  wrapper.appendChild(card);
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
