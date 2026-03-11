"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
var postgres_1 = require("postgres");
var postgres_js_1 = require("drizzle-orm/postgres-js");
var schema = require("./schema");
if (!process.env.POSTGRES_URL) {
    throw new Error("Missing POSTGRES_URL environment variable");
}
var client = (0, postgres_1.default)(process.env.POSTGRES_URL);
exports.db = (0, postgres_js_1.drizzle)({
    client: client,
    schema: schema,
    casing: "snake_case",
});
