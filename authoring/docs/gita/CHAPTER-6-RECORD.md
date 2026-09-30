# Chapter 6 record

Implemented 2026-09-30: 47 verses, *Atma Samyama Yoga* (आत्मसंयमयोग). The Vedic Scriptures mirror’s next record, 6.48, is the chapter colophon, not another shloka, so the traditional count of 47 is the verse count used here. Sanskrit and Hindi are from the Swami Ramsukhdas records in that mirror; the edition is Gita Press *Sadhak-Sanjivani*. English is an editorial reader rendering of that Hindi. The mirror’s machine English was not kept. No ISKCON content was used.

- Recording: https://youtu.be/BQ-EfSp0MRI (Rajshri Soul, “Bhagavad Gita Chapter 6 - With Lyrics”; metadata 797 s).
- yt-dlp saved Opus/WebM at `.gita-work/downloads/chapter-6-source.webm`. Master conversion: `ffmpeg -i <webm> -vn -map_metadata -1 -codec:a libmp3lame -b:a 128k authoring/gita/chapter-6.mp3`.
- Master SHA-256: `4a5fbc05290c3389b108126611d991989e26446e36100d2a968dc78c2566ba1d`. Duration 797.43 s.
- The opening before the first spoken word (about 5.5 s) and the colophon after verse 47 (from about 748.6 s) are outside the shloka clips. Speaker announcements that belong to the verse text are included.
- Hindi for 6.29: the mirror’s `योगा` was corrected to `योगी`.
- Word glosses come from the bilingual tables at https://bhagwadgita.info/chapter-6/sutra-V/. Repeated source cells such as `यतः यतः` are split before alignment. After that repair, the worst average alignment was 6.5 at 0.319, from sandhi on joined tokens whose glosses still match the source rows.
- Separate Chapter 6 transcription, line force-alignment, and clip build produced 47 clips and clip-relative cues. Verse 6.21’s mean confidence is about 0.36, and the cue for `न` is only a few hundredths of a second. Status: **machine-aligned**; no full manual listening audit claimed.
- Automated: `node authoring/scripts/validate-gita-chapter.cjs 6 47` PASS. `node --check` on the reader and the reader test PASS. `git diff --check` reported no whitespace errors.
- Local preview: http://127.0.0.1:43128/gita/6/ — verses 6.1, 6.24, and 6.47 in Hindi and English each showed a non-empty gloss under every Sanskrit token. Turning the switch off hid every gloss and left the verse in place; turning it on restored them. Verse 6.1 played `audio/01.mp3` (time advanced past 0.9 s).

Remaining: full manual listening/highlight review. The packaged Playwright regression reaches Chapter 3 fullscreen entry, then Escape does not leave fullscreen in this headless browser, so that suite stops before the later chapters. A separate headless loop of the inline-gloss checks passed for Chapters 1, 2, 4, 5, 6, and 7.
