const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('C:/Users/gaura/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=__dirname;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const results={fullscreen:[],interaction:{},loading:{}};
 try {
  for(const [width,height] of [[320,568],[390,844],[844,390],[1280,720]]) {
   const p=await browser.newPage({viewport:{width,height},screen:{width,height}});
   await p.goto('http://127.0.0.1:43128/gita/5/#5-8');
   await p.evaluate(()=>document.fonts.ready);
   await p.locator('[data-language=en]').click();
   await p.locator('#gitaFullscreen').click();
   await p.waitForFunction(()=>!!document.fullscreenElement);
   await p.waitForTimeout(350);
   const r=await p.evaluate(()=>{
    const s=document.querySelector('.shloka'),a=s.getBoundingClientRect(),words=[...document.querySelectorAll('.word')];
    const first=words[0].getBoundingClientRect(),last=words.at(-1).getBoundingClientRect();
    const b=document.querySelector('#gitaFullscreen').getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,firstWordTop:first.top,lastWordBottom:last.bottom,shlokaTop:a.top,shlokaBottom:a.bottom,scrollTop:s.scrollTop,scrollHeight:s.scrollHeight,clientHeight:s.clientHeight,
    font:getComputedStyle(words[0]).fontSize,lines:[...document.querySelectorAll('.shloka-line')].map(el=>({height:el.getBoundingClientRect().height,flexShrink:getComputedStyle(el).flexShrink})),exit:{left:b.left,top:b.top,right:b.right,bottom:b.bottom}};
   });
   results.fullscreen.push(r);
   await p.screenshot({path:path.join(out,`review-fresh-fullscreen-${width}.png`)});
   await p.close();
  }
  const p=await browser.newPage({viewport:{width:1280,height:900}});
  await p.goto('http://127.0.0.1:43128/gita/5/');
  await p.locator('#playVerse').click();
  await p.waitForFunction(()=>document.getElementById('gitaAudio').currentTime>.3);
  const before=await p.locator('audio').evaluate(a=>a.currentTime);
  await p.locator('[data-language=en]').click();
  await p.locator('#showWordMeanings').uncheck();
  results.interaction.languageCaptions=await p.locator('audio').evaluate(a=>({paused:a.paused,time:a.currentTime,src:a.getAttribute('src')}));
  results.interaction.before=before;
  await p.locator('#showWordMeanings').check();
  await p.locator('#repeatVerse').click();
  await p.locator('#continuePlayback').check();
  await p.locator('audio').evaluate(a=>a.currentTime=a.duration-.1);
  await p.waitForFunction(()=>document.getElementById('gitaAudio').currentTime<1&&!document.getElementById('gitaAudio').paused);
  results.interaction.repeatPrecedence=await p.locator('#verseSelect').inputValue();
  await p.locator('#repeatVerse').click();
  await p.locator('audio').evaluate(a=>a.currentTime=a.duration-.1);
  await p.waitForFunction(()=>document.querySelector('#verseSelect').value==='1'&&!document.querySelector('audio').paused);
  results.interaction.autoNext=await p.locator('#verseSelect').inputValue();
  await p.locator('#playVerse').click();
  await p.locator('#continuePlayback').uncheck();
  await p.route('**/03.mp3',async route=>{await new Promise(r=>setTimeout(r,1500));await route.continue()});
  await p.locator('#verseSelect').selectOption('2');
  await p.locator('#playVerse').click();
  await p.waitForTimeout(250);
  results.loading.pending=await p.evaluate(()=>({status:document.querySelector('#readerStatus').textContent,busy:document.querySelector('#playVerse').getAttribute('aria-busy'),label:document.querySelector('#playVerse').getAttribute('aria-label'),time:document.querySelector('audio').currentTime,paused:document.querySelector('audio').paused}));
  await p.waitForFunction(()=>document.querySelector('audio').currentTime>.3);
  await p.locator('#playVerse').click();
  await p.unroute('**/03.mp3');
  await p.route('**/04.mp3',route=>route.fulfill({status:404,body:'missing'}));
  await p.locator('#verseSelect').selectOption('3');
  await p.locator('#playVerse').click();
  await p.waitForFunction(()=>!!document.querySelector('#readerStatus').textContent);
  results.interaction.missingAudio=await p.locator('#readerStatus').textContent();
  await p.locator('#verseSelect').selectOption('4');
  await p.locator('#playVerse').click();
  await p.waitForFunction(()=>document.querySelector('audio').currentTime>.3);
  results.interaction.errorRecovery=await p.locator('audio').evaluate(a=>({paused:a.paused,src:a.getAttribute('src')}));
  fs.writeFileSync(path.join(out,'review-extra.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
