import type { Context } from "hono";

import type { Bindings, Variables } from "../../types/bindings";
import {
  sendUploadCallback,
  verifyUploadSignature,
} from "../../services/callback";
import {
  deleteUploadMetadata,
  generateExpirationDate,
  storeUploadMetadata,
} from "../../services/tus/metadata";
import { processUploadChunk } from "../../services/tus/upload";
import {
  CONTENT_TYPE_OCTET_STREAM,
  HTTP_STATUS,
  TUS_VERSION,
  UPLOAD_DEFER_LENGTH_HEADER,
  UPLOAD_LENGTH_HEADER,
  UPLOAD_METADATA_HEADER,
  UPLOAD_OFFSET_HEADER,
} from "../../utils/constants";
import { Errors } from "../../utils/errors";
import {
  isValidBase64,
  isValidMetadataKey,
  parseNonNegativeInt,
  sanitizeHeaderValue,
} from "../../utils/validation";

export async function handleTusCreate(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<Response> {
  const tusResumable = c.req.header("Tus-Resumable");
  if (tusResumable !== TUS_VERSION) {
    throw Errors.invalidTusVersion(TUS_VERSION, tusResumable);
  }

  const projectId = c.get("projectId");
  const uploadLengthHeader = c.req.header(UPLOAD_LENGTH_HEADER);
  const deferLength = c.req.header(UPLOAD_DEFER_LENGTH_HEADER);
  const uploadMetadataHeader = c.req.header(UPLOAD_METADATA_HEADER);
  const contentType = c.req.header("Content-Type");
  const contentLengthHeader = c.req.header("Content-Length");

  if (deferLength !== undefined && deferLength !== "1") {
    throw Errors.invalidRequest("Upload-Defer-Length must be 1");
  }

  if (!uploadLengthHeader && deferLength !== "1") {
    throw Errors.invalidRequest(
      "Missing Upload-Length or Upload-Defer-Length header",
    );
  }

  const uploadLength = parseNonNegativeInt(uploadLengthHeader);
  if (uploadLengthHeader && uploadLength === null) {
    throw Errors.invalidRequest("Upload-Length must be a non-negative integer");
  }

  if (uploadLength !== null) {
    const maxSize = parseInt(c.env.TUS_MAX_SIZE, 10);
    if (uploadLength > maxSize) {
      throw Errors.uploadTooLarge(uploadLength, maxSize);
    }
  }

  const isCreationWithUpload = contentType === CONTENT_TYPE_OCTET_STREAM;
  if (!isCreationWithUpload && contentLengthHeader) {
    const contentLength = parseNonNegativeInt(contentLengthHeader);
    if (contentLength !== null && contentLength !== 0) {
      throw Errors.invalidContentType(CONTENT_TYPE_OCTET_STREAM, contentType);
    }
  }

  const metadata = parseUploadMetadata(uploadMetadataHeader ?? "");

  const environmentId = metadata.environmentId ?? c.req.query("environmentId");
  const fileKeyId = metadata.fileKeyId ?? c.req.query("fileKeyId");
  const accessKey = metadata.accessKey ?? c.req.query("accessKey");
  const fileName = metadata.fileName ?? c.req.query("fileName");
  const keyId = metadata.keyId ?? c.req.query("keyId");
  const signature = c.req.query("sig");
  const sizeParam = c.req.query("size");

  if (
    !environmentId ||
    !fileKeyId ||
    !accessKey ||
    !fileName ||
    !keyId ||
    !signature ||
    !sizeParam
  ) {
    throw Errors.invalidRequest(
      "Missing required parameters: environmentId, fileKeyId, accessKey, fileName, keyId, size, sig",
    );
  }

  try {
    const verificationResult = await verifyUploadSignature(
      {
        keyId,
        signature,
        payload: {
          type: "upload",
          environmentId,
          fileKeyId,
          accessKey,
          fileName,
          size: sizeParam,
          keyId,
          ...(c.req.query("hash") && {
            hash: c.req.query("hash") ?? undefined,
          }),
          ...(c.req.query("mimeType") && {
            mimeType: c.req.query("mimeType") ?? undefined,
          }),
          ...(c.req.query("expiresAt") && {
            expiresAt: c.req.query("expiresAt") ?? undefined,
          }),
          ...(c.req.query("isPublic") && {
            isPublic: c.req.query("isPublic") ?? undefined,
          }),
        },
      },
      c.env,
    );

    if (!verificationResult.valid) {
      throw Errors.signatureInvalid();
    }

    const uploadId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const adapterKey = `${projectId}/${environmentId}/${crypto.randomUUID()}`;

    const uploadMetadata = {
      uploadId,
      projectId,
      environmentId,
      fileKeyId,
      accessKey,
      fileName,
      size: uploadLength ?? null,
      offset: 0,
      adapterKey,
      multipartUploadId: null,
      parts: [],
      isPublic: verificationResult.isPublic ?? false,
      claimedHash: verificationResult.claimedHash ?? undefined,
      claimedMimeType: verificationResult.claimedMimeType ?? undefined,
      claimedSize: verificationResult.size,
      createdAt: new Date().toISOString(),
      expiresAt: generateExpirationDate(c.env),
      metadata,
      rawMetadata: uploadMetadataHeader ?? "",
    };

    await storeUploadMetadata(uploadMetadata, c.env);

    const url = new URL(c.req.url);
    const uploadUrl = `${url.protocol}//${url.host}/ingest/tus/${uploadId}`;

    // Handle zero-length uploads - immediately complete without requiring PATCH
    if (uploadLength === 0) {
      // Create empty file in R2
      await c.env.R2_BUCKET.put(adapterKey, new Uint8Array(0));

      // Send completion callback
      await sendUploadCallback(
        {
          type: "upload-completed",
          data: {
            environmentId,
            fileKeyId,
            accessKey,
            fileName,
            claimedSize: verificationResult.size,
            claimedHash: verificationResult.claimedHash ?? null,
            claimedMimeType: verificationResult.claimedMimeType ?? null,
            actualHash: null,
            actualMimeType: "application/octet-stream",
            actualSize: 0,
            adapterKey,
            projectId,
            isPublic: verificationResult.isPublic ?? false,
          },
        },
        c.env,
      );

      await deleteUploadMetadata(uploadId, c.env);

      return new Response(null, {
        status: HTTP_STATUS.CREATED,
        headers: {
          "Tus-Resumable": TUS_VERSION,
          Location: uploadUrl,
          [UPLOAD_OFFSET_HEADER]: "0",
          [UPLOAD_LENGTH_HEADER]: "0",
        },
      });
    }

    const bodyContentLength = parseNonNegativeInt(contentLengthHeader) ?? 0;
    const body = c.req.raw.body as ReadableStream<Uint8Array> | null;

    if (isCreationWithUpload && bodyContentLength > 0 && body) {
      const result = await processUploadChunk({
        metadata: uploadMetadata,
        body,
        contentLength: bodyContentLength,
        c,
      });

      if (result.response) {
        return new Response(null, {
          status: HTTP_STATUS.CREATED,
          headers: {
            "Tus-Resumable": TUS_VERSION,
            Location: uploadUrl,
            "Upload-Expires": uploadMetadata.expiresAt,
            [UPLOAD_OFFSET_HEADER]: result.newOffset.toString(),
          },
        });
      }

      return new Response(null, {
        status: HTTP_STATUS.CREATED,
        headers: {
          "Tus-Resumable": TUS_VERSION,
          Location: uploadUrl,
          "Upload-Expires": uploadMetadata.expiresAt,
          [UPLOAD_OFFSET_HEADER]: result.newOffset.toString(),
        },
      });
    }

    return new Response(null, {
      status: HTTP_STATUS.CREATED,
      headers: {
        "Tus-Resumable": TUS_VERSION,
        Location: uploadUrl,
        "Upload-Expires": uploadMetadata.expiresAt,
        ...(uploadLength !== null && {
          [UPLOAD_LENGTH_HEADER]: uploadLength.toString(),
        }),
      },
    });
  } catch (error) {
    console.error("Upload creation failed:", error);
    throw error;
  }
}

function parseUploadMetadata(header: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  if (!header) return metadata;

  const pairs = header.split(",");
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const spaceIndex = trimmed.indexOf(" ");
    const key = spaceIndex === -1 ? trimmed : trimmed.substring(0, spaceIndex);
    const value = spaceIndex === -1 ? "" : trimmed.substring(spaceIndex + 1);

    if (!isValidMetadataKey(key)) {
      throw Errors.invalidRequest(
        `Invalid metadata key: "${key}". Keys must be non-empty ASCII without spaces or commas`,
      );
    }

    if (key in metadata) {
      throw Errors.invalidRequest(
        `Duplicate metadata key: "${key}". All keys must be unique`,
      );
    }

    if (value && !isValidBase64(value)) {
      throw Errors.invalidRequest(
        `Invalid metadata value for key "${key}". Values must be Base64 encoded`,
      );
    }

    const decodedValue = value ? sanitizeHeaderValue(atob(value)) : "";
    metadata[key] = decodedValue;
  }

  return metadata;
}
