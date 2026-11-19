import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'extension');
const STAGE_DIR = path.join(ROOT_DIR, 'dist-extension');
const DOWNLOADS_DIR = path.join(ROOT_DIR, 'public', 'downloads');

// Strict MV3 runtime allowlist: ZERO docs, ZERO workspace files, ZERO source maps, ZERO popup files.
const RUNTIME_ALLOWLIST = [
  'manifest.json',
  'icon.png',
  'icon16.png',
  'icon32.png',
  'icon48.png',
  'icon128.png',
  'theme.css',
  'sidebar.html',
  'auto-variation-engine.js',
  'sidebar.js',
  'background.js',
  'content.js',
  'supabase-client.js',
  'production-config.js',
  'debug-config.js',
];

const JS_HEAVY_TARGETS = new Set(['sidebar.js', 'background.js']);
const JS_LIGHT_TARGETS = new Set(['auto-variation-engine.js', 'content.js', 'supabase-client.js', 'production-config.js', 'debug-config.js']);

function getObfuscationOptions(isLight) {
  return {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayCallsTransform: false,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: false,
    stringArrayThreshold: isLight ? 0.5 : 0.75,
    target: 'browser',
    unicodeEscapeSequence: false,
  };
}

function stripHtmlComments(html) {
  // Remove standard HTML comments while keeping <script>/<style> contents intact.
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n');
}

// Deterministic CRC32 table for ZIP archive creation (zero OS zip binary dependency)
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosTimeDate(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

function buildZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = toDosTimeDate();

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawData = entry.data;
    const compressedData = zlib.deflateRawSync(rawData, { level: 9 });
    const useDeflate = compressedData.length < rawData.length;
    const payload = useDeflate ? compressedData : rawData;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(rawData);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuffer, eocd]);
}

function buildExtension() {
  const manifestPath = path.join(SRC_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const version = String(manifest.version || '1.3.0').replace(/[^a-zA-Z0-9._-]/g, '');
  const zipFileName = `smart-poster-extension-v${version}.zip`;
  const zipOutputPath = path.join(DOWNLOADS_DIR, zipFileName);

  // Clean & recreate staging folder
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

  const zipEntries = [];

  for (const fileName of RUNTIME_ALLOWLIST) {
    const srcPath = path.join(SRC_DIR, fileName);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Missing required allowlisted runtime file: ${srcPath}`);
    }
    const destPath = path.join(STAGE_DIR, fileName);

    let outputBuffer;

    if (fileName === 'manifest.json') {
      outputBuffer = Buffer.from(JSON.stringify(manifest), 'utf8');
    } else if (fileName.endsWith('.css')) {
      const cssRaw = fs.readFileSync(srcPath, 'utf8');
      const result = esbuild.transformSync(cssRaw, {
        loader: 'css',
        minify: true,
        legalComments: 'none',
      });
      outputBuffer = Buffer.from(result.code, 'utf8');
    } else if (fileName.endsWith('.html')) {
      const htmlRaw = fs.readFileSync(srcPath, 'utf8');
      outputBuffer = Buffer.from(stripHtmlComments(htmlRaw), 'utf8');
    } else if (JS_HEAVY_TARGETS.has(fileName) || JS_LIGHT_TARGETS.has(fileName)) {
      const jsRaw = fs.readFileSync(srcPath, 'utf8');
      const minified = esbuild.transformSync(jsRaw, {
        loader: 'js',
        minify: true,
        legalComments: 'none',
        drop: ['debugger'],
        pure: ['console.debug'],
      });
      const obfuscated = JavaScriptObfuscator.obfuscate(
        minified.code,
        getObfuscationOptions(JS_LIGHT_TARGETS.has(fileName))
      );
      outputBuffer = Buffer.from(obfuscated.getObfuscatedCode(), 'utf8');
    } else {
      outputBuffer = fs.readFileSync(srcPath);
    }

    fs.writeFileSync(destPath, outputBuffer);
    zipEntries.push({ name: fileName, data: outputBuffer });
    console.log(`[build:extension] staged ${fileName} (${(outputBuffer.length / 1024).toFixed(1)} KB)`);
  }

  const zipBuffer = buildZipBuffer(zipEntries);
  fs.writeFileSync(zipOutputPath, zipBuffer);
  console.log(`\n[build:extension] Created ${zipFileName} (${(zipBuffer.length / 1024).toFixed(1)} KB) with ${zipEntries.length} runtime files.`);
}

buildExtension();
