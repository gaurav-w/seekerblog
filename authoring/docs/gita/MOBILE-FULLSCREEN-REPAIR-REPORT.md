# Mobile fullscreen repair — 2 October 2026

The approved layout changes are applied locally to the shared reader in all 18 chapters. No chapter text, timing manifest, or audio was changed in this layout pass. Publishing has not been requested.

## Behavior

- Fullscreen uses a compact header and playback area around a flexible scrolling reading region. Verse and translation share that region on mobile. Translation can be shown/hidden, and defaults to hidden on small or short screens.
- Desktop columns require at least 960 px width and 600 px height. Wide, short phones keep the mobile reading layout.
- Wrapped words remain in normal flow. If a token/gloss cannot fit between fixed controls, the shell becomes scrollable with a sticky fullscreen exit header. Header/tool wrapping also accommodates enlarged text. Safe-area padding and dynamic viewport height are respected.
- Playing audio follows an offscreen highlighted word without animated scrolling. Wheel, touch scrolling and reading-region navigation keys pause following. The “Follow verse” button resumes it; changing verse resets it. Paused playback does not move the reading area.
- Normal-page markup order is restored on exit. The extra controls are hidden outside fullscreen. Audio stays lazy-loaded.

## Browser verification

Installed Windows Chrome, Playwright, local range-aware preview at `http://127.0.0.1:43217/`; native Fullscreen API entry/exit, loaded fonts, no page errors or eager audio downloads during layout checks.

All **700 verses × 9 viewports × Hindi/English × word meanings off/on = 25,200 layouts** passed. Viewports: 320×568, 360×640, 390×844, 412×915, 568×320, 667×375, 844×390, 915×412, and 1280×900. Translation was expanded during these checks so that its presence could not hide a layout defect.

For every word and visible gloss, the test attempts a legal centered scroll position and checks its full bounding box, horizontal text overflow and viewport bounds. It also checks fullscreen exit, playback, seek, repeat, auto-next and translation toggle reachability. Long content can require scrolling; the acceptance criterion is reachability rather than fitting an entire verse in one frame.

Targeted chapter 6.9 checks passed for active-word following, native audio seeks, manual wheel/touch-scroll event suspension, explicit resume, rotation while playing, paused-position preservation during translation/language/gloss controls, keyboard navigation, new-verse reset, 200% root text size in portrait/landscape with the shell fallback, normal-page restoration and unsupported fullscreen feedback. The normal reader also verifies Escape exit. Screenshots of chapter 6.9 at the nine viewports were inspected for the previously reproduced portrait/landscape clipping cases and are saved under ignored `.gita-work/fullscreen-*.png`.

The existing reader regression passed for chapter 3 playback, pause/resume, repeat, auto-next, final-verse stop, language persistence, deep links, 344 normal responsive layouts and complete gloss rendering across all 18 chapters. Its completion-message assertion now matches its selected Hindi language. Run with:

```powershell
$env:PLAYWRIGHT_PACKAGE = '<path-to-playwright>'
$env:CHROME_EXECUTABLE = '<path-to-chrome>'
node authoring/scripts/test-gita-fullscreen.cjs http://127.0.0.1:43217/
node authoring/scripts/test-gita-reader.cjs http://127.0.0.1:43217/gita/3/
```

`GITA_INTERACTION_ONLY=1` runs the targeted fullscreen interaction checks. `GITA_SCREENSHOT_DIR` optionally writes screenshots. Native fullscreen tests must run sequentially because fullscreen belongs to the focused window.

These are desktop Chrome tests at mobile viewport sizes. Physical Android/iOS fullscreen behavior, browser chrome and real safe-area insets still need device verification; those have not been certified by this pass.
