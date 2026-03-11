# @silo-storage/sdk-server

Framework-agnostic router runtime for Silo uploads.

This package, inspired by the UploadThing SDK, provides a 
framework-agnostic router for defining typed file routes with middleware.

## What it provides

- `createSiloUpload()`: define typed file routes with middleware
- `registerRouteUpload(...)` / `prepareRouteUpload(...)`: run middleware and
  register uploads through `@silo-storage/sdk-core`
- internal callback envelope in `callbackMetadata.__silo`
- `handleUploadCallback(...)`: verify callback signatures and dispatch
  `onUploadComplete` handlers

## Example

```ts
import { createSiloUpload, type FileRouter } from "@silo-storage/sdk-server";

const f = createSiloUpload<Request>();

export const fileRouter = {
  imageUploader: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
      const userId = req.headers.get("x-user-id");
      if (!userId) throw new Error("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, fileId: file.fileId };
    }),
} satisfies FileRouter;
```