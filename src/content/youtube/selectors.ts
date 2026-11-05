// src/content/youtube/selectors.ts
// Single source of truth for all YouTube selectors (Su Ad Blocker Pro)

export const YOUTUBE_SELECTORS = {
  // Movie player container indicating ad state
  player: '#movie_player, .html5-video-player',
  adPlayerClasses: [
    'ad-showing',
    'ad-interrupting',
    'ad-created',
  ],

  // In-player overlay signals
  adOverlaySignals: [
    '.ytp-ad-player-overlay',
    '.ytp-ad-player-overlay-layout',
    '.ytp-ad-player-overlay-flyout-cta',
    '.ytp-ad-duration-remaining',
    '.ytp-ad-simple-ad-badge',
    '.ytp-ad-text',
    '.ytp-ad-preview-text',
    '.ytp-ad-preview-container',
  ],

  // Video element inside player
  video: '#movie_player video, .html5-main-video, video',

  // Skip buttons variants (most specific to generic)
  skipButtons: [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    'button.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-container button',
    '.ytp-ad-skip-button-slot button',
    'button[class*="skip-button"]',
    '[id^="skip-button:"] button',
    '[id^="skip-button:"]',
    '.ytp-ad-skip-button-text',
    'button[aria-label*="Skip ad" i]',
    'button[aria-label*="Skip video" i]',
  ],

  // Banners, overlays, and feed ads (hidden cosmetically)
  bannerSlots: [
    'ytd-ad-slot-renderer',
    '#masthead-ad',
    'ytd-promoted-sparkles-web-renderer',
    '.ytp-ad-overlay-container',
    '.ytp-ad-overlay-slot',
    '.ytp-ad-message-container',
    '.ytp-ad-action-interstitial',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer',
    '.ytd-companion-slot-renderer',
    'ytd-action-companion-ad-renderer',
    '#player-ads',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    '.ytp-ad-survey-player-overlay',
  ],

  // Anti-adblock warning / dialogs (best-effort)
  antiAdblock: [
    'ytd-enforcement-message-view-model',
    'tp-yt-paper-dialog:has(#feedback.ytd-enforcement-message-view-model)',
    'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
    'ytd-popup-container:has(ytd-enforcement-message-view-model)',
  ],
} as const;

export interface SelectorTestResult {
  category: string;
  selector: string;
  matched: boolean;
  matchCount: number;
}

export interface YouTubeDiagnosticsReport {
  timestamp: number;
  adActive: boolean;
  playerFound: boolean;
  videoFound: boolean;
  skipButtonFound: boolean;
  observerAttached: boolean;
  observerTarget: string;
  activeSignals: string[];
  selectorResults: SelectorTestResult[];
  lastDetectionTime: number | null;
  lastSkipTime: number | null;
  totalAdsHandled: number;
  lastActionTaken: string | null;
  lastOutcome: string | null;
  lastError: string | null;
}

/**
 * Runs a thorough self-test of all selectors against the current DOM
 */
export function runSelectorSelfTest(): SelectorTestResult[] {
  const results: SelectorTestResult[] = [];

  const testSel = (category: string, sel: string) => {
    try {
      const els = document.querySelectorAll(sel);
      results.push({
        category,
        selector: sel,
        matched: els.length > 0,
        matchCount: els.length,
      });
    } catch {
      results.push({
        category,
        selector: sel,
        matched: false,
        matchCount: 0,
      });
    }
  };

  testSel('player', YOUTUBE_SELECTORS.player);
  testSel('video', YOUTUBE_SELECTORS.video);

  for (const cls of YOUTUBE_SELECTORS.adPlayerClasses) {
    testSel('playerAdClass', `.${cls}`);
  }

  for (const sel of YOUTUBE_SELECTORS.adOverlaySignals) {
    testSel('adOverlaySignal', sel);
  }

  for (const sel of YOUTUBE_SELECTORS.skipButtons) {
    testSel('skipButton', sel);
  }

  for (const sel of YOUTUBE_SELECTORS.bannerSlots) {
    testSel('bannerSlot', sel);
  }

  for (const sel of YOUTUBE_SELECTORS.antiAdblock) {
    testSel('antiAdblock', sel);
  }

  return results;
}
