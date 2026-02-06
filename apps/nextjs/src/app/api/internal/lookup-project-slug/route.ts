import { eq } from "@app/db";
import { db } from "@app/db/client";
import { projects } from "@app/db/schema";

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
    const { slug } = body as { slug?: string };

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log("Looking up project by slug:", slug);

    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
      columns: {
        id: true,
        defaultFileAccess: true,
      },
    });
    console.log(" ->", project);

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(project), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error looking up project by slug:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
