// tests/unit/manifest-lists.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_FILTER_LISTS } from '../../src/shared/constants.js';

describe('Manifest Rule Resources vs Filter Lists', () => {
  it('manifest rule_resources IDs match filter_lists IDs 1:1', () => {
    const manifestPath = path.resolve('manifests/base.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    const ruleResources = manifest.declarative_net_request?.rule_resources || [];
    const manifestIds = ruleResources.map((r: { id: string }) => r.id).sort();
    const defaultIds = DEFAULT_FILTER_LISTS.map((l) => l.id).sort();

    expect(manifestIds).toEqual(defaultIds);
  });

  it('all bundled ruleset JSON files exist in dist output', () => {
    for (const browser of ['chrome', 'firefox']) {
      for (const list of DEFAULT_FILTER_LISTS) {
        const rulesetFile = path.resolve(`dist/${browser}/rulesets/${list.id}.json`);
        const metaFile = path.resolve(`dist/${browser}/rulesets/${list.id}.meta.json`);

        expect(fs.existsSync(rulesetFile), `Missing ${rulesetFile}`).toBe(true);
        expect(fs.existsSync(metaFile), `Missing ${metaFile}`).toBe(true);

        const rules = JSON.parse(fs.readFileSync(rulesetFile, 'utf-8'));
        expect(Array.isArray(rules)).toBe(true);
      }
    }
  });
});
