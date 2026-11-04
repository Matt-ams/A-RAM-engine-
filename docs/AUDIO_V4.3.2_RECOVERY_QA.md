# A$RAM ENGINE V4.3.2 — Audio context recovery and transport reliability

Date: 2026-11-04
Preview branch: `fix/audio-context-recovery-v4.3.2`
Base: `feature/room-v4.3.1-workflow-stability`. Listening backup: `backup/room-v4.3-halo-listening-reference-2026-11-03`, unchanged.

## User-facing bug
Safari can suspend or interrupt browser audio after focus/device changes. Previously, the transport constructed or reused AudioContext without explicit resumption; PLAY could leave a silent source and appear responsive. At natural track end, the playhead remained at duration and another PLAY began ~10 ms before end, creating almost silent replays. Refreshing the page loses source file and AudioBuffer objects held only in React/browser memory.

## Fix (only audio transport, no PCM/DSP tuning)
- PLAY explicitly resumes an existing suspended/interrupted context inside user gesture, checks `state==='running'` and surfaces a failure instead of claiming successful playback.
- AUDIO output interruption triggers an explicit status. It stops the stale playback source without clearing audio files, source/processed buffers, ROOM or master settings.
- Manual **REPAIR AUDIO** button creates a fresh playback AudioContext and attempts `resume()`. User can retry PLAY without refreshing.
- Source `onended` callbacks and async resume use guards so stale callbacks cannot stop a newer source.
- A PLAY at the end of the track resets the starting offset to zero (or loop A) instead of replaying the final 10 ms.
- Decoding handles an AudioContext in `closed` state.

## Tests
- TypeScript compilation and production bundle PASS.
- Existing 10 DSP invariants, ROOM V4.2 browser, HALO browser, and ROOM UX Chromium/WebKit PASS.
- Dedicated `npm run test:audio:recovery` on Chromium and WebKit PASS, including forced suspension, recovery on PLAY, forced resume failure, manual REPAIR and preservation of active STEM files/ROOM state, end-of-track replay regression.
- Audio DSP file SHAs are byte-identical to V4.3.1: ROOM Halo, ROOM enhanced, limiter, denoiser and Superboost.

## Limitations
- This is a likely remediation, not proof of the user's specific Safari failure. Real-world device routing, system mute, headphone output and hardware interruptions may still prevent audible output.
- WebKit headless Linux tests are not exactly macOS Safari.
- Browser reload still discards in-memory audio source files and computed buffers; JSON presets save settings but NOT files. A separate optional local session persistence feature would be needed for guaranteed recovery after a full page reload.
- There is no claim that REPAIR affects sound quality, creates new frequencies, or changes musical processing. Do not promote or merge without user's own TT2 approval.
