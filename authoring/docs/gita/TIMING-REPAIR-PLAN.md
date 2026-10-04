# Gita word timing repair

Prepared 2 October 2026. Scope: all 18 chapters and all 700 verses, starting with chapter 6. This document is a repair plan, not a claim that the current cues have been corrected.

## Provider and accuracy

The Vishnu Sahasranama integration is **Groq**, not xAI Grok. Its `python/tools/check_voiceover_alignment.py::transcribe_groq` uses `whisper-large-v3`, `verbose_json`, and word timestamps. The existing private `GROQ_API_KEY` can be read from that project's secrets file without copying it here. Its helper maps languages to Hindi/English and assumes WAV input, so the Gita adapter uses the same endpoint/request contract with appropriate FLAC input and configurable Hindi/Sanskrit language.

Official references: [Groq STT](https://console.groq.com/docs/speech-to-text), [Whisper Large V3 pricing](https://console.groq.com/docs/model/whisper-large-v3). Current price: $0.111 per audio hour. This is an estimate; actual provider billing and account rate limits govern execution.

STT timestamps are measurements for **recognized tokens**. They do not guarantee exact boundaries for the displayed Sanskrit. Sandhi, repeated words, merged/split tokens, chanting, and omitted phrases require canonical text alignment and acoustic checking. A timestamped transcript must never silently replace the Sanskrit text or be presented as a certified listening review.

## 1. Baseline and pilot

Offline preparation measured **11,871.84 seconds (3.298 hours)** of master audio across all 18 chapters: approximately **$0.366** for one uncached full pass. Additional slice/language comparisons add charges. The current inventory contains **700 verses / 6,545 displayed word occurrences**; **482** cues are shorter than 120 ms and **753** have acoustic scores below 0.5. These are review flags, not a count of proven mistakes. The chapter 6 inventory contains 29 short cues and 30 low-score cues, with its largest uncovered cue interval of 14.102 seconds in 6.1.

1. Fingerprint all master recordings and exact displayed Sanskrit. Preserve existing manifests, source-supported overrides, and clip provenance for comparison/rollback.
2. Transcribe the **master recording**, including its introduction and ending. Do not start from the current verse clips: a clip may already omit speech or include the next verse.
3. Pilot chapter 6 with Whisper Large V3 word and segment timestamps. Compare the Hindi configuration with Sanskrit on ambiguous passages if needed. Retain raw responses and segment quality metadata; do not average conflicting providers' timestamps.
4. Check the speaker announcement in 6.1; complete lines in 6.14, 6.15, 6.21, and 6.22; every verse seam; and the end of 6.47. Inspect **all** 47 verses, not just the previously flagged ones.
5. Establish the usable accuracy from the audio and canonical text before expanding the cloud pass. If the provider omits or repeats a phrase, retry a bounded master slice with its absolute offset, or use a local forced alignment within an independently supported window.

## 2. Canonical mapping and alignment

1. Match recognized speech to canonical verse/line order monotonically. Treat invocation, chapter title, speaker announcements, and colophon as distinct regions. Match repeated words within their own local context.
2. Normalize a working copy only. Record split/merged tokens explicitly. A group timestamp cannot justify dividing time evenly among Sanskrit words.
3. Use matched STT words to constrain acoustic forced alignment of the exact displayed Sanskrit, particularly when the recognized tokens differ. Preserve complete line windows; reject compressed lines that leave recognized speech uncovered.
4. Fingerprint alignment caches with the master hash, exact text, raw STT response, line windows, model/settings, and algorithm version. Current `lines-XX.json` files alone do not prove freshness.
5. Store raw evidence, derived canonical cues, mapping confidence, and unresolved words separately. Do not reuse an acoustic model score as an STT confidence score or manufacture scores for a direct STT cue.
6. Flag omissions/insertions, backwards cues, zero-duration words, anomalous short cues, unexpected long gaps, disputed boundaries, and speech outside the verse window. Flagged cases need a source-supported correction; a long gap alone can be legitimate silence.

## 3. Rebuild and validate all chapters

1. After the chapter 6 pilot passes, repeat transcription, canonical mapping, and acoustic verification for chapters 1–18. Review every cue, with additional attention to repeated phrases and each first/final verse.
2. Choose a single shared split in a measured quiet region between neighboring verses where possible. Preserve the complete preceding final sound and following initial sound. Do not extend a clip merely because an unreliable next cue starts later.
3. Rebuild affected MP3s from the original master. Update `timings.json` and `timings.js` together. Ensure cue coordinates are relative to the rebuilt clip, including any measured decoder/encoder offset. Exclude invocations/titles/colophons from verse clips; include authored speaker announcements.
4. Stage candidate clips/manifests outside `gita/` first. Validate expected verse/token counts, hashes, JS/JSON equality, actual decoded durations, monotonic cue order, complete word coverage, and absence of neighboring spoken material at cuts. A structural pass alone is not acoustic certification.
5. Compare candidate vs current highlights in a real browser through playback and seeking. Check full lines, transitions between verses, short words, and final sounds. Record precise audio ranges and actual review method.
6. Promote complete validated chapter candidates together, retaining established repairs unless new evidence improves them. Keep `machine-aligned` status until a real human listening audit supports a stronger claim. Publishing is a separate step.

## Prepared tooling

`authoring/scripts/groq-gita-timings.py` performs offline duration/hash/cost preparation by default. Its explicitly selected `--transcribe` mode caches raw Groq responses under ignored `.gita-work/chapter-N/groq/`. It does **not** change live clips/cues or pretend that transcript recognition is canonical alignment.

Example offline preparation in the current environment:

```powershell
$alignmentPython = 'E:\Vishnu Sahasranama\.venv-align\Scripts\python.exe'
& $alignmentPython authoring/scripts/groq-gita-timings.py --chapters 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 --ffprobe 'E:\Vishnu Sahasranama\bin\ffprobe.exe'
```

For cloud execution, add `--transcribe`, a concrete `--max-cost-usd`, `--ffmpeg 'E:\Vishnu Sahasranama\bin\ffmpeg.exe'`, and `--secrets-file 'E:\Vishnu Sahasranama\secrets.json'`. Resolve current user authorization before making the paid/upload request. No key value belongs in commands, logs, source control, browser assets, or this document.

The adapter preserves source time by resampling the whole master to mono 16 kHz FLAC without removing silence. It checks the upload size, validates response timestamps, fingerprints cache inputs, handles bounded rate-limit retries, and stops on failed/missing evidence. A cost ceiling covers estimated uncached audio charges; ambiguous timeout failures stop rather than trigger potentially duplicated paid requests.

## Current execution state

The user explicitly authorized Groq STT uploads and charges on 2 October 2026. All 18 original recordings have now been transcribed with Whisper Large V3. Short Hindi/Sanskrit excerpts recover omitted or disputed phrases; raw responses, quarantined timestamps, canonical mapping decisions, and acoustic results remain in the ignored `.gita-work/` cache. The adapter never stores the API key in these files.

Candidates are staged before promotion. The final execution and validation results are recorded in `GROQ-TIMING-REPAIR-REPORT.md`. The manifests retain `machine-aligned` status: automatic STT and a Hindi acoustic model do not certify exact Sanskrit word or syllable boundaries. The mobile fullscreen work remains planning only.
