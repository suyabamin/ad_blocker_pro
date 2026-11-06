// scripts/package.mjs
// Packages the Chrome and Firefox extension builds into zip archives

import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const distDir = path.resolve('dist');

function packageBrowser(browser) {
  const sourceDir = path.join(distDir, browser);
  if (!fs.existsSync(sourceDir)) {
    console.error(`[package] Directory ${sourceDir} does not exist. Run npm run build:${browser} first.`);
    return false;
  }

  const zipPath = path.join(distDir, `su-adblock-pro-${browser}.zip`);
  const zip = new AdmZip();
  zip.addLocalFolder(sourceDir);
  zip.writeZip(zipPath);

  const stats = fs.statSync(zipPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`[package] Created ${zipPath} (${sizeMb} MB)`);

  if (stats.size > 5 * 1024 * 1024) {
    console.warn(`[package] Warning: Package size (${sizeMb} MB) exceeds the 5 MB budget!`);
  }
  return true;
}

function run() {
  console.log('[package] Packaging Su Ad Blocker Pro extensions...');
  const chromeOk = packageBrowser('chrome');
  const firefoxOk = packageBrowser('firefox');

  if (chromeOk && firefoxOk) {
    console.log('[package] Packaging completed successfully.');
  } else {
    process.exit(1);
  }
}

run();
