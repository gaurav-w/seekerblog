# Groq timing repair — 2 October 2026

All 18 chapters were transcribed from their original masters with Groq Whisper Large V3, then rebuilt against the unchanged canonical Sanskrit: **700 verse clips and 6,545 word occurrences**. The user explicitly authorized Groq uploads and charges. The final assets are applied locally after the validation recorded below; publishing is separate.

This is a machine-assisted correction, **not certification of exact Sanskrit word/syllable boundaries**. Every manifest retains `machine-aligned`. Short or low-score cues remain an explicit listening queue; replacing a timestamp and passing a browser check do not establish that the timestamp describes the correct sound.

## Corrections and evidence

- Chapter 6.1 now starts with its authored speaker announcement at master 16.18–19.78 s; the invocation previously assigned to that cue is excluded.
- Fresh excerpts recover omitted speech in 6.13–6.14 and other chapters. Matching respects canonical spelling and authored word groups; no timing is divided evenly among words.
- A recognized compound crossing a displayed line break is aligned once in its shared measured span. Neighboring verse clips use a single split in a measured low-energy region instead of duplicating source ranges.
- 2,580 one-word matches use measured Groq intervals without fabricated confidence. Merged/noisy groups use canonical acoustic alignment with the cached Hindi `theainerd/Wav2Vec2-large-xlsr-hindi` model; that model remains a source of uncertainty for Sanskrit.
- 334 earlier acoustic cues were retained where stronger, inside the new STT-supported windows and without conflicting with their neighbors. 4,449 cue occurrences have a source start or end changed by more than 50 ms.
- Existing explicit repairs for 1.47, 4.42, 5.17, 5.29, 8.28, 12.20, and 14.27 are preserved. The complete final words and quieter source cuts for 7.30, 13.34, and 18.78 are supported by bounded STT and voice-decay measurements in [groq-ending-evidence.json](groq-ending-evidence.json). Energy supports a cut/decay inference; it cannot identify a Sanskrit word.
- Raw provider responses, invalid-timestamp quarantine, exact source hashes, canonical mapping decisions, reconciliation, and prior-cue retention evidence are stored under ignored `.gita-work/chapter-N/`. No API key is in these caches or public reader files.

Chapter 6 comparison (largest internal cue gap; a gap can include real silence):

| Verse | Earlier gap s | Revised gap s |
|---|---:|---:|
| 6.1 | 14.102 | 1.252 |
| 6.13 | 2.948 | 0.281 |
| 6.14 | 3.050 | 1.404 |
| 6.15 | 5.088 | 0.392 |
| 6.21 | 3.604 | 1.467 |
| 6.22 | 4.812 | 1.868 |
| 6.47 | 1.592 | 0.700 |

## Validation

- All 18 chapter validators pass: expected verse counts, 6,545 canonical tokens, source hashes, word order, cue bounds, audio paths, and matching `timings.js`/`timings.json`.
- All 700 rebuilt MP3s pass decoded-duration checks (within 80 ms of the source interval); their final cues fit the decoded media.
- Chrome loaded all 700 staged clips and performed 2,100 native seeks (first/middle/final cue), verified rendering and highlighting, and tested ordinary playback and auto-next in all 18 chapters. No page errors occurred. This verifies player/manifest behavior, not acoustic identity.
- Twelve offline regression tests pass for transcription fingerprints, impossible/reversed timestamps, merged/split Sanskrit tokens, invocation exclusion, missing anchors, and spoken visarga.
- Candidate manifest/audio hashes are checked again before promotion. The original live timing files and MP3s are retained in ignored `.gita-work/pre-groq-repair/`.

## Remaining listening review

There are **545 cues below 120 ms**, versus 482 before this rebuild. Some are short clitics; the higher count means this pass cannot be described as having resolved all acoustic uncertainty. **569 acoustic cues have scores below 0.5**, versus 753 earlier. These counts are not a comparable confidence measurement across methods: measured Groq words deliberately have no acoustic score. Scores do not certify timing, and a long gap does not prove missing speech.

The complete candidate queue is [GROQ-TIMING-REVIEW-QUEUE.json](GROQ-TIMING-REVIEW-QUEUE.json). A full listening audit with the marker is still required for an exactness claim. Review the source ranges there, including genuinely short syllables, repeated words, line transitions, and gaps, before upgrading review status.

| Chapter | Verses | Cues | Measured Groq cues | Retained prior cues | Cues <120 ms | Acoustic score <0.5 | Largest gap s |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 47 | 413 | 158 | 18 | 34 | 34 | 3.722 |
| 2 | 72 | 685 | 302 | 35 | 54 | 54 | 3.489 |
| 3 | 43 | 381 | 166 | 13 | 27 | 20 | 2.586 |
| 4 | 42 | 378 | 162 | 21 | 24 | 23 | 2.226 |
| 5 | 29 | 260 | 85 | 18 | 24 | 22 | 2.445 |
| 6 | 47 | 420 | 171 | 25 | 32 | 26 | 2.569 |
| 7 | 30 | 292 | 128 | 19 | 25 | 20 | 2.047 |
| 8 | 28 | 275 | 104 | 12 | 19 | 23 | 1.644 |
| 9 | 34 | 329 | 153 | 24 | 21 | 14 | 3.064 |
| 10 | 42 | 393 | 173 | 12 | 29 | 33 | 2.538 |
| 11 | 55 | 639 | 229 | 37 | 50 | 52 | 4.690 |
| 12 | 20 | 185 | 67 | 11 | 18 | 19 | 2.273 |
| 13 | 34 | 283 | 98 | 15 | 34 | 40 | 2.323 |
| 14 | 27 | 239 | 96 | 9 | 19 | 53 | 3.371 |
| 15 | 20 | 187 | 71 | 9 | 16 | 14 | 3.850 |
| 16 | 24 | 194 | 64 | 4 | 16 | 12 | 2.045 |
| 17 | 28 | 252 | 86 | 7 | 25 | 30 | 2.532 |
| 18 | 78 | 740 | 267 | 45 | 78 | 80 | 4.026 |

## Usage and scope

18 complete master responses and 66 recovery excerpts are cached. 122 provider word entries were quarantined from the whole-recording responses. Estimated transcription charges are **about $0.43**, including the initially discarded Sanskrit pilot, at the documented $0.111/hour rate for [Groq Whisper Large V3](https://console.groq.com/docs/model/whisper-large-v3). This is an estimate from uploaded duration, not an account billing statement.

The mobile fullscreen changes were subsequently approved and applied locally. Their implementation and browser verification are recorded in [MOBILE-FULLSCREEN-REPAIR-REPORT.md](MOBILE-FULLSCREEN-REPAIR-REPORT.md); phone acceptance checks remain in [MOBILE-FULLSCREEN-PLAN.md](MOBILE-FULLSCREEN-PLAN.md).
