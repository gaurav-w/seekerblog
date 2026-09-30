# Chapter 10 record

Implemented 2026-09-30: 42 verses, *Vibhuti Yoga* (विभूतियोग). Sanskrit and Hindi use the Swami Ramsukhdas records in the public Vedic Scriptures mirror; the selected edition is Gita Press *Sadhak-Sanjivani*. English is an editorial reader rendering of that Hindi. No ISKCON text is used.

- Recording: [Rajshri Soul, Bhagavad Gita Chapter 10](https://youtu.be/DMSwDB2476A); metadata duration 659 s.
- Source audio was downloaded as M4A, preserved at `.gita-work/downloads/chapter-10-source.m4a`, and converted to `authoring/gita/chapter-10.mp3` with `ffmpeg -vn -map_metadata -1 -codec:a libmp3lame -b:a 128k`.
- Master: MP3, 44.1 kHz, 658.913 s; SHA-256 `cb09823f92ae676f1d12841b15df2f2886072479ef37cbc1943db2bde7958bcd`.
- Text was prepared with `python authoring/scripts/prepare-gita-chapter-data.py 10`; bilingual token glosses were imported from the chapter 10 tables at `bhagwadgita.info`. Worst importer alignment: 10.3 = 0.199.
- Local faster-whisper transcription and cached WhisperX Hindi alignment wrote chapter-specific scratch files under `.gita-work/chapter-10/`; `build-gita-audio.py --chapter 10` generated 42 clips and matching JSON/JS timing manifests. Status: **machine-aligned**.
- `node authoring/scripts/validate-gita-chapter.cjs 10 42` passed: 42 verses and 393 word occurrences, source hash, clips, token order, cue bounds, manifest parity, and bilingual word meanings.
- The local range-aware preview returned `206` and 1,024 requested bytes for `audio/01.mp3`; focused Playwright DOM coverage passed the 42 selector options and all required glosses. Full manual listening/highlight review remains outstanding.
