// scripts/build-rulesets.mjs
// Converts ABP/uBlock lists to Declarative Net Request rulesets + meta JSON (Su Ad Blocker Pro)

import fs from 'node:fs';
import path from 'node:path';

const LIST_CONFIGS = [
  {
    id: 'easylist',
    name: 'EasyList',
    src: 'rulesets-src/easylist.txt',
    maxRules: 25000,
  },
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    src: 'rulesets-src/easyprivacy.txt',
    maxRules: 25000,
  },
  {
    id: 'ublock-filters',
    name: 'uBlock Filters',
    src: 'rulesets-src/ublock-filters.txt',
    maxRules: 25000,
  },
  {
    id: 'annoyances',
    name: 'uBlock Annoyances',
    src: 'rulesets-src/annoyances.txt',
    maxRules: 10000,
  },
];

const RESOURCE_TYPE_MAP = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  css: 'stylesheet',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  subdocument: 'sub_frame',
  main_frame: 'main_frame',
  media: 'media',
  font: 'font',
  websocket: 'websocket',
  ping: 'ping',
  other: 'other',
};

const genericCosmeticSelectors = new Set();

function parseLineToDnrRule(rawLine, nextId) {
  let line = rawLine.trim();
  if (!line || line.startsWith('!') || line.startsWith('[')) return null;

  // Handle cosmetic rule
  if (line.includes('##') || line.includes('#?#') || line.includes('#@#')) {
    if (line.startsWith('##')) {
      const selector = line.slice(2).trim();
      // Keep simple, fast class/id generic selectors without heavy procedural pseudo-classes
      if (
        selector &&
        !selector.includes(':has(') &&
        !selector.includes(':-abp-') &&
        !selector.includes(':xpath(') &&
        !selector.includes('[-ext-') &&
        selector.length < 120
      ) {
        genericCosmeticSelectors.add(selector);
      }
    }
    return null;
  }

  // Parse network rule
  let isAllow = false;
  let priority = 1;

  if (line.startsWith('@@')) {
    isAllow = true;
    priority = 10;
    line = line.slice(2);
  }

  // Split pattern and options
  let pattern = line;
  let options = [];
  const dollarIdx = line.indexOf('$');
  if (dollarIdx !== -1) {
    pattern = line.slice(0, dollarIdx);
    options = line.slice(dollarIdx + 1).split(',');
  }

  // Skip empty or purely wildcard patterns with no options
  if (!pattern && options.length === 0) return null;

  // Skip regex rules (/.../) for static conversion simplicity and safety
  if (pattern.startsWith('/') && pattern.endsWith('/')) {
    return null;
  }

  const condition = {};

  if (pattern) {
    condition.urlFilter = pattern;
  }

  // Parse options
  const resourceTypes = [];
  const initiatorDomains = [];
  const excludedInitiatorDomains = [];

  for (const rawOpt of options) {
    const opt = rawOpt.trim().toLowerCase();
    if (!opt) continue;

    if (opt === 'third-party' || opt === '3p') {
      condition.domainType = 'thirdParty';
    } else if (opt === '~third-party' || opt === '1p' || opt === 'first-party') {
      condition.domainType = 'firstParty';
    } else if (opt === 'match-case') {
      condition.isUrlFilterCaseSensitive = true;
    } else if (opt.startsWith('domain=')) {
      const domains = opt.slice(7).split('|');
      for (const d of domains) {
        if (d.startsWith('~')) {
          excludedInitiatorDomains.push(d.slice(1));
        } else {
          initiatorDomains.push(d);
        }
      }
    } else if (RESOURCE_TYPE_MAP[opt]) {
      resourceTypes.push(RESOURCE_TYPE_MAP[opt]);
    } else {
      // Unsupported modifier (e.g. redirect, csp, rewrite, empty, popunder, etc.)
      return null;
    }
  }

  if (resourceTypes.length > 0) {
    condition.resourceTypes = Array.from(new Set(resourceTypes));
  }
  if (initiatorDomains.length > 0) {
    condition.initiatorDomains = Array.from(new Set(initiatorDomains));
  }
  if (excludedInitiatorDomains.length > 0) {
    condition.excludedInitiatorDomains = Array.from(new Set(excludedInitiatorDomains));
  }

  return {
    id: nextId,
    priority,
    action: {
      type: isAllow ? 'allow' : 'block',
    },
    condition,
  };
}

function processList(cfg) {
  console.log(`[build-rulesets] Processing ${cfg.id}...`);
  if (!fs.existsSync(cfg.src)) {
    console.warn(`[build-rulesets] Warning: Source file ${cfg.src} not found. Skipping.`);
    return { ruleCount: 0, skippedCount: 0 };
  }

  const text = fs.readFileSync(cfg.src, 'utf-8');
  const lines = text.split('\n');

  const rules = [];
  const seenRuleSignatures = new Set();
  let skippedCount = 0;
  let ruleId = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) {
      continue;
    }

    const rule = parseLineToDnrRule(trimmed, ruleId);
    if (rule) {
      // Deduplicate rules by normalized signature
      const rTypes = (rule.condition.resourceTypes || []).slice().sort().join(',');
      const initDomains = (rule.condition.initiatorDomains || []).slice().sort().join(',');
      const sig = `${rule.action.type}|${rule.condition.urlFilter || ''}|${rule.condition.domainType || ''}|${rTypes}|${initDomains}`;

      if (seenRuleSignatures.has(sig)) {
        skippedCount++;
        continue;
      }

      seenRuleSignatures.add(sig);
      rules.push(rule);
      ruleId++;
      if (rules.length >= cfg.maxRules) {
        skippedCount += (lines.length - rules.length);
        break;
      }
    } else {
      skippedCount++;
    }
  }

  const meta = {
    id: cfg.id,
    name: cfg.name,
    source: cfg.src,
    fetchedAt: fs.statSync(cfg.src).mtimeMs,
    ruleCount: rules.length,
    skippedCount,
  };

  // Write to public/rulesets/ and dist/<browser>/rulesets/
  const outDirs = [
    path.resolve('public/rulesets'),
    path.resolve('dist/chrome/rulesets'),
    path.resolve('dist/firefox/rulesets'),
  ];

  for (const dir of outDirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${cfg.id}.json`),
      JSON.stringify(rules, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(dir, `${cfg.id}.meta.json`),
      JSON.stringify(meta, null, 2),
      'utf-8'
    );
  }

  console.log(
    `[build-rulesets] ${cfg.id}: Generated ${rules.length} deduplicated DNR rules (${skippedCount} skipped/duplicates/cosmetic).`
  );
  return meta;
}

function run() {
  console.log('[build-rulesets] Converting filter lists to DNR rulesets (Su Ad Blocker Pro)...');

  for (const cfg of LIST_CONFIGS) {
    processList(cfg);
  }

  // Save extracted generic cosmetic selectors
  const selectedCosmetic = Array.from(genericCosmeticSelectors).slice(0, 750);
  const cosmeticOutDir = path.resolve('src/content');
  fs.writeFileSync(
    path.join(cosmeticOutDir, 'cosmetic-selectors.json'),
    JSON.stringify(selectedCosmetic, null, 2),
    'utf-8'
  );
  console.log(
    `[build-rulesets] Saved ${selectedCosmetic.length} generic cosmetic selectors to src/content/cosmetic-selectors.json.`
  );

  console.log('[build-rulesets] All rulesets successfully built.');
}

run();
