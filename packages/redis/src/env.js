"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
var env_core_1 = require("@t3-oss/env-core");
var zod_1 = require("zod");
exports.env = (0, env_core_1.createEnv)({
    /**
     * Specify your server-side environment variables schema here.
     * This way you can ensure the app isn't built with invalid env vars.
     */
    server: {
        NODE_ENV: zod_1.z
            .enum(["development", "production", "test"])
            .default("development"),
        UPSTASH_REDIS_REST_URL: zod_1.z.url(),
        UPSTASH_REDIS_REST_TOKEN: zod_1.z.string()
    },
    /**
     * Specify your client-side environment variables schema here.
     * For them to be exposed to th`e client, prefix them with `NEXT_PUBLIC_`.
     */
    client: {},
    /**
     * Specify your shared environment variables schema here.
     */
    shared: {},
    /**
     * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
     */
    runtimeEnv: {
        NODE_ENV: process.env.NODE_ENV,
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    },
    clientPrefix: "NEXT_PUBLIC_",
    skipValidation: !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
