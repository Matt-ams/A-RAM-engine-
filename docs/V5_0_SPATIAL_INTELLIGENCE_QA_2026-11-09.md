# A$RAM ENGINE V5.0 — SPATIAL INTELLIGENCE PREVIEW
Date: 2026-11-09. Status: isolated PREVIEW, NOT an approved TT2/TT3/TT4 sonic master and NOT a production merge.

## Philosophy
QUALITY · ENGINEERING · PRECISION. A best-sounding ROOM + core master is preferred over any number of new wet effects. TT2 and TT3 have different approved character. TT4 can explore deeper motion only if source quality is preserved.

## Frozen references (new independent branch snapshots)
- TT2 candidate ROOM V4.3 CENTER+HALO: reference/tt2-room-v43-halo-frozen-2026-11-09, commit 06cc35e, https://asram-engine-87q06c5fo-monsieeurm-7611s-projects.vercel.app/
- TT3 V4.6 EXPORT MATCH: reference/tt3-approved-v46-frozen-2026-11-09, commit a453471, https://asram-engine-lvh51u7vp-monsieeurm-7611s-projects.vercel.app/
- V5 experimental branch is isolated: release/v5-0-spatial-intelligence-preview-2026-11-09.
- TT2 original master WAV, true session parameters and exact preset are NOT in this repository. The TT2 archive is the engineering-era source, not guaranteed fingerprint reconstruction.

## What V5 includes
1. V5 Command Deck: explicit ROOM + CORE MASTER bypass (ORBIT/SATURN OFF, SUPERBOOST unchanged), motion engage only when approved events exist, real rendering/ROOM/original-lock states.
2. Event Route Audit: valid vs muted/disabled/missing/overlapping/quiet event indicators, each seekable. This is routing diagnostics; it does not certify audible localization.
3. PHRASE INTELLIGENCE: **opt-in** on-device Whisper Tiny English model run in a dedicated worker. Model download from Hugging Face is initiated only by click. Raw stem PCM is processed inside browser; not uploaded for inference. 16kHz resample, 18s sequential chunks, max 6-minute full scan. First-use model and ONNX runtime downloads can be large and may be slow or unsupported on some browsers. English-only model; do not claim multilingual.
4. ASR proposes transcript + estimated timestamps. All ASR results are **UNVERIFIED** and explicitly require manual review/correction before they can add any ORBIT event. Singing, harmonies, adlibs and reverb can cause completely false lyrics, hallucinations and off-time word timestamps. No automatic effect selection based on ASR text; no autonomous edits.
5. .LRC timed lyric import and manual phrase creation. Candidate approval converts a verified phrase into a bounded, vocal-stem-only ORBIT event, never moving the raw BEAT.
6. Source BEAT audit scans for possible isolated digital impulses, clipping and audio dropouts WITHOUT changing audio. It cannot uniquely identify or remove persistent Suno radio textures.
7. Existing BEAT RADIO LAB preserves its original/noise-profile-processed/removed-signal A/B with selected passage and monitor RMS match, keeps source unchanged. Noise-only reference mandatory. Do not turn aggressive denoise into a false 'repair' claim.
8. Previous 6.5-second phrase-aware ORBIT, longer event editor controls and responsive lower controls inherited.
9. Existing V6 JSON preset storage schema remains at version 6; V5.0 is the ENGINE product version, not the preset schema version.

## Verified (automated)
Vercel deployment dpl_DwSfDStN3sssEPNhF1XPyiJZtAKD READY at https://asram-engine-9oe0u7veq-monsieeurm-7611s-projects.vercel.app/ .
- TypeScript strict noEmit and Vite build PASS.
- Synthetic TT4 phrase scout and whole-song director spread tests PASS.
- V5 LRC parsing, ASR transcript word segmentation, zero auto approval, timestamp bounds, explicit phrase-to-ORBIT event tests PASS.
- V5 BEAT injected digital impulse, dropouts, clipping and event-routing safety tests PASS.
- Core DSP source identity: exact Git blob SHA matches the TT2 and TT3 frozen refs for audio/room.ts, roomHalo.ts, superboost.ts, dynamics.ts, denoise.ts, limiter.ts, finish.ts, studioQuality.ts, immersive.ts, quality.ts (10 modules). This does NOT mean entire rendering chain/monitor gains/settings are identical.
- ASR worker bundle is lazy and separate from main app; it also bundles ONNX WASM (around 21.6 MB runtime asset) plus downloads public model weights on first use, so the user must opt in and Safari runtime performance needs real testing.

## NOT YET PROVEN (mandatory listening QA)
- Actual Whisper English sung-vocal accuracy, timestamp reliability, browser memory/performance, model download completion and Safari/WebKit worker compatibility on TT2/TT3/TT4. No real user audio was supplied or played in this review.
- Real V5 sonic superiority, matched-loudness TT2 vs TT3 vs TT4, acoustic impression of rear depth, full-song HRTF/mono/headroom QA.
- TT4 source 'radio' / hachage BEAT defect: classification and reduction requires original BEAT WAV and marked time positions. No spectral removal algorithm can guarantee correction of an instrument-embedded artifact without changing wanted tone.
- The independently remembered candidate 52560ea is NOT found as a recoverable commit in the connected GitHub repo. Do not claim this Preview is byte-for-byte that sonic candidate.
- No production merge, no audio asset or original preset overwrite, and no change to installed Mac.
- V5 is PREVIEW / Release Candidate, not a finished certified mastering engine.

## Recommended musician acceptance gate
1. Import exact TT2 audio + saved V6 preset in frozen reference, compare matching export to original approved WAV.
2. Import identical source/preset in V5; run ROOM + CORE MASTER ONLY, export 24-bit WAV, compare measured level, center voice, bass phase, treble grain and rear depth.
3. Add ORBIT approved events and compare at *equal listening loudness*. Test headphones and mono; if added moving tails hurt TT2 precision, keep them OFF.
4. Try TT3 separately for own rear/voice character. Try TT4 on stem BEAT original first, run non-destructive audit, then apply only proven music-safe restoration.
5. Explicitly click local recognition on a short VOCAL-only 12–18s region; review the displayed words and boundaries against actual playback; approve one long meaningful phrase; evaluate movement and tails.
6. Promote only after actual user listens and confirms. Never substitute more events for a demonstrably better mix.

## Known architecture tradeoffs
- BASE: stable classic ROOM + core master; DSP file blobs proven unchanged.
- EXPRESSION: experiments isolated via ORBIT/SATURN toggles; physics is not discrete Atmos.
- INTELLIGENCE: local deterministic phrase/energy event suggestions and optional downloaded on-device Whisper; lyrics ALWAYS human-reviewed before touching ORBIT.
- QUALITY: A/B export match + source integrity audit; no misleading claim of radio artifact removal.
