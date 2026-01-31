import { z } from "zod";
import { withApiKeyAuthEnvironment } from "../../../../../lib/api-key-middleware";
import { nanoid } from "nanoid";
import { generateSignedUploadUrl } from "@app/shared";
import { env } from "../../../../../env";

const schema = z.object({
  projectId: z.string(),
  environmentId: z.string(),
  hash: z.string(), // SHA-256 hash of the file
  mimeType: z.string(),
  size: z.number().positive(),
  expiresIn: z.number().positive().optional().default(3600), // 1 hour default
  dev: z.boolean().optional().default(false), // dev env, open sse stream
});

export async function POST(request: Request) {
  return withApiKeyAuthEnvironment(request, async (req, context) => {
    // context now includes: project, organization, environment
    // projectId and environmentId are already validated!
    
    try {
      const body = (await req.json()) as z.infer<typeof schema>;
      const { projectId, environmentId, hash, mimeType, size, expiresIn, dev } = schema.parse(body);

      // Generate unique IDs for this upload session
      const fileKeyId = nanoid(16);
      const uploadIntentId = nanoid(16);

      // TODO: Create upload intent record in database
      // await db.insert(uploadIntents).values({
      //   id: uploadIntentId,
      //   projectId,
      //   environmentId,
      //   fileKeyId,
      //   claimedHash: hash,
      //   mimeType,
      //   size,
      //   status: 'pending',
      // });

      // Generate signed upload URL
      const uploadUrl = await generateSignedUploadUrl(
        env.WORKER_URL,
        {
          projectId: context.project.id,
          environmentId: context.environment.id,
          fileKeyId,
          uploadIntentId,
          hash,
          mimeType,
          size,
          expiresIn,
        },
        env.SIGNING_SECRET,
      );

      return new Response(
        JSON.stringify({
          message: "Upload session started",
          projectId: context.project.id,
          projectName: context.project.name,
          environmentId: context.environment.id,
          environmentName: context.environment.name,
          fileKeyId,
          uploadIntentId,
          uploadUrl,
          expiresIn,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
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
          }
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
        }
      );
    }
  });
}
