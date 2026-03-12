import { z } from "zod";

import { and, eq } from "@silo-storage/db";
import { db } from "@silo-storage/db/client";
import { fileKeys } from "@silo-storage/db/schema";

import {
  authenticateRequest,
  jsonError,
  jsonResponse,
  validateEnvironmentAccess,
  validateProjectAccess,
} from "@/lib/api-key-middleware";

const bodySchema = z
  .object({
    projectId: z.string().min(1),
    environmentId: z.string().min(1).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    ttlSeconds: z
      .number()
      .int()
      .positive()
      .max(365 * 24 * 60 * 60)
      .optional(),
  })
  .superRefine((value, ctx) => {
    const hasExpiresAt = value.expiresAt !== undefined;
    const hasTtl = value.ttlSeconds !== undefined;

    if (!hasExpiresAt && !hasTtl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either expiresAt or ttlSeconds must be provided.",
        path: ["expiresAt"],
      });
    }

    if (hasExpiresAt && hasTtl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either expiresAt or ttlSeconds, not both.",
        path: ["ttlSeconds"],
      });
    }
  });

// PATCH /api/v1/files/[fileKeyId]/expiry
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ fileKeyId: string }> },
) {
  const { fileKeyId } = await params;

  const authResult = await authenticateRequest(request);
  if (authResult instanceof Response) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Bad Request", "Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "Bad Request",
      "Invalid request body.",
      400,
      parsed.error.issues,
    );
  }

  const input = parsed.data;

  const project = await validateProjectAccess(authResult, input.projectId);
  if (project instanceof Response) return project;

  if (input.environmentId) {
    const environment = await validateEnvironmentAccess(
      input.environmentId,
      input.projectId,
    );
    if (environment instanceof Response) return environment;
  }

  const expiresAt =
    input.ttlSeconds !== undefined
      ? new Date(Date.now() + input.ttlSeconds * 1000)
      : input.expiresAt === null
        ? null
        : input.expiresAt
          ? new Date(input.expiresAt)
          : null;

  if (expiresAt instanceof Date && Number.isNaN(expiresAt.getTime())) {
    return jsonError("Bad Request", "Invalid expiresAt value.", 400);
  }

  try {
    const existing = await db.query.fileKeys.findFirst({
      where: and(
        eq(fileKeys.id, fileKeyId),
        eq(fileKeys.projectId, input.projectId),
        ...(input.environmentId
          ? [eq(fileKeys.environmentId, input.environmentId)]
          : []),
      ),
    });

    if (!existing) {
      return jsonError("Not Found", "File key not found.", 404);
    }

    const [updated] = await db
      .update(fileKeys)
      .set({ expiresAt })
      .where(eq(fileKeys.id, existing.id))
      .returning({
        id: fileKeys.id,
        projectId: fileKeys.projectId,
        environmentId: fileKeys.environmentId,
        accessKey: fileKeys.accessKey,
        fileName: fileKeys.fileName,
        status: fileKeys.status,
        expiresAt: fileKeys.expiresAt,
        updatedAt: fileKeys.updatedAt,
      });

    return jsonResponse(updated);
  } catch (error) {
    console.error("Error updating file expiry:", error);
    return jsonError(
      "Internal Server Error",
      "Failed to update file expiry.",
      500,
    );
  }
}
