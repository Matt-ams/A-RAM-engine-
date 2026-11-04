# A$RAM ENGINE — Complete Studio Preset V5 (2026-11-04)

## Purpose
User exported TT2 successfully with a V4 settings JSON and reported that the sonic setup sounded the same. That is entirely plausible: V4 stored ROOM mode, HALO, HRTF, center lead, depth, copies, room size, all mastering controls; original STEM gains/pans/mutes/solos were NOT stored and might already have matched the previous session or defaults. No claim can be made about the exact user's TT2 sound without his original audio files/exports for comparison.

V5 remedies the missing original-STEM controls; V4 and earlier JSON are still imported but display a clear legacy notice to avoid false claims of completeness. A preset is settings, never a self-contained audio project.

## Changes to interface / settings, NOT acoustic algorithms
- SAVE SETTINGS exports schema version 5 with `stemMix` for beat, lead, doubles, adlibs (`gain`, `pan`, `mute`, `solo`).
- Same JSON retains the existing ROOM classic/enhanced/halo selection, copies, depths, HRTF, room options, HALO, center lead, all master parameters, DSP module toggles, monitor configuration.
- LOAD SETTINGS FIRST is exposed on the initial STEM input screen. User loads stems and imports JSON in either order, then BUILD ROOM **once** with the restored controls.
- The post-render STEM SOURCE MANAGEMENT panel now exposes gains/pans/mute/solo. Any edits make ROOM dirty and disable WAV export until rebuilt.
- Old v1–v4 JSONs import normally. The V4 legacy notice makes clear original STEM mix controls were never stored; importer cannot synthesize missing historical user state.
- V5 loader validates required original stem controls and refuses malformed/out-of-range payloads before mutating settings.
- No audio PCM, waveform, or uploaded source file is embedded in JSON.

## QA performed
- `npm run check` (TS, 10 DSP regression invariants, Vite production build): PASS.
- `npm run test:preset:v5` Chromium and WebKit: PASS, fully exercises custom 3-stem mix, mute, asymmetric pan and gain, a ROOM V4.3 Halo reflection + spatial copy, SAVE JSON, NEW SESSION, IMPORT BEFORE BUILD, load identical audio, one BUILD, both 24-bit WAV exports. Round-trip numerical parity:
  - Chromium, measured largest absolute PCM difference in prior run: ~0.000064 full scale; average ~0.0000088 full scale, with unchanged file format and length.
  - WebKit, that run: exact 24-bit WAV parity (0 differing samples).
- `npm run test:room`, `test:halo`, `test:room:ux` in Chromium & WebKit, `test:audio:recovery` in Chromium & WebKit: PASS.
- Legacy V4 imported with explicit warning and old missing settings left untouched; malicious V5 overrange gain blocked.

## No touching the TT2 listening sound
V4.3 musical reference remains on `backup/room-v4.3-halo-listening-reference-2026-11-03`; V4.3.1 and V4.3.2 deployments remain separate. All DSP modules and ROOM render graph must be compared to V4.3.2 before promotion. No new spatial effects or mixing algorithms were added by this work. User's released TT2 master is not changed.

## Known limits
- The settings JSON alone cannot reconstruct an audio file. The exact input STEM contents, sample rate, file versions, browser audio stack, and DSP render result can affect reproducibility.
- Floating-point/Web Audio render may not be bit-exact across independent runs, particularly when HRTF or DSP is enabled. The automated V5 round-trip test uses a tight normalized PCM tolerance rather than incorrectly claiming universal sample-perfect exports.
- Browser refresh still loses the in-memory audio sources; re-import identical files and the preset.
- Correct stereo master still requires human A/B listening and verification; the numerical tests are not subjective sonic QA.
