# Chapter 7 record

Implemented 2026-09-30: 30 verses, *Jnana Vijnana Yoga* (ज्ञानविज्ञानयोग). The Vedic Scriptures mirror’s next record, 7.31, is the chapter colophon, not another shloka, so the traditional count of 30 is the verse count used here. Sanskrit and Hindi are from the Swami Ramsukhdas records in that mirror; the edition is Gita Press *Sadhak-Sanjivani*. English is an editorial reader rendering of that Hindi. The mirror’s machine English was not kept. No ISKCON content was used.

- Recording: https://youtu.be/wMibhSYzB3k (Rajshri Soul, “Bhagavad Gita Chapter 7 - With Lyrics”; metadata 503 s).
- yt-dlp saved Opus/WebM at `.gita-work/downloads/chapter-7-source.webm`. Master conversion: `ffmpeg -i <webm> -vn -map_metadata -1 -codec:a libmp3lame -b:a 128k authoring/gita/chapter-7.mp3`.
- Master SHA-256: `e2c5441cdde205d92d1e96089157f58595d2e5c17b0f6f8e363ee4038cb4e8a8`. Duration 502.82 s.
- The chapter announcement before the first spoken word (about 18.4 s) and the colophon after verse 30 (from about 456 s) are outside the shloka clips. Speaker announcements that belong to the verse text are included.
- Hindi corrections from the mirror: 7.11 `मनुषयों` to `मनुष्यों`; 7.15 stray `९` removed; 7.16 `अर्जुनव` to `अर्जुन`. The mirror repeats one combined paragraph for 7.4 and 7.5; each verse now keeps the sentence that explains that verse.
- For 7.12, the Ramsukhdas full meaning says the gunas are not in the Lord and the Lord is not in them. The word table instead glosses the conventional “not in them / they are in Me.” The full meaning follows Ramsukhdas; the inline glosses follow the word table.
- The source table omits `च` inside `चाहं` and glosses that `अहम्` as `अस्मि`. The importer’s reviewed gloss is `और · मैं हूँ` / `and · I am`.
- Word glosses otherwise come from https://bhagwadgita.info/chapter-7/sutra-V/. After splitting repeated source cells, the worst average alignment was 7.4 at 0.202, from sandhi on the joined opening compound.
- Separate Chapter 7 transcription, line force-alignment, and clip build produced 30 clips and clip-relative cues. Verse 7.20’s mean confidence is about 0.43. Status: **machine-aligned**; no full manual listening audit claimed.
- Automated: `node authoring/scripts/validate-gita-chapter.cjs 7 30` PASS. `node --check` on the reader and the reader test PASS. `git diff --check` reported no whitespace errors.
- Local preview: http://127.0.0.1:43128/gita/7/ — verses 7.1, 7.15, and 7.30 in Hindi and English each showed a non-empty gloss under every Sanskrit token. Turning the switch off hid every gloss without changing the token count; turning it on restored a gloss under each token.

Remaining: full manual listening/highlight review. The packaged Playwright regression stops at Chapter 3 because Escape does not leave fullscreen in this headless browser. A separate headless loop of the inline-gloss checks passed for Chapters 1, 2, 4, 5, 6, and 7.
