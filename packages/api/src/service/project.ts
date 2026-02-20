import type { db as dbClient } from "@app/db/client";
import { eq } from "@app/db";
import { projectEnvironments, projects } from "@app/db/schema";

type Db = typeof dbClient;

const DEFAULT_ENVIRONMENTS = [
  { name: "Development", slug: "development", type: "development" as const },
  { name: "Staging", slug: "staging", type: "staging" as const },
  { name: "Production", slug: "production", type: "production" as const },
];

export async function listProjects(db: Db, organizationId: string) {
  return db.query.projects.findMany({
    where: eq(projects.parentOrganizationId, organizationId),
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  });
}

export async function getProjectById(db: Db, projectId: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
}

export async function createProject(
  db: Db,
  input: { name: string; organizationId: string },
) {
  const baseSlug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const existingProjects = await db.query.projects.findMany({
    where: eq(projects.parentOrganizationId, input.organizationId),
    columns: { slug: true },
  });

  const existingSlugs = new Set(existingProjects.map((p) => p.slug));
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const [newProject] = await db
    .insert(projects)
    .values({
      name: input.name,
      slug,
      parentOrganizationId: input.organizationId,
    })
    .returning();

  if (!newProject) {
    throw new Error("Failed to create project");
  }

  // Create default environments
  await db.insert(projectEnvironments).values(
    DEFAULT_ENVIRONMENTS.map((env) => ({
      projectId: newProject.id,
      name: env.name,
      slug: env.slug,
      type: env.type,
    })),
  );

  return newProject;
}

export async function updateProject(
  db: Db,
  input: {
    id: string;
    name?: string;
    defaultFileAccess?: "public" | "private";
  },
) {
  const updates: Partial<typeof projects.$inferInsert> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.defaultFileAccess !== undefined)
    updates.defaultFileAccess = input.defaultFileAccess;

  if (Object.keys(updates).length === 0) {
    return db.query.projects.findFirst({
      where: eq(projects.id, input.id),
    });
  }

  const [updated] = await db
    .update(projects)
    .set(updates)
    .where(eq(projects.id, input.id))
    .returning();

  return updated;
}

export async function deleteProject(db: Db, projectId: string) {
  const [deleted] = await db
    .delete(projects)
    .where(eq(projects.id, projectId))
    .returning();

  return deleted;
}
