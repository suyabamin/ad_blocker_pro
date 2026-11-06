// tests/unit/allowlist.test.ts
import { describe, it, expect } from 'vitest';
import {
  createAllowRule,
  findNextAvailableRuleId,
} from '../../src/background/allowlist.js';
import { RULE_ID_RANGES, PRIORITIES } from '../../src/shared/constants.js';

describe('Allowlist Dynamic Rules', () => {
  it('generates an allowAllRequests rule with priority 1000', () => {
    const rule = createAllowRule(42, 'example.com');
    expect(rule.id).toBe(42);
    expect(rule.priority).toBe(PRIORITIES.ALLOWLIST);
    expect(rule.action.type).toBe('allowAllRequests');
    expect(rule.condition.initiatorDomains).toEqual(['example.com']);
  });

  it('allocates IDs within range 1–9,999', () => {
    const used = new Set<number>([1, 2, 3]);
    const nextId = findNextAvailableRuleId(used);
    expect(nextId).toBe(4);
    expect(nextId).toBeGreaterThanOrEqual(RULE_ID_RANGES.ALLOWLIST_MIN);
    expect(nextId).toBeLessThanOrEqual(RULE_ID_RANGES.ALLOWLIST_MAX);

    // Verify it is strictly below the custom rule range
    expect(nextId).toBeLessThan(RULE_ID_RANGES.CUSTOM_MIN);
  });

  it('finds the first open hole in used IDs', () => {
    const used = new Set<number>([1, 3, 4]);
    const nextId = findNextAvailableRuleId(used);
    expect(nextId).toBe(2);
  });
});
