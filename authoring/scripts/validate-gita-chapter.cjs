/* Usage: node authoring/scripts/validate-gita-chapter.cjs CHAPTER EXPECTED_VERSES [CANDIDATE_DIR] */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

try {
  const chapter = Number(process.argv[2]);
  const expected = Number(process.argv[3]);
  assert(Number.isInteger(chapter) && chapter >= 1 && chapter <= 18 &&
    Number.isInteger(expected) && expected > 0 && [4,5].includes(process.argv.length),
    'Usage: node authoring/scripts/validate-gita-chapter.cjs CHAPTER EXPECTED_VERSES [CANDIDATE_DIR]');
  const root = path.resolve(__dirname, '../..');
  const base = `gita/${chapter}/`;
  const candidate = process.argv[4] && path.resolve(process.argv[4]);
  const timingFile = name => candidate ? path.join(candidate, name) : path.join(root, base, name);
  function readAssignment(file, global) {
    const target = candidate && file.endsWith('/timings.js') ? timingFile('timings.js') : path.join(root, file);
    const text = fs.readFileSync(target, 'utf8').trim();
    const prefix = `window.${global} = `;
    assert(text.startsWith(prefix) && text.endsWith(';'), `${file}: unexpected assignment wrapper`);
    return JSON.parse(text.slice(prefix.length, -1));
  }
  const verses = readAssignment(`${base}data.js`, `GITA_CHAPTER_${chapter}`);
  const timings = JSON.parse(fs.readFileSync(timingFile('timings.json'), 'utf8'));
  assert.deepEqual(readAssignment(`${base}timings.js`, `GITA_CHAPTER_${chapter}_TIMINGS`), timings,
    'Timing JS and JSON must contain identical data');
  assert.equal(timings.chapter, chapter, 'Timing chapter identity');
  assert.equal(timings.version, 1, 'Unsupported timing schema version');
  assert.equal(verses.length, expected, 'Text verse count');
  assert.equal(timings.verses.length, expected, 'Timing verse count');
  assert.match(timings.sourceSha256, /^[a-f0-9]{64}$/, 'Missing source hash');
  assert.equal(typeof timings.reviewStatus, 'string', 'Missing review status');
  const source = path.join(root, `authoring/gita/chapter-${chapter}.mp3`);
  assert(fs.existsSync(source), `Missing master recording: ${source}`);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), timings.sourceSha256,
    'Source MP3 changed: do not reuse timings from a different recording');
  const mediaPaths = new Set();
  let wordCount = 0;
  verses.forEach((verse, index) => {
    const label = `${chapter}.${index + 1}`;
    for (const field of ['sanskrit', 'hi', 'en']) {
      assert(typeof verse[field] === 'string' && verse[field].trim(), `${label}: missing ${field}`);
    }
    if (verse.wordMeaning !== undefined) {
      for (const lang of ['hi', 'en']) {
        assert(typeof verse.wordMeaning?.[lang] === 'string' && verse.wordMeaning[lang].trim(),
          `${label}: missing sourced ${lang} word meaning`);
        assert(!/^this word$/i.test(verse.wordMeaning[lang].trim()),
          `${label}: placeholder sourced ${lang} word meaning`);
      }
    }
    const tokens = verse.sanskrit.trim().split(/\s+/).filter(word => /[\u0900-\u0963]/.test(word));
    assert(tokens.length, `${label}: no Sanskrit words`);
    if (verse.wordMeanings !== undefined) {
      assert(verse.wordMeanings && typeof verse.wordMeanings === 'object', `${label}: invalid glosses`);
      for (const token of tokens) {
        for (const lang of ['hi','en']) {
          assert(typeof verse.wordMeanings[token]?.[lang] === 'string' && verse.wordMeanings[token][lang].trim(),
            `${label}: missing ${lang} meaning for ${token}`);
        }
        assert(!/^this word$/i.test(verse.wordMeanings[token].en.trim()),
          `${label}: placeholder English meaning for ${token}`);
      }
      for (const token of Object.keys(verse.wordMeanings)) assert(tokens.includes(token), `${label}: unused gloss ${token}`);
      const repeatedHindi = tokens.filter(token => verse.wordMeanings[token].hi.trim() === token.trim()).length;
      assert(repeatedHindi < tokens.length / 2,
        `${label}: most Hindi word meanings repeat the Sanskrit token`);
    }
    const cue = timings.verses[index];
    assert.equal(cue.verse, index + 1, `${label}: verse order`);
    assert.deepEqual(cue.words.map(word => word.text), tokens, `${label}: spoken/displayed token order differs`);
    assert(Number.isFinite(cue.duration) && cue.duration > 0, `${label}: duration`);
    assert(Number.isFinite(cue.sourceStart) && cue.sourceStart >= 0 && Number.isFinite(cue.sourceEnd) &&
      cue.sourceEnd > cue.sourceStart, `${label}: source interval`);
    assert(Math.abs(cue.sourceEnd - cue.sourceStart - cue.duration) <= .003, `${label}: duration and interval disagree`);
    if (index) {
      const prior = timings.verses[index - 1];
      const firstAudibleCue = cue.sourceStart + cue.words[0].start;
      assert(prior.sourceEnd <= firstAudibleCue + .001,
        `${label}: prior clip includes the next shloka's first audible cue`);
    }
    assert.match(cue.audio, /^audio\/[0-9]+\.mp3$/, `${label}: wrong audio folder`);
    assert(!mediaPaths.has(cue.audio), `${label}: reused audio path`);
    mediaPaths.add(cue.audio);
    const media = fs.statSync(path.join(candidate || path.join(root, base), cue.audio));
    assert(media.isFile() && media.size > 0, `${label}: empty or missing clip`);
    cue.words.forEach((word, wi) => {
      assert(Number.isFinite(word.start) && Number.isFinite(word.end) && word.start >= 0 &&
        word.end >= word.start && word.end <= cue.duration + .01, `${label}, word ${wi+1}: invalid local cue`);
      if (wi) assert(word.start >= cue.words[wi-1].end - .05, `${label}, word ${wi+1}: cue overlap`);
      if (word.score === undefined) {
        assert(['groq-word','source-supported-endpoint'].includes(word.timingMethod), `${label}, word ${wi+1}: missing acoustic score without source timing provenance`);
        assert.match(timings.alignmentFingerprint || '', /^[a-f0-9]{64}$/, `${label}: missing STT alignment provenance`);
      } else {
        assert(Number.isFinite(word.score) && word.score >= 0 && word.score <= 1, `${label}, word ${wi+1}: confidence score`);
      }
    });
    wordCount += tokens.length;
  });
  console.log(`PASS chapter ${chapter}: ${expected} verses, ${wordCount} word occurrences, source hash, clip files, token order, cue bounds, matching JS/JSON, and quality-checked word meanings when supplied.`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
