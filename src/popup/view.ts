// src/popup/view.ts
// DOM Renderer for the Popup UI (02_AppFlow §2, 03_UI_Spec)
// Built without innerHTML to satisfy 04_TRD §9 security rules.

import { createIconElement } from '../ui/icons.js';

export interface PopupViewModel {
  state: 'loading' | 'normal' | 'site_paused' | 'globally_disabled' | 'unsupported' | 'degraded';
  enabled: boolean;
  blockedCount: number;
  todayCount: number;
  hostname: string;
  isPausedOnSite: boolean;
  degradedReason?: string;
}

export interface PopupCallbacks {
  onToggleEnabled: (newVal: boolean) => void;
  onToggleSitePaused: (newVal: boolean) => void;
  onReloadTab: () => void;
  onOpenSettings: () => void;
  onReportBrokenSite: () => void;
  onRetryBootstrap: () => void;
}

export function renderPopup(
  container: HTMLElement,
  model: PopupViewModel,
  callbacks: PopupCallbacks
): void {
  // Clear container using DOM methods
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const root = document.createElement('div');
  root.className = 'popup-root';
  root.style.width = '360px';
  root.style.padding = 'var(--space-4)';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.gap = 'var(--space-4)';

  // 1. Header (Logo + Title + Power Switch)
  const header = document.createElement('header');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';

  const brand = document.createElement('div');
  brand.style.display = 'flex';
  brand.style.alignItems = 'center';
  brand.style.gap = 'var(--space-2)';

  const icon = createIconElement('shield');
  icon.style.color = model.enabled ? 'var(--color-primary)' : 'var(--color-text-muted)';
  brand.appendChild(icon);

  const titleCol = document.createElement('div');
  const title = document.createElement('h1');
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
  header.appendChild(brand);

  const powerSwitch = document.createElement('button');
  powerSwitch.setAttribute('role', 'switch');
  powerSwitch.setAttribute('aria-label', 'Toggle Su Ad Blocker Pro globally');
  powerSwitch.setAttribute('aria-checked', String(model.enabled));
  powerSwitch.className = 'switch';
  const knob = document.createElement('span');
  knob.className = 'switch-knob';
  powerSwitch.appendChild(knob);
  powerSwitch.addEventListener('click', () => {
    callbacks.onToggleEnabled(!model.enabled);
  });
  header.appendChild(powerSwitch);

  root.appendChild(header);

  // 2. Degraded Banner (if applicable)
  if (model.state === 'degraded') {
    const banner = document.createElement('div');
    banner.className = 'banner banner-danger';
    const alertIcon = createIconElement('alertCircle');
    banner.appendChild(alertIcon);

    const bannerText = document.createElement('div');
    bannerText.style.flex = '1';
    const reasonP = document.createElement('p');
    reasonP.textContent = model.degradedReason || 'Ruleset load failure';
    bannerText.appendChild(reasonP);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-sm btn-secondary';
    retryBtn.style.marginTop = 'var(--space-1)';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', callbacks.onRetryBootstrap);
    bannerText.appendChild(retryBtn);

    banner.appendChild(bannerText);
    root.appendChild(banner);
  }

  // 3. Hero Card
  const heroCard = document.createElement('div');
  heroCard.className = 'card';
  heroCard.style.textAlign = 'center';
  heroCard.style.padding = 'var(--space-5) var(--space-4)';

  if (model.state === 'loading') {
    const skeletonNum = document.createElement('div');
    skeletonNum.className = 'skeleton';
    skeletonNum.style.height = '44px';
    skeletonNum.style.width = '100px';
    skeletonNum.style.margin = '0 auto var(--space-2) auto';
    heroCard.appendChild(skeletonNum);

    const skeletonSub = document.createElement('div');
    skeletonSub.className = 'skeleton';
    skeletonSub.style.height = '16px';
    skeletonSub.style.width = '160px';
    skeletonSub.style.margin = '0 auto';
    heroCard.appendChild(skeletonSub);
  } else if (model.state === 'unsupported') {
    const msg = document.createElement('div');
    msg.style.fontSize = 'var(--text-h2-size)';
    msg.style.fontWeight = '600';
    msg.textContent = "Can't run on this page";
    heroCard.appendChild(msg);

    const sub = document.createElement('div');
    sub.style.color = 'var(--color-text-muted)';
    sub.style.fontSize = 'var(--text-small-size)';
    sub.style.marginTop = 'var(--space-1)';
    sub.textContent = 'Browser internal and special pages are protected.';
    heroCard.appendChild(sub);
  } else if (!model.enabled) {
    const offText = document.createElement('div');
    offText.style.fontSize = 'var(--text-display-size)';
    offText.style.fontWeight = '700';
    offText.style.color = 'var(--color-text-muted)';
    offText.textContent = 'Off';
    heroCard.appendChild(offText);

    const sub = document.createElement('div');
    sub.style.color = 'var(--color-text-muted)';
    sub.style.fontSize = 'var(--text-small-size)';
    sub.style.marginTop = 'var(--space-1)';
    sub.textContent = 'Su Ad Blocker Pro is disabled globally.';
    heroCard.appendChild(sub);
  } else if (model.isPausedOnSite) {
    const pauseTitle = document.createElement('div');
    pauseTitle.style.fontSize = 'var(--text-h2-size)';
    pauseTitle.style.fontWeight = '600';
    pauseTitle.style.color = 'var(--color-warning)';
    pauseTitle.textContent = 'Paused on this site';
    heroCard.appendChild(pauseTitle);

    const sub = document.createElement('div');
    sub.style.color = 'var(--color-text-muted)';
    sub.style.fontSize = 'var(--text-small-size)';
    sub.style.marginTop = 'var(--space-1)';
    sub.textContent = 'Ads and trackers are allowed here.';
    heroCard.appendChild(sub);
  } else {
    // Active Normal
    const num = document.createElement('div');
    num.className = 'tabular-nums';
    num.style.fontSize = 'var(--text-display-size)';
    num.style.fontWeight = 'var(--text-display-weight)';
    num.style.lineHeight = 'var(--text-display-lh)';
    num.style.color = 'var(--color-primary)';
    num.textContent = String(model.blockedCount);
    heroCard.appendChild(num);

    const label = document.createElement('div');
    label.style.fontSize = 'var(--text-body-size)';
    label.style.fontWeight = '500';
    label.style.marginTop = 'var(--space-1)';
    label.textContent = 'Blocked on this page';
    heroCard.appendChild(label);

    const todaySub = document.createElement('div');
    todaySub.className = 'tabular-nums';
    todaySub.style.color = 'var(--color-text-muted)';
    todaySub.style.fontSize = 'var(--text-small-size)';
    todaySub.style.marginTop = 'var(--space-2)';
    todaySub.textContent = `Today: ${model.todayCount} total`;
    heroCard.appendChild(todaySub);
  }

  root.appendChild(heroCard);

  // 4. Current Site Row (only for supported web pages)
  if (model.state !== 'unsupported' && model.hostname) {
    const siteRow = document.createElement('div');
    siteRow.className = 'card';
    siteRow.style.display = 'flex';
    siteRow.style.alignItems = 'center';
    siteRow.style.justifyContent = 'space-between';
    siteRow.style.padding = 'var(--space-3) var(--space-4)';

    const siteInfo = document.createElement('div');
    siteInfo.style.overflow = 'hidden';

    const hostLabel = document.createElement('div');
    hostLabel.style.fontSize = 'var(--text-body-size)';
    hostLabel.style.fontWeight = '500';
    hostLabel.style.textOverflow = 'ellipsis';
    hostLabel.style.overflow = 'hidden';
    hostLabel.style.whiteSpace = 'nowrap';
    hostLabel.style.maxWidth = '200px';
    hostLabel.textContent = model.hostname;
    siteInfo.appendChild(hostLabel);

    const desc = document.createElement('div');
    desc.style.fontSize = 'var(--text-small-size)';
    desc.style.color = 'var(--color-text-muted)';
    desc.textContent = 'Pause on this site';
    siteInfo.appendChild(desc);

    siteRow.appendChild(siteInfo);

    const pauseSwitch = document.createElement('button');
    pauseSwitch.setAttribute('role', 'switch');
    pauseSwitch.setAttribute('aria-label', `Pause Su Ad Blocker Pro on ${model.hostname}`);
    pauseSwitch.setAttribute('aria-checked', String(model.isPausedOnSite));
    pauseSwitch.disabled = !model.enabled;
    pauseSwitch.className = 'switch';
    const pauseKnob = document.createElement('span');
    pauseKnob.className = 'switch-knob';
    pauseSwitch.appendChild(pauseKnob);

    pauseSwitch.addEventListener('click', () => {
      callbacks.onToggleSitePaused(!model.isPausedOnSite);
    });

    siteRow.appendChild(pauseSwitch);
    root.appendChild(siteRow);
  }

  // 5. Footer (Settings link + Report broken site)
  const footer = document.createElement('footer');
  footer.style.display = 'flex';
  footer.style.alignItems = 'center';
  footer.style.justifyContent = 'space-between';
  footer.style.paddingTop = 'var(--space-2)';
  footer.style.borderTop = '1px solid var(--color-border)';

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'btn btn-ghost btn-sm';
  const settingsIcon = createIconElement('settings');
  settingsBtn.appendChild(settingsIcon);
  const settingsText = document.createElement('span');
  settingsText.textContent = 'Settings';
  settingsBtn.appendChild(settingsText);
  settingsBtn.addEventListener('click', callbacks.onOpenSettings);
  footer.appendChild(settingsBtn);

  const reportBtn = document.createElement('button');
  reportBtn.className = 'btn btn-ghost btn-sm';
  const reportIcon = createIconElement('copy');
  reportBtn.appendChild(reportIcon);
  const reportText = document.createElement('span');
  reportText.textContent = 'Report broken site';
  reportBtn.appendChild(reportText);
  reportBtn.addEventListener('click', callbacks.onReportBrokenSite);
  footer.appendChild(reportBtn);

  root.appendChild(footer);

  container.appendChild(root);
}

/**
 * Shows an accessible toast notification
 */
export function showToast(message: string, isError = false): void {
  const existing = document.querySelector('.toast-container');
  if (existing) {
    existing.remove();
  }

  const container = document.createElement('div');
  container.className = 'toast-container';

  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'toast-error' : ''}`;
  toast.setAttribute('role', isError ? 'alert' : 'status');

  const icon = createIconElement(isError ? 'alertCircle' : 'check');
  toast.appendChild(icon);

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  container.appendChild(toast);
  document.body.appendChild(container);

  setTimeout(
    () => {
      container.remove();
    },
    isError ? 8000 : 4000
  );
}
