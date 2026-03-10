# SDK workspace

This directory contains the client SDK packages:

- `@silo/sdk-core`: framework-agnostic SDK utilities and shared signing exports.
- `@silo/sdk-react`: React provider/hooks on top of `@silo/sdk-core`.

## Setup

From the repo root:

```powershell
pnpm sdk:setup
```

If dependencies are already installed:

```powershell
./sdk/setup.ps1 -SkipInstall
```
