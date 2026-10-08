/* Validate the generated audio manifest against the reader's exact tokenisation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const readerHtml = fs.readFileSync(path.join(root, 'vishnu-sahasranama', 'index.html'), 'utf8');
const readerScript = Array.from(readerHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi), match => match[1])
  .find(script => script.includes('const PURVA='));
assert(readerScript, 'the reader data and controller script exists');
new Function(readerScript);
assert.match(readerHtml, /function usableRecordedClip\(clip=recordedClip\(\)\)[\s\S]*?clip\.playback!=="disabled-pending-recut"/, 'reader blocks clips queued for re-cut');
assert.match(readerHtml, /This recording clip is being corrected because it does not match the displayed passage\./, 'reader explains blocked mismatched audio');
assert.match(readerHtml, /id="soundBtn"[^>]*aria-pressed="false"/, 'transport has a sound on\/off button');
assert.match(readerHtml, /id="segAudioRate"[\s\S]*?data-v="1"[\s\S]*?1×[\s\S]*?data-v="1\.2"[\s\S]*?1\.2×[\s\S]*?data-v="1\.5"[\s\S]*?1\.5×[\s\S]*?data-v="2"[\s\S]*?2×/, 'sound mode exposes all requested playback speeds');
const work = path.join(root, '.vishnu-work', 'verses.json');
if (!fs.existsSync(work)) execFileSync(process.execPath, [path.join(__dirname, 'extract-vishnu-sahasranama-data.cjs')], {stdio: 'inherit'});
const verses = JSON.parse(fs.readFileSync(work, 'utf8'));
const manifestPath = path.join(root, 'vishnu-sahasranama', 'timings.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const auditStates = new Set([
  'not-evidenced-no-clip', 'stt-partial-no-clip', 'partial-or-wrong-clip',
  'extra-speech-in-clip', 'possible-extra-speech',
]);
const blockedPlaybackStates = new Set(['partial-or-wrong-clip', 'extra-speech-in-clip']);
assert.equal(manifest.entries.length, verses.length, 'every reader entry has a timing record');
assert.equal(manifest.source.id, 'W2gNg8-XQRg');
assert(['provisional-paced', 'machine-aligned', 'stt-mapped'].includes(manifest.reviewStatus), 'a recognised timing review state is recorded');
for (const [index, verse] of verses.entries()) {
  const entry = manifest.entries[index];
  assert.equal(entry.key, verse.key);
  if (entry.audioReview !== undefined) {
    assert(auditStates.has(entry.audioReview), `${entry.key}: recognised STT review status`);
    assert.equal(entry.playback === 'disabled-pending-recut', blockedPlaybackStates.has(entry.audioReview), `${entry.key}: playback guard matches review status`);
  }
  if (entry.available === false) {
    assert.deepEqual(entry.words, [], `${entry.key}: omitted audio has no fabricated cues`);
    continue;
  }
  assert(fs.existsSync(path.join(root, 'vishnu-sahasranama', entry.audio)), `${entry.key}: clip exists`);
  const expected = verse.devanagari.split(/\s+/).filter(token => /[\u0900-\u0963]/.test(token));
  assert.deepEqual(entry.words.map(word => word.text), expected, `${entry.key}: cue text matches display text`);
  assert(entry.duration > 0, `${entry.key}: positive clip duration`);
  entry.words.forEach((word, wordIndex) => {
    assert(word.start >= 0 && word.end >= word.start && word.end <= entry.duration + .01, `${entry.key}: bounded word cue`);
    if (wordIndex) assert(word.start >= entry.words[wordIndex - 1].end - .001, `${entry.key}: ordered word cues`);
  });
}
for (const [key, start, end] of [['stotram:8', 636, 638], ['stotram:17', 752, 754]]) {
  const entry = manifest.entries.find(candidate => candidate.key === key);
  assert.equal(entry.available, true, `${key}: recording is available`);
  assert(entry.sourceStart >= start && entry.sourceStart <= end, `${key}: source position follows Groq evidence`);
}
const publicScript = fs.readFileSync(path.join(root, 'vishnu-sahasranama', 'timings.js'), 'utf8');
assert(publicScript.startsWith('window.VISHNU_SAHASRANAMA_TIMINGS = '));
assert(publicScript.includes(manifest.source.sha256));
console.log(`PASS: ${verses.length} Vishnu Sahasranama entries have matching clips and ordered word cues.`);
