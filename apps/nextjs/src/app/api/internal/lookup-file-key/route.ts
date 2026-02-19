import { and, eq } from "@app/db";
import { db } from "@app/db/client";
import { fileKeys } from "@app/db/schema";

import { env } from "../../../../env";

export async function POST(request: Request) {
  const header = request.headers.get("Authorization");
  if (
    !header?.startsWith("Bearer ") ||
    header.split(" ")[1] !== env.CALLBACK_SECRET
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const { accessKey, projectId } = body as {
      accessKey?: string;
      projectId?: string;
    };

    if (!accessKey || !projectId) {
      return new Response(
        JSON.stringify({ error: "accessKey and projectId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const fileKey = await db.query.fileKeys.findFirst({
      where: and(eq(fileKeys.accessKey, accessKey), eq(fileKeys.projectId, projectId)),
      with: {
        file: true,
      },
    });

    if (!fileKey) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(fileKey), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error looking up file key:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
