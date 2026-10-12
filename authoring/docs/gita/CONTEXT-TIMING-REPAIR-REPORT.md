# Gita word-marking repair — 10 October 2026

Completed locally across all **18 chapters, 700 verses and 6,545 canonical word occurrences**. Updated 4,496 word intervals by more than 50 ms in source coordinates and rebuilt **304 MP3 clips** from the unchanged masters. Published deployment was not performed. All manifests remain **machine-aligned**; this is not a human listening certification.

## Why 18.67 and 18.68 lost markings

The shared reader used word boundaries for active cues but a phrase's `highlightEnd` for the short visual hold. Short particles therefore lost their marker during small gaps, and the hold depended on playback history. A 120 ms CSS fade-in also outlasted some short words. The reader now uses consistent word bounds, immediate activation, a maximum 180 ms wall-time hold capped by the next cue, and deterministic selection when seeking. Overlapping cue ends no longer make the marker jump back to an older word. Real pauses and completed audio clear the marker.

18.68 also had a source-cut error. Its former 11.561-second clip stopped partway through **मामेवैष्यत्यसंशयः**, leaving the remainder at the beginning of 18.69. A previous reconciliation accepted a zero-score next-word cue simply because the intervals stopped overlapping. The repaired 18.68 is **14.242 seconds**, with its full final compound at clip 10.830–13.452 seconds; the shared 18.68/18.69 cut moved from master **959.005 to 961.686 seconds**. The following verse begins with its own न cue. Canonical Sanskrit and meanings are unchanged.

## Repair and verification

Every verse was aligned using neighboring spoken lines and exact canonical tokens. Compatible cached Groq evidence was reused only for its original recording; no cloud requests or charges were made. Chapter 14's replacement Rajshri Soul master received fresh, source-hashed local ASR. Omitted ASR lines retain explicitly flagged rough search windows from that same recording. Those windows are not independent transcript verification.

Boundary reconciliation rejects missing or zero-duration words, zero/weak boundary scores, collapsed long words, and severe compression of stronger long-token evidence. A failed inner-word alignment retains its established cue rather than accepting a new zero-score cue. Source-supported overrides remain in place. Cuts with usable evidence on both sides can move into a sustained quiet region; 46 additional seams were recentered to protect the word tail. Disputed cuts block promotion.

| Diagnostic | Before | After |
|---|---:|---:|
| Zero-duration cues | 1 | 0 |
| Zero acoustic scores | 101 | 14 |
| Acoustic scores below 0.5 | 557 | 212 |
| Cues under 120 ms | 548 | 421 |
| Transcript extends over 350 ms past a cut | 36 | 22 |
| Cuts with under 80 ms cue margin | 250 | 89 |
| Gaps over 600 ms | 1035 | 1290 |

These are diagnostic counts, not accuracy percentages or confirmed-error totals. Transcript seam coverage increased from 656 to 676 of 682 internal chapter seams. More precise word ends can expose legitimate breaths, so long-gap counts can increase. The audit also records **1,162 cues moving over 750 ms** for focused listening review.

All 18 chapter validators passed. All **700 MP3s were decoded** and checked for actual duration and cue bounds. All master hashes, token order/counts, JSON/JavaScript equality, and candidate fingerprints passed. After promotion, hashes of all 700 live MP3s and all 18 manifests matched the decoded audit. The production cue selector passed checks for all 6,545 cue midpoints and gaps at 0.85×, 1×, 1.2× and 1.5×, including overlapping ends, phrase mode, independent seeks, and versioned audio URLs. The Python regression suites passed 18 cases in total.

Browser checks used the range-aware local preview: 18.67's short न was visible at 10.130 s; 18.68's final compound was active at 12.675 s, beyond the former cut; 18.69's own न was active at 0.613 s; and 14.10's previously zero-duration रजः was active at 7.643 s. Active styles had a 0-second transition. Chapter 3 passed repeat, automatic next-verse playback, pause, speed, language, and meaning-toggle checks. At chapter completion, playback stopped, the marker cleared, and the localized completion message appeared. These observations and machine transcription do not substitute for listening to all recitations.

All chapter pages now reference content-hashed CSS, reader JavaScript, and timing files. Playback and preloading use the alignment fingerprint in audio URLs. This prevents old cached clips, timings, or highlight code from being mixed after an update. Reload an already-open page to load its new references.

## Per-chapter results

`Changed cues` counts source-coordinate start/end changes greater than 50 ms. Short and low-score cues remain listening flags.

| Chapter | Verses | Changed cues | Recut clips | Short cues | Low scores |
|---:|---:|---:|---:|---:|---:|
| 1 | 47 | 301 | 18 | 31 | 9 |
| 2 | 72 | 525 | 27 | 41 | 24 |
| 3 | 43 | 285 | 22 | 20 | 8 |
| 4 | 42 | 276 | 15 | 21 | 9 |
| 5 | 29 | 164 | 10 | 23 | 6 |
| 6 | 47 | 293 | 17 | 26 | 6 |
| 7 | 30 | 216 | 10 | 15 | 12 |
| 8 | 28 | 178 | 9 | 16 | 14 |
| 9 | 34 | 235 | 14 | 19 | 6 |
| 10 | 42 | 288 | 15 | 21 | 9 |
| 11 | 55 | 385 | 21 | 32 | 23 |
| 12 | 20 | 124 | 4 | 13 | 8 |
| 13 | 34 | 191 | 23 | 24 | 19 |
| 14 | 27 | 105 | 27 | 19 | 15 |
| 15 | 20 | 134 | 7 | 12 | 3 |
| 16 | 24 | 121 | 8 | 12 | 6 |
| 17 | 28 | 174 | 14 | 16 | 8 |
| 18 | 78 | 501 | 43 | 60 | 27 |

## Remaining listening review

The complete [audit and listening queue](CONTEXT-TIMING-AUDIT.json) contains source positions, word/verse references, flag reasons, and reader paths. The [baseline](CONTEXT-TIMING-BASELINE.json) preserves the original counts. Prioritize transcript/cut disagreements, tight cuts, zero scores, and large movements; then inspect other low/short cues and gaps. Silence and naturally short particles can be correct. Acoustic scores do not certify word identity, and the Hindi model can misplace Sanskrit sounds.

The remaining zero-score occurrences are: 1.9 च, 2.4 च, 2.35 च, 5.1 च, 8.2 च, 8.28 चैव, 10.24 च, 10.26 च, 11.38 च, 13.15 च, 13.34 च, 14.27 च, 14.27 च, 17.27 च. They have positive display intervals; they were retained or source-supported rather than represented as newly verified acoustic matches. The 22 transcript/cut disagreements and 89 tight margins remain explicit review candidates. Every manifest retains `machine-aligned` status pending a complete human listening review.

## Reuse and rollback

Use the commands in [WORKFLOW.md §10](WORKFLOW.md#10-audit-and-repair-word-markings-across-all-chapters). `audit-gita-timings.py` scans all chapters by default; `repair-gita-context.py` stages repairs and supports offline cache-only rebuilds; `version-gita-reader-assets.py` refreshes and checks asset versions. Preserve `.gita-work/` for source-hashed evidence and transcript seam coverage. Without compatible evidence, the audit reports reduced coverage rather than certification.

Changed originals remain under `.gita-work/pre-context-repair/chapter-N/`. The audit and promotion check every staged hash before replacing any file. Shared reader changes and HTML asset-reference updates can also be reviewed in Git. Unrelated sitemap and Vishnu Sahasranama work was preserved.
