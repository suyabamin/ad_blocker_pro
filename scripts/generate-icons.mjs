import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(width, height, r, g, b, a = 255) {
  // Simple uncompressed/raw RGBA PNG generator
  const signature = Buffer.from([137, 80, 78, 72, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // Scanlines: 1 filter byte (0) + width * 4 bytes per row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // filter None
    for (let x = 0; x < width; x++) {
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Brand blue: #2563EB = 37, 99, 235
// Grey: #8A93A5 = 138, 147, 165
const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), createPng(size, size, 37, 99, 235));
  fs.writeFileSync(path.join(iconsDir, `icon-${size}-disabled.png`), createPng(size, size, 138, 147, 165));
  fs.writeFileSync(path.join(iconsDir, `icon-${size}-degraded.png`), createPng(size, size, 220, 38, 38));
  fs.writeFileSync(path.join(iconsDir, `icon-${size}-paused.png`), createPng(size, size, 245, 158, 11));
}
console.log('Icons generated successfully.');
