# A$RAM ENGINE — REAR ORBITS V4.6 · Synced Mini Timeline + Vocal Priority

**Date:** 2026-11-04  
**Branch:** `feature/orbits-v4.6-mini-timeline-vocal-priority-2026-11-04`  
**Base:** `feature/rear-orbits-v4.5-motion-sweep-2026-11-04`  
**Status:** experimental, independent Preview only. **Not merged, not production**. V4.3 Halo listening reference, V5 audio-integrity and prior TT2/TT3 masters unchanged.

## User feedback and chronology
- User's comment about a subtle orbit motion near the end and a beautiful near-Bizarrap-style reverb was a listening observation **BEFORE the V4.5 correction**, not a review of its results.
- User re-recorded the noisy opening vocal and preferred the new take; no automatic replacement occurs when the DAW file changes externally. Must re-import LEAD in STEM SOURCES and rebuild ROOM; do not shift the vocal timeline.
- TT3 has distinct little details that exist only in breaks. User wants to see those event positions and the current playhead in Orbits *without scrolling back to the main transport*.
- User asks for mobile wet details that fit naturally between phrases instead of overlapping/masking the main direct lead. Keep beat and synth color untouched.

## Implemented V4.6
1. **ORBIT SYNC TIMELINE** inside the Orbits panel, below ROOM, with low-cost waveform silhouette from the actual current ROOM source buffer, full-length event-region overlays, active playhead, elapsed/total time, Play/Pause and seek controls. All are directly bound to the existing main transport and share a single AudioContext/player; there is no second audio render or competing audio source. Clicking a marker selects it and seeks the shared playhead to that event.
2. **Head map cursor sync:** dot on trajectory is driven by playback position within the selected event. Removed independently looping SVG animation that could suggest inaccurate movement when playback was stopped.
3. **SCOUT THIS BREAK ±4s:** focus signal-acoustic transient heuristic near playhead. SCOUT WHOLE TRACK remains. Both now *append nonduplicate events* (up to global cap 12) instead of deleting previously arranged scenes; CLEAR is explicit bulk delete.
4. **VOICE PRIORITY · WET DUCK**, default 72%, adjustable 0–100%. A 32-ms sampled RMS detector analyzes the original LEAD AudioBuffer on a short schedule, then automatically reduces **only Orbit wet gain** while that direct vocal is present. Main LEAD, beat, ROOM dry signal, and master DSP unchanged. When the lead is quiet in a break, Orbit wet stays at full chosen level. Attenuation is gentler on a selected LEAD fragment than on selected adlibs/doubles to permit the intended voice reflection.
5. **V6 preset schema** persists the additional optional `voicePriority` setting in `orbitSettings` (same existing object, no version bump). Old V6 JSON without the field is valid and receives default 72%; v1–v5 are still accepted with Orbits OFF.
6. **Bypass safety:** `renderMicroOrbits` with enabled OFF or intensity zero returns the original AudioBuffer object. Vocal detector only runs when Orbit wet is active and a real unmuted LEAD stem exists. Pure stereo songs lack true separate LEAD detection; the UI clearly says so. Main master PCM stage `master()`, WAV writer, and existing ROOM/Helm DSP modules are untouched.

## What this does NOT do
- No semantic word recognition, speech transcription, deep learning source separation, object-based Dolby Atmos, or measured 3D headphone guarantee.
- Acoustic heuristic cannot reliably identify a sound already fused with bass/voice in stereo mix; when no LEAD stem exists the vocal-priority gate cannot act.
- Voice priority does not erase/repair noise in the vocal recording or rewrite the direct vocal. It is an adjustable *wet-only amplitude management* method, not frequency-selective source separation or high-end psychoacoustic masking optimization.
- Not proof of the final TT3 mix quality without listening to user's actual recording on the target Mac/headphones.

## Suggested TT3 break workflow
1. Keep approved TT3 beat / synth setup and saved master as immutable reference. Import newly re-recorded time-aligned LEAD (if needed) under STEM SOURCES; REBUILD ROOM BUS.
2. Confirm Orbits OFF and engine B is ready; check vocals and baseline before experimentation.
3. Scroll under ROOM to ORBIT SYNC TIMELINE, Play and seek directly to the break.
4. Select **SCOUT THIS BREAK ±4s** to propose small local details, or **+ DETAIL AT PLAYHEAD** for manual targeting. Use ADLIBS/DOUBLES when available; otherwise small sections of LEAD. Compare route `FRONT → RIGHT EAR → BEHIND` or `REAR LEFT → REAR RIGHT`.
5. Enable Orbits with modest WET INTENSITY 20–35%, rear depth ~70–85%, trajectory span ~80–90%, persistence 15–25%, and VOICE PRIORITY ~70–85%.
6. A/B Orbits OFF vs ON, listening for vocal naturalness and stable beat. Increase priority if mobile reflections overlap the lead; reduce priority if intended lead fragments are too faint.
7. Save V6 JSON; export a **separate test WAV**, do not overwrite the approved TT3 or TT2 version.

## Automated QA verified
- `npm run check`: TypeScript, 10 DSP invariants and production Vite bundle PASS.
- `npm run test:orbits`, Chromium and WebKit: PASS. Validates OFF identity, ON finite wet and unaffected dry windows, HRTF front/back routes, V6 preset recall, LEAD reimport safety, the synced mini seek and shared playback control, voice gate level and actual measured wet-signal attenuation under active vocal.
- `npm run test:preset:v5`, Chromium and WebKit: PASS with full stem/ROOM/audio preset numerical parity.
- `npm run test:room`, `npm run test:halo`, `npm run test:room:ux` Chromium and WebKit, `npm run test:audio:recovery` Chromium and WebKit, `npm run test:preset:audio` Chromium and WebKit: PASS.
- Compared source SHA: `roomHalo.ts`, `room.ts`, `superboost.ts`, `denoise.ts`, `dynamics.ts`, `limiter.ts`, `finish.ts`, `studioQuality.ts` unchanged vs V4.5. Master function and 24-bit WAV encoder source unchanged.

## Remaining validation
- The actual Safari / AirPods acoustic localization and perceived mix masking in TT3 still require the user's own A/B listening.
- The audio engine still runs offline per parameter change and can lag for long stems; waveform mini view is memoized per source buffer to avoid unnecessary CPU churn.
- Safeguard existing files: preset JSON stores settings and event positions, NOT uploaded audio. Tab refresh can still drop in-memory audio.
