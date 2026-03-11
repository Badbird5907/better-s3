# @silo-storage/sdk-core

This package contains framework-agnostic primitives for Silo uploads and callback handling.

## Core Upload API

Use `createSiloCore` to:
- generate signed upload URLs (via `@silo-storage/shared`)
- register file intents with `/api/v1/upload/register`
- enable dev streaming mode (`dev: true`)
- configure callback URL behavior for production

```ts
import { createSiloCore } from "@silo-storage/sdk-core";

const uploadCore = createSiloCore({
  apiBaseUrl: "https://silo.example.com",
  apiKey: process.env.SILO_API_KEY!,
  projectId: "proj_123",
  environmentId: "env_123",
  projectSlug: "my-project",
  ingestServer: "ingest.silo.example.com",
  keyId: "sk-silo-abcd",
  signingSecret: process.env.SILO_SIGNING_SECRET!,
  callbackUrl: "https://app.example.com/api/silo/callback",
});

const prepared = await uploadCore.prepareUpload({
  file: {
    fileName: "photo.png",
    size: 1234,
    mimeType: "image/png",
  },
});
```

## Callback URL

`sdk-core` only accepts absolute callback URLs. Path/origin resolution should be
handled by framework-specific adapters.

## Dev SSE Consumption

When registering with `dev: true`, `/api/v1/upload/register` returns SSE.
Use `consumeDevRegisterSse(...)` to parse `connected`, `chunk`, `keepalive`, and `error` events.

## Callback Signature Verification

Use `verifyAndParseUploadCallback` to verify callback signatures and parse the callback envelope,
or call `verifyCallbackSignature` directly when you only need signature verification.
The callback must be signed with the requesting API key's signing secret.
