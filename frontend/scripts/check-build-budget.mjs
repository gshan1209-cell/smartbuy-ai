import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, '../dist');
const manifestPath = path.join(distDirectory, '.vite/manifest.json');

const MAX_INITIAL_JS_BYTES = 500 * 1024;
const MAX_INITIAL_GZIP_BYTES = 180 * 1024;
const MAX_SINGLE_CHUNK_BYTES = 600 * 1024;
const MAX_SINGLE_CHUNK_GZIP_BYTES = 210 * 1024;

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function fileMetrics(relativePath) {
  const absolutePath = path.join(distDirectory, relativePath);
  const content = await readFile(absolutePath);
  return {
    file: relativePath,
    bytes: content.byteLength,
    gzipBytes: gzipSync(content).byteLength,
  };
}

async function listJavaScriptFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJavaScriptFiles(absolutePath, relativePath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(relativePath.replaceAll('\\', '/'));
    }
  }

  return files;
}

function collectInitialFiles(manifest, key, collected = new Set()) {
  if (!key || collected.has(key)) return collected;
  const record = manifest[key];
  if (!record) return collected;

  collected.add(key);
  for (const importedKey of record.imports || []) {
    collectInitialFiles(manifest, importedKey, collected);
  }
  return collected;
}

const manifestRaw = await readFile(manifestPath, 'utf8').catch(() => {
  throw new Error('找不到 Vite manifest；請先執行 npm run build。');
});
const manifest = JSON.parse(manifestRaw);
const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry);

if (!entryKey) {
  throw new Error('Vite manifest 沒有可辨識的應用程式 entry。');
}

const initialRecords = [...collectInitialFiles(manifest, entryKey)]
  .map((key) => manifest[key])
  .filter((record) => record?.file?.endsWith('.js'));
const initialMetrics = await Promise.all(initialRecords.map((record) => fileMetrics(record.file)));
const initialBytes = initialMetrics.reduce((total, item) => total + item.bytes, 0);
const initialGzipBytes = initialMetrics.reduce((total, item) => total + item.gzipBytes, 0);

const allJavaScriptFiles = await listJavaScriptFiles(distDirectory);
const allMetrics = await Promise.all(allJavaScriptFiles.map(fileMetrics));
const largestChunk = allMetrics.toSorted((a, b) => b.bytes - a.bytes)[0];

console.log('Frontend build budget report');
console.log(`- Initial JS: ${formatBytes(initialBytes)} raw / ${formatBytes(initialGzipBytes)} gzip`);
console.log(`- Initial chunks: ${initialMetrics.map((item) => item.file).join(', ')}`);
console.log(`- Largest chunk: ${largestChunk.file} (${formatBytes(largestChunk.bytes)} raw / ${formatBytes(largestChunk.gzipBytes)} gzip)`);

const violations = [];
if (initialBytes > MAX_INITIAL_JS_BYTES) {
  violations.push(`初始 JavaScript ${formatBytes(initialBytes)} 超過 ${formatBytes(MAX_INITIAL_JS_BYTES)}`);
}
if (initialGzipBytes > MAX_INITIAL_GZIP_BYTES) {
  violations.push(`初始 gzip JavaScript ${formatBytes(initialGzipBytes)} 超過 ${formatBytes(MAX_INITIAL_GZIP_BYTES)}`);
}
if (largestChunk.bytes > MAX_SINGLE_CHUNK_BYTES) {
  violations.push(`最大 chunk ${formatBytes(largestChunk.bytes)} 超過 ${formatBytes(MAX_SINGLE_CHUNK_BYTES)}`);
}
if (largestChunk.gzipBytes > MAX_SINGLE_CHUNK_GZIP_BYTES) {
  violations.push(`最大 gzip chunk ${formatBytes(largestChunk.gzipBytes)} 超過 ${formatBytes(MAX_SINGLE_CHUNK_GZIP_BYTES)}`);
}

if (violations.length > 0) {
  console.error('\nBuild budget exceeded:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
}
