/* PLAYWRIGHT_PACKAGE and CHROME_EXECUTABLE may point at local runtimes. */
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:43217/';
const views = [[320,568],[360,640],[390,844],[412,915],[568,320],[667,375],[844,390],[915,412],[1280,900]];
const screenshotDir = process.env.GITA_SCREENSHOT_DIR;
const launch = () => chromium.launch({headless:true, executablePath:process.env.CHROME_EXECUTABLE || undefined});

async function checkView([width,height]) {
  const browser = await launch();
  let layouts = 0, flowLayouts = 0;
  const errors = [], media = [];
  try {
    const page = await browser.newPage({viewport:{width,height}});
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/\.mp3(?:\?|$)/.test(r.url())) media.push(r.url()); });
    for (let chapter=1; chapter<=18; chapter++) {
      await page.goto(new URL(`gita/${chapter}/`,base).href);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#gitaFullscreen').click();
      await page.waitForFunction(() => document.fullscreenElement && document.getElementById('readerReading'));
      const result = await page.evaluate(async () => {
        const waitLayout = () => new Promise(resolve => requestAnimationFrame(resolve));
        const card = document.querySelector('.reader-card'), reading = document.getElementById('readerReading');
        const shloka = document.getElementById('shloka'), select = document.getElementById('verseSelect');
        let count=0, flow=0;
        const failures=[];
        function reveal(el) {
          let scroller = el.parentElement;
          while (scroller !== card && !['auto','scroll'].includes(getComputedStyle(scroller).overflowY)) scroller=scroller.parentElement;
          const bounds=scroller.getBoundingClientRect();
          const header=document.querySelector('.verse-head');
          const top=Math.max(0,bounds.top)+(scroller===card && card.classList.contains('reader-flow') && !header.contains(el) ? header.getBoundingClientRect().height : 0);
          const bottom=Math.min(innerHeight,bounds.bottom);
          const rect=el.getBoundingClientRect();
          scroller.scrollTop += (rect.top+rect.bottom-top-bottom)/2;
          const shown=el.getBoundingClientRect();
          return shown.top>=top-2 && shown.bottom<=bottom+2 && shown.left>=bounds.left-2 && shown.right<=bounds.right+2 && el.scrollWidth<=el.clientWidth+2;
        }
        for (let index=0; index<select.options.length; index++) {
          select.value=String(index); select.dispatchEvent(new Event('change'));
          for (const language of ['hi','en']) {
            document.querySelector(`[data-language=${language}]`).click();
            for (const glosses of [false,true]) {
              const toggle=document.getElementById('showWordMeanings'); toggle.checked=glosses; toggle.dispatchEvent(new Event('change'));
              if(document.getElementById('meaningText').hidden) document.getElementById('toggleMeaning').click();
              await waitLayout(); count++; if(card.classList.contains('reader-flow')) flow++;
              if(document.documentElement.scrollWidth>innerWidth+2 || card.scrollWidth>card.clientWidth+2) failures.push({verse:index+1,language,glosses,reason:'horizontal overflow'});
              for(const el of shloka.querySelectorAll('.word,.word-meaning')) {
                if(!el.getBoundingClientRect().height) continue;
                if(!reveal(el)) { failures.push({verse:index+1,language,glosses,reason:'unreachable word/gloss',text:el.textContent,rect:el.getBoundingClientRect().toJSON(),flow:card.classList.contains('reader-flow')}); break; }
              }
              for(const id of ['gitaFullscreen','playVerse','seek','repeatVerse','continuePlayback','toggleMeaning','followVerse','verseSelect']) {
                // The checkbox itself is smaller than its touch label.
                const el=document.getElementById(id);
                if(!reveal(el)) failures.push({verse:index+1,language,glosses,reason:`unreachable ${id}`});
              }
              card.scrollTop=0; reading.scrollTop=0; shloka.scrollTop=0;
              if(failures.length>=5) return {count,flow,failures};
            }
          }
        }
        return {count,flow,failures};
      });
      assert.deepEqual(result.failures,[], `${width}x${height}, chapter ${chapter}: ${JSON.stringify(result.failures)}`);
      layouts+=result.count; flowLayouts+=result.flow;
      if (chapter===6 && screenshotDir) {
        await page.locator('#verseSelect').selectOption('8');
        await page.evaluate(() => { document.querySelector('.reader-card').scrollTop=0; document.getElementById('readerReading').scrollTop=0; });
        await page.screenshot({path:`${screenshotDir}/fullscreen-${width}x${height}.png`});
      }
      await page.locator('#gitaFullscreen').click();
      await page.waitForFunction(() => !document.fullscreenElement && !document.getElementById('readerReading'));
      assert.equal(await page.locator('#meaningText').isVisible(),true);
    }
    assert.deepEqual(errors,[]); assert.deepEqual(media,[], 'Layout controls must not load audio');
    console.log(`PASS ${width}x${height}: ${layouts} layouts, ${flowLayouts} shell-scroll fallbacks`);
  } finally { await browser.close(); }
  return layouts;
}

async function checkInteraction() {
  const browser=await launch();
  try {
    const page=await browser.newPage({viewport:{width:320,height:568}});
    await page.goto(new URL('gita/6/#6-9',base).href);
    await page.locator('#gitaFullscreen').click();
    await page.waitForFunction(() => !!document.getElementById('readerReading'));
    assert.equal(await page.locator('#meaningText').isVisible(),false);
    await page.locator('#toggleMeaning').click();
    assert.equal(await page.locator('#meaningText').isVisible(),true);
    await page.locator('#playVerse').click();
    await page.waitForFunction(() => !document.getElementById('gitaAudio').paused && Number.isFinite(document.getElementById('gitaAudio').duration));
    const cue=await page.evaluate(() => window.GITA_CHAPTER_6_TIMINGS.verses[8].words.at(-2));
    await page.locator('audio').evaluate((a,cue) => { a.currentTime=(cue.start+cue.end)/2; },cue);
    await page.waitForFunction(() => {
      const word=document.querySelector('.word.is-active'), reading=document.getElementById('readerReading');
      if(!word) return false;
      const r=word.getBoundingClientRect(), b=reading.getBoundingClientRect();
      return r.top>=b.top-1 && r.bottom<=b.bottom+1;
    });
    await page.evaluate(() => document.getElementById('readerReading').dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true})));
    assert.equal(await page.locator('#followVerse').getAttribute('aria-pressed'),'false');
    await page.evaluate(() => { document.getElementById('readerReading').scrollTop=0; });
    await page.locator('audio').evaluate((a,cue) => { a.currentTime=(cue.start+cue.end)/2; },cue);
    assert.equal(await page.locator('#readerReading').evaluate(el=>el.scrollTop),0,'Manual scroll pauses following');
    await page.locator('#followVerse').click();
    assert.equal(await page.locator('#followVerse').getAttribute('aria-pressed'),'true');
    await page.evaluate(() => document.getElementById('readerReading').dispatchEvent(new Event('touchmove',{bubbles:true})));
    assert.equal(await page.locator('#followVerse').getAttribute('aria-pressed'),'false','Touch scrolling pauses following');
    await page.locator('#followVerse').click();
    const source=await page.locator('audio').getAttribute('src');
    await page.setViewportSize({width:568,height:320});
    assert.equal(await page.locator('audio').evaluate(a=>a.paused),false,'Rotation preserves playing audio');
    assert.equal(await page.locator('audio').getAttribute('src'),source);
    await page.locator('#playVerse').click();
    const paused=await page.locator('audio').evaluate(a=>a.currentTime);
    await page.setViewportSize({width:568,height:320});
    await page.locator('[data-language=en]').click();
    await page.locator('#toggleMeaning').click();
    await page.locator('#showWordMeanings').uncheck();
    assert.equal(await page.locator('audio').evaluate(a=>a.currentTime),paused,'Rotation and text controls preserve playback position');
    await page.locator('#showWordMeanings').check();
    await page.evaluate(() => { document.documentElement.style.fontSize='32px'; });
    await page.waitForFunction(() => document.querySelector('.reader-card').classList.contains('reader-flow'));
    const enlargedReachability = () => page.evaluate(() => {
      const card=document.querySelector('.reader-card'), header=document.querySelector('.verse-head');
      const failures=[];
      for(const el of document.querySelectorAll('#shloka .word,#shloka .word-meaning')) {
        if(!el.getBoundingClientRect().height) continue;
        const rect=el.getBoundingClientRect(), top=header.getBoundingClientRect().height;
        card.scrollTop+=(rect.top+rect.bottom-top-innerHeight)/2;
        const shown=el.getBoundingClientRect();
        if(shown.top<top-2 || shown.bottom>innerHeight+2 || shown.left<0 || shown.right>innerWidth+2) failures.push(el.textContent);
      }
      card.scrollTop=0;
      if(card.scrollWidth>innerWidth+2) failures.push('horizontal shell overflow');
      return failures;
    });
    assert.deepEqual(await enlargedReachability(),[],'Every word and gloss remains reachable with 200% landscape text');
    await page.setViewportSize({width:320,height:568});
    await page.waitForFunction(() => document.querySelector('.reader-card').classList.contains('reader-flow'));
    assert.deepEqual(await enlargedReachability(),[],'Every word and gloss remains reachable with 200% portrait text');
    await page.locator('#readerReading').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#followVerse').getAttribute('aria-pressed'),'false');
    await page.locator('#nextVerse').click();
    assert.equal(await page.locator('#followVerse').getAttribute('aria-pressed'),'true','A new verse resumes following');
    await page.locator('#gitaFullscreen').click();
    await page.waitForFunction(()=>!document.fullscreenElement && !document.getElementById('readerReading'));
    assert.equal(await page.locator('#readerReading').count(),0);
    assert.equal(await page.locator('#meaningText').isVisible(),true);
    assert.equal(await page.locator('#followVerse').isVisible(),false);
    await page.evaluate(() => Object.defineProperty(document.documentElement,'requestFullscreen',{value:undefined}));
    await page.locator('#gitaFullscreen').click();
    assert.equal(await page.locator('#readerStatus').textContent(),'Full screen is unavailable in this browser.');
    assert.equal(await page.locator('#readerReading').count(),0);
    console.log('PASS fullscreen interaction: follow/manual wheel and touch scroll, seeking, rotation, translation, glosses, 200% text, keyboard, exit restoration, unsupported fullscreen feedback');
  } finally { await browser.close(); }
}

(async()=>{
  if(process.env.GITA_INTERACTION_ONLY) { await checkInteraction(); return; }
  let total=0;
  // Native fullscreen belongs to the focused window: do not run these in parallel.
  for(const view of views) total+=await checkView(view);
  await checkInteraction();
  console.log(`PASS: ${total} fullscreen layouts across all 700 verses, 18 chapters, 9 viewports, 2 languages and glosses on/off.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
