import fs from 'node:fs';

const required = ['race', 'division', 'gender', 'ageGroup', 'nationality', 'firstName', 'lastName', 'seconds'];
const files = ['data/athletes.json', 'docs/athletes.json'];
const contents = files.map((file) => ({ file, data: JSON.parse(fs.readFileSync(file, 'utf8')) }));

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
  throw new Error('data/athletes.json and docs/athletes.json differ. Run the importer so the deployed cache matches the source cache.');
}

console.log(`Validated ${contents[0].data.length} cached result rows.`);
