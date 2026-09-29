# Chapter acceptance tests

Run these against the requested chapter and record PASS, FAIL, or NOT RUN with evidence. Substitute its verified verse count; 43 applies only to Chapter 3. A structural pass cannot certify translation accuracy or synchronization by ear.

## Available automated checks

```powershell
# Works for any chapter following the documented data/file contract.
node scripts\validate-gita-chapter.cjs 3 43

# Safe negative check: this must fail with "Text verse count" and exit code 1.
node scripts\validate-gita-chapter.cjs 3 44

# Existing browser suite is Chapter 3-specific; adapt before using another chapter.
$env:PLAYWRIGHT_PACKAGE = 'C:\Users\gaura\AppData\Local\Programs\Python\Python314\Lib\site-packages\playwright\driver\package'
node scripts\test-gita-reader.cjs http://127.0.0.1:43128/gita/3/
node scripts\test-gita-reader.cjs file:///E:/gauravw.com/seekerblog/gita/3/
```

Start `python scripts\preview-site.py --port 43128` separately for HTTP tests. The package path is a local environment hint, not a site dependency. See [workflow](WORKFLOW.md) for setup and hardcoded assumptions.

### Data validator coverage

| ID | Check | Expected result |
|---|---|---|
| D01 | Chapter identity, schema version, expected text/timing counts | Requested chapter, version 1, exactly the verified count |
| D02 | Text and captions | Nonempty Sanskrit, Hindi, English; every displayed word group has both captions; no unused caption keys |
| D03 | Token order | Each timing word exactly matches the corresponding displayed token, including repeated occurrences; standalone danda punctuation excluded |
| D04 | Timing serialization | JavaScript and JSON manifests contain identical data |
| D05 | Recording identity | Actual master SHA-256 matches the manifest; review status exists |
| D06 | Clip references | Unique chapter-specific audio paths; each file exists and is nonempty |
| D07 | Source boundaries | Finite positive intervals, ordered nonoverlapping clips, duration matches source interval within rounding tolerance |
| D08 | Word cues | Finite, ordered, nonnegative clip-relative times; within clip duration; overlap tolerance at most 0.05 seconds; score in [0,1] |
| D09 | Wrong expected count | Validator exits 1 rather than silently accepting incomplete data |

The validator does not decode MP3s, inspect the rendered page, verify meanings, or listen to cues. A nonempty review-status field does not mean human review occurred. Do not alter real assets just to demonstrate failure cases; use a disposable fixture checkout for missing-file/gloss/hash mutation tests.

### Existing browser suite coverage

| ID | Steps | Expected result |
|---|---|---|
| B01 | Open a fresh page and monitor MP3 requests | Zero initial audio requests, 43 selector options, no iframe |
| B02 | Choose English on verse 1 | English full meaning; captions enabled; 12 captions; first caption is Arjuna |
| B03 | Play verse 1 | Media time advances; every MP3 request so far is for `01.mp3` |
| B04 | Pause, wait, resume | Time stays fixed while paused and continues from that point on resume |
| B05 | Change English to Hindi while playing | Playback continues; first caption becomes अर्जुन |
| B06 | Turn captions off and on while playing | Captions disappear/reappear without pausing playback |
| B07 | Seek to the midpoint of verse 1 cue index 3 | Displayed word index 3 is highlighted |
| B08 | Enable repeat and seek near the end | Same verse restarts and continues playing |
| B09 | Disable repeat, enable auto-next, seek near the end | Verse 2 starts playing; caption controls remain available |
| B10 | Select final verse, disable auto-next, play to end | Next is disabled; playback ends on verse 43 |
| B11 | Every verse × Hindi/English × widths 320, 390, 768, 1280 | All captions visible; displayed word count equals cue count; no page overflow or clipped words/captions (344 combinations for Chapter 3) |
| B12 | Leave English selected on final verse, reload | English persists and deep link restores verse 43 |
| B13 | Inspect timing records and captured page errors | Clip paths exist, cue bounds/order valid, no uncaught page errors |

These are the assertions actually in `scripts/test-gita-reader.cjs`. B07 checks cue-to-DOM mapping, not whether that cue matches the audible syllable. B10 does not currently test the final verse with auto-next enabled. B11 uses captions on; additional captions-off cases below remain necessary. A URL argument alone does not make this suite chapter-generic.

## Additional acceptance checks

These are review/manual checks unless separately automated and the evidence is recorded. Do not label them passed just because the browser suite passed.

| ID | Steps | Expected result |
|---|---|---|
| C01 | Compare all Sanskrit, verse order/count, and speaker labels with the selected source and recording | No missing, duplicated, or ASR-substituted text |
| C02 | Review Hindi/English full meanings and captions against the named Gita Press author | Same interpretation in both languages; no ISKCON content or mixed-author glosses; negation and pronouns preserved |
| C03 | Inspect source credits and chapter report | Traceable edition/author and URLs; editorial summaries described accurately in documentation; compact UI credits |
| C04 | When using yt-dlp MCP, compare returned metadata/path with the supplied URL; probe the file and record its hash | Correct single recording and chapter, valid audio, actual downloaded file exists; any conversion recorded; no playlist download or reuse of timings from a different master |
| A01 | Probe master and every generated clip with FFprobe; decode clips with FFmpeg | Correct codec, finite duration, no decode errors; actual durations close to manifest (allow small encoder padding, investigate larger differences) |
| A02 | Listen to beginning/end of every clip and transitions between neighbors | No chopped syllables, neighboring verse contamination, accidental invocation/colophon, or repeated/missing verse |
| A03 | Follow highlighted words through every clip; focus on repaired windows, low scores, repeated phrases, and long groups | Highlight matches recitation; silence clears stale highlight; record any approximate boundaries |
| A04 | Change source file or tokenization in an isolated fixture, rebuild with caches invalidated | New alignment and hash; no reuse of incompatible cached timings |
| U01 | At 320 and 390 px, turn captions off and visit every verse | Sanskrit remains fully visible; full meaning stays visible; no hidden clipping or horizontal scroll |
| U02 | Inspect first, longest, speaker-bearing, and final verses at mobile and desktop sizes | Captions visibly smaller than Sanskrit, readable spacing, no excessive inherited header/footer gaps |
| U03 | Navigate with keyboard through language, captions, playback, seek, repeat, auto-next, selector, previous/next | Visible focus, usable native semantics, meaningful accessible labels and language attributes |
| U04 | Next/previous/select while paused, then while playing | Paused navigation stays paused; playing navigation changes to new clip; no old highlight/audio leak; first/last boundaries correct |
| U05 | End a middle verse with repeat/auto-next off; end final verse with auto-next on; enable both repeat and auto-next | Middle stops; final stays at final; repeat takes precedence when both enabled |
| U06 | Rapidly switch verses/play-pause during pending load; simulate one clip returning 404 in browser test routing | No stale playback promise changes the new verse; understandable error; selecting a valid verse or retrying recovers |
| U07 | Open valid, missing, malformed, and out-of-range chapter hashes | Valid hash selects requested verse; invalid values safely fall back without exceptions |
| U08 | Switch language/captions repeatedly during playback and after seeking | Same clip/time continues; full and word meanings stay in selected language; highlighting still works |
| U09 | Select several verses before first Play; monitor requests | No MP3 fetched until Play; first fetch is only the selected clip |
| N01 | Inspect all media requests during navigation/repeat/auto-next | Only clips needed for playback; no request for the master MP3 or eager download of other verses |
| N02 | Request bytes 0–1023 from a clip on preview and deployment host | HTTP 206, correct Content-Range, 1024-byte response, advertised byte-range support; seek to middle succeeds |
| R01 | Repeat browser suite over HTTP and direct `file://` | Both work; no JSON-fetch/CORS regression |
| R02 | If shared reader/CSS changes, rerun Chapter 3 checks and inspect another existing reader page | Approved Chapter 3 behavior and unrelated site layout preserved |
| R03 | Inspect new homepage link, sitemap, title, canonical URL, loaded data scripts | Correct requested chapter everywhere; no copied Chapter 3 constants or unrelated edits |

Useful media commands (replace paths for the requested chapter):

```powershell
ffprobe -v error -show_entries format=duration:stream=codec_name,sample_rate -of json gita/3/audio/01.mp3
ffmpeg -v error -i gita/3/audio/01.mp3 -f null -
# These output files are disposable diagnostics in the ignored scratch directory.
New-Item -ItemType Directory -Force .gita-work | Out-Null
curl.exe --range 0-1023 --dump-header .gita-work/range-headers.txt --output .gita-work/range.bin http://127.0.0.1:43128/gita/3/audio/01.mp3
```

## Completion record

Record the date, exact commands/URLs, chapter/count/hash, tool exit results, and test IDs. Distinguish full checks from samples. Record automated checks separately from visual and listening review. For a failure, include verse, language, viewport or media time, observed behavior, and fix/retest result. For NOT RUN, give the actual limitation.

Do not call timing manually verified until A02/A03 were actually reviewed. The implementation can be structurally tested while the manifest remains `machine-aligned`; state that limitation in the handoff.
