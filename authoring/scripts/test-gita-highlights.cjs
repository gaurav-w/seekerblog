/* Test the production cue selector against every chapter, without a browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const reader = fs.readFileSync(path.join(root, 'assets/js/gita-reader.js'), 'utf8');
const source = reader.slice(reader.indexOf('  function activeCuesAt('), reader.indexOf('  function updateProgress('));
const activeAt = vm.runInNewContext(`(${source.trim()})`);
const active = (...args) => Array.from(activeAt(...args));
const audioSource = reader.slice(reader.indexOf('  function audioUrl('), reader.indexOf('  function clearNextAudioPreload('));
const audioUrl = vm.runInNewContext(`(${audioSource.trim()})`, {timings: {alignmentFingerprint: '0123456789abcdef0123456789abcdef'}});
assert.equal(audioUrl({audio: 'audio/68.mp3'}), 'audio/68.mp3?v=0123456789abcdef', 'Rebuilt clips invalidate old audio caches');
assert.equal(audioUrl({audio: 'audio/68.mp3?existing=1'}), 'audio/68.mp3?existing=1&v=0123456789abcdef');
const oldAudioUrl = vm.runInNewContext(`(${audioSource.trim()})`, {timings: {}});
assert.equal(oldAudioUrl({audio: 'audio/01.mp3'}), 'audio/01.mp3', 'Older unversioned manifests remain playable');
let cues = 0, verses = 0;
for (let chapter = 1; chapter <= 18; chapter++) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, `gita/${chapter}/timings.json`), 'utf8'));
  for (const verse of manifest.verses) {
    verses++;
    for (const [index, word] of verse.words.entries()) {
      cues++;
      if (word.end <= word.start) continue;
      for (const rate of [.85, 1, 1.2, 1.5]) {
        assert(active(verse.words, (word.start + word.end) / 2, true, rate).includes(index),
          `${chapter}.${verse.verse} word ${index + 1} must highlight at its midpoint`);
        const next = verse.words[index + 1];
        if (next && next.start - word.end > .06) {
          assert(active(verse.words, word.end + .04, true, rate).includes(index),
            `${chapter}.${verse.verse} short hold uses the word end`);
        }
        if (next && next.start - word.end > .18 * rate + .02) {
          assert.deepEqual(active(verse.words, word.end + .18 * rate + .01, true, rate), [],
            `${chapter}.${verse.verse} real silence clears the marker`);
        }
      }
    }
  }
}
const fixture = [
  {start: 0, end: .08, highlightStart: 0, highlightEnd: 2, highlightGroup: 0},
  {start: .2, end: .5, highlightStart: 0, highlightEnd: 2, highlightGroup: 0},
];
assert.deepEqual(active(fixture, .12, true), [0], 'Word mode ignores the longer group end');
assert.deepEqual(active(fixture, .21, true), [1], 'The next word replaces the held cue');
assert.deepEqual(active(fixture, .12, false), [0, 1], 'Existing phrase mode remains available');
assert.deepEqual(active(fixture, -.01, true), [], 'Seeking before speech has no stale marker');
assert.deepEqual(active(fixture, .7, true), [], 'Seeking after speech has no stale marker');
const overlapping = [{start: 0, end: 1.03}, {start: 1, end: 1.02}, {start: 1.3, end: 1.6}];
assert.deepEqual(active(overlapping, 1.06, true), [1], 'A short overlapping cue holds without jumping back');
assert.deepEqual(active(overlapping, 1.22, true), [], 'An older overlapping cue cannot extend the hold');
console.log(`PASS: ${verses} verses, ${cues} cue midpoints and gap behavior at all four playback speeds; phrase mode and independent seeking.`);
