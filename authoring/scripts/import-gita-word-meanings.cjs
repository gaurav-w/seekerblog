/*
 * Imports bilingual word tables that accompany the reader's Ramsukhdas Hindi text.
 * Usage: node authoring/scripts/import-gita-word-meanings.cjs [chapter ...]
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const requested = process.argv.slice(2).map(Number).filter(Number.isInteger);
const chapters = requested.length ? requested : [1, 2, 4, 5, 6, 7];
const root = path.resolve(__dirname, '../..');
const devanagari = /[\u0904-\u0939]/;
// See prepare-gita-chapter-data.py: the selected Chapter 13 recital follows
// the 34-verse recension, while this source exposes an additional opening
// question. Fetch the matching source table for every displayed verse.
const sourceOffsets = {13: 1};
const supplements = {
  '1.20': [
    ['हृषीकेशं', 'हृषीकेश से', 'unto Hrishikesha'],
    ['तदा', 'तब', 'then'],
    ['वाक्यमिदमाह', 'यह वचन कहा', 'spoke these words'],
    ['महीपते', 'हे राजन्', 'O King']
  ]
};
// Applied after alignment. These repair a source-table omission that a trailing
// supplement row cannot place without shifting the following glosses.
const reviewedGlosses = {
  '7.11': {
    'चाहं': {'hi': 'और · मैं हूँ', 'en': 'and · I am'}
  },
  // The source table splits लोकक्षयकृत्प्रवृद्धो into two rows. The reader
  // deliberately displays it as one metrical group, so use this reviewed map
  // rather than accepting the otherwise shifted dynamic-programming match.
  '11.32': {
    'श्रीभगवानुवाच': {'hi': 'श्री भगवान् ने कहा', 'en': 'the Supreme Lord said'},
    'कालोऽस्मि': {'hi': 'काल · मैं हूँ', 'en': 'Time · I am'},
    'लोकक्षयकृत्प्रवृद्धो': {'hi': 'लोकों का क्षय करनेवाला · प्रबल', 'en': 'world-destroying · grown mighty'},
    'लोकान्समाहर्तुमिह': {'hi': 'लोकों का संहार करने के लिये · यहाँ', 'en': 'to destroy the worlds · here'},
    'प्रवृत्तः': {'hi': 'प्रवृत्त हुआ हूँ', 'en': 'I am engaged'},
    'ऋतेऽपि': {'hi': 'बिना भी', 'en': 'even without'},
    'त्वां': {'hi': 'तुम्हारे', 'en': 'you'},
    'न': {'hi': 'नहीं', 'en': 'not'},
    'भविष्यन्ति': {'hi': 'रहेंगे', 'en': 'will remain'},
    'सर्वे': {'hi': 'सभी', 'en': 'all'},
    'येऽवस्थिताः': {'hi': 'जो खड़े हैं', 'en': 'who are stationed'},
    'प्रत्यनीकेषु': {'hi': 'विपक्षी सेनाओं में', 'en': 'in the opposing armies'},
    'योधाः': {'hi': 'योद्धा', 'en': 'warriors'}
  },
  // The table joins the first three terms while this reader keeps them
  // separate for recitation highlighting.
  '17.16': {
    'मनः': {'hi': 'मन की', 'en': 'of the mind'},
    'प्रसादः': {'hi': 'प्रसन्नता', 'en': 'serenity'},
    'सौम्यत्वं': {'hi': 'सौम्यता', 'en': 'gentleness'},
    'मौनमात्मविनिग्रहः': {'hi': 'मौन · आत्मसंयम', 'en': 'silence · self-control'},
    'भावसंशुद्धिरित्येतत्तपो': {'hi': 'भावों की शुद्धि · इस प्रकार · यह · तप', 'en': 'purity of feeling · thus · this · austerity'},
    'मानसमुच्यते': {'hi': 'मानसिक · कहा जाता है', 'en': 'mental · is called'}
  },
  // The source table separates यद्, अहंकारम्, and आश्रित्य while this reader
  // preserves the recording's joined opening group.
  '18.59': {
    'यदहंकारमाश्रित्य': {'hi': 'यदि · अहंकार का · आश्रय लेकर', 'en': 'if · egoism · taking shelter of'},
    'न': {'hi': 'नहीं', 'en': 'not'},
    'योत्स्य': {'hi': 'युद्ध करूँगा', 'en': 'I will fight'},
    'इति': {'hi': 'ऐसा', 'en': 'thus'},
    'मन्यसे': {'hi': 'तुम मानते हो', 'en': 'you think'},
    'मिथ्यैष': {'hi': 'यह मिथ्या है', 'en': 'this is vain'},
    'व्यवसायस्ते': {'hi': 'तेरा निश्चय', 'en': 'your resolve'},
    'प्रकृतिस्त्वां': {'hi': 'प्रकृति तुम्हें', 'en': 'nature · you'},
    'नियोक्ष्यति': {'hi': 'विवश करेगी', 'en': 'will compel'}
  }
};
function expandRepeated(rows) {
  return rows.flatMap(row => {
    const parts = row.word.split(/\s+/).filter(Boolean);
    if (parts.length === 2 && norm(parts[0]) === norm(parts[1])) {
      return [{word: parts[0], meaning: row.meaning}, {word: parts[1], meaning: row.meaning}];
    }
    return [row];
  });
}

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
  const join = rows => rows.map(row => row.meaning).filter((meaning, index, all) => meaning !== all[index - 1]).join(' · ');
  const meanings = {};
  result.path.forEach(([start, end], index) => {
    meanings[tokens[index]] = {
      hi: join(hiRows.slice(start, end)),
      en: join(enRows.slice(start, end))
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
      const sourceVerse = index + 1 + (sourceOffsets[chapter] || 0);
      const rows = await fetchVerse(chapter, sourceVerse);
      rows.hi = expandRepeated(rows.hi);
      rows.en = expandRepeated(rows.en);
      for (const [word, hi, en] of supplements[`${chapter}.${index + 1}`] || []) {
        rows.hi.push({word, meaning: hi});
        rows.en.push({word, meaning: en});
      }
      const tokens = verses[index].sanskrit.trim().split(/\s+/).filter(token => devanagari.test(token));
      let aligned;
      try { aligned = align(tokens, rows.hi, rows.en); }
      catch (error) { throw new Error(`Cannot align ${chapter}.${index + 1}: ${error.message}`); }
      delete verses[index].wordMeaning;
      verses[index].wordMeanings = Object.assign(aligned.meanings, reviewedGlosses[`${chapter}.${index + 1}`] || {});
      if (aligned.averageDifference > worst.difference) worst = {verse: index + 1, difference: aligned.averageDifference};
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    fs.writeFileSync(file, `window.${key} = ${JSON.stringify(verses, null, 2)};\n`, 'utf8');
    console.log(`Chapter ${chapter}: ${verses.length} verses; worst alignment ${chapter}.${worst.verse} = ${worst.difference.toFixed(3)}`);
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
