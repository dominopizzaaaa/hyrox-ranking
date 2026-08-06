import fs from 'node:fs';
import zlib from 'node:zlib';

const required = ['race', 'compType', 'tier', 'gender', 'ageGroup', 'nationality', 'firstName', 'lastName', 'seconds'];
const files = ['data/athletes.json.gz', 'docs/athletes.json.gz'];
const contents = files.map((file) => ({ file, data: JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) }));
const metadataFiles = ['data/dataset-meta.json', 'docs/dataset-meta.json'];
const metadata = metadataFiles.map((file) => ({ file, data: JSON.parse(fs.readFileSync(file, 'utf8')) }));

const compTypes = new Set(['Individual', 'Doubles']);
const tiers = new Set(['Open', 'Pro']);

for (const { file, data } of contents) {
  if (!Array.isArray(data) || data.length === 0) throw new Error(`${file} must contain a non-empty JSON array.`);
  for (const [index, record] of data.entries()) {
    for (const field of required) {
      if (record[field] === undefined || record[field] === '') throw new Error(`${file}[${index}] is missing ${field}.`);
    }
    if (!Number.isInteger(record.seconds) || record.seconds < 1) throw new Error(`${file}[${index}].seconds must be a positive integer.`);
    if (!compTypes.has(record.compType)) throw new Error(`${file}[${index}].compType is invalid: ${record.compType}`);
    if (!tiers.has(record.tier)) throw new Error(`${file}[${index}].tier is invalid: ${record.tier}`);
  }
}

if (JSON.stringify(contents[0].data) !== JSON.stringify(contents[1].data)) {
  throw new Error('data/athletes.json.gz and docs/athletes.json.gz differ. Rebuild the cache so the deployed copy matches the source.');
}

if (JSON.stringify(metadata[0].data) !== JSON.stringify(metadata[1].data)) {
  throw new Error('data/dataset-meta.json and docs/dataset-meta.json differ. Rebuild so the deployed metadata matches the source.');
}

console.log(`Validated ${contents[0].data.length} cached result rows.`);
