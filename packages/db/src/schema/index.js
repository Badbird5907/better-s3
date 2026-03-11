"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookAttemptsRelations = exports.usageDailyRelations = exports.usageEventsRelations = exports.usageDaily = exports.usageEvents = exports.webhookAttempts = exports.webhookAttemptStatus = exports.usageEventTypes = exports.membersRelationsExtended = exports.organizationsRelationsExtended = exports.apiKeysRelations = exports.apiKeys = exports.fileKeysRelations = exports.filesRelations = exports.projectEnvironmentsRelations = exports.projectsRelations = exports.fileKeys = exports.files = exports.projectEnvironments = exports.webhookEventTypes = exports.projectEnvironmentTypes = exports.projects = exports.fileKeyStatus = exports.fileAccessTypes = void 0;
var drizzle_orm_1 = require("drizzle-orm");
var pg_core_1 = require("drizzle-orm/pg-core");
var nanoid_1 = require("nanoid");
var auth = require("./auth");
exports.fileAccessTypes = (0, pg_core_1.pgEnum)("file_access_types", [
    "public",
    "private",
]);
exports.fileKeyStatus = (0, pg_core_1.pgEnum)("file_key_status", [
    "pending",
    "completed",
    "failed",
]);
exports.projects = (0, pg_core_1.pgTable)("projects", {
    id: (0, pg_core_1.text)("id")
        .primaryKey()
        .$defaultFn(function () { return (0, nanoid_1.nanoid)(); }),
    name: (0, pg_core_1.text)("name").notNull(),
    slug: (0, pg_core_1.text)("slug").notNull(), // unique across org, but not globally
    defaultFileAccess: (0, exports.fileAccessTypes)("default_file_access")
        .notNull()
        .default("private"),
    parentOrganizationId: (0, pg_core_1.text)("parent_organization_id").references(function () { return auth.organizations.id; }, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .defaultNow()
        .$onUpdate(function () { return new Date(); })
        .notNull(),
});
exports.projectEnvironmentTypes = (0, pg_core_1.pgEnum)("project_environment_types", [
    "development",
    "staging",
    "production",
]);
exports.webhookEventTypes = (0, pg_core_1.pgEnum)("webhook_event_types", [
    "upload.completed",
    "upload.failed",
]);
exports.projectEnvironments = (0, pg_core_1.pgTable)("project_environments", {
    id: (0, pg_core_1.text)("id")
        .primaryKey()
        .$defaultFn(function () { return (0, nanoid_1.nanoid)(); }),
    projectId: (0, pg_core_1.text)("project_id").references(function () { return exports.projects.id; }, {
        onDelete: "cascade",
    }),
    name: (0, pg_core_1.text)("name").notNull(),
    slug: (0, pg_core_1.text)("slug").notNull(), // unique across project, but not globally
    type: (0, exports.projectEnvironmentTypes)("type").notNull(),
    ownerUserId: (0, pg_core_1.text)("owner_user_id").references(function () { return auth.users.id; }, {
        onDelete: "set null",
    }),
    webhookEnabled: (0, pg_core_1.boolean)("webhook_enabled").notNull().default(false),
    webhookUrl: (0, pg_core_1.text)("webhook_url"),
    webhookSecret: (0, pg_core_1.text)("webhook_secret"),
    webhookEvents: (0, exports.webhookEventTypes)("webhook_events")
        .array()
        .notNull()
        .default((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["'{}'::webhook_event_types[]"], ["'{}'::webhook_event_types[]"])))),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .defaultNow()
        .$onUpdate(function () { return new Date(); })
        .notNull(),
});
// a unique file
exports.files = (0, pg_core_1.pgTable)("files", {
    id: (0, pg_core_1.text)("id")
        .primaryKey()
        .$defaultFn(function () { return (0, nanoid_1.nanoid)(16); }),
    hash: (0, pg_core_1.text)("hash"), // optional sha256 hash of the file (null if not computed)
    mimeType: (0, pg_core_1.text)("mime_type").notNull(),
    size: (0, pg_core_1.integer)("size").notNull(),
    adapterKey: (0, pg_core_1.text)("adapter_key").notNull(), // this is the file key in s3
    environmentId: (0, pg_core_1.text)("environment_id")
        .references(function () { return exports.projectEnvironments.id; }, { onDelete: "cascade" })
        .notNull(),
    projectId: (0, pg_core_1.text)("project_id")
        .references(function () { return exports.projects.id; }, { onDelete: "cascade" })
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .defaultNow()
        .$onUpdate(function () { return new Date(); })
        .notNull(),
});
// this represents a upload/intent to upload a file
exports.fileKeys = (0, pg_core_1.pgTable)("file_keys", {
    id: (0, pg_core_1.text)("id")
        .primaryKey()
        .$defaultFn(function () { return (0, nanoid_1.nanoid)(16); }),
    fileName: (0, pg_core_1.text)("file_name").notNull(),
    accessKey: (0, pg_core_1.text)("access_key").notNull(),
    fileId: (0, pg_core_1.text)("file_id").references(function () { return exports.files.id; }, { onDelete: "cascade" }), // nullable - null means pending upload
    isPublic: (0, pg_core_1.boolean)("is_public").notNull().default(false), // resolved from project.defaultFileAccess at creation if not explicitly set
    environmentId: (0, pg_core_1.text)("environment_id")
        .references(function () { return exports.projectEnvironments.id; }, { onDelete: "cascade" })
        .notNull(),
    projectId: (0, pg_core_1.text)("project_id")
        .references(function () { return exports.projects.id; }, { onDelete: "cascade" })
        .notNull(),
    metadata: (0, pg_core_1.jsonb)("metadata").notNull(),
    // Claimed values from signed URL (for validation)
    claimedHash: (0, pg_core_1.text)("claimed_hash"), // optional - if provided, worker validates against actual
    claimedMimeType: (0, pg_core_1.text)("claimed_mime_type"), // optional - if provided, worker validates
    claimedSize: (0, pg_core_1.integer)("claimed_size").notNull(), // required - for quota/validation
    // Upload state tracking
    status: (0, exports.fileKeyStatus)("status").notNull().default("pending"),
    uploadCompletedAt: (0, pg_core_1.timestamp)("upload_completed_at"),
    uploadFailedAt: (0, pg_core_1.timestamp)("upload_failed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .defaultNow()
        .$onUpdate(function () { return new Date(); })
        .notNull(),
}, function (table) { return [
    (0, pg_core_1.uniqueIndex)("file_keys_project_access_key_idx").on(table.projectId, table.accessKey),
]; });
// Relations
exports.projectsRelations = (0, drizzle_orm_1.relations)(exports.projects, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        organization: one(auth.organizations, {
            fields: [exports.projects.parentOrganizationId],
            references: [auth.organizations.id],
        }),
        environments: many(exports.projectEnvironments),
        files: many(exports.files),
        fileKeys: many(exports.fileKeys),
        apiKeys: many(exports.apiKeys),
    });
});
exports.projectEnvironmentsRelations = (0, drizzle_orm_1.relations)(exports.projectEnvironments, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        project: one(exports.projects, {
            fields: [exports.projectEnvironments.projectId],
            references: [exports.projects.id],
        }),
        owner: one(auth.users, {
            fields: [exports.projectEnvironments.ownerUserId],
            references: [auth.users.id],
        }),
        files: many(exports.files),
        fileKeys: many(exports.fileKeys),
    });
});
exports.filesRelations = (0, drizzle_orm_1.relations)(exports.files, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        environment: one(exports.projectEnvironments, {
            fields: [exports.files.environmentId],
            references: [exports.projectEnvironments.id],
        }),
        project: one(exports.projects, {
            fields: [exports.files.projectId],
            references: [exports.projects.id],
        }),
        fileKeys: many(exports.fileKeys),
    });
});
exports.fileKeysRelations = (0, drizzle_orm_1.relations)(exports.fileKeys, function (_a) {
    var one = _a.one;
    return ({
        file: one(exports.files, {
            fields: [exports.fileKeys.fileId],
            references: [exports.files.id],
        }),
        environment: one(exports.projectEnvironments, {
            fields: [exports.fileKeys.environmentId],
            references: [exports.projectEnvironments.id],
        }),
        project: one(exports.projects, {
            fields: [exports.fileKeys.projectId],
            references: [exports.projects.id],
        }),
    });
});
// API Keys - project-scoped keys for external API access
exports.apiKeys = (0, pg_core_1.pgTable)("api_keys", {
    id: (0, pg_core_1.text)("id")
        .primaryKey()
        .$defaultFn(function () { return (0, nanoid_1.nanoid)(16); }),
    name: (0, pg_core_1.text)("name").notNull(), // user-provided name for the key
    keyPrefix: (0, pg_core_1.text)("key_prefix").notNull(), // first 11 chars for display (sk-silo-xxxx)
    keyHash: (0, pg_core_1.text)("key_hash").notNull().unique(), // SHA-256 hash of full key
    projectId: (0, pg_core_1.text)("project_id")
        .references(function () { return exports.projects.id; }, { onDelete: "cascade" })
        .notNull(),
    organizationId: (0, pg_core_1.text)("organization_id")
        .references(function () { return auth.organizations.id; }, { onDelete: "cascade" })
        .notNull(),
    environmentId: (0, pg_core_1.text)("environment_id").references(function () { return exports.projectEnvironments.id; }, {
        onDelete: "cascade",
    }), // null = all environments
    createdById: (0, pg_core_1.text)("created_by_id").references(function () { return auth.members.id; }, {
        onDelete: "set null",
    }), // nullable in case member is removed
    expiresAt: (0, pg_core_1.timestamp)("expires_at"), // optional expiration
    lastUsedAt: (0, pg_core_1.timestamp)("last_used_at"), // track usage
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .defaultNow()
        .$onUpdate(function () { return new Date(); })
        .notNull(),
});
exports.apiKeysRelations = (0, drizzle_orm_1.relations)(exports.apiKeys, function (_a) {
    var one = _a.one;
    return ({
        project: one(exports.projects, {
            fields: [exports.apiKeys.projectId],
            references: [exports.projects.id],
        }),
        organization: one(auth.organizations, {
            fields: [exports.apiKeys.organizationId],
            references: [auth.organizations.id],
        }),
        environment: one(exports.projectEnvironments, {
            fields: [exports.apiKeys.environmentId],
            references: [exports.projectEnvironments.id],
        }),
        createdBy: one(auth.members, {
            fields: [exports.apiKeys.createdById],
            references: [auth.members.id],
        }),
    });
});
// Extended organizations relation to include projects and apiKeys
exports.organizationsRelationsExtended = (0, drizzle_orm_1.relations)(auth.organizations, function (_a) {
    var many = _a.many;
    return ({
        projects: many(exports.projects),
        apiKeys: many(exports.apiKeys),
    });
});
// Extended members relation to include apiKeys
exports.membersRelationsExtended = (0, drizzle_orm_1.relations)(auth.members, function (_a) {
    var many = _a.many;
    return ({
        apiKeys: many(exports.apiKeys),
    });
});
// Analytics: Event Types
exports.usageEventTypes = (0, pg_core_1.pgEnum)("usage_event_types", [
    "upload_started",
    "upload_completed",
    "upload_failed",
    "download",
]);
exports.webhookAttemptStatus = (0, pg_core_1.pgEnum)("webhook_attempt_status", [
    "success",
    "retry",
    "failed",
]);
exports.webhookAttempts = (0, pg_core_1.pgTable)("webhook_attempts", {
    id: (0, pg_core_1.text)("id")
        .primaryKey()
        .$defaultFn(function () { return (0, nanoid_1.nanoid)(); }),
    webhookJobId: (0, pg_core_1.text)("webhook_job_id"),
    eventId: (0, pg_core_1.text)("event_id").notNull(),
    idempotencyKey: (0, pg_core_1.text)("idempotency_key").notNull(),
    queueMessageId: (0, pg_core_1.text)("queue_message_id"),
    environmentId: (0, pg_core_1.text)("environment_id")
        .references(function () { return exports.projectEnvironments.id; }, { onDelete: "cascade" })
        .notNull(),
    projectId: (0, pg_core_1.text)("project_id")
        .references(function () { return exports.projects.id; }, { onDelete: "cascade" })
        .notNull(),
    attemptNumber: (0, pg_core_1.integer)("attempt_number").notNull(),
    status: (0, exports.webhookAttemptStatus)("status").notNull(),
    requestUrl: (0, pg_core_1.text)("request_url").notNull(),
    responseStatus: (0, pg_core_1.integer)("response_status"),
    responseBody: (0, pg_core_1.text)("response_body"),
    error: (0, pg_core_1.text)("error"),
    latencyMs: (0, pg_core_1.integer)("latency_ms"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, function (table) { return [
    (0, pg_core_1.index)("webhook_attempts_event_idx").on(table.eventId),
    (0, pg_core_1.index)("webhook_attempts_idempotency_idx").on(table.idempotencyKey),
    (0, pg_core_1.uniqueIndex)("webhook_attempts_event_attempt_idx").on(table.eventId, table.attemptNumber),
]; });
// Analytics: Raw usage events
exports.usageEvents = (0, pg_core_1.pgTable)("usage_events", {
    id: (0, pg_core_1.text)("id")
        .primaryKey()
        .$defaultFn(function () { return (0, nanoid_1.nanoid)(); }),
    organizationId: (0, pg_core_1.text)("organization_id")
        .references(function () { return auth.organizations.id; }, { onDelete: "cascade" })
        .notNull(),
    projectId: (0, pg_core_1.text)("project_id")
        .references(function () { return exports.projects.id; }, { onDelete: "cascade" })
        .notNull(),
    environmentId: (0, pg_core_1.text)("environment_id")
        .references(function () { return exports.projectEnvironments.id; }, { onDelete: "cascade" })
        .notNull(),
    eventType: (0, exports.usageEventTypes)("event_type").notNull(),
    bytes: (0, pg_core_1.bigint)("bytes", { mode: "number" }),
    fileId: (0, pg_core_1.text)("file_id").references(function () { return exports.files.id; }, { onDelete: "set null" }),
    apiKeyId: (0, pg_core_1.text)("api_key_id").references(function () { return exports.apiKeys.id; }, {
        onDelete: "set null",
    }),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
exports.usageDaily = (0, pg_core_1.pgTable)("usage_daily", {
    id: (0, pg_core_1.text)("id")
        .primaryKey()
        .$defaultFn(function () { return (0, nanoid_1.nanoid)(); }),
    organizationId: (0, pg_core_1.text)("organization_id")
        .references(function () { return auth.organizations.id; }, { onDelete: "cascade" })
        .notNull(),
    projectId: (0, pg_core_1.text)("project_id").references(function () { return exports.projects.id; }, {
        onDelete: "cascade",
    }),
    environmentId: (0, pg_core_1.text)("environment_id").references(function () { return exports.projectEnvironments.id; }, { onDelete: "cascade" }),
    date: (0, pg_core_1.date)("date").notNull(),
    uploadsStarted: (0, pg_core_1.integer)("uploads_started").notNull().default(0),
    uploadsCompleted: (0, pg_core_1.integer)("uploads_completed").notNull().default(0),
    uploadsFailed: (0, pg_core_1.integer)("uploads_failed").notNull().default(0),
    downloads: (0, pg_core_1.integer)("downloads").notNull().default(0),
    bytesUploaded: (0, pg_core_1.bigint)("bytes_uploaded", { mode: "number" })
        .notNull()
        .default(0),
    bytesDownloaded: (0, pg_core_1.bigint)("bytes_downloaded", { mode: "number" })
        .notNull()
        .default(0),
    storageBytes: (0, pg_core_1.bigint)("storage_bytes", { mode: "number" })
        .notNull()
        .default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .defaultNow()
        .$onUpdate(function () { return new Date(); })
        .notNull(),
}, function (table) { return [
    (0, pg_core_1.uniqueIndex)("usage_daily_org_project_env_date_idx").on(table.organizationId, table.projectId, table.environmentId, table.date),
]; });
exports.usageEventsRelations = (0, drizzle_orm_1.relations)(exports.usageEvents, function (_a) {
    var one = _a.one;
    return ({
        organization: one(auth.organizations, {
            fields: [exports.usageEvents.organizationId],
            references: [auth.organizations.id],
        }),
        project: one(exports.projects, {
            fields: [exports.usageEvents.projectId],
            references: [exports.projects.id],
        }),
        environment: one(exports.projectEnvironments, {
            fields: [exports.usageEvents.environmentId],
            references: [exports.projectEnvironments.id],
        }),
        file: one(exports.files, {
            fields: [exports.usageEvents.fileId],
            references: [exports.files.id],
        }),
        apiKey: one(exports.apiKeys, {
            fields: [exports.usageEvents.apiKeyId],
            references: [exports.apiKeys.id],
        }),
    });
});
exports.usageDailyRelations = (0, drizzle_orm_1.relations)(exports.usageDaily, function (_a) {
    var one = _a.one;
    return ({
        organization: one(auth.organizations, {
            fields: [exports.usageDaily.organizationId],
            references: [auth.organizations.id],
        }),
        project: one(exports.projects, {
            fields: [exports.usageDaily.projectId],
            references: [exports.projects.id],
        }),
        environment: one(exports.projectEnvironments, {
            fields: [exports.usageDaily.environmentId],
            references: [exports.projectEnvironments.id],
        }),
    });
});
exports.webhookAttemptsRelations = (0, drizzle_orm_1.relations)(exports.webhookAttempts, function (_a) {
    var one = _a.one;
    return ({
        environment: one(exports.projectEnvironments, {
            fields: [exports.webhookAttempts.environmentId],
            references: [exports.projectEnvironments.id],
        }),
        project: one(exports.projects, {
            fields: [exports.webhookAttempts.projectId],
            references: [exports.projects.id],
        }),
    });
});
__exportStar(require("./auth"), exports);
var templateObject_1;
