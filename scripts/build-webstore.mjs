import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'extension');
const OUT_DIR = path.join(ROOT_DIR, 'dist-webstore');
const UNPACKED_DIR = path.join(OUT_DIR, 'unpacked');

// Strict MV3 runtime allowlist: ZERO docs, ZERO workspace files, ZERO source maps, ZERO obfuscation.
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

function stripHtmlComments(html) {
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
    localHeader.writeUInt16LE(0x0800, 6);
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

function validateCwsPackage(manifest, stagedDir) {
  const errors = [];
  const warnings = [];

  if (manifest.manifest_version !== 3) {
    errors.push(`manifest_version must be 3 (got ${manifest.manifest_version})`);
  }
  if ('key' in manifest) {
    errors.push('manifest.json must not include "key" for Chrome Web Store submission');
  }
  if (!manifest.name || manifest.name.length > 75) {
    errors.push(`manifest.name must be 1..75 chars (got ${manifest.name?.length ?? 0})`);
  }
  if (!manifest.description || manifest.description.length > 132) {
    errors.push(`manifest.description must be 1..132 chars (got ${manifest.description?.length ?? 0})`);
  }
  if (!/^\d+(\.\d+){0,3}$/.test(String(manifest.version || ''))) {
    errors.push(`Invalid Chrome version format: ${manifest.version}`);
  }

  const requiredPaths = new Set();
  if (manifest.background?.service_worker) requiredPaths.add(manifest.background.service_worker);
  if (manifest.side_panel?.default_path) requiredPaths.add(manifest.side_panel.default_path);
  for (const cs of manifest.content_scripts || []) {
    for (const jsFile of cs.js || []) requiredPaths.add(jsFile);
    for (const cssFile of cs.css || []) requiredPaths.add(cssFile);
  }
  for (const iconPath of Object.values(manifest.icons || {})) requiredPaths.add(iconPath);
  for (const iconPath of Object.values(manifest.action?.default_icon || {})) requiredPaths.add(iconPath);

  for (const relPath of requiredPaths) {
    const full = path.join(stagedDir, relPath);
    if (!fs.existsSync(full)) {
      errors.push(`Missing manifest-referenced file: ${relPath}`);
    }
  }

  const sidebarPath = path.join(stagedDir, 'sidebar.html');
  if (fs.existsSync(sidebarPath)) {
    const html = fs.readFileSync(sidebarPath, 'utf8');
    const localRefs = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/gi)]
      .map((m) => m[1])
      .filter((ref) => !/^https?:\/\//i.test(ref) && !ref.startsWith('data:'));

    for (const ref of localRefs) {
      const cleanRef = ref.split('?')[0].split('#')[0];
      if (!fs.existsSync(path.join(stagedDir, cleanRef))) {
        errors.push(`sidebar.html references missing local asset: ${cleanRef}`);
      }
    }

    const remoteScripts = [...html.matchAll(/<script\b[^>]*src="https?:\/\/[^"]+"/gi)];
    if (remoteScripts.length > 0) {
      errors.push(`MV3 forbids remote scripts in sidebar.html (${remoteScripts.length} found)`);
    }
  }

  for (const fileName of fs.readdirSync(stagedDir)) {
    if (fileName.endsWith('.js')) {
      const fullPath = path.join(stagedDir, fileName);
      execFileSync(process.execPath, ['--check', fullPath], { stdio: 'pipe' });
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/\beval\s*\(|new Function\s*\(/.test(content)) {
        errors.push(`MV3 CSP violation in ${fileName}: dynamic code evaluation detected`);
      }
    }
  }

  if (manifest.host_permissions?.some((p) => p === 'http://*/*' || p === 'https://*/*' || p === '<all_urls>')) {
    warnings.push('Broad host_permissions (http://*/*, https://*/*) will require a clear Single Purpose + Host Permission justification in the Chrome Web Store Privacy Practices tab.');
  }

  if (errors.length > 0) {
    throw new Error(`Chrome Web Store validation failed:\n- ${errors.join('\n- ')}`);
  }

  return warnings;
}

function buildWebStorePackage() {
  const manifestPath = path.join(SRC_DIR, 'manifest.json');
  const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Remove "key" so Chrome Web Store assigns/binds its own store public key cleanly
  const { key: _omittedKey, ...cwsManifest } = rawManifest;
  const version = String(cwsManifest.version || '1.3.0').replace(/[^a-zA-Z0-9._-]/g, '');
  const zipFileName = `smart-poster-cws-v${version}.zip`;
  const zipOutputPath = path.join(OUT_DIR, zipFileName);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(UNPACKED_DIR, { recursive: true });

  const zipEntries = [];

  for (const fileName of RUNTIME_ALLOWLIST) {
    const srcPath = path.join(SRC_DIR, fileName);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Missing required allowlisted runtime file: ${srcPath}`);
    }

    const destPath = path.join(UNPACKED_DIR, fileName);
    let outputBuffer;

    if (fileName === 'manifest.json') {
      outputBuffer = Buffer.from(JSON.stringify(cwsManifest, null, 2) + '\n', 'utf8');
    } else if (fileName.endsWith('.html')) {
      const htmlRaw = fs.readFileSync(srcPath, 'utf8');
      outputBuffer = Buffer.from(stripHtmlComments(htmlRaw), 'utf8');
    } else {
      // Keep JS & CSS unobfuscated and human-auditable for Chrome Web Store review
      outputBuffer = fs.readFileSync(srcPath);
    }

    fs.writeFileSync(destPath, outputBuffer);
    zipEntries.push({ name: fileName, data: outputBuffer });
    console.log(`[build:webstore] staged ${fileName} (${(outputBuffer.length / 1024).toFixed(1)} KB)`);
  }

  const warnings = validateCwsPackage(cwsManifest, UNPACKED_DIR);
  const zipBuffer = buildZipBuffer(zipEntries);
  fs.writeFileSync(zipOutputPath, zipBuffer);

  console.log(`\n[build:webstore] Validation passed.`);
  for (const w of warnings) {
    console.log(`[build:webstore] Note: ${w}`);
  }
  console.log(`[build:webstore] Unpacked folder: ${path.relative(ROOT_DIR, UNPACKED_DIR)}`);
  console.log(`[build:webstore] Uploadable ZIP:  ${path.relative(ROOT_DIR, zipOutputPath)} (${(zipBuffer.length / 1024).toFixed(1)} KB, ${zipEntries.length} files)`);
}

buildWebStorePackage();
