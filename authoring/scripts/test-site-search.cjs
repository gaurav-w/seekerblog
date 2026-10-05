/* Usage: PLAYWRIGHT_PACKAGE=/path/to/playwright node authoring/scripts/test-site-search.cjs URL */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const origin = process.argv[2] || 'http://127.0.0.1:43129/';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(origin);
    const input = page.locator('#searchInput');
    await input.fill('ocean of wisdom');
    await page.waitForFunction(() => document.querySelectorAll('.site-search-result').length > 0);
    const hanuman = page.locator('.site-search-result').filter({ hasText: 'Hanuman Chalisa' }).first();
    assert.equal(await hanuman.count(), 1, 'English meaning query finds Hanuman Chalisa');
    assert.match(await hanuman.getAttribute('href'), /stotra\/hanuman-chalisa\/#verse-3$/);

    await page.goto(new URL('stotra/hanuman-chalisa/#verse-3', origin).href);
    await page.waitForFunction(() => document.querySelector('#deva')?.textContent.includes('जय हनुमान'));

    await page.goto(origin);
    await page.locator('#searchInput').fill('पवित्र आत्मा');
    await page.waitForFunction(() => document.querySelectorAll('.site-search-result').length > 0);
    const hindi = page.locator('.site-search-result').filter({ hasText: 'Vishnu Sahasranama · Verse 2' }).first();
    assert.equal(await hindi.count(), 1, 'Hindi meaning query finds a Vishnu name card');
    assert.match(await hindi.getAttribute('href'), /vishnu-sahasranama\/verse\/2\/#pootatma$/);

    await page.goto(origin);
    await page.locator('#searchInput').fill('desire to fight');
    await page.waitForFunction(() => document.querySelectorAll('.site-search-result').length > 0);
    const gita = page.locator('.site-search-result').filter({ hasText: 'Chapter 1 · Shloka 1' }).first();
    assert.equal(await gita.count(), 1, 'English search finds the matching Gita shloka');
    assert.match(await gita.getAttribute('href'), /gita\/1\/#1-1$/);

    await page.locator('#searchInput').fill('karmanye vadhikaraste');
    await page.waitForFunction(() => document.querySelectorAll('.site-search-result').length > 0);
    const romanisedGita = page.locator('.site-search-result').filter({ hasText: 'Chapter 2 · Shloka 47' }).first();
    assert.equal(await romanisedGita.count(), 1, 'Unaccented, sandhi-style Sanskrit finds the matching Gita shloka');
    assert.match(await romanisedGita.getAttribute('href'), /gita\/2\/#2-47$/);

    await page.locator('#searchInput').fill('no passage should contain this phrase');
    await page.waitForFunction(() => document.getElementById('siteSearchStatus').textContent.includes('No passages'));
    await page.locator('#clearSearch').click();
    assert.equal(await page.locator('#siteSearchResults').isHidden(), true, 'Clear hides site-wide results');

    await page.goto(new URL('stotra/divine-names/#name-13', origin).href);
    await page.waitForFunction(() => document.getElementById('name-13'));
    assert.equal(await page.locator('#name-13').textContent(), '01हनुमानHanumānThe revered hero of unwavering devotion.');

    for (const target of [
      'stotra/aditya-hridayam/#verse-1',
      'stotra/bajrang-baan/#verse-1',
      'stotra/bhaja-govindam/#verse-1',
      'stotra/ganapati-atharvashirsha/#verse-1',
      'stotra/nirvana-shatkam/#verse-1',
      'stotra/rudrashtakam/#verse-1',
      'stotra/shiva-tandava-stotram/#verse-1',
      'stotra/sri-suktam/#verse-1',
      'vishnu-sahasranama/#verse-1',
    ]) {
      await page.goto(new URL(target, origin).href);
      await page.waitForFunction(() => document.querySelector('#deva')?.textContent.trim().length > 0);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: English/Hindi corpus search, exact Gita and stotra destinations, no-result state, clear action, and stable name anchors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
