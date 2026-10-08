# Vishnu Sahasranama STT audio audit

This audit compares the immutable reader text with cached Groq Whisper Large V3 word timestamps from the supplied master recording. It is a review queue, not a transcription replacement or a listening certification.

- Reader entries: 180
- STT-supported clips: 152
- Entries with no rendered clip: 20
- Rendered clips with missing/mismatched canonical speech: 7
- Rendered clips with potential additional speech: 1

## Status meanings

- **not-evidenced-no-clip** — no reader clip and the cached STT did not provide a reliable canonical match. This is not proof of silence; it is a re-record/review candidate.
- **stt-partial-no-clip** — no reader clip, although the cached STT recognises a material part of the passage. It needs a bounded source window and manual listening before restoration.
- **partial-or-wrong-clip** — a rendered clip has less than 65% canonical-character recall in its own STT window; it likely omits text or begins/ends in a neighbour.
- **extra-speech-in-clip** / **possible-extra-speech** — the clip has considerable STT material not found in its displayed passage. It needs a cut-boundary review.

## Review queue

| Entry | Status | STT recall | STT precision | Source window | Missing/weak lines |
| --- | --- | ---: | ---: | --- | --- |
| 001 `purva:1` | not-evidenced-no-clip | 0.153 | 0.290 | 0.000–35.340s | ॐ शुक्लाम्बरधरं विष्णुं शशिवर्णं चतुर्भुजम् ।; प्रसन्नवदनं ध्यायेत् सर्वविघ्नोपशान्तये ॥ |
| 002 `purva:2` | stt-partial-no-clip | 0.448 | 0.839 | 0.000–35.340s | यस्यद्विरदवक्त्राद्याः पारिषद्याः परः शतम् । |
| 010 `purva:10` | partial-or-wrong-clip | 0.593 | 0.711 | 134.684–150.369s | जगत्प्रभुं देवदेव मनन्तं पुरुषोत्तमम् । |
| 024 `nyasa:2` | not-evidenced-no-clip | 0.079 | 0.586 | 374.423–382.801s | अथ न्यासः ।; ॐ शिरसि वेदव्यासर्षये नमः ।; मुखे अनुष्टुप्छन्दसे नमः ।; हृदि श्रीकृष्णपरमात्मदेवतायै नमः ।; गुह्ये अमृतांशूद्भवो भानुरिति बीजाय नमः ।; पादयोर्देवकीनन्दनः स्रष्टेति शक्तये नमः ।; सर्वाङ्गे शङ्खभृन्नन्दकी चक्रीति कीलकाय नमः ।; करसम्पूटे मम श्रीकृष्णप्रीत्यर्थे जपे विनियोगः ॥; इति ऋष्यादिन्यासः ॥ |
| 025 `nyasa:3` | not-evidenced-no-clip | 0.058 | 0.414 | 374.423–382.801s | अथ करन्यासः ।; ॐ विश्वं विष्णुर्वषट्कार इत्यङ्गुष्ठाभ्यां नमः ।; अमृतांशूद्भवो भानुरिति तर्जनीभ्यां नमः ।; ब्रह्मण्यो ब्रह्मकृद्ब्रह्मेति मध्यमाभ्यां नमः ।; सुवर्णबिन्दुरक्षोभ्य इत्यनामिकाभ्यां नमः ।; निमिषोऽनिमिषः स्रग्वीति कनिष्ठिकाभ्यां नमः ।; रथाङ्गपाणिरक्षोभ्य इति करतलकरपृष्ठाभ्यां नमः । |
| 026 `nyasa:4` | not-evidenced-no-clip | 0.074 | 0.586 | 374.423–382.801s | अथ षडङ्गन्यासः ।; ॐ विश्वं विष्णुर्वषट्कार इति हृदयाय नमः ।; अमृतांशूद्भवो भानुरिति शिरसे स्वाहा ।; ब्रह्मण्यो ब्रह्मकृद्ब्रह्मेति शिखायै वषट् ।; सुवर्णबिन्दुरक्षोभ्य इति कवचाय हुम् ।; निमिषोऽनिमिषः स्रग्वीति नेत्रत्रयाय वौषट् ।; रथाङ्गपाणिरक्षोभ्य इत्यस्त्राय फट् ।; ऋतुः सुदर्शनः काल इति भूर्भुवःसुवरोमिति दिग्बन्धः ॥; इति षडङ्गन्यासः ॥ |
| 027 `nyasa:5` | stt-partial-no-clip | 0.294 | 0.517 | 374.423–382.801s | श्रीकृष्णप्रीत्यर्थे विष्णोर्दिव्यसहस्रनामजपमहं करिष्ये; इति सङ्कल्पः ॥ |
| 028 `nyasa:6` | not-evidenced-no-clip | 0.046 | 0.241 | 374.423–382.801s | अथ पञ्चपूजा ।; लं पृथिव्यात्मने गन्धं समर्पयामि ।; हं आकाशात्मने पुष्पैः पूजयामि ।; यं वाय्वात्मने धूपमाघ्रापयामि ।; रं वह्न्यात्मने दीपं दर्शयामि ।; वं अमृतात्मने नैवेद्यं निवेदयामि ।; सं सर्वात्मने सर्वोपचारपूजां समर्पयामि ॥ |
| 035 `dhyana:7` | not-evidenced-no-clip | 0.107 | 0.128 | 519.053–574.085s | छायायां पारिजातस्य हेमसिंहासनोपरि; आसीनमम्बुदश्याममायताक्षमलङ्कृतम् ॥ |
| 036 `dhyana:8` | not-evidenced-no-clip | 0.159 | 0.213 | 519.053–574.085s | चन्द्राननं चतुर्बाहुं श्रीवत्साङ्कित वक्षसम्; रुक्मिणी सत्यभामाभ्यां सहितं कृष्णमाश्रये ॥ |
| 037 `stotram:1` | stt-partial-no-clip | 0.339 | 0.447 | 519.053–574.085s | भूतकृद्भूतभृद्भावो भूतात्मा भूतभावनः ॥ |
| 038 `stotram:2` | not-evidenced-no-clip | 0.175 | 0.213 | 519.053–574.085s | पूतात्मा परमात्मा च मुक्तानां परमागतिः ।; अव्ययः पुरुषः साक्षी क्षेत्रज्ञोऽक्षर एव च ॥ |
| 039 `stotram:3` | partial-or-wrong-clip | 0.491 | 0.966 | 574.085–585.910s | योगो योगविदां नेता प्रधान पुरुषेश्वरः । |
| 050 `stotram:14` | not-evidenced-no-clip | 0.213 | 0.765 | 713.013–719.277s | सर्वगः सर्व विद्भानुर्विष्वक्सेनो जनार्दनः ।; वेदो वेदविदव्यङ्गो वेदाङ्गो वेदवित्कविः ॥ |
| 051 `stotram:15` | not-evidenced-no-clip | 0.119 | 0.471 | 713.013–719.277s | लोकाध्यक्षः सुराध्यक्षो धर्माध्यक्षः कृताकृतः ।; चतुरात्मा चतुर्व्यूहश्चतुर्दंष्ट्रश्चतुर्भुजः ॥ |
| 052 `stotram:16` | partial-or-wrong-clip | 0.533 | 0.762 | 719.277–752.876s | भ्राजिष्णुर्भोजनं भोक्ता सहिष्णुर्जगदादिजः । |
| 082 `stotram:46` | partial-or-wrong-clip | 0.482 | 0.750 | 1125.280–1133.104s | अर्थोऽनर्थो महाकोशो महाभोगो महाधनः ॥ |
| 102 `stotram:66` | partial-or-wrong-clip | 0.523 | 0.576 | 1377.305–1390.937s | स्वक्षः स्वङ्गः शतानन्दो नन्दिर्ज्योतिर्गणेश्वरः । |
| 107 `stotram:71` | not-evidenced-no-clip | 0.086 | 0.143 | 1443.339–1481.600s | ब्रह्मण्यो ब्रह्मकृद् ब्रह्मा ब्रह्म ब्रह्मविवर्धनः ।; ब्रह्मविद् ब्राह्मणो ब्रह्मी ब्रह्मज्ञो ब्राह्मणप्रियः ॥ |
| 108 `stotram:72` | not-evidenced-no-clip | 0.148 | 0.190 | 1443.339–1481.600s | महाक्रमो महाकर्मा महातेजा महोरगः ।; महाक्रतुर्महायज्वा महायज्ञो महाहविः ॥ |
| 109 `stotram:73` | stt-partial-no-clip | 0.492 | 0.714 | 1443.339–1481.600s | स्तव्यः स्तवप्रियः स्तोत्रं स्तुतिः स्तोता रणप्रियः । |
| 112 `stotram:76` | stt-partial-no-clip | 0.621 | 0.231 | 1506.804–1532.440s | दर्पहा दर्पदो दृप्तो दुर्धरोऽथापराजितः ॥ |
| 113 `stotram:77` | stt-partial-no-clip | 0.317 | 0.128 | 1506.804–1532.440s | विश्वमूर्तिर्महामूर्तिर्दीप्तमूर्तिरमूर्तिमान् ।; अनेकमूर्तिरव्यक्तः शतमूर्तिः शताननः ॥ |
| 160 `phala:15` | possible-extra-speech | 0.769 | 0.449 | 2136.700–2147.938s | — |
| 161 `phala:16` | not-evidenced-no-clip | 0.000 | 0.000 | 2147.938–2160.594s | इन्द्रियाणि मनोबुद्धिः सत्त्वं तेजो बलं धृतिः ।; वासुदेवात्मकान्याहुः क्षेत्रं क्षेत्रज्ञ एव च ॥ |
| 162 `phala:17` | partial-or-wrong-clip | 0.491 | 0.839 | 2160.594–2172.855s | सर्वागमानामाचारः प्रथमं परिकल्पते । |
| 179 `phala:34` | not-evidenced-no-clip | 0.017 | 0.667 | 2464.928–2466.841s | यदक्षर पदभ्रष्टं मात्राहीनं तु यद्भवेत्; तत्सर्वं क्षम्यतां देव नारायण नमोऽस्तु ते ।; विसर्ग बिन्दु मात्राणि पदपादाक्षराणि च; न्यूनानि चातिरिक्तानि क्षमस्व पुरुषोत्तम ॥ |
| 180 `phala:35` | partial-or-wrong-clip | 0.520 | 0.743 | 2466.841–2473.795s | ॐ तत्सत् सर्वं श्री कृष्णार्पणमस्तु ॥ |

The full machine-readable evidence, including every reader entry and the corresponding STT excerpt, is generated in `.vishnu-work/stt-audit.json` and is intentionally not published.

## Re-run

```powershell
python authoring/scripts/audit-vishnu-sahasranama-stt.py
```
