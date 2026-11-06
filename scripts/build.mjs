import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const args = process.argv.slice(2);
const browserArg = args.find((a) => a.startsWith('--browser='));
const browser = browserArg ? browserArg.split('=')[1] : 'chrome';
const isWatch = args.includes('--watch');

if (!['chrome', 'firefox'].includes(browser)) {
  console.error(`Unknown browser: ${browser}. Expected "chrome" or "firefox".`);
  process.exit(1);
}

const outDir = path.resolve(`dist/${browser}`);
fs.mkdirSync(outDir, { recursive: true });

function mergeManifests(basePath, overlayPath) {
  const base = JSON.parse(fs.readFileSync(basePath, 'utf-8'));
  if (fs.existsSync(overlayPath)) {
    const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf-8'));
    for (const [key, value] of Object.entries(overlay)) {
      if (Array.isArray(value)) {
        base[key] = Array.from(new Set([...(base[key] || []), ...value]));
      } else if (typeof value === 'object' && value !== null) {
        base[key] = { ...(base[key] || {}), ...value };
      } else {
        base[key] = value;
      }
    }
  }
  return base;
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function build() {
  console.log(`[Su AdBlock Pro Build] Building for ${browser}...`);

  // 1. Generate merged manifest
  const manifest = mergeManifests(
    path.resolve('manifests/base.json'),
    path.resolve(`manifests/${browser}.json`)
  );
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  // 2. Copy public directory (including generated icons and rulesets)
  copyRecursive(path.resolve('public'), outDir);

  // 3. Copy CSS files to ui/
  const uiSrcDir = path.resolve('src/ui');
  const uiDestDir = path.join(outDir, 'ui');
  fs.mkdirSync(uiDestDir, { recursive: true });
  if (fs.existsSync(uiSrcDir)) {
    for (const file of fs.readdirSync(uiSrcDir)) {
      if (file.endsWith('.css')) {
        fs.copyFileSync(path.join(uiSrcDir, file), path.join(uiDestDir, file));
      }
    }
  }

  // 4. Bundle TS entry points
  // ESM entrypoints (background, popup, options)
  const esmEntrypoints = {
    background: 'src/background/index.ts',
    popup: 'src/popup/main.ts',
    options: 'src/options/main.ts',
  };

  // IIFE entrypoints (content scripts, theme-boot)
  const iifeEntrypoints = {
    'content/cosmetic': 'src/content/cosmetic.ts',
    'content/youtube': 'src/content/youtube/index.ts',
    'content/youtube-main': 'src/content/youtube/mainWorld.ts',
    'ui/theme-boot': 'src/ui/theme-boot.ts',
  };

  const commonOptions = {
    bundle: true,
    target: ['es2022'],
    sourcemap: process.env.NODE_ENV === 'production' ? false : 'inline',
    outdir: outDir,
    logLevel: 'info',
  };

  if (isWatch) {
    const ctxEsm = await esbuild.context({
      ...commonOptions,
      entryPoints: esmEntrypoints,
      format: 'esm',
    });
    const ctxIife = await esbuild.context({
      ...commonOptions,
      entryPoints: iifeEntrypoints,
      format: 'iife',
    });
    await ctxEsm.watch();
    await ctxIife.watch();
    console.log(`[Su AdBlock Pro Build] Watching for changes (${browser})...`);
  } else {
    await esbuild.build({
      ...commonOptions,
      entryPoints: esmEntrypoints,
      format: 'esm',
    });
    await esbuild.build({
      ...commonOptions,
      entryPoints: iifeEntrypoints,
      format: 'iife',
    });
    console.log(`[Su AdBlock Pro Build] Completed build for ${browser} -> ${outDir}`);
  }
}

build().catch((err) => {
  console.error('[Su AdBlock Pro Build] Error:', err);
  process.exit(1);
});
