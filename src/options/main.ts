// src/options/main.ts
// Options page entrypoint and shell layout (02_AppFlow §3, 03_UI_Spec)

import { HashRouter } from './router.js';
import { createIconElement } from '../ui/icons.js';
import { renderGeneralScreen } from './screens/general.js';
import { renderFilterListsScreen } from './screens/lists.js';
import { renderAllowlistScreen } from './screens/allowlist.js';
import { renderCustomRulesScreen } from './screens/custom.js';
import { renderYouTubeScreen } from './screens/youtube.js';
import { renderStatsScreen } from './screens/stats.js';
import { renderAboutScreen } from './screens/about.js';

function createNav(sidebar: HTMLElement): void {
  // Brand Header
  const brand = document.createElement('div');
  brand.style.display = 'flex';
  brand.style.alignItems = 'center';
  brand.style.gap = 'var(--space-2)';
  brand.style.marginBottom = 'var(--space-6)';

  const icon = createIconElement('shield');
  icon.style.color = 'var(--color-primary)';
  brand.appendChild(icon);

  const titleCol = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = 'Su AdBlock Pro';
  title.style.fontSize = 'var(--text-h2-size)';
  title.style.fontWeight = '700';
  title.style.lineHeight = '1.2';
  titleCol.appendChild(title);

  const tagline = document.createElement('div');
  tagline.textContent = 'Browse Faster. Stay Ad-Free.';
  tagline.style.fontSize = '11px';
  tagline.style.color = 'var(--color-text-muted)';
  titleCol.appendChild(tagline);

  brand.appendChild(titleCol);

  sidebar.appendChild(brand);

  // Navigation Links
  const nav = document.createElement('nav');
  nav.style.display = 'flex';
  nav.style.flexDirection = 'column';
  nav.style.gap = 'var(--space-1)';

  const links = [
    { hash: '#/general', label: 'General', icon: 'settings' },
    { hash: '#/lists', label: 'Filter Lists', icon: 'list' },
    { hash: '#/allowlist', label: 'Allowlist', icon: 'pause' },
    { hash: '#/custom', label: 'Custom Rules', icon: 'plus' },
    { hash: '#/youtube', label: 'YouTube', icon: 'youtube' },
    { hash: '#/stats', label: 'Statistics', icon: 'chart' },
    { hash: '#/about', label: 'About', icon: 'info' },
  ] as const;

  for (const item of links) {
    const a = document.createElement('a');
    a.href = item.hash;
    a.className = 'btn btn-ghost nav-link';
    a.style.justifyContent = 'flex-start';
    a.style.padding = '0 var(--space-3)';
    a.style.height = '40px';
    a.style.borderRadius = 'var(--radius-md)';
    a.style.textDecoration = 'none';

    a.appendChild(createIconElement(item.icon));
    const span = document.createElement('span');
    span.textContent = item.label;
    a.appendChild(span);

    nav.appendChild(a);
  }

  sidebar.appendChild(nav);
}

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app') || document.body;

  // Clear app
  while (app.firstChild) {
    app.removeChild(app.firstChild);
  }

  // Shell Layout
  const shell = document.createElement('div');
  shell.style.display = 'flex';
  shell.style.minHeight = '100vh';

  // Sidebar
  const sidebar = document.createElement('aside');
  sidebar.style.width = '240px';
  sidebar.style.padding = 'var(--space-5) var(--space-4)';
  sidebar.style.borderRight = '1px solid var(--color-border)';
  sidebar.style.backgroundColor = 'var(--color-surface)';
  sidebar.style.flexShrink = '0';
  createNav(sidebar);
  shell.appendChild(sidebar);

  // Content Area
  const main = document.createElement('main');
  main.style.flex = '1';
  main.style.padding = 'var(--space-6) var(--space-7)';
  main.style.overflowY = 'auto';

  const contentContainer = document.createElement('div');
  contentContainer.style.maxWidth = '720px';
  contentContainer.style.margin = '0 auto';
  main.appendChild(contentContainer);
  shell.appendChild(main);

  app.appendChild(shell);

  // Router Setup
  const router = new HashRouter(contentContainer);
  router
    .register('#/general', renderGeneralScreen)
    .register('#/lists', renderFilterListsScreen)
    .register('#/allowlist', renderAllowlistScreen)
    .register('#/custom', renderCustomRulesScreen)
    .register('#/youtube', renderYouTubeScreen)
    .register('#/stats', renderStatsScreen)
    .register('#/about', renderAboutScreen);

  router.start();
});
