// src/background/customRules.ts
// Strict parser and dynamic DNR rule generator for custom rules (05_Schema §2.4)

import { browser, type DnrRule } from '../shared/browser.js';
import { RULE_ID_RANGES, PRIORITIES } from '../shared/constants.js';
import { getCustomRules, setCustomRules } from '../shared/storage.js';
import type { CustomRuleLine, CustomRuleKind } from '../shared/types.js';

const VALID_OPTIONS: Record<string, string> = {
  'third-party': 'thirdParty',
  '3p': 'thirdParty',
  '~third-party': 'firstParty',
  '1p': 'firstParty',
  script: 'script',
  image: 'image',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  subdocument: 'sub_frame',
};

export function parseCustomRuleLine(
  rawLine: string,
  lineNo: number,
  nextRuleId: number
): { line: CustomRuleLine; generatedRule?: DnrRule } {
  const trimmed = rawLine.trim();

  // 1. Empty line or comment
  if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) {
    return {
      line: {
        lineNo,
        kind: 'comment',
        pattern: trimmed,
        error: null,
        ruleId: null,
      },
    };
  }

  // 2. Cosmetic rule: ##selector or domain##selector
  if (trimmed.includes('##')) {
    const parts = trimmed.split('##');
    if (parts.length === 2) {
      const selector = parts[1]?.trim() || '';
      if (!selector) {
        return {
          line: {
            lineNo,
            kind: 'invalid',
            pattern: trimmed,
            error: 'Empty CSS selector',
            ruleId: null,
          },
        };
      }
      return {
        line: {
          lineNo,
          kind: 'cosmetic_hide',
          pattern: trimmed,
          error: null,
          ruleId: null,
        },
      };
    }
  }

  // 3. Network rule: ||domain^ or @@||domain^
  let line = trimmed;
  let isAllow = false;
  if (line.startsWith('@@')) {
    isAllow = true;
    line = line.slice(2);
  }

  let pattern = line;
  const options: string[] = [];
  const dollarIdx = line.indexOf('$');
  if (dollarIdx !== -1) {
    pattern = line.slice(0, dollarIdx);
    const rawOptions = line.slice(dollarIdx + 1).split(',');
    for (const opt of rawOptions) {
      const clean = opt.trim().toLowerCase();
      if (clean) options.push(clean);
    }
  }

  if (!pattern.startsWith('||') || !pattern.includes('^')) {
    return {
      line: {
        lineNo,
        kind: 'invalid',
        pattern: trimmed,
        error: 'Network rules must follow standard ||domain^ syntax',
        ruleId: null,
      },
    };
  }

  // Validate options
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resourceTypes: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let domainType: any;

  for (const opt of options) {
    if (opt in VALID_OPTIONS) {
      const val = VALID_OPTIONS[opt];
      if (val === 'thirdParty' || val === 'firstParty') {
        domainType = val;
      } else if (val) {
        resourceTypes.push(val);
      }
    } else {
      return {
        line: {
          lineNo,
          kind: 'invalid',
          pattern: trimmed,
          error: `Unsupported option "$${opt}". Allowed: $third-party, $script, $image, $xmlhttprequest, $subdocument`,
          ruleId: null,
        },
      };
    }
  }

  const kind: CustomRuleKind = isAllow ? 'network_allow' : 'network_block';
  const priority = isAllow ? PRIORITIES.CUSTOM_ALLOW : PRIORITIES.CUSTOM_BLOCK;

  const rule: DnrRule = {
    id: nextRuleId,
    priority,
    action: {
      type: isAllow ? 'allow' : 'block',
    },
    condition: {
      urlFilter: pattern,
      ...(domainType ? { domainType } : {}),
      ...(resourceTypes.length > 0 ? { resourceTypes } : {}),
    },
  };

  return {
    line: {
      lineNo,
      kind,
      pattern: trimmed,
      error: null,
      ruleId: nextRuleId,
    },
    generatedRule: rule,
  };
}

export function parseAllCustomRules(rawText: string): {
  lines: CustomRuleLine[];
  rules: DnrRule[];
  cosmeticHides: { domain: string; selector: string }[];
  errors: { lineNo: number; error: string }[];
} {
  const lines = rawText.split('\n');
  const parsedLines: CustomRuleLine[] = [];
  const rules: DnrRule[] = [];
  const cosmeticHides: { domain: string; selector: string }[] = [];
  const errors: { lineNo: number; error: string }[] = [];

  let nextRuleId = RULE_ID_RANGES.CUSTOM_MIN;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const rawLine = lines[i] ?? '';
    const { line, generatedRule } = parseCustomRuleLine(
      rawLine,
      lineNo,
      nextRuleId
    );
    parsedLines.push(line);

    if (line.kind === 'invalid' && line.error) {
      errors.push({ lineNo, error: line.error });
    } else if (line.kind === 'cosmetic_hide') {
      const parts = line.pattern.split('##');
      const domain = parts[0]?.trim() || '';
      const selector = parts[1]?.trim() || '';
      cosmeticHides.push({ domain, selector });
    } else if (generatedRule) {
      rules.push(generatedRule);
      nextRuleId++;
      if (nextRuleId > RULE_ID_RANGES.CUSTOM_MAX) {
        errors.push({
          lineNo,
          error: `Exceeded custom rule limit (${RULE_ID_RANGES.CUSTOM_MAX - RULE_ID_RANGES.CUSTOM_MIN + 1})`,
        });
        break;
      }
    }
  }

  return { lines: parsedLines, rules, cosmeticHides, errors };
}

export async function saveCustomRules(rawText: string): Promise<{
  ok: boolean;
  errors?: { lineNo: number; error: string }[];
}> {
  const { rules, errors } = parseAllCustomRules(rawText);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Remove old dynamic rules in range 10,000 to 29,999
  if (browser.declarativeNetRequest?.getDynamicRules && browser.declarativeNetRequest?.updateDynamicRules) {
    const existingRules = await browser.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules
      .map((r) => r.id)
      .filter(
        (id) =>
          id >= RULE_ID_RANGES.CUSTOM_MIN && id <= RULE_ID_RANGES.CUSTOM_MAX
      );

    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: rules,
    });
  }

  await setCustomRules(rawText);
  return { ok: true };
}

export async function getCustomCosmeticRulesForHost(
  hostname: string
): Promise<string[]> {
  const rawText = await getCustomRules();
  const { cosmeticHides } = parseAllCustomRules(rawText);
  const cleanHost = hostname.toLowerCase();

  const selectors: string[] = [];
  for (const hide of cosmeticHides) {
    if (!hide.domain) {
      selectors.push(hide.selector);
    } else if (
      cleanHost === hide.domain ||
      cleanHost.endsWith(`.${hide.domain}`)
    ) {
      selectors.push(hide.selector);
    }
  }
  return selectors;
}
