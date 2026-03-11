import { env } from "../../../../../env";
import {
  authenticateRequest,
  jsonError,
  validateEnvironmentAccess,
  validateProjectAccess,
} from "../../../../../lib/api-key-middleware";
import { createDevUploadEventStream } from "../../../../../lib/upload/dev-sse";
import {
  registerUploadBodySchema,
  registerFileKeyIntent,
} from "../../../../../lib/upload/register";

export async function POST(request: Request) {
  const authResult = await authenticateRequest(request);
  if (authResult instanceof Response) return authResult;
  if (authResult.type !== "apiKey" || !authResult.rawApiKey) {
    return jsonError(
      "Unauthorized",
      "API key is required for upload registration. Use Authorization: Bearer <key> or X-API-Key header.",
      401,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Bad Request", "Invalid JSON body.", 400);
  }

  const parsed = registerUploadBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "Bad Request",
      "Invalid request body.",
      400,
      parsed.error.issues,
    );
  }

  const {
    projectId,
    environmentId,
    fileKeys,
    metadata,
    callbackUrl,
    callbackMetadata,
    awaitServerData,
    dev,
  } = parsed.data;

  const project = await validateProjectAccess(authResult, projectId);
  if (project instanceof Response) return project;

  const environment = await validateEnvironmentAccess(environmentId, projectId);
  if (environment instanceof Response) return environment;

  try {
    const registered = [];
    for (const fileKey of fileKeys) {
      const row = await registerFileKeyIntent({
        projectId,
        environmentId,
        fileKey,
        requestMetadata: metadata,
        callbackUrl,
        callbackMetadata,
        awaitServerData,
      });
      registered.push({
        fileKeyId: row.id,
        accessKey: row.accessKey,
        status: row.status,
      });
    }

    if (dev) {
      if (!env.DEV_UPLOAD_SSE_ENABLED) {
        return jsonError(
          "Service Unavailable",
          "SSE upload events are disabled.",
          503,
        );
      }
      if (environment.type !== "development") {
        return jsonError(
          "Bad Request",
          "SSE upload events are only available for development environments.",
          400,
        );
      }

      const firstRegistered = registered[0];
      if (!firstRegistered) {
        return jsonError(
          "Internal Server Error",
          "No file key registrations were persisted.",
          500,
        );
      }

      return createDevUploadEventStream(request, {
        projectId,
        environmentId,
        fileKeyId: firstRegistered.fileKeyId,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileKeys: registered,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error registering upload:", error);
    return jsonError(
      "Internal Server Error",
      "Failed to register upload.",
      500,
    );
  }
}
