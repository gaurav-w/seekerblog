# Chapter 5 record

Implemented 2026-09-30: 29 verses, *Karma Sannyasa Yoga*. Sanskrit and Hindi full meanings were taken from the Swami Ramsukhdas records in the public Vedic Scriptures mirror; the selected edition is Gita Press *Sadhak-Sanjivani*. English is an editorial reader rendering of that Hindi. No ISKCON content was used.

- Recording: https://youtu.be/CKM3EDGoBUE (Rajshri Soul; metadata about 518 s).
- yt-dlp saved Opus/WebM; original preserved under `.gita-work/downloads/`. Master conversion: `ffmpeg -i <webm> -vn -map_metadata -1 -codec:a libmp3lame -b:a 128k authoring/gita/chapter-5.mp3`.
- Master SHA-256: `9d9b2c6ec17d66be86945142f179c88d287d203a95c556b2381236cf3b3a178a`. Duration about 517.12 s.
- The opening invocation (about 17 s) and the closing material after verse 29 (about 50 s) are outside the shloka clips. Speaker announcements that belong to the verse text are included.
- Hindi for 5.16: the mirror’s `विवक` was corrected to `विवेक`, matching the commentary’s own explanation.
- Separate Chapter 5 transcription, line force-alignment, and clip build produced 29 clips and clip-relative cues. A few single-syllable cues are only a few hundredths of a second. Status: **machine-aligned**; no full manual listening audit claimed.
- Automated: `node authoring/scripts/validate-gita-chapter.cjs 5 29` PASS; Chapter 3 structural regression PASS.
- Local preview: http://127.0.0.1:43128/gita/5/ — verse 5.1 played (`audio/01.mp3`, duration 17.042 s) with the Hindi meaning. The chapter index lists this chapter.
- Repair update, 2026-10-01: source-window alignment and selective rebuild repaired the 5.16/5.17 boundary, 5.26's first-line markers, and 5.29's ending. Clips 16, 17, 26, and 29 plus matching manifest entries were regenerated. The last recovered 5.29 cue ends at master 467.759 s and the clip ends at 468.039 s, before the closing colophon. Status remains **machine-aligned**.

Remaining: full manual listening/highlight review and the complete browser/visual matrix were not certified in this run.
