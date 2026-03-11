"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitationsRelations = exports.membersRelations = exports.organizationsRelations = exports.accountsRelations = exports.sessionsRelations = exports.usersRelations = exports.invitations = exports.members = exports.organizations = exports.verifications = exports.accounts = exports.sessions = exports.users = void 0;
var drizzle_orm_1 = require("drizzle-orm");
var pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    emailVerified: (0, pg_core_1.boolean)("email_verified").default(false).notNull(),
    image: (0, pg_core_1.text)("image"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .defaultNow()
        .$onUpdate(function () { /* @__PURE__ */ return new Date(); })
        .notNull(),
});
exports.sessions = (0, pg_core_1.pgTable)("sessions", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    token: (0, pg_core_1.text)("token").notNull().unique(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .$onUpdate(function () { /* @__PURE__ */ return new Date(); })
        .notNull(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    activeOrganizationId: (0, pg_core_1.text)("active_organization_id"),
}, function (table) { return [(0, pg_core_1.index)("sessions_userId_idx").on(table.userId)]; });
exports.accounts = (0, pg_core_1.pgTable)("accounts", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    accountId: (0, pg_core_1.text)("account_id").notNull(),
    providerId: (0, pg_core_1.text)("provider_id").notNull(),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    accessToken: (0, pg_core_1.text)("access_token"),
    refreshToken: (0, pg_core_1.text)("refresh_token"),
    idToken: (0, pg_core_1.text)("id_token"),
    accessTokenExpiresAt: (0, pg_core_1.timestamp)("access_token_expires_at"),
    refreshTokenExpiresAt: (0, pg_core_1.timestamp)("refresh_token_expires_at"),
    scope: (0, pg_core_1.text)("scope"),
    password: (0, pg_core_1.text)("password"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .$onUpdate(function () { /* @__PURE__ */ return new Date(); })
        .notNull(),
}, function (table) { return [(0, pg_core_1.index)("accounts_userId_idx").on(table.userId)]; });
exports.verifications = (0, pg_core_1.pgTable)("verifications", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    identifier: (0, pg_core_1.text)("identifier").notNull(),
    value: (0, pg_core_1.text)("value").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at")
        .defaultNow()
        .$onUpdate(function () { /* @__PURE__ */ return new Date(); })
        .notNull(),
}, function (table) { return [(0, pg_core_1.index)("verifications_identifier_idx").on(table.identifier)]; });
exports.organizations = (0, pg_core_1.pgTable)("organizations", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    slug: (0, pg_core_1.text)("slug").notNull().unique(),
    logo: (0, pg_core_1.text)("logo"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull(),
    metadata: (0, pg_core_1.text)("metadata"),
});
exports.members = (0, pg_core_1.pgTable)("members", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    organizationId: (0, pg_core_1.text)("organization_id")
        .notNull()
        .references(function () { return exports.organizations.id; }, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    role: (0, pg_core_1.text)("role").default("member").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull(),
});
exports.invitations = (0, pg_core_1.pgTable)("invitations", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    organizationId: (0, pg_core_1.text)("organization_id")
        .notNull()
        .references(function () { return exports.organizations.id; }, { onDelete: "cascade" }),
    email: (0, pg_core_1.text)("email").notNull(),
    role: (0, pg_core_1.text)("role"),
    status: (0, pg_core_1.text)("status").default("pending").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    inviterId: (0, pg_core_1.text)("inviter_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
});
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, function (_a) {
    var many = _a.many;
    return ({
        sessions: many(exports.sessions),
        accounts: many(exports.accounts),
        members: many(exports.members),
        invitations: many(exports.invitations),
    });
});
exports.sessionsRelations = (0, drizzle_orm_1.relations)(exports.sessions, function (_a) {
    var one = _a.one;
    return ({
        users: one(exports.users, {
            fields: [exports.sessions.userId],
            references: [exports.users.id],
        }),
    });
});
exports.accountsRelations = (0, drizzle_orm_1.relations)(exports.accounts, function (_a) {
    var one = _a.one;
    return ({
        users: one(exports.users, {
            fields: [exports.accounts.userId],
            references: [exports.users.id],
        }),
    });
});
exports.organizationsRelations = (0, drizzle_orm_1.relations)(exports.organizations, function (_a) {
    var many = _a.many;
    return ({
        members: many(exports.members),
        invitations: many(exports.invitations),
    });
});
exports.membersRelations = (0, drizzle_orm_1.relations)(exports.members, function (_a) {
    var one = _a.one;
    return ({
        organizations: one(exports.organizations, {
            fields: [exports.members.organizationId],
            references: [exports.organizations.id],
        }),
        users: one(exports.users, {
            fields: [exports.members.userId],
            references: [exports.users.id],
        }),
    });
});
exports.invitationsRelations = (0, drizzle_orm_1.relations)(exports.invitations, function (_a) {
    var one = _a.one;
    return ({
        organizations: one(exports.organizations, {
            fields: [exports.invitations.organizationId],
            references: [exports.organizations.id],
        }),
        users: one(exports.users, {
            fields: [exports.invitations.inviterId],
            references: [exports.users.id],
        }),
    });
});
