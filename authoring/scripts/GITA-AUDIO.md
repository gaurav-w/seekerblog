# Chapter 3 audio

For another chapter, start with the [chapter implementation guide](../GITA-CHAPTERS.md). The scripts below still contain Chapter 3 paths and counts; do not run them unchanged for another chapter.

The reader uses the user-supplied MP3 stored in `authoring/gita/chapter-3.mp3` as its build source. It never requests that complete file during playback. The 43 smaller files in `gita/3/audio/` are independently playable shloka clips. The `<audio>` element uses `preload="none"`; selecting a shloka does not fetch its audio until Play is pressed. Auto-play next is optional and off by default.

Deploy `gita/N/`, `assets/css/gita-reader.css`, `assets/js/gita-reader.js`, and `assets/css/theme.css` together. No server-side processing, API key, or YouTube iframe is required. The static data scripts also work when opening the HTML locally through `file://`.

## Timing provenance

`gita/3/timings.json` records the source SHA-256, original-recording boundaries, local clip paths, and word start/end times relative to each clip. Its `.js` companion contains the same data for direct local-file loading. The displayed Sanskrit is the original supplied text, not an ASR transcript. Standalone danda punctuation is excluded from cue indexing.

Timings are machine-generated, using local faster-whisper transcription to locate passages and WhisperX's cached Hindi Wav2Vec2 model to align each Sanskrit line. The first pass's skipped passages were retranscribed with silence rejection disabled. These timings have structural checks and playback tests; they are not a human-certified phonetic transcription. Word confidence scores are retained for later listening review.

## Rebuild

Use a Python environment with `faster-whisper`, `whisperx`, NumPy, PyTorch, and the locally cached `small` Whisper and `theainerd/Wav2Vec2-large-xlsr-hindi` models. FFmpeg must be on PATH. These are development tools only.

1. `python scripts/transcribe-gita.py`
2. `python scripts/align-gita.py --redo 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43`
3. Review the local `.gita-work/` alignment results and any low-confidence cues.
4. `python scripts/build-gita-audio.py`

The build rejects missing words, overlapping verses, malformed timings, and unexpected durations. Both public timing files are generated from the same object. `.gita-work/` is ignored by Git.

## Browser checks

Start the preview with `python scripts/preview-site.py` (port 43128). This server supports HTTP byte ranges for audio seeking; Python's plain `http.server` does not. The production static host must also support byte-range requests, as Apache normally does.

With Playwright installed, run `node authoring/scripts/test-gita-reader.cjs`. To use another server, pass the page URL. If Playwright is installed elsewhere, set `PLAYWRIGHT_PACKAGE` to its package directory. The checks exercise real MP3 playback, selective loading, seeking/highlighting, pause/resume, repeat, auto-next, language persistence, deep links, and all 43 verses at four viewport widths.
