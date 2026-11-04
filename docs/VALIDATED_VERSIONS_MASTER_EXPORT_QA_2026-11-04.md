# A$RAM ENGINE — FINAL VALIDATED-VERSION SOUND INTEGRITY CHECK
**Date:** 2026-11-04  
**Issue:** TT3 external WAV sounds dirty/less precise than the old TT2 approved master; occasional "radio" texture and clicks; inside ENGINE can appear clean. Preserve surgical TT2 quality and isolate real discrepancies before adding Smart Scout features.
**Scope:** independent fix branch `fix/v4.6.3-verified-export-audition-2026-11-04`, based on Export Match V4.6; NO production merge; ZERO modification of DSP algorithms.
  
## Version references / freezes
The following reference branches are still present with their concrete Git commits:
| Reference | Commit | Purpose |
|---|---|---|
| ROOM V4.1 | `bdab5dc506eaaf82c5c4f3e48ab3ece5f13ee080` | pre-spatial upgrade |
| ROOM V4.2 | `170fa3c20de7e10566ce740cf53c5029f3521a15` | spatial version as heard |
| ROOM V4.3 CENTER+HALO | `06cc35e8585ab0646aaa9ee470eeae5e93361885` | approved musical listening reference |
| V5 pre-Orbits | `840c03a699f42a8d3b58d5a28b0804c33bf8f933` | last audio-integrity version before Orbits |
| V4.5 TT3 Orbit | `47184e423e0fe1a92225af78ebc264db8fac25d2` | experimental listening snapshot |
| V4.6 Orbit synced/voice priority | `ea328099b6ae9b2c2b217ce32e11ee995acff2a1` | controls, timeline, voice-priority snapshot |
| Export Match V4.6 | `a453471997f53a9da172b606f2a2a1a78c22cfb6` | verified B/WAV monitoring parity, independent draft |
Note: Branches are human-managed bookmarks, not immutable tags; **commit SHA is authoritative**. TT2's original WAV file was not supplied and is not stored in Git; treat the *approved recording* as the final auditory reference, not just a source commit.

## Source-level DSP fingerprint audit
Fetched all reference branches into QA sandbox and SHA256-hashed the exact file bytes.
- `roomHalo.ts`: **byte-identical** from V4.3 → V5 → V4.5 → V4.6 → Export Match → new fix.
- `room.ts`: **byte-identical** from V4.2 → all following versions.
- `superboost.ts`, `denoise.ts`, `dynamics.ts`, `limiter.ts`, `finish.ts`, `immersive.ts`: **byte-identical** from V4.1 through the new fix.
- `microOrbits.ts`: same source from V4.6 → Export Match → new fix. (Earlier V4.5 differs by design.)
- `master()` App.tsx source: **same SHA256 `16d5d668822287c7…`** from V4.3 through new fix.
- `wav24()` App.tsx source: **same SHA256 `43356c0b59d802c9…`** from V4.3 through new fix.
- Legacy ROOM HRTF historically scales dry stems 0.85 and can change spatial timbre; Orbits HRTF is a separate wet-only switch. **This is not a new regression**.
- Orbits ON adds filtered event wet BEFORE `master()`, potentially interacting with dynamics/limiter; Orbits OFF does not modify the source audio. This mechanism has not been redesigned; no unapproved tonal correction.

## Defect fixed in this branch: stale A/B listening on audio setting changes
A V4.6 code path could allow active B playback of the **old AudioBuffer** while a new ROOM, Orbit, profile or delivery master was rendering. The user might hear the old sonically desirable track then export the *new* master. This is an actual state-consistency bug, not proof of the reported radio noise root cause.

Changes:
1. Whenever a new master rendering dependency changes, `useEffect` stops active playback and invalidates the previous processed buffer before async re-render.
2. Editing active Orbit settings or events invalidates the current B buffer *synchronously* in the event callback, eliminating an old-export window while React effects catch up.
3. Editing Orbit events or settings with Orbits **OFF** is metadata-only: it no longer stops the music, invalidates or recomputes the previously approved audio buffer. This corner case was caught by regression tests.
4. **Export Match** continues to use the exact WAV PCM buffer at unity, without listening-only immersive and monitor gain. Original Lock selects the corresponding original source for both B and export.
5. Existing **VERIFY EXPORTED WAV** can parse a downloaded PCM24 file, compare every sample against the current buffer within quantization+dither tolerance, and report mismatches. Checking a previously rendered export against newly changed settings should result in PCM MISMATCH.

## Measured tests
- `npm run check`: TypeScript, 10 DSP invariants, Vite build PASS.
- New `npm run test:stale-export` Chromium/WebKit PASS: Orbit OFF edits preserve ongoing playback & export, active changes stop old audio and disable export until new master, new WAV differs from previous, Verifier accepts latest WAV and rejects previous, new B samples differ from PCM24 only ~2.086e-7 peak normalized.
- `npm run test:export-match` Chromium/WebKit PASS from earlier: actual real-time `AudioBufferSourceNode` PCM vs downloaded WAV 24-bit max difference ~1.8e-7, independent of monitor -18dB and immersive monitoring; Original Lock parity, repeated WAV byte identity; intentional bit corruption causes verifier mismatch.
- `npm run test:orbits` Chromium/WebKit PASS: numeric wet-only bypass and scene, HRTF, V6 settings, vocal priority and mini timeline, stem replacement.
- Existing preset V5 roundtrip, ROOM Classic/Enhanced/Halo, ROOM UX, AudioContext/Safari tab recovery and boost/preset integrity PASS Chromium & WebKit in earlier QA runs; recheck on latest branch before release.
- Previous cross-version real PCM A/B (V5 pre-Orbits vs V4.6 Orbits OFF): WebKit byte-identical, Chromium difference max ~4.5e-5 normalized in synthetic fixture. Does not establish equality of unknown TT2 and TT3 real WAVs.

## Remaining honest limits
- **TT2 "surgical" reference WAV and TT3 problem export not available** in repository/current runtime. We cannot measure actual spectral/phase/loudness differences, identify two clicks' root cause, or assert the radio texture is gone.
- Subjective perceived clarity can depend on new stem re-recording, preset, ROOM/HRTF, source saturation, dynamics, Orbit intensity, playback hardware and normalization. No evidence yet to justify changing the proven master/Denoiser DSP.
- Full macOS Safari / physical AirPods Pro Max listening not performed in the test harness. Chromium/WebKit are automated surrogates only.

## Conservative TT3 verification at user's return
1. **Save V6 preset**, retain TT2 approved WAV and TT3 current stems/files.
2. Lower Mac hardware volume first. In isolated fix Preview, load identical TT3 stems and preset, BUILD/REBUILD ROOM, keep ROOM and Orbit HRTF OFF per preferred listening reference, select B EXPORT MATCH ON.
3. Compare exact refrain seconds, export WAV; then use **VERIFY EXPORTED WAV** to confirm the downloaded file matches the PCM in the running ENGINE session.
4. If it reports PCM MATCH but external player seems dirtier, check system spatial enhancements/normalization, levels and headphones; optionally compare via QuickTime/VLC/etc with enhancements OFF.
5. If noise is audible within B Export Match too, A/B Orbit OFF/ON and then DENOISER/dynamics as controlled tests — do NOT silently impose another filter.
6. For truly quantitative TT2 vs TT3 comparison, analyze supplied actual WAV files and matching preset metadata (loudness/spectra/transients/noise floor) before changing mastering DSP.

**Gate:** Do not merge/promote production; no more Smart Scout features until direct exported TT3 quality approved.
