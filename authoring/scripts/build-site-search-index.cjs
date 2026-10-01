/* Builds the public, static search corpus used by the library home page. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const records = [];

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value) {
  return compact(value
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/p>|<\/h[1-6]>|<\/li>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'"));
}

function pageTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return compact(match ? decodeHtml(match[1]).split('·')[0] : 'Seekerblog');
}

function addRecord(record) {
  const source = compact(record.source);
  const hindi = compact(record.hindi);
  const english = compact(record.english);
  if (!source && !hindi && !english) {
    throw new Error(`Search record has no text: ${record.url}`);
  }
  records.push({
    work: compact(record.work),
    location: compact(record.location),
    url: record.url,
    source,
    hindi,
    english,
  });
}

function arrayEnd(source, start) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '[') depth++;
    if (character === ']') {
      depth--;
      if (depth === 0) return index;
    }
  }
  throw new Error('Unterminated array literal');
}

function scriptsIn(html) {
  return Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi), match => match[1]);
}

function inlineAllVerses(html, sourcePath) {
  const script = scriptsIn(html).find(value => /const\s+ALLV\s*=/.test(value));
  if (!script) throw new Error(`ALLV source not found in ${sourcePath}`);
  const declaration = script.match(/const\s+ALLV\s*=\s*\[/);
  const start = declaration.index + declaration[0].lastIndexOf('[');
  const end = arrayEnd(script, start);
  const sandbox = {};
  vm.runInNewContext(`${script.slice(0, end + 1)};globalThis.__searchItems=ALLV;`, sandbox, { timeout: 1000 });
  return sandbox.__searchItems;
}

function inlineArray(script, name) {
  const expression = new RegExp(`const\\s+${name}\\s*=\\s*\\[`);
  const match = script.match(expression);
  if (!match) throw new Error(`${name} source not found`);
  const start = match.index + match[0].lastIndexOf('[');
  const end = arrayEnd(script, start);
  const sandbox = {};
  vm.runInNewContext(`globalThis.__searchItems=${script.slice(start, end + 1)};`, sandbox, { timeout: 1000 });
  return sandbox.__searchItems;
}

function addInlineReader(relative, work, url) {
  const html = read(relative);
  inlineAllVerses(html, relative).forEach((verse, index) => addRecord({
    work,
    location: `Verse ${verse.n || index + 1}`,
    url: `${url}#verse-${index + 1}`,
    source: [verse.d, verse.i].filter(Boolean).join(' '),
    hindi: verse.h,
    english: verse.e,
  }));
}

function addNameCards(relative, work, url) {
  const html = read(relative);
  const articlePattern = /<article\b([^>]*)>([\s\S]*?)<\/article>/gi;
  let match;
  let index = 0;
  while ((match = articlePattern.exec(html))) {
    if (!/\bname-card\b/.test(match[1])) continue;
    index++;
    const id = (match[1].match(/\bid=["']([^"']+)["']/i) || [])[1];
    const contents = match[2];
    const extract = className => {
      const pattern = new RegExp(`<[^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
      const value = contents.match(pattern);
      return value ? decodeHtml(value[1]) : '';
    };
    const sourceMatch = contents.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    addRecord({
      work,
      location: extract('name-number') || `Name ${index}`,
      url: `${url}#${id || `name-${index}`}`,
      source: [sourceMatch ? decodeHtml(sourceMatch[1]) : extract('devanagari'), extract('transliteration'), extract('roman')]
        .filter(Boolean).join(' '),
      hindi: extract('hindi'),
      english: extract('meaning'),
    });
  }
}

for (let chapter = 1; chapter <= 18; chapter++) {
  const relative = `gita/${chapter}/data.js`;
  const sandbox = { window: {} };
  vm.runInNewContext(read(relative), sandbox, { timeout: 1000 });
  const verses = sandbox.window[`GITA_CHAPTER_${chapter}`];
  if (!Array.isArray(verses)) throw new Error(`Gita Chapter ${chapter} did not load`);
  verses.forEach((verse, index) => addRecord({
    work: 'Bhagavad Gita',
    location: `Chapter ${chapter} · Shloka ${index + 1}`,
    url: `gita/${chapter}/#${chapter}-${index + 1}`,
    source: verse.sanskrit,
    hindi: [verse.hi, ...Object.values(verse.wordMeanings || {}).map(meaning => meaning.hi)].filter(Boolean).join(' '),
    english: [verse.en, ...Object.values(verse.wordMeanings || {}).map(meaning => meaning.en)].filter(Boolean).join(' '),
  }));
}

const catalog = JSON.parse(read('catalog.json'));
const stotras = catalog.sections.flatMap(section => section.works)
  .filter(work => work.url.startsWith('/stotra/') && work.id !== 'divine-names');
for (const stotra of stotras) {
  const relative = `stotra/${stotra.id}/index.html`;
  addInlineReader(relative, pageTitle(read(relative)), `stotra/${stotra.id}/`);
}

const sahasranamaHtml = read('vishnu-sahasranama/index.html');
const sahasranamaScript = scriptsIn(sahasranamaHtml).find(value => /const\s+PURVA\s*=/.test(value));
if (!sahasranamaScript) throw new Error('Vishnu Sahasranama verse data not found');
['PURVA', 'NYASA', 'DHYANA', 'STOTRA', 'PHALA'].flatMap(name => inlineArray(sahasranamaScript, name))
  .forEach((verse, index) => addRecord({
    work: 'Vishnu Sahasranama',
    location: `Verse ${verse.n || index + 1}`,
    url: `vishnu-sahasranama/#verse-${index + 1}`,
    source: [verse.d, verse.i].filter(Boolean).join(' '),
    hindi: verse.h,
    english: verse.e,
  }));

for (const entry of fs.readdirSync(path.join(root, 'vishnu-sahasranama/verse'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const number = Number(entry.name);
  if (!Number.isInteger(number)) continue;
  addNameCards(`vishnu-sahasranama/verse/${entry.name}/index.html`, `Vishnu Sahasranama · Verse ${number}`, `vishnu-sahasranama/verse/${entry.name}/`);
}
addNameCards('vishnu-sahasranam-verses/verse-25.html', 'Vishnu Sahasranama · Verse 25', 'vishnu-sahasranam-verses/verse-25.html');
addNameCards('stotra/divine-names/index.html', 'Twelve Divine Names', 'stotra/divine-names/');

records.sort((left, right) => left.work.localeCompare(right.work) || left.location.localeCompare(right.location, undefined, { numeric: true }));
const destinations = new Set();
for (const record of records) {
  if (destinations.has(record.url)) throw new Error(`Duplicate search destination: ${record.url}`);
  destinations.add(record.url);
}

const output = path.join(root, 'assets/search-index.json');
fs.writeFileSync(output, `${JSON.stringify(records)}\n`, 'utf8');
console.log(`Wrote ${records.length} public search records to ${path.relative(root, output)}`);
