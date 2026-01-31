import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

import { and, eq, inArray } from "@app/db";
import {
  apiKeys,
  members,
  projectEnvironments,
  projects,
  users,
} from "@app/db/schema";

import { organizationProcedure } from "../trpc";

// Helper to hash the API key using SHA-256
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const apiKeyRouter = {
  list: organizationProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify project belongs to the organization
      const project = await ctx.db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.parentOrganizationId, ctx.organizationId),
        ),
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const keys = await ctx.db.query.apiKeys.findMany({
        where: eq(apiKeys.projectId, input.projectId),
        orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)],
        with: {
          environment: true,
        },
      });

      const memberIds = [
        ...new Set(keys.map((k) => k.createdById).filter(Boolean)),
      ] as string[];

      const membersWithUsers =
        memberIds.length > 0
          ? await ctx.db
              .select({
                memberId: members.id,
                userId: users.id,
                userName: users.name,
                userEmail: users.email,
                userImage: users.image,
              })
              .from(members)
              .innerJoin(users, eq(members.userId, users.id))
              .where(inArray(members.id, memberIds))
          : [];

      const memberMap = new Map(
        membersWithUsers.map((m) => [
          m.memberId,
          {
            id: m.memberId,
            user: {
              id: m.userId,
              name: m.userName,
              email: m.userEmail,
              image: m.userImage,
            },
          },
        ]),
      );

      return keys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        projectId: key.projectId,
        organizationId: key.organizationId,
        environmentId: key.environmentId,
        environment: key.environment
          ? {
              id: key.environment.id,
              name: key.environment.name,
              type: key.environment.type,
            }
          : null,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        createdBy: key.createdById
          ? (memberMap.get(key.createdById) ?? null)
          : null,
      }));
    }),

  // Create a new API key
  create: organizationProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1, "Name is required").max(100),
        environmentId: z.string().optional(), // null/undefined = all environments
        expiresAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.parentOrganizationId, ctx.organizationId),
        ),
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // If environmentId is provided, verify it belongs to this project
      if (input.environmentId) {
        const environment = await ctx.db.query.projectEnvironments.findFirst({
          where: and(
            eq(projectEnvironments.id, input.environmentId),
            eq(projectEnvironments.projectId, input.projectId),
          ),
        });

        if (!environment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Environment not found",
          });
        }
      }

      const fullKey = `sk-bs3-${nanoid(32)}`;
      const keyPrefix = fullKey.substring(0, 11);
      const keyHash = await hashApiKey(fullKey);

      const [newKey] = await ctx.db
        .insert(apiKeys)
        .values({
          name: input.name,
          keyPrefix,
          keyHash,
          projectId: input.projectId,
          organizationId: ctx.organizationId,
          environmentId: input.environmentId ?? null,
          createdById: ctx.membership.id,
          expiresAt: input.expiresAt,
        })
        .returning();

      return {
        id: newKey?.id,
        name: newKey?.name,
        key: fullKey,
        keyPrefix: newKey?.keyPrefix,
        environmentId: newKey?.environmentId,
        expiresAt: newKey?.expiresAt,
        createdAt: newKey?.createdAt,
      };
    }),

  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = await ctx.db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.id, input.id),
          eq(apiKeys.organizationId, ctx.organizationId),
        ),
      });

      if (!apiKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      await ctx.db.delete(apiKeys).where(eq(apiKeys.id, input.id));

      return { success: true };
    }),

  // Get environments for a project (for API key creation)
  getEnvironments: organizationProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify project belongs to the organization
      const project = await ctx.db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.parentOrganizationId, ctx.organizationId),
        ),
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const environments = await ctx.db.query.projectEnvironments.findMany({
        where: eq(projectEnvironments.projectId, input.projectId),
        orderBy: (env, { asc }) => [asc(env.name)],
      });

      return environments.map((env) => ({
        id: env.id,
        name: env.name,
        type: env.type,
      }));
    }),
} satisfies TRPCRouterRecord;
