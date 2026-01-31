import { Hono } from "hono";

interface Bindings {
  R2_BUCKET: R2Bucket;
  NEXTJS_CALLBACK_URL: string;
  SIGNING_SECRET: string;
}

const app = new Hono<{ Bindings: Bindings }>();

app.get("/*", (c) => {
  return c.text("Hello World");
});

// TODO: TUS upload endpoint
app.post("/upload/*", async (c) => {
  await Promise.resolve("hi");
  return c.text("TUS upload handler - not implemented");
});

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
