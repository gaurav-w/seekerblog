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
  const languageKey = `seekerblog:gita${chapter}:meaning-language:v1`;
  let language = 'hi', current = 0, repeat = false, frame = null, revision = 0;
  let activeWord = -1, wordElements = [], pending = false;
  try { language = localStorage.getItem(languageKey) === 'en' ? 'en' : 'hi'; } catch (_) { }
  const message = (hi, en) => language === 'en' ? en : hi;
  const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const clip = () => timings?.verses[current];
  const duration = () => Number.isFinite(audio.duration) ? audio.duration : clip()?.duration || 0;

  function renderMeaning() {
    document.documentElement.lang = language;
    $('meaningTitle').textContent = message('भावार्थ', 'Meaning');
    $('meaningText').textContent = verses[current][language];
    $('meaningText').lang = language;
    $('repeatText').textContent = message('दोहराएँ', 'Repeat');
    $('continueText').textContent = message('अगला श्लोक स्वतः चलाएँ', 'Auto-play next');
    $('wordMeaningsLabel').textContent = message('शब्दार्थ दिखाएँ', 'Word meanings');
    document.querySelectorAll('.word-meaning').forEach(gloss => {
      gloss.textContent = verses[current].wordMeanings[gloss.dataset.token][language];
      gloss.lang = language;
    });
    $('verseLabel').replaceChildren(document.createTextNode(message('श्लोक ', 'Shloka ') + (current + 1)));
    const total = document.createElement('span'); total.textContent = `/ ${verses.length}`; $('verseLabel').append(total);
    document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
    updatePlay();
  }

  function renderVerse() {
    $('shloka').replaceChildren(); wordElements = []; activeWord = -1;
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
    const index = (clip()?.words || []).findIndex(word => time >= word.start && time < word.end);
    if (index !== activeWord) {
      if (wordElements[activeWord]) { wordElements[activeWord].classList.remove('is-active'); wordElements[activeWord].removeAttribute('aria-current'); }
      if (wordElements[index]) { wordElements[index].classList.add('is-active'); wordElements[index].setAttribute('aria-current', 'true'); }
      activeWord = index;
    }
  }

  function animate() { updateProgress(); if (!audio.paused && !audio.ended) frame = requestAnimationFrame(animate); }
  function stopFrame() { if (frame !== null) cancelAnimationFrame(frame); frame = null; }
  async function start() {
    const request = revision;
    if (!clip()) { status.textContent = message('इस श्लोक का ऑडियो उपलब्ध नहीं है।', 'Audio is unavailable for this shloka.'); return; }
    pending = true; status.textContent = ''; updatePlay();
    try {
      if (audio.getAttribute('src') !== clip().audio) audio.src = clip().audio;
      if (audio.error) audio.load();
      if (audio.ended) audio.currentTime = 0;
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
  $('previousVerse').addEventListener('click', () => navigate(-1));
  $('nextVerse').addEventListener('click', () => navigate(1));
  select.addEventListener('change', () => chooseVerse(Number(select.value), pending || !audio.paused));
  $('repeatVerse').addEventListener('click', () => { repeat = !repeat; $('repeatVerse').setAttribute('aria-pressed', String(repeat)); });
  $('showWordMeanings').addEventListener('change', () => {
    $('shloka').classList.toggle('show-word-meanings', Boolean(verses[current].wordMeanings && $('showWordMeanings').checked));
  });
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
    language = button.dataset.language;
    try { localStorage.setItem(languageKey, language); } catch (_) { }
    renderMeaning();
  }));
  seek.addEventListener('input', () => { if (Number.isFinite(audio.duration)) { audio.currentTime = audio.duration * Number(seek.value) / 100; updateProgress(); } });
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('seeked', updateProgress);
  audio.addEventListener('play', () => { stopFrame(); animate(); updatePlay(); });
  audio.addEventListener('playing', () => { pending = false; status.textContent = ''; updatePlay(); });
  audio.addEventListener('pause', () => { stopFrame(); updateProgress(); updatePlay(); });
  audio.addEventListener('ended', () => {
    if (repeat) { audio.currentTime = 0; start(); }
    else if ($('continuePlayback').checked && current < verses.length - 1) chooseVerse(current + 1, true);
    else { updatePlay(); updateProgress(); }
  });
  audio.addEventListener('error', () => { pending = false; updatePlay(); status.textContent = message('ऑडियो लोड नहीं हुआ। फिर से प्रयास करें।', 'Audio could not load. Please try again.'); });
  document.addEventListener('keydown', event => {
    if (event.target.closest('button,input,select,textarea,a,[contenteditable]') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
  });
  function readHash() { const match = location.hash.match(new RegExp(`^#${chapter}-(\\d+)$`)); return match ? Math.max(0, Math.min(verses.length - 1, Number(match[1]) - 1)) : 0; }
  window.addEventListener('hashchange', () => chooseVerse(readHash(), false, false));
  chooseVerse(readHash(), false, false);
})();
