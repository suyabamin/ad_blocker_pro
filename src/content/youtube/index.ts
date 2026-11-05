// src/content/youtube/index.ts
// High-performance YouTube ad neutralization controller (Su Ad Blocker Pro)

import { browser } from '../../shared/browser.js';
import { sendMessage } from '../../shared/messages.js';
import type { GlobalState, PagePolicy } from '../../shared/types.js';
import {
  YOUTUBE_SELECTORS,
  runSelectorSelfTest,
  type YouTubeDiagnosticsReport,
} from './selectors.js';
import {
  getMoviePlayer,
  getVideoElement,
  isAdActive,
  findSkipButton,
  getActiveAdSignals,
} from './detect.js';
import {
  clickSkipButton,
  neutralizeUnskippableAd,
  restorePlaybackState,
  dismissEnforcementDialog,
} from './skip.js';

let currentObserver: MutationObserver | null = null;
let isObserverActive = false;
let rafId: number | null = null;
let heartbeatInterval: number | null = null;

let lastAdState = false;
let adStatReported = false;
let lastDetectionTime: number | null = null;
let lastSkipTime: number | null = null;
let totalAdsHandled = 0;
let lastActionTaken: string | null = null;
let lastOutcome: string | null = null;
let lastError: string | null = null;

let autoSkipEnabled = true;
let speedUnskippableEnabled = true;
let hideBannersEnabled = true;
let debugMode = false;

function logDebug(stage: string, outcome: string, reason?: string) {
  if (!debugMode) return;
  sendMessage({
    type: 'RECORD_DEBUG_EVENT',
    event: {
      frameUrl: window.location.href,
      component: 'youtube',
      stage,
      outcome,
      reason,
    },
  }).catch(() => {});
}

/**
 * Returns true if the user currently has a text cursor in any typeable element
 * (input, textarea, select, contenteditable, or anything inside the YouTube
 * masthead / search box). Used to suppress all extension DOM actions while
 * the user is typing to prevent focus loss.
 * See docs/SEARCHBAR_BUG_REPORT.md — RC-SEARCH-3.
 */
function isUserTyping(): boolean {
  try {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if ((el as HTMLElement).isContentEditable) return true;
    // Also guard against elements inside YouTube's search area / masthead
    if (el.closest('ytd-searchbox, #search, #masthead, ytd-masthead')) return true;
    return false;
  } catch {
    return false;
  }
}

function injectBannerHidingStyle() {
  if (!hideBannersEnabled) return;
  const existing = document.querySelector('style[data-su-yt-banners]');
  if (existing) return;

  const selectors = [
    ...YOUTUBE_SELECTORS.bannerSlots,
    ...YOUTUBE_SELECTORS.antiAdblock,
  ];

  const css = `
    /* Su Ad Blocker Pro: Clean YouTube cosmetic hiding */
    ${selectors.join(',\n')} {
      display: none !important;
    }

    /* Guard: Never hide video controls, subtitles, or main player */
    .html5-video-player .ytp-chrome-bottom,
    .html5-video-player .ytp-chrome-controls,
    .html5-video-player .ytp-caption-window-container,
    .html5-video-player video {
      display: block !important;
      visibility: visible !important;
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-su-yt-banners', 'true');
  styleEl.textContent = css;

  (document.head || document.documentElement)?.appendChild(styleEl);
}

function processAdPipeline() {
  // Guard: never click, remove, or reflow anything while the user is typing.
  // This prevents focus loss in the YouTube search bar.
  // See docs/SEARCHBAR_BUG_REPORT.md — RC-SEARCH-3.
  if (isUserTyping()) return;

  dismissEnforcementDialog();

  const player = getMoviePlayer();
  const video = getVideoElement();
  const adActive = isAdActive(player);

  if (adActive) {
    lastDetectionTime = Date.now();
    const signals = getActiveAdSignals(player);
    logDebug('ad_detection', 'ad_active', signals.join('; '));

    if (!adStatReported) {
      adStatReported = true;
      totalAdsHandled++;
      sendMessage({
        type: 'INCR_STATS',
        category: 'youtube',
        amount: 1,
      }).catch(() => {});
    }

    // 1. Prioritize real skip button interaction
    if (autoSkipEnabled) {
      const skipBtn = findSkipButton(player); // scoped to player — prevents masthead/searchbar matches
      if (skipBtn) {
        lastActionTaken = 'click_skip_button';
        const clicked = clickSkipButton(skipBtn);
        if (clicked) {
          lastSkipTime = Date.now();
          lastOutcome = 'skip_clicked_success';
          logDebug('skip_action', 'click_success');
        } else {
          lastOutcome = 'skip_click_throttled_or_failed';
          logDebug('skip_action', 'click_failed');
        }
        lastAdState = true;
        return;
      }
    }

    // 2. Fallback to unskippable ad neutralizer (16x speed + mute + fast-forward)
    if (speedUnskippableEnabled && video) {
      lastActionTaken = 'neutralize_unskippable';
      try {
        neutralizeUnskippableAd(video);
        lastOutcome = 'accelerated_16x_muted';
        logDebug('unskippable_action', 'neutralized');
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        lastOutcome = 'neutralization_error';
        logDebug('unskippable_action', 'error', lastError);
      }
    }

    lastAdState = true;
  } else {
    // Ad has ended or was skipped
    if (lastAdState) {
      lastActionTaken = 'restore_playback';
      try {
        restorePlaybackState(video);
        lastOutcome = 'playback_restored';
        logDebug('playback_restore', 'restored');
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      lastAdState = false;
      adStatReported = false;
    }
  }
}

function scheduleCheck() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    processAdPipeline();
  });
}

function attachPlayerObserver() {
  const player = getMoviePlayer();
  if (!player) {
    // Retry when player mounts in DOM
    const docObserver = new MutationObserver((_mutations, obs) => {
      if (getMoviePlayer()) {
        obs.disconnect();
        attachPlayerObserver();
      }
    });

    docObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
    return;
  }

  // Disconnect any existing observer to prevent leaks or duplicate handlers
  if (currentObserver) {
    try {
      currentObserver.disconnect();
    } catch {
      // ignore
    }
    currentObserver = null;
  }

  const observer = new MutationObserver(() => {
    scheduleCheck();
  });

  observer.observe(player, {
    attributes: true,
    attributeFilter: ['class', 'src'],
    childList: true,
    subtree: true,
  });

  currentObserver = observer;
  isObserverActive = true;
  logDebug('observer', 'attached', player.id || player.className);
  scheduleCheck();

  // Setup periodic lightweight heartbeat (300ms) to safeguard against missed DOM mutations
  if (heartbeatInterval === null) {
    heartbeatInterval = window.setInterval(() => {
      const p = getMoviePlayer();
      if (p && isAdActive(p)) {
        scheduleCheck();
      }
    }, 300);
  }
}

function getDiagnosticsReport(): YouTubeDiagnosticsReport {
  const player = getMoviePlayer();
  const video = getVideoElement();
  const skipBtn = findSkipButton();
  const signals = getActiveAdSignals(player);
  const selectorResults = runSelectorSelfTest();

  return {
    timestamp: Date.now(),
    adActive: isAdActive(player),
    playerFound: !!player,
    videoFound: !!video,
    skipButtonFound: !!skipBtn,
    observerAttached: isObserverActive,
    observerTarget: player ? (player.id ? `#${player.id}` : player.tagName) : 'none',
    activeSignals: signals,
    selectorResults,
    lastDetectionTime,
    lastSkipTime,
    totalAdsHandled,
    lastActionTaken,
    lastOutcome,
    lastError,
  };
}

async function initYouTubeController() {
  const hostname = window.location.hostname;
  if (!hostname.includes('youtube.com') && !hostname.includes('youtube-nocookie.com')) {
    return;
  }

  try {
    const policy = await sendMessage<PagePolicy>({
      type: 'GET_PAGE_POLICY',
      hostname,
    });

    if (!policy.ok || !policy.data.enabled || policy.data.paused) {
      return;
    }

    // Read user preferences
    const state = await sendMessage<GlobalState>({ type: 'GET_STATE' });
    if (state.ok && state.data.settings) {
      if (!state.data.settings.youtubePrunePlayerData) {
        document.documentElement?.setAttribute('data-su-pruning', 'disabled');
      } else {
        document.documentElement?.removeAttribute('data-su-pruning');
      }
      autoSkipEnabled = state.data.settings.youtubeAutoSkip;
      speedUnskippableEnabled = state.data.settings.youtubeSpeedUnskippable;
      hideBannersEnabled = state.data.settings.youtubeHideBanners;
      debugMode = state.data.settings.debug;
    }

    injectBannerHidingStyle();
    attachPlayerObserver();

    // Re-arm cleanly on YouTube SPA navigation
    const rearmEvents = ['yt-navigate-finish', 'yt-page-data-updated', 'popstate'];
    for (const evt of rearmEvents) {
      window.addEventListener(evt, () => {
        adStatReported = false;
        lastAdState = false;
        if (currentObserver) {
          try {
            currentObserver.disconnect();
          } catch {
            // ignore
          }
          currentObserver = null;
        }
        isObserverActive = false;
        logDebug('spa_navigation', 'rearm_triggered', evt);
        attachPlayerObserver();
        scheduleCheck();
      });
    }

    // Handle heartbeat and selector self-test requests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browser.runtime?.onMessage?.addListener((msg: any) => {
      if (msg?.type === 'PING_CONTENT_SCRIPT' && (!msg.script || msg.script === 'youtube')) {
        return Promise.resolve({ ok: true, script: 'youtube', runAt: 'document_start', allFrames: true });
      }
      if (msg?.type === 'RUN_YOUTUBE_SELFTEST') {
        const report = getDiagnosticsReport();
        return Promise.resolve({ ok: true, data: report });
      }
      return undefined;
    });
  } catch (err) {
    console.debug('[Su AdBlock Pro] YouTube controller initialization error:', err);
  }
}

// Start controller immediately at document_start without artificial DOM delay
initYouTubeController();
