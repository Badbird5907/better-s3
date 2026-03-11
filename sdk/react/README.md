# @silo-storage/sdk-react

React SDK for Silo.

## Quick start

```ts
import { createSiloReact } from "@silo-storage/sdk-react";
import type { AppFileRouter } from "@/app/api/upload/core";

export const { useUpload, UploadButton, UploadDropzone, SiloRouterConfigProvider } =
  createSiloReact<AppFileRouter>({
    endpoint: "/api/upload",
  });
```

`useUpload` supports:

- `onUploadBegin`
- `onUploadProgress`
- `onComplete` (typed from route `onUploadComplete` output)
- `onError`
- `onUploadAborted`

Bulk and single uploads:

```ts
const upload = useUpload({ endpoint: "imageUploader" });
await upload.uploadFiles(files, { input: { albumId: "abc" } });
// or
await upload.uploadFile(file, { input: { albumId: "abc" } });
```

Headless components:

- `UploadButton` (unstyled file-picker trigger)
- `UploadDropzone` (unstyled drag-and-drop region)
