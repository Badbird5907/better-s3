import type {
  PrepareUploadInput,
  RegisterUploadBatchResult,
  UploadCore,
  UploadFileInput,
} from "@silo-storage/sdk-core";

import { buildInternalCallbackMetadata } from "./envelope";

export interface SiloRouteFileConstraint {
  maxFileSize?: string;
  minFileCount?: number;
  maxFileCount?: number;
}

export type SiloRouteConfig = Record<string, SiloRouteFileConstraint>;

export interface SiloRouteMiddlewareArgs<
  TRequest,
  TRouteConfig extends SiloRouteConfig,
  TContext = undefined,
> {
  req: TRequest;
  context?: TContext;
  files: UploadFileInput[];
  routeConfig: TRouteConfig;
  routeSlug: string;
}

export interface SiloOnUploadCompleteArgs<TMiddlewareData, TContext = undefined> {
  metadata: TMiddlewareData;
  context?: TContext;
  file: {
    environmentId: string;
    projectId: string;
    fileKeyId: string;
    accessKey: string;
    fileId: string;
    fileName: string;
    hash: string | null;
    mimeType: string;
    size: number;
    metadata: Record<string, unknown>;
  };
  event: {
    id: string;
    type: "upload.completed";
    version: 1;
    occurredAt: string;
    data: {
      environmentId: string;
      projectId: string;
      fileKeyId: string;
      accessKey: string;
      fileId: string;
      fileName: string;
      hash: string | null;
      mimeType: string;
      size: number;
      metadata: Record<string, unknown>;
    };
  };
}

export type MiddlewareFn<
  TRequest,
  TRouteConfig extends SiloRouteConfig,
  TMiddlewareData extends Record<string, unknown>,
  TContext = undefined,
> = (
  args: SiloRouteMiddlewareArgs<TRequest, TRouteConfig, TContext>,
) => Promise<TMiddlewareData> | TMiddlewareData;

export type OnUploadCompleteFn<
  TMiddlewareData extends Record<string, unknown>,
  TOutput,
  TContext = undefined,
> = (
  args: SiloOnUploadCompleteArgs<TMiddlewareData, TContext>,
) => Promise<TOutput> | TOutput;

export interface SiloFileRoute<
  TRequest,
  TContext,
  TRouteConfig extends SiloRouteConfig,
  TMiddlewareData extends Record<string, unknown>,
  TOutput,
> {
  routeConfig: TRouteConfig;
  middleware?: MiddlewareFn<TRequest, TRouteConfig, TMiddlewareData, TContext>;
  onUploadComplete: OnUploadCompleteFn<TMiddlewareData, TOutput, TContext>;
}

interface SiloRouteBuilder<
  TRequest,
  TContext,
  TRouteConfig extends SiloRouteConfig,
  TMiddlewareData extends Record<string, unknown>,
> {
  middleware: <TNextMiddlewareData extends Record<string, unknown>>(
    middleware: MiddlewareFn<
      TRequest,
      TRouteConfig,
      TNextMiddlewareData,
      TContext
    >,
  ) => SiloRouteBuilder<TRequest, TContext, TRouteConfig, TNextMiddlewareData>;
  onUploadComplete: <TOutput>(
    onUploadComplete: OnUploadCompleteFn<TMiddlewareData, TOutput, TContext>,
  ) => SiloFileRoute<TRequest, TContext, TRouteConfig, TMiddlewareData, TOutput>;
}

export type FileRouter<TRequest = unknown, TContext = undefined> = Record<
  string,
  SiloFileRoute<
    TRequest,
    TContext,
    SiloRouteConfig,
    Record<string, unknown>,
    unknown
  >
>;

export type InferMiddlewareData<TRoute> = TRoute extends SiloFileRoute<
  unknown,
  unknown,
  SiloRouteConfig,
  infer TMiddlewareData,
  unknown
>
  ? TMiddlewareData
  : never;

export type InferRouteOutput<TRoute> = TRoute extends SiloFileRoute<
  unknown,
  unknown,
  SiloRouteConfig,
  Record<string, unknown>,
  infer TOutput
>
  ? TOutput
  : never;

function createRouteBuilder<
  TRequest,
  TContext,
  TRouteConfig extends SiloRouteConfig,
  TMiddlewareData extends Record<string, unknown>,
>(
  routeConfig: TRouteConfig,
  middleware?: MiddlewareFn<TRequest, TRouteConfig, TMiddlewareData, TContext>,
): SiloRouteBuilder<TRequest, TContext, TRouteConfig, TMiddlewareData> {
  return {
    middleware: <TNextMiddlewareData extends Record<string, unknown>>(
      nextMiddleware: MiddlewareFn<
        TRequest,
        TRouteConfig,
        TNextMiddlewareData,
        TContext
      >,
    ) => createRouteBuilder<TRequest, TContext, TRouteConfig, TNextMiddlewareData>(
      routeConfig,
      nextMiddleware,
    ),
    onUploadComplete: <TOutput>(
      onUploadComplete: OnUploadCompleteFn<TMiddlewareData, TOutput, TContext>,
    ) => ({
      routeConfig,
      middleware,
      onUploadComplete,
    }),
  };
}

export function createSiloUpload<TRequest = Request, TContext = undefined>() {
  return <TRouteConfig extends SiloRouteConfig>(routeConfig: TRouteConfig) =>
    createRouteBuilder<TRequest, TContext, TRouteConfig, Record<string, never>>(
      routeConfig,
    );
}

function toRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

export interface RegisterRouteUploadInput<
  TRouter extends FileRouter<TRequest, TContext>,
  TRouteSlug extends keyof TRouter & string,
  TRequest,
  TContext = undefined,
> {
  core: UploadCore;
  router: TRouter;
  routeSlug: TRouteSlug;
  req: TRequest;
  context?: TContext;
  files: UploadFileInput[];
  callbackUrl?: string;
  requestMetadata?: Record<string, unknown>;
  dev?: boolean;
  expiresIn?: number;
  protocol?: "http" | "https";
}

export interface RegisterRouteUploadResult<
  TMiddlewareData extends Record<string, unknown>,
> {
  routeSlug: string;
  middlewareData: TMiddlewareData;
  callbackMetadata: Record<string, unknown>;
  registerResult: RegisterUploadBatchResult;
}

export async function registerRouteUpload<
  TRouter extends FileRouter<TRequest, TContext>,
  TRouteSlug extends keyof TRouter & string,
  TRequest,
  TContext = undefined,
>(
  input: RegisterRouteUploadInput<TRouter, TRouteSlug, TRequest, TContext>,
): Promise<
  RegisterRouteUploadResult<InferMiddlewareData<TRouter[TRouteSlug]>>
> {
  const route = input.router[input.routeSlug];
  if (!route) {
    throw new Error(`Unknown route slug "${input.routeSlug}"`);
  }

  const middlewareData = route.middleware
    ? toRecord(
        await route.middleware({
          req: input.req,
          context: input.context,
          files: input.files,
          routeConfig: route.routeConfig,
          routeSlug: input.routeSlug,
        }),
        `Middleware for route "${input.routeSlug}" must return a plain object`,
      )
    : {};

  const callbackMetadata = buildInternalCallbackMetadata({
    routeSlug: input.routeSlug,
    middlewareData,
  });

  const registerResult = await input.core.registerUploadBatch({
    files: input.files,
    callbackUrl: input.callbackUrl,
    callbackMetadata,
    requestMetadata: input.requestMetadata,
    dev: input.dev,
    expiresIn: input.expiresIn,
    protocol: input.protocol,
  });

  return {
    routeSlug: input.routeSlug,
    middlewareData: middlewareData as InferMiddlewareData<TRouter[TRouteSlug]>,
    callbackMetadata,
    registerResult,
  };
}

export interface PrepareRouteUploadInput<
  TRouter extends FileRouter<TRequest, TContext>,
  TRouteSlug extends keyof TRouter & string,
  TRequest,
  TContext = undefined,
> extends Omit<
    RegisterRouteUploadInput<TRouter, TRouteSlug, TRequest, TContext>,
    "files"
  > {
  file: UploadFileInput;
}

export interface PrepareRouteUploadResult<
  TMiddlewareData extends Record<string, unknown>,
> {
  routeSlug: string;
  middlewareData: TMiddlewareData;
  callbackMetadata: Record<string, unknown>;
  prepareResult: Awaited<ReturnType<UploadCore["prepareUpload"]>>;
}

export async function prepareRouteUpload<
  TRouter extends FileRouter<TRequest, TContext>,
  TRouteSlug extends keyof TRouter & string,
  TRequest,
  TContext = undefined,
>(
  input: PrepareRouteUploadInput<TRouter, TRouteSlug, TRequest, TContext>,
): Promise<PrepareRouteUploadResult<InferMiddlewareData<TRouter[TRouteSlug]>>> {
  const registered = await registerRouteUpload({
    ...input,
    files: [input.file],
  });

  const firstFile = registered.registerResult.files[0];
  if (!firstFile) {
    throw new Error("registerRouteUpload did not return a file");
  }

  const prepareResult = registered.registerResult.mode === "development"
    ? {
        mode: "development" as const,
        file: firstFile,
        stream: registered.registerResult.stream,
        response: registered.registerResult.response,
      }
    : {
        mode: "production" as const,
        file: firstFile,
        registerResponse: registered.registerResult.registerResponse,
      };

  return {
    routeSlug: registered.routeSlug,
    middlewareData: registered.middlewareData,
    callbackMetadata: registered.callbackMetadata,
    prepareResult: prepareResult as Awaited<
      ReturnType<UploadCore["prepareUpload"]>
    >,
  };
}

export type RouteRegisterInput = Omit<
  PrepareUploadInput,
  "callbackMetadata"
>;
