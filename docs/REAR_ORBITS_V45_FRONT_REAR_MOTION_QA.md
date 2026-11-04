# A$RAM ENGINE — REAR ORBITS V4.5 Sensorial Motion Test Preview
Date: 2026-11-04 | Branch: `feature/rear-orbits-v4.5-motion-sweep-2026-11-04`
Base: V4.4 isolated Preview, which was based on the audited V5 Safari/preset/audio-integrity branch. Not merged, not production.

## Why
After testing V4.4 on TT3 the artist reported a movement that felt too subtle, wanted front, back, ear-side, and convincing sensory travel—not just left/right—and wanted to preserve TT3's established beat/synth color. The original vocal recording has an unwanted noise at the beginning. Editing a file externally never updates an already-uploaded browser AudioBuffer; the artist must re-import the edited LEAD and rebuild ROOM. **Important: editing should mute/fade the unwanted initial noise without shifting the LEAD timeline relative to BEAT.** Cutting duration from the beginning may desynchronize the vocal.

## New V4.5 scene routes and listening controls
- Original left-ear → rear → right-ear and opposite, two rear drift paths.
- Front-left → front-right and opposite.
- Front → ear-side → behind (left / right), behind → ear-side → front (left / right).
- Full 360° conceptual orbit, clockwise and counterclockwise (9 spatial points).
- 3D Web Audio HRTF interpolates X and Z keyframes (negative Z in front, positive behind); front/rear navigation is real parameter automation in the engine, not simply a stereo-pan animation. On Safari and some headsets, perceived front/back is not guaranteed, due to individual HRTF mismatch and spectral content.
- Controls: WET INTENSITY (bounded max +19% before source type factor), REAR DEPTH, TRAJECTORY SPAN, REAR PERSISTENCE (bounded second tail tap), optional 3D HRTF wet-only, per-event time, duration (up to 2.4s), source, event level and path.
- The direct dry BEAT and LEAD do not move. Mixed stereo “mix” selections contain bleed; no true source separation or recognition of words. Smart Scout uses a local transient/energy heuristic, prioritizing ADLIBS / DOUBLES and then short LEAD fragments, NEVER BEAT stem, and now varies suggested front/rear routes.
- Orbits OFF by default. OFF / wet amount zero return the identical source AudioBuffer; no changes to ROOM/HALO/mastering graph when off.

## Vocal replacement reliability
- Browser cannot observe edits to an already uploaded file. Use STEM SOURCES · REPLACE / CHECK · NO RESET, replace LEAD with the newly exported same-time-alignment stem, then REBUILD ROOM BUS.
- When replacing an existing stem, active Orbits is switched OFF for safety but its events remain, pending user review or SMART SCOUT. On a dirty room, Smart Scout and manual creation are disabled until rebuild.
- Stem decodes are tracked asynchronously by per-stem load IDs and a session epoch; any old load after NEW SESSION is ignored. Rebuilding is disabled while any stem is decoding. A build that captured old buffers is discarded if a replacement finishes while it renders.
- A visible warning explains why rebuilding is required; no automatic edit-detection or automatic stem replacement is claimed.

## QA
- TypeScript compilation, Vite build, 10 DSP smoke invariants PASS.
- V4.5 dedicated Playwright `npm run test:orbits` PASS Chromium and WebKit: OFF returns exact identity, time windows outside wet fragment remain untouched at pre-master stage, ON generates finite and nonzero output, HRTF ON/OFF render, front→rear and rear→front cross the listener plane, full orbit contains front/right/back/left, V6 saves trajectory/persistence, replacement of LEAD switches Orbits OFF, invalidates stale ROOM, rebuilds and permits manual reactivation.
- Existing `test:preset:v5` Chromium/WebKit, `test:room`, `test:halo`, `test:room:ux` Chromium/WebKit, `test:audio:recovery` Chromium/WebKit, `test:preset:audio` Chromium/WebKit all PASS.
- Mastering algorithm `master()` and 24-bit serializer `wav24()` unchanged vs V4.4 stable. All previously existing audio DSP module blobs (ROOM Halo, enhanced room, limiter, dynamics, denoiser, Superboost, finish, immersive, quality, studioQuality) unchanged. Only the opt-in microOrbits DSP and UI plus reimport safety logic are modified.
- This validates functional behavior and numerical invariants on synthetic audio, **not the user's specific TT3**, not macOS Safari device routing, and not subjective front/back localization.

## Conservative TT3 trial
1. Preserve the current TT3 master, beat and synth setup.
2. Remove/fade the vocal noise at the original timeline start in the DAW **without moving the LEAD event relative to BEAT**; re-export aligned LEAD.
3. In Preview, under STEM SOURCES, upload the new LEAD; when decoding completes, REBUILD ROOM BUS and ensure SIGNAL PATH says ready.
4. Compare A and B first, with IMMERSIVE MONITOR OFF and no Orbits. Check noise is gone; do not blame source until source/pre-ROOM audio examined.
5. Under ROOM, select one vocal accent, manual FRONT → EAR → REAR route at around 0.7–1.1 seconds, ORBITS ON, WET INTENSITY 20–35%, TRAJECTORY SPAN 80–100%, REAR DEPTH 70–85%, PERSISTENCE 15–30%, HRTF ON for front/back. Only increase strength if needed; compare HRTF OFF if sound becomes boxy.
6. Toggle Orbits OFF to level-match against the same baseline. Export as a separate experiment, NOT overwriting released TT2/TT3 masters.
7. V6 preset includes optional motion and trail fields; legacy V6 scenes without these fields remain valid and receive safe defaults in UI and rendering.

## Caveats
Not Dolby Atmos or discrete rear speakers, not semantic AI selection, not guaranteed localization on all headsets. Heavy full-length offline processing while ON may still take time; the browser may need memory. No guarantee of zero defects in real recording without direct listening. Unknown user-reported intermittent bug needs a reproducer (action, status, version and symptom) before precise attribution.
