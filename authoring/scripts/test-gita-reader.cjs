/* Usage: PLAYWRIGHT_PACKAGE=/path/to/playwright node authoring/scripts/test-gita-reader.cjs URL */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:43128/gita/3/';
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:1000}});
    const errors = [], mediaRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\.mp3(?:\?|$)/.test(request.url())) mediaRequests.push(request.url()); });
    await page.goto(url);
    await page.waitForFunction(() => document.querySelectorAll('.word').length > 0);
    assert.equal(mediaRequests.length, 0, 'No audio should download on page load');
    assert.equal(await page.locator('#verseSelect option').count(), 43);
    assert.equal(await page.locator('iframe').count(), 0);

    await page.getByRole('button', {name:'English',exact:true}).click();
    assert.equal(await page.locator('#meaningText').getAttribute('lang'), 'en');
    const fullscreen = page.getByRole('button', {name:'Enter full screen', exact:true});
    assert.equal(await fullscreen.count(), 1, 'Fullscreen control is available');
    await fullscreen.click();
    await page.waitForFunction(() => document.fullscreenElement === document.documentElement && document.documentElement.classList.contains('gita-fullscreen'));
    assert.equal(await fullscreen.getAttribute('aria-pressed'), 'true');
    assert.equal(await fullscreen.getAttribute('aria-label'), 'Exit full screen');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.fullscreenElement && !document.documentElement.classList.contains('gita-fullscreen'));
    assert.equal(await fullscreen.getAttribute('aria-pressed'), 'false');
    assert(await page.getByRole('switch', {name:'Word meanings'}).isChecked());
    assert.equal(await page.locator('.word-meaning:visible').count(), 12, 'First verse has a gloss under every displayed word');
    assert.equal(await page.locator('.word-meaning').first().textContent(), 'Arjuna');
    await page.locator('#playVerse').click();
    await page.waitForFunction(() => !document.getElementById('gitaAudio').paused && document.getElementById('gitaAudio').currentTime > .4);
    assert(mediaRequests.every(path => path.endsWith('/01.mp3')), 'Only the current shloka should download');
    await page.locator('#playVerse').click();
    const pausedAt = await page.locator('audio').evaluate(a => a.currentTime);
    await page.waitForTimeout(250);
    assert.equal(await page.locator('audio').evaluate(a => a.currentTime), pausedAt);
    await page.locator('#playVerse').click();
    await page.waitForFunction(t => document.getElementById('gitaAudio').currentTime > t + .2, pausedAt);
    await page.getByRole('button', {name:'हिन्दी',exact:true}).click();
    assert.equal(await page.locator('audio').evaluate(a => a.paused), false, 'Language switch preserves playback');
    assert.equal(await page.locator('.word-meaning').first().textContent(), 'अर्जुन');
    await page.getByRole('switch', {name:'शब्दार्थ दिखाएँ'}).uncheck();
    assert.equal(await page.locator('.word-meaning:visible').count(), 0);
    assert.equal(await page.locator('audio').evaluate(a => a.paused), false, 'Word-meaning toggle preserves playback');
    await page.getByRole('switch', {name:'शब्दार्थ दिखाएँ'}).check();
    await page.locator('#playVerse').click();
    await page.evaluate(() => {
      const a = document.getElementById('gitaAudio'), w = window.GITA_CHAPTER_3_TIMINGS.verses[0].words[3];
      a.currentTime = (w.start + w.end) / 2;
    });
    try { await page.waitForFunction(() => document.querySelector('.word.is-active')?.dataset.word === '3', null, {timeout:5000}); }
    catch(error) { console.log(await page.evaluate(()=>({time:document.getElementById('gitaAudio').currentTime,duration:document.getElementById('gitaAudio').duration,ready:document.getElementById('gitaAudio').readyState,paused:document.getElementById('gitaAudio').paused,active:document.querySelector('.word.is-active')?.dataset.word,seekable:Array.from({length:document.getElementById('gitaAudio').seekable.length},(_,i)=>[document.getElementById('gitaAudio').seekable.start(i),document.getElementById('gitaAudio').seekable.end(i)])}))); throw error; }

    await page.locator('#repeatVerse').click();
    await page.locator('#playVerse').click();
    await page.locator('audio').evaluate(a => { a.currentTime = a.duration - .12; });
    await page.waitForFunction(() => { const a=document.getElementById('gitaAudio'); return !a.paused && a.currentTime < 1; });
    assert.equal(await page.locator('#verseSelect').inputValue(), '0');
    await page.locator('#repeatVerse').click();
    await page.locator('#continuePlayback').check();
    await page.locator('audio').evaluate(a => { a.currentTime = a.duration - .12; });
    await page.waitForFunction(() => document.getElementById('verseSelect').value === '1' && !document.getElementById('gitaAudio').paused);
    assert(await page.locator('#wordTools').isVisible(), 'Word meanings are available on the next verse');
    await page.locator('#playVerse').click();
    await page.locator('#continuePlayback').uncheck();
    await page.locator('#verseSelect').selectOption('42');
    assert(await page.locator('#nextVerse').isDisabled());
    await page.locator('#playVerse').click();
    await page.waitForFunction(() => Number.isFinite(document.getElementById('gitaAudio').duration));
    await page.locator('audio').evaluate(a => { a.currentTime = a.duration - .12; });
    await page.waitForFunction(() => document.getElementById('gitaAudio').ended);
    assert.equal(await page.locator('#verseSelect').inputValue(), '42');

    for (const width of [320,390,768,1280]) {
      await page.setViewportSize({width,height:900});
      for (const language of ['hi','en']) {
        await page.locator(`[data-language=${language}]`).click();
        for (let i=0; i<43; i++) {
        await page.locator('#verseSelect').selectOption(String(i));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No overflow at width ${width}, verse ${i+1}`);
        assert.equal(await page.locator('.word').count(), await page.evaluate(i => window.GITA_CHAPTER_3_TIMINGS.verses[i].words.length, i));
        assert.equal(await page.locator('.word-meaning:visible').count(), await page.locator('.word').count(), `Complete glosses in ${language}, verse ${i+1}`);
        const clipped = await page.evaluate(() => {
          const bounds = document.querySelector('.reader-card').getBoundingClientRect();
          return [...document.querySelectorAll('.word,.word-meaning')].some(el => {
            const rect = el.getBoundingClientRect();
            return rect.left < bounds.left || rect.right > bounds.right || el.scrollWidth > el.clientWidth + 1;
          });
        });
        assert.equal(clipped, false, `No clipped words at ${width}px in ${language}, verse ${i+1}`);
        }
      }
    }
    await page.getByRole('button',{name:'English',exact:true}).click();
    await page.reload();
    assert.equal(await page.locator('#meaningText').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#verseSelect').inputValue(),'42', 'Deep link survives reload');
    const chapterDir = path.resolve(__dirname, '../../gita/3');
    const data = JSON.parse(fs.readFileSync(path.join(chapterDir, 'timings.json'), 'utf8'));
    for(const verse of data.verses) {
      assert(fs.existsSync(path.join(chapterDir, verse.audio)));
      assert(verse.words.every((w,i) => w.start >= 0 && w.end >= w.start && w.end <= verse.duration + .01 && (!i || w.start >= verse.words[i-1].end - .05)));
    }
    assert.deepEqual(errors, []);
    for (const chapter of [1, 2, 4, 5]) {
      await page.goto(new URL(`../${chapter}/`, url).href);
      await page.waitForFunction(() => document.querySelectorAll('.word').length > 0);
      assert.equal(await page.locator('#wordTools').isVisible(), true,
        `Chapter ${chapter} exposes sourced word meanings`);
      const verseCount = await page.locator('#verseSelect option').count();
      for (let index = 0; index < verseCount; index++) {
        await page.locator('#verseSelect').selectOption(String(index));
        assert.equal(await page.locator('.word-meaning:visible').count(), await page.locator('.word').count(),
          `Chapter ${chapter}, verse ${index + 1} renders a meaning beneath every Sanskrit word`);
      }
      await page.getByRole('switch', {name:'Word meanings'}).uncheck();
      assert.equal(await page.locator('.word-meaning:visible').count(), 0,
        `Chapter ${chapter} hides inline meanings without changing the verse`);
      await page.getByRole('switch', {name:'Word meanings'}).check();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: no eager audio download, fullscreen enter/exit state, playback, pause/resume, language persistence, word highlighting, repeat, auto-next, final-verse stop, deep links, 43 cue/clip records, verified bilingual word meanings, unavailable-gloss controls hidden, and 344 responsive verse layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
