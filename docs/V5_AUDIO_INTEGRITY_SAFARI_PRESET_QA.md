# A$RAM ENGINE V5 — Audio Integrity, Preset Transparency and Safari Tab Recovery
Date: 2026-11-04
Branch: `fix/v5-preset-sound-integrity-lag-2026-11-04`
Base: `feature/preset-v5-complete-stem-room-2026-11-04`
Status: isolated experimental Preview candidate, not merged. TT2 user-exported master and V4.3 Halo frozen reference remain untouched.

## Reported symptoms
- After changing tabs or losing Safari focus, playback may become silent until full reload, losing in-memory stems and ROOM state.
- After loading a preset, Superboost appears not to have been re-enabled.
- UI lag, and concern about sonic changes / reduced quality.

## Audited findings
- Presets V2+ did and do restore `superboostOn` correctly; however, `bypass.space===true` prevents Superboost from being applied in the offline mastering function. The button can show ON while there is no audible enhancement, and original preset load did not surface this state.
- Original Lock causes export to use the unprocessed source; A/B may show ORIGINAL (A) rather than ENGINE (B).
- After loading settings, the current ROOM BUS is stale until explicit REBUILD ROOM BUS. The old implementation initiated a new master offline render on that stale ROOM output, creating avoidable work and possible misleading A/B.
- Safari can suspend or interrupt an `AudioContext` after background/focus transitions. V4.3.2 had a manual repair button and resume-on-PLAY, but not a dedicated visibility-cycle handler.
- Autoresuming on pointerdown caused a race in WebKit: the RESUME AUDIO button unmounted between pointerdown and click. Fixed by removing hidden auto-resume; explicit user-gesture button remains. No page reload is needed for supported interruptions.

## Fixes
- `visibilitychange`, `pageshow`, `focus` identify suspended/interrupted/closed playback, mark the UI AUDIO PAUSED, keep in-memory source, stem buffers and preset intact.
- Explicit RESUME AUDIO when blocked; PLAY resumes suspended context, and REPAIR AUDIO can recreate the context without resetting the session. Stale source nodes and callbacks are guarded. Preserve playback position on interruption/stop (unless end-of-track).
- After preset import, select B (ENGINE), display clear preset status for Superboost ON effective / blocked by SPACE bypass, and ORIGINAL LOCK condition.
- A SIGNAL PATH panel shows A/B, engine render progress, ROOM stale status, Superboost effective/blocked, Denoiser, Precision, original lock and Clean Mode.
- When ROOM is dirty in STEM mode, block B audition of obsolete ROOM and do not initiate an unnecessary master render; require REBUILD ROOM BUS once. Changing master control values uses a slightly longer 360-ms debounce vs 150 ms to reduce repeated expensive calculations while dragging sliders. This may reduce redundant work but is not a quantified Safari performance fix.
- No changes to the master algorithm, 24-bit WAV serializer, ROOM Halo, enhanced room, dynamics, Superboost, denoiser or other audio DSP modules.

## Tests
- `npm run check`: TypeScript, 10 DSP invariants and Vite production build PASS.
- `npm run test:room`, `npm run test:halo`: PASS.
- `npm run test:preset:v5` Chromium and WebKit: PASS; actual JSON round-trip, original stem mixing, ROOM Halo settings and WAV numerical comparison.
- `npm run test:room:ux` Chromium and WebKit: PASS; 0 px observed slider/drag scroll, replace stem, build, stale export safeguard.
- `npm run test:preset:audio` Chromium and WebKit: PASS, including actual exported 24-bit PCM comparison with Superboost enabled and restored, explicit SPACE bypass handling, tab suspension simulation and return, stems preserved.
- `npm run test:audio:recovery` Chromium and WebKit: PASS, forced audio state interruption, manual repair without session loss, end-of-track replay regression.
- Critical DSP source blobs compared between base and fix: `src/audio/roomHalo.ts`, `room.ts`, `limiter.ts`, `dynamics.ts`, `denoise.ts`, `superboost.ts`, `finish.ts`, `quality.ts`, `immersive.ts`, `studioQuality.ts` — all identical.
- `master()` PCM processing and `wav24()` serializer in App.tsx also compared as identical.
- Synthetic Superboost export after V5 preset recall: Chromium max normalized PCM difference roughly 0.00005–0.00007 full scale across runs, WebKit exactly identical in tested run. This is numerical regression, not proof of audible equivalence for user's own tracks.

## Rollout / known limits
- No production promotion or default-branch merge. Refer to the dedicated Preview for validation.
- Chromium and headless Linux WebKit are not physical macOS Safari; AirPods device routing, background timer throttling and all real user hardware conditions remain unverified.
- The browser can discard or reload a background tab due to memory pressure. That cannot be fixed by an AudioContext resume; uploaded files remain in-memory until the page reloads, and JSON settings do not embed the audio source.
- ROOM and existing DSP settings can legitimately change the sound; the fixes do not algorithmically change those stages. Listen to user TT2 against the saved V4.3 master at level-matched volume before approving a new output.
- Experimental Rear Orbits V4.4 is a separate branch, not included in this audio-integrity fix.
