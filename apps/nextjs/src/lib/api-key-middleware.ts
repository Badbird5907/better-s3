import { and, eq } from "@app/db";
import {
  apiKeys,
  organizations,
  projects,
  projectEnvironments,
} from "@app/db/schema";
import { db } from "@app/db/client";

type Organization = typeof organizations.$inferSelect;
type Project = typeof projects.$inferSelect;
type ProjectEnvironment = typeof projectEnvironments.$inferSelect;

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function extractApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const apiKeyHeader = request.headers.get("X-API-Key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

export interface ApiKeyContext {
  apiKeyId: string;
  projectId: string;
  organizationId: string;
  keyName: string;
  expiresAt: Date | null;
}

export interface ApiKeyContextWithProject extends ApiKeyContext {
  project: Project;
  organization: Organization;
}

export interface ApiKeyContextWithEnvironment extends ApiKeyContextWithProject {
  environment: ProjectEnvironment;
}

export async function validateApiKey(
  apiKey: string
): Promise<ApiKeyContext | null> {
  if (!apiKey) {
    return null;
  }

  try {
    const keyHash = await hashApiKey(apiKey);

    const key = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });

    if (!key) {
      return null;
    }

    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return null;
    }

    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id));

    return {
      apiKeyId: key.id,
      projectId: key.projectId,
      organizationId: key.organizationId,
      keyName: key.name,
      expiresAt: key.expiresAt,
    };
  } catch (error) {
    console.error("Error validating API key:", error);
    return null;
  }
}

export async function getProjectWithOrg(
  projectId: string,
  organizationId: string
): Promise<{ project: Project; organization: Organization } | null> {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.parentOrganizationId, organizationId)
    ),
  });

  if (!project) {
    return null;
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    return null;
  }

  return { project, organization };
}

export async function getEnvironment(
  environmentId: string,
  projectId: string
): Promise<ProjectEnvironment | null> {
  const environment = await db.query.projectEnvironments.findFirst({
    where: and(
      eq(projectEnvironments.id, environmentId),
      eq(projectEnvironments.projectId, projectId)
    ),
  });

  return environment ?? null;
}

export async function withApiKeyAuth(
  request: Request,
  handler: (request: Request, context: ApiKeyContext) => Promise<Response>
): Promise<Response> {
  const apiKey = extractApiKeyFromRequest(request);

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message:
          "API key is required. Use Authorization: Bearer <key> or X-API-Key header.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const context = await validateApiKey(apiKey);

  if (!context) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Invalid or expired API key.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return handler(request, context);
}

export async function withApiKeyAuthProject(
  request: Request,
  handler: (
    request: Request,
    context: ApiKeyContextWithProject
  ) => Promise<Response>
): Promise<Response> {
  return withApiKeyAuth(request, async (req, baseContext) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "Invalid JSON body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "Request body must be a JSON object",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const projectId = (body as Record<string, unknown>).projectId;
    if (!projectId || typeof projectId !== "string") {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "projectId is required in request body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (projectId !== baseContext.projectId) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "API key does not have access to this project",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result = await getProjectWithOrg(
      projectId,
      baseContext.organizationId
    );

    if (!result) {
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Project not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const newRequest = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(body),
    });

    return handler(newRequest, {
      ...baseContext,
      project: result.project,
      organization: result.organization,
    });
  });
}

export async function withApiKeyAuthEnvironment(
  request: Request,
  handler: (
    request: Request,
    context: ApiKeyContextWithEnvironment
  ) => Promise<Response>
): Promise<Response> {
  return withApiKeyAuthProject(request, async (req, projectContext) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "Invalid JSON body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "Request body must be a JSON object",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const environmentId = (body as Record<string, unknown>).environmentId;
    if (!environmentId || typeof environmentId !== "string") {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "environmentId is required in request body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const environment = await getEnvironment(
      environmentId,
      projectContext.projectId
    );

    if (!environment) {
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: "Environment not found or does not belong to this project",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const newRequest = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(body),
    });

    return handler(newRequest, {
      ...projectContext,
      environment,
    });
  });
}
