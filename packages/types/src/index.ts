import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

import * as schema from "@app/db/schema";

export type Schema = typeof schema;

// Project
export type Project = typeof schema.projects.$inferSelect;
export type InsertProject = typeof schema.projects.$inferInsert;
export const insertProjectSchema = createInsertSchema(schema.projects);
export const selectProjectSchema = createSelectSchema(schema.projects);

// Project Environment
export type ProjectEnvironment = typeof schema.projectEnvironments.$inferSelect;
export type InsertProjectEnvironment =
  typeof schema.projectEnvironments.$inferInsert;
export const insertProjectEnvironmentSchema = createInsertSchema(
  schema.projectEnvironments,
);
export const selectProjectEnvironmentSchema = createSelectSchema(
  schema.projectEnvironments,
);
export type ProjectEnvironmentType = ProjectEnvironment["type"];

// ============================================================================
// File Types
// ============================================================================

// File
export type File = typeof schema.files.$inferSelect;
export type InsertFile = typeof schema.files.$inferInsert;
export const insertFileSchema = createInsertSchema(schema.files);
export const selectFileSchema = createSelectSchema(schema.files);

// File Key
export type FileKey = typeof schema.fileKeys.$inferSelect;
export type InsertFileKey = typeof schema.fileKeys.$inferInsert;
export const insertFileKeySchema = createInsertSchema(schema.fileKeys);
export const selectFileKeySchema = createSelectSchema(schema.fileKeys);

// Upload Intent
export type UploadIntent = typeof schema.uploadIntents.$inferSelect;
export type InsertUploadIntent = typeof schema.uploadIntents.$inferInsert;
export const insertUploadIntentSchema = createInsertSchema(
  schema.uploadIntents,
);
export const selectUploadIntentSchema = createSelectSchema(
  schema.uploadIntents,
);
export type UploadIntentStatus = UploadIntent["status"];

// ============================================================================
// API Key Types
// ============================================================================

// API Key
export type ApiKey = typeof schema.apiKeys.$inferSelect;
export type InsertApiKey = typeof schema.apiKeys.$inferInsert;
export const insertApiKeySchema = createInsertSchema(schema.apiKeys);
export const selectApiKeySchema = createSelectSchema(schema.apiKeys);
