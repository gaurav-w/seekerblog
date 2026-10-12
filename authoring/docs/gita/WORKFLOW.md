# Add a Bhagavad Gita chapter

## 1. Fixed requirements from the user

- Use Gita Press for meanings. Chapter 3 uses Swami Ramsukhdas's *Sadhak-Sanjivani*. Do not use ISKCON's *Bhagavad-gita As It Is*.
- Show one shloka at a time, with its Sanskrit, audio, and full meaning.
- Provide Hindi and English full meanings and smaller optional meanings immediately beneath each displayed Sanskrit word group.
- Keep the approved Chapter 3 design: dark blue reader card, gold circular play/pause, previous/next, verse selector, seek bar, repeat, optional auto-next, meaning-language switch, compact footer credits.
- Word captions are enabled initially. Switching captions or language must not restart or pause the audio. The full meaning remains visible with captions off.
- The language choice persists. Caption visibility currently lasts for the page session and carries across verses; persistence across reload is not implemented or required by the approved reference.
- Audio highlighting follows the actual recitation. Visitors must not record or import their own timing cues.
- Fetch only the selected shloka clip when Play is pressed. No full-chapter download, prefetch of every clip, or eager metadata request.
- Keep implementation details out of the reading experience. Do not restore timing editors, long source explanations under meanings, or an embedded video alongside the local audio.
- Work on the requested chapter. Do not automatically generate the other chapters, deploy, send messages, or modify unrelated pages.

## 2. Establish the inputs and preserve the reference

1. Inspect `git status --short` and applicable repository instructions. Account for existing edits; never reset them.
2. Identify the requested chapter number, selected edition, expected verse count, and the supplied audio file. Verify the count from the selected source; do not copy Chapter 3's count of 43.
3. If the user names Downloads, find that specific file. Do not recursively inspect unrelated personal files. Preserve the original; copy it into the chapter's asset folder.
4. Probe the recording with FFprobe. An `.mp3` that already contains MP3 audio needs no conversion. A different local format can be converted once with FFmpeg; never just rename its extension.
5. Check the recording against the requested chapter, including opening invocation, speaker announcements, repeated recitation, verse order, and closing colophon. Decide which portions belong to the shloka clips. Chapter 3 excludes the chapter invocation and closing material but includes speaker announcements present in the verse text.
6. Record the audio filename, SHA-256, duration, edition/author, source URLs, and review status in the new chapter record.
7. If only a video link is available, use the user-approved Kevin Watt yt-dlp MCP workflow below. State any actual access limitation. A link does not itself provide measured word timings. Do not fabricate timings, replace this recording with another unnoticed, or hand the timing work back to visitors.

### Download a supplied YouTube recording with yt-dlp MCP

The user approved Kevin Watt's yt-dlp MCP as a source-download option. Its tools were discoverable in this session; discovery alone does not prove a particular download will succeed. Prefer an already supplied local recording when available, so existing timing provenance remains intact.

1. Discover the `mcp__yt_dlp__*` tools in the current session. Use `ytdlp_get_video_metadata` with the supplied single-video URL and fields such as `id`, `title`, `channel`, and `duration` to confirm the recording. Do not download the surrounding playlist.
2. For this audio reader, call `ytdlp_download_audio` with `{ "url": "SUPPLIED_VIDEO_URL" }`. Use `ytdlp_download_video` only when the video visuals are also needed. Both normally save to Downloads; use the actual returned filename/path instead of guessing it.
3. Probe the downloaded file and preserve it. Audio extraction may return M4A or MP3. Copy an existing MP3 to the chapter master path, or convert other formats to MP3 with FFmpeg before alignment. Record the URL/video ID, returned source file, conversion command if used, and resulting master SHA-256. Replacing a master requires invalidating its cached timings.
4. Optional subtitle anchors: inspect `ytdlp_list_subtitle_languages`, then use `ytdlp_download_video_subtitles` for timestamped VTT. `ytdlp_download_transcript` deliberately strips timestamps and is not a timing source. Subtitles, especially automatic captions, do not replace authoritative Sanskrit or verified word alignment.
5. Continue the transcription, line alignment, clip generation, and tests below. The full recording is downloaded once during preparation; visitors still fetch only individual shloka clips.

If the MCP is unavailable or the download fails, record the actual error and use another available authorized method or the supplied local file. Ask for a recording only when acquisition is genuinely blocked; do not claim downloading or timing extraction succeeded based on tool availability alone.

## 3. File layout and the current hardcoded values

Use chapter-specific paths, substituting the requested number for `N`:

| Purpose | Path / identifier |
|---|---|
| Page | `gita/N/index.html` |
| Original local MP3 | `authoring/gita/chapter-N.mp3` |
| Shloka clips | `gita/N/audio/01.mp3`, `02.mp3`, ... |
| Text and meanings | `gita/N/data.js` |
| Text global | `window.GITA_CHAPTER_N` |
| Timing data | `gita/N/timings.json` and `gita/N/timings.js` |
| Timing global | `window.GITA_CHAPTER_N_TIMINGS` |
| Clip path stored in timings | `audio/01.mp3` (relative to the chapter page) |
| Scratch/cache | a separate chapter directory, e.g. `.gita-work/chapter-N/` |
| Alignment overrides | a chapter-specific committed JSON file |
| Chapter report | `authoring/docs/gita/CHAPTER-N-RECORD.md` |

**Do not assume these paths are already configurable.** Before building the next chapter, adapt these locations explicitly:

| Existing file | Chapter-specific assumptions to address |
|---|---|
| `gita-reader.js` | `GITA_CHAPTER_3`, `GITA_CHAPTER_3_TIMINGS`, `seekerblog:gita3:meaning-language:v1`, selector labels `3.x`, and `#3-x` parsing/writing |
| Chapter HTML | title, header, subtitle, metadata, canonical URL, initial count, loaded data scripts, reciter/source credits |
| `transcribe-gita.py` | master MP3 path and shared `.gita-work/transcription.json` |
| `align-gita.py` | text/master paths, transcript/cache paths, override path |
| `build-gita-audio.py` | chapter/count constants, paths, output globals, duration assumptions |
| `test-gita-reader.cjs` | page URL, globals, 43/42 loop indices, 12 first-verse words, first gloss Arjuna/अर्जुन, cue index 3, timing JSON path |
| `preview-site.py` | serves all files; printed landing-page URL mentions Chapter 3 |
| `gita-reader.css` | shared design; any modification requires a Chapter 3 regression check |

Prefer a small explicit chapter configuration and parameterized tooling when doing the first additional chapter. A chapter-specific copy is acceptable when simpler, but preserve the existing Chapter 3 behavior. Do not use broad search-and-replace on the entire repository. Do not copy Chapter 3's speaker labels or timing overrides into another chapter.

## 4. Prepare and verify the content

1. Obtain the full Sanskrit from the selected source. Keep spelling, sandhi, line breaks, speaker announcements, and verse order consistent with the recitation.
2. Write concise Hindi and English full meanings following the chosen Gita Press exposition. Do not label editorial summaries as verbatim translations.
3. Verify ambiguous doctrinal terms in that exact commentary. Do not silently mix interpretations from different authors. In Chapter 3, checking Ramsukhdas changed the interpretation of 3.42–3.43 from Self to desire; see `scripts/GITA-TEXT.md`.
4. Prepare a bilingual gloss for every displayed token containing a character in `U+0900–U+0963`. Standalone `।` and `॥` are punctuation, not timed words.
5. Caption joined Sanskrit words as joined groups, as approved. Do not insert spaces merely to make smaller captions: doing so changes the audio token indices. Any intentional tokenization change requires rebuilt alignment and tests.
6. Keep captions short enough to read beneath the Sanskrit. A joined group may need several meanings separated with `·`. Long groups may need a short phrase.
7. Verify spelling, negation, pronouns, grammatical role, vocatives, and repeated tokens in context. A per-verse dictionary maps identical displayed tokens to the same gloss; if two occurrences need different meanings, change the data/rendering contract deliberately and test it.
8. Record source URLs and editorial decisions in documentation. Keep only compact credits in the UI.

### Inline word-meaning workflow

The reader's **Word meanings** switch is a required feature. When it is on,
each displayed Sanskrit token must have a compact Hindi or English gloss directly
under it. Do not replace this with a verse-wide word-meaning paragraph, tooltip,
or a list elsewhere on the page.

1. Keep each `sanskrit` string's existing spaces and joined compounds. They are
   the reader's display and audio-alignment tokens. Punctuation is not a token.
2. Add a `wordMeanings` object to every verse. Its keys must exactly match the
   displayed tokens and every key must contain non-empty `hi` and `en` values.
   Use ` · ` when a joined token contains multiple source words.
3. For the Ramsukhdas Hindi edition, use the bilingual word tables at
   `https://bhagwadgita.info/chapter-N/sutra-V/` when available. They match the
   Hindi verse translation used here. Keep the source's English word meanings
   separate from the site's full English verse translation.
4. Run `node authoring/scripts/import-gita-word-meanings.cjs N` after the
   chapter's Sanskrit, Hindi, and English verse fields are complete. The importer
   groups source table rows to the reader's joined display tokens and removes the
   obsolete verse-wide `wordMeaning` field.
5. Review the importer's worst-alignment report and inspect every unusually
   joined, omitted, or doctrinally sensitive term. If the source table omits a
   displayed word, add a small, explicit, reviewed supplement to the importer;
   never fill a gloss with the Sanskrit token itself or a placeholder such as
   `this word`.
6. Run the chapter validator. It rejects missing token glosses, English
   placeholders, unused map keys, and the old failure mode where Hindi meanings
   simply repeated the Sanskrit.

See [WORD-MEANINGS-SOURCE.md](WORD-MEANINGS-SOURCE.md) for the current source
and refresh command.

### Text contract

```js
window.GITA_CHAPTER_N = [
  {
    "sanskrit": "First Sanskrit line ।\nSecond Sanskrit line ॥",
    "hi": "Complete Hindi meaning",
    "en": "Complete English meaning",
    "wordMeanings": {
      "EXACT_DISPLAYED_TOKEN": {"hi": "short Hindi gloss", "en": "short English gloss"}
    }
  }
];
```

The example values are placeholders. The current Python scripts parse the JSON after the assignment's first `=`; keep the RHS strict JSON, with no comments or executable expressions inside it. Do not add a comment containing `=` before the assignment without fixing those parsers.

## 5. Transcribe only to locate the recitation

Use cached local tools when available. The verified Chapter 3 setup was:

- Python environment: `E:\Vishnu Sahasranama\.venv-align\Scripts\python.exe`.
- Packages: faster-whisper, WhisperX, PyTorch, torchaudio, transformers, NumPy.
- Cached models: faster-whisper `small`; `theainerd/Wav2Vec2-large-xlsr-hindi`.
- CPU settings: `int8` transcription with six threads; six PyTorch threads for alignment.
- `ffmpeg` and `ffprobe` on PATH.

These are machine-specific discovery hints, not runtime dependencies for the site. Check availability before use. Default system Python did not have the speech packages. Models are loaded offline; missing cache files require setup rather than pretending the analysis ran.

The successful transcription settings include:

```python
language='hi', beam_size=5, word_timestamps=True,
condition_on_previous_text=False, no_speech_threshold=None,
vad_filter=False
```

Hindi ASR is imperfect for Sanskrit chanting. It is used to estimate where passages occur, never to replace the displayed Sanskrit. Save segment and word start/end times in seconds relative to the **master** recording. Inspect for gaps, omissions, repeated words, or Latin transliteration. In Chapter 3, roughly 30-second gaps initially appeared; retranscribing those regions with silence rejection disabled recovered anchors.

If a region needs repair, transcribe that slice, add the slice offset back to all times, merge it without duplicating existing words, and sort chronologically. Re-align every affected verse. Keep the repair recipe or bounds in committed documentation/configuration; an ignored scratch script is not a sufficient handoff.

## 6. Align the authoritative Sanskrit line by line

1. Normalize only a working copy of text to match noisy ASR. Preserve the displayed text. The existing normalizer collapses selected Hindi/Sanskrit sound differences and omits punctuation/spacing for matching.
2. Use matching characters to derive rough windows for each Sanskrit line. Check that enough matches exist before interpolation. Latin-only ASR produces no Devanagari anchors and requires a reviewed window override.
3. Force-align **each line**, using the Hindi acoustic model and the original Sanskrit tokens. Whole-verse alignment matched repeated syllables in the wrong place during Chapter 3.
4. Store word text, start, end, and confidence score. Confidence is diagnostic, not a calibrated probability or proof of correct timing.
5. Check for absent timings, implausibly short/long words, backwards or overlapping cues, suspiciously low confidence, verse overlaps, and missing tails.
6. Correct the input windows and re-align affected verses. Do not resolve overlaps by simply clipping a word, spreading words evenly, or suppressing assertions.
7. Commit chapter-specific window overrides with why they were needed. Chapter 3 verse 33 used `[529.9, 538.3]` and `[538.4, 546.2]` seconds after transliterated ASR caused an overlap. Those numbers apply only to that source MP3.
8. Invalidate affected caches when audio, tokenization, transcription, windows, or models change. Current `lines-XX.json` caches are **not** keyed by source hash or input text. Use `--redo` on the current Chapter 3 script; isolate other chapters' caches.
9. Listen to the first and last syllables of every generated verse clip and review the highlighting, especially repaired/low-confidence passages. Record what was actually reviewed. If listening is unavailable, keep `reviewStatus: "machine-aligned"` and report the limitation; do not claim manual certification.

Chapter 3 commands below are real and supported, but intentionally specific to Chapter 3:

```powershell
$alignPython = 'E:\Vishnu Sahasranama\.venv-align\Scripts\python.exe'
& $alignPython scripts\transcribe-gita.py
$verseIds = 1..43
& $alignPython scripts\align-gita.py --redo @verseIds
& $alignPython scripts\build-gita-audio.py
```

Do not run these to create Chapter N until adapting the hardcoded paths/counts listed above. `--chapter` is not currently a supported flag on these scripts.

## 7. Build clips and publish timing data locally

The build uses the aligned first/last word with approximately 0.18 seconds of lead-in and 0.28 seconds of tail, bounded by neighboring verses. These are starting values, not universal requirements; listen before accepting a cut. Re-encode precise cuts with FFmpeg (`libmp3lame`, 96 kbps in Chapter 3). Avoid stream-copy cuts if they lose syllables or drift because of MP3 frame boundaries.

The existing Chapter 3 duration assertion is `8 < clip_duration < 35` seconds. It is a diagnostic for this recitation, not a universal shloka rule. Another chapter may include longer meters, repeated lines, or different pacing. Investigate outliers and document justified chapter-specific limits.

Generate the JSON and JavaScript timing files from the **same object**:

```json
{
  "version": 1,
  "chapter": 3,
  "sourceSha256": "64 lowercase hexadecimal characters",
  "method": "Describe the actual alignment process",
  "reviewStatus": "machine-aligned",
  "verses": [{
    "verse": 1,
    "audio": "audio/01.mp3",
    "sourceStart": 16.212,
    "sourceEnd": 32.929,
    "duration": 16.717,
    "words": [{"text": "अर्जुन", "start": 0.18, "end": 0.822, "score": 0.806}]
  }]
}
```

This is an abbreviated Chapter 3 example, not a complete valid manifest. Word times are relative to the **clip**; source bounds are relative to the **master**. The `.js` file assigns the complete object to `window.GITA_CHAPTER_N_TIMINGS`. Classic script loading supports `file://`; replacing it with JSON `fetch()` would break direct-file previews unless deliberately handled.

Generate outputs only inside the requested chapter folders. Keep the original MP3 intact. Ideally validate every interval before writing clips and stage outputs before replacing a complete manifest; the present builder writes clips sequentially, so a failed build can leave partial output that must not be published.

## 8. Reader integration and design review

1. Load text, timing data, then reader code in order using deferred scripts.
2. Keep audio `src` unset until the user presses Play. `preload="none"` by itself caused an eager request in Chromium when `src`/`load()` were used during initial rendering.
3. On verse selection, stop/reset the old clip. If it was playing, play the selected verse; otherwise remain paused. Update the chapter-specific hash.
4. Use actual media time for highlights and seeking. Clear old highlights in gaps. Pause stops animation updates; resume continues at the same time.
5. Keep language/caption rendering separate from audio source selection. Re-rendering text must not call `audio.load()`.
6. Include accessible button names, focus rings, native controls/checkbox semantics, and appropriate `lang` attributes for Sanskrit and meanings.
7. Check long Sanskrit groups and their captions with meanings on **and off**. `overflow:hidden` can conceal clipping even when the document has no horizontal scrollbar. Inspect element bounds and `scrollWidth` too.
8. Reuse the approved design. Override inherited generic `header`/`footer` spacing where necessary; those rules initially added large gaps to Chapter 3.
9. Keep error messages useful and retries possible. Preserve race protection against quick verse switches and pending playback promises.
10. Add the new chapter to the appropriate homepage section and sitemap, preserving unrelated changes. Verify the canonical URL and statistics rather than incrementing unrelated counts blindly.

## 9. Preview, test, and hand off

Run from the repository root. The preview server binds to loopback only:

```powershell
python scripts\preview-site.py --port 43128
```

Run it in a separate terminal/process, then run checks in another. If the port is occupied, inspect/reuse the correct server or choose another port. Do not kill an unrelated process. The earlier port 8765 was blocked by Windows.

The plain Python `http.server` did not support byte-range seeking in this setup: Chromium reported `seekable = [[0,0]]` and seeking jumped to zero. Use the provided range-aware preview or a production-like static host. A range request should return `206`, `Content-Range`, and the requested byte count.

```powershell
# Generic data validation: supply the actual verified verse count.
node scripts\validate-gita-chapter.cjs 3 43

# Reader browser regression suite. It checks Chapter 3 in depth and every
# configured chapter's inline word-meaning toggle. Update its chapter list when
# adding a chapter.
$env:PLAYWRIGHT_PACKAGE = 'C:\Users\gaura\AppData\Local\Programs\Python\Python314\Lib\site-packages\playwright\driver\package'
node scripts\test-gita-reader.cjs http://127.0.0.1:43128/gita/3/

# Check direct-file loading too.
node scripts\test-gita-reader.cjs file:///E:/gauravw.com/seekerblog/gita/3/
```

`PLAYWRIGHT_PACKAGE` is only needed for that machine's existing installation; omit it if `playwright` resolves normally. Browser binaries were already installed. A new machine may need a different setup. Do not hardcode these personal paths into website runtime code.

Apply the full [test matrix](TEST-CASES.md), recording PASS/FAIL/NOT RUN honestly. Existing tests for Chapter 3 are not automatically valid for another chapter until adapted. Run Chapter 3 regression tests if shared assets change. Do not rebuild audio for a pure caption/style change when tokens and timing indices remain identical.

For a new chapter, also confirm in the local preview that the Word meanings
switch is initially available, hides every inline gloss when off, and restores a
meaning directly beneath every displayed Sanskrit token when on. Check at least
the first, a middle, and the final verse in both Hindi and English.

## 10. Audit and repair word markings across all chapters

Run these commands from the repository root. The audit defaults to all 18
chapters and checks all 700 verses / 6,545 canonical word occurrences. Supply a
working FFmpeg path for full MP3 decoding:

```powershell
python authoring/scripts/audit-gita-timings.py --decode 'E:\Vishnu Sahasranama\bin\ffmpeg.exe' --output .gita-work/timing-audit.json
node authoring/scripts/test-gita-highlights.cjs
python authoring/scripts/test-repair-gita-timings.py
python authoring/scripts/test-gita-context.py
```

The JSON report includes source hashes, zero-duration cues, short cues, low
acoustic scores, long gaps, and transcript evidence extending beyond a cut.
`transcriptSeamsChecked` records actual evidence coverage; zero suspect cuts with
zero coverage is not a verified result. Flags are listening candidates: short
particles and pauses can be correct, and acoustic scores are not probabilities.

For a source with compatible cached evidence and installed local models,
`repair-gita-context.py` aligns canonical Sanskrit with the previous and next
spoken lines. This addresses truncated compounds such as 18.68, where aligning
the ending without the next verse could place the next verse's first word too
early. Raw acoustic results are cached by recording, text/window, and model.
Derived output fingerprints also include the repair scripts. The script never
calls a cloud API, changes the master, or publishes the website.

```powershell
$alignmentPython = 'E:\Vishnu Sahasranama\.venv-align\Scripts\python.exe'
& $alignmentPython authoring/scripts/repair-gita-context.py --ffmpeg 'E:\Vishnu Sahasranama\bin\ffmpeg.exe'
python authoring/scripts/audit-gita-timings.py --candidate context-repair --decode 'E:\Vishnu Sahasranama\bin\ffmpeg.exe' --output .gita-work/context-audit.json
```

Candidates are staged under `.gita-work/chapter-N/context-repair/`. Disputed
cuts stop that chapter's promotion; inspect its `report.json` and cached acoustic
results before changing a window. Zero-score boundary alignments and collapsed
compounds cannot justify moving a cut. Established source-supported overrides
are preserved. If local ASR omits a chanted line, the script may retain its rough
search window from the current source-hashed manifest; those lines remain
explicitly flagged and do not count as independent transcript verification.
After the acoustic pass completes and before promotion, `--cached-only` rebuilds from the saved
results without loading an alignment model and refuses any missing evidence.

Preview staged candidates and review flagged passages against the master. Once
the complete candidate audit and the appropriate reader checks pass, promote
the selected chapters locally:

```powershell
& $alignmentPython authoring/scripts/repair-gita-context.py --promote --audit .gita-work/context-audit.json
python authoring/scripts/version-gita-reader-assets.py
python authoring/scripts/version-gita-reader-assets.py --check
```

Promotion checks every candidate, original manifest, source recording, and
decoded MP3 hash before replacing any live asset. Original changed files remain
under `.gita-work/pre-context-repair/`. Keep this ignored backup and the audit
with the local authoring workspace. Use `--chapters` on the repair and audit
commands to restrict a later repair to specific chapters. Manifests remain
`machine-aligned` until a documented human listening review supports a stronger
status. Publication remains a separate action.

Refresh asset versions after changing shared reader CSS/JavaScript or chapter
timings. Chapter HTML uses content hashes for those files; the player versions
audio URLs with the alignment fingerprint. This prevents a browser's older
clips or highlight code from being mixed with newly repaired timings.

Finish by opening the local preview, writing the chapter report, and reporting the completed files, tests, source decisions, and remaining listening-review limitations. Publishing/deployment is a separate action unless the user requested it.
