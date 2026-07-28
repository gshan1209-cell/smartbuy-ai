import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..');
const repositoryRoot = path.resolve(frontendRoot, '..');
const sourceRoot = path.join(repositoryRoot, '.cache', 'recommendations', 'v5');
const publicRoot = path.join(frontendRoot, 'public', 'recommendations-cache', 'v5');

const entries = [];
const categories = new Map();
const markets = new Set();

await mkdir(publicRoot, { recursive: true });
const filenames = (await readdir(sourceRoot))
  .filter((filename) => filename.endsWith('.json'))
  .sort((left, right) => left.localeCompare(right, 'zh-TW'));

if (filenames.length === 0) {
  throw new Error(`No recommendation cache files found in ${sourceRoot}`);
}

for (const filename of filenames) {
  const sourcePath = path.join(sourceRoot, filename);
  const payload = JSON.parse(await readFile(sourcePath, 'utf8'));
  const category = payload.category?.key;
  const market = payload.market;
  if (!category || !market) {
    throw new Error(`Recommendation cache entry is missing category or market: ${filename}`);
  }

  await cp(sourcePath, path.join(publicRoot, filename));
  categories.set(category, payload.category);
  markets.add(market);
  entries.push({
    category,
    market,
    region: payload.region || null,
    filename,
  });
}

const manifest = {
  schema_version: 5,
  source: 'git-static-cache',
  categories: [...categories.values()].sort((left, right) => left.key.localeCompare(right.key)),
  markets: [...markets].sort((left, right) => left.localeCompare(right, 'zh-TW')),
  entries,
};

await writeFile(
  path.join(publicRoot, 'index.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Synced ${entries.length} recommendation cache entries to ${publicRoot}`);
