# A$RAM ENGINE — Export / Audition Parity Repair · 2026-11-04

## Context and user acceptance criterion
A$RAM musician reports the exported TT3 master sounds qualitatively worse / "radio grain" than the version heard in ENGINE, while the older mastered TT2 sounded extraordinarily surgical. This is a reported quality regression, **not** an invitation to create intentional lo-fi/industrial character. Preserve all approved ROOM/HALO, TT2, Superboost, dynamics, waveform, Orbits V4.6 and mastering algorithms. Preserve original TT2/TT3 files.

## Confirmed signal-path mismatch (pre-fix)
- B · ENGINE reads the existing `processed` PCM AudioBuffer, while Export WAV writes `wav24(processed)` unless ORIGINAL LOCK is active.
- Playback additionally applies a **listening-only Monitor Level** (default -6dB) and, if IMMERSIVE MONITOR is enabled, a **listening-only stereo matrix** (roughly same-channel x1.12, opposite channel x-0.12) before output. These effects NEVER enter WAV.
- In original-lock mode, old B playback still selected `processed` whereas export selected `source`, a second definitive mismatch.
- A · ORIGINAL when using stems auditions the previously built ROOM BUS and does not represent the exported master.
- Platform Ready mode changes ceiling selection before offline rendering. A suffix such as PLATFORM_READY does not by itself prove audio degradation.
- The 24-bit WAV encoder applies bounded deterministic TPDF dither at approximately 1 LSB; it cannot alone explain clearly audible intentional lo-fi texture.

## Fix on independent feature branch, no DSP changes
- New **EXPORT MATCH** on by default: selecting B auditions EXACTLY the AudioBuffer fed to WAV export, without monitoring gain, immersive monitoring matrix, or noise-removal-only audition. Unity (0dB) software playback. System volume and headphone playback still depend on user's hardware.
- With ORIGINAL LOCK enabled, B instead auditions the exact original PCM buffer to be exported.
- With EXPORT MATCH off, prior personal monitoring (volume and immersive listening matrix) continues working as before.
- EXPORT MATCH is added as a backwards-compatible optional V6 preset setting, defaulting ON for older V6 JSON.
- OriginalLock toggle stops previous playback to avoid silent inconsistency mid-playback.
- Export and B audition still share the existing `processed` render, no re-mastering when WAV is created. No changes to DSP algorithms or output PCM.
- Explicit UI labels and explanation that B EXPORT MATCH is the actual output, A is source (ROOM bus in STEM mode), not exported master.

## Automated QA, completed
- `npm run check`: TypeScript, 10 DSP invariants, Vite prod build PASS.
- `npm run test:export-match`: Chromium and WebKit PASS. Instrument the **actual real-time AudioBufferSourceNode.start()** and destination connections. Upload synthetic beat + lead stems, build ROOM HALO, enable an Orbit fragment, change monitor gain to -18dB and IMMERSIVE MONITOR ON, verify EXPORT MATCH B sends the same PCM sample values as downloaded WAV 24-bit. Max normalized abs difference 1.7881393e-7, consistent with PCM24 quantization and dither; preview monitor unity, no immersive output. Test legacy immersive remains available and ORIGINAL LOCK B matches locked WAV (max ~1.56e-7).
- `npm run test:orbits` Chromium and WebKit PASS in clean QA sandbox. Tests full orbit scenes, sidechain vocal priority, mini timeline and source replacement.
- `npm run test:preset:v5` Chromium and WebKit PASS. ROOM, HALO, ROOM UI both, Safari/audio-context recovery both, preset/boost audio integrity both PASS in the same QA sandbox.
- File SHA of all DSP modules including `src/audio/microOrbits.ts` identical before/after. `master()` and `wav24()` function source text identical.
- Intermittent earlier test run timeout occurred in a stale/overloaded Vercel sandbox; a new clean sandbox reran and PASSED all named tests. Do not represent that as conclusively ruling out real user bugs.

## Still unproven
- The user’s real original TT2 master and TT3 exports are NOT attached to this audit and have NOT been listened to or compared by machine. We cannot claim TT3's reported "radio" / 2 clicks are eliminated, or that TT2 and TT3 have equal quality.
- Noise recorded in stems, denoise settings, nonlinear distortion, dynamics, overlap of beat/bass/orbits and external players can still be audible even when playback/export parity is verified. Diagnosing requires same-point real TT3 and older reference files or at least exact timecodes and presets.
- Browser playback at 0dB may be significantly louder than previously default -6dB; warn not to change system volume thoughtlessly. Preserve hardware volume.
- This is a separate **Preview** until the user validates the exported TT3 recording; NO production merge.

## Suggested listening protocol
1. Keep frozen V4.3 / V5 pre-Orbits / V4.5 / V4.6 backups, original TT2 approved WAV and TT3 original stems.
2. Open the isolated export-match Preview with TT3 stems and JSON preset, REBUILD ROOM BUS, check ROOM + Orbits as desired; set B and EXPORT MATCH ON, with HRTF OFF if user prefers tone. **Lower Mac system volume first**, because software monitor moves from -6dB to unity.
3. Listen to precise chorus where "radio" appeared, and export WAV. Compare the downloaded WAV through a player with no enhancement/normalization or EQ to the exact same second in B EXPORT MATCH; match hardware level.
4. If radio still present both in Preview and WAV, isolate source by original ROOM BUS, Orbits OFF, Denoiser OFF/ON, Dynamics bypass, and identify whether a specific stem introduces it. The user’s preferred TT2 spectral signature is the benchmark, not new gritty texture.
5. No Smart Scout discovery enhancements or other audio additions until export parity and unwanted radio texture are resolved.

**Do not claim this repairs a previously rendered file or restores subjective mastering precision without listening to actual user audio.**
