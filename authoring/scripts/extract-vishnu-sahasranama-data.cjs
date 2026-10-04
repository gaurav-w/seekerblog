/* Extract the static reader's source text into a safe alignment input. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'vishnu-sahasranama/index.html'), 'utf8');
const script = Array.from(source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi), match => match[1])
  .find(value => /const\s+PURVA\s*=/.test(value));
if (!script) throw new Error('Vishnu Sahasranama verse data was not found.');

function arrayEnd(text, start) {
  let depth = 0, quote = '', escaped = false;
  for (let index = start; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (/['"`]/.test(character)) { quote = character; continue; }
    if (character === '[') depth++;
    if (character === ']' && --depth === 0) return index;
  }
  throw new Error('Unterminated verse array.');
}

function entries(name) {
  const declaration = script.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[`));
  if (!declaration) throw new Error(`${name} was not found.`);
  const start = declaration.index + declaration[0].lastIndexOf('[');
  const sandbox = {};
  vm.runInNewContext(`globalThis.items=${script.slice(start, arrayEnd(script, start) + 1)};`, sandbox, { timeout: 1000 });
  return sandbox.items;
}

const sections = [
  ['purva', 'PURVA'], ['nyasa', 'NYASA'], ['dhyana', 'DHYANA'],
  ['stotram', 'STOTRA'], ['phala', 'PHALA'],
];
const verses = sections.flatMap(([key, name]) => entries(name).map((verse, index) => ({
  key: `${key}:${index + 1}`,
  section: key,
  index: index + 1,
  number: verse.n,
  devanagari: verse.d,
  iast: verse.i,
})));
const output = path.join(root, '.vishnu-work', 'verses.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(verses, null, 2)}\n`, 'utf8');
console.log(`Extracted ${verses.length} reader entries to ${output}.`);
