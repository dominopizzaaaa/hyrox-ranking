import fs from 'node:fs';
import zlib from 'node:zlib';

const required = ['race', 'division', 'gender', 'ageGroup', 'nationality', 'firstName', 'lastName', 'seconds'];
const files = ['data/athletes.json.gz', 'docs/athletes.json.gz'];
const contents = files.map((file) => ({ file, data: JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) }));
const metadataFiles = ['data/dataset-meta.json', 'docs/dataset-meta.json'];
const metadata = metadataFiles.map((file) => ({ file, data: JSON.parse(fs.readFileSync(file, 'utf8')) }));

for (const { file, data } of contents) {
  if (!Array.isArray(data) || data.length === 0) throw new Error(`${file} must contain a non-empty JSON array.`);
  for (const [index, record] of data.entries()) {
    for (const field of required) {
      if (record[field] === undefined || record[field] === '') throw new Error(`${file}[${index}] is missing ${field}.`);
    }
    if (!Number.isInteger(record.seconds) || record.seconds < 1) throw new Error(`${file}[${index}].seconds must be a positive integer.`);
  }
}

if (JSON.stringify(contents[0].data) !== JSON.stringify(contents[1].data)) {
  throw new Error('data/athletes.json.gz and docs/athletes.json.gz differ. Run the importer so the deployed cache matches the source cache.');
}

if (JSON.stringify(metadata[0].data) !== JSON.stringify(metadata[1].data)) {
  throw new Error('data/dataset-meta.json and docs/dataset-meta.json differ. Run the importer so the deployed metadata matches the source metadata.');
}

if (metadata[0].data.source === 'pyrox-client') {
  const identities = new Set();
  for (const [index, record] of contents[0].data.entries()) {
    if (!record.sourceEventKey || !record.sourceResultId) {
      throw new Error(`data/athletes.json.gz[${index}] is missing pyrox source identity fields.`);
    }
    const identity = `${record.sourceEventKey}\u0000${record.sourceResultId}`;
    if (identities.has(identity)) throw new Error(`data/athletes.json.gz[${index}] duplicates a pyrox result identity.`);
    identities.add(identity);
  }
}

console.log(`Validated ${contents[0].data.length} cached result rows.`);
