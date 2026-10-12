/* A compact, one-stanza-at-a-time reader for recorded stotras. */
(() => {
  'use strict';
  const config = window.STOTRA_READER;
  const timings = window.STOTRA_READER_TIMINGS;
  if (!config || !Array.isArray(config.verses) || !timings || !Array.isArray(timings.verses)) return;

  const $ = id => document.getElementById(id);
  const audio = $('gitaAudio');
  const play = $('playVerse');
  const seek = $('seek');
  const select = $('verseSelect');
  const status = $('readerStatus');
  const shloka = $('shloka');
  const fullscreen = $('gitaFullscreen');
  const repeatButton = $('repeatVerse');
  const continuePlayback = $('continuePlayback');
  const speed = $('gitaAudioRate');
  const verses = config.verses;
  const languageKey = `seekerblog:${config.id}:meaning-language:v1`;
  const preferenceKey = key => `seekerblog:${config.id}:${key}:v1`;

  let current = 0;
  let language = 'hi';
  let repeat = false;
  let pending = false;
  let revision = 0;
  let frame = null;

  const message = (hi, en) => language === 'en' ? en : hi;
  const clip = () => timings.verses[current];
  const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const duration = () => Number.isFinite(audio.duration) ? audio.duration : clip()?.duration || 0;
  const readBoolean = (key, fallback = false) => {
    try {
      const value = localStorage.getItem(preferenceKey(key));
      return value === null ? fallback : value === 'true';
    } catch (_) { return fallback; }
  };
  const saveBoolean = (key, value) => {
    try { localStorage.setItem(preferenceKey(key), String(Boolean(value))); } catch (_) { }
  };
  const audioUrl = item => {
    const fingerprint = timings.alignmentFingerprint || timings.sourceSha256;
    return fingerprint ? `${item.audio}?v=${fingerprint.slice(0, 16)}` : item.audio;
  };

  try { language = localStorage.getItem(languageKey) === 'en' ? 'en' : 'hi'; } catch (_) { }
  repeat = readBoolean('repeat');
  continuePlayback.checked = readBoolean('auto-next');
  repeatButton.setAttribute('aria-pressed', String(repeat));

  function updateFullscreen() {
    const active = document.fullscreenElement === document.documentElement;
    document.documentElement.classList.toggle('gita-reader-fullscreen', active);
    fullscreen?.setAttribute('aria-pressed', String(active));
    const label = active ? message('पूर्ण स्क्रीन से बाहर निकलें', 'Exit full screen') : message('पूर्ण स्क्रीन में खोलें', 'Enter full screen');
    fullscreen?.setAttribute('aria-label', label);
    if (fullscreen) fullscreen.title = label;
  }

  function updatePlay() {
    const playing = pending || !audio.paused;
    play.setAttribute('aria-label', playing ? message('पाठ रोकें', 'Pause recitation') : message('पाठ सुनें', 'Play recitation'));
    play.title = play.getAttribute('aria-label');
    play.setAttribute('aria-busy', String(pending));
    $('playIcon').setAttribute('d', playing ? 'M6 5h4v14H6zm8 0h4v14h-4z' : 'M8 5l11 7-11 7z');
  }

  function updateProgress() {
    const length = duration();
    $('elapsed').textContent = formatTime(audio.currentTime || 0);
    $('duration').textContent = formatTime(length);
    seek.value = String(length ? Math.min(100, 100 * (audio.currentTime || 0) / length) : 0);
    seek.disabled = !Number.isFinite(audio.duration) || !length;
    seek.setAttribute('aria-valuetext', `${formatTime(audio.currentTime || 0)} / ${formatTime(length)}`);
  }

  function stopFrame() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  function animate() {
    updateProgress();
    if (!audio.paused && !audio.ended) frame = requestAnimationFrame(animate);
  }

  function render() {
    const verse = verses[current];
    document.documentElement.lang = language;
    [...select.options].forEach((option, index) => {
      option.textContent = `${index + 1}. ${message('श्लोक', 'Stanza')}`;
    });
    $('verseLabel').replaceChildren(document.createTextNode(message('श्लोक ', 'Stanza ') + (current + 1)));
    const total = document.createElement('span');
    total.textContent = `/ ${verses.length}`;
    $('verseLabel').append(total);
    shloka.replaceChildren();
    verse.sanskrit.trim().split('\n').forEach(line => {
      const row = document.createElement('span');
      row.className = 'shloka-line';
      if (/उवाच/.test(line)) row.classList.add('speaker');
      row.textContent = line;
      shloka.append(row);
    });
    $('meaningTitle').textContent = message('भावार्थ', 'Meaning');
    $('meaningText').textContent = verse[language];
    $('meaningText').lang = language;
    $('repeatText').textContent = message('दोहराएँ', 'Repeat');
    $('continueText').textContent = message('अगला श्लोक स्वतः चलाएँ', 'Auto-play next');
    $('playbackSpeedLabel').textContent = message('गति', 'Speed');
    select.value = String(current);
    $('previousVerse').disabled = current === 0;
    $('nextVerse').disabled = current === verses.length - 1;
    document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
    updatePlay();
    updateProgress();
  }

  async function start() {
    const request = revision;
    const item = clip();
    if (!item?.audio) return;
    pending = true;
    status.textContent = message('ऑडियो लोड हो रहा है…', 'Loading audio…');
    updatePlay();
    try {
      const source = audioUrl(item);
      if (audio.getAttribute('src') !== source) audio.src = source;
      audio.playbackRate = Number(speed.value);
      await audio.play();
    } catch (error) {
      if (request === revision && error.name !== 'AbortError') status.textContent = message('ऑडियो नहीं चल सका। फिर से Play दबाएँ।', 'Audio could not play. Please try Play again.');
    } finally {
      if (request === revision) { pending = false; updatePlay(); }
    }
  }

  function choose(index, autoplay = false, updateHash = true) {
    if (!Number.isInteger(index) || index < 0 || index >= verses.length) return;
    revision++;
    pending = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    stopFrame();
    shloka.classList.remove('reader-audio-active');
    current = index;
    status.textContent = '';
    if (updateHash) history.replaceState(null, '', `#${config.id}-${current + 1}`);
    render();
    if (autoplay) start();
  }

  select.replaceChildren();
  verses.forEach((_, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = String(index + 1);
    select.append(option);
  });

  play.addEventListener('click', () => {
    if (pending || !audio.paused) { revision++; pending = false; audio.pause(); }
    else start();
    updatePlay();
  });
  $('previousVerse').addEventListener('click', () => choose(current - 1, pending || !audio.paused));
  $('nextVerse').addEventListener('click', () => choose(current + 1, pending || !audio.paused));
  select.addEventListener('change', () => choose(Number(select.value), pending || !audio.paused));
  repeatButton.addEventListener('click', () => {
    repeat = !repeat;
    repeatButton.setAttribute('aria-pressed', String(repeat));
    saveBoolean('repeat', repeat);
  });
  continuePlayback.addEventListener('change', () => saveBoolean('auto-next', continuePlayback.checked));
  speed.addEventListener('change', () => { audio.playbackRate = Number(speed.value); });
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
    language = button.dataset.language;
    try { localStorage.setItem(languageKey, language); } catch (_) { }
    render();
  }));
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * Number(seek.value) / 100;
  });
  fullscreen?.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) { status.textContent = message('इस ब्राउज़र में पूर्ण स्क्रीन उपलब्ध नहीं है।', 'Full screen is unavailable in this browser.'); }
  });
  document.addEventListener('fullscreenchange', updateFullscreen);
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('play', () => { stopFrame(); animate(); shloka.classList.add('reader-audio-active'); updatePlay(); });
  audio.addEventListener('playing', () => { pending = false; status.textContent = ''; updatePlay(); });
  audio.addEventListener('pause', () => { stopFrame(); shloka.classList.remove('reader-audio-active'); updateProgress(); updatePlay(); });
  audio.addEventListener('ended', () => {
    shloka.classList.remove('reader-audio-active');
    if (repeat) { audio.currentTime = 0; start(); }
    else if (continuePlayback.checked && current < verses.length - 1) choose(current + 1, true);
    else if (current === verses.length - 1) status.textContent = message('स्तोत्र पूर्ण हुआ।', 'Stotram complete.');
  });
  audio.addEventListener('error', () => { pending = false; shloka.classList.remove('reader-audio-active'); updatePlay(); status.textContent = message('ऑडियो लोड नहीं हुआ। फिर से प्रयास करें।', 'Audio could not load. Please try again.'); });
  document.addEventListener('keydown', event => {
    if (event.target.closest('button,input,select,textarea,a,[contenteditable]') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Space') { event.preventDefault(); play.click(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); choose(current - 1, pending || !audio.paused); }
    if (event.key === 'ArrowRight') { event.preventDefault(); choose(current + 1, pending || !audio.paused); }
  });
  const readHash = () => {
    const match = location.hash.match(new RegExp(`^#${config.id}-(\\d+)$`));
    return match ? Math.max(0, Math.min(verses.length - 1, Number(match[1]) - 1)) : 0;
  };
  window.addEventListener('hashchange', () => choose(readHash(), false, false));
  updateFullscreen();
  choose(readHash(), false, false);
})();
