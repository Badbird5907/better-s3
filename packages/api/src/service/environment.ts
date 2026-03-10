import type { db as dbClient } from "@app/db/client";
import { and, eq } from "@app/db";
import { projectEnvironments } from "@app/db/schema";

type Db = typeof dbClient;

export async function listEnvironments(db: Db, projectId: string) {
  return db.query.projectEnvironments.findMany({
    where: eq(projectEnvironments.projectId, projectId),
    orderBy: (env, { asc }) => [asc(env.createdAt)],
  });
}

export async function getEnvironmentById(db: Db, environmentId: string) {
  return db.query.projectEnvironments.findFirst({
    where: eq(projectEnvironments.id, environmentId),
  });
}

export async function createEnvironment(
  db: Db,
  input: {
    projectId: string;
    name: string;
    type: "development" | "staging" | "production";
  },
) {
  const baseSlug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check for slug conflicts within this project
  const existingEnvs = await db.query.projectEnvironments.findMany({
    where: eq(projectEnvironments.projectId, input.projectId),
    columns: { slug: true },
  });

  const existingSlugs = new Set(existingEnvs.map((e) => e.slug));
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const [newEnv] = await db
    .insert(projectEnvironments)
    .values({
      projectId: input.projectId,
      name: input.name,
      slug,
      type: input.type,
    })
    .returning();

  return newEnv;
}

export async function updateEnvironment(
  db: Db,
  input: {
    id: string;
    name?: string;
    type?: "development" | "staging" | "production";
  },
) {
  const updates: Partial<typeof projectEnvironments.$inferInsert> = {};

  if (input.name !== undefined) {
    updates.name = input.name;

    // Re-generate slug from the new name
    const env = await db.query.projectEnvironments.findFirst({
      where: eq(projectEnvironments.id, input.id),
    });

    if (env?.projectId) {
      const baseSlug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const existingEnvs = await db.query.projectEnvironments.findMany({
        where: and(
          eq(projectEnvironments.projectId, env.projectId),
          // Exclude current environment from slug conflict check
        ),
        columns: { slug: true, id: true },
      });

      const existingSlugs = new Set(
        existingEnvs.filter((e) => e.id !== input.id).map((e) => e.slug),
      );
      let slug = baseSlug;
      let counter = 1;

      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      updates.slug = slug;
    }
  }

  if (input.type !== undefined) updates.type = input.type;

  if (Object.keys(updates).length === 0) {
    return db.query.projectEnvironments.findFirst({
      where: eq(projectEnvironments.id, input.id),
    });
  }

  const [updated] = await db
    .update(projectEnvironments)
    .set(updates)
    .where(eq(projectEnvironments.id, input.id))
    .returning();

  return updated;
}

export async function deleteEnvironment(db: Db, environmentId: string) {
  const [deleted] = await db
    .delete(projectEnvironments)
    .where(eq(projectEnvironments.id, environmentId))
    .returning();

  return deleted;
}
