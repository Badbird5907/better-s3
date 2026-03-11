export interface SiloUploadErrorShape {
  code: string;
  message: string;
  cause?: unknown;
}

export class SiloUploadError extends Error implements SiloUploadErrorShape {
  code: string;
  cause?: unknown;

  constructor(input: SiloUploadErrorShape) {
    super(input.message);
    this.name = "SiloUploadError";
    this.code = input.code;
    this.cause = input.cause;
  }
}

export interface SiloProgressEvent {
  file: File;
  fileIndex: number;
  loaded: number;
  total: number;
  percent: number;
  aggregateLoaded: number;
  aggregateTotal: number;
  aggregatePercent: number;
}

export type AnyFileRouterLike = Record<
  string,
  {
    routeConfig: unknown;
    onUploadComplete: (args: unknown) => unknown;
  }
>;

export type RouteSlug<TRouter extends AnyFileRouterLike> = keyof TRouter & string;

export type RouteOutputBySlug<
  TRouter extends AnyFileRouterLike,
  TEndpoint extends RouteSlug<TRouter>,
> = Awaited<ReturnType<TRouter[TEndpoint]["onUploadComplete"]>>;

export interface UploadCompletion<
  TRouter extends AnyFileRouterLike,
  TEndpoint extends RouteSlug<TRouter>,
> {
  fileKeyId: string;
  routeSlug: TEndpoint;
  accessKey?: string;
  uploadUrl?: string;
  result: RouteOutputBySlug<TRouter, TEndpoint>;
}

export interface UseUploadResult<
  TRouter extends AnyFileRouterLike,
  TEndpoint extends RouteSlug<TRouter>,
> {
  isIdle: boolean;
  isUploading: boolean;
  progress: {
    aggregatePercent: number;
    aggregateLoaded: number;
    aggregateTotal: number;
    byFile: Record<string, number>;
  };
  error: SiloUploadError | null;
  result: UploadCompletion<TRouter, TEndpoint>[] | null;
  uploadFiles: (
    files: File[],
    options?: {
      input?: unknown;
      requestMetadata?: Record<string, unknown>;
      expiresIn?: number;
      protocol?: "http" | "https";
      awaitTimeoutMs?: number;
    },
  ) => Promise<UploadCompletion<TRouter, TEndpoint>[]>;
  uploadFile: (
    file: File,
    options?: {
      input?: unknown;
      requestMetadata?: Record<string, unknown>;
      expiresIn?: number;
      protocol?: "http" | "https";
      awaitTimeoutMs?: number;
    },
  ) => Promise<UploadCompletion<TRouter, TEndpoint>>;
  abort: () => void;
  reset: () => void;
}

export interface UseUploadOptions<
  TRouter extends AnyFileRouterLike,
  TEndpoint extends RouteSlug<TRouter>,
> {
  endpoint: TEndpoint;
  onUploadBegin?: (file: File, fileIndex: number) => void;
  onUploadProgress?: (event: SiloProgressEvent) => void;
  onComplete?: (result: UploadCompletion<TRouter, TEndpoint>[]) => void;
  onError?: (error: SiloUploadError) => void;
  onUploadAborted?: () => void;
}

export type RouterConfigLike = Record<string, unknown>;
