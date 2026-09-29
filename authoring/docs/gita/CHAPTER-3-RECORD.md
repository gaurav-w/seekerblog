# Chapter 3 reference implementation

Documented on 2026-09-29. This captures the completed reader work and lessons from the session, including limitations for future chapters. Files are present in the working tree; this handoff does not imply a commit or deployment.

## Accepted scope and design

- Chapter 3, Karma Yoga, 43 verses; one shloka displayed at a time.
- Hindi and English full meanings, with optional smaller bilingual captions immediately under all displayed Sanskrit word groups. The one-verse design was approved and extended to all 43.
- Local per-shloka audio, gold round play/pause button, word highlighting, seek, previous/next, selector, repeat, and optional auto-next.
- Language choice persists; captions start enabled and preserve their choice across verses within a page session.
- Compact source/reciter footer. Removed the long explanation beneath the meaning, embedded video, and visitor-facing timing controls.

## Text sources and editorial decisions

The selected interpretation is Swami Ramsukhdas's *Sadhak-Sanjivani*, Gita Press. Hindi/English summaries and word captions are concise editorial renderings, not claims of verbatim published English translation. No ISKCON translation is used.

Publication reference: [Gita Seva: Sadhak-Sanjivani](https://gitaseva.org/books/srimad-bhagwadgita-sadhak-sanjivani). Author-labelled checks and verse links are recorded in [GITA-TEXT.md](../../scripts/GITA-TEXT.md).

In 3.42–3.43, the earlier summaries identified the principle beyond intellect as the Self. Checking the selected Ramsukhdas exposition led to correcting the summaries and captions to desire (kama). This is a source-specific decision; do not silently substitute another commentator's interpretation.

Sanskrit token boundaries were preserved for audio compatibility. Joined groups receive combined captions. Verse 25 contains a particularly long group; captions are allowed to wrap and the Sanskrit must remain visible even when captions are off.

## Recording and generated assets

- Video supplied by the user: [Rajshri Soul, Bhagavad Gita Chapter 3](https://www.youtube.com/watch?v=o3SMgvf-4BA).
- Local file supplied afterward: `C:\Users\gaura\Downloads\भगवद गीता - अध्याय ३ Bhagavad Gita Chapter 3 - With Lyrics Rajshri Soul.mp3`.
- Copied master: `authoring/gita/chapter-3.mp3`; already MP3, so no master conversion was needed.
- Master: 8,609,175 bytes, approximately 744.687 seconds, 44.1 kHz.
- SHA-256: `b28b1f07c51b0ee869050cbfffab5126bdf55b4676466dff42f02eec02892021`.
- 43 clips: `gita/3/audio/01.mp3` through `43.mp3`, re-encoded with `libmp3lame` at 96 kbps.
- Total clip bytes: 7,616,672; individual files approximately 149–240 KB.
- 381 timed/displayed word occurrences, including speaker words and excluding standalone danda punctuation.
- Timing provenance, source boundaries, clip-relative cues, and confidence scores: `gita/3/timings.json`, with identical `.js` companion.
- Manifest status: **machine-aligned**. There has not been a complete human listening audit of all clips and word boundaries.

The reader requests individual clips only when needed for playback. It does not request the master. Chapter invocation and closing material are excluded from the verse clips; speaker words included in the displayed text are retained.

## Alignment process and problems resolved

The local environment was `E:\Vishnu Sahasranama\.venv-align\Scripts\python.exe`, using cached faster-whisper `small` and WhisperX Hindi Wav2Vec2 alignment (`theainerd/Wav2Vec2-large-xlsr-hindi`). CPU transcription used int8 and six threads. FFmpeg/FFprobe were already available. See [workflow](WORKFLOW.md) for current commands.

| Observation | Resolution / lesson |
|---|---|
| Hindi ASR distorted Sanskrit | Use it only for approximate anchors; align the authoritative displayed Sanskrit |
| Whole-verse alignment matched repeated phrases too early, including a verse 3 tail around 65 rather than 70 seconds | Align individual lines within narrower windows |
| Initial transcription missed passages around 136–166, 239–271, and 529–562 seconds | Retranscribed slices 132–174, 232–279, and 521–568 with silence rejection disabled, offset their times, and merged missing anchors |
| Verse 33 ASR appeared in Latin script, leaving no usable Devanagari anchors and causing overlap with verse 32 | Explicit line windows `[529.9,538.3]` and `[538.4,546.2]` in `scripts/gita-alignment-windows.json`; re-aligned the affected verse |
| Existing alignment caches could survive changed inputs | Use explicit `--redo` and isolate caches per chapter; current cache filenames do not encode input hashes |
| `preload="none"` still allowed an early request when audio src/load was set during render | Leave src unset until Play |
| Plain Python HTTP preview made seeking jump to zero; Chromium seekable range was `[0,0]` | Added byte-range support in `scripts/preview-site.py`; use it for realistic playback tests |
| Generic site header/footer rules introduced large whitespace | Scoped reader overrides restored compact spacing |
| Long joined words/captions clipped on mobile | Constrain word width, allow wrapping, inspect element bounds and scroll width with captions both on and off |
| Language/caption changes could interfere with playback if implemented as a full media rerender | Keep text rendering separate from selecting/loading the audio source |

The old slice-repair helper lived in ignored `.gita-work/`; it is not a durable dependency. Its repair bounds and process are recorded above. The current transcription script disables silence rejection by default. A fresh run can produce different machine timings, so rebuilt results still require review; byte-identical regeneration is not promised.

## Repository implementation

- Page: `gita/3/`.
- Runtime: `gita-reader.js`, `gita-reader.css`, chapter text and timing scripts under `assets/data/`.
- Audio tools: `scripts/transcribe-gita.py`, `scripts/align-gita.py`, `scripts/build-gita-audio.py`, and the alignment-window JSON.
- Preview/tests: `scripts/preview-site.py`, `scripts/test-gita-reader.cjs`.
- New reusable data checker: `scripts/validate-gita-chapter.cjs CHAPTER EXPECTED_VERSES`.
- Discovery links: homepage and sitemap updated during implementation.

The reader, audio pipeline, and browser tests still contain Chapter 3 constants. Only the new structural validator is chapter-parameterized. See the workflow's adaptation table before adding Chapter 4 or any other chapter.

## Verification evidence and limits

During the reader implementation, the Chapter 3 browser suite passed: playback, pause/resume, language persistence, caption toggling during playback, cue-to-word mapping, repeat, auto-next, final-verse stop, deep-link reload, clip/cue checks, and all 344 verse/language/viewport combinations with captions enabled. The suite checks widths 320, 390, 768, and 1280. Local HTTP and direct-file previews were exercised during implementation.

Additional scratch inspection checked all 43 verses at 320 and 390 px with captions off; long verse 25 was visually inspected. That scratch checker is not part of the maintained browser suite. Keep the captions-off test in future acceptance checks.

On 2026-09-29 the reusable validator passed for 43 verses and 381 word occurrences, checking bilingual coverage, master hash, clip files, token order, finite cue bounds, and JS/JSON parity. The safe negative check with expected count 44 failed as intended with `Text verse count` and exit code 1. `node --check scripts/validate-gita-chapter.cjs` passed; all relative links in the seven guide/supporting documents resolved, and this report's SHA-256 matched the manifest. `git diff --check` reported no whitespace errors (only Windows line-ending warnings). The documentation-only turn did not rerun the browser suite or rebuild audio. See the [test matrix](TEST-CASES.md) for precise coverage and required additional checks.

These checks do not establish that every editorial gloss has an independent scholarly review or that every highlight matches the audible syllable. The full listening audit and broader keyboard/error/race-condition cases are not claimed as completed. Preserve the machine-aligned status until actual listening review is recorded.
