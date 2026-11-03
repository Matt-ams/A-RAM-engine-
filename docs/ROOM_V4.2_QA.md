# A$RAM ENGINE — ROOM V4.2 Spatial Acoustics
2026-11-03 · **TESTED SOURCE BRANCH — NOT YET VERCEL DEPLOYED**

## Immutable baseline / backup
- **Pre-upgrade ROOM:** [`backup/room-v4.1-before-upgrade-2026-11-03`](https://github.com/Matt-ams/A-RAM-engine-/tree/backup/room-v4.1-before-upgrade-2026-11-03). Created before any ROOM modifications and verified byte-identical to the starting V4.1 ROOM files.
- **Working branch:** `feature/room-v4.2-spatial-acoustics`.
- The entire original `buildBus()` classic ROOM processing path is still byte-identical within `src/App.tsx` (comparison from original `const keys=` to legacy function end). Select **ROOM V4.1 · CLASSIC**, then **REBUILD ROOM BUS**.
- Original live V4 remains independently deployed on Vercel: `dpl_6bDzenDqYkMfHEh9pZwgZHwnRVY1`; it has not been changed.

## Implemented changes by requested category

| Concern | ROOM V4.2 |
|---|---|
| **Front/rear** | Independent front/back and azimuth position; browser PannerNode HRTF is used for mono stems, and two HRTF virtual emitters preserve independent L/R material for stereo stems. Front/rear also changes spectral attenuation/reflection cues. No claim of individualized HRTF, source separation, or Atmos. |
| **Acoustic depth** | Separate per-stem **distance** slider, room **size**, reflection intensity and wall **absorption**. Geometric parameterization uses no-feedback early side-wall reflections and short scattered room taps. Direct musical transients stay time aligned. Not a physically measured impulse response or true ray tracing. |
| **Copies / buildup** | Spatial copies get bounded gain (primary 1, copy .46, combined normalized); copies use 6–13 ms inter-copy timing offset plus all-pass coloration, and copied deep bass is removed from the duplicate paths. Individually editable pan, front/rear, and distance; removable; maximum 4 copies per stem. |
| **Frequency handling** | Mono-centered low-frequency contribution for each primary stem (75–180 Hz adjustable crossover); spatial mids/highs get independent directional/distance attenuation; rear and far stems get stronger high-frequency damping, reflections are high-passed and darkened. |
| **Different sample rates** | Offline context at highest input sample rate capped at 96 kHz; all inputs are resampled automatically by Web Audio; **frame allocation is based on durations in seconds**, plus room reflection tail to prevent truncation. AudioContext decode usually normalizes files to a shared sample rate before rendering. |
| **Mono/stereo and peaks** | Preserved stereo stem channels in HRTF mode via dual emitters; low end centered; measured output mid/side power automatically attenuates dangerous anti-phase side dominance without changing the mono mid sum; reports correlation and trims only peaks exceeding 0.96 linear. Unrecoverable fully anti-phase source material is flagged, not fabricated. |

## Controls and integration
- Existing ROOM visual stage and positions are retained. **ROOM V4.2 · ENHANCED** is the default, and **ROOM V4.1 · CLASSIC** remains a one-click comparison.
- Existing stem bus, stereo master, vocal recorder, original-lock, album workflows and module DSP stay in the same React app.
- A new **REBUILD ROOM BUS** action applies changes made after the original mix. UI marks dirty settings and disables stale WAV export until rebuilt. Rebuild result is the master input and is also exported.
- Preset `version:3` stores room mode, per-stem distances, ROOM settings and existing spatial staging. JSON v1/v2 imports remain supported.
- ROOM reports sample rate, duration, tail, copied sources, room taps, output correlation, gain trim and stereo HRTF source pairs.
- Mobile room controls adapt to narrow screens; tested at 390px.

## QA results (sandbox, headless Chromium)
- **PASS** `npm run check`: TypeScript, original DSP smoke tests, Vite production build.
- **PASS** `npm run test:room`: real Web Audio render with 44.1/48 kHz buffers, HRTF mono/stereo, copies, peak and finite-sample checks, audio source immutability, room rebuild/dirty UI, PCM WAV download, preset v3 including copied-stem distance save/load, Classic fallback, zero unhandled page errors.
- **PASS** separate mobile viewport 390px: document width remained 390px.
- Confirmed full legacy ROOM mixer source unchanged; backup branch verified before development.
- **NOT YET** TT2/TT3 headphone nearfield subjective QA; Safari on Mac; long-duration 48/96k CPU/memory benchmarks.
- **NOT DEPLOYED**: Vercel cannot currently resolve the **private** GitHub repository with its Git integration (`incorrect_git_source_info`). Private visibility is intentional and should remain; grant Vercel's GitHub integration access to this exact repository before a Preview. No promotion of any production domain.

## Run locally
```sh
npm install
npm run check
npx playwright install chromium
npm run test:room
npm run dev
```

## Listening acceptance
Use TT2/TT3 with matched loudness. Verify center kick/bass, close lead, rear/side adlibs, duplicate artifacts, timbre of guitar and consonants, stereo correlation, mono sum, true-peak estimates and exported WAV. Compare Classic/Enhanced on identical stems. **Do not merge/deploy to production until user listening approval.**
