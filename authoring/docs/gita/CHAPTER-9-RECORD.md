# Chapter 9 record

Implemented 2026-09-30: 34 verses, *Raja Vidya Raja Guhya Yoga* (राजविद्याराजगुह्ययोग). Sanskrit and Hindi use the Swami Ramsukhdas records in the public Vedic Scriptures mirror; the selected edition is Gita Press *Sadhak-Sanjivani*. English is an editorial reader rendering of that Hindi. No ISKCON text is used.

- Recording: [Rajshri Soul, Bhagavad Gita Chapter 9](https://youtu.be/4kxJbZwuiD4); metadata duration 543 s.
- Source audio was downloaded as M4A, preserved at `.gita-work/downloads/chapter-9-source.m4a`, and converted to `authoring/gita/chapter-9.mp3` with `ffmpeg -vn -map_metadata -1 -codec:a libmp3lame -b:a 128k`.
- Master: MP3, 44.1 kHz, 543.440 s; SHA-256 `43449b498d63e16fa21748aa8ae676801cc075a81555eb76fd10cbeb60c7f030`.
- Text was prepared with `python authoring/scripts/prepare-gita-chapter-data.py 9`; bilingual token glosses were imported from the chapter 9 tables at `bhagwadgita.info`. Worst importer alignment: 9.23 = 0.184.
- Local faster-whisper transcription and cached WhisperX Hindi alignment wrote chapter-specific scratch files under `.gita-work/chapter-9/`; `build-gita-audio.py --chapter 9` generated 34 clips and matching JSON/JS timing manifests. Status: **machine-aligned**.
- A shared clip-builder repair now normalizes a word end when overlap repair has moved its start forward; this addressed Chapter 9 verse 21 without changing its source text or source recording.
- `node authoring/scripts/validate-gita-chapter.cjs 9 34` passed: 34 verses and 329 word occurrences, source hash, clips, token order, cue bounds, manifest parity, and bilingual word meanings.
- The local range-aware preview returned `206` and 1,024 requested bytes for `audio/01.mp3`; focused Playwright DOM coverage passed the 34 selector options and all required glosses. Full manual listening/highlight review remains outstanding.
