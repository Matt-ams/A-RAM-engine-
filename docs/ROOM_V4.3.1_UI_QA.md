# A$RAM ENGINE ROOM V4.3.1 — Tooling & stability (NO DSP tuning)
Date: 2026-11-03

## Listening reference (untouched)
The musical V4.3 Halo user approved is pinned in `backup/room-v4.3-halo-listening-reference-2026-11-03` at commit `06cc35e8585ab0646aaa9ee470eeae5e93361885`. It is independent of this branch. V4.1 and V4.2 backups also remain. **Do not promote over the approved listening version until tested on TT2.**

## Improvements
- Frame-coalesced and precision-limited ROOM SVG dragging: at most one queued state update per animation frame, final pointer position flushed on pointerup. This reduces React update pressure while moving the four-corner objects.
- Classic room now shows a render-busy state and recovers from render exceptions, rather than only reporting busy in Enhanced/Halo.
- When an existing source stem is replaced or a new stem added, the output becomes DIRTY; export remains locked until ROOM BUS rebuilds. Previous rendered audio may still be auditioned, but is clearly labeled as **last render**.
- Inline panel allows source replacement inside the mixing cockpit without clearing the four-corner setup, gains, copies or ROOM settings; also permits selecting the exact same file again.
- UI adds clearly marked pending state and explains that offline ROOM requires one rebuild after edits, **not before every play**.
- Scroll anchoring is reduced, width changes stabilized, responsive source controls, keyboard focus outlines added.
- Halo, Enhanced and the Classic mixer audio graph are unchanged: source blob SHAs for `src/audio/roomHalo.ts` (`93003d9938f6ed21e8bb02748bd3714f7ce77c3f`) and `src/audio/room.ts` (`1536c13b6351b3abe47dddf5664048296fb72f2d`) match frozen V4.3 exactly; the contiguous Classic DSP graph in `App.tsx` was compared byte-for-byte.

## Verification
- `npm run check`: TypeScript; 10 DSP regression invariants; production Vite build PASS.
- `npm run test:room`: V4.2 Enhanced regressions, offline WAV, presets PASS.
- `npm run test:halo`: generated 44.1-kHz STEM output, halo first 60ms matching dry, centered lead/copies, all three modes PASS.
- `npm run test:room:ux`: Chromium PASS, WebKit PASS. Both returned 0px vertical scroll change for Halo slider click and SVG 25-step drag in automated viewport; source replacement invalidates export; Classic rebuild revalidates; source manager at 390px mobile width fits viewport.

## Known limitations / explicit non-claims
- Room rendering and master processing still use OfflineAudioContext; a rebuild is needed whenever ROOM properties or inputs change.
- Browser performance/interruptions with long stems and actual listening on a physical Mac Safari are not yet measured.
- WebKit on a Linux QA environment is not identical to the user's exact Safari release.
- No subjective conclusion about a high-frequency boost: the user hears greater top-end detail. Wet-only room taps can make spatial upper mids more noticeable; they do not imply newly generated missing frequencies or automatically improve the original source.
- No modifications to the audio character, bass, phase, effects parameters, or mastering presets were made in V4.3.1.
