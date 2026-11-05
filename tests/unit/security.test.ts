// tests/unit/security.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function getFilesRecursively(dir: string): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(getFilesRecursively(full));
    } else if (full.endsWith('.ts') || full.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

describe('Security & Privacy Audit (04_TRD §9)', () => {
  it('no forbidden APIs (eval, Function, fetch, XMLHttpRequest, innerHTML) in src/', () => {
    const srcFiles = getFilesRecursively(path.resolve('src'));
    expect(srcFiles.length).toBeGreaterThan(0);

    const violations: { file: string; pattern: string }[] = [];

    const forbiddenPatterns = [
      /\beval\s*\(/,
      /\bnew\s+Function\s*\(/,
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\.innerHTML\b/,
    ];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            pattern: pattern.toString(),
          });
        }
      }
    }

    expect(
      violations,
      `Found forbidden security violations in src/: ${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it('no .focus() or .blur() calls in content scripts (searchbar protection — docs/SEARCHBAR_BUG_REPORT.md)', () => {
    // Extension content scripts must NEVER call .focus() or .blur() on DOM elements.
    // Doing so would steal focus from the page (e.g. the YouTube search bar).
    // Any future addition of these calls requires an explicit "// allow-focus" comment on the same line.
    const contentDir = path.resolve('src/content');
    const contentFiles = getFilesRecursively(contentDir);
    expect(contentFiles.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; text: string }[] = [];
    // Pattern: .focus( or .blur( but NOT on a line with "// allow-focus"
    const focusPattern = /\.(focus|blur)\s*\(/;
    const allowComment = /\/\/\s*allow-focus/;

    for (const file of contentFiles) {
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((lineText, idx) => {
        if (focusPattern.test(lineText) && !allowComment.test(lineText)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: idx + 1,
            text: lineText.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found .focus()/.blur() calls in content scripts without "// allow-focus" comment:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it('permissions strictly match 04_TRD §2 least-privilege list', () => {
    const baseManifest = JSON.parse(
      fs.readFileSync(path.resolve('manifests/base.json'), 'utf-8')
    );
    const chromeManifest = JSON.parse(
      fs.readFileSync(path.resolve('manifests/chrome.json'), 'utf-8')
    );
    const firefoxManifest = JSON.parse(
      fs.readFileSync(path.resolve('manifests/firefox.json'), 'utf-8')
    );

    const allowedPermissions = new Set([
      'declarativeNetRequest',
      'storage',
      'alarms',
      'declarativeNetRequestFeedback',
    ]);

    const forbiddenPermissions = [
      'tabs',
      'webRequest',
      'webRequestBlocking',
      'cookies',
      'history',
      'scripting',
      'unlimitedStorage',
      'nativeMessaging',
    ];

    const allConfigured = [
      ...(baseManifest.permissions || []),
      ...(chromeManifest.permissions || []),
      ...(firefoxManifest.permissions || []),
    ];

    for (const p of allConfigured) {
      expect(allowedPermissions.has(p), `Unexpected permission "${p}"`).toBe(true);
      expect(forbiddenPermissions.includes(p)).toBe(false);
    }
  });
});
