// scripts/update-lists.mjs
// Downloads third-party filter lists to rulesets-src/ (04_TRD §4)
// This is the ONLY code in the project that makes network requests.

import fs from 'node:fs';
import path from 'node:path';

const LISTS = [
  {
    id: 'easylist',
    urls: ['https://easylist.to/easylist/easylist.txt'],
    dest: 'rulesets-src/easylist.txt',
  },
  {
    id: 'easyprivacy',
    urls: ['https://easylist.to/easylist/easyprivacy.txt'],
    dest: 'rulesets-src/easyprivacy.txt',
  },
  {
    id: 'ublock-filters',
    urls: [
      'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
    ],
    dest: 'rulesets-src/ublock-filters.txt',
  },
  {
    id: 'annoyances',
    urls: [
      'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt',
      'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances-cookies.txt',
      'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances-others.txt',
    ],
    dest: 'rulesets-src/annoyances.txt',
  },
];

const rulesetsSrcDir = path.resolve('rulesets-src');
fs.mkdirSync(rulesetsSrcDir, { recursive: true });

async function downloadList(list) {
  console.log(`[update-lists] Downloading ${list.id}...`);
  const parts = [];

  for (const url of list.urls) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HushBuild/0.1.0)',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download ${url}: HTTP ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    parts.push(text);
  }

  const combined = parts.join('\n');
  const filePath = path.resolve(list.dest);
  fs.writeFileSync(filePath, combined, 'utf-8');
  console.log(
    `[update-lists] Saved ${list.id} (${(combined.length / 1024).toFixed(1)} KB) -> ${list.dest}`
  );
}

async function run() {
  console.log('[update-lists] Starting filter lists download...');
  for (const list of LISTS) {
    try {
      await downloadList(list);
    } catch (err) {
      console.error(`[update-lists] Error fetching ${list.id}:`, err);
      process.exit(1);
    }
  }
  console.log('[update-lists] All filter lists downloaded successfully.');
}

run();
