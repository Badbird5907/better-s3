import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { fileAccessTypes } from "@app/db/schema";

import {
  createProject,
  getProjectById,
  listProjects,
  updateProject,
} from "../service/project";
import { organizationProcedure } from "../trpc";

export const projectRouter = {
  list: organizationProcedure.query(async ({ ctx }) => {
    return listProjects(ctx.db, ctx.organizationId);
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(ctx.db, input.id);

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

      return project;
    }),

  create: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createProject(ctx.db, {
        name: input.name,
        organizationId: ctx.organizationId,
      });
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
      const project = await getProjectById(ctx.db, input.id);

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

      return updateProject(ctx.db, {
        id: input.id,
        name: input.name,
        defaultFileAccess: input.defaultFileAccess,
      });
    }),
} satisfies TRPCRouterRecord;
