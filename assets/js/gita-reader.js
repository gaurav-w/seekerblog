/* One audio clip per shloka; nothing is downloaded until playback is requested. */
(() => {
  'use strict';
  const chapter = Number(document.body.dataset.gitaChapter || 3);
  const verses = window[`GITA_CHAPTER_${chapter}`];
  const timings = window[`GITA_CHAPTER_${chapter}_TIMINGS`];
  const $ = id => document.getElementById(id);
  const audio = $('gitaAudio');
  const play = $('playVerse');
  const seek = $('seek');
  const status = $('readerStatus');
  const select = $('verseSelect');
  const fullscreen = $('gitaFullscreen');
  const shloka = $('shloka');
  const card = shloka.closest('.reader-card');
  const meaningPanel = $('meaningText').closest('.meaning-panel');
  const wordTools = $('wordTools');
  const continuePlayback = $('continuePlayback');
  const showWordMeanings = $('showWordMeanings');
  const repeatButton = $('repeatVerse');
  const playback = play.closest('.playback');
  const speedControl = document.createElement('label');
  speedControl.className = 'speed-control';
  speedControl.innerHTML = '<span id="playbackSpeedLabel">गति</span><select id="gitaAudioRate" aria-label="Playback speed"><option value="0.85">0.85×</option><option value="1">1×</option><option value="1.2">1.2×</option><option value="1.5">1.5×</option></select>';
  playback.querySelector('.transport').append(speedControl);
  const playbackRate = $('gitaAudioRate');
  const meaningToggle = document.createElement('button');
  meaningToggle.id = 'toggleMeaning'; meaningToggle.className = 'meaning-toggle';
  meaningToggle.type = 'button'; meaningToggle.hidden = true;
  meaningToggle.setAttribute('aria-controls', 'meaningText');
  $('meaningTitle').after(meaningToggle);
  const followButton = document.createElement('button');
  followButton.id = 'followVerse'; followButton.className = 'follow-verse';
  followButton.type = 'button'; followButton.hidden = true;
  wordTools.prepend(followButton);
  let readingRegion = null, shlokaHome = null, meaningHome = null;
  let meaningCollapsed = false, followVerse = true, layoutFrame = null;
  const languageKey = `seekerblog:gita${chapter}:meaning-language:v1`;
  const preferenceKeys = {
    continuousPlayback: 'seekerblog:gita:continuous-playback',
    showWordMeanings: 'seekerblog:gita:show-word-meanings',
    repeatVerse: 'seekerblog:gita:repeat-verse',
  };
  let language = 'hi', current = 0, repeat = false, frame = null, revision = 0;
  let activeWord = -1, activeCueIndices = [], wordElements = [], pending = false;
  let screenWakeLock = null, wakeLockPending = false, pageActive = true;
  let nextAudio = null, nextAudioIndex = -1;
  function savedBoolean(key, fallback = false) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value === 'true';
    } catch (_) { return fallback; }
  }
  function saveBoolean(key, value) {
    try { localStorage.setItem(key, String(Boolean(value))); } catch (_) { }
  }
  try { language = localStorage.getItem(languageKey) === 'en' ? 'en' : 'hi'; } catch (_) { }
  continuePlayback.checked = savedBoolean(preferenceKeys.continuousPlayback);
  showWordMeanings.checked = savedBoolean(preferenceKeys.showWordMeanings, showWordMeanings.checked);
  repeat = savedBoolean(preferenceKeys.repeatVerse);
  repeatButton.setAttribute('aria-pressed', String(repeat));
  const message = (hi, en) => language === 'en' ? en : hi;
  const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const clip = () => timings?.verses[current];
  const duration = () => Number.isFinite(audio.duration) ? audio.duration : clip()?.duration || 0;

  function clearNextAudioPreload() {
    if (!nextAudio) return;
    nextAudio.removeAttribute('src');
    nextAudio.load();
    nextAudio = null;
    nextAudioIndex = -1;
  }

  function preloadNextAudio() {
    const index = current + 1;
    const nextClip = timings?.verses[index];
    if (repeat || !continuePlayback.checked || !nextClip?.audio || nextAudioIndex === index) return;
    clearNextAudioPreload();
    nextAudio = new Audio();
    nextAudio.preload = 'auto';
    nextAudio.src = nextClip.audio;
    nextAudio.load();
    nextAudioIndex = index;
  }

  function needsScreenAwake() {
    return pageActive && document.visibilityState === 'visible' &&
      (document.fullscreenElement === document.documentElement ||
        pending || (!audio.paused && !audio.ended && !audio.error));
  }

  async function syncScreenWakeLock() {
    if (!needsScreenAwake()) {
      const lock = screenWakeLock;
      screenWakeLock = null;
      try { await lock?.release(); } catch (_) { }
      return;
    }
    if (!navigator.wakeLock || screenWakeLock || wakeLockPending) return;
    wakeLockPending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      // The user may have paused, left full screen, or hidden the page
      // while the browser was handling the request.
      if (!needsScreenAwake()) { await lock.release(); return; }
      if (lock.released) return;
      screenWakeLock = lock;
      lock.addEventListener('release', () => {
        if (screenWakeLock === lock) screenWakeLock = null;
      });
    } catch (_) {
      // Unsupported or denied wake locks must not interrupt reading/audio.
    } finally { wakeLockPending = false; }
  }

  function syncReadingControls() {
    meaningToggle.hidden = !readingRegion;
    meaningToggle.textContent = meaningCollapsed ? message('दिखाएँ', 'Show') : message('छिपाएँ', 'Hide');
    meaningToggle.setAttribute('aria-label', meaningCollapsed ? message('भावार्थ दिखाएँ', 'Show meaning') : message('भावार्थ छिपाएँ', 'Hide meaning'));
    meaningToggle.setAttribute('aria-expanded', String(!meaningCollapsed));
    $('meaningText').hidden = Boolean(readingRegion && meaningCollapsed);
    followButton.hidden = !readingRegion;
    followButton.textContent = message('श्लोक के साथ चलें', 'Follow verse');
    followButton.setAttribute('aria-pressed', String(followVerse));
    const hasGlosses = Boolean(verses[current].wordMeanings);
    wordTools.hidden = !hasGlosses && !readingRegion;
    $('showWordMeanings').closest('label').hidden = !hasGlosses;
    if (readingRegion) readingRegion.setAttribute('aria-label', message('श्लोक और भावार्थ', 'Verse and meaning'));
  }

  function pauseFollowing() { followVerse = false; syncReadingControls(); }

  function scrollViewport() {
    if (card.classList.contains('reader-flow')) return card;
    return getComputedStyle(shloka).overflowY === 'auto' ? shloka : readingRegion;
  }

  function followActiveWord() {
    if (!readingRegion || !followVerse || audio.paused || activeWord < 0) return;
    const scroller = scrollViewport(), word = wordElements[activeWord];
    const bounds = scroller.getBoundingClientRect(), rect = word.getBoundingClientRect();
    const visibleTop = bounds.top + (scroller === card ? $('verseLabel').closest('.verse-head').getBoundingClientRect().height : 0) + 8;
    const visibleBottom = bounds.bottom - 8;
    let delta = 0;
    if (rect.height > visibleBottom - visibleTop || rect.top < visibleTop) delta = rect.top - visibleTop;
    else if (rect.bottom > visibleBottom) delta = rect.bottom - visibleBottom;
    if (Math.abs(delta) > 1) scroller.scrollBy({top:delta, behavior:'instant'});
  }

  function scheduleReadingLayout() {
    if (!readingRegion || layoutFrame !== null) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      if (!readingRegion) return;
      const fixedHeight = [...card.children].filter(el => el !== readingRegion)
        .reduce((height, el) => height + el.getBoundingClientRect().height, 0);
      const style = getComputedStyle(card);
      const available = card.clientHeight - fixedHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const largest = Math.max(0, ...[...shloka.querySelectorAll('.word,.word-meaning')].map(el => el.getBoundingClientRect().height));
      // When a whole wrapped word/gloss cannot fit, let the shell scroll.
      // Its sticky header keeps fullscreen exit available.
      card.classList.toggle('reader-flow', largest + 32 > available);
      followActiveWord();
    });
  }

  function mountReadingRegion(active) {
    if (active && !readingRegion) {
      shlokaHome = document.createComment('verse position');
      meaningHome = document.createComment('meaning position');
      shloka.before(shlokaHome); meaningPanel.before(meaningHome);
      readingRegion = document.createElement('div');
      readingRegion.id = 'readerReading'; readingRegion.className = 'reader-reading';
      readingRegion.tabIndex = 0; readingRegion.setAttribute('role', 'region');
      shloka.before(readingRegion); readingRegion.append(shloka, meaningPanel);
      meaningCollapsed = matchMedia('(max-width:700px), (max-height:650px)').matches;
      followVerse = true;
      readingRegion.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && (event.target === readingRegion || event.target === shloka)) pauseFollowing();
      });
      readingRegion.addEventListener('keydown', event => {
        if (!event.target.closest('button,input,select,a') && ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) pauseFollowing();
      });
    } else if (!active && readingRegion) {
      shlokaHome.replaceWith(shloka); meaningHome.replaceWith(meaningPanel);
      readingRegion.remove(); readingRegion = null;
      card.classList.remove('reader-flow'); card.scrollTop = 0;
      meaningCollapsed = false;
    }
    syncReadingControls(); scheduleReadingLayout();
  }

  function syncFullscreenControl() {
    const active = document.fullscreenElement === document.documentElement;
    document.documentElement.classList.toggle('gita-reader-fullscreen', active);
    mountReadingRegion(active);
    syncScreenWakeLock();
    if (!fullscreen) return;
    const label = active ? message('पूर्ण स्क्रीन से बाहर निकलें', 'Exit full screen') : message('पूर्ण स्क्रीन में खोलें', 'Enter full screen');
    fullscreen.setAttribute('aria-label', label);
    fullscreen.title = label;
    fullscreen.setAttribute('aria-pressed', String(active));
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else throw new Error('Fullscreen is unavailable');
    } catch (_) {
      status.textContent = message('इस ब्राउज़र में पूर्ण स्क्रीन उपलब्ध नहीं है।', 'Full screen is unavailable in this browser.');
    }
  }

  function renderMeaning() {
    document.documentElement.lang = language;
    $('meaningTitle').textContent = message('भावार्थ', 'Meaning');
    $('meaningText').textContent = verses[current][language];
    $('meaningText').lang = language;
    $('repeatText').textContent = message('दोहराएँ', 'Repeat');
    $('continueText').textContent = message('अगला श्लोक स्वतः चलाएँ', 'Auto-play next');
    $('playbackSpeedLabel').textContent = message('गति', 'Speed');
    playbackRate.setAttribute('aria-label', message('पाठ की गति', 'Playback speed'));
    $('wordMeaningsLabel').textContent = message('शब्दार्थ दिखाएँ', 'Word meanings');
    document.querySelectorAll('.word-meaning').forEach(gloss => {
      gloss.textContent = verses[current].wordMeanings[gloss.dataset.token][language];
      gloss.lang = language;
    });
    $('verseLabel').replaceChildren(document.createTextNode(message('श्लोक ', 'Shloka ') + (current + 1)));
    const total = document.createElement('span'); total.textContent = `/ ${verses.length}`; $('verseLabel').append(total);
    document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
    syncFullscreenControl();
    updatePlay();
  }

  function renderVerse() {
    followVerse = true;
    if (readingRegion) { readingRegion.scrollTop = 0; shloka.scrollTop = 0; card.scrollTop = 0; }
    $('shloka').replaceChildren(); wordElements = []; activeWord = -1; activeCueIndices = [];
    const glosses = verses[current].wordMeanings;
    $('wordTools').hidden = !glosses;
    $('shloka').classList.toggle('show-word-meanings', Boolean(glosses && $('showWordMeanings').checked));
    verses[current].sanskrit.trim().split('\n').forEach(line => {
      const row = document.createElement('span'); row.className = 'shloka-line';
      if (/उवाच/.test(line)) row.classList.add('speaker');
      line.trim().split(/\s+/).forEach(token => {
        if (/[\u0900-\u0963]/.test(token)) {
          const word = document.createElement('span'); word.className = 'word'; word.textContent = token;
          word.dataset.word = String(wordElements.length); wordElements.push(word);
          if (glosses?.[token]) {
            const unit = document.createElement('span'); unit.className = 'word-unit';
            if (token.length > 24) unit.classList.add('long-word');
            const gloss = document.createElement('span'); gloss.className = 'word-meaning'; gloss.dataset.token = token;
            unit.append(word, gloss); row.append(unit);
          } else row.append(word);
        } else row.append(document.createTextNode(token));
        row.append(document.createTextNode(' '));
      });
      $('shloka').append(row);
    });
    select.value = String(current);
    $('previousVerse').disabled = current === 0;
    $('nextVerse').disabled = current === verses.length - 1;
    renderMeaning(); updateProgress();
  }

  function updatePlay() {
    syncScreenWakeLock();
    const isPlaying = pending || !audio.paused;
    const label = isPlaying ? message('पाठ रोकें', 'Pause shloka') : message('श्लोक सुनें', 'Play shloka');
    play.setAttribute('aria-label', label); play.title = label;
    play.setAttribute('aria-busy', String(pending));
    $('playIcon').setAttribute('d', isPlaying ? 'M6 5h4v14H6zm8 0h4v14h-4z' : 'M8 5l11 7-11 7z');
  }

  function updateProgress() {
    const time = audio.currentTime || 0, length = duration();
    $('elapsed').textContent = formatTime(time); $('duration').textContent = formatTime(length);
    seek.value = String(length ? Math.min(100, 100 * time / length) : 0);
    seek.disabled = !Number.isFinite(audio.duration) || !length;
    seek.setAttribute('aria-valuetext', `${formatTime(time)} / ${formatTime(length)}`);
    if (length && time >= Math.max(0, length - 2.5)) preloadNextAudio();
    const words = clip()?.words || [];
    const wordLevel = clip()?.highlightMode === 'word';
    const matchedGroups = new Set();
    const nextActive = [];
    words.forEach((word, index) => {
      const start = wordLevel ? word.start : (word.highlightStart ?? word.start);
      const end = wordLevel ? word.end : (word.highlightEnd ?? word.end);
      if (time >= start && time < end) {
        if (!wordLevel && word.highlightGroup !== undefined) matchedGroups.add(word.highlightGroup);
        else nextActive.push(index);
      }
    });
    if (matchedGroups.size) {
      words.forEach((word, index) => {
        if (matchedGroups.has(word.highlightGroup)) nextActive.push(index);
      });
    }
    // Do not make the marker flicker during a normal, very short pause between
    // two aligned words. Longer uncovered speech remains visible as an audit
    // issue instead of being masked by a held marker.
    if (!nextActive.length && activeWord >= 0) {
      const previous = words[activeWord];
      const end = previous.highlightEnd ?? previous.end;
      if (time >= end && time < end + .18) nextActive.push(...activeCueIndices);
    }
    const changed = nextActive.length !== activeCueIndices.length ||
      nextActive.some((index, position) => index !== activeCueIndices[position]);
    if (changed) {
      activeCueIndices.forEach(index => {
        wordElements[index]?.classList.remove('is-active');
        wordElements[index]?.removeAttribute('aria-current');
      });
      nextActive.forEach((index, position) => {
        wordElements[index]?.classList.add('is-active');
        if (position === 0) wordElements[index]?.setAttribute('aria-current', 'true');
        else wordElements[index]?.removeAttribute('aria-current');
      });
      activeCueIndices = nextActive;
      activeWord = nextActive[0] ?? -1;
      if (activeWord >= 0) followActiveWord();
    }
  }

  function animate() { updateProgress(); if (!audio.paused && !audio.ended) frame = requestAnimationFrame(animate); }
  function stopFrame() { if (frame !== null) cancelAnimationFrame(frame); frame = null; }
  async function start() {
    const request = revision;
    if (!clip()) { status.textContent = message('इस श्लोक का ऑडियो उपलब्ध नहीं है।', 'Audio is unavailable for this shloka.'); return; }
    pending = true; status.textContent = message('ऑडियो लोड हो रहा है…', 'Loading audio…'); updatePlay();
    try {
      if (audio.getAttribute('src') !== clip().audio) audio.src = clip().audio;
      if (audio.error) audio.load();
      if (audio.ended) audio.currentTime = 0;
      audio.playbackRate = Number(playbackRate.value);
      await audio.play();
    } catch (error) {
      if (request === revision && error.name !== 'AbortError') status.textContent = message('ऑडियो नहीं चल सका। फिर से Play दबाएँ।', 'Audio could not play. Please try Play again.');
    } finally { if (request === revision) { pending = false; updatePlay(); } }
  }
  function togglePlay() {
    if (!audio.paused || pending) { revision++; pending = false; audio.pause(); updatePlay(); }
    else start();
  }
  function chooseVerse(index, autoplay = false, updateHash = true) {
    if (!Number.isInteger(index) || index < 0 || index >= verses.length) return;
    revision++; pending = false; audio.pause(); stopFrame(); current = index;
    if (nextAudioIndex !== current) clearNextAudioPreload();
    status.textContent = '';
    // Leave src unset until Play: some browsers fetch metadata despite preload=none.
    audio.removeAttribute('src');
    audio.load();
    renderVerse();
    if (updateHash) history.replaceState(null, '', `#${chapter}-${current + 1}`);
    if (autoplay) start();
  }
  function navigate(delta) { chooseVerse(current + delta, pending || !audio.paused); }

  verses.forEach((_, index) => { const option = document.createElement('option'); option.value = index; option.textContent = `${chapter}.${index + 1}`; select.append(option); });
  play.addEventListener('click', togglePlay);
  if (fullscreen) {
    fullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', syncFullscreenControl);
    syncFullscreenControl();
  }
  $('previousVerse').addEventListener('click', () => navigate(-1));
  $('nextVerse').addEventListener('click', () => navigate(1));
  select.addEventListener('change', () => chooseVerse(Number(select.value), pending || !audio.paused));
  repeatButton.addEventListener('click', () => {
    repeat = !repeat;
    repeatButton.setAttribute('aria-pressed', String(repeat));
    saveBoolean(preferenceKeys.repeatVerse, repeat);
    if (repeat) clearNextAudioPreload();
  });
  continuePlayback.addEventListener('change', () => {
    saveBoolean(preferenceKeys.continuousPlayback, continuePlayback.checked);
    if (!continuePlayback.checked) clearNextAudioPreload();
  });
  showWordMeanings.addEventListener('change', () => {
    saveBoolean(preferenceKeys.showWordMeanings, showWordMeanings.checked);
    $('shloka').classList.toggle('show-word-meanings', Boolean(verses[current].wordMeanings && showWordMeanings.checked));
    scheduleReadingLayout();
  });
  playbackRate.addEventListener('change', () => { audio.playbackRate = Number(playbackRate.value); });
  meaningToggle.addEventListener('click', () => { meaningCollapsed = !meaningCollapsed; syncReadingControls(); scheduleReadingLayout(); });
  followButton.addEventListener('click', () => { followVerse = !followVerse; syncReadingControls(); followActiveWord(); });
  // Listen on the shell too: very large text can make it the scroll viewport.
  card.addEventListener('wheel', () => { if (readingRegion) pauseFollowing(); }, {passive:true});
  card.addEventListener('touchmove', () => { if (readingRegion) pauseFollowing(); }, {passive:true});
  card.addEventListener('pointerdown', event => {
    if (readingRegion && event.pointerType === 'mouse' && event.target === card) pauseFollowing();
  });
  window.addEventListener('resize', scheduleReadingLayout);
  document.addEventListener('visibilitychange', syncScreenWakeLock);
  window.addEventListener('focus', syncScreenWakeLock);
  window.addEventListener('pagehide', () => { pageActive = false; syncScreenWakeLock(); });
  window.addEventListener('pageshow', () => { pageActive = true; syncScreenWakeLock(); });
  window.visualViewport?.addEventListener('resize', scheduleReadingLayout);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(scheduleReadingLayout);
    [card, wordTools, play.closest('.playback'), $('verseLabel').closest('.verse-head')].forEach(el => observer.observe(el));
  }
  document.fonts?.ready.then(scheduleReadingLayout);
  document.fonts?.addEventListener('loadingdone', scheduleReadingLayout);
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
    language = button.dataset.language;
    try { localStorage.setItem(languageKey, language); } catch (_) { }
    renderMeaning();
  }));
  seek.addEventListener('input', () => { if (Number.isFinite(audio.duration)) { audio.currentTime = audio.duration * Number(seek.value) / 100; updateProgress(); } });
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('seeked', () => { updateProgress(); followActiveWord(); });
  audio.addEventListener('play', () => { stopFrame(); animate(); followActiveWord(); updatePlay(); });
  audio.addEventListener('playing', () => { pending = false; status.textContent = ''; updatePlay(); });
  audio.addEventListener('pause', () => { stopFrame(); updateProgress(); updatePlay(); });
  audio.addEventListener('ended', () => {
    if (repeat) { audio.currentTime = 0; start(); }
    else if (continuePlayback.checked && current < verses.length - 1) chooseVerse(current + 1, true);
    else {
      updatePlay(); updateProgress();
      if (current === verses.length - 1) {
        status.textContent = message(`अध्याय ${chapter} पूर्ण हुआ।`, `Chapter ${chapter} complete.`);
      }
    }
  });
  audio.addEventListener('error', () => { pending = false; updatePlay(); status.textContent = message('ऑडियो लोड नहीं हुआ। फिर से प्रयास करें।', 'Audio could not load. Please try again.'); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && readingRegion && document.fullscreenElement) {
      event.preventDefault(); document.exitFullscreen().catch(() => {}); return;
    }
    if (event.target.closest('button,input,select,textarea,a,[contenteditable]') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('.reader-reading') && event.code === 'Space') return;
    if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
  });
  function readHash() { const match = location.hash.match(new RegExp(`^#${chapter}-(\\d+)$`)); return match ? Math.max(0, Math.min(verses.length - 1, Number(match[1]) - 1)) : 0; }
  window.addEventListener('hashchange', () => chooseVerse(readHash(), false, false));
  chooseVerse(readHash(), false, false);
})();
