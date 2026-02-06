import type { Context } from "hono";

import type { Bindings, Variables } from "../../types/bindings";
import {
  getUploadMetadata,
  isUploadExpired,
} from "../../services/tus/metadata";
import {
  HTTP_STATUS,
  TUS_VERSION,
  UPLOAD_DEFER_LENGTH_HEADER,
  UPLOAD_EXPIRES_HEADER,
  UPLOAD_LENGTH_HEADER,
  UPLOAD_METADATA_HEADER,
  UPLOAD_OFFSET_HEADER,
} from "../../utils/constants";
import type { TusError } from "../../utils/errors";
import { createErrorResponse, Errors } from "../../utils/errors";
import { sanitizeHeaderValue } from "../../utils/validation";

export async function handleTusHead(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<Response> {
  try {
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

    if (isUploadExpired(metadata)) {
      throw Errors.uploadExpired(uploadId);
    }

    const headers: Record<string, string> = {
      "Tus-Resumable": TUS_VERSION,
      [UPLOAD_OFFSET_HEADER]: metadata.offset.toString(),
      [UPLOAD_EXPIRES_HEADER]: metadata.expiresAt,
      "Cache-Control": "no-store",
    };

    if (metadata.size !== null) {
      headers[UPLOAD_LENGTH_HEADER] = metadata.size.toString();
    } else {
      headers[UPLOAD_DEFER_LENGTH_HEADER] = "1";
    }

    if (Object.keys(metadata.metadata).length > 0) {
      headers[UPLOAD_METADATA_HEADER] = Object.entries(metadata.metadata)
        .map(([key, value]) => {
          const sanitizedValue = sanitizeHeaderValue(value);
          return sanitizedValue ? `${key} ${btoa(sanitizedValue)}` : key;
        })
        .join(",");
    }

    return new Response(null, {
      status: HTTP_STATUS.OK,
      headers,
    });
  } catch (error) {
  // tus spec requires no-store on HEAD errors
    const response = createErrorResponse(error as TusError | Error);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }
}
