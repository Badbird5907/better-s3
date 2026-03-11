import { and, eq } from "@silo-storage/db";
import { db } from "@silo-storage/db/client";
import { fileKeys } from "@silo-storage/db/schema";

import {
  authenticateRequest,
  jsonError,
  validateEnvironmentAccess,
  validateProjectAccess,
} from "@/lib/api-key-middleware";

export async function GET(request: Request) {
  const authResult = await authenticateRequest(request);
  if (authResult instanceof Response) return authResult;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const environmentId = url.searchParams.get("environmentId");
  const fileKeyId = url.searchParams.get("fileKeyId");

  if (!projectId || !environmentId || !fileKeyId) {
    return jsonError(
      "Bad Request",
      "projectId, environmentId, and fileKeyId are required query parameters.",
      400,
    );
  }

  const project = await validateProjectAccess(authResult, projectId);
  if (project instanceof Response) return project;

  const environment = await validateEnvironmentAccess(environmentId, projectId);
  if (environment instanceof Response) return environment;

  const fileKey = await db.query.fileKeys.findFirst({
    where: and(
      eq(fileKeys.id, fileKeyId),
      eq(fileKeys.projectId, projectId),
      eq(fileKeys.environmentId, environmentId),
    ),
    with: { file: true },
  });

  if (!fileKey) {
    return Response.json({
      data: {
        fileKeyId,
        accessKey: null,
        status: "pending",
        uploadCompletedAt: null,
        uploadFailedAt: null,
        file: null,
      },
    });
  }

  return Response.json({
    data: {
      fileKeyId: fileKey.id,
      accessKey: fileKey.accessKey,
      status: fileKey.status,
      uploadCompletedAt: fileKey.uploadCompletedAt,
      uploadFailedAt: fileKey.uploadFailedAt,
      file: fileKey.file
        ? {
            id: fileKey.file.id,
            hash: fileKey.file.hash,
            mimeType: fileKey.file.mimeType,
            size: fileKey.file.size,
          }
        : null,
    },
  });
}
