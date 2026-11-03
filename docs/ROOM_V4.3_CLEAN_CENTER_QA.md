# ROOM V4.3 — CLEAN CENTER / HALO (experimental listening preview)
2026-11-03

## User feedback driving this revision
The V4.1 source/deployment sounds excellent; V4.2 Enhanced offered deeper ambience but at the cost of hollow/PVC vocal timbre, less proximity, dry beat losing the "infinite" layering character, and slight scrolling / processing lag. The user also observed a mosquito-like high tone sometimes, and described bypassing SUPERBOOST and DENOISER as improving clarity. Those observations are subjective user feedback, not verified recording analysis.

## Version safety
- V4.1 sound-reference: `feature/v4.1-precision-spatial` branch and its Vercel Preview.
- Immutable pre-V4.2 snapshot: `backup/room-v4.1-before-upgrade-2026-11-03`.
- Immutable as-heard V4.2: `backup/room-v4.2-as-heard-2026-11-03`.
- V4.3: `feature/room-v4.3-clean-center-halo`.
- The original Classic `buildBus` implementation remains untouched in `src/App.tsx`.
- **No production promotion, no merge**.

## Audio architecture
Three selectable, explicit modes: **CLASSIC** default (unchanged), **CENTER + HALO** (new), **ENHANCED** (prior 4.2 unchanged). V4.3 HALO derives its dry bus from the original Classic renderer. By default, it bypasses HRTF/duplicated-dry reflections for the LEAD primary, anchors vocal dry to the center, while keeping the original beat's classic copies. It adds a low-level, wet-only diffuse reflection path, never passing the unfiltered dry voice through a fake room filter. Three wide panned taps are delayed 83/141/223 ms (+ room-size offset); only the wet path has 420 Hz high-pass and 6.9 kHz low-pass decreasing with room absorption. Lead wet is further reduced by 0.38. Halo slider limited to 0–50% and defaults to 24%. With Halo=0 and CENTER LEAD OFF, the graph is derived directly from unchanged Classic logic.

Caveat: this is a deliberately conservative effect, not a physically simulated galaxy, Atmos, head-tracked binaural rendering or a measured room convolution. True source-specific effects remain dependent on actual musical stems. The original Classic itself can have intrinsic copy comb filtering when duplicating stems, and it remains intentionally unchanged to preserve the sonic reference.

## QA
- `npm run check`: TypeScript, DSP regression, production Vite build PASS.
- `npm run test:room`: Enhanced 4.2 compatibility, sample rates, stereo/HRTF, rebuilt copies, preset v4 and WAV PASS.
- `npm run test:halo`: 44.1-kHz synthetic voice + beat. First 60 ms dry samples match halo OFF within 6e-8, later wet path differs, no NaN/Infinity, source not mutated, full original 2s + new 0.36s tail; default Classic and all 3 spatial modes UI PASS.
- Rack OFF displays `OFF · CONTROLS AVAILABLE` instead of falsely suggesting disabled controls.
- Remaining: TT2/TT3 ears-on matched-loudness A/B, vocal timbre, tonal whine/mosquito, Safari UI scroll movement, long 161s performance, and exact export WAV parity of HALO under real sessions.

## Production gate
**Do not merge or promote until the listener prefers V4.3 to V4.1 on the same source**. Keep V4.1 as the sonic reference even if newer versions have more parameters.
