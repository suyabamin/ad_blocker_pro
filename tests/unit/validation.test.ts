// tests/unit/validation.test.ts
import { describe, it, expect } from 'vitest';
import {
  isValidHostname,
  normalizeHostname,
  validateImportJson,
} from '../../src/shared/validation.js';
import { DEFAULT_SETTINGS } from '../../src/shared/constants.js';

describe('Hostname Validation', () => {
  it('accepts valid hostnames', () => {
    expect(isValidHostname('example.com')).toBe(true);
    expect(isValidHostname('sub.domain.co.uk')).toBe(true);
    expect(isValidHostname('ad-server.net')).toBe(true);
    expect(isValidHostname('localhost')).toBe(true);
    expect(isValidHostname('127.0.0.1')).toBe(true);
  });

  it('rejects invalid hostnames (10+ test cases)', () => {
    // 1. empty
    expect(isValidHostname('')).toBe(false);
    // 2. starts with dot
    expect(isValidHostname('.example.com')).toBe(false);
    // 3. ends with dot
    expect(isValidHostname('example.com.')).toBe(false);
    // 4. starts with hyphen
    expect(isValidHostname('-example.com')).toBe(false);
    // 5. ends with hyphen
    expect(isValidHostname('example.com-')).toBe(false);
    // 6. double dots
    expect(isValidHostname('example..com')).toBe(false);
    // 7. contains protocol
    expect(isValidHostname('https://example.com')).toBe(false);
    // 8. contains path
    expect(isValidHostname('example.com/path')).toBe(false);
    // 9. contains port
    expect(isValidHostname('example.com:8080')).toBe(false);
    // 10. contains spaces
    expect(isValidHostname('example .com')).toBe(false);
    // 11. contains invalid special characters
    expect(isValidHostname('example?.com')).toBe(false);
    // 12. too long (>253 chars)
    expect(isValidHostname('a'.repeat(254) + '.com')).toBe(false);
  });

  it('normalizes URLs and raw inputs correctly', () => {
    expect(normalizeHostname('https://www.example.com/test?q=1')).toBe('www.example.com');
    expect(normalizeHostname('http://sub.domain.org:3000/')).toBe('sub.domain.org');
    expect(normalizeHostname('  EXAMPLE.COM  ')).toBe('example.com');
    expect(normalizeHostname('invalid://???')).toBe(null);
  });
});

describe('Import Schema Validation', () => {
  it('accepts a valid export file for su-adblock-pro and legacy hush', () => {
    const validProJson = JSON.stringify({
      app: 'su-adblock-pro',
      schemaVersion: 1,
      exportedAt: Date.now(),
      settings: DEFAULT_SETTINGS,
      filterLists: [{ id: 'easylist', enabled: true }],
      allowlist: [{ hostname: 'example.com' }],
      customRules: '||tracker.com^',
    });
    expect(validateImportJson(validProJson).valid).toBe(true);

    const validLegacyJson = JSON.stringify({
      app: 'hush',
      schemaVersion: 1,
      exportedAt: Date.now(),
      settings: DEFAULT_SETTINGS,
      filterLists: [{ id: 'easylist', enabled: true }],
      allowlist: [{ hostname: 'example.com' }],
      customRules: '||tracker.com^',
    });
    expect(validateImportJson(validLegacyJson).valid).toBe(true);
  });

  it('rejects invalid import files with descriptive errors', () => {
    // Not JSON
    expect(validateImportJson('{ bad json').valid).toBe(false);

    // Wrong app
    const wrongApp = JSON.stringify({
      app: 'other-blocker',
      schemaVersion: 1,
      settings: DEFAULT_SETTINGS,
      filterLists: [],
      allowlist: [],
      customRules: '',
    });
    const resWrongApp = validateImportJson(wrongApp);
    expect(resWrongApp.valid).toBe(false);
    if (!resWrongApp.valid) {
      expect(resWrongApp.errors[0]).toContain('Invalid app signature');
    }

    // Invalid allowlist hostname
    const badHost = JSON.stringify({
      app: 'hush',
      schemaVersion: 1,
      settings: DEFAULT_SETTINGS,
      filterLists: [],
      allowlist: [{ hostname: 'http://bad..domain' }],
      customRules: '',
    });
    const resBadHost = validateImportJson(badHost);
    expect(resBadHost.valid).toBe(false);
  });
});
