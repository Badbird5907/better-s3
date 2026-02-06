import type { Context } from "hono";

import type { Bindings, Variables } from "../types/bindings";
import { verifyDownloadSignature } from "../middleware/auth";
import { lookupFileKey } from "../services/callback";
import { Errors } from "../utils/errors";

export async function handleDownload(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<Response> {
  const accessKey = c.req.param("accessKey");
  const projectId = c.get("projectId");

  const fileKey = await lookupFileKey(accessKey, projectId, c.env);

  if (!fileKey.isPublic) {
    const signature = c.req.query("sig");
    const expiresAt = c.req.query("expiresAt");

    if (!signature || !expiresAt) {
      throw Errors.unauthorized("Signature required for private files");
    }

    const isValidSignature = await verifyDownloadSignature({
      accessKey,
      signature,
      expiresAt,
      signingSecret: c.env.SIGNING_SECRET,
    });

    if (!isValidSignature) {
      throw Errors.signatureInvalid();
    }

    const now = Math.floor(Date.now() / 1000);
    if (parseInt(expiresAt) < now) {
      throw Errors.unauthorized("Signed URL has expired");
    }
  }

  const object = await c.env.R2_BUCKET.get(fileKey.file.adapterKey);

  if (!object) {
    throw Errors.fileNotFound(accessKey);
  }

  const fileName = c.req.query("fileName") ?? fileKey.fileName;

  const headers = new Headers();
  headers.set("Content-Type", fileKey.file.mimeType);
  headers.set("Content-Length", fileKey.file.size.toString());
  headers.set("Content-Disposition", `inline; filename="${fileName}"`);
  headers.set("Cache-Control", "public, max-age=31536000");
  headers.set("ETag", fileKey.file.hash ?? object.httpEtag);

  return new Response(object.body, {
    status: 200,
    headers,
  });
}
