import { z } from "zod";

import { lookupFileKey } from "@app/api/services";
import { eq } from "@app/db";
import { db } from "@app/db/client";
import { files } from "@app/db/schema";

import { env } from "@/env";
import {
  authenticateRequest,
  jsonError,
  validateEnvironmentAccess,
  validateProjectAccess,
} from "@/lib/api-key-middleware";

const schema = z
  .object({
    projectId: z.string(),
    environmentId: z.string(),
    fileKeyId: z.string().optional(),
    accessKey: z.string().optional(),
  })
  .refine((data) => data.fileKeyId ?? data.accessKey, {
    message: "Either fileKeyId or accessKey must be provided",
  });

export async function POST(request: Request) {
  const authResult = await authenticateRequest(request);
  if (authResult instanceof Response) return authResult;

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Bad Request", "Invalid JSON body.", 400);
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return jsonError(
      "Bad Request",
      "Invalid request body.",
      400,
      result.error.issues,
    );
  }

  const { projectId, environmentId, fileKeyId, accessKey } = result.data;

  // Validate project access
  const project = await validateProjectAccess(authResult, projectId);
  if (project instanceof Response) return project;

  // Validate environment access
  const environment = await validateEnvironmentAccess(environmentId, projectId);
  if (environment instanceof Response) return environment;

  try {
    // Find the file key by either identifier
    const fileKey = await lookupFileKey(db, {
      projectId,
      fileKeyId,
      accessKey,
    });

    if (!fileKey) {
      return jsonError("Not Found", "File not found.", 404);
    }

    // Check if the file has been uploaded (fileId is set)
    if (!fileKey.file) {
      return jsonError("Not Found", "File has not been uploaded yet.", 404);
    }

    // Check environment ownership
    if (fileKey.environmentId !== environmentId) {
      return jsonError(
        "Forbidden",
        "File does not belong to the specified environment.",
        403,
      );
    }

    const deleteUrl = `${env.WORKER_URL}/internal/delete/${fileKey.file.adapterKey}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${env.CALLBACK_SECRET}`,
      },
    });

    if (!deleteResponse.ok) {
      return jsonError(
        "Internal Server Error",
        "Failed to delete file from storage.",
        500,
      );
    }

    // if we do dedupe, this will need to be handled differently
    await db.delete(files).where(eq(files.id, fileKey.file.id));

    return new Response(
      JSON.stringify({
        message: "File deleted successfully",
        projectId: project.id,
        projectName: project.name,
        environmentId: environment.id,
        environmentName: environment.name,
        fileKeyId: fileKey.id,
        accessKey: fileKey.accessKey,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(
        "Bad Request",
        "Invalid request body.",
        400,
        error.issues,
      );
    }

    console.error("Error deleting file:", error);
    return jsonError(
      "Internal Server Error",
      "An unexpected error occurred.",
      500,
    );
  }
}
