# A$RAM ENGINE — SATURN LAB V0.1 (2026-11-05)

## Mandate and frozen baseline

SATURN is an ISOLATED, OPT-IN experimental motion/rear-resonance engine based on backup/tt3-final-approved-export-match-2026-11-04. Preserve TT2 surgical precision and TT3 approved master quality. No unintended radio/lo-fi grain. No production merge, no Dolby Atmos, no 5.1.

Other frozen versions: backup/room-v4.3-halo-listening-reference-2026-11-03; backup/pre-orbits-v5-audio-integrity-frozen-2026-11-04; backup/room-orbits-v4.5-listening-tt3-2026-11-04; backup/room-orbits-v4.6-synced-voice-priority-2026-11-04. These branches are engineering source snapshots; actual user WAV and JSON preset must be kept separately.

Branch: feature/saturn-lab-v0.1-isolated-2026-11-05.
Existing core DSP source files (ROOM/HALO, microOrbits V4.6, Superboost, denoise, dynamics, finish, limiter, mastering and WAV24) unchanged. SATURN is OFF by default and returns the exact original master AudioBuffer by identity when OFF, zero wet or empty scene.

## Artistic design

Approved master stays in the front as-is: kick, snare, direct LEAD. SATURN adds only high-passed copies of short snippets with left/right slide, movement toward the rear and independent rear delayed trails. Sound-objects seeming to slide in Frank Ocean's DHL are an aesthetic listening reference; there is NO copying, source import or reverse-engineering of that track. SATURN stereo trajectories are psychoacoustic cues, NOT discrete Atmos or guaranteed 3D rear localization. With real ADLIBS, DOUBLES and LEAD stems there is no beat stem in the wet path; in a premixed stereo source, a high-pass CANNOT perfectly prevent snare or vocal leakage.

## Implemented Sprint 1 / V0.1

- Separate audio module src/audio/saturn.ts; WET ONLY, post-master. Original dry PCM never EQ'd, compressed, attenuated, repositioned or mutated.
- SATURN scene component src/SaturnPanel.tsx: fixed front anchors, rear scene, animated selected path line and moving playhead dot, event editor and synchronized timeline.
- Named one-click controls: SATURN PRESET · DEEP REAR / SATURN PRESET · SLIDING FIELD.
- V4.6 event list can be COPIED into SATURN without erasing or changing it, retaining source, level, time and roughly matched route, with unique new IDs.
- SATURN Scout up to 24 new moments per whole-track scan; up to 12 near playhead ±5s; maximum 48 stored events to cap rendering cost and accumulated wet energy. Heuristic is local DSP, not AI instrument separation or actual speech recognition; existing events remain and are not auto-cleared.
- Optional wet-only HRTF, OFF by default; separately rendered stereo-reference wet mix used for RMS matching within ±4dB. Cannot promise equal perceived timbre/volume; legacy ROOM HRTF if manually ON can still color dry separately.
- Lead-priority wet ducking and high-pass on wet source; no beat stem source.
- 3ms lookahead / 45ms release gain-envelope safety bounds WET contribution to sample peak <=0.985 without changing existing dry samples; no claim of certified true peak or correction to existing clipped source.
- Optional V6 preset keys saturnSettings and saturnEvents preserve backwards compatibility (no audio files embedded). Early preset import works; replacing a stem disarms SATURN until ROOM rebuild.
- EXPORT MATCH B compares against the very same SATURN-processed PCM buffer written by 24-bit WAV, allowing for ~1 LSB dither / quantization.

## QA actually performed

TypeScript, 10 DSP invariants and Vite production build PASS. SATURN browser integration PASS in Chromium and WebKit: OFF/zero/empty identity, sample source immutable, event-local motion, HRTF wet-only path, 24 candidates on synthetic signal, no beat proposal, 48 overlapping simultaneous events on loud dry source sample-peak bounded at ~0.985 without reducing dry, preset V6 save/load, copy existing V4.6 events non-destructively, named preset, actual B playback PCM vs exported SATURN WAV within PCM24+dither tolerance.

Core V4.6 Orbits, export parity, V5 preset, ROOM, HALO, ROOM UI, audio recovery/Safari tab return and Superboost integrity regression suites passed in Chromium and WebKit on this branch before latest isolated UI/test-only edits.

Limitations: TT2 and TT3 actual user WAVs have not been provided or heard by this automated QA; cannot claim musician-grade sound, guaranteed rear position, unchanged subjective loudness or the removal of real TT4 radio artifacts. A full-song 48-event stress/performance assessment on the user's Mac is still required.

## Sprints 2 / 3 / 5 — retained ideas and deliverables

CHECKPOINT TWO SPRINTS (V0.1 completed, pending musician ears):
1. Freeze approved engineering versions, isolated post-master SATURN OFF identity and preserved V4.6 events; DONE.
2. 24/48-event Smart Scout, slide + rear field, wet headroom safety, HRTF experiment and export parity; DONE as prototype, NOT production-approved.

CHECKPOINT THREE SPRINTS (future):
3. Event Director: section/bar-aware confidence and event scoring, density budget (2-3 moving elements at once instead of 48 simultaneously), and curated user approval. Stereo movement with easing curves, two independent rear depth rings and independently controlled rear residence/tail. Compare stereo mono correlation, vocal center and snare transient presence at equal loudness. Animated path stroke should show event speed and actual segment, not claim real measured space.

CHECKPOINT FIVE SPRINTS (future):
4. HRTF gain/timbre integrity: wet-only matched level per time window and band, headphone A/B, stereo/HRTF crossfade, phase/low frequency guards. Optimize CPU: cache mastering, audio measurements and offline work, avoid entire master regeneration on slider edits, explore workers and local caching. No change to approved TT2/TT3 DSP.
5. Mature source versioning + local Mac setup, regression QA on real TT2/TT3/TT4 WAVs and stems, test MacBook Pro speakers, AirPods Max and Skullcandy Crusher ANC 2. Delivery WAV / LUFS estimate / peak / correlation audit and reproducible export. Branch promotion only on musician approval. Dolby Atmos/ADM/5.1 is an entirely separate later study, outside SATURN.

Parallel commitments: diagnose TT4's source radio noise before applying arbitrary denoising; preserve transparent A/B and WAV exact monitoring, refine limiter/true-peak methodology and analyzer caching, avoid moving bass/lead. Maintain all existing profiles, Superboost and ROOM settings unchanged.

## Local Mac development, once ready

Requirements: Node 22+, Git, npm and browsers for listening.

    git clone https://github.com/Matt-ams/A-RAM-engine-.git
    cd A-RAM-engine-
    git switch feature/saturn-lab-v0.1-isolated-2026-11-05
    npm install
    npm run check
    npm run test:saturn
    PLAYWRIGHT_BROWSER=webkit npm run test:saturn
    npm run dev

This is still a browser-based WebAudio app and runs DSP locally in the browser. Running the repository on a Mac is not equivalent to creating a native desktop DAW and does not make memory/render times unlimited. Never commit user audio files or tokens to Git.

## Musical listening gate

Save external copies of TT2/TT3 approved WAV and presets. In preview import TT3 + V6 preset, rebuild ROOM, verify SATURN OFF = original approved sound. COPY V4.6 EVENTS → SATURN; switch old ORBIT ENGINE OFF without clearing its list; choose DEEP REAR with SATURN ON at modest wet, then SLIDING FIELD. Compare HRTF OFF then optional ON with wet RMS matching. Listen at same level and export through B EXPORT MATCH. Report any hiss, bass box, clicks, phase, center-image drift or loss of snare snap. No production merge before listening approval.
