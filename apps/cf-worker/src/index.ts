import { Hono } from "hono";

import type { Bindings, Variables } from "./types/bindings";
import { requireCallbackSecret } from "./middleware/auth";
import { cors } from "./middleware/cors";
import { methodOverride } from "./middleware/method-override";
import {
  extractProject,
  requireMainDomain,
  requireProject,
} from "./middleware/project";
import { handleDownload } from "./routes/download";
import { handleInternalDelete } from "./routes/internal/delete";
import { handleInternalList } from "./routes/internal/list";
import { handleInternalMetadata } from "./routes/internal/metadata";
import { handleTusCreate } from "./routes/tus/create";
import { handleTusDelete } from "./routes/tus/delete";
import { handleTusHead } from "./routes/tus/head";
import { handleTusOptions } from "./routes/tus/options";
import { handleTusPatch } from "./routes/tus/patch";
import { createErrorResponse } from "./utils/errors";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", cors);
app.use("*", methodOverride);
app.use("*", extractProject);

app.get("/health", (c) => c.json({ status: "ok", version: "1.0.0" }));

app.options("/ingest/tus", requireProject, handleTusOptions);
app.options("/ingest/tus/:uploadId", requireProject, handleTusOptions);
app.post("/ingest/tus", requireProject, handleTusCreate);
app.on("HEAD", "/ingest/tus/:uploadId", requireProject, handleTusHead);
app.patch("/ingest/tus/:uploadId", requireProject, handleTusPatch);
app.delete("/ingest/tus/:uploadId", requireProject, handleTusDelete);

app.get("/f/:accessKey", requireProject, handleDownload);

// internal routes
app.delete(
  "/internal/delete/:adapterKey",
  requireMainDomain,
  requireCallbackSecret,
  handleInternalDelete,
);
app.post(
  "/internal/list",
  requireMainDomain,
  requireCallbackSecret,
  handleInternalList,
);
app.post(
  "/internal/get-metadata/:adapterKey",
  requireMainDomain,
  requireCallbackSecret,
  handleInternalMetadata,
);

app.onError((err) => {
  console.error("Unhandled error:", err);
  return createErrorResponse(err);
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

export default app;
