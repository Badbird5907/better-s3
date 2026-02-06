import type { Context } from "hono";

import type { Bindings, Variables } from "../../types/bindings";
import { TUS_EXTENSIONS } from "../../types/tus";
import {
  HTTP_STATUS,
  TUS_SUPPORTED_VERSIONS_STRING,
  TUS_VERSION,
} from "../../utils/constants";

export function handleTusOptions(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Response {
  const maxSize = c.env.TUS_MAX_SIZE;

  return new Response(null, {
    status: HTTP_STATUS.NO_CONTENT,
    headers: {
      "Tus-Resumable": TUS_VERSION,
      "Tus-Version": TUS_SUPPORTED_VERSIONS_STRING,
      "Tus-Extension": TUS_EXTENSIONS.join(","),
      "Tus-Max-Size": maxSize,
      "Access-Control-Allow-Methods": "POST, GET, HEAD, PATCH, DELETE, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}
