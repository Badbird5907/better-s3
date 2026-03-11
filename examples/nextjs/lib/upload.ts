import { createSiloReact } from "@silo-storage/sdk-react";

import type { AppFileRouter } from "@/app/api/upload/core";

export const { useUpload, UploadButton, UploadDropzone, SiloRouterConfigProvider } =
  createSiloReact<AppFileRouter>({
    endpoint: "/api/upload",
  });
