// src/options/screens/custom.ts
// Custom rules editor screen (02_AppFlow §3, 05_Schema §2.4)

import { browser } from '../../shared/browser.js';
import { sendMessage } from '../../shared/messages.js';
import { parseAllCustomRules } from '../../background/customRules.js';
import { showToast } from '../../popup/view.js';

export async function renderCustomRulesScreen(container: HTMLElement): Promise<void> {
  const res = await browser.storage.local.get('customRules');
  const initialText = typeof res['customRules'] === 'string' ? res['customRules'] : '';

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = 'var(--space-4)';

  const header = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent = 'Custom Rules';
  title.style.fontSize = 'var(--text-h1-size)';
  title.style.fontWeight = 'var(--text-h1-weight)';
  header.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent =
    'Add custom network blocking and cosmetic rules (one per line). Supported: ||domain^, @@||domain^, $third-party, $script, $image, ##selector, and ! comments.';
  desc.style.color = 'var(--color-text-muted)';
  desc.style.fontSize = 'var(--text-small-size)';
  desc.style.marginTop = 'var(--space-1)';
  header.appendChild(desc);
  wrapper.appendChild(header);

  // Editor Card
  const card = document.createElement('div');
  card.className = 'card';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = 'var(--space-3)';

  const textarea = document.createElement('textarea');
  textarea.className = 'textarea';
  textarea.style.fontFamily = 'var(--font-mono)';
  textarea.style.fontSize = 'var(--text-mono-size)';
  textarea.style.lineHeight = 'var(--text-mono-lh)';
  textarea.style.minHeight = '280px';
  textarea.placeholder =
    '! Custom filter syntax examples:\n||adservice.example.com^\n@@||allowed.example.com^$image\n##.sponsored-banner\nexample.com##.sidebar-ad';
  textarea.value = initialText;
  card.appendChild(textarea);

  const errorContainer = document.createElement('div');
  errorContainer.style.display = 'none';
  errorContainer.className = 'banner banner-danger';
  errorContainer.style.flexDirection = 'column';
  card.appendChild(errorContainer);

  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'space-between';
  footer.style.alignItems = 'center';

  const stats = document.createElement('div');
  stats.style.fontSize = 'var(--text-small-size)';
  stats.style.color = 'var(--color-text-muted)';
  footer.appendChild(stats);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save Rules';
  footer.appendChild(saveBtn);

  card.appendChild(footer);
  wrapper.appendChild(card);
  container.appendChild(wrapper);

  function validate() {
    const text = textarea.value;
    const { errors, rules, cosmeticHides } = parseAllCustomRules(text);

    while (errorContainer.firstChild) {
      errorContainer.removeChild(errorContainer.firstChild);
    }

    if (errors.length > 0) {
      errorContainer.style.display = 'flex';
      const errorTitle = document.createElement('strong');
      errorTitle.textContent = `${errors.length} syntax error(s):`;
      errorContainer.appendChild(errorTitle);

      for (const err of errors) {
        const item = document.createElement('div');
        item.textContent = `Line ${err.lineNo}: ${err.error}`;
        errorContainer.appendChild(item);
      }
      saveBtn.disabled = true;
    } else {
      errorContainer.style.display = 'none';
      saveBtn.disabled = false;
      stats.textContent = `${rules.length} active network rules, ${cosmeticHides.length} cosmetic hide rules.`;
    }
  }

  textarea.addEventListener('input', validate);
  validate();

  saveBtn.addEventListener('click', async () => {
    const text = textarea.value;
    const saveRes = await sendMessage({ type: 'SAVE_CUSTOM_RULES', text });
    if (saveRes.ok) {
      showToast('Custom rules saved successfully');
    } else {
      showToast(saveRes.error.message, true);
    }
  });
}
