// tests/unit/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSettings,
  setSettings,
  getFilterLists,
  getAllowlist,
  setAllowlist,
  getCustomRules,
  setCustomRules,
  initializeStorage,
} from '../../src/shared/storage.js';
import { DEFAULT_FILTER_LISTS } from '../../src/shared/constants.js';

describe('Storage Layer (05_Schema §1, §5)', () => {
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromeObj = (globalThis as any).chrome;
    chromeObj.storage.local._store.clear();
  });

  it('initializes default storage idempotently', async () => {
    await initializeStorage();
    const lists = await getFilterLists();
    expect(lists).toEqual(DEFAULT_FILTER_LISTS);

    const allowlist = await getAllowlist();
    expect(allowlist).toEqual([]);

    // Second run produces identical state
    await initializeStorage();
    const listsAfter = await getFilterLists();
    expect(listsAfter).toEqual(DEFAULT_FILTER_LISTS);
  });

  it('reads default settings when storage is empty', async () => {
    const s = await getSettings();
    expect(s.enabled).toBe(true);
    expect(s.theme).toBe('system');
    expect(s.youtubeAutoSkip).toBe(true);
  });

  it('updates settings and persists to storage', async () => {
    await setSettings({ theme: 'dark', enabled: false });
    const updated = await getSettings();
    expect(updated.theme).toBe('dark');
    expect(updated.enabled).toBe(false);
  });

  it('persists and retrieves allowlist entries', async () => {
    await setAllowlist([
      { hostname: 'example.com', ruleId: 1, createdAt: 123456 },
    ]);
    const list = await getAllowlist();
    expect(list.length).toBe(1);
    expect(list[0]?.hostname).toBe('example.com');
  });

  it('persists and retrieves custom rules text', async () => {
    await setCustomRules('||blocked.com^');
    const rules = await getCustomRules();
    expect(rules).toBe('||blocked.com^');
  });
});
