import { nanoid } from "nanoid";
import { z } from "zod";

import { eq } from "@app/db";
import { db } from "@app/db/client";
import { fileKeys, files, projectEnvironments } from "@app/db/schema";
import { publishMessage } from "@app/redis";

import { env } from "../../../../env";

/**
 * Callback endpoint for the Cloudflare Worker to report upload completion or failure.
 *
 * New flow:
 * 1. Worker receives upload with signed URL
 * 2. Worker calls /api/internal/verify-signature to validate the signature
 * 3. Worker uploads file to S3
 * 4. Worker calls this callback with the result
 * 5. This endpoint creates/updates the fileKey and file records
 */

const schema = z.union([
  z.object({
    type: z.literal("upload-completed"),
    data: z.object({
      environmentId: z.string(),
      fileKeyId: z.string(),
      fileName: z.string(),
      claimedSize: z.number(),
      claimedHash: z.string().nullable(),
      claimedMimeType: z.string().nullable(),
      actualHash: z.string().nullable(),
      actualMimeType: z.string(),
      actualSize: z.number(),
      adapterKey: z.string(),
      projectId: z.string(),
      isPublic: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal("upload-failed"),
    data: z.object({
      environmentId: z.string(),
      fileKeyId: z.string(),
      error: z.string().optional(),
    }),
  }),
]);

export async function POST(request: Request) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const token = header.split(" ")[1];
  if (!token || token !== env.CALLBACK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid request",
        details: parsed.error.issues,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { type, data } = parsed.data;

  if (type === "upload-completed") {
    try {
      const environment = await db.query.projectEnvironments.findFirst({
        where: eq(projectEnvironments.id, data.environmentId),
      });

      if (!environment) {
        return new Response(
          JSON.stringify({ error: "Environment not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      // TODO: Add deduplication logic here (find existing file by hash)
      const [file] = await db
        .insert(files)
        .values({
          hash: data.actualHash,
          mimeType: data.actualMimeType,
          size: data.actualSize,
          adapterKey: data.adapterKey,
          environmentId: data.environmentId,
          projectId: data.projectId,
        })
        .returning();

      if (!file) {
        return new Response(
          JSON.stringify({ error: "Failed to create file record" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      const existingFileKey = await db.query.fileKeys.findFirst({
        where: eq(fileKeys.id, data.fileKeyId),
      });

      let fileKey;
      if (existingFileKey) {
        const [updated] = await db
          .update(fileKeys)
          .set({
            fileId: file.id,
            fileName: data.fileName,
            claimedHash: data.claimedHash,
            claimedMimeType: data.claimedMimeType,
            claimedSize: data.claimedSize,
            uploadCompletedAt: new Date(),
            uploadFailedAt: null,
            isPublic: data.isPublic ?? false,
          })
          .where(eq(fileKeys.id, data.fileKeyId))
          .returning();
        fileKey = updated;
      } else {
        const [created] = await db
          .insert(fileKeys)
          .values({
            id: data.fileKeyId,
            accessKey: nanoid(32),
            fileName: data.fileName,
            fileId: file.id,
            environmentId: data.environmentId,
            projectId: data.projectId,
            metadata: {},
            claimedHash: data.claimedHash,
            claimedMimeType: data.claimedMimeType,
            claimedSize: data.claimedSize,
            uploadCompletedAt: new Date(),
            isPublic: data.isPublic ?? false,
          })
          .returning();
        fileKey = created;
      }

      if (!fileKey) {
        return new Response(
          JSON.stringify({ error: "Failed to create/update fileKey record" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      // Publish message for real-time updates (non-blocking)
      try {
        await publishMessage(`upload:${data.fileKeyId}`, {
          type: "upload-completed",
          data: {
            fileKeyId: fileKey.id,
            accessKey: fileKey.accessKey,
            fileId: file.id,
            hash: file.hash,
            mimeType: file.mimeType,
            size: file.size,
          },
        });
      } catch (pubError) {
        // Log but don't fail the callback - Redis pub/sub is optional
        console.error("Failed to publish upload completion message:", pubError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          fileKeyId: fileKey.id,
          accessKey: fileKey.accessKey,
          fileId: file.id,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("Error processing upload completion:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (type === "upload-failed") {
    try {
      const existingFileKey = await db.query.fileKeys.findFirst({
        where: eq(fileKeys.id, data.fileKeyId),
      });

      if (existingFileKey) {
        await db
          .update(fileKeys)
          .set({
            uploadFailedAt: new Date(),
          })
          .where(eq(fileKeys.id, data.fileKeyId));
      }

      // Publish message for real-time updates (non-blocking)
      try {
        await publishMessage(`upload:${data.fileKeyId}`, {
          type: "upload-failed",
          data: {
            fileKeyId: data.fileKeyId,
            error: data.error ?? "Upload failed",
          },
        });
      } catch (pubError) {
        // Log but don't fail the callback - Redis pub/sub is optional
        console.error("Failed to publish upload failure message:", pubError);
      }

      return new Response(JSON.stringify({ success: true, status: "failed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error processing upload failure:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown type" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
