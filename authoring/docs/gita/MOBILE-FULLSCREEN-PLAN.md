# Mobile fullscreen repair plan

Prepared 2 October 2026. The shared CSS/JavaScript changes are now applied locally following explicit approval. Verification results are recorded in [MOBILE-FULLSCREEN-REPAIR-REPORT.md](MOBILE-FULLSCREEN-REPAIR-REPORT.md). Physical phone testing remains outstanding.

## Reproduced behavior

The deployed CSS, JavaScript, and chapter 6 timings matched the local files during the check. Tests used actual Fullscreen API entry in Chrome at simulated mobile viewport sizes; physical phone/browser testing remains necessary.

- At 844×390 landscape, controls leave about **54.8 px** for the verse scroll area. At 667×375, it is **48 px**. Its vertical padding alone totals 48 px, so initial words visibly clip and only a sliver of the verse is readable.
- At 320×568 portrait, chapter **6.9** has a wrapped Sanskrit compound taller than the available **63.7 px** verse area. No scroll position can show that entire token at once.
- At 390×844 and 360×640 portrait, every chapter 6 word can be reached by scrolling; many verses still require it. Text below the initial viewport is not automatically a defect if scrolling can reveal it.
- The shared reader does not scroll to the active word during playback. A correct cue can therefore highlight text outside the visible verse area.

The earlier root/button class collision is already fixed. The remaining issue is viewport allocation: the header, word-meaning switch, playback controls, and translation consume height while the verse is permitted to shrink almost to its padding.

## Implementation sequence

1. **Give reading the main viewport area.** Use a fullscreen shell with a compact header, a flexible central reading region, and reachable playback controls. Put Sanskrit and meaning content in a scrollable reading region on short screens rather than letting the translation compete with Sanskrit as a separate tall flex item. Keep the standard page layout intact.
2. **Adapt controls to available height.** In short portrait/landscape layouts, reduce unused vertical spacing and group transport, seek, repeat, and auto-next controls compactly. Preserve touch targets, keyboard labels, visible focus, and an accessible exit-fullscreen button. Make translation collapsible on small screens; keep it available rather than removing it.
3. **Use landscape columns only when both dimensions permit them.** A width of 700 px alone does not mean there is enough height for the existing desktop controls. Base the compact layout on usable height as well as width.
4. **Make overflow reachable.** Keep content in normal flow with nonshrinking line/word groups and safe top alignment when it exceeds the reading region. Reduce excessive scroll-area padding on short screens. If fixed controls and the largest wrapped token cannot fit, allow the reader shell to scroll instead of hiding content. Account for fullscreen viewport resize, rotation, browser chrome, and safe-area insets.
5. **Follow the active word.** Scroll only when the active word falls outside the visible reading region, scoped to that region. Avoid continuous recentering. Respect manual scrolling, pause, seeking, and reduced-motion preferences; resume following through a clear user action or a subsequent verse change.
6. **Verify and document.** Add regressions based on the reproduced clipping and the reading behavior, then check screenshots and actual phones before treating the repair as complete.

## Acceptance checks

- Exercise **all 700 verses** in Hindi/English with inline word meanings on/off. Check the longest token and its gloss, not merely document horizontal overflow.
- At minimum: 320×568, 360×640, 390×844, 412×915 portrait; 568×320, 667×375, 844×390, 915×412 landscape; and a desktop fullscreen regression.
- For every displayed word, attempt to bring it wholly into view at **some legal scroll position**. Checking only `scrollTop=0` or the maximum scroll position can misclassify reachable content. Check word glosses independently too.
- Confirm the first and last glyphs are reachable, no horizontal text is lost, and active words can be followed while audio plays. Inspect initial, middle, and bottom reading positions visually.
- Test rotation while fullscreen and playing, entry/exit, font loading, enlarged text, touch scrolling, seeking, language/gloss toggles, repeat, auto-next, and focus navigation. Exercise native fullscreen on Android Chrome and supported iOS behavior; unsupported fullscreen must give clear feedback.
- Controls and fullscreen exit remain reachable; translation is available; manual scrolling is respected; mobile browser UI/insets do not cover text.
- Run chapter 3 playback regressions and targeted chapter 6 fullscreen checks after the shared-reader change.

## Files likely involved

- `assets/css/gita-reader.css`: fullscreen sizing, adaptive controls, reading overflow, safe-area spacing.
- `assets/js/gita-reader.js`: active-word following and fullscreen/viewport state.
- `gita/1/index.html` through `gita/18/index.html`, plus their authoring generator, if a shared reading wrapper or translation control requires markup changes.
- A dedicated parameterized browser test for all chapters; the current reader suite checks ordinary narrow layouts but does not cover these short fullscreen sizes.
