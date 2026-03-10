import { nanoid } from "nanoid";
import { z } from "zod";

import { generateSignedUploadUrl } from "@app/shared/signing";

import { env } from "../../../../env";
import {
  extractApiKeyFromRequest,
  getEnvironment,
  getProjectWithOrg,
  validateApiKey,
} from "../../../../lib/api-key-middleware";

const schema = z.object({
  projectId: z.string(),
  environmentId: z.string(),
  accessKey: z.string().min(1),
  fileName: z.string().min(1),
  size: z.number().int().positive(),
  mimeType: z.string().optional(),
  hash: z.string().optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const apiKey = extractApiKeyFromRequest(request);

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message:
          "API key is required. Use Authorization: Bearer <key> or X-API-Key header.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const context = await validateApiKey(apiKey);

  if (!context) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Invalid or expired API key.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: "Bad Request",
        message: "Invalid JSON body",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "Bad Request",
        message: "Invalid request body",
        details: result.error.issues,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const {
    projectId,
    environmentId,
    accessKey,
    fileName,
    size,
    mimeType,
    hash,
    isPublic,
  } = result.data;

  if (projectId !== context.projectId) {
    return new Response(
      JSON.stringify({
        error: "Forbidden",
        message: "API key does not have access to this project",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const projectResult = await getProjectWithOrg(
    projectId,
    context.organizationId,
  );
  if (!projectResult) {
    return new Response(
      JSON.stringify({
        error: "Not Found",
        message: "Project not found",
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const environment = await getEnvironment(environmentId, projectId);
  if (!environment) {
    return new Response(
      JSON.stringify({
        error: "Not Found",
        message: "Environment not found or does not belong to this project",
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const fileKeyId = nanoid(16);

    const resolvedIsPublic =
      isPublic ?? projectResult.project.defaultFileAccess === "public";

    const keyId = apiKey.substring(0, 11);

    const isDevelopment = env.NODE_ENV === "development";
    const protocol = isDevelopment ? "http" : "https";

    const uploadUrl = await generateSignedUploadUrl(
      env.WORKER_DOMAIN,
      projectResult.project.slug,
      {
        environmentId,
        fileKeyId,
        accessKey,
        fileName,
        size,
        hash,
        mimeType,
        isPublic: resolvedIsPublic,
        keyId,
        expiresIn: 3600, // 1 hour expiry
        protocol,
      },
      apiKey,
      env.SIGNING_SECRET,
    );

    return new Response(
      JSON.stringify({
        uploadUrl,
        fileKeyId,
        accessKey,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error creating upload URL:", error);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: "Failed to create upload URL",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
