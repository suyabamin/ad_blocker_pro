// tests/unit/customRules.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseCustomRuleLine,
  parseAllCustomRules,
} from '../../src/background/customRules.js';
import { RULE_ID_RANGES, PRIORITIES } from '../../src/shared/constants.js';

describe('Custom Rules Strict Parser', () => {
  it('parses network block and allow rules', () => {
    const r1 = parseCustomRuleLine('||ads.example.com^', 1, 10000);
    expect(r1.line.kind).toBe('network_block');
    expect(r1.line.ruleId).toBe(10000);
    expect(r1.generatedRule?.action.type).toBe('block');
    expect(r1.generatedRule?.priority).toBe(PRIORITIES.CUSTOM_BLOCK);
    expect(r1.generatedRule?.condition.urlFilter).toBe('||ads.example.com^');

    const r2 = parseCustomRuleLine('@@||cdn.example.com^', 2, 10001);
    expect(r2.line.kind).toBe('network_allow');
    expect(r2.generatedRule?.action.type).toBe('allow');
    expect(r2.generatedRule?.priority).toBe(PRIORITIES.CUSTOM_ALLOW);
  });

  it('parses valid options correctly', () => {
    const r1 = parseCustomRuleLine('||tracker.com^$third-party', 1, 10000);
    expect(r1.generatedRule?.condition.domainType).toBe('thirdParty');

    const r2 = parseCustomRuleLine('||script-server.com^$script,image', 2, 10001);
    expect(r2.generatedRule?.condition.resourceTypes).toContain('script');
    expect(r2.generatedRule?.condition.resourceTypes).toContain('image');

    const r3 = parseCustomRuleLine('||api.com^$xmlhttprequest', 3, 10002);
    expect(r3.generatedRule?.condition.resourceTypes).toContain('xmlhttprequest');

    const r4 = parseCustomRuleLine('||frame.com^$subdocument', 4, 10003);
    expect(r4.generatedRule?.condition.resourceTypes).toContain('sub_frame');
  });

  it('parses cosmetic hide rules and comments', () => {
    const c1 = parseCustomRuleLine('##.banner-ad', 1, 10000);
    expect(c1.line.kind).toBe('cosmetic_hide');
    expect(c1.generatedRule).toBeUndefined();

    const c2 = parseCustomRuleLine('example.com##.sidebar-sponsored', 2, 10000);
    expect(c2.line.kind).toBe('cosmetic_hide');

    const comment = parseCustomRuleLine('! This is a comment', 3, 10000);
    expect(comment.line.kind).toBe('comment');
  });

  it('strictly rejects invalid rules with line numbers and errors', () => {
    const invalidInputs = [
      'bad_syntax_no_prefix',
      '||missing_caret.com',
      '||domain.com^$unsupported_option',
      '||domain.com^$redirect=noop.js',
      '||domain.com^$csp=script-src',
      '||domain.com^$rewrite=abp-resource',
      '##', // empty selector
      'example.com##', // empty selector with domain
      '/regex_rule_not_supported/',
      '||domain.com^$badfilter',
      '@@||domain.com^$unknown_modifier',
      '||domain.com^$popup',
    ];

    for (let i = 0; i < invalidInputs.length; i++) {
      const lineText = invalidInputs[i]!;
      const res = parseCustomRuleLine(lineText, i + 1, 10000);
      expect(res.line.kind).toBe('invalid');
      expect(res.line.error).not.toBeNull();
      expect(res.generatedRule).toBeUndefined();
    }
  });

  it('enforces ID range 10,000–29,999 without overlapping allowlist', () => {
    const input = [
      '||rule1.com^',
      '||rule2.com^',
      '##.hide1',
      '||rule3.com^',
    ].join('\n');

    const { rules, cosmeticHides, errors } = parseAllCustomRules(input);
    expect(errors.length).toBe(0);
    expect(rules.length).toBe(3);
    expect(cosmeticHides.length).toBe(1);

    for (const rule of rules) {
      expect(rule.id).toBeGreaterThanOrEqual(RULE_ID_RANGES.CUSTOM_MIN);
      expect(rule.id).toBeLessThanOrEqual(RULE_ID_RANGES.CUSTOM_MAX);
      // Prove no overlap with allowlist
      expect(rule.id).toBeGreaterThan(RULE_ID_RANGES.ALLOWLIST_MAX);
    }
  });
});
