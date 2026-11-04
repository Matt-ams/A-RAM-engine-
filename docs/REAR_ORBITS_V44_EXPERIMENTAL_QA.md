# A$RAM ENGINE — REAR ORBITS V4.4 experimental preview / 2026-11-04

## What exists
An opt-in post-ROOM, pre-master wet-only micro-event layer. Unlike ROOM's position diagram, its UI is an ear/head rear-field map. Adds extremely short filtered reflections of selected existing audio fragments; the dry instrumental and centered voice never change their positions. Rear perception is headphone/listener dependent and does not imply discrete rear channels or Dolby Atmos compatibility.

## Audition workflow — preserve your master
1. Open the isolated V4.4 Preview (not production).
2. Upload existing TT3 BEAT + LEAD (optional DOUBLES / ADLIBS), load your V5 JSON preset; BUILD ROOM BUS and confirm SIGNAL PATH and MASTER B before proceeding.
3. Keep REAR ORBITS OFF initially. Compare the same baseline segment against your trusted older ENGINE export using matched level. Be sure IMMERSIVE MONITOR is OFF for an exportable mix audition.
4. Below ROOM, select SMART SCOUT or manual + DETAIL AT PLAYHEAD. Auto scout is a deterministic acoustic heuristic, not speech understanding / true source separation. When stems are provided, never select BEAT, preferentially ADLIBS / DOUBLES, then tiny LEAD excerpts. With only a stereo mix, it can only filter tiny MIX excerpts and inevitably bleeds other sources.
5. Start REAR ORBITS ON with wet intensity ~20–35%, rear depth ~60–75%, with HEADPHONES and a single event. Toggle REAR HRTF wet-only ON/OFF (Safari HRTF may sound muffled).
6. Compare B with the same B and toggled Orbits OFF; the OFF path is exactly the existing ROOM/master path. Add at most a few events to avoid sonic clutter. Export only an alternate V4.4 test master, keep TT3/TT2 reference files intact.
7. SAVE SETTINGS V6 stores the event list, routes and switch as well as full existing V5 stem/ROOM/master settings. V1–V5 remain importable (Orbits disabled for legacy presets). Audio file contents are not embedded and cannot survive browser refresh.
8. If playback fails after tab switch, press RESUME AUDIO / REPAIR AUDIO; do not refresh the tab without saving.

## Safety / architecture
- ROOM V4.1/4.2/4.3 Halo, mastering, limiter, Superboost, Denoiser and WAV encoding are unchanged vs `fix/v5-preset-sound-integrity-lag-2026-11-04`.
- Only new file `src/audio/microOrbits.ts` and UI `src/MicroOrbitsPanel.tsx`, App.tsx opt-in pre-master render and V6 preset fields, and styles/tests added.
- When disabled or wet intensity 0, `renderMicroOrbits` returns the identical input AudioBuffer object, without copying/processing.
- On active events, a short high-passed/low-passed copy of a source fragment moves along a rear-field trajectory with optional HRTF; all source audio keeps its original ROOM position, sampled output length and channel count.
- A small side cue increases reliability for headphone playback but cannot assure rear localization for everyone.
- No AI model, speech transcription, voice recognition, track separation, or proprietary Dolby technology.
- Web audio DSP runs locally in the browser.

## Automated QA
- `npm run check`: TS, 10 DSP smoke invariants and bundle PASS.
- `npm run test:orbits` Chromium + WebKit PASS: original buffer identity when OFF and 0%, dry-before and dry-after exact unchanged, nonzero short wet event when ON, finite HRTF and non-HRTF output, 44.1 kHz, unchanged length, no BEAT stems selected by scout, V6 save/restore, OFF master parity and ON altered WAV.
- `npm run test:preset:v5` Chromium + WebKit PASS (now generating V6 JSON).
- `npm run test:room`, `npm run test:halo`, ROOM UX Chromium + WebKit, audio recovery Chromium + WebKit, Superboost/preset audio integrity/tab return Chromium + WebKit PASS.
- These automated tests do not measure perceived rear localization or rule out flaws with the user's TT3 audio. HRTF varies with headphones, Safari and the listener's ears.

## Limitations
- Limited to short transient spectral selections rather than source-aware isolation, especially in merged stereo music.
- A scene is experimental and may introduce perceived coloration when ON; OFF is a bypass. Do not replace an approved master without an explicit matched-volume listening comparison.
- Full original reload still loses the in-memory audio stems, even though the preset JSON persists settings.
