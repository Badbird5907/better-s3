import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  SQL,
} from "drizzle-orm";
import { z } from "zod/v4";

import { fileKeys, files, projectEnvironments, projects } from "@app/db/schema";

import { organizationProcedure } from "../trpc";

const sortFieldSchema = z.enum(["createdAt", "size", "mimeType"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

export const fileRouter = {
  list: organizationProcedure
    .input(
      z.object({
        projectId: z.string(),
        // Pagination
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        // Filters
        search: z.string().optional(),
        mimeType: z.string().optional(), // e.g., "image", "video", "application/pdf"
        environmentId: z.string().optional(),
        minSize: z.number().optional(), // in bytes
        maxSize: z.number().optional(), // in bytes
        startDate: z.string().optional(), // ISO date string
        endDate: z.string().optional(), // ISO date string
        // Sorting
        sortBy: sortFieldSchema.default("createdAt"),
        sortOrder: sortOrderSchema.default("desc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify project belongs to the organization
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
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

      // Build filter conditions
      const conditions: SQL<unknown>[] = [eq(files.projectId, input.projectId)];

      if (input.environmentId) {
        conditions.push(eq(files.environmentId, input.environmentId));
      }

      if (input.mimeType) {
        // Support partial mime type matching (e.g., "image" matches "image/png", "image/jpeg")
        conditions.push(ilike(files.mimeType, `${input.mimeType}%`));
      }

      if (input.minSize !== undefined) {
        conditions.push(gte(files.size, input.minSize));
      }

      if (input.maxSize !== undefined) {
        conditions.push(lte(files.size, input.maxSize));
      }

      if (input.startDate) {
        conditions.push(gte(files.createdAt, new Date(input.startDate)));
      }

      if (input.endDate) {
        conditions.push(lte(files.createdAt, new Date(input.endDate)));
      }

      const whereClause = and(...conditions);

      // Get total count for pagination
      const [countResult] = await ctx.db
        .select({ count: count() })
        .from(files)
        .where(whereClause);

      const totalCount = countResult?.count ?? 0;
      const totalPages = Math.ceil(totalCount / input.pageSize);
      const offset = (input.page - 1) * input.pageSize;

      // Build sort order
      const sortColumn = {
        createdAt: files.createdAt,
        size: files.size,
        mimeType: files.mimeType,
      }[input.sortBy];

      const orderBy =
        input.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);

      // Fetch files with related data
      const fileList = await ctx.db
        .select({
          id: files.id,
          hash: files.hash,
          mimeType: files.mimeType,
          size: files.size,
          s3Url: files.s3Url,
          environmentId: files.environmentId,
          projectId: files.projectId,
          createdAt: files.createdAt,
          updatedAt: files.updatedAt,
        })
        .from(files)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(input.pageSize)
        .offset(offset);

      // Get environment names for the files
      const environmentIds = [...new Set(fileList.map((f) => f.environmentId))];
      const environments =
        environmentIds.length > 0
          ? await ctx.db.query.projectEnvironments.findMany({
              where: or(
                ...environmentIds.map((id) => eq(projectEnvironments.id, id)),
              ),
              columns: { id: true, name: true, type: true },
            })
          : [];

      const environmentMap = new Map(environments.map((e) => [e.id, e]));

      // Get file key counts for each file
      const fileIds = fileList.map((f) => f.id);
      const fileKeyCountsResult =
        fileIds.length > 0
          ? await ctx.db
              .select({
                fileId: fileKeys.fileId,
                count: count(),
              })
              .from(fileKeys)
              .where(or(...fileIds.map((id) => eq(fileKeys.fileId, id))))
              .groupBy(fileKeys.fileId)
          : [];

      const fileKeyCountMap = new Map(
        fileKeyCountsResult.map((r) => [r.fileId, r.count]),
      );

      // Combine data
      const filesWithDetails = fileList.map((file) => ({
        ...file,
        environment: environmentMap.get(file.environmentId) ?? null,
        fileKeyCount: fileKeyCountMap.get(file.id) ?? 0,
      }));

      return {
        files: filesWithDetails,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
          hasNextPage: input.page < totalPages,
          hasPreviousPage: input.page > 1,
        },
      };
    }),

  getById: organizationProcedure
    .input(z.object({ id: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify project belongs to the organization
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (project?.parentOrganizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }

      const file = await ctx.db.query.files.findFirst({
        where: and(
          eq(files.id, input.id),
          eq(files.projectId, input.projectId),
        ),
        with: {
          environment: true,
          fileKeys: true,
        },
      });

      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found",
        });
      }

      return file;
    }),

  // Get available filter options for a project
  getFilterOptions: organizationProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify project belongs to the organization
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (project?.parentOrganizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }

      // Get environments for the project
      const environments = await ctx.db.query.projectEnvironments.findMany({
        where: eq(projectEnvironments.projectId, input.projectId),
        columns: { id: true, name: true, type: true },
      });

      // Get unique mime type categories
      const mimeTypesResult = await ctx.db
        .selectDistinct({ mimeType: files.mimeType })
        .from(files)
        .where(eq(files.projectId, input.projectId));

      // Extract unique mime type prefixes (e.g., "image", "video", "application")
      const mimeTypeCategories = [
        ...new Set(
          mimeTypesResult.map((r) => r.mimeType.split("/")[0]).filter(Boolean),
        ),
      ].sort();

      return {
        environments,
        mimeTypeCategories,
      };
    }),

  // Get file statistics for a project
  getStats: organizationProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify project belongs to the organization
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (project?.parentOrganizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }

      const [stats] = await ctx.db
        .select({
          totalFiles: count(),
        })
        .from(files)
        .where(eq(files.projectId, input.projectId));

      // Get total size using raw SQL for sum
      const projectFiles = await ctx.db.query.files.findMany({
        where: eq(files.projectId, input.projectId),
        columns: { size: true },
      });

      const totalSize = projectFiles.reduce((sum, f) => sum + f.size, 0);

      return {
        totalFiles: stats?.totalFiles ?? 0,
        totalSize,
      };
    }),
} satisfies TRPCRouterRecord;
