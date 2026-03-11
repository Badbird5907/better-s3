import { createSiloUpload } from "@silo-storage/sdk-server";

type UploadContext = {
  userId: string | null;
};

const f = createSiloUpload<Request, UploadContext>();

export type UploadCompleteResult = {
  uploadedBy: string;
  fileKeyId: string;
  accessKey: string;
  fileName: string;
  size: number;
  mimeType: string;
};

export const fileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 4,
    },
  }, {
    isPublic: true,
  })
    .middleware(async ({ context }) => {
      if (!context?.userId) {
        throw new Error("Unauthorized");
      }

      return {
        userId: context.userId,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        fileKeyId: file.fileKeyId,
        accessKey: file.accessKey,
        fileName: file.fileName,
        size: file.size,
        mimeType: file.mimeType,
      } satisfies UploadCompleteResult;
    }),
};

export type AppFileRouter = typeof fileRouter;
