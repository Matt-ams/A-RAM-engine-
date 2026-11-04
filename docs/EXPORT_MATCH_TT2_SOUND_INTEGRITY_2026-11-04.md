# A$RAM ENGINE — EXPORT MATCH V4.6 AUDIO PARITY (2026-11-04)

## User reported
- TT2 master was exceptionally clean, voice centered, bass precise, reflections wide. Subsequent test export `A$RAM_STEM_SESSION_PLATFORM_READY_24BIT_2.wav` reportedly had continuous radio/lo-fi grain, more saturation and loss of clarity compared with an older `Fichier 1`/TT2.
- The user hears some tests as clean inside ENGINE but dirtier after export. External feedback (Gemini) agrees subjectively, but neither source WAV and finished WAV pair was supplied to this code harness.
- The goal is to preserve frozen TT2/V4.3 ROOM and V4.6 Orbits quality without silently rewriting any DSP.

## Confirmed live-monitor vs WAV mismatch
Before this fix, the actual **B ENGINE playback buffer** was the same `processed` AudioBuffer the WAV export serializes, but live monitoring could add:
- MONITOR LEVEL, default **−6 dB**, listening-only.
- IMMERSIVE MONITOR, an optional stereo crossfeed/width matrix, listening-only.
- A/B monitor level-matching and audition removed noise could confuse evaluation.
- ORIGINAL LOCK selects unprocessed `source` for export even if B playback was still `processed`.
So what was heard **at the speakers** could be materially different from the file on disk even when the underlying PCM buffers were the same.

## V4.6 EXPORT MATCH fix (opt-in compatibility)
- `EXPORT MATCH · ON` is the default on this **isolated preview**.
- In **B ENGINE**, audition **exactly** the buffer chosen by WAV export (`processed`, or `source` when ORIGINAL LOCK). B monitor at unity 0 dB; listening-only immersive processing and removed-noise audition are excluded.
- `EXPORT MATCH · OFF` restores the previous monitoring behavior, with MONITOR LEVEL and optional IMMERSIVE MONITOR.
- Always stop playback when toggling export match or ORIGINAL LOCK, so stale audio nodes cannot keep playing an old source.
- The export writes `wav24(buffer)` with a deterministic tiny dither/quantization; no extra EQ, saturation or bit-depth degradation is applied at export.
- The controls visibly state what is heard. Exports stay 24-bit stereo and maintain the original sample rate.
- AUDIO SAFETY: in export-matched B mode, monitor is at **unity 0 dB**, which may be louder than prior default −6 dB. Turn down headphone/device volume before play.
- The existing ROOM V4.3 HALO, Superboost, limiter, dynamics, denoiser, finish, Orbits renderer, master function and WAV serializer were not modified.
- No automatic denoise or grain correction has been applied. A real TT2-vs-new-export file test is still needed before claiming the underlying grain defect is solved.

## Browser QA
New `npm run test:export-match` Chromium and WebKit PASS:
- Synthetic WAVs → STEMS → V4.3 CENTER+HALO → one Orbit wet event ON → ENGINE B playback. Capture *the AudioBuffer actually handed to AudioBufferSourceNode.start*, then export the actual WAV.
- Direct signed PCM24 samples from WAV vs real B playback buffer: **maximum normalized difference 1.78814e−7** in both Chromium and WebKit (tiny deterministic dither/PCM24 quantization).
- Verify monitor gain 1.0 despite user setting −18dB, no listening-only immersive output even when IMMERSIVE MONITOR is toggled ON.
- Verify turning EXPORT MATCH OFF restores the optional immersive monitoring path.
- ORIGINAL LOCK B export matched vs source export delta below 2e−7.
- `npm run check`: TypeScript and 10 DSP invariants, Vite build PASS.
- `npm run test:orbits` Chromium and WebKit PASS (wet-only OFF identity, visual sync, V6 preset, vocal priority, lead replacement).
- `npm run test:preset:v5` Chromium and WebKit PASS (real WAV stem mix + ROOM preset parity).
- `npm run test:room`, `npm run test:halo`, `npm run test:room:ux` Chromium and WebKit PASS.
- `npm run test:audio:recovery` Chromium and WebKit PASS.
- `npm run test:preset:audio` Chromium and WebKit PASS (Superboost restoration, Safari tab return).

## What this does NOT prove or fix
- We do **not** possess TT2 and new TT3/SPECTRAL audio WAV pairs in the test harness. Cannot determine whether the new file is inherently more distorted, has radio noise, differs in master/profile/dynamics/stem source, or is simply perceived differently because monitoring EQ/volume changed.
- Code proof does **not** certify no output device/equalizer/spatial audio effects downstream (Safari, system settings, AirPods). Compare level-matched WAV and B export-match with external player spatial enhancements disabled.
- The `PLATFORM_READY` filename denotes delivery setting `delivery==='platform'`: this **changes the master rendering ceiling** to at most −1dB, before export. It is not a post-WAV effect; an exported studio vs platform master can sound different if the ceiling changed. Confirm both exports used identical delivery mode.
- `A` in STEMS is **the ROOM BUS**, not the raw original stems. It is NOT the mastered output the WAV exports.
- Existing HRTF on ROOM V4.3 (separate from Orbit wet-only HRTF) changes gain and panner tonality; check both flags. Keeping HRTF OFF can preserve dry voice character while HALO creates depth.
- Monitoring level/immersive mismatch was a real divergence; it does **not**, by itself, identify the source of radio texture that may be present in the exported waveform. Avoid pretending that this patch has eliminated a physical/audio defect without source files.

## Rollout
- Deploy only an isolated Preview from `fix/v4.6-export-playback-parity-2026-11-04`, not production.
- Keep `backup/room-v4.3-halo-listening-reference-2026-11-03`, `backup/pre-orbits-v5-audio-integrity-frozen-2026-11-04`, `backup/room-orbits-v4.5-listening-tt3-2026-11-04`, `backup/room-orbits-v4.6-synced-voice-priority-2026-11-04` and original TT2 export unchanged.
- Audition TT2 reference versus new export on the same headphone and at matched measured loudness. If a radio artifact remains in the B-export-match signal, collect the WAV and exact timecode so we can isolate DSP modules one at a time.
