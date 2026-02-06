import type { Context } from "hono";

import type { Bindings, Variables } from "../../types/bindings";
import {
  getUploadMetadata,
  isUploadExpired,
  storeUploadMetadata,
} from "../../services/tus/metadata";
import { processUploadChunk } from "../../services/tus/upload";
import {
  CONTENT_TYPE_OCTET_STREAM,
  HTTP_STATUS,
  TUS_VERSION,
  UPLOAD_LENGTH_HEADER,
  UPLOAD_OFFSET_HEADER,
} from "../../utils/constants";
import { Errors } from "../../utils/errors";
import { parseNonNegativeInt } from "../../utils/validation";

export async function handleTusPatch(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<Response> {
  const uploadId = c.req.param("uploadId");
  const projectId = c.get("projectId");

  const tusResumable = c.req.header("Tus-Resumable");
  if (tusResumable !== TUS_VERSION) {
    throw Errors.invalidTusVersion(TUS_VERSION, tusResumable);
  }

  const contentType = c.req.header("Content-Type");
  if (contentType !== CONTENT_TYPE_OCTET_STREAM) {
    throw Errors.invalidContentType(CONTENT_TYPE_OCTET_STREAM, contentType);
  }

  const metadata = await getUploadMetadata(uploadId, c.env);
  if (!metadata) {
    throw Errors.uploadNotFound(uploadId);
  }

  if (metadata.projectId !== projectId) {
    throw Errors.unauthorized("Upload does not belong to this project");
  }

  if (isUploadExpired(metadata)) {
    throw Errors.uploadExpired(uploadId);
  }

  const uploadOffsetHeader = c.req.header(UPLOAD_OFFSET_HEADER);
  if (uploadOffsetHeader === undefined || uploadOffsetHeader === null) {
    throw Errors.invalidRequest("Upload-Offset header is required");
  }

  const uploadOffset = parseNonNegativeInt(uploadOffsetHeader);
  if (uploadOffset === null) {
    throw Errors.invalidRequest("Upload-Offset must be a non-negative integer");
  }

  if (uploadOffset !== metadata.offset) {
    throw Errors.offsetMismatch(metadata.offset, uploadOffset);
  }

  const uploadLengthHeader = c.req.header(UPLOAD_LENGTH_HEADER);
  if (metadata.size === null && uploadLengthHeader) {
    const uploadLength = parseNonNegativeInt(uploadLengthHeader);
    if (uploadLength === null) {
      throw Errors.invalidRequest(
        "Upload-Length must be a non-negative integer",
      );
    }

    const maxSize = parseInt(c.env.TUS_MAX_SIZE, 10);
    if (uploadLength > maxSize) {
      throw Errors.uploadTooLarge(uploadLength, maxSize);
    }

    metadata.size = uploadLength;
    await storeUploadMetadata(metadata, c.env);
  } else if (uploadLengthHeader && metadata.size !== null) {
    const newLength = parseNonNegativeInt(uploadLengthHeader);
    if (newLength !== metadata.size) {
      throw Errors.invalidRequest("Upload-Length cannot be changed once set");
    }
  }

  const contentLength = parseNonNegativeInt(c.req.header("Content-Length"));
  if (contentLength === null) {
    throw Errors.invalidRequest("Content-Length header is required");
  }

  // Validate that the upload won't exceed the declared Upload-Length
  if (metadata.size !== null && uploadOffset + contentLength > metadata.size) {
    throw Errors.invalidRequest(
      `Content-Length would exceed Upload-Length: ${uploadOffset} + ${contentLength} > ${metadata.size}`,
    );
  }

  if (contentLength === 0) {
    return new Response(null, {
      status: HTTP_STATUS.NO_CONTENT,
      headers: {
        "Tus-Resumable": TUS_VERSION,
        [UPLOAD_OFFSET_HEADER]: metadata.offset.toString(),
        "Upload-Expires": metadata.expiresAt,
      },
    });
  }

  const body = c.req.raw.body;
  if (!body) {
    throw Errors.invalidRequest("Request body is required");
  }

  const result = await processUploadChunk({
    metadata,
    body,
    contentLength,
    c,
  });

  if (result.response) {
    return result.response;
  }

  return new Response(null, {
    status: HTTP_STATUS.NO_CONTENT,
    headers: {
      "Tus-Resumable": TUS_VERSION,
      [UPLOAD_OFFSET_HEADER]: result.newOffset.toString(),
      "Upload-Expires": metadata.expiresAt,
    },
  });
}
