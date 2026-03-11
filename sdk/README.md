# SDK workspace

This directory contains the client SDK packages:

- `@silo-storage/sdk-core`: framework-agnostic SDK utilities and shared signing exports.
- `@silo-storage/sdk-react`: React provider/hooks on top of `@silo-storage/sdk-core`.

## Setup

From the repo root:

```powershell
pnpm sdk:setup
```

If dependencies are already installed:

```powershell
./sdk/setup.ps1 -SkipInstall
```
