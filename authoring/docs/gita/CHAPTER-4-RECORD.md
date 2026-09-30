# Chapter 4 record

Implemented 2026-09-30: 42 verses, *Jnana Karma Sannyasa Yoga*. Sanskrit and Hindi full meanings were taken from the Swami Ramsukhdas records in the public Vedic Scriptures mirror; the selected edition is Gita Press *Sadhak-Sanjivani*. English is an editorial reader rendering of that Hindi, written after the machine translation misnamed the speaker and garbled several verses. No ISKCON content was used.

- Recording: https://youtu.be/zxPOm0Yt1lo (Rajshri Soul; metadata about 703 s).
- yt-dlp saved Opus/WebM; original preserved under `.gita-work/downloads/`. Master conversion: `ffmpeg -i <webm> -vn -map_metadata -1 -codec:a libmp3lame -b:a 128k authoring/gita/chapter-4.mp3`.
- Master SHA-256: `c51f71a20d1c38fc22b808cb479fc3997183e04a72b71b8b7931b9fb8248a37e`. Duration about 702.12 s.
- The opening invocation (about 17 s) and the closing material after verse 42 (about 50 s) are outside the shloka clips. Speaker announcements that belong to the verse text are included.
- Hindi for 4.13 used the parallel wording of 4.14: the mirror’s `रमेश्वर` was corrected to `परमेश्वर`.
- Separate Chapter 4 transcription, line force-alignment, and clip build produced 42 clips and clip-relative cues. A few single-syllable cues are only a few hundredths of a second. Status: **machine-aligned**; no full manual listening audit claimed.
- Automated: `node authoring/scripts/validate-gita-chapter.cjs 4 42` PASS; Chapter 3 structural regression PASS.
- Local preview: http://127.0.0.1:43128/gita/4/ — verse 4.1 played (`audio/01.mp3`, duration 17.993 s) and the English meaning rendered. The chapter index lists this chapter.

Remaining: full manual listening/highlight review and the complete browser/visual matrix were not certified in this run.
