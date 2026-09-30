# Chapter 8 record

Implemented 2026-09-30: 28 verses, *Akshara Brahma Yoga* (अक्षरब्रह्मयोग). Sanskrit and Hindi use the Swami Ramsukhdas records in the public Vedic Scriptures mirror; the selected edition is Gita Press *Sadhak-Sanjivani*. English is an editorial reader rendering of that Hindi. No ISKCON text is used.

- Recording: [Rajshri Soul, Bhagavad Gita Chapter 8](https://youtu.be/0iVFmPJMucg); metadata duration 478 s.
- Source audio was downloaded as M4A, preserved at `.gita-work/downloads/chapter-8-source.m4a`, and converted to `authoring/gita/chapter-8.mp3` with `ffmpeg -vn -map_metadata -1 -codec:a libmp3lame -b:a 128k`.
- Master: MP3, 44.1 kHz, 477.565 s; SHA-256 `862f329c2e0891f923752ed548e6bbeeebdfc4e28e80342e4d3c6dea297ea747`.
- Text was prepared with `python authoring/scripts/prepare-gita-chapter-data.py 8`; bilingual token glosses were imported from the chapter 8 tables at `bhagwadgita.info`. Worst importer alignment: 8.19 = 0.167.
- Local faster-whisper transcription and cached WhisperX Hindi alignment wrote chapter-specific scratch files under `.gita-work/chapter-8/`; `build-gita-audio.py --chapter 8` generated 28 clips and matching JSON/JS timing manifests. Status: **machine-aligned**.
- `node authoring/scripts/validate-gita-chapter.cjs 8 28` passed: 28 verses and 275 word occurrences, source hash, clips, token order, cue bounds, manifest parity, and bilingual word meanings.
- The local range-aware preview returned `206` and 1,024 requested bytes for `audio/01.mp3`; focused Playwright DOM coverage passed the 28 selector options and all required glosses. Full manual listening/highlight review remains outstanding.
