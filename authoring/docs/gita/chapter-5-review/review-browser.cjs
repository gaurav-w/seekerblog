const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/gaura/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve(__dirname);
const url = 'http://127.0.0.1:43128/gita/5/';
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'msedge'});
  const page = await browser.newPage({viewport: {width: 1280, height: 1000}});
  const errors = [], requests = [], report = {url, browser: 'Edge', errors, layout: [], probes: []};
  const save = () => fs.writeFileSync(path.join(out,'review-browser.json'),JSON.stringify(report,null,2));
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/\.mp3(?:\?|$)/.test(r.url())) requests.push(r.url()); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  report.initial = {mp3Requests: requests.length, verseOptions: await page.locator('#verseSelect option').count()};
  for (const [width, height] of [[320,568], [390,844], [768,900], [1280,1000]]) {
    await page.setViewportSize({width, height});
    for (const language of ['hi','en']) {
      await page.locator(`[data-language=${language}]`).click();
      for (let i=0; i<29; i++) {
        await page.locator('#verseSelect').selectOption(String(i));
        const layout = await page.evaluate(() => {
          const card = document.querySelector('.reader-card').getBoundingClientRect();
          const clipped = [...document.querySelectorAll('.word,.word-meaning')].filter(el => {
            const r=el.getBoundingClientRect();
            return r.left < card.left-1 || r.right > card.right+1 || el.scrollWidth > el.clientWidth+1;
          }).map(el => el.textContent);
          return {overflow: document.documentElement.scrollWidth > innerWidth, clipped,
            words: document.querySelectorAll('.word').length,
            glosses: [...document.querySelectorAll('.word-meaning')].filter(el=>el.getBoundingClientRect().height>0).length,
            expected: window.GITA_CHAPTER_5_TIMINGS.verses[Number(document.querySelector('#verseSelect').value)].words.length};
        });
        report.layout.push({width,height,language,verse:i+1,...layout});
      }
    }
  }
  report.noPlayRequests = requests.length;
  save();
  await page.setViewportSize({width:1280,height:1000});
  await page.locator('[data-language=en]').click();
  await page.locator('#verseSelect').selectOption('25');
  await page.locator('#playVerse').click();
  await page.waitForFunction(()=>document.getElementById('gitaAudio').currentTime>.3);
  await page.locator('#playVerse').click();
  await page.evaluate(()=>{const a=document.getElementById('gitaAudio');a.currentTime=4.7;});
  await page.waitForTimeout(100);
  report.probes.push(await page.evaluate(()=>({verse:26,time:document.getElementById('gitaAudio').currentTime,active:document.querySelector('.word.is-active')?.textContent||null})));
  await page.screenshot({path:path.join(out,'review-26-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#verseSelect').selectOption('7');
  await page.screenshot({path:path.join(out,'review-08-mobile.png'),fullPage:true});
  await page.locator('#verseSelect').selectOption('16');
  await page.screenshot({path:path.join(out,'review-17-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:1000});
  for (let i=0; i<29; i++) {
    await page.locator('#verseSelect').selectOption(String(i));
    await page.locator('#playVerse').click();
    await page.waitForFunction(()=>Number.isFinite(document.getElementById('gitaAudio').duration)&&!document.getElementById('gitaAudio').paused);
    await page.locator('#playVerse').click();
    const probes = await page.evaluate(async () => {
      const a=document.getElementById('gitaAudio');
      const cue=window.GITA_CHAPTER_5_TIMINGS.verses[Number(document.querySelector('#verseSelect').value)];
      const results=[];
      for(let j=0;j<cue.words.length;j++) {
        const w=cue.words[j];
        a.currentTime=(w.start+w.end)/2;
        await new Promise(resolve=>a.addEventListener('seeked',resolve,{once:true}));
        results.push({word:j,text:w.text,time:a.currentTime,active:Number(document.querySelector('.word.is-active')?.dataset.word??-1),expected:j});
      }
      return {verse:cue.verse,manifestDuration:cue.duration,browserDuration:a.duration,results};
    });
    report.probes.push(probes);
    save();
  }
  await page.locator('#verseSelect').selectOption('28');
  await page.locator('#continuePlayback').check();
  await page.locator('#playVerse').click();
  await page.waitForFunction(()=>Number.isFinite(document.getElementById('gitaAudio').duration));
  await page.evaluate(()=>{const a=document.getElementById('gitaAudio');a.currentTime=a.duration-.15});
  await page.waitForFunction(()=>document.getElementById('gitaAudio').ended);
  report.final = await page.evaluate(()=>({ended:document.getElementById('gitaAudio').ended,verse:document.querySelector('#verseSelect').value,status:document.querySelector('#readerStatus').textContent,playLabel:document.querySelector('#playVerse').getAttribute('aria-label'),active:document.querySelector('.word.is-active')?.textContent||null}));
  save();
  await page.screenshot({path:path.join(out,'review-29-ended.png'),fullPage:true});
  for(const [width,height] of [[320,568],[390,844],[844,390],[1280,720]]) {
    await page.setViewportSize({width,height});
    await page.locator('#verseSelect').selectOption('7');
    await page.locator('#gitaFullscreen').click();
    await page.waitForFunction(()=>!!document.fullscreenElement);
    report.layout.push(await page.evaluate(()=> {
      const container=document.querySelector('.shloka'), r=container.getBoundingClientRect();
      return {fullscreen:true,width:innerWidth,height:innerHeight,verse:8,shlokaHeight:r.height,scrollHeight:container.scrollHeight,scrollTop:container.scrollTop,
        firstWordY:document.querySelector('.word').getBoundingClientRect().top,lastWordBottom:[...document.querySelectorAll('.word')].at(-1).getBoundingClientRect().bottom,shlokaTop:r.top,shlokaBottom:r.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
    }));
    await page.screenshot({path:path.join(out,`review-fullscreen-${width}.png`),fullPage:true});
    await page.evaluate(()=>document.exitFullscreen());
    save();
  }
  report.requests = requests;
  fs.writeFileSync(path.join(out,'review-browser.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({layoutCases:report.layout.length,layoutFailures:report.layout.filter(r=>r.overflow||r.clipped?.length||r.words!==r.expected&&r.expected!==undefined),cueFailures:report.probes.flatMap(r=>r.results||[]).filter(r=>r.active!==r.expected),initial:report.initial,noPlayRequests:report.noPlayRequests,final:report.final,errors,fullscreen:report.layout.filter(r=>r.fullscreen)},null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
