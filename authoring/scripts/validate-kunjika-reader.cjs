/* Verify the static Siddha Kunjika reader and its lazily fetched audio clips. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

try {
  const root = path.resolve(__dirname, '../..');
  const folder = path.join(root, 'stotra/siddha-kunjika-stotram');
  const source = path.join(root, 'authoring/kunjika-stotram/source.m4a');
  const dataSandbox = { window: {} };
  const timingSandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(folder, 'data.js'), 'utf8'), dataSandbox, { timeout: 1000 });
  vm.runInNewContext(fs.readFileSync(path.join(folder, 'timings.js'), 'utf8'), timingSandbox, { timeout: 1000 });
  const reader = dataSandbox.window.STOTRA_READER;
  const timings = JSON.parse(fs.readFileSync(path.join(folder, 'timings.json'), 'utf8'));
  assert.equal(reader.id, 'siddha-kunjika', 'reader identity');
  assert.equal(reader.verses.length, 15, 'stanza count');
  assert.deepEqual(JSON.parse(JSON.stringify(timingSandbox.window.STOTRA_READER_TIMINGS)), timings, 'timing files must agree');
  assert.equal(timings.verses.length, reader.verses.length, 'timing stanza count');
  assert.equal(timings.reviewStatus, 'machine-aligned', 'timings must come from the STT alignment workflow');
  assert.match(timings.method, /STT.*WhisperX/, 'timing provenance must record STT and force alignment');
  assert.equal(timings.sourceSha256, crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), 'source recording changed');
  timings.verses.forEach((entry, index) => {
    assert.equal(entry.verse, index + 1, `stanza ${index + 1} order`);
    assert.match(entry.audio, /^audio\/\d{2}\.mp3$/, `stanza ${index + 1} clip path`);
    assert(fs.statSync(path.join(folder, entry.audio)).size > 0, `stanza ${index + 1} missing clip`);
    assert(entry.sourceEnd > entry.sourceStart && entry.duration > 0, `stanza ${index + 1} invalid interval`);
    assert(Math.abs(entry.duration - (entry.sourceEnd - entry.sourceStart)) < .002, `stanza ${index + 1} incorrect duration`);
    assert.equal(entry.highlightMode, 'stanza', `stanza ${index + 1} must not claim word timing`);
    assert.deepEqual(entry.words, [], `stanza ${index + 1} has unexpected word cues`);
    assert(reader.verses[index].sanskrit.trim() && reader.verses[index].hi.trim() && reader.verses[index].en.trim(), `stanza ${index + 1} incomplete text`);
    if (index + 1 < timings.verses.length) {
      assert(entry.sourceEnd <= timings.verses[index + 1].sourceStart,
        `stanza ${index + 1} overlaps the next stanza in the source`);
    }
  });
  console.log('PASS Siddha Kunjika reader: 15 stanzas, matching manifest, source hash, and audio clips.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
