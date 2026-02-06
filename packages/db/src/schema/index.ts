import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

import * as auth from "./auth";

export const fileAccessTypes = pgEnum("file_access_types", [
  "public",
  "private",
]);

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  slug: text("slug").notNull(), // unique across org, but not globally
  defaultFileAccess: fileAccessTypes("default_file_access")
    .notNull()
    .default("private"),
  parentOrganizationId: text("parent_organization_id").references(
    () => auth.organizations.id,
    { onDelete: "cascade" },
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const projectEnvironmentTypes = pgEnum("project_environment_types", [
  "development",
  "staging",
  "production",
]);
export const projectEnvironments = pgTable("project_environments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  slug: text("slug").notNull(), // unique across project, but not globally
  type: projectEnvironmentTypes("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// a unique file
export const files = pgTable("files", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(16)),
  hash: text("hash"), // optional sha256 hash of the file (null if not computed)
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  adapterKey: text("adapter_key").notNull(), // this is the file key in s3
  environmentId: text("environment_id")
    .references(() => projectEnvironments.id, { onDelete: "cascade" })
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const fileKeys = pgTable("file_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(16)),
  fileName: text("file_name").notNull(),
  accessKey: text("access_key")
    .notNull()
    .unique()
    .$defaultFn(() => nanoid(32)),
  fileId: text("file_id").references(() => files.id, { onDelete: "cascade" }), // nullable - null means pending upload
  isPublic: boolean("is_public").notNull().default(false), // resolved from project.defaultFileAccess at creation if not explicitly set
  environmentId: text("environment_id")
    .references(() => projectEnvironments.id, { onDelete: "cascade" })
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  metadata: jsonb("metadata").notNull(),

  // Claimed values from signed URL (for validation)
  claimedHash: text("claimed_hash"), // optional - if provided, worker validates against actual
  claimedMimeType: text("claimed_mime_type"), // optional - if provided, worker validates
  claimedSize: integer("claimed_size").notNull(), // required - for quota/validation

  // Upload state tracking
  uploadCompletedAt: timestamp("upload_completed_at"),
  uploadFailedAt: timestamp("upload_failed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Note: uploadIntents table has been removed and merged into fileKeys
// fileKeys now tracks upload state via nullable fileId (null = pending)

// Relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(auth.organizations, {
    fields: [projects.parentOrganizationId],
    references: [auth.organizations.id],
  }),
  environments: many(projectEnvironments),
  files: many(files),
  fileKeys: many(fileKeys),
  apiKeys: many(apiKeys),
}));

export const projectEnvironmentsRelations = relations(
  projectEnvironments,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectEnvironments.projectId],
      references: [projects.id],
    }),
    files: many(files),
    fileKeys: many(fileKeys),
  }),
);

export const filesRelations = relations(files, ({ one, many }) => ({
  environment: one(projectEnvironments, {
    fields: [files.environmentId],
    references: [projectEnvironments.id],
  }),
  project: one(projects, {
    fields: [files.projectId],
    references: [projects.id],
  }),
  fileKeys: many(fileKeys),
}));

export const fileKeysRelations = relations(fileKeys, ({ one }) => ({
  file: one(files, {
    fields: [fileKeys.fileId],
    references: [files.id],
  }),
  environment: one(projectEnvironments, {
    fields: [fileKeys.environmentId],
    references: [projectEnvironments.id],
  }),
  project: one(projects, {
    fields: [fileKeys.projectId],
    references: [projects.id],
  }),
}));

// API Keys - project-scoped keys for external API access
export const apiKeys = pgTable("api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(16)),
  name: text("name").notNull(), // user-provided name for the key
  keyPrefix: text("key_prefix").notNull(), // first 11 chars for display (sk-bs3-xxxx)
  keyHash: text("key_hash").notNull().unique(), // SHA-256 hash of full key
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: text("organization_id")
    .references(() => auth.organizations.id, { onDelete: "cascade" })
    .notNull(),
  environmentId: text("environment_id").references(
    () => projectEnvironments.id,
    {
      onDelete: "cascade",
    },
  ), // null = all environments
  createdById: text("created_by_id").references(() => auth.members.id, {
    onDelete: "set null",
  }), // nullable in case member is removed
  expiresAt: timestamp("expires_at"), // optional expiration
  lastUsedAt: timestamp("last_used_at"), // track usage
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  project: one(projects, {
    fields: [apiKeys.projectId],
    references: [projects.id],
  }),
  organization: one(auth.organizations, {
    fields: [apiKeys.organizationId],
    references: [auth.organizations.id],
  }),
  environment: one(projectEnvironments, {
    fields: [apiKeys.environmentId],
    references: [projectEnvironments.id],
  }),
  createdBy: one(auth.members, {
    fields: [apiKeys.createdById],
    references: [auth.members.id],
  }),
}));

// Extended organizations relation to include projects and apiKeys
export const organizationsRelationsExtended = relations(
  auth.organizations,
  ({ many }) => ({
    projects: many(projects),
    apiKeys: many(apiKeys),
  }),
);

// Extended members relation to include apiKeys
export const membersRelationsExtended = relations(auth.members, ({ many }) => ({
  apiKeys: many(apiKeys),
}));

export * from "./auth";
