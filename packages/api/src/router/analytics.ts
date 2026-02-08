import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte, sql, sum } from "drizzle-orm";
import { z } from "zod/v4";

import {
  files,
  projects,
  usageDaily,
  usageEvents,
} from "@app/db/schema";

import { organizationProcedure } from "../trpc";

export const analyticsRouter = {
  getProjectStats: organizationProcedure
    .input(
      z.object({
        projectId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (project?.parentOrganizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = input.startDate ?? thirtyDaysAgo.toISOString().slice(0, 10);
      const endDate = input.endDate ?? now.toISOString().slice(0, 10);

      const dailyStats = await ctx.db
        .select({
          date: usageDaily.date,
          uploadsStarted: usageDaily.uploadsStarted,
          uploadsCompleted: usageDaily.uploadsCompleted,
          uploadsFailed: usageDaily.uploadsFailed,
          downloads: usageDaily.downloads,
          bytesUploaded: usageDaily.bytesUploaded,
          bytesDownloaded: usageDaily.bytesDownloaded,
          storageBytes: usageDaily.storageBytes,
        })
        .from(usageDaily)
        .where(
          and(
            eq(usageDaily.projectId, input.projectId),
            gte(usageDaily.date, startDate),
            lte(usageDaily.date, endDate),
          ),
        )
        .orderBy(usageDaily.date);

      const totals = await ctx.db
        .select({
          totalUploadsStarted: sum(usageDaily.uploadsStarted),
          totalUploadsCompleted: sum(usageDaily.uploadsCompleted),
          totalUploadsFailed: sum(usageDaily.uploadsFailed),
          totalDownloads: sum(usageDaily.downloads),
          totalBytesUploaded: sum(usageDaily.bytesUploaded),
          totalBytesDownloaded: sum(usageDaily.bytesDownloaded),
        })
        .from(usageDaily)
        .where(
          and(
            eq(usageDaily.projectId, input.projectId),
            gte(usageDaily.date, startDate),
            lte(usageDaily.date, endDate),
          ),
        );

      const storageResult = await ctx.db
        .select({
          totalBytes: sum(files.size),
          fileCount: sql<number>`count(*)::int`,
        })
        .from(files)
        .where(eq(files.projectId, input.projectId));

      const totalStorage = storageResult[0]?.totalBytes ?? 0;
      const fileCount = storageResult[0]?.fileCount ?? 0;

      return {
        daily: dailyStats,
        totals: {
          uploadsStarted: Number(totals[0]?.totalUploadsStarted ?? 0),
          uploadsCompleted: Number(totals[0]?.totalUploadsCompleted ?? 0),
          uploadsFailed: Number(totals[0]?.totalUploadsFailed ?? 0),
          downloads: Number(totals[0]?.totalDownloads ?? 0),
          bytesUploaded: Number(totals[0]?.totalBytesUploaded ?? 0),
          bytesDownloaded: Number(totals[0]?.totalBytesDownloaded ?? 0),
        },
        storage: {
          totalBytes: Number(totalStorage),
          fileCount,
        },
      };
    }),

  getOrganizationStats: organizationProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = input.startDate ?? thirtyDaysAgo.toISOString().slice(0, 10);
      const endDate = input.endDate ?? now.toISOString().slice(0, 10);

      const dailyStats = await ctx.db
        .select({
          date: usageDaily.date,
          uploadsStarted: sql<number>`sum(${usageDaily.uploadsStarted})::int`,
          uploadsCompleted: sql<number>`sum(${usageDaily.uploadsCompleted})::int`,
          uploadsFailed: sql<number>`sum(${usageDaily.uploadsFailed})::int`,
          downloads: sql<number>`sum(${usageDaily.downloads})::int`,
          bytesUploaded: sql<number>`sum(${usageDaily.bytesUploaded})::bigint`,
          bytesDownloaded: sql<number>`sum(${usageDaily.bytesDownloaded})::bigint`,
        })
        .from(usageDaily)
        .where(
          and(
            eq(usageDaily.organizationId, ctx.organizationId),
            gte(usageDaily.date, startDate),
            lte(usageDaily.date, endDate),
          ),
        )
        .groupBy(usageDaily.date)
        .orderBy(usageDaily.date);

      const totals = await ctx.db
        .select({
          totalUploadsStarted: sum(usageDaily.uploadsStarted),
          totalUploadsCompleted: sum(usageDaily.uploadsCompleted),
          totalUploadsFailed: sum(usageDaily.uploadsFailed),
          totalDownloads: sum(usageDaily.downloads),
          totalBytesUploaded: sum(usageDaily.bytesUploaded),
          totalBytesDownloaded: sum(usageDaily.bytesDownloaded),
        })
        .from(usageDaily)
        .where(
          and(
            eq(usageDaily.organizationId, ctx.organizationId),
            gte(usageDaily.date, startDate),
            lte(usageDaily.date, endDate),
          ),
        );

      const orgProjects = await ctx.db.query.projects.findMany({
        where: eq(projects.parentOrganizationId, ctx.organizationId),
        columns: { id: true },
      });

      const projectIds = orgProjects.map((p) => p.id);

      let totalStorage = 0;
      let fileCount = 0;

      if (projectIds.length > 0) {
        const storageResult = await ctx.db
          .select({
            totalBytes: sum(files.size),
            fileCount: sql<number>`count(*)::int`,
          })
          .from(files)
          .where(sql`${files.projectId} IN ${projectIds}`);

        totalStorage = Number(storageResult[0]?.totalBytes ?? 0);
        fileCount = storageResult[0]?.fileCount ?? 0;
      }

      return {
        daily: dailyStats,
        totals: {
          uploadsStarted: Number(totals[0]?.totalUploadsStarted ?? 0),
          uploadsCompleted: Number(totals[0]?.totalUploadsCompleted ?? 0),
          uploadsFailed: Number(totals[0]?.totalUploadsFailed ?? 0),
          downloads: Number(totals[0]?.totalDownloads ?? 0),
          bytesUploaded: Number(totals[0]?.totalBytesUploaded ?? 0),
          bytesDownloaded: Number(totals[0]?.totalBytesDownloaded ?? 0),
        },
        storage: {
          totalBytes: totalStorage,
          fileCount,
        },
      };
    }),

  getRecentEvents: organizationProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.projectId) {
        const project = await ctx.db.query.projects.findFirst({
          where: eq(projects.id, input.projectId),
        });

        if (project?.parentOrganizationId !== ctx.organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }
      }

      const conditions = [eq(usageEvents.organizationId, ctx.organizationId)];
      if (input.projectId) {
        conditions.push(eq(usageEvents.projectId, input.projectId));
      }

      const events = await ctx.db.query.usageEvents.findMany({
        where: and(...conditions),
        orderBy: desc(usageEvents.createdAt),
        limit: input.limit,
        with: {
          project: { columns: { name: true, slug: true } },
          environment: { columns: { name: true, slug: true } },
          file: { columns: { id: true } },
        },
      });

      return events;
    }),
} satisfies TRPCRouterRecord;
