# TUS Stream Disconnect Regression

## Scenario 1: Mid-PATCH disconnect does not reset upload

1. Start worker with `pnpm --filter ./apps/cf-worker wrangler:dev`.
2. Start the demo app and choose a ~300MB file in `examples/nextjs/components/tus-upload-demo.tsx`.
3. Let upload reach ~20-40%.
4. Simulate a transient network drop while a PATCH is in-flight (pause network adapter for 1-2s).
5. Resume network and let tus client retry.

Expected:

- A failed PATCH returns `503` with `Retry-After`.
- Worker log contains `event: 'patch_retryable_failure'` and **no process-crashing uncaught stream exception**.
- Follow-up `HEAD /ingest/tus/:id` returns `200` (or `503` retry, never final `404` for active upload).
- Upload continues from last committed `Upload-Offset` (no new POST for a fresh upload).

## Scenario 2: Resume uses committed offset

1. Start an upload and pause at ~30%.
2. Resume upload.
3. Check logs around the pause/resume transition.

Expected:

- `patch_start.offsetBefore` on first resumed PATCH equals prior committed offset.
- `patch_committed.offsetAfter` monotonically increases.
- No new `upload_initialized` event is emitted for the same user action.
