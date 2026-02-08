import { analyticsRouter } from "./router/analytics";
import { apiKeyRouter } from "./router/apiKey";
import { authRouter } from "./router/auth";
import { fileRouter } from "./router/file";
import { fileKeyRouter } from "./router/fileKey";
import { organizationRouter } from "./router/organization";
import { projectRouter } from "./router/project";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  apiKey: apiKeyRouter,
  auth: authRouter,
  file: fileRouter,
  fileKey: fileKeyRouter,
  organization: organizationRouter,
  project: projectRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
