/*
 * Imports bilingual word tables that accompany the reader's Ramsukhdas Hindi text.
 * Usage: node authoring/scripts/import-gita-word-meanings.cjs [chapter ...]
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const requested = process.argv.slice(2).map(Number).filter(Number.isInteger);
const chapters = requested.length ? requested : [1, 2, 4, 5];
const root = path.resolve(__dirname, '../..');
const devanagari = /[\u0904-\u0939]/;
const supplements = {
  '1.20': [
    ['हृषीकेशं', 'हृषीकेश से', 'unto Hrishikesha'],
    ['तदा', 'तब', 'then'],
    ['वाक्यमिदमाह', 'यह वचन कहा', 'spoke these words'],
    ['महीपते', 'हे राजन्', 'O King']
  ]
};

function decode(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
}
function norm(value) {
  return value.normalize('NFC').replace(/[\s।॥,;:—–'’]/g, '')
    .replace(/ं/g, 'म्').replace(/ः/g, 'ह्');
}
function distance(a, b) {
  const row = Array.from({length: b.length + 1}, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]++;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}
function table(html, heading) {
  const found = html.match(new RegExp(`<h3[^>]*>${heading}<\\/h3><table>[\\s\\S]*?<tbody>([\\s\\S]*?)<\\/tbody><\\/table>`));
  if (!found) throw new Error(`Missing ${heading} table`);
  const cells = [...found[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(match => decode(match[1]));
  if (!cells.length || cells.length % 2) throw new Error(`Invalid ${heading} table`);
  return Array.from({length: cells.length / 2}, (_, index) => ({word: cells[index * 2], meaning: cells[index * 2 + 1]}));
}
function align(tokens, hiRows, enRows) {
  if (hiRows.length !== enRows.length) throw new Error('Hindi and English table lengths differ');
  const words = hiRows.map(row => row.word);
  const best = Array.from({length: tokens.length + 1}, () => Array(words.length + 1).fill(null));
  best[0][0] = {cost: 0, path: []};
  for (let i = 0; i < tokens.length; i++) for (let j = 0; j < words.length; j++) {
    const prior = best[i][j];
    if (!prior) continue;
    for (let size = 1; size <= 12 && j + size <= words.length; size++) {
      const target = norm(tokens[i]);
      const source = norm(words.slice(j, j + size).join(''));
      const difference = distance(target, source) / Math.max(target.length, source.length, 1);
      const cost = prior.cost + difference + (size - 1) * 0.015;
      const next = best[i + 1][j + size];
      if (!next || cost < next.cost) best[i + 1][j + size] = {cost, path: [...prior.path, [j, j + size, difference]]};
    }
  }
  const result = best[tokens.length][words.length];
  if (!result) throw new Error(`Unable to align ${tokens.length} displayed tokens with ${words.length} source words. Display: ${tokens.join(' | ')}. Source: ${words.join(' | ')}`);
  const meanings = {};
  result.path.forEach(([start, end], index) => {
    meanings[tokens[index]] = {
      hi: hiRows.slice(start, end).map(row => row.meaning).join(' · '),
      en: enRows.slice(start, end).map(row => row.meaning).join(' · ')
    };
  });
  return {meanings, averageDifference: result.cost / tokens.length};
}
async function fetchVerse(chapter, verse) {
  const response = await fetch(`https://bhagwadgita.info/chapter-${chapter}/sutra-${verse}/`);
  if (!response.ok) throw new Error(`Source returned ${response.status} for ${chapter}.${verse}`);
  const html = await response.text();
  return {hi: table(html, 'शब्दार्थ'), en: table(html, 'Word by word')};
}
async function run() {
  for (const chapter of chapters) {
    const file = path.join(root, 'gita', String(chapter), 'data.js');
    const source = fs.readFileSync(file, 'utf8');
    const context = {window: {}};
    vm.runInNewContext(source, context, {filename: file});
    const key = `GITA_CHAPTER_${chapter}`;
    const verses = context.window[key];
    if (!Array.isArray(verses)) throw new Error(`Missing ${key}`);
    let worst = {verse: 0, difference: 0};
    for (let index = 0; index < verses.length; index++) {
      const rows = await fetchVerse(chapter, index + 1);
      for (const [word, hi, en] of supplements[`${chapter}.${index + 1}`] || []) {
        rows.hi.push({word, meaning: hi});
        rows.en.push({word, meaning: en});
      }
      const tokens = verses[index].sanskrit.trim().split(/\s+/).filter(token => devanagari.test(token));
      let aligned;
      try { aligned = align(tokens, rows.hi, rows.en); }
      catch (error) { throw new Error(`Cannot align ${chapter}.${index + 1}: ${error.message}`); }
      delete verses[index].wordMeaning;
      verses[index].wordMeanings = aligned.meanings;
      if (aligned.averageDifference > worst.difference) worst = {verse: index + 1, difference: aligned.averageDifference};
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    fs.writeFileSync(file, `window.${key} = ${JSON.stringify(verses, null, 2)};\n`, 'utf8');
    console.log(`Chapter ${chapter}: ${verses.length} verses; worst alignment ${chapter}.${worst.verse} = ${worst.difference.toFixed(3)}`);
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
