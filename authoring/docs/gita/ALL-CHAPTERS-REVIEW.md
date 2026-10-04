# All-Chapter Gita Reader Review

**Historical baseline:** The 2 October 2026 Groq transcription and timing rebuild is documented in [GROQ-TIMING-REPAIR-REPORT.md](GROQ-TIMING-REPAIR-REPORT.md). The inventory and review queue below describe the earlier manifests; consult that report for current timing metrics. Previously source-supported repairs are preserved in the rebuild.

**Review date:** 1 October 2026  
**Scope:** Chapters 1–18, local verse data, timing manifests, verse MP3s, cached speech-recognition transcripts, and the shared playback code.

## Result and limits

All 18 chapters are present. Their 700 verses have 700 referenced audio clips and 6,545 word cues; the expected Sanskrit token sequence and referenced files are present, and the audio source hashes match the manifests. Every manifest still correctly says `machine-aligned`.

This workspace contains no rendered chapter video. The review is of the audio reader and its audio, not visuals, edits, or on-screen markers in a video export. It is a machine-assisted timing audit, not a human listening certification. Chapters 1–2 and 4–18 have cached transcripts; Chapter 3's transcript cache is absent. Speech recognition on Sanskrit is noisy, so it helps find places to listen but cannot establish exact syllable timing.

## Repairs completed after this audit

- The shared reader now keeps a marker through a normal pause of up to 180 ms, without masking longer cue gaps; reports audio loading visibly; reports completion at the final verse; and uses a dedicated fullscreen root class. The fullscreen button can no longer collapse the page to its 2.5 rem control width. Overflowing fullscreen text starts at a reachable scroll position.
- Chapter 5 clips and cues were rebuilt for 5.16, 5.17, 5.26, and 5.29. The 5.16/5.17 boundary no longer assigns the opening of 5.17 to 5.16; 5.26's first line has cues across the former 4.601-second voiced gap; and 5.29 includes the final sound through master 467.759 s plus a short tail, ending before the colophon.
- Chapter 14.27 was rebuilt through master 466.72 s before the colophon, restoring the final phrase that had been cut from the prior clip.
- Final verse clips were rebuilt from transcript-anchored cues for 1.47, 4.42, 8.28, and 12.20. Their new source cuts are 805.520 s, 652.890 s, 430.920 s, and 355.540 s respectively; each cut is before the detected colophon. These replace four of the six final-verse candidates listed below.

The rebuilt manifests remain `machine-aligned`. The remaining rows below are a listening queue, including final-verse checks that have not had a source-supported repair.

The Chapter 5 report has detailed evidence and a verse-by-verse queue: [CHAPTER-5-REVIEW.md](CHAPTER-5-REVIEW.md).

## Findings that apply to all chapters

- **Markers disappear whenever a cue interval is missing.** The reader highlights only a word whose cue contains the current playback time. A wrong or missing cue therefore creates an unmarked stretch during speech. The inventory below identifies the longest stretch in each chapter; these are review candidates, not claims that every gap contains speech.
- **Short cues can flash.** 488 cues are shorter than 120 ms, the same duration as the word highlight's CSS transition. This can make the marker hard to see. Short Sanskrit particles can be legitimate, so duration is a listening flag rather than a rule for lengthening cues.
- **A confidence score does not certify timing.** 754 cues have an alignment score below 0.5. A high score also cannot prove that a cue is at the right syllable. Chapters 13, 14, 17, and 18 deserve extra attention because of their larger low-score counts.
- **Fourteen clips end exactly at their last cue.** That leaves no buffer for alignment error or a sustained final sound. The verse numbers are listed below. The other clips generally have a 280 ms tail, but Chapter 5 demonstrates that this fixed margin can still cut off voice.
- **Early chapter clips reuse a small portion of the same source audio.** Chapters 1–7 have 298 adjacent source-range overlaps of up to 145 ms. The overlap is caused by clip head and tail padding; it does not by itself prove repeated speech during playback. Review the boundaries before changing them.
- **The shared fullscreen style has a class collision.** `gita-fullscreen` is applied to both the fullscreen button and the root `<html>`. Its unscoped button sizing rules also make the root 2.5 rem wide when fullscreen is active. This is shared by all 18 chapter pages.
- **Playback feedback is thin.** While a clip is loading, the button changes to “Pause” without a visible waiting message. At the end of the last verse there is no localized chapter-complete message. Both behaviors come from the shared reader.
- **Long verse lines need visual review.** Chapter 5 reproduced a long Sanskrit group wrapping into an orphaned syllable on a small screen; the shared styling means other long compounds should be checked as well. Fullscreen overflow also needs safe top alignment and scroll-reachability review after the root-class collision is fixed.

## Chapter-by-chapter review queue

`Short` counts cues under 120 ms. `Low` counts scores below 0.5. `Largest gap` is the longest interval between neighboring word cues in that chapter; a transcript fragment overlapping the interval is a reason to listen, not proof that the marker is wrong. `No-tail verses` have a final cue ending at the clip boundary.

| Chapter | Verses | Short | Low | Largest cue gap | No-tail verses | First review targets |
|---:|---:|---:|---:|---|---|---|
| 1 | 47 | 30 | 42 | 8.67 s · 1.23 | 25 | 23 (8.67 s), 34; final 47 |
| 2 | 72 | 50 | 80 | 7.84 s · 2.1 | 27, 30 | 1 (7.84 s), 17 |
| 3 | 43 | 30 | 25 | 4.81 s · 3.11 | — | 11, 39; obtain transcript before acoustic review |
| 4 | 42 | 21 | 29 | 3.94 s · 4.33 | 29 | 33, 25; final 42 |
| 5 | 29 | 23 | 25 | 4.60 s · 5.26 | 8, 9 | 16–17 seam, 26, 15; final 29 |
| 6 | 47 | 29 | 30 | 14.10 s · 6.1 | — | 1 (chapter introduction and speaker line), 15, 22 |
| 7 | 30 | 19 | 27 | 5.50 s · 7.20 | — | 20, 13, 1 |
| 8 | 28 | 16 | 16 | 2.13 s · 8.22 | — | 22; final 28 |
| 9 | 34 | 25 | 39 | 14.53 s · 9.20 | 20 | 20, 15, 34 |
| 10 | 42 | 19 | 35 | 5.58 s · 10.15 | 26, 37 | 15 (transcript is noisy), 10 |
| 11 | 55 | 47 | 64 | 2.61 s · 11.47 | — | 47, 50; broad short/low-cue pass |
| 12 | 20 | 20 | 27 | 3.96 s · 12.20 | — | 20, especially its final phrase |
| 13 | 34 | 25 | 63 | 8.97 s · 13.1 | — | 1 (chapter introduction), 2, 18 |
| 14 | 27 | 26 | 89 | 8.13 s · 14.10 | — | 10, 17; final 27 is highest priority |
| 15 | 20 | 13 | 19 | 9.46 s · 15.1 | — | 1 (chapter title/speaker boundary), 11; final 20 |
| 16 | 24 | 12 | 13 | 2.52 s · 16.24 | — | 24, 19 |
| 17 | 28 | 23 | 54 | 6.85 s · 17.19 | 22, 26 | 19, 24, 25; transcript is noisy |
| 18 | 78 | 60 | 77 | 4.26 s · 18.20 | 24, 52, 53 | 20, 63, 23, 25; broad short/low-cue pass |

Opening gaps in Chapters 6, 13, and 15 overlap chapter titles or speaker introductions in the master recording. Separate those non-verse introductions from the verse before moving cues; otherwise a repair could put a verse marker over unrelated narration. Other candidate gaps with recognizable transcript fragments include 1.23/1.34, 2.1/2.17, 4.25/4.33, 7.13/7.20, 10.10, 11.47/11.50, 12.3/12.20, 14.10/14.17, and 16.19/16.24. Verify each against the audio before changing it.

## Final-verse checks

The build adds 280 ms after each final aligned cue, then cuts the verse clip. That fixed tail is not enough evidence that the recording has finished the syllable. Cached ASR places the following final words beyond their current clip boundaries in these cases:

| Chapter | Final verse | Current cut | Evidence to review |
|---:|---:|---:|---|
| 1 | 47 | Repaired: 805.52 s | Final cue restored through 805.24 s; colophon starts about 806.68 s. |
| 4 | 42 | Repaired: 652.89 s | Final `भारत` restored to 652.88 s; clip is capped just before the 652.90 s colophon. |
| 5 | 29 | Repaired: 468.04 s | Voice-band energy and ASR-supported final sound are included; detailed findings are in the Chapter 5 report. |
| 8 | 28 | Repaired: 430.92 s | Final `चाद्यम्` restored to 430.90 s; clip stops before the 430.94 s colophon. |
| 12 | 20 | Repaired: 355.54 s | Final `प्रियाः` restored through 355.26 s; colophon starts about 356.84 s. |
| 14 | 27 | Repaired: 467.00 s | Final phrase restored through 466.72 s before the colophon. |

The completed repairs are source-supported timing corrections, not word-perfect ASR measurements or human listening certification. Chapters 15.20 and 18.78 still merit a final-syllable check because their last-word scores/timing deserve review. Do not include the following `ॐ तत्सत्` colophon in a verse clip unless that is a deliberate product decision.

## Recommended correction order

1. Listen to the final verses in Chapters 14, 12, 8, 5, 4, and 1; restore any missing final speech and keep the colophon boundary deliberate.
2. Listen to each chapter's largest cue gap, then the additional candidates above. Correct the source word windows first and rebuild only the affected clip and manifest; do not stretch a cue to cover a gap unless the audio supports that word.
3. Review the no-tail verses and the early-chapter clip boundaries. Choose cuts in real quiet after the last syllable; don't let an uncertain next verse cue dictate the previous clip's end.
4. Fix the shared fullscreen class collision, use safe alignment for overflowing verse text, shorten/remove the highlight transition for very short cues, and provide visible loading and chapter-complete states.
5. After each repair, check first/last words and the affected cue while listening, then repeat the full chapter review before changing its status from `machine-aligned` to a human-reviewed state.

## Lessons for future chapters

- Keep **structure**, **acoustic timing**, and **reading quality** as separate review results. Correct token counts, valid MP3s, and passing cue midpoints establish structure, not correct speech timing.
- Use speech recognition and waveform analysis to make a **human listening queue**. Treat scores, short intervals, silent gaps, and energy thresholds as flags, not automatic edits.
- Align the chapter introduction, speaker tag, verse, and closing colophon as separate regions. Their transcript text often explains long gaps at chapter starts and ends.
- Before rebuilding, fingerprint every alignment input: master audio hash, exact displayed tokenization, transcript, time windows, and alignment model/settings. Invalidate a cache when any of those change.
- Record the exact listening range, device/context, and corrections. Keep `reviewStatus: "machine-aligned"` until a person has checked the words and boundaries.
