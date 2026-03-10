import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, eq } from "@app/db";
import {  projects } from "@app/db/schema";

import {
  createEnvironment,
  deleteEnvironment,
  getEnvironmentById,
  listEnvironments,
  updateEnvironment,
} from "../service/environment";
import { organizationProcedure } from "../trpc";

/** Validate that a project belongs to the caller's organization. */
async function validateProjectAccess(
  db: Parameters<typeof listEnvironments>[0],
  projectId: string,
  organizationId: string,
) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.parentOrganizationId, organizationId),
    ),
  });

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  return project;
}

/** Validate that an environment belongs to a project owned by the caller's organization. */
async function validateEnvironmentAccess(
  db: Parameters<typeof listEnvironments>[0],
  environmentId: string,
  organizationId: string,
) {
  const environment = await getEnvironmentById(db, environmentId);

  if (!environment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Environment not found",
    });
  }

  if (!environment.projectId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Environment is missing a project reference",
    });
  }

  await validateProjectAccess(db, environment.projectId, organizationId);

  return environment;
}

export const environmentRouter = {
  list: organizationProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await validateProjectAccess(ctx.db, input.projectId, ctx.organizationId);
      return listEnvironments(ctx.db, input.projectId);
    }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return validateEnvironmentAccess(ctx.db, input.id, ctx.organizationId);
    }),

  create: organizationProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1, "Name is required").max(100),
        type: z.enum(["development", "staging", "production"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await validateProjectAccess(ctx.db, input.projectId, ctx.organizationId);

      return createEnvironment(ctx.db, {
        projectId: input.projectId,
        name: input.name,
        type: input.type,
      });
    }),

  update: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        type: z.enum(["development", "staging", "production"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await validateEnvironmentAccess(ctx.db, input.id, ctx.organizationId);

      return updateEnvironment(ctx.db, {
        id: input.id,
        name: input.name,
        type: input.type,
      });
    }),

  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await validateEnvironmentAccess(ctx.db, input.id, ctx.organizationId);
      return deleteEnvironment(ctx.db, input.id);
    }),
} satisfies TRPCRouterRecord;
