import type { Context } from "hono";

import type { Bindings, Variables } from "../../types/bindings";
import { abortMultipartUpload, deleteObject } from "../../services/r2/upload";
import {
  deleteUploadMetadata,
  getUploadMetadata,
} from "../../services/tus/metadata";
import { HTTP_STATUS, TUS_VERSION } from "../../utils/constants";
import { Errors } from "../../utils/errors";

export async function handleTusDelete(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<Response> {
  const tusResumable = c.req.header("Tus-Resumable");
  if (tusResumable !== TUS_VERSION) {
    throw Errors.invalidTusVersion(TUS_VERSION, tusResumable);
  }

  const uploadId = c.req.param("uploadId");
  const projectId = c.get("projectId");

  const metadata = await getUploadMetadata(uploadId, c.env);
  if (!metadata) {
    throw Errors.uploadNotFound(uploadId);
  }

  if (metadata.projectId !== projectId) {
    throw Errors.unauthorized("Upload does not belong to this project");
  }

  if (metadata.multipartUploadId) {
    try {
      await abortMultipartUpload({
        adapterKey: metadata.adapterKey,
        uploadId: metadata.multipartUploadId,
        env: c.env,
      });
    } catch (error) {
      console.error("Failed to abort multipart upload:", error);
    }
  }

  try {
    await deleteObject(metadata.adapterKey, c.env);
  } catch (error) {
    console.error("Failed to delete R2 object:", error);
  }

  await deleteUploadMetadata(uploadId, c.env);

  return new Response(null, {
    status: HTTP_STATUS.NO_CONTENT,
    headers: {
      "Tus-Resumable": TUS_VERSION,
    },
  });
}
