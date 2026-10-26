// Build the self-contained replay page: node packages/sim-headless/replay/build.mjs fights.json arena-replay.html
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , input = 'fights.json', output = 'arena-replay.html'] = process.argv;
const here = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(here, 'viewer.template.html'), 'utf8');
const data = readFileSync(input, 'utf8').replaceAll('</', '<\\/');
writeFileSync(output, template.replace('__DATA__', () => data));
console.log(`Wrote ${output}`);
