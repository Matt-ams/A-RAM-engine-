# A$RAM ENGINE WEB — ORBIT 75 + MASTER INSPECTOR V0.1
Date: 2026-11-14
Branch: `feature/v5-orbit75-inspector-qa-2026-11-14`
Status: ISOLATED PREVIEW; not a master approval, production release or replacement of TT2 / TT3.

## Immutable listening references
- TT2 — `reference/tt2-room-v43-halo-frozen-2026-11-09`, Vercel: https://asram-engine-87q06c5fo-monsieeurm-7611s-projects.vercel.app/
- TT3 — `reference/tt3-approved-v46-frozen-2026-11-09`, Vercel: https://asram-engine-lvh51u7vp-monsieeurm-7611s-projects.vercel.app/
- V5.0 Preview — `release/v5-0-spatial-intelligence-preview-2026-11-09`, unchanged.
- This branch does not modify core DSP source files `room.ts`, `roomHalo.ts`, `superboost.ts`, `denoise.ts`, `dynamics.ts`, `limiter.ts`, `finish.ts`, `studioQuality.ts` nor the master WAV writer.

## ORBIT changes
- ORBIT_MAX_EVENTS: 48 -> 75 **in this preview only**. Historical 12-event bottleneck was already exceeded by earlier V5 work.
- Preset optional `orbitSettings.densityMode`: subtle (budget 20), cinematic (budget 40), experimental (budget 75).
- Mode is a suggestion/event addition cap, not a request to create filler or to add artificial energy. Already saved events are never deleted by mode switching.
- Whole-song musical director can now request higher budget for longer songs and still uses available vocal stems and structural onset evidence. It may produce far fewer events than the cap; this is correct behavior.
- UI curates proposed events with same-source spacing and no fourth overlapping event. This *does not* block manual overlaps: manual placements remain artist-controlled, and routing audit should warn about excessive concurrency.
- Legacy V6 presets without densityMode remain valid. No existing presets or audio are overwritten.
- More events may increase offline rendering time and memory. Validate on target Safari + headphones before considering production promotion.

## MASTER INSPECTOR V0.1
- Independent read-only panel using the existing source/output buffer metrics.
- Source vs Engine: integrated LUFS estimate, true peak, sample peak, crest, whole-song L/R correlation, DC offset, loudness and crest differences; buffer duration + sample rate match.
- Flags for intersample overs, near-ceiling outputs, low mono correlation, DC, excessive density; ROOM stale, original lock or pending render block a ready label.
- No changes to audio; no self-mastering, no loudness normalization, no arbitrary 'professional quality' numerical score.
- Doesn't guarantee surround, Atmos, subjective mix quality, clip-free behavior on all DACs or individual stem health. Whole-song statistics cannot prove musical quality.

## Automated gates
- `npm run build` includes a new deterministic schema / inspector test. Existing TT4, director, lyrics and beat integrity tests remain in the build script.
- Additional browser regression QA needed: `npm run test:orbits`, `npm run test:preset:v5`, `npm run test:preset:audio`, `npm run test:export-match`, `npm run test:room`, `npm run test:halo` on Chromium and WebKit.

## Artist acceptance test (NOT performed by an automated build)
1. Preserve original approved TT2 / TT3 WAVs, original stems and JSON presets. Never overwrite.
2. Load identical stems and exact approved preset in frozen reference and current Preview, rebuild ROOM, export 24-bit WAV on each.
3. Compare at matched loudness, including voice center, mono sub, transient attacks, rear depth, reflections and the actual exported WAV against engine audition.
4. With ORBIT disabled, the preview should preserve approved audio character. Turning it on must be an explicit act and generate a **separate** test export.
5. Exercise Subtle/Cinematic/Experimental. Count actual candidates (not requested budgets), audit 4+ overlap warnings, compare headroom, render time, and mono compatibility. Repeat with HRTF OFF/ON, particularly for actual AirPods Pro.
6. Test legacy V4/V5/V6 presets and the new optional densityMode, save JSON, new session, restore from stems and export. The loaded settings should be complete, and re-export should match within browser tolerance.
7. Do not promote before the artist approves TT2 and TT3 in ears. TT4 source-radio issues are still separate source restoration problems.

## Source limitation
This repository includes neither complete original TT2/TT3 stems nor exact personal approved preset/audio artifacts. Tests and successful Vercel builds cannot certify a subjective master; user listening is required. The GitHub V5 release branch and original deployed previews remain untouched.
