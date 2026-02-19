import { nanoid } from "nanoid";
import { z } from "zod";

import { db } from "@app/db/client";
import { fileKeys } from "@app/db/schema";
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
  // Extract and validate API key
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

  // Parse request body
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

  // Validate request body
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
    metadata,
  } = result.data;

  // Verify project access
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

  // Get project with organization
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

  // Verify environment
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
    // Generate a unique file key ID
    const fileKeyId = nanoid(16);

    // Resolve isPublic: use explicit value if provided, otherwise use project default
    const resolvedIsPublic =
      isPublic ?? projectResult.project.defaultFileAccess === "public";

    // Create the fileKey record (pending upload)
    const [newFileKey] = await db
      .insert(fileKeys)
      .values({
        id: fileKeyId,
        accessKey,
        fileName,
        projectId,
        environmentId,
        fileId: null, // null = pending upload
        isPublic: resolvedIsPublic,
        metadata: metadata ?? {},
        claimedSize: size,
        claimedMimeType: mimeType ?? null,
        claimedHash: hash ?? null,
      })
      .returning();

    if (!newFileKey) {
      throw new Error("Failed to create file key record");
    }

    // Extract key prefix (sk-bs3-xxxx) for signature verification
    const keyId = apiKey.substring(0, 11);

    // Determine protocol based on environment (use http for local development)
    const isDevelopment = env.NODE_ENV === "development";
    const protocol = isDevelopment ? "http" : "https";

    // Generate signed upload URL
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
        accessKey: newFileKey.accessKey,
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
