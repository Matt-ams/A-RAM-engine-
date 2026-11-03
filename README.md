# A$RAM ENGINE — source history

> **Critical provenance note (2026-11-03):** The last known running **V4 deployment** is preserved on Vercel at https://asram-engine-bquooi2lf-monsieeurm-7611s-projects.vercel.app (deployment `dpl_6bDzenDqYkMfHEh9pZwgZHwnRVY1`). It must not be overwritten until a candidate is validated.
>
> Vercel exposes the V4 source tree, but its file-content connector truncates large source files. As a result, the initial Git commit is a **faithful V3.5 AppDeploy source archive**, **not a claim to be an exact V4 source backup**. The V4 deployment itself remains the authoritative V4 rollback point.

## Branches
- `archive/v3.5-original`: verified V3.5 source snapshot (AppDeploy app `a-ram-engine-1guvtm`).
- `feature/v4.1-precision-spatial`: reconstruction and new improvements; must be built and tested before deploying.

## Security
This project contains original audio-processing code. **Set repository visibility to Private in GitHub settings** before sharing source or adding tokens; never commit credentials, raw music, presets containing personal data, or recordings.

## Development
`npm install && npm run build`; Vite + React + TypeScript. All DSP processing is local browser audio (no user-uploaded audio sent to a remote server by the frontend).
