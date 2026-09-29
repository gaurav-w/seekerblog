# Chapter 3 text and word meanings

For another chapter, follow the [chapter workflow and test cases](../GITA-CHAPTERS.md), including source review and bilingual caption coverage.

`gita/3/data.js` contains the Sanskrit, full Hindi/English summaries, and bilingual captions for all 43 verses. Captions are keyed by the exact displayed Sanskrit token; standalone punctuation receives no caption. Joined Sanskrit words retain a combined caption so the existing audio-cue indices remain unchanged. These are concise editorial glosses, not a verbatim reproduction of a published word-by-word translation.

The selected interpretive source is Swami Ramsukhdas's **Sadhak-Sanjivani**, published by Gita Press. The existing publication link stays in the reader footer. No ISKCON translation is used.

Source checks are available through IIT Kanpur's Gita Supersite, which labels the Hindi translation and commentary by author:

- [3.1](https://www.gitasupersite.iitk.ac.in/srimad?choose=1&etgb=1&field_chapter_value=3&field_nsutra_value=1&htrskd=1&language=dv)
- [3.15](https://www.gitasupersite.iitk.ac.in/srimad?field_chapter_value=3&field_nsutra_value=15&hcrskd=1&htrskd=1&htshg=1&language=dv)
- [3.25](https://www.gitasupersite.iitk.ac.in/srimad?field_chapter_value=3&field_nsutra_value=25&hcrskd=1&htrskd=1&htshg=1&language=dv)
- [3.42](https://www.gitasupersite.iitk.ac.in/srimad?ecsiva=1&etgb=1&etsiva=1&field_chapter_value=3&field_nsutra_value=42&hcrskd=1&htrskd=1&language=dv&show_mool=1)
- [3.43](https://www.gitasupersite.iitk.ac.in/srimad?field_chapter_value=3&field_nsutra_value=43&hcrskd=1&htrskd=1&htshg=1&language=dv)

In 3.42–3.43, Ramsukhdas interprets what can overpower the intellect as desire (kama). The previous summaries followed a different interpretation, identifying it as the Self. Both the summaries and the new captions now follow the selected Ramsukhdas source consistently.

The browser checks cover both languages, every verse at four viewport widths, complete caption coverage, clipping, and uninterrupted playback while toggling captions.
