# Siddha Kunjika Stotram reader record

## Public reader

- URL: `/stotra/siddha-kunjika-stotram/`
- Scope: 15 stanzas, displayed one at a time with a local stanza clip, Hindi and English meanings, seek, speed, repeat, auto-next, and full-screen reading.
- The active stanza is highlighted during playback. The supplied recording has no downloadable captions, so this reader deliberately does not expose public word-level highlights.

## Sanskrit and translations

- Canonical Sanskrit checked against [Stotra Nidhi](https://stotranidhi.com/hi/siddha-kunjika-stotram-in-sanskrit/).
- Hindi sense checked against [Drik Panchang](https://www.drikpanchang.com/lyrics/durga-saptashati/siddhakunjika-stotram/durga-saptashati-siddhakunjika-stotram-hindi.html).
- English meanings are concise editorial renderings, informed by the cited source text and not presented as a verbatim translation.

## Recording and clips

- Video: `https://www.youtube.com/watch?v=uswcVLQExOo` (`uswcVLQExOo`)
- Title: *Siddha Kunjika Stotram with Lyrics | सिद्ध कुंजिका स्तोत्र | Durga Stotram | दुर्गा स्तोत्र*
- Channel: Rajshri Soul
- Credited singer: Susmirata Dawalkar
- Master: `authoring/kunjika-stotram/source.m4a`
- Audio: AAC, stereo, 44.1 kHz, 276.456780 seconds
- SHA-256: `b3c56be27ea5396c75c3486caf545bd7ce0cf7813f3ab28480300f5d350896df`
- Public clips: `stotra/siddha-kunjika-stotram/audio/01.mp3` through `15.mp3`, generated at 96 kbps MP3.

The public clips are built from local STT timing anchors and cached local Hindi WhisperX force alignment of the immutable Sanskrit reader text:

1. `E:\Vishnu Sahasranama\.venv-align\Scripts\python.exe authoring\scripts\align-kunjika-audio.py transcribe`
2. `E:\Vishnu Sahasranama\.venv-align\Scripts\python.exe authoring\scripts\align-kunjika-audio.py windows`
3. `E:\Vishnu Sahasranama\.venv-align\Scripts\python.exe authoring\scripts\align-kunjika-audio.py align`
4. `E:\Vishnu Sahasranama\.venv-align\Scripts\python.exe authoring\scripts\build-kunjika-audio.py`

The scratch evidence lives in ignored `.kunjika-work/`; the generated manifest records the source hash and the alignment provenance. The spoken closing phrase **इति मन्त्रः** is displayed within stanza 5 because it is present in the recording. The opening clip preserves a source-STT-supported lead-in for the brief attribution, and the closing colophon/music remains excluded from stanza 15.
