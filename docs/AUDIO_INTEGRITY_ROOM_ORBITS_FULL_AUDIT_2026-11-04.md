# A$RAM ENGINE — COMPLETE ROOM / ORBITS AUDIO-INTEGRITY AUDIT
Date: 2026-11-04
Status: **AUDIT PASSED for Orbits OFF / historical DSP preservation, ON requires listening approval**.
Scope: independent audit branch only; no modifications to any production branch, frozen listening reference or existing user master.

## 0. Chronology and evidence
- Frozen musical reference **V4.3 ROOM CENTER+HALO**: `backup/room-v4.3-halo-listening-reference-2026-11-03` @ `06cc35e8585ab0646aaa9ee470eeae5e93361885` (unchanged).
- Newly captured frozen **V5 pre-Orbits audio-integrity**: `backup/pre-orbits-v5-audio-integrity-frozen-2026-11-04` @ `840c03a699f42a8d3b58d5a28b0804c33bf8f933`. A branch is not intrinsically immutable; pin the commit SHA for a long-term reference.
- V4.4 Orbits experimental and V4.5 sensor motion, V4.6 synchronized mini timeline with voice priority are isolated experimental branches/Preview deployments, not merged into these backups.
- User screenshot URL is the **V4.5** preview; visible **ORBIT ENGINE · OFF**, despite displayed HRTF wet ON, WET INTENSITY 100%, REAR DEPTH 100% and 7 saved events. Those controls may be remembered but **the V4.5 Orbits wet renderer does not run when OFF**. Screenshot alone does not show ROOM's separate `binauralStems` HRTF flag, or reveal exactly what was playing during earlier listening.
- User explicitly says the near-Bizarrap-style reverb / subtle motion was heard **before V4.5**; don't incorrectly attribute those observations to later code.

## 1. Algorithm source freeze verification
- `src/audio/roomHalo.ts`, `src/audio/room.ts`, `src/audio/superboost.ts`: byte-identical by Git blob SHA from V4.3 reference → V5 pre-Orbits → V4.6.
- `src/audio/denoise.ts`, `src/audio/dynamics.ts`, `src/audio/limiter.ts`, `src/audio/finish.ts`, `src/audio/studioQuality.ts` and other legacy DSP modules: unchanged from V4.5 to V4.6; V4.3→V5 source was UI/session/audio-recovery oriented (see compare).
- `master()` function in App.tsx is **exactly identical source text** across all 3 reference versions V4.3/V5 pre-Orbits/V4.6, as is the `wav24()` serializer.
- This does **not** mean the actual mix output stays identical when ROOM settings, sources, HRTF or the new pre-master Orbit wet content are changed.

## 2. Actual cross-version 24-bit WAV parity — V5 pre-Orbits vs V4.6
Method: run two separate Vite apps from pinned source checkout in headless browsers, import identical 4-second synthetic 44.1k WAV files (BEAT, LEAD, ADLIBS), export the preset from original V5 containing HALO + SUPERBOOST, then load exactly that JSON and source audio in the V4.6 app; export equal-rate 24-bit stereo masters.
Script: `tests/cross-version-room-orbit-audit.mjs`.

| Comparison | Chromium | WebKit |
|---|---|---|
| V5 pre-Orbits vs V4.6 with Orbits OFF | Max normalized PCM diff ~0.00004506; mean ~0.00000658; RMS ratio essentially identical | **Exactly identical**, PCM diff 0 |
| V4.6 OFF vs V4.6 OFF + placed events, HRTF ON, wet 100%, rear 100% | **Exactly identical**, diff 0 | **Exactly identical**, diff 0 |
| V4.6 ON HRTF with one adlib event during break | Affects selected event; early 0–0.8s has exact 0 diff | Same |
| V4.6 ON without HRTF | Affects selected event; early 0–0.8s has exact 0 diff | Same |

Actual RMS in 1.5–2.5s event window (source-dependent, **not calibration**):
- Chromium baseline OFF 0.16405846; ON HRTF 0.16219355; ON non-HRTF 0.17004909.
- WebKit baseline OFF 0.16405672; ON HRTF 0.16200559; ON non-HRTF 0.17003689.
- Small end-of-song numeric differences occur due to the **post-Orbits master DSP being re-run** and stateful processing, even outside local event. They are extremely small in this synthetic fixture. **Do not generalize to arbitrary real TT3 material without testing it**.

**Conclusion:** no evidence that merely having Orbits in the code, with it OFF, changes ROOM or mastered WAV. When ON, the mix can change because the filtered wet fragments are injected **before** the final `master()` chain; master dynamics/limiter/finish then act on the updated sum. This is a real design limitation: the original dry ROOM signal is not independently immutable in the *final master* while Orbits is ON.

## 3. CRITICAL historical ROOM HRTF gain/wet balance finding
ROOM V4.3 `renderCleanHalo()` computes for **every original stem** (INCLUDING centered dry LEAD):
```ts
g.gain.value = Math.pow(10, st.gain / 20) / positions.length * (binauralStems ? .85 : 1);
```
If `binauralStems` is ON, all directly routed stems start with 85% linear gain (about −1.41dB relative to OFF). For non-centered positions, an HRTF `PannerNode` also modifies spatial transfer/distance/spectrum; it is **not correct** to promise that all source RMS must decrease, because the 3D panner may redistribute frequency/energy. The reverb HALO wet taps do **not** receive the same .85 direct scaling. This modifies perceived wet-to-dry balance and may push a deeper/washed-out spatial quality at the expense of direct lead grain and clarity.

Dedicated headless real-WebAudio test `tests/room-hrtf-gain-audit.mjs`:
- 357 Hz centered LEAD with HRTF flag ON, HALO 0: RMS OFF 0.1100, ON 0.0935, **exact 0.85 ratio**, Chromium & WebKit.
- Same centered LEAD with HALO wet: ratio ~0.8493, both browsers.
- Beat with non-center pan and depth: net RMS ratio ON/OFF approx **1.1125 Chromium, 1.0776 WebKit**, because of panner frequency/stereo transfer despite original .85 direct scalar. Thus do NOT simplify as "HRTF lowers the beat by 15%" in total RMS.
- The historical design already existed in the frozen V4.3 pre-Orbits reference. Changing it would change the user's approved sound; do not silently alter.

There are **two separate toggles**:
1. ROOM's `binauralStems` HRTF (can change *all STEMS* and ROOM itself).
2. REAR ORBITS' `orbitSettings.hrtf` WET ONLY (affects moving reflection layer, and only when Orbits enabled).
An ON label for Orbits HRTF, while Orbits itself is OFF, has **no rendering effect**.

## 4. Other controls that can mimic a "filter"
- Original A audition in STEM mode uses the **already rendered ROOM BUS** as source, not raw individual WAVs.
- B is the processed MASTER and includes any actively rendered Orbit wet layer.
- `IMMERSIVE MONITOR` may modify monitoring in headphones; should be OFF when evaluating export parity unless it is the intended listening format.
- SUPERBOOST is effective only if `superboostOn` and SPACE is NOT bypassed.
- `ORIGINAL LOCK` bypasses the B master on WAV export.
- V5/V6 presets restore ROOM/HALO/Superboost/stem controls; older V1–V4 presets cannot restore historical GAIN/PAN/MUTE/SOLO because they never included them.
- Re-recording or replacing the LEAD changes audio source waveform. Compare exactly the same source and time alignment when diagnosing a quality change.
- Safari audio contexts can suspend on tab switch, already addressed in independent branch with RESUME / REPAIR; browser reload still deletes in-memory buffers.

## 5. Tests: all PASS on audit's V4.6-equivalent source
- TypeScript + Vite build + 10 DSP invariants.
- ROOM Classic / Enhanced / HALO browser tests.
- ROOM UI behavior Chromium + WebKit.
- Orbits optional OFF identity, 3D movement, V6 preset recall, voice-priority wet attenuation and synchronized mini timeline Chromium + WebKit.
- Preset V5 file/stem/ROOM roundtrip and PCM comparison Chromium + WebKit.
- Safari tab-return / AudioContext recovery Chromium + WebKit.
- Superboost effective state, SPACE bypass, level-matched export PCM parity and stem preservation Chromium + WebKit.
- New **cross-version actual WAV** audit Chromium + WebKit.
- New **legacy ROOM HRTF gain behavior** audit Chromium + WebKit.

## 6. Recommended action WITHOUT changing approved sound
1. Preserve V4.3 reference and V5 pre-Orbits pinned backup, and the artist's already-exported TT2/TT3 masters.
2. For the next TT3 investigation, use **exactly the same** input stems, same JSON, and the same 5–10s passage. First compare pre-Orbits V5 versus Orbits V4.6 OFF with IMMERSIVE monitor OFF and output levels matched.
3. In V4.6 inspect ROOM `binauralStems` separately from Orbits HRTF. If the artist prefers tone with ROOM HRTF OFF, keep it OFF; depth can still come from ROOM HALO wet taps and controlled manual placement.
4. Activate Orbits on **one break-only event**, low WET (15–35%), compare 3D HRTF OFF/ON. HRTF OFF gives mostly stereo lateral motion, not reliable full front/back; HRTF ON may deepen localization while causing attenuation/coloration from acoustic panner. Do not raise wet to 100% as a reliable fix.
5. If the complaint exists ONLY when Orbits ON, prototype a **separate opt-in wet-level matched, post-master Orbit layer** for A/B testing, with peak-ceiling guard and no global dry bus dynamics interaction. This is a design proposal only, **NOT implemented or deployed** by this audit.
6. For the requested "move the left path" visual, V4.6 currently syncs its **position dot** to the player. Path curve is a static illustration; animating/illuminating path segments is a separate UI-only enhancement, never required to correct DSP.

## 7. Limitations
- User's real TT3, the saved preset actually used, exact Safari version and specific AirPods configuration were **not available in the test harness**. No claim of definitive root cause of the reported subjective grain loss in his exact track.
- Headless Linux WebKit approximates WebKit processing but is not the user's physical macOS Safari/headphones.
- Numerical WAV equivalence on synthetic fixture does not guarantee that two distinct recordings/mixes sound identical. Keep subjective level-matched listening as final approval.
- This audit added **tests and documentation only on a separate audit branch**, without touching the approved listening reference or changing production.
