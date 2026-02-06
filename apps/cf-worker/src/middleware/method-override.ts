import type { MiddlewareHandler } from "hono";

const ALLOWED_OVERRIDE_METHODS = ["PATCH", "DELETE", "HEAD"] as const;
type OverrideMethod = (typeof ALLOWED_OVERRIDE_METHODS)[number];

function isAllowedMethod(method: string): method is OverrideMethod {
  return ALLOWED_OVERRIDE_METHODS.includes(method as OverrideMethod);
}

export const methodOverride: MiddlewareHandler = async (c, next) => {
  const override = c.req.header("X-HTTP-Method-Override");

  if (override && c.req.method === "POST") {
    const upperOverride = override.toUpperCase();

    if (isAllowedMethod(upperOverride)) {
      const url = new URL(c.req.url);
      const newRequest = new Request(url.toString(), {
        method: upperOverride,
        headers: c.req.raw.headers,
        body: c.req.raw.body,
        duplex: "half",
      } as RequestInit);

      c.req.raw = newRequest;
    }
  }

  await next();
};
