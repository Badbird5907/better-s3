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

export class UploadStreamReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "UploadStreamReadError";
    if (options?.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
      });
    }
  }
}

async function readExactBytesFromStream(
  stream: ReadableStream<Uint8Array>,
  expectedBytes: number,
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < expectedBytes) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (error) {
        throw new UploadStreamReadError("Failed reading request body stream", {
          cause: error,
        });
      }

      if (readResult.done) break;
      const chunk = readResult.value;
      if (!chunk || chunk.byteLength === 0) continue;

      chunks.push(chunk);
      total += chunk.byteLength;
      if (total > expectedBytes) {
        throw new UploadStreamReadError(
          `Request body exceeded expected length (${total} > ${expectedBytes})`,
        );
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Best effort cleanup of pending stream reads.
    }
    reader.releaseLock();
  }

  if (total !== expectedBytes) {
    throw new UploadStreamReadError(
      `Incomplete request body (${total}/${expectedBytes} bytes)`,
    );
  }

  const merged = new Uint8Array(expectedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
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

  const chunkBody =
    chunk instanceof ReadableStream ? await readExactBytesFromStream(chunk, chunkSize) : chunk;

  // use simple put for small single-chunk uploads
  if (chunkSize < 5 * 1024 * 1024 && isLastChunk && offset === 0) {
    await env.R2_BUCKET.put(adapterKey, chunkBody);
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
  const uploadedPart = await multipart.uploadPart(partNumber, chunkBody);

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
