import type { Bindings } from "../../types/bindings";
import type { TusUploadPart } from "../../types/tus";

export interface UploadChunkParams {
  adapterKey: string;
  chunk: ReadableStream<Uint8Array> | ArrayBuffer;
  chunkSize: number;
  offset: number;
  multipartUploadId: string | null;
  isLastChunk: boolean;
  existingPartsCount: number;
  env: Bindings;
}

export interface UploadChunkResult {
  multipartUploadId: string | null;
  part: TusUploadPart | null;
}

export async function uploadChunkToR2(
  params: UploadChunkParams,
): Promise<UploadChunkResult> {
  const {
    adapterKey,
    chunk,
    chunkSize,
    offset,
    multipartUploadId,
    isLastChunk,
    existingPartsCount,
    env,
  } = params;

  // use simple put for small single-chunk uploads
  if (chunkSize < 5 * 1024 * 1024 && isLastChunk && offset === 0) {
    await env.R2_BUCKET.put(adapterKey, chunk);
    return { multipartUploadId: null, part: null };
  }

  let uploadId = multipartUploadId;
  if (!uploadId) {
    const multipart = await env.R2_BUCKET.createMultipartUpload(adapterKey);
    uploadId = multipart.uploadId;
  }

  // parts are 1-indexed, calculate sequentially from existing parts count
  // (not from offset, as TUS allows variable chunk sizes)
  const partNumber = existingPartsCount + 1;

  const multipart = env.R2_BUCKET.resumeMultipartUpload(adapterKey, uploadId);
  const uploadedPart = await multipart.uploadPart(partNumber, chunk);

  return {
    multipartUploadId: uploadId,
    part: {
      partNumber,
      etag: uploadedPart.etag,
    },
  };
}

export async function completeMultipartUpload(params: {
  adapterKey: string;
  uploadId: string;
  parts: TusUploadPart[];
  env: Bindings;
}): Promise<R2Object> {
  const { adapterKey, uploadId, parts, env } = params;

  const multipart = env.R2_BUCKET.resumeMultipartUpload(adapterKey, uploadId);

  const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);
  const object = await multipart.complete(sortedParts);

  return object;
}

export async function abortMultipartUpload(params: {
  adapterKey: string;
  uploadId: string;
  env: Bindings;
}): Promise<void> {
  const { adapterKey, uploadId, env } = params;

  const multipart = env.R2_BUCKET.resumeMultipartUpload(adapterKey, uploadId);
  await multipart.abort();
}

export async function deleteObject(
  adapterKey: string,
  env: Bindings,
): Promise<void> {
  await env.R2_BUCKET.delete(adapterKey);
}

export async function getObject(
  adapterKey: string,
  env: Bindings,
): Promise<R2ObjectBody | null> {
  return await env.R2_BUCKET.get(adapterKey);
}

export async function listObjects(params: {
  prefix: string;
  limit?: number;
  cursor?: string;
  env: Bindings;
}): Promise<R2Objects> {
  const { prefix, limit = 1000, cursor, env } = params;

  return await env.R2_BUCKET.list({
    prefix,
    limit,
    cursor,
  });
}

export async function getObjectMetadata(
  adapterKey: string,
  env: Bindings,
): Promise<R2Object | null> {
  return await env.R2_BUCKET.head(adapterKey);
}
