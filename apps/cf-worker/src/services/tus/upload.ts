import type { Context } from "hono";

import type { Bindings, Variables } from "../../types/bindings";
import type { TusUploadMetadata } from "../../types/tus";
import { readHeaderBytes } from "../../lib/hash";
import { areMimeTypesEquivalent, detectMimeType } from "../../lib/mime";
import {
  HTTP_STATUS,
  TUS_VERSION,
  UPLOAD_OFFSET_HEADER,
} from "../../utils/constants";
import { Errors } from "../../utils/errors";
import { sendUploadCallback } from "../callback";
import { completeMultipartUpload, uploadChunkToR2 } from "../r2/upload";
import { deleteUploadMetadata, storeUploadMetadata } from "./metadata";

export interface ProcessChunkParams {
  metadata: TusUploadMetadata;
  body: ReadableStream<Uint8Array>;
  contentLength: number;
  c: Context<{ Bindings: Bindings; Variables: Variables }>;
}

export interface ProcessChunkResult {
  newOffset: number;
  isComplete: boolean;
  response?: Response;
}

export async function processUploadChunk(
  params: ProcessChunkParams,
): Promise<ProcessChunkResult> {
  const { metadata, body, contentLength, c } = params;

  const newOffset = metadata.offset + contentLength;
  const isComplete = metadata.size !== null && newOffset >= metadata.size;

  const uploadResult = await uploadChunkToR2({
    adapterKey: metadata.adapterKey,
    chunk: body,
    chunkSize: contentLength,
    offset: metadata.offset,
    multipartUploadId: metadata.multipartUploadId,
    isLastChunk: isComplete,
    existingPartsCount: metadata.parts.length,
    env: c.env,
  });

  metadata.offset = newOffset;
  if (uploadResult.multipartUploadId) {
    metadata.multipartUploadId = uploadResult.multipartUploadId;
  }
  if (uploadResult.part) {
    metadata.parts.push(uploadResult.part);
  }
  await storeUploadMetadata(metadata, c.env);

  if (isComplete) {
    const response = await finalizeUpload(metadata, c);
    return { newOffset, isComplete: true, response };
  }

  return { newOffset, isComplete: false };
}

export async function finalizeUpload(
  metadata: TusUploadMetadata,
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<Response> {
  try {
    try {
      await fetch(`${c.env.NEXTJS_CALLBACK_URL}/api/internal/callback`, {
        method: "OPTIONS",
      });
    } catch {
      // warm up connection
    }

    if (metadata.multipartUploadId && metadata.parts.length > 0) {
      await completeMultipartUpload({
        adapterKey: metadata.adapterKey,
        uploadId: metadata.multipartUploadId,
        parts: metadata.parts,
        env: c.env,
      });
    }

    const fileObject = await c.env.R2_BUCKET.get(metadata.adapterKey);
    if (!fileObject) {
      throw new Error("Failed to retrieve uploaded file");
    }

    const actualSize = fileObject.size;
    const headerBytes = await readHeaderBytes(
      fileObject.body as ReadableStream<Uint8Array>,
      8192,
    );
    const actualMimeType = await detectMimeType(headerBytes);
    const actualHash = metadata.claimedHash ?? null;

    if (
      metadata.claimedMimeType &&
      !areMimeTypesEquivalent(metadata.claimedMimeType, actualMimeType)
    ) {
      await c.env.R2_BUCKET.delete(metadata.adapterKey);
      await deleteUploadMetadata(metadata.uploadId, c.env);
      throw Errors.mimeTypeMismatch(metadata.claimedMimeType, actualMimeType);
    }

    await sendUploadCallback(
      {
        type: "upload-completed",
        data: {
          environmentId: metadata.environmentId,
          fileKeyId: metadata.fileKeyId,
          fileName: metadata.fileName,
          claimedSize: metadata.claimedSize ?? metadata.size ?? actualSize,
          claimedHash: metadata.claimedHash ?? null,
          claimedMimeType: metadata.claimedMimeType ?? null,
          actualHash,
          actualMimeType,
          actualSize,
          adapterKey: metadata.adapterKey,
          projectId: metadata.projectId,
          isPublic: metadata.isPublic,
        },
      },
      c.env,
    );

    await deleteUploadMetadata(metadata.uploadId, c.env);

    return new Response(null, {
      status: HTTP_STATUS.NO_CONTENT,
      headers: {
        "Tus-Resumable": TUS_VERSION,
        [UPLOAD_OFFSET_HEADER]: metadata.size?.toString() ?? "0",
      },
    });
  } catch (error) {
    console.error("Upload finalization failed:", error);

    try {
      await c.env.R2_BUCKET.delete(metadata.adapterKey);
      await deleteUploadMetadata(metadata.uploadId, c.env);
    } catch (cleanupError) {
      console.error("Cleanup failed:", cleanupError);
    }

    throw error;
  }
}
