// src/content/youtube/skip.ts
// Real user-interface skip automation, 16x unskippable neutralizer, and Layer 5 enforcement recovery
// (Su Ad Blocker Pro — Layers 3, 4, 5)

import { YOUTUBE_SELECTORS } from './selectors.js';

export interface PlayerStateBackup {
  saved: boolean;
  muted: boolean;
  playbackRate: number;
  volume: number;
  savedAt: number;
}

const stateBackup: PlayerStateBackup = {
  saved: false,
  muted: false,
  playbackRate: 1,
  volume: 1,
  savedAt: 0,
};

let lastClickTime = 0;
let lastClickedButton: HTMLElement | null = null;
let skipRetryCount = 0;
const MAX_SKIP_RETRIES = 3;

/**
 * Layer 3: Dispatches a full, realistic user-input interaction sequence.
 * Many YouTube components listen for pointer events rather than basic click.
 * Includes multi-pass verification and retry backoff.
 */
export function clickSkipButton(btn: HTMLElement): boolean {
  try {
    const now = Date.now();
    // Prevent spamming the same button faster than 250ms
    if (btn === lastClickedButton && now - lastClickTime < 250) {
      if (skipRetryCount >= MAX_SKIP_RETRIES) {
        return false;
      }
      skipRetryCount++;
    } else {
      skipRetryCount = 1;
    }

    lastClickTime = now;
    lastClickedButton = btn;

    const mouseOpts: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view:
        typeof window !== 'undefined' &&
        typeof Window !== 'undefined' &&
        window instanceof Window
          ? window
          : undefined,
    };

    // 1. Dispatch pointerdown and mousedown
    if (typeof PointerEvent !== 'undefined') {
      try {
        btn.dispatchEvent(new PointerEvent('pointerdown', mouseOpts));
      } catch {
        // Fallback for mock environments
      }
    }
    btn.dispatchEvent(new MouseEvent('mousedown', mouseOpts));

    // 2. Dispatch pointerup and mouseup
    if (typeof PointerEvent !== 'undefined') {
      try {
        btn.dispatchEvent(new PointerEvent('pointerup', mouseOpts));
      } catch {
        // Fallback
      }
    }
    btn.dispatchEvent(new MouseEvent('mouseup', mouseOpts));

    // 3. Dispatch click
    btn.click();

    // 4. Also attempt native player skip API if available (inside try/catch)
    try {
      const player = document.querySelector('#movie_player') as unknown as Record<string, unknown>;
      if (player && typeof player['skipAd'] === 'function') {
        (player['skipAd'] as () => void)();
      }
    } catch {
      // Ignored
    }

    return true;
  } catch (err) {
    console.debug('[Su AdBlock Pro] Error clicking skip button:', err);
    return false;
  }
}

/**
 * Layer 4: Neutralizes an unskippable video ad:
 * 1. Sanitizes and saves the original user state (ensuring rate is between 0.25 and 2.0).
 * 2. Immediately mutes the audio track.
 * 3. Accelerates playback to maximum supported speed (16x).
 * 4. Seeks safely near duration end to finish the ad in < 1 second.
 */
export function neutralizeUnskippableAd(video: HTMLVideoElement): void {
  try {
    if (!stateBackup.saved) {
      const currentRate = video.playbackRate;
      // Sanitize: never back up 16x as the user's preferred speed
      const safeRate =
        Number.isFinite(currentRate) && currentRate >= 0.25 && currentRate <= 2.0
          ? currentRate
          : 1.0;

      stateBackup.saved = true;
      stateBackup.muted = video.muted;
      stateBackup.playbackRate = safeRate;
      stateBackup.volume = Number.isFinite(video.volume) ? video.volume : 1.0;
      stateBackup.savedAt = Date.now();
    }

    // Silence ad audio
    video.muted = true;

    // Accelerate ad playback
    if (video.playbackRate < 16) {
      video.playbackRate = 16;
    }

    // Ensure ad video is playing so acceleration completes
    if (video.paused && !video.ended) {
      try {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch {
        // Ignored
      }
    }

    // Safe seek towards end if duration is valid and finite
    if (Number.isFinite(video.duration) && video.duration > 0.5) {
      const targetTime = Math.max(0, video.duration - 0.1);
      if (video.currentTime < targetTime) {
        video.currentTime = targetTime;
      }
    }
  } catch (err) {
    console.debug('[Su AdBlock Pro] Error neutralizing unskippable ad:', err);
  }
}

/**
 * Layer 4 Recovery: Restores original mute, volume, and playback speed when ad clears,
 * and guarantees the main video resumes playing (watchdog).
 */
export function restorePlaybackState(video?: HTMLVideoElement | null): void {
  if (!stateBackup.saved) return;

  const targetRate = stateBackup.playbackRate;
  const targetMuted = stateBackup.muted;
  const targetVolume = stateBackup.volume;

  try {
    if (video) {
      video.playbackRate = targetRate;
      video.muted = targetMuted;
      video.volume = targetVolume;

      // Watchdog: If video was left paused by ad termination, resume main video
      if (video.paused && !video.ended) {
        try {
          const p = video.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              // User pause or browser autoplay restriction
            });
          }
        } catch {
          // Ignored
        }
      }
    }
  } catch (err) {
    console.debug('[Su AdBlock Pro] Error restoring playback state:', err);
  } finally {
    stateBackup.saved = false;
    stateBackup.muted = false;
    stateBackup.playbackRate = 1;
    stateBackup.volume = 1;
    stateBackup.savedAt = 0;
    lastClickedButton = null;
    skipRetryCount = 0;
  }
}

/**
 * Layer 5: Detects and dismisses YouTube anti-adblock enforcement dialogs,
 * removing the blocking backdrop and resuming video playback.
 */
export function dismissEnforcementDialog(): boolean {
  try {
    for (const sel of YOUTUBE_SELECTORS.antiAdblock) {
      const dialog = document.querySelector(sel);
      if (dialog) {
        // Dismiss dialog button if present
        const btn = dialog.querySelector<HTMLElement>(
          'button, [aria-label*="close" i], [aria-label*="dismiss" i], yt-button-renderer'
        );
        if (btn) {
          btn.click();
        }
        dialog.remove();

        // Remove overlay backdrop if present
        const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
        if (backdrop) {
          backdrop.remove();
        }

        // Resume main video
        const video = document.querySelector<HTMLVideoElement>('video');
        if (video && video.paused) {
          try {
            const p = video.play();
            if (p && typeof p.catch === 'function') {
              p.catch(() => {});
            }
          } catch {
            // Ignored in environments without full media pipeline implementation
          }
        }
        return true;
      }
    }
  } catch {
    // Fail silently
  }
  return false;
}
