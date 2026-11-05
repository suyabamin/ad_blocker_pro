// @vitest-environment jsdom
// tests/unit/youtube.test.ts
// Fixture-driven tests for YouTube 5-Layer Defense (Su Ad Blocker Pro)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pruneAdData } from '../../src/content/youtube/adKeys.js';
import { isAdActive, findSkipButton } from '../../src/content/youtube/detect.js';
import {
  clickSkipButton,
  neutralizeUnskippableAd,
  restorePlaybackState,
  dismissEnforcementDialog,
} from '../../src/content/youtube/skip.js';
import { YOUTUBE_SELECTORS } from '../../src/content/youtube/selectors.js';

describe('YouTube Multi-Layer Ad Neutralization (Fixture-Driven)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('Layer 1: prunes ad response fields while preserving playback essentials', () => {
    const fixturePath = path.resolve('tests/fixtures/youtube/player-response-with-ads.json');
    const rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    expect(rawData.playerAds).toBeDefined();
    expect(rawData.adPlacements).toBeDefined();
    expect(rawData.adSlots).toBeDefined();
    expect(rawData.streamingData).toBeDefined();
    expect(rawData.videoDetails).toBeDefined();

    const pruned = pruneAdData(rawData);

    // Ad containers MUST be stripped
    expect((pruned as Record<string, unknown>)['playerAds']).toBeUndefined();
    expect((pruned as Record<string, unknown>)['adPlacements']).toBeUndefined();
    expect((pruned as Record<string, unknown>)['adSlots']).toBeUndefined();

    // Critical playback fields MUST be preserved untouched
    expect(pruned.streamingData.formats.length).toBeGreaterThan(0);
    expect(pruned.videoDetails.videoId).toBe('dQw4w9WgXcQ');
    expect(pruned.playabilityStatus.status).toBe('OK');
  });

  it('Layer 3: detects and clicks real skip button from fixture DOM', () => {
    const fixtureHtml = fs.readFileSync(
      path.resolve('tests/fixtures/youtube/player-with-skip-button.html'),
      'utf-8'
    );
    document.body.innerHTML = fixtureHtml;

    const player = document.getElementById('movie_player');
    expect(player).not.toBeNull();
    expect(isAdActive(player)).toBe(true);

    const skipBtn = findSkipButton();
    expect(skipBtn).not.toBeNull();

    const clickSpy = vi.fn();
    skipBtn?.addEventListener('click', clickSpy);

    const clicked = clickSkipButton(skipBtn!);
    expect(clicked).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('Layer 4: accelerates unskippable ad and safely restores playback', () => {
    const fixtureHtml = fs.readFileSync(
      path.resolve('tests/fixtures/youtube/player-unskippable-ad.html'),
      'utf-8'
    );
    document.body.innerHTML = fixtureHtml;

    const player = document.getElementById('movie_player');
    expect(isAdActive(player)).toBe(true);

    const video = document.querySelector<HTMLVideoElement>('video')!;
    video.muted = false;
    video.playbackRate = 1;
    Object.defineProperty(video, 'duration', { value: 15, writable: true });

    // Neutralize
    neutralizeUnskippableAd(video);
    expect(video.muted).toBe(true);
    expect(video.playbackRate).toBe(16);
    expect(video.currentTime).toBeGreaterThanOrEqual(14.9);

    // Restore
    restorePlaybackState(video);
    expect(video.muted).toBe(false);
    expect(video.playbackRate).toBe(1);
  });

  it('Layer 4 Watchdog: sanitizes user rate so 16x is never preserved as user preference', () => {
    const video = document.createElement('video');
    video.playbackRate = 16; // Simulated ad pod running at 16x
    video.muted = true;
    Object.defineProperty(video, 'duration', { value: 30, writable: true });

    neutralizeUnskippableAd(video);
    // When restored, it should fallback to safe rate 1.0, NOT 16
    restorePlaybackState(video);
    expect(video.playbackRate).toBe(1);
  });

  it('Layer 5: detects and dismisses anti-adblock enforcement dialog', () => {
    const fixtureHtml = fs.readFileSync(
      path.resolve('tests/fixtures/youtube/anti-adblock-dialog.html'),
      'utf-8'
    );
    document.body.innerHTML = fixtureHtml;

    expect(document.querySelector('ytd-enforcement-message-view-model')).not.toBeNull();
    expect(document.querySelector('tp-yt-iron-overlay-backdrop')).not.toBeNull();

    const dismissed = dismissEnforcementDialog();
    expect(dismissed).toBe(true);
    expect(document.querySelector('ytd-enforcement-message-view-model')).toBeNull();
    expect(document.querySelector('tp-yt-iron-overlay-backdrop')).toBeNull();
  });
});

describe('Searchbar Protection (fix: docs/SEARCHBAR_BUG_REPORT.md)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('no extension selector matches ytd-searchbox, #search, input, or masthead elements', () => {
    const fixtureHtml = fs.readFileSync(
      path.resolve('tests/fixtures/youtube/masthead-with-searchbar.html'),
      'utf-8'
    );
    document.body.innerHTML = fixtureHtml;

    // All sensitive elements must exist in the fixture
    expect(document.querySelector('ytd-searchbox'), 'ytd-searchbox must be in fixture').not.toBeNull();
    expect(document.querySelector('#search'), '#search must be in fixture').not.toBeNull();
    expect(document.querySelector('input'), 'input must be in fixture').not.toBeNull();
    expect(document.querySelector('ytd-masthead'), 'ytd-masthead must be in fixture').not.toBeNull();
    expect(document.querySelector('#masthead'), '#masthead must be in fixture').not.toBeNull();

    // Every extension selector must NOT match any search-sensitive element
    const allExtensionSelectors = [
      ...YOUTUBE_SELECTORS.bannerSlots,
      ...YOUTUBE_SELECTORS.antiAdblock,
    ];

    for (const sel of allExtensionSelectors) {
      let matched: Element | null = null;
      try {
        matched = document.querySelector(sel);
      } catch {
        // ignore selector evaluation errors (e.g. :has() in older jsdom)
      }
      if (matched) {
        const isSensitive =
          matched.tagName.toLowerCase() === 'input' ||
          matched.tagName.toLowerCase() === 'textarea' ||
          matched.id === 'search' ||
          matched.tagName.toLowerCase() === 'ytd-searchbox' ||
          matched.tagName.toLowerCase() === 'ytd-masthead' ||
          matched.id === 'masthead' ||
          matched.id === 'masthead-container' ||
          !!matched.closest('ytd-searchbox, #search, ytd-masthead, #masthead');
        expect(
          isSensitive,
          `Extension selector "${sel}" matched a search-sensitive element: <${matched.tagName.toLowerCase()} id="${matched.id}">`
        ).toBe(false);
      }
    }
  });

  it('pruneAdData preserves search result structure while pruning ad keys', () => {
    // Simulate a /youtubei/v1/search response with typical search result structure
    const searchResponse = {
      responseContext: { serviceTrackingParams: [] },
      estimatedResults: '1234',
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [
                      { videoRenderer: { videoId: 'abc123', title: { runs: [{ text: 'Test Video' }] } } },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
      // Ad keys that may appear in search results (promoted shelves)
      adPlacements: [{ adPlacementRenderer: {} }],
    };

    const pruned = pruneAdData(searchResponse) as typeof searchResponse;

    // Critical search result structure must be preserved
    expect(pruned.estimatedResults).toBe('1234');
    expect(pruned.contents).toBeDefined();
    const videoId = pruned.contents
      .twoColumnSearchResultsRenderer
      .primaryContents
      .sectionListRenderer
      .contents[0]!
      .itemSectionRenderer
      .contents[0]!
      .videoRenderer.videoId;
    expect(videoId).toBe('abc123');

    // Ad keys pruned (acceptable — they are ads)
    expect((pruned as Record<string, unknown>)['adPlacements']).toBeUndefined();
  });

  it('dismissEnforcementDialog returns false and leaves search elements untouched', () => {
    const fixtureHtml = fs.readFileSync(
      path.resolve('tests/fixtures/youtube/masthead-with-searchbar.html'),
      'utf-8'
    );
    document.body.innerHTML = fixtureHtml;

    // No enforcement dialog in this fixture
    expect(document.querySelector('ytd-enforcement-message-view-model')).toBeNull();

    // Must return false without removing any search elements
    const result = dismissEnforcementDialog();
    expect(result).toBe(false);

    // All search-sensitive elements must still be present
    expect(document.querySelector('ytd-searchbox')).not.toBeNull();
    expect(document.querySelector('#search')).not.toBeNull();
    expect(document.querySelector('input')).not.toBeNull();
  });
});
