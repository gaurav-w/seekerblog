# Chapter 1 record

Implemented 2026-09-29: 47 verses, *Arjunavishada Yoga*. Sanskrit and Hindi full meanings were checked from the Swami Ramsukhdas records in the public Vedic Scriptures mirror; the selected edition is Gita Press *Sadhak-Sanjivani*. English is an editorial rendering for the reader, not a published translation. No ISKCON content was used.

- Recording: https://youtu.be/KE1fCjAJK0c?si=q_sAZNWIr1fN1JSN (Rajshri Soul; metadata: 851 s).
- yt-dlp returned AAC/M4A in `C:\Users\gaura\Downloads`; original preserved. Master conversion: `ffmpeg -i <returned-m4a> -vn -map_metadata -1 -codec:a libmp3lame -b:a 128k authoring/gita/chapter-1.mp3`.
- Master SHA-256: `d558e20dfe30fcc85cfb3c24eb450da0f4e8aaa0956384b9794a3d0691a9cfe3`.
- Transcribed locally, then Sanskrit was force-aligned line by line; source-specific hand-off repairs are in `scripts/gita-alignment-windows-chapter-1.json`. 47 per-verse MP3 clips and clip-relative cue manifest generated. Status: **machine-aligned**; no full manual listening audit claimed.
- Automated: `node authoring/scripts/validate-gita-chapter.cjs 1 47` PASS; Chapter 3 structural regression PASS; `git diff --check` had no whitespace errors.

Remaining: full manual listening/highlight review and the complete browser/visual matrix were not certified in this run.
