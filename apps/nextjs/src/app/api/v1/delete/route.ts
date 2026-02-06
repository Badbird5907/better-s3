import { z } from "zod";

import { eq } from "@app/db";
import { db } from "@app/db/client";
import { fileKeys, files } from "@app/db/schema";

import { env } from "../../../../env";
import { withApiKeyAuthEnvironment } from "../../../../lib/api-key-middleware";

const schema = z.object({
  projectId: z.string(),
  environmentId: z.string(),
  accessKey: z.string(),
});

export async function POST(request: Request) {
  return withApiKeyAuthEnvironment(request, async (req, context) => {
    // context now includes: project, organization, environment
    // projectId and environmentId are already validated!

    try {
      const body = (await req.json()) as z.infer<typeof schema>;
      const { projectId, environmentId, accessKey } = schema.parse(body);

      // Find the file key
      const fileKey = await db.query.fileKeys.findFirst({
        where: eq(fileKeys.accessKey, accessKey),
        with: {
          file: true,
        },
      });

      if (!fileKey) {
        return new Response(
          JSON.stringify({
            error: "Not Found",
            message: "File not found",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Check if the file has been uploaded (fileId is set)
      if (!fileKey.file) {
        return new Response(
          JSON.stringify({
            error: "Not Found",
            message: "File has not been uploaded yet",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Now we know fileKey.file is not null, check project/environment ownership
      if (
        fileKey.projectId !== projectId ||
        fileKey.environmentId !== environmentId
      ) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "File does not belong to the specified project or environment",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const deleteUrl = `${env.WORKER_URL}/delete/${fileKey.file.adapterKey}`;
      const deleteResponse = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${env.CALLBACK_SECRET}`,
        },
      });

      if (!deleteResponse.ok) {
        return new Response(
          JSON.stringify({
            error: "Internal Server Error",
            message: "Failed to delete file from storage",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // if we do dedupe, this will need to be handled differently
      await db.delete(files).where(eq(files.id, fileKey.file.id));

      return new Response(
        JSON.stringify({
          message: "File deleted successfully",
          projectId: context.project.id,
          projectName: context.project.name,
          environmentId: context.environment.id,
          environmentName: context.environment.name,
          accessKey,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify({
            error: "Bad Request",
            message: "Invalid request body",
            details: error.issues,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: "An unexpected error occurred",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  });
}
