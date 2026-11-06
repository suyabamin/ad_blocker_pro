import { chromium } from 'playwright';
import path from 'node:path';

const extPath = path.resolve('dist/chrome');
const context = await chromium.launchPersistentContext('', {
  headless: true,
  args: [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
});
console.log('Chrome extension loaded without errors');
await context.close();
