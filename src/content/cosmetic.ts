// src/content/cosmetic.ts
// High-performance cosmetic element hiding (Su Ad Blocker Pro)

import { browser } from '../shared/browser.js';
import { sendMessage } from '../shared/messages.js';
import type { PagePolicy } from '../shared/types.js';
import genericSelectors from './cosmetic-selectors.json';

// Respond to diagnostics heartbeat
if (browser.runtime?.onMessage) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.runtime.onMessage.addListener((msg: any) => {
    if (msg?.type === 'PING_CONTENT_SCRIPT' && (!msg.script || msg.script === 'cosmetic')) {
      return Promise.resolve({ ok: true, script: 'cosmetic', runAt: 'document_start', allFrames: true });
    }
    return undefined;
  });
}

async function initCosmeticFiltering() {
  const hostname = window.location.hostname;
  if (!hostname) return;

  try {
    const res = await sendMessage<PagePolicy>({
      type: 'GET_PAGE_POLICY',
      hostname,
    });

    if (!res.ok || !res.data.enabled || res.data.paused) {
      return; // Disabled or paused on this domain
    }

    const customSelectors = res.data.cosmeticSelectors || [];
    const allSelectors = [...genericSelectors, ...customSelectors];

    if (allSelectors.length === 0) return;

    // Build consolidated stylesheet with high specificity
    const css = `${allSelectors.join(',\n')} {\n  display: none !important;\n}\n`;

    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-su-cosmetic', 'true');
    styleEl.textContent = css;

    const parent = document.head || document.documentElement;
    if (parent) {
      parent.appendChild(styleEl);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        (document.head || document.documentElement)?.appendChild(styleEl);
      }, { once: true });
    }

    // Measure hidden elements efficiently without causing reflow loops
    const countHiddenElements = () => {
      try {
        let hiddenCount = 0;
        // Sample first 40 high-probability ad selectors in a non-blocking idle callback
        const sample = allSelectors.slice(0, 40);
        const check = () => {
          for (const sel of sample) {
            try {
              const matches = document.querySelectorAll(sel);
              hiddenCount += matches.length;
            } catch {
              // ignore invalid selector syntax
            }
          }
          if (hiddenCount > 0) {
            sendMessage({
              type: 'INCR_STATS',
              category: 'cosmetic',
              amount: hiddenCount,
            }).catch(() => {});
          }
        };

        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(check, { timeout: 1500 });
        } else {
          setTimeout(check, 250);
        }
      } catch {
        // fail silently
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', countHiddenElements, {
        once: true,
      });
    } else {
      countHiddenElements();
    }
  } catch (err) {
    console.debug('[Su AdBlock Pro] Cosmetic script error:', err);
  }
}

initCosmeticFiltering();
