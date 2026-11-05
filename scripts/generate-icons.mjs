// scripts/generate-icons.mjs
// Generates professional shield + blocking symbol PNG icons for Su Ad Blocker Pro

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createShieldPng(width, height, state = 'active') {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Base colors
  // Active: Vibrant Professional Orange #EA580C (234, 88, 12)
  // Disabled: Neutral Slate Grey #94A3B8 (148, 163, 184)
  // Paused: Amber Warning #F59E0B (245, 158, 11)
  // Degraded: Crimson Red #EF4444 (239, 68, 68)
  let mainColor = [234, 88, 12];
  if (state === 'disabled') mainColor = [148, 163, 184];
  if (state === 'paused') mainColor = [245, 158, 11];
  if (state === 'degraded') mainColor = [239, 68, 68];

  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const cx = width / 2;
  const cy = height * 0.45;
  const rShield = width * 0.44;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    const ny = y / height;

    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - cx);

      // Shield boundary math
      let inShield = false;
      if (y >= height * 0.08 && y <= height * 0.92) {
        if (ny <= 0.5) {
          // Top curved rectangle
          inShield = dx <= rShield;
        } else {
          // Bottom taper to point
          const taperProgress = (ny - 0.5) / 0.42;
          const allowedDx = rShield * (1 - Math.pow(taperProgress, 1.4));
          inShield = dx <= allowedDx;
        }
      }

      if (inShield) {
        // Draw inner blocking slash / cross symbol
        const distFromCenter = Math.hypot(x - cx, y - cy);
        const onSlash = Math.abs((x - cx) - (y - cy)) <= Math.max(1, width * 0.07);
        const inCircle = distFromCenter <= rShield * 0.65;
        const onRing = Math.abs(distFromCenter - rShield * 0.5) <= Math.max(1, width * 0.08);

        if ((onRing || onSlash) && inCircle) {
          // Blocking symbol inside shield: crisp contrast
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 240;
        } else {
          // Shield body
          rawData[offset++] = mainColor[0];
          rawData[offset++] = mainColor[1];
          rawData[offset++] = mainColor[2];
          rawData[offset++] = 255;
        }
      } else {
        // Transparent outside
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
      }
    }
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const compressed = zlib.deflateSync(rawData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n >>> 0;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), createShieldPng(size, size, 'active'));
  fs.writeFileSync(path.join(iconsDir, `icon-${size}-disabled.png`), createShieldPng(size, size, 'disabled'));
  fs.writeFileSync(path.join(iconsDir, `icon-${size}-degraded.png`), createShieldPng(size, size, 'degraded'));
  fs.writeFileSync(path.join(iconsDir, `icon-${size}-paused.png`), createShieldPng(size, size, 'paused'));
}

console.log('[generate-icons] Su Ad Blocker Pro icons generated successfully.');
