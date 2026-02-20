import type { db as dbClient } from "@app/db/client";
import { and, eq, sql } from "@app/db";
import { fileKeys, projects, usageDaily, usageEvents } from "@app/db/schema";
import { publishMessage } from "@app/redis";

type Db = typeof dbClient;

export class UploadFailureError extends Error {
  public readonly code: "NOT_FOUND" | "ALREADY_COMPLETED" | "ALREADY_FAILED";

  constructor(
    message: string,
    code: "NOT_FOUND" | "ALREADY_COMPLETED" | "ALREADY_FAILED",
  ) {
    super(message);
    this.name = "UploadFailureError";
    this.code = code;
  }
}

/**
 * Look up a file key by either fileKeyId or accessKey (within a project).
 * At least one identifier must be provided.
 */
export async function lookupFileKey(
  db: Db,
  opts: {
    projectId: string;
    fileKeyId?: string;
    accessKey?: string;
  },
) {
  if (opts.fileKeyId) {
    return db.query.fileKeys.findFirst({
      where: and(
        eq(fileKeys.id, opts.fileKeyId),
        eq(fileKeys.projectId, opts.projectId),
      ),
      with: { file: true },
    });
  }

  if (opts.accessKey) {
    return db.query.fileKeys.findFirst({
      where: and(
        eq(fileKeys.accessKey, opts.accessKey),
        eq(fileKeys.projectId, opts.projectId),
      ),
      with: { file: true },
    });
  }

  return undefined;
}

async function trackUsageEvent(
  db: Db,
  eventType: "upload_completed" | "upload_failed" | "download",
  projectId: string,
  environmentId: string,
  bytes?: number,
  fileId?: string,
) {
  try {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { parentOrganizationId: true },
    });

    if (!project?.parentOrganizationId) return;

    const organizationId = project.parentOrganizationId;

    await db.insert(usageEvents).values({
      organizationId,
      projectId,
      environmentId,
      eventType,
      bytes: bytes ?? null,
      fileId: fileId ?? null,
    });

    const today = new Date().toISOString().substring(0, 10);

    const updateField = {
      upload_completed: "uploadsCompleted",
      upload_failed: "uploadsFailed",
      download: "downloads",
    }[eventType] as "uploadsCompleted" | "uploadsFailed" | "downloads";

    const bytesField =
      eventType === "upload_completed" ? "bytesUploaded" : null;

    await db
      .insert(usageDaily)
      .values({
        organizationId,
        projectId,
        environmentId,
        date: today,
        [updateField]: 1,
        ...(bytesField && bytes ? { [bytesField]: bytes } : {}),
      })
      .onConflictDoUpdate({
        target: [
          usageDaily.organizationId,
          usageDaily.projectId,
          usageDaily.environmentId,
          usageDaily.date,
        ],
        set: {
          [updateField]: sql`${usageDaily[updateField]} + 1`,
          ...(bytesField && bytes
            ? { [bytesField]: sql`${usageDaily[bytesField]} + ${bytes}` }
            : {}),
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("Failed to track usage event:", error);
  }
}

/**
 * Marks a pending upload as failed. Shared between the tRPC mutation,
 * the public REST API, and the internal callback route.
 *
 * Handles:
 * - Validating the fileKey exists and is in a pending state
 * - Updating the DB (status + uploadFailedAt)
 * - Publishing a real-time Redis notification
 * - Tracking the upload_failed usage event
 *
 * @throws {UploadFailureError} if the fileKey is not found or not in a markable state
 */
export async function markUploadAsFailed(
  db: Db,
  opts: {
    projectId: string;
    environmentId: string;
    fileKeyId: string;
    error?: string;
  },
) {
  const fileKey = await db.query.fileKeys.findFirst({
    where: and(
      eq(fileKeys.id, opts.fileKeyId),
      eq(fileKeys.projectId, opts.projectId),
    ),
  });

  if (!fileKey) {
    throw new UploadFailureError("FileKey not found", "NOT_FOUND");
  }

  if (fileKey.status === "completed") {
    throw new UploadFailureError(
      "Upload has already completed successfully",
      "ALREADY_COMPLETED",
    );
  }

  if (fileKey.status === "failed") {
    throw new UploadFailureError(
      "Upload has already been marked as failed",
      "ALREADY_FAILED",
    );
  }

  const [updated] = await db
    .update(fileKeys)
    .set({
      status: "failed",
      uploadFailedAt: new Date(),
    })
    .where(eq(fileKeys.id, opts.fileKeyId))
    .returning();

  // Publish real-time notification (non-blocking)
  try {
    await publishMessage(`upload:${opts.fileKeyId}`, {
      type: "upload-failed",
      data: {
        fileKeyId: opts.fileKeyId,
        error: opts.error ?? "Upload failed",
      },
    });
  } catch (pubError) {
    console.error("Failed to publish upload failure message:", pubError);
  }

  // Track usage analytics (non-blocking)
  void trackUsageEvent(db, "upload_failed", opts.projectId, opts.environmentId);

  return updated;
}
