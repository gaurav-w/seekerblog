/* PLAYWRIGHT_PACKAGE and CHROME_EXECUTABLE may point at local runtimes. */
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:43128/gita/3/';

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_EXECUTABLE || undefined});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const state = window.wakeTest = {requests:0, locks:[], deferred:false, denied:false, resolve:null};
      Object.defineProperty(navigator, 'wakeLock', {configurable:true, value:{
        async request(type) {
          if (type !== 'screen') throw new Error('Wrong lock type');
          state.requests++;
          if (state.denied) throw new DOMException('Denied', 'NotAllowedError');
          if (state.deferred) await new Promise(resolve => { state.resolve = resolve; });
          const lock = new EventTarget();
          lock.released = false;
          lock.release = async () => {
            lock.released = true;
            lock.dispatchEvent(new Event('release'));
          };
          state.locks.push(lock);
          return lock;
        }
      }});
    });
    const active = count => page.waitForFunction(n => window.wakeTest.locks.filter(lock => !lock.released).length === n, count);
    const fullscreen = async () => {
      const button = page.locator('#gitaFullscreen');
      const next = await button.getAttribute('aria-pressed') !== 'true';
      await button.click();
      await page.waitForFunction(value => document.getElementById('gitaFullscreen').getAttribute('aria-pressed') === String(value), next);
    };
    const toggleAudio = () => page.locator('#playVerse').click();
    const visibility = value => page.evaluate(value => {
      Object.defineProperty(document, 'visibilityState', {configurable:true, value});
      document.dispatchEvent(new Event('visibilitychange'));
    }, value);

    await page.goto(url);
    await page.waitForFunction(() => document.querySelectorAll('.word').length);
    assert.equal(await page.evaluate(() => wakeTest.requests), 0, 'Idle reading does not request a lock');
    await fullscreen();
    await active(1);
    await page.getByRole('button', {name:'English',exact:true}).click();
    assert.equal(await page.evaluate(() => wakeTest.requests), 1, 'Rerender does not duplicate a lock');

    await toggleAudio();
    await page.waitForFunction(() => !document.getElementById('gitaAudio').paused);
    await toggleAudio();
    await active(1); // Fullscreen reading still needs it while audio is paused.
    await fullscreen();
    await active(0);

    await toggleAudio();
    await active(1);
    await fullscreen();
    await fullscreen();
    await active(1); // Playback still needs it after exiting fullscreen.
    await visibility('hidden');
    await active(0);
    await visibility('visible');
    await active(1);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await active(0);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted:true})));
    await active(1);
    await toggleAudio();
    await active(0);

    await page.locator('#continuePlayback').uncheck();
    await toggleAudio();
    await active(1);
    await page.waitForFunction(() => Number.isFinite(document.getElementById('gitaAudio').duration));
    await page.locator('audio').evaluate(audio => { audio.currentTime = audio.duration - .1; });
    await page.waitForFunction(() => document.getElementById('gitaAudio').ended);
    await active(0);

    await fullscreen();
    await active(1);
    await page.evaluate(() => wakeTest.locks.at(-1).release());
    await active(0);
    await visibility('hidden');
    await visibility('visible');
    await active(1); // Restore after a browser-initiated release.
    await fullscreen();
    await active(0);

    await page.evaluate(() => { wakeTest.deferred = true; });
    await fullscreen();
    await page.waitForFunction(() => wakeTest.resolve);
    const requestCount = await page.evaluate(() => wakeTest.requests);
    await page.getByRole('button', {name:'हिन्दी',exact:true}).click();
    assert.equal(await page.evaluate(() => wakeTest.requests), requestCount, 'Only one request can be pending');
    await fullscreen();
    await page.evaluate(() => { wakeTest.resolve(); wakeTest.deferred = false; });
    await active(0);
    assert.equal(await page.evaluate(() => wakeTest.locks.at(-1).released), true, 'Late lock is released after exit');

    await page.evaluate(() => { wakeTest.denied = true; });
    await fullscreen();
    await active(0);
    assert.equal(await page.locator('#gitaFullscreen').getAttribute('aria-pressed'), 'true', 'Denied lock does not break fullscreen');
    await fullscreen();
    await page.evaluate(() => { wakeTest.denied = false; });
    await fullscreen();
    await active(1); // A rejected request does not block future attempts.
    await fullscreen();
    await active(0);

    await page.evaluate(() => Object.defineProperty(navigator, 'wakeLock', {value:undefined}));
    await fullscreen();
    await toggleAudio();
    await page.waitForFunction(() => document.getElementById('gitaAudio').currentTime > .2 && !document.getElementById('gitaAudio').paused);
    await toggleAudio();
    await fullscreen();
    assert.deepEqual(errors, [], 'No unhandled page errors, including unsupported/denied APIs');
    console.log('PASS: fullscreen and playback wake locks, pause/end/exit cleanup, visibility and page restoration, browser release, pending-request race, denied and unsupported APIs.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
