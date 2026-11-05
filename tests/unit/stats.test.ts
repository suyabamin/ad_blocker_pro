// tests/unit/stats.test.ts
import { describe, it, expect } from 'vitest';
import {
  getTodayDateString,
  checkRateLimit,
} from '../../src/background/stats.js';

describe('Stats Engine', () => {
  it('formats today date string as YYYY-MM-DD', () => {
    const str = getTodayDateString();
    expect(str).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rate limits content script stats increments to 50/sec per tab', () => {
    const tabId = 999;
    // Fire 50 calls - should all pass
    for (let i = 0; i < 50; i++) {
      expect(checkRateLimit(tabId)).toBe(true);
    }
    // 51st call in same second should be throttled
    expect(checkRateLimit(tabId)).toBe(false);
  });
});
