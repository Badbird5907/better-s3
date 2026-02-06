import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { eq } from "@app/db";
import { fileAccessTypes, projects } from "@app/db/schema";

import { organizationProcedure } from "../trpc";

export const projectRouter = {
  list: organizationProcedure.query(async ({ ctx }) => {
    const projectList = await ctx.db.query.projects.findMany({
      where: eq(projects.parentOrganizationId, ctx.organizationId),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    return projectList;
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Verify the project belongs to the user's organization
      if (project.parentOrganizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }

      return project;
    }),

  create: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Generate slug from name
      const baseSlug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Check for existing slugs and make unique if needed
      const existingProjects = await ctx.db.query.projects.findMany({
        where: eq(projects.parentOrganizationId, ctx.organizationId),
        columns: { slug: true },
      });

      const existingSlugs = new Set(existingProjects.map((p) => p.slug));
      let slug = baseSlug;
      let counter = 1;

      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const [newProject] = await ctx.db
        .insert(projects)
        .values({
          name: input.name,
          slug,
          parentOrganizationId: ctx.organizationId,
        })
        .returning();

      return newProject;
    }),

  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        defaultFileAccess: z.enum(fileAccessTypes.enumValues).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      if (project.parentOrganizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }

      const updates: Partial<typeof projects.$inferInsert> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.defaultFileAccess !== undefined)
        updates.defaultFileAccess = input.defaultFileAccess;

      if (Object.keys(updates).length === 0) {
        return project;
      }

      const [updated] = await ctx.db
        .update(projects)
        .set(updates)
        .where(eq(projects.id, input.id))
        .returning();

      return updated;
    }),
} satisfies TRPCRouterRecord;
