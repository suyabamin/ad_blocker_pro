// src/content/youtube/detect.ts
// Multi-signal YouTube ad detection and skip button resolution (Su Ad Blocker Pro)

import { YOUTUBE_SELECTORS } from './selectors.js';

export function getMoviePlayer(): HTMLElement | null {
  return document.querySelector(YOUTUBE_SELECTORS.player);
}

export function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>(YOUTUBE_SELECTORS.video);
}

export function isElementInteractable(el: HTMLElement): boolean {
  if (
    !el ||
    el.hasAttribute('disabled') ||
    el.getAttribute('aria-disabled') === 'true'
  ) {
    return false;
  }

  // Check style visibility
  if (el.style.display === 'none' || el.style.visibility === 'hidden') {
    return false;
  }

  // In browsers, elements with layout will have non-zero geometry
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return true;
  }

  // In headless/mock environments (like jsdom) geometry is 0x0; verify computed style
  if (typeof window !== 'undefined' && 'getComputedStyle' in window) {
    try {
      const computed = window.getComputedStyle(el);
      if (computed.display === 'none' || computed.visibility === 'hidden') {
        return false;
      }
    } catch {
      // ignore
    }
  }

  return true;
}

export function findSkipButton(player?: HTMLElement | null): HTMLElement | null {
  const p = player || getMoviePlayer();
  if (!p) {
    return null;
  }

  for (const selector of YOUTUBE_SELECTORS.skipButtons) {
    try {
      const el = p.querySelector<HTMLElement>(selector);
      if (el) {
        // Guard: Skip buttons are strictly in-player; never match masthead or search
        if (el.closest('ytd-masthead, #masthead, ytd-searchbox, #search')) {
          continue;
        }

        // If a container matched, search for the real inner interactive button first
        if (el.tagName.toLowerCase() !== 'button') {
          const innerBtn = el.querySelector<HTMLButtonElement>('button');
          if (innerBtn && isElementInteractable(innerBtn)) {
            return innerBtn;
          }
        }

        if (isElementInteractable(el)) {
          return el;
        }
      }
    } catch {
      // ignore selector evaluation error
    }
  }
  return null;
}

export function getActiveAdSignals(player?: HTMLElement | null): string[] {
  const signals: string[] = [];
  const p = player || getMoviePlayer();

  // Signal 1: Movie player ad state classes
  if (p) {
    for (const cls of YOUTUBE_SELECTORS.adPlayerClasses) {
      if (p.classList.contains(cls)) {
        signals.push(`player.${cls}`);
      }
    }

    // Signal 2: Active overlay DOM elements inside player
    for (const sel of YOUTUBE_SELECTORS.adOverlaySignals) {
      try {
        const el = p.querySelector<HTMLElement>(sel);
        if (el && isElementInteractable(el)) {
          signals.push(`overlay.${sel}`);
        }
      } catch {
        // ignore
      }
    }
  }

  // Signal 3: Skip button present & visible
  if (findSkipButton(p)) {
    signals.push('skipButton.present');
  }

  // Signal 4: Video element attributes indicating ad playback
  const video = getVideoElement();
  if (video) {
    if (
      video.classList.contains('ad-showing') ||
      video.classList.contains('ad-interrupting')
    ) {
      signals.push('video.adClass');
    }
  }

  return signals;
}

export function isAdActive(player?: HTMLElement | null): boolean {
  const p = player || getMoviePlayer();

  // 1. Direct player class check (fastest path)
  if (p) {
    for (const cls of YOUTUBE_SELECTORS.adPlayerClasses) {
      if (p.classList.contains(cls)) {
        return true;
      }
    }
  }

  // 2. Skip button availability
  if (findSkipButton(p)) {
    return true;
  }

  // 3. Visible ad overlay signals inside player
  if (p) {
    for (const sel of YOUTUBE_SELECTORS.adOverlaySignals) {
      try {
        const el = p.querySelector<HTMLElement>(sel);
        if (el && isElementInteractable(el)) {
          return true;
        }
      } catch {
        // ignore
      }
    }
  }

  return false;
}
